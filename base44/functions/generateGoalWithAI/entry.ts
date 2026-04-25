import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function calculateDaysUntilTarget(targetDate) {
    if (!targetDate) return 30;
    const now = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
}

/**
 * Calculate AcedIt-specific targets scaled by:
 * - daysUntil: fewer days = lower targets (can't do 20 hrs in 2 days)
 * - importance (1-5): higher = more study required
 * - confidence (1-5): lower confidence = more practice needed
 * - targetScore (40-100): higher grade target = more rigorous requirements
 */
function calculateAcedItTargets(daysUntil, importance = 3, confidence = 3, targetScore = 80) {
    // Stress multiplier: high importance + low confidence + high score = more work
    const importanceFactor = importance / 3;          // 0.33 to 1.67
    const confidenceFactor = (6 - confidence) / 3;   // 0.33 to 1.67 (inverted)
    const scoreFactor = targetScore / 80;             // 0.5 to 1.25

    const stressMultiplier = (importanceFactor + confidenceFactor + scoreFactor) / 3;

    // Base hours from days available (realistic daily caps)
    let baseHours;
    if (daysUntil <= 2) baseHours = 2;
    else if (daysUntil <= 5) baseHours = 4;
    else if (daysUntil <= 7) baseHours = 6;
    else if (daysUntil <= 14) baseHours = 10;
    else if (daysUntil <= 30) baseHours = 18;
    else if (daysUntil <= 60) baseHours = 35;
    else baseHours = 55;

    const studyHours = Math.round(Math.min(baseHours * stressMultiplier, baseHours * 1.8));

    // Quiz count
    let baseQuizzes;
    if (daysUntil <= 3) baseQuizzes = 2;
    else if (daysUntil <= 7) baseQuizzes = 4;
    else if (daysUntil <= 14) baseQuizzes = 6;
    else if (daysUntil <= 30) baseQuizzes = 10;
    else baseQuizzes = 15;

    const quizCount = Math.round(Math.min(baseQuizzes * stressMultiplier, baseQuizzes * 1.8));

    // Flashcard reviews
    let baseFlashcards;
    if (daysUntil <= 3) baseFlashcards = 30;
    else if (daysUntil <= 7) baseFlashcards = 60;
    else if (daysUntil <= 14) baseFlashcards = 100;
    else if (daysUntil <= 30) baseFlashcards = 180;
    else baseFlashcards = 280;

    const flashcardReviews = Math.round(Math.min(baseFlashcards * stressMultiplier, baseFlashcards * 1.8));

    // Study sessions (pomodoro/technique sessions in AcedIt)
    let baseSessions;
    if (daysUntil <= 3) baseSessions = 3;
    else if (daysUntil <= 7) baseSessions = 6;
    else if (daysUntil <= 14) baseSessions = 10;
    else if (daysUntil <= 30) baseSessions = 16;
    else baseSessions = 25;

    const studySessions = Math.round(Math.min(baseSessions * stressMultiplier, baseSessions * 1.8));

    // Quiz score target (what % to achieve on AcedIt quizzes)
    const quizScoreTarget = Math.round(Math.min(targetScore - 5, 95)); // slightly below target score

    // Base XP scales with timeframe and effort
    const baseXP = Math.round(50 + (daysUntil / 60) * 350 * stressMultiplier);

    return {
        studyHours,
        quizCount,
        flashcardReviews,
        studySessions,
        quizScoreTarget,
        baseXP: Math.min(baseXP, 500),
        stressLevel: stressMultiplier > 1.2 ? "high" : stressMultiplier > 0.8 ? "medium" : "low"
    };
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const {
            title, description, target_date, category,
            subject_code, subject_name, user_sub_goals,
            assessment_type, target_score = 80,
            importance = 3, confidence = 3
        } = await req.json();

        const daysUntilTarget = calculateDaysUntilTarget(target_date);

        if (!title || !description || !target_date) {
            return Response.json({ error: 'Missing required fields: title, description, target_date' }, { status: 400 });
        }

        const targets = calculateAcedItTargets(daysUntilTarget, importance, confidence, target_score);
        const hasUserSubGoals = user_sub_goals && user_sub_goals.length > 0;

        const importanceLabel = ["", "Low", "Moderate", "Important", "Very High", "Critical"][importance] || "Moderate";
        const confidenceLabel = ["", "Very Low", "Low", "Moderate", "Confident", "Very Confident"][confidence] || "Moderate";

        const contextBlock = `
**AcedIt Goal Context:**
- Subject: ${subject_name || subject_code || 'General'}
- Assessment: ${assessment_type || 'Assessment'}
- Target Score: ${target_score}%
- Deadline: ${target_date} (${daysUntilTarget} days away)
- Importance: ${importanceLabel} (${importance}/5)
- Confidence: ${confidenceLabel} (${confidence}/5) — ${confidence <= 2 ? "LOW confidence = needs MORE practice" : confidence >= 4 ? "HIGH confidence = fewer reps needed" : "moderate practice needed"}
- Stress Level: ${targets.stressLevel} (based on importance × confidence × target score)

**CALIBRATED ACEDIT TARGETS (use these exact numbers as targets):**
- Study Hours in AcedIt: ${targets.studyHours} hours (tracked via Pomodoro/Study sessions)
- Quiz attempts in AcedIt: ${targets.quizCount} quizzes completed
- Quiz Score Target: ${targets.quizScoreTarget}% average on AcedIt quizzes
- Flashcard Reviews in AcedIt: ${targets.flashcardReviews} reviews (Spaced Repetition)
- Study Sessions in AcedIt: ${targets.studySessions} sessions logged

**WHY THESE NUMBERS:**
${importance >= 4 ? `- High importance (${importance}/5) → increased targets` : importance <= 2 ? `- Low importance (${importance}/5) → reduced targets` : "- Moderate importance → standard targets"}
${confidence <= 2 ? `- Low confidence (${confidence}/5) → significantly more practice needed` : confidence >= 4 ? `- High confidence (${confidence}/5) → targets reduced` : "- Moderate confidence → standard practice"}
${target_score >= 90 ? `- High target score (${target_score}%) → near-perfect quiz scores required` : target_score <= 70 ? `- Lower target score (${target_score}%) → relaxed accuracy requirement` : ""}
`;

        const toolExamples = `
**ACEDIT TOOL EXAMPLES — Use these title patterns (always name the tool + specific content):**
- Pomodoro: "Use Pomodoro timer to study [topic] for X hours" → study_hours
- Flashcards: "Create and review flashcards for all key [topic] definitions" → flashcard_reviews
- Spaced Repetition: "Use Spaced Repetition to review [topic] flashcards" → flashcard_reviews
- Quizzes: "Complete X AcedIt quizzes on [topic] and score above X%" → quiz_count or quiz_score
- Active Recall: "Log X Active Recall sessions on [topic] in AcedIt" → study_sessions
- Blurting: "Complete X Blurting sessions on [topic] in AcedIt" → study_sessions
- Exam Mode: "Do X Exam Mode timed practice sessions on [topic]" → study_sessions
`;

        const noManualRule = `
ABSOLUTE RULE: NEVER use type "manual". Every single sub-goal MUST be one of: study_hours, quiz_score, quiz_count, flashcard_reviews, study_sessions.
These are all auto-tracked in AcedIt. There are no manual checkboxes.
ALWAYS include at least one item using Active Recall, Blurting, OR Exam Mode (these are study_sessions type).
`;

        const aiPrompt = hasUserSubGoals
            ? `You are an expert AcedIt study planner for VCE students. Generate action items for EVERY user sub-goal listed below.

CRITICAL: You MUST generate EXACTLY ${user_sub_goals.length} items in sub_goals_hierarchy — one entry for EACH numbered sub-goal below. Missing any sub-goal is a critical error.

Generate action items for each user sub-goal tracked automatically in AcedIt.

${contextBlock}
${toolExamples}
${noManualRule}

**USER'S SUB-GOALS:**
${user_sub_goals.map((sg, i) => `${i + 1}. ${sg}`).join('\n')}

For EACH user sub-goal, create 3-5 action items. ALL must be AcedIt-tracked types.

**AVAILABLE TYPES (no "manual"):**
- "study_hours" — Hours via AcedIt Pomodoro/Study sessions
- "quiz_score" — Average quiz % on AcedIt
- "quiz_count" — Number of AcedIt quizzes completed
- "flashcard_reviews" — Spaced Repetition reviews in AcedIt
- "study_sessions" — Sessions in AcedIt (Active Recall, Blurting, Exam Mode count here)

**RULES:**
1. Title = "[AcedIt Tool] + [specific content]"
2. Textbook/content study → study_hours (Pomodoro timer)
3. Memorisation/definitions → flashcard_reviews
4. Practice testing → quiz_count or quiz_score
5. Active Recall, Blurting, Exam Mode → study_sessions
6. subject_filter: ALWAYS "${subject_name || subject_code}"
7. XP: study_hours ~${targets.baseXP}XP, flashcards ~${Math.round(targets.baseXP * 0.3)}XP, quiz ~${Math.round(targets.baseXP * 0.7)}XP, sessions ~${Math.round(targets.baseXP * 0.6)}XP`
            : `You are an expert AcedIt study planner for VCE students. Generate 5-6 sub-goals all tracked automatically in AcedIt.

${contextBlock}
${toolExamples}
${noManualRule}

Goal title: "${title}"
Goal description: "${description}"

**AVAILABLE TYPES (no "manual"):**
- "study_hours" — Hours via AcedIt Pomodoro/Study sessions
- "quiz_score" — Average quiz % on AcedIt
- "quiz_count" — Quizzes completed on AcedIt
- "flashcard_reviews" — Spaced Repetition reviews in AcedIt
- "study_sessions" — Sessions in AcedIt (Active Recall, Blurting, Exam Mode)

RULES:
1. ALWAYS name the AcedIt tool in the title
2. Mix ALL types — never default to only study_hours
3. MUST include Active Recall, Blurting, OR Exam Mode (study_sessions type)
4. subject_filter: ALWAYS "${subject_name || subject_code}"

Structure for ${daysUntilTarget} days:
1. "Use Pomodoro timer to study [topic] content" → study_hours, target: ${targets.studyHours}
2. "Create and review flashcards for [key concepts]" → flashcard_reviews, target: ${targets.flashcardReviews}
3. "Log X Active Recall or Blurting sessions on [topic]" → study_sessions, target: ${Math.round(targets.studySessions * 0.5)}
4. "Complete AcedIt quizzes and score above ${targets.quizScoreTarget}%" → quiz_score, target: ${targets.quizScoreTarget}
5. "Take ${targets.quizCount} AcedIt practice quizzes" → quiz_count, target: ${targets.quizCount}
6. "Complete X Exam Mode timed sessions" → study_sessions, target: ${Math.round(targets.studySessions * 0.5)}`;

        const aiResponse = await base44.integrations.Core.InvokeLLM({
            prompt: aiPrompt,
            response_json_schema: hasUserSubGoals ? {
                type: "object",
                properties: {
                    sub_goals_hierarchy: {
                        type: "array",
                        minItems: user_sub_goals.length,
                        items: {
                            type: "object",
                            properties: {
                                title: { type: "string" },
                                ai_sub_goals: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            title: { type: "string" },
                                            xp_reward: { type: "number" },
                                            steps: { type: "array", items: { type: "string" } },
                                            type: {
                                                type: "string",
                                                enum: ["study_hours", "quiz_score", "quiz_count", "flashcard_reviews", "study_sessions"]
                                                },
                                                target: { type: "number" },
                                                subject_filter: { type: "string" },
                                                navigation: {
                                                type: "string",
                                                enum: ["Study", "Quizzes", "AITools"]
                                            }
                                        },
                                        required: ["title", "xp_reward", "steps", "type", "target", "navigation"]
                                    },
                                    minItems: 3,
                                    maxItems: 5
                                }
                            },
                            required: ["title", "ai_sub_goals"]
                        }
                    },
                    total_xp_reward: { type: "number" },
                    difficulty_level: {
                        type: "string",
                        enum: ["easy", "medium", "hard", "very_hard"]
                    },
                    tips: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 4,
                        maxItems: 6
                    }
                },
                required: ["sub_goals_hierarchy", "total_xp_reward", "difficulty_level", "tips"]
            } : {
                type: "object",
                properties: {
                    difficulty_level: {
                        type: "string",
                        enum: ["easy", "medium", "hard", "very_hard"]
                    },
                    sub_goals: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                title: { type: "string" },
                                xp_reward: { type: "number" },
                                steps: { type: "array", items: { type: "string" } },
                                type: {
                                    type: "string",
                                    enum: ["study_hours", "quiz_score", "quiz_count", "flashcard_reviews", "study_sessions"]
                                },
                                target: { type: "number" },
                                subject_filter: { type: "string" },
                                navigation: {
                                    type: "string",
                                    enum: ["Study", "Quizzes", "AITools"]
                                }
                            },
                            required: ["title", "xp_reward", "steps", "type", "target", "navigation"]
                        },
                        minItems: 4,
                        maxItems: 6
                    },
                    total_xp_reward: { type: "number" },
                    tips: { type: "array", items: { type: "string" } }
                },
                required: ["difficulty_level", "sub_goals", "total_xp_reward", "tips"]
            }
        });

        let processedData;
        if (hasUserSubGoals) {
            processedData = {
                sub_goals_hierarchy: aiResponse.sub_goals_hierarchy,
                total_xp_reward: aiResponse.total_xp_reward,
                difficulty_level: aiResponse.difficulty_level,
                tips: aiResponse.tips,
                calibrated_targets: targets
            };
        } else {
            const subGoalsWithIds = (aiResponse.sub_goals || []).map((sg, index) => ({
                id: `${Date.now()}_${index}`,
                title: sg.title,
                completed: false,
                xp_reward: sg.xp_reward,
                steps: sg.steps || [],
                type: sg.type,
                target: sg.target,
                current_progress: 0,
                subject_filter: sg.subject_filter || subject_name || subject_code,
                navigation: sg.navigation
            }));

            processedData = {
                sub_goals: subGoalsWithIds,
                total_xp_reward: aiResponse.total_xp_reward,
                difficulty_level: aiResponse.difficulty_level,
                tips: aiResponse.tips,
                calibrated_targets: targets
            };
        }

        return Response.json(processedData);

    } catch (error) {
        console.error('Error generating goal:', error);
        return Response.json({ error: error.message || 'Failed to generate goal with AI' }, { status: 500 });
    }
});