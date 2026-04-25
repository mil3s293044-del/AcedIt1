import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ─── Decision Framework ──────────────────────────────────────────────────────

function analyseDifficulty(performanceSnapshot, importance, confidence, daysLeft) {
    const { avg_quiz_score = 0, challenges_completed = 0, last_score = null } = performanceSnapshot;
    const score = last_score ?? avg_quiz_score;

    // Start at foundation if never done a challenge; else adapt from last score
    let difficulty = 'developing';
    if (challenges_completed === 0) difficulty = 'foundation';
    else if (score >= 90) difficulty = 'exam_ready';
    else if (score >= 75) difficulty = 'advanced';
    else if (score >= 60) difficulty = 'proficient';
    else if (score >= 40) difficulty = 'developing';
    else difficulty = 'foundation';

    // Urgency bias: if deadline is close + importance is high, bump difficulty up
    if (daysLeft <= 3 && importance >= 4 && difficulty !== 'exam_ready') {
        const levels = ['foundation', 'developing', 'proficient', 'advanced', 'exam_ready'];
        const idx = levels.indexOf(difficulty);
        difficulty = levels[Math.min(idx + 1, 4)];
    }

    return difficulty;
}

const ALL_CHALLENGE_TYPES = ['focus_session', 'flashcard_sprint', 'practice_questions', 'mini_test', 'revision_schedule'];

function selectChallengeType(performanceSnapshot, difficulty, confidence, daysLeft, existingTypesForSubGoal = []) {
    // CRITICAL: never repeat a type that's already active/completed for this sub-goal
    const available = ALL_CHALLENGE_TYPES.filter(t => !existingTypesForSubGoal.includes(t));

    // If all types used, reset and pick the most appropriate (cycle restarts)
    const pool = available.length > 0 ? available : ALL_CHALLENGE_TYPES;

    // Smart priority within allowed pool
    if (pool.includes('focus_session') && performanceSnapshot.challenges_completed === 0) return 'focus_session';
    if (pool.includes('flashcard_sprint') && difficulty === 'foundation') return 'flashcard_sprint';
    if (pool.includes('mini_test') && daysLeft <= 7) return 'mini_test';
    if (pool.includes('flashcard_sprint') && confidence <= 2) return 'flashcard_sprint';
    if (pool.includes('revision_schedule') && performanceSnapshot.challenges_completed % 4 === 0) return 'revision_schedule';
    if (pool.includes('practice_questions')) return 'practice_questions';

    // Round-robin from pool
    return pool[performanceSnapshot.challenges_completed % pool.length];
}

function estimateStudyHours(daysLeft, importance, confidence, targetScore) {
    const base = targetScore >= 90 ? 20 : targetScore >= 75 ? 12 : 8;
    const urgencyMultiplier = daysLeft <= 7 ? 1.5 : daysLeft <= 14 ? 1.2 : 1;
    const confidenceMultiplier = confidence <= 2 ? 1.4 : confidence >= 4 ? 0.8 : 1;
    const importanceMultiplier = importance >= 4 ? 1.3 : 1;
    return Math.round(base * urgencyMultiplier * confidenceMultiplier * importanceMultiplier);
}

function getTimeLimitForType(type, difficulty) {
    const limits = {
        practice_questions: { foundation: 20, developing: 25, proficient: 20, advanced: 15, exam_ready: 12 },
        flashcard_sprint:   { foundation: 15, developing: 15, proficient: 10, advanced: 10, exam_ready: 8 },
        focus_session:      { foundation: 25, developing: 30, proficient: 35, advanced: 40, exam_ready: 45 },
        mini_test:          { foundation: 20, developing: 25, proficient: 30, advanced: 30, exam_ready: 35 },
        revision_schedule:  { foundation: 20, developing: 20, proficient: 20, advanced: 20, exam_ready: 20 },
    };
    return limits[type]?.[difficulty] || 25;
}

function getXPForChallenge(type, difficulty) {
    const base = { practice_questions: 30, flashcard_sprint: 20, focus_session: 40, mini_test: 50, revision_schedule: 25 };
    const mult = { foundation: 0.7, developing: 0.9, proficient: 1, advanced: 1.2, exam_ready: 1.5 };
    return Math.round((base[type] || 30) * (mult[difficulty] || 1));
}

// ─── AI Prompt Builder ───────────────────────────────────────────────────────

function buildPrompt(params) {
    const { goal, subGoal, type, difficulty, performance, estimatedHours, daysLeft, targetScore, assessmentType } = params;

    const difficultyDesc = {
        foundation: 'very simple, recall-based. Focus on definitions and basic concepts.',
        developing: 'moderate. Mix recall with application questions.',
        proficient: 'solid application level. Include multi-step problems.',
        advanced: 'high-level analysis. Include exam-style extended responses.',
        exam_ready: 'full exam simulation. Timed, high pressure, exam-level questions.'
    }[difficulty];

    const typeDesc = {
        practice_questions: `Generate 5-8 practice questions at ${difficulty} level (mix of MCQ and short answer). Include model answers.`,
        flashcard_sprint: `Generate 10-15 flashcard Q&A pairs targeting the weakest knowledge areas for this sub-goal.`,
        focus_session: `Design a structured ${getTimeLimitForType(type, difficulty)}-minute deep focus study session with clear phases: what to read, what to do, what to produce.`,
        mini_test: `Create a 6-question mini-test simulating ${assessmentType || 'exam'} conditions. Include a marking guide.`,
        revision_schedule: `Create a day-by-day revision micro-plan for the next ${Math.min(daysLeft, 7)} days for this sub-goal. Each day should have a specific task under 45 minutes.`,
    }[type];

    return `You are an expert VCE study coach and AI challenge designer for the AcedIt platform.

**GOAL CONTEXT:**
- Goal: ${goal.title}
- Sub-Goal: ${subGoal.title}
- Subject: ${goal.subject_code || 'General'}
- Assessment Type: ${assessmentType || 'Exam'}
- Target Score: ${targetScore || 80}%
- Days Until Deadline: ${daysLeft}
- Estimated Required Study Hours: ${estimatedHours}h total

**STUDENT PERFORMANCE:**
- Challenges Completed: ${performance.challenges_completed}
- Average Quiz Score: ${performance.avg_quiz_score}%
- Last Challenge Score: ${performance.last_score ?? 'N/A'}
- Study Hours Logged: ${performance.study_hours_logged}h

**CHALLENGE PARAMETERS:**
- Challenge Type: ${type}
- Difficulty Level: ${difficulty} — ${difficultyDesc}
- Time Limit: ${getTimeLimitForType(type, difficulty)} minutes

**YOUR TASK:**
${typeDesc}

Generate a complete, immediately-usable challenge. Be specific and VCE-relevant.
The challenge must efficiently improve the student's score on the target assessment.
Include your brief AI reasoning for why this challenge was chosen at this difficulty.`;
}

// ─── Response Schema Builder ─────────────────────────────────────────────────

function buildSchema(type) {
    const contentSchema = {
        practice_questions: {
            type: 'object', properties: {
                questions: { type: 'array', items: {
                    type: 'object', properties: {
                        question: { type: 'string' },
                        type: { type: 'string', enum: ['mcq', 'short_answer'] },
                        options: { type: 'array', items: { type: 'string' } },
                        answer: { type: 'string' },
                        marks: { type: 'number' },
                        hint: { type: 'string' }
                    }, required: ['question', 'type', 'answer']
                }}
            }, required: ['questions']
        },
        flashcard_sprint: {
            type: 'object', properties: {
                cards: { type: 'array', items: {
                    type: 'object', properties: {
                        front: { type: 'string' },
                        back: { type: 'string' },
                        memory_tip: { type: 'string' }
                    }, required: ['front', 'back']
                }}
            }, required: ['cards']
        },
        focus_session: {
            type: 'object', properties: {
                phases: { type: 'array', items: {
                    type: 'object', properties: {
                        name: { type: 'string' },
                        duration_minutes: { type: 'number' },
                        activity: { type: 'string' },
                        goal: { type: 'string' }
                    }, required: ['name', 'duration_minutes', 'activity']
                }},
                materials_needed: { type: 'array', items: { type: 'string' } },
                success_indicator: { type: 'string' }
            }, required: ['phases']
        },
        mini_test: {
            type: 'object', properties: {
                questions: { type: 'array', items: {
                    type: 'object', properties: {
                        question: { type: 'string' },
                        type: { type: 'string', enum: ['mcq', 'short_answer'] },
                        options: { type: 'array', items: { type: 'string' } },
                        answer: { type: 'string' },
                        marks: { type: 'number' },
                        explanation: { type: 'string' }
                    }, required: ['question', 'type', 'answer', 'marks']
                }},
                total_marks: { type: 'number' },
                marking_guide: { type: 'string' }
            }, required: ['questions', 'total_marks']
        },
        revision_schedule: {
            type: 'object', properties: {
                days: { type: 'array', items: {
                    type: 'object', properties: {
                        day: { type: 'number' },
                        label: { type: 'string' },
                        task: { type: 'string' },
                        method: { type: 'string' },
                        duration_minutes: { type: 'number' },
                        outcome: { type: 'string' }
                    }, required: ['day', 'task', 'duration_minutes']
                }}
            }, required: ['days']
        }
    };

    return {
        type: 'object',
        properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            instructions: { type: 'string' },
            target_metric: { type: 'string' },
            content: contentSchema[type] || { type: 'object' },
            ai_reasoning: { type: 'string' }
        },
        required: ['title', 'description', 'instructions', 'content', 'ai_reasoning']
    };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { goal_id, sub_goal_id } = await req.json();
        if (!goal_id || !sub_goal_id) return Response.json({ error: 'goal_id and sub_goal_id required' }, { status: 400 });

        // 1. Fetch goal
        const goal = await base44.entities.Goal.get(goal_id);
        if (!goal) return Response.json({ error: 'Goal not found' }, { status: 404 });
        if (goal.created_by !== user.email) return Response.json({ error: 'Goal not found' }, { status: 404 });

        const subGoal = (goal.sub_goals || []).find(sg => sg.id === sub_goal_id);
        if (!subGoal) return Response.json({ error: 'Sub-goal not found' }, { status: 404 });

        // Parse goal metadata from description
        const descMatch = goal.description || '';
        const assessmentType = descMatch.split('—')[0]?.trim() || 'Exam';
        const targetScoreMatch = descMatch.match(/Target:\s*(\d+)%/);
        const targetScore = targetScoreMatch ? parseInt(targetScoreMatch[1]) : 80;

        const daysLeft = goal.target_date
            ? Math.max(0, Math.ceil((new Date(goal.target_date) - new Date()) / 86400000))
            : 14;

        const importance = goal.priority === 'high' ? 5 : goal.priority === 'medium' ? 3 : 1;
        const confidence = 3; // default; future: read from UserProfile

        // 2. Gather performance data
        const [pastChallenges, quizAttempts, studyTechniques] = await Promise.all([
            base44.entities.GoalChallenge.filter({ goal_id, created_by: user.email }),
            base44.entities.QuizAttempt.filter({ created_by: user.email }),
            base44.entities.StudyTechnique.filter({ created_by: user.email }),
        ]);

        const completedChallenges = pastChallenges.filter(c => c.status === 'completed');
        const subjectQuizzes = quizAttempts.filter(a =>
            a.quiz_title?.toLowerCase().includes((goal.subject_code || '').toLowerCase())
        );
        const avgQuizScore = subjectQuizzes.length > 0
            ? Math.round(subjectQuizzes.reduce((s, a) => s + (a.score || 0), 0) / subjectQuizzes.length)
            : 0;
        const lastScore = completedChallenges.length > 0
            ? completedChallenges.at(-1)?.result?.score ?? null
            : null;
        const studyHours = studyTechniques
            .filter(s => s.subject?.toLowerCase().includes((goal.subject_code || '').toLowerCase()))
            .reduce((s, t) => s + (t.session_duration || 0), 0) / 60;

        const performance = {
            avg_quiz_score: avgQuizScore,
            study_hours_logged: Math.round(studyHours * 10) / 10,
            days_until_deadline: daysLeft,
            challenges_completed: completedChallenges.length,
            last_score: lastScore,
        };

        // 3. AI decision framework — enforce unique technique per sub-goal
        const existingTypesForSubGoal = pastChallenges
            .filter(c => c.sub_goal_id === sub_goal_id && c.status !== 'skipped')
            .map(c => c.challenge_type);

        const difficulty = analyseDifficulty(performance, importance, confidence, daysLeft);
        const type = selectChallengeType(performance, difficulty, confidence, daysLeft, existingTypesForSubGoal);
        const estimatedHours = estimateStudyHours(daysLeft, importance, confidence, targetScore);
        const timeLimit = getTimeLimitForType(type, difficulty);
        const xpReward = getXPForChallenge(type, difficulty);

        // 4. Generate challenge content via LLM
        const prompt = buildPrompt({ goal, subGoal, type, difficulty, performance, estimatedHours, daysLeft, targetScore, assessmentType });
        const schema = buildSchema(type);

        const aiResult = await base44.integrations.Core.InvokeLLM({
            prompt,
            response_json_schema: schema,
        });

        // Build objective completion criteria per type
        function buildCriteria(t, diff, content, tl) {
            if (t === 'focus_session') return { min_focus_minutes: Math.round(tl * 0.7) };
            if (t === 'practice_questions') return { min_questions_attempted: Math.ceil((content?.questions?.length || 5) * 0.8) };
            if (t === 'flashcard_sprint') return { min_cards_reviewed: Math.ceil((content?.cards?.length || 10) * 0.9) };
            if (t === 'mini_test') return { min_score_percent: diff === 'foundation' ? 50 : diff === 'developing' ? 60 : diff === 'proficient' ? 65 : 70 };
            if (t === 'revision_schedule') return { min_days_completed: Math.ceil((content?.days?.length || 5) * 0.8) };
            return {};
        }

        // 5. Save challenge to DB
        const challengeData = {
            goal_id,
            sub_goal_id,
            sub_goal_title: subGoal.title,
            subject_name: goal.subject_code || '',
            subject_code: goal.subject_code || '',
            challenge_type: type,
            difficulty,
            title: aiResult.title,
            description: aiResult.description,
            instructions: aiResult.instructions,
            content: aiResult.content,
            target_metric: aiResult.target_metric || `Score ≥ ${targetScore}%`,
            time_limit_minutes: timeLimit,
            xp_reward: xpReward,
            status: 'active',
            ai_reasoning: aiResult.ai_reasoning,
            performance_snapshot: performance,
            generation_number: (pastChallenges.length || 0) + 1,
            completion_criteria: buildCriteria(type, difficulty, aiResult.content, timeLimit),
            progress: { focus_seconds_elapsed: 0, questions_attempted: 0, questions_correct: 0, cards_reviewed: 0, cards_correct: 0, days_marked: 0, percent_complete: 0, tab_away_count: 0, integrity_flags: [] },
        };

        const saved = await base44.entities.GoalChallenge.create(challengeData);

        return Response.json({
            challenge: saved,
            meta: { difficulty, type, estimatedHours, daysLeft, performance }
        });

    } catch (error) {
        console.error('generateGoalChallenge error:', error);
        return Response.json({ error: error.message || 'Failed to generate challenge' }, { status: 500 });
    }
});