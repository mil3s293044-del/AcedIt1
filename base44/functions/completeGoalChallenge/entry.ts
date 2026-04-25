import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ─── Validation Rules per Challenge Type ─────────────────────────────────────

function validateCompletion(challenge, submittedProgress) {
    const criteria = challenge.completion_criteria || {};
    const progress = { ...(challenge.progress || {}), ...submittedProgress };
    const flags = [];
    const errors = [];

    const type = challenge.challenge_type;

    // ── Focus Session ─────────────────────────────────────────────────────────
    if (type === 'focus_session') {
        const minSeconds = (criteria.min_focus_minutes || challenge.time_limit_minutes * 0.7) * 60;
        const elapsed = progress.focus_seconds_elapsed || 0;
        if (elapsed < minSeconds) {
            errors.push(`Not enough focus time. Need ${Math.round(minSeconds / 60)} min, got ${Math.round(elapsed / 60)} min.`);
        }
        if ((progress.tab_away_count || 0) > 5) {
            flags.push('excessive_tab_switching');
            errors.push('Too many tab switches detected — focus time may be invalid.');
        }
    }

    // ── Practice Questions ────────────────────────────────────────────────────
    if (type === 'practice_questions') {
        const totalQ = challenge.content?.questions?.length || 1;
        const minAttempt = criteria.min_questions_attempted || Math.ceil(totalQ * 0.8);
        const attempted = progress.questions_attempted || 0;
        if (attempted < minAttempt) {
            errors.push(`Attempt at least ${minAttempt} of ${totalQ} questions (${attempted} done).`);
        }
    }

    // ── Mini Test ─────────────────────────────────────────────────────────────
    if (type === 'mini_test') {
        if (!progress.mini_test_submitted) {
            errors.push('You must submit the test before completing.');
        }
        const minScore = criteria.min_score_percent || 0;
        const score = progress.mini_test_score || 0;
        if (minScore > 0 && score < minScore) {
            errors.push(`Score too low. Need ≥${minScore}%, got ${score}%.`);
        }
    }

    // ── Flashcard Sprint ──────────────────────────────────────────────────────
    if (type === 'flashcard_sprint') {
        const totalCards = challenge.content?.cards?.length || 1;
        const minCards = criteria.min_cards_reviewed || Math.ceil(totalCards * 0.9);
        const reviewed = progress.cards_reviewed || 0;
        if (reviewed < minCards) {
            errors.push(`Review at least ${minCards} cards (${reviewed} reviewed so far).`);
        }
    }

    // ── Revision Schedule ─────────────────────────────────────────────────────
    if (type === 'revision_schedule') {
        const totalDays = challenge.content?.days?.length || 1;
        const minDays = criteria.min_days_completed || Math.ceil(totalDays * 0.8);
        const done = progress.days_marked || 0;
        if (done < minDays) {
            errors.push(`Complete at least ${minDays} of ${totalDays} revision days (${done} done).`);
        }
    }

    return { valid: errors.length === 0, errors, flags };
}

function computeScore(challenge, progress) {
    const type = challenge.challenge_type;
    if (type === 'mini_test') return progress.mini_test_score ?? null;
    if (type === 'practice_questions') {
        const attempted = progress.questions_attempted || 1;
        const correct = progress.questions_correct || 0;
        return Math.round((correct / attempted) * 100);
    }
    if (type === 'flashcard_sprint') {
        const reviewed = progress.cards_reviewed || 1;
        const correct = progress.cards_correct || 0;
        return Math.round((correct / reviewed) * 100);
    }
    if (type === 'focus_session') {
        const target = (challenge.time_limit_minutes || 30) * 60;
        const elapsed = progress.focus_seconds_elapsed || 0;
        return Math.min(100, Math.round((elapsed / target) * 100));
    }
    if (type === 'revision_schedule') {
        const total = challenge.content?.days?.length || 1;
        const done = progress.days_marked || 0;
        return Math.round((done / total) * 100);
    }
    return null;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { challenge_id, final_progress } = body;
        if (!challenge_id) return Response.json({ error: 'challenge_id required' }, { status: 400 });

        // Fetch challenge
        const challenges = await base44.entities.GoalChallenge.filter({ id: challenge_id });
        const challenge = challenges?.[0];
        if (!challenge || challenge.created_by !== user.email) {
            return Response.json({ error: 'Challenge not found' }, { status: 404 });
        }
        if (challenge.status === 'completed') {
            return Response.json({ error: 'Already completed' }, { status: 400 });
        }

        // Validate objective completion
        const { valid, errors, flags } = validateCompletion(challenge, final_progress || {});
        if (!valid) {
            return Response.json({ error: 'Completion criteria not met', reasons: errors }, { status: 422 });
        }

        // Merge progress
        const mergedProgress = { ...(challenge.progress || {}), ...(final_progress || {}) };
        const score = computeScore(challenge, mergedProgress);
        const focusMinutes = Math.round((mergedProgress.focus_seconds_elapsed || 0) / 60 * 10) / 10;

        // Mark complete
        const updated = await base44.entities.GoalChallenge.update(challenge_id, {
            status: 'completed',
            progress: { ...mergedProgress, percent_complete: 100, integrity_flags: flags },
            result: {
                score: score ?? null,
                time_taken_minutes: focusMinutes || challenge.time_limit_minutes,
                completed_at: new Date().toISOString(),
                questions_attempted: mergedProgress.questions_attempted || null,
                questions_correct: mergedProgress.questions_correct || null,
                cards_reviewed: mergedProgress.cards_reviewed || null,
                focus_minutes_verified: focusMinutes || null,
                days_completed: mergedProgress.days_marked || null,
            }
        });

        // Apply integrity penalty to score for XP calculation
        const effectiveScore = flags.length > 0 ? Math.round((score || 0) * 0.5) : (score || null);

        // Calculate days until goal deadline for urgency bonus
        let daysUntilDeadline = null;
        try {
            const goals = await base44.entities.Goal.filter({ id: challenge.goal_id });
            if (goals[0]?.target_date) {
                daysUntilDeadline = Math.ceil((new Date(goals[0].target_date) - new Date()) / 86400000);
            }
        } catch (_) {}

        let xpAwarded = 0;
        try {
            const xpRes = await base44.functions.invoke('awardXP', {
                source: 'challenge',
                event_key: `challenge_${challenge.id}`,
                challenge_type: challenge.challenge_type,
                difficulty: challenge.difficulty,
                score_percent: effectiveScore,
                days_until_deadline: daysUntilDeadline,
                importance: challenge.performance_snapshot?.importance || 'medium',
            });
            xpAwarded = xpRes?.data?.xp_awarded || 0;
        } catch (_) { xpAwarded = challenge.xp_reward || 0; }

        // Log study session for focus type
        if (challenge.challenge_type === 'focus_session' && focusMinutes > 0) {
            await base44.entities.StudyTechnique.create({
                technique_name: 'active_recall',
                session_duration: focusMinutes,
                subject: challenge.subject_name,
                topic: challenge.sub_goal_title,
                notes: `AI Challenge: ${challenge.title}`,
                date: new Date().toISOString().split('T')[0],
                xp_earned: xpAwarded,
            });
        }

        return Response.json({
            success: true,
            xp_awarded: xpAwarded,
            score,
            integrity_flags: flags,
            challenge: updated
        });

    } catch (error) {
        console.error('completeGoalChallenge error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});