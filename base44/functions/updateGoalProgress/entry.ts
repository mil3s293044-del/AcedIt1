import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function calculateSubGoalProgress(base44, subGoal, userEmail, goalCreatedDate) {
    const subjectFilter = subGoal.subject_filter || null;
    // Only count activity that happened AFTER the goal was created (clean slate)
    const baseline = goalCreatedDate ? new Date(goalCreatedDate) : null;
    const afterBaseline = (record) => {
        if (!baseline) return true;
        const d = record.created_date ? new Date(record.created_date) : null;
        return d ? d >= baseline : true;
    };

    // Case-insensitive subject matching
    const matchesSubject = (record, filter) => {
        if (!filter) return true;
        const f = filter.toLowerCase();
        return (record.subject || '').toLowerCase().includes(f) ||
               (record.subject_name || '').toLowerCase().includes(f);
    };

    try {
        switch (subGoal.type) {
            case 'study_hours': {
                const [sessions, pomodoros] = await Promise.all([
                    base44.entities.StudyTechnique.filter({ created_by: userEmail }),
                    base44.entities.StudySession.filter({ created_by: userEmail }),
                ]);
                const techMinutes = sessions.filter(afterBaseline).filter(s => matchesSubject(s, subjectFilter)).reduce((sum, s) => sum + (s.session_duration || 0), 0);
                const sessMinutes = pomodoros.filter(afterBaseline).filter(s => matchesSubject(s, subjectFilter)).reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
                const hours = (techMinutes + sessMinutes) / 60;
                return Math.min(hours, subGoal.target);
            }

            case 'quiz_score': {
                const attempts = await base44.entities.QuizAttempt.filter({ created_by: userEmail });
                let filtered = attempts.filter(afterBaseline);
                if (subjectFilter) filtered = filtered.filter(a => a.quiz_title?.toLowerCase().includes(subjectFilter.toLowerCase()));
                if (filtered.length === 0) return 0;
                const avg = filtered.reduce((sum, a) => sum + (a.score || 0), 0) / filtered.length;
                return Math.min(avg, subGoal.target);
            }

            case 'quiz_count': {
                const attempts = await base44.entities.QuizAttempt.filter({ created_by: userEmail });
                let filtered = attempts.filter(afterBaseline);
                if (subjectFilter) filtered = filtered.filter(a => a.quiz_title?.toLowerCase().includes(subjectFilter.toLowerCase()));
                return Math.min(filtered.length, subGoal.target);
            }

            case 'flashcard_reviews': {
                const query = subjectFilter
                    ? { created_by: userEmail, subject_name: subjectFilter }
                    : { created_by: userEmail };
                const flashcards = await base44.entities.Flashcard.filter(query);
                // Count cards that have been reviewed (updated) after the baseline
                // Each qualifying card counts as however many reviews it's had since goal creation.
                // We use updated_date (ISO timestamp) as the most reliable post-baseline signal.
                const total = flashcards.reduce((sum, f) => {
                    if (!baseline) return sum + (f.totalReviews || 0);
                    const updatedAt = f.updated_date ? new Date(f.updated_date) : null;
                    if (!updatedAt || updatedAt < baseline) return sum;
                    // Count successful reviews on cards touched after baseline
                    return sum + (f.review_count_good || 0) + (f.review_count_easy || 0);
                }, 0);
                return Math.min(total, subGoal.target);
            }

            case 'study_sessions': {
                const [sessions, pomodoros] = await Promise.all([
                    base44.entities.StudyTechnique.filter({ created_by: userEmail }),
                    base44.entities.StudySession.filter({ created_by: userEmail }),
                ]);
                const filteredSess = sessions.filter(afterBaseline).filter(s => matchesSubject(s, subjectFilter));
                const filteredPom = pomodoros.filter(afterBaseline).filter(s => matchesSubject(s, subjectFilter));
                return Math.min(filteredSess.length + filteredPom.length, subGoal.target);
            }

            default:
                return 0;
        }
    } catch (error) {
        console.error(`Error calculating progress for ${subGoal.type}:`, error.message);
        return subGoal.current_progress || 0;
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { goal_id } = await req.json();
        if (!goal_id) {
            return Response.json({ error: 'goal_id required' }, { status: 400 });
        }

        // Fetch goal — ensure it belongs to this user
        const goals = await base44.entities.Goal.filter({ created_by: user.email });
        const currentGoal = goals.find(g => g.id === goal_id);
        if (!currentGoal) {
            return Response.json({ error: 'Goal not found' }, { status: 404 });
        }

        // Block progress updates on goals that are already done or past their deadline
        if (currentGoal.is_completed) {
            return Response.json({ success: true, skipped: true, reason: 'Goal already completed' });
        }
        if (currentGoal.target_date && new Date(currentGoal.target_date) < new Date()) {
            return Response.json({ success: true, skipped: true, reason: 'Goal deadline has passed' });
        }

        // Use tracking_start_date (explicitly set at goal creation) as baseline so only NEW activity counts
        const goalBaseline = currentGoal.tracking_start_date || currentGoal.created_date || null;

        // Update progress for each sub-goal
        const updatedSubGoals = await Promise.all(
            (currentGoal.sub_goals || []).map(async (subGoal) => {
                // Has nested sub-sub-goals
                if (subGoal.sub_sub_goals && subGoal.sub_sub_goals.length > 0) {
                    const updatedSubSubGoals = await Promise.all(
                        subGoal.sub_sub_goals.map(async (subSubGoal) => {
                            if (!subSubGoal.type || subSubGoal.type === 'manual') {
                                return subSubGoal;
                            }
                            const currentProgress = await calculateSubGoalProgress(base44, subSubGoal, user.email, goalBaseline);
                            const isCompleted = subSubGoal.target > 0
                                ? (currentProgress / subSubGoal.target) * 100 >= 100
                                : subSubGoal.completed;
                            return { ...subSubGoal, current_progress: currentProgress, completed: isCompleted };
                        })
                    );

                    const allSubSubCompleted = updatedSubSubGoals.length > 0 && updatedSubSubGoals.every(ssg => ssg.completed);
                    return { ...subGoal, sub_sub_goals: updatedSubSubGoals, completed: allSubSubCompleted };
                } else {
                    if (!subGoal.type || subGoal.type === 'manual') {
                        return subGoal;
                    }
                    const currentProgress = await calculateSubGoalProgress(base44, subGoal, user.email, goalBaseline);
                    const isCompleted = subGoal.target > 0
                        ? (currentProgress / subGoal.target) * 100 >= 100
                        : subGoal.completed;
                    return { ...subGoal, current_progress: currentProgress, completed: isCompleted };
                }
            })
        );

        // Overall progress
        const completedCount = updatedSubGoals.filter(sg => sg.completed).length;
        const overallProgress = updatedSubGoals.length > 0
            ? Math.round((completedCount / updatedSubGoals.length) * 100)
            : 0;

        await base44.entities.Goal.update(goal_id, {
            sub_goals: updatedSubGoals,
            progress: overallProgress,
            is_completed: overallProgress === 100
        });

        // Award XP for newly completed sub-goals and sub-sub-goals using awardXP engine
        for (const subGoal of updatedSubGoals) {
            const originalSubGoal = currentGoal.sub_goals.find(sg => sg.id === subGoal.id);

            if (subGoal.sub_sub_goals) {
                for (const subSubGoal of subGoal.sub_sub_goals) {
                    const originalSubSubGoal = originalSubGoal?.sub_sub_goals?.find(ssg => ssg.id === subSubGoal.id);
                    if (!originalSubSubGoal?.completed && subSubGoal.completed && (subSubGoal.xp_reward || 0) > 0) {
                        try {
                            const isFlashcard = subSubGoal.type === 'flashcard_reviews';
                            const cappedXp = isFlashcard ? Math.min(subSubGoal.xp_reward, 400) : subSubGoal.xp_reward;
                            await base44.functions.invoke('awardXP', {
                                source: 'sub_goal',
                                event_key: `sub_sub_goal_${goal_id}_${subSubGoal.id}`,
                                xp_reward: cappedXp,
                                priority: currentGoal.priority || 'medium',
                            });
                        } catch (e) {
                            console.error('XP award error (sub-sub-goal):', e.message);
                        }
                    }
                }
            }

            if (!originalSubGoal?.completed && subGoal.completed && (subGoal.xp_reward || 0) > 0) {
                try {
                    await base44.functions.invoke('awardXP', {
                        source: 'sub_goal',
                        event_key: `sub_goal_${goal_id}_${subGoal.id}`,
                        xp_reward: subGoal.xp_reward,
                        priority: currentGoal.priority || 'medium',
                    });
                } catch (e) {
                    console.error('XP award error (sub-goal):', e.message);
                }
            }
        }

        // Award XP for completing the whole goal
        if (overallProgress === 100 && currentGoal.progress !== 100 && (currentGoal.total_xp_reward || 0) > 0) {
            try {
                await base44.functions.invoke('awardXP', {
                    source: 'goal',
                    event_key: `goal_complete_${goal_id}`,
                    xp_reward: currentGoal.total_xp_reward,
                    difficulty_level: currentGoal.difficulty_level || 'medium',
                });
            } catch (e) {
                console.error('XP award error (goal completion):', e.message);
            }
        }

        return Response.json({
            success: true,
            updated_sub_goals: updatedSubGoals,
            overall_progress: overallProgress
        });

    } catch (error) {
        console.error('updateGoalProgress error:', error.message);
        return Response.json({ error: error.message || 'Failed to update goal progress' }, { status: 500 });
    }
});