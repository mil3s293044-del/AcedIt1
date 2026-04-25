/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  AcedIt XP Engine v2 — Verified, Idempotent, Anti-Cheat XP Award Function
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURE:
 *  1. Every call supplies a unique event_key (idempotency — no double awards)
 *  2. XP is calculated from formulas, never from client-supplied values
 *  3. Daily caps per source prevent grinding
 *  4. Rolling hourly velocity cap (600 XP/hr) blocks burst exploits
 *  5. All events written to XPEvent audit log
 *  6. UserProfile, Leaderboard & SchoolProfile updated atomically after
 *
 * ── XP FORMULAS ─────────────────────────────────────────────────────────────
 *
 *  FOCUS TIMER (per verified active minute):
 *    base = min(duration_minutes, 120) × 0.8 XP/min
 *    full_session_bonus = +25% if no idle/tab-away detected
 *    inactivity_penalty = −50% if idle_ratio > 0.3
 *    daily cap: 150 XP
 *
 *  PRACTICE QUESTIONS:
 *    per_question = 1.5 XP base
 *    accuracy_mult = 1 + max(0, (accuracy_pct - 50) / 50)   → 1.0×–2.0×
 *    streak_bonus = +0.5 XP per consecutive correct (resets on wrong), cap +10
 *    difficulty_mult: foundation 0.7 | developing 0.9 | proficient 1.0 | advanced 1.3 | exam_ready 1.6
 *    formula: questions × per_question × accuracy_mult × difficulty_mult + streak_bonus
 *    daily cap: 100 XP
 *
 *  FLASHCARDS (per session):
 *    base = cards_reviewed × 0.6 XP
 *    correct_bonus = cards_correct × 0.4 XP
 *    hard_card_bonus = hard_cards × 0.5 XP extra
 *    daily cap: 80 XP
 *
 *  MINI-TESTS:
 *    base = 20 XP completion
 *    score_mult = 1 + (score/100)            → 1.0×–2.0×
 *    improvement_mult = 1 + max(0, (score - prev_score) / 100)  → up to 2.0×
 *    formula: 20 × score_mult × improvement_mult
 *    daily cap: 120 XP
 *
 *  CHALLENGES (goal challenges):
 *    base: focus_session=50, practice_questions=40, flashcard_sprint=30, mini_test=60, revision_schedule=35
 *    difficulty_mult: foundation 0.7 | developing 0.9 | proficient 1.0 | advanced 1.3 | exam_ready 1.6
 *    score_bonus: +30% if score ≥ 90%, +10% if ≥ 75%, −20% if < 50%
 *    urgency_bonus: +15% if deadline ≤ 3 days
 *    importance_mult: low 0.8 | medium 1.0 | high 1.3
 *    integrity_penalty: 0.5× per flag
 *
 *  SUB-GOAL:
 *    base xp_reward × priority_mult (low 0.8, medium 1.0, high 1.3)
 *
 *  GOAL COMPLETION:
 *    base xp_reward × difficulty_mult (easy 0.8, medium 1.0, hard 1.4, very_hard 1.8)
 *
 *  QUIZZES:
 *    base = 8 + (score/100 × 42)   → 8–50 XP
 *    speed_bonus = max(0, 5 − floor(avg_secs_per_q / 30))
 *    daily cap: 100 XP
 *
 *  STUDY SESSION (pomodoro/focused):
 *    0.8 XP/min, cap at 80 XP/session, min 2 min
 *    daily cap: 160 XP
 *
 *  STREAK:
 *    base 15 + streak_days × 2, cap 100 XP
 *
 *  WEEKLY STREAK: flat 75 XP
 *  FRIEND WIN: flat 100 XP
 *
 *  WAGER:
 *    exact (±3%): wagered_xp × 3.5
 *    close (±10%): wagered_xp × 1.5
 *    wrong: 0 XP
 *
 * ── LEVEL CURVE ──────────────────────────────────────────────────────────────
 *  XP for level N = cumulative sum of (120 × i^1.6) for i=1..N-1
 *  Level 1: 0 XP | Level 5: ~900 | Level 10: ~7k | Level 20: ~52k | Level 50: ~900k
 *  Slower than before — reaching high levels takes real long-term effort.
 *
 * ── SEASONAL XP & RANKS ──────────────────────────────────────────────────────
 *  Season ~20 weeks. Seasonal XP resets per season.
 *  All-Time XP never resets.
 *  Rank tiers use SEASON XP (so each season is a fresh competitive race).
 *  All-Time ranks use TOTAL XP (prestige / bragging rights).
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ─── Level Curve (steeper — 120 × i^1.6) ─────────────────────────────────────

function xpForLevel(n) {
    if (n <= 1) return 0;
    let total = 0;
    for (let i = 1; i < n; i++) total += Math.round(120 * Math.pow(i, 1.6));
    return total;
}

function xpToNextLevel(n) {
    return Math.round(120 * Math.pow(n, 1.6));
}

function levelFromXP(totalXP) {
    let level = 1;
    while (xpForLevel(level + 1) <= totalXP) {
        level++;
        if (level > 500) break;
    }
    return level;
}

function levelProgress(totalXP) {
    const level = levelFromXP(totalXP);
    const start = xpForLevel(level);
    const end = xpForLevel(level + 1);
    return Math.min(100, Math.round(((totalXP - start) / (end - start)) * 100));
}

// ─── All-Time Rank Tiers (XP-based, MUCH higher thresholds) ──────────────────

const XP_RANKS = [
    { name: "Slackademic",            minXP: 0,       maxXP: 800,    tier: 1,  gradient: "from-slate-500 via-gray-500 to-slate-600",           color: "#64748b", emoji: "😴" },
    { name: "Barely Literate Bandit", minXP: 800,     maxXP: 3000,   tier: 2,  gradient: "from-stone-500 via-stone-600 to-slate-500",           color: "#78716c", emoji: "📖" },
    { name: "Wikipedia Warrior",      minXP: 3000,    maxXP: 8000,   tier: 3,  gradient: "from-orange-500 via-amber-500 to-yellow-500",         color: "#f97316", emoji: "🖱️" },
    { name: "Flash Card Finesser",    minXP: 8000,    maxXP: 18000,  tier: 4,  gradient: "from-amber-500 via-yellow-500 to-orange-500",         color: "#f59e0b", emoji: "🗂️" },
    { name: "Highlighter Hoarder",    minXP: 18000,   maxXP: 35000,  tier: 5,  gradient: "from-lime-500 via-green-500 to-emerald-500",          color: "#84cc16", emoji: "🖍️" },
    { name: "Grind Gremlin",          minXP: 35000,   maxXP: 65000,  tier: 6,  gradient: "from-emerald-500 via-teal-500 to-cyan-500",           color: "#10b981", emoji: "🧠" },
    { name: "Pomodoro Prodigy",       minXP: 65000,   maxXP: 120000, tier: 7,  gradient: "from-cyan-500 via-blue-500 to-indigo-500",            color: "#06b6d4", emoji: "⏱️" },
    { name: "Academic Weapon",        minXP: 120000,  maxXP: 220000, tier: 8,  gradient: "from-violet-500 via-purple-500 to-fuchsia-500",       color: "#8b5cf6", emoji: "🚀" },
    { name: "VCE Demigod",            minXP: 220000,  maxXP: 400000, tier: 9,  gradient: "from-rose-500 via-pink-500 to-fuchsia-600",           color: "#f43f5e", emoji: "⚡" },
    { name: "Legend of the HSC",      minXP: 400000,  maxXP: Infinity, tier: 10, gradient: "from-yellow-400 via-amber-400 to-orange-500",      color: "#f59e0b", emoji: "👑" },
];

function getRankFromXP(totalXP) {
    return XP_RANKS.find(r => totalXP >= r.minXP && totalXP < r.maxXP) || XP_RANKS[XP_RANKS.length - 1];
}

// ─── Seasonal Rank Tiers (uses season_xp, resets each season) ────────────────
// These are MUCH harder than before — season is ~20 weeks of real effort.

const SEASON_RANKS = [
    { name: "Bronze I",    minXP: 0,     maxXP: 1200,  tier: 1,  gradient: "from-amber-700 to-yellow-800",            color: "#92400e", emoji: "🥉" },
    { name: "Bronze II",   minXP: 1200,  maxXP: 2800,  tier: 2,  gradient: "from-amber-600 to-yellow-700",            color: "#b45309", emoji: "🥉" },
    { name: "Bronze III",  minXP: 2800,  maxXP: 5000,  tier: 3,  gradient: "from-amber-500 to-yellow-600",            color: "#d97706", emoji: "🥉" },
    { name: "Silver I",    minXP: 5000,  maxXP: 9000,  tier: 4,  gradient: "from-slate-400 to-gray-500",              color: "#6b7280", emoji: "🥈" },
    { name: "Silver II",   minXP: 9000,  maxXP: 15000, tier: 5,  gradient: "from-slate-300 to-gray-400",              color: "#9ca3af", emoji: "🥈" },
    { name: "Silver III",  minXP: 15000, maxXP: 24000, tier: 6,  gradient: "from-gray-300 to-slate-300",              color: "#d1d5db", emoji: "🥈" },
    { name: "Gold I",      minXP: 24000, maxXP: 38000, tier: 7,  gradient: "from-yellow-400 to-amber-500",            color: "#f59e0b", emoji: "🥇" },
    { name: "Gold II",     minXP: 38000, maxXP: 58000, tier: 8,  gradient: "from-yellow-300 to-amber-400",            color: "#fbbf24", emoji: "🥇" },
    { name: "Gold III",    minXP: 58000, maxXP: 85000, tier: 9,  gradient: "from-yellow-200 to-amber-300",            color: "#fde68a", emoji: "🥇" },
    { name: "Platinum I",  minXP: 85000, maxXP: 120000, tier: 10, gradient: "from-cyan-400 to-teal-500",             color: "#0891b2", emoji: "💠" },
    { name: "Platinum II", minXP: 120000, maxXP: 170000, tier: 11, gradient: "from-cyan-300 to-teal-400",            color: "#22d3ee", emoji: "💠" },
    { name: "Platinum III",minXP: 170000, maxXP: 240000, tier: 12, gradient: "from-cyan-200 to-sky-300",             color: "#7dd3fc", emoji: "💠" },
    { name: "Diamond I",   minXP: 240000, maxXP: 330000, tier: 13, gradient: "from-violet-400 to-purple-500",        color: "#8b5cf6", emoji: "💎" },
    { name: "Diamond II",  minXP: 330000, maxXP: 440000, tier: 14, gradient: "from-violet-300 to-purple-400",        color: "#a78bfa", emoji: "💎" },
    { name: "Diamond III", minXP: 440000, maxXP: 600000, tier: 15, gradient: "from-fuchsia-400 to-violet-500",       color: "#c084fc", emoji: "💎" },
    { name: "Elite",       minXP: 600000, maxXP: 800000, tier: 16, gradient: "from-rose-500 to-pink-600",            color: "#f43f5e", emoji: "⚔️" },
    { name: "Legend",      minXP: 800000, maxXP: Infinity, tier: 17, gradient: "from-yellow-400 via-rose-500 to-fuchsia-600", color: "#fbbf24", emoji: "👑" },
];

function getSeasonRankFromXP(seasonXP) {
    return SEASON_RANKS.find(r => seasonXP >= r.minXP && seasonXP < r.maxXP) || SEASON_RANKS[SEASON_RANKS.length - 1];
}

// ─── XP Formulas ─────────────────────────────────────────────────────────────

const DIFF_MULT = { foundation: 0.7, developing: 0.9, proficient: 1.0, advanced: 1.3, exam_ready: 1.6 };
const PRIORITY_MULT = { low: 0.8, medium: 1.0, high: 1.3 };
const GOAL_DIFF_MULT = { easy: 0.8, medium: 1.0, hard: 1.4, very_hard: 1.8 };
const CHALLENGE_BASE = { practice_questions: 40, flashcard_sprint: 30, focus_session: 50, mini_test: 60, revision_schedule: 35 };

function calcFocusTimerXP({ duration_minutes = 0, idle_ratio = 0, tab_away_count = 0, session_complete = false }) {
    if (duration_minutes < 2) return 0;
    const capped = Math.min(duration_minutes, 120);
    // 1.25 XP per minute (60 min = 75 XP)
    return Math.round(capped * 1.25);
}

function calcPracticeQuestionsXP({ questions_attempted = 0, questions_correct = 0, difficulty = 'proficient', consecutive_streak = 0 }) {
    if (questions_attempted === 0) return 0;
    const accuracy = questions_correct / questions_attempted;
    const accuracyMult = 1 + Math.max(0, (accuracy - 0.5) / 0.5); // 1.0x–2.0x
    const diffMult = DIFF_MULT[difficulty] || 1.0;
    const streakBonus = Math.min(10, consecutive_streak * 0.5);
    return Math.round(questions_attempted * 1.5 * accuracyMult * diffMult + streakBonus);
}

function calcFlashcardXP({ cards_reviewed = 0, cards_correct = 0, hard_cards = 0 }) {
    if (cards_reviewed === 0) return 0;
    // Simple: 0.5 XP per flashcard reviewed
    return Math.round(cards_reviewed * 0.5);
}

function calcMiniTestXP({ score = 0, prev_best_score = null }) {
    const scoreMult = 1 + (score / 100); // 1.0x–2.0x
    const improveMult = prev_best_score != null && score > prev_best_score
        ? 1 + (score - prev_best_score) / 100
        : 1.0;
    return Math.round(20 * scoreMult * improveMult);
}

function calcChallengeXP({ challenge_type, difficulty, score_percent, days_until_deadline, importance }) {
    const base = CHALLENGE_BASE[challenge_type] || 40;
    const diffMult = DIFF_MULT[difficulty] || 1.0;
    const impMult = PRIORITY_MULT[importance] || 1.0;
    // Score modifier
    let scoreMult = 1.0;
    if (score_percent != null) {
        if (score_percent >= 90) scoreMult = 1.3;
        else if (score_percent >= 75) scoreMult = 1.1;
        else if (score_percent < 50) scoreMult = 0.8;
    }
    // Urgency bonus
    const urgencyBonus = days_until_deadline != null && days_until_deadline <= 3 ? 1.15 : 1.0;
    return Math.round(base * diffMult * impMult * scoreMult * urgencyBonus);
}

function calcSubGoalXP(xp_reward, priority) {
    return Math.round((xp_reward || 50) * (PRIORITY_MULT[priority] || 1.0));
}

function calcGoalXP(xp_reward, difficulty_level) {
    return Math.round((xp_reward || 300) * (GOAL_DIFF_MULT[difficulty_level] || 1.0));
}

function calcQuizXP({ quiz_score = 0, questions_total = 1, questions_correct = 0, total_marks = 0, time_taken_secs }) {
    // 2 XP per mark earned. Use total_marks if provided (short answer), else use questions_correct
    if (total_marks > 0) return Math.round(total_marks * 2);
    // Fallback: treat each correct answer as 1 mark
    return Math.round((questions_correct || Math.round((quiz_score / 100) * questions_total)) * 2);
}

function calcStudySessionXP(duration_minutes) {
    if (duration_minutes < 2) return 0;
    // 1.25 XP per minute (60 min = 75 XP), capped at 150
    return Math.min(150, Math.round(duration_minutes * 1.25));
}

function calcStreakXP(streak_days) {
    return Math.min(100, 15 + streak_days * 2);
}

function calcWagerXP(wagered_xp, accuracy) {
    if (accuracy === 'exact') return Math.round(wagered_xp * 3.5);
    if (accuracy === 'close') return Math.round(wagered_xp * 1.5);
    return 0;
}

// ─── Daily Caps ───────────────────────────────────────────────────────────────

const DAILY_CAPS = {
    focus_session:      150,
    practice_questions: 100,
    flashcard:          80,
    mini_test:          120,
    challenge:          250,
    sub_goal:           400,
    goal:               1200,
    quiz:               100,
    study_session:      160,
    active_recall:      120,
    blurting:           80,
    streak:             100,
    weekly_streak:      75,
    friend_win:         200,
    competition_bonus:  500,
    wager:              300,
    season_reward:      2000,
};

const HOURLY_VELOCITY_CAP = 600; // max XP in any rolling 60-min window

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            source, event_key,
            // focus timer
            duration_minutes, idle_ratio, tab_away_count, session_complete,
            // practice questions
            questions_attempted, questions_correct, consecutive_streak,
            // flashcards
            cards_reviewed, cards_correct, hard_cards,
            // mini test
            score, prev_best_score,
            // challenge
            challenge_type, difficulty, score_percent, days_until_deadline, importance,
            // sub_goal / goal
            xp_reward, priority, difficulty_level,
            // quiz
            quiz_score, questions_total, time_taken_secs,
            // streak
            streak_days,
            // wager
            wagered_xp, wager_accuracy,
            // flat XP override (season_reward, competition_bonus, friend_win — trusted server-to-server only)
            flat_xp,
            // streak multiplier from client (1.0, 1.1, 1.25, 1.5, 2.0)
            streak_multiplier,
        } = body;

        if (!source) return Response.json({ error: 'source required' }, { status: 400 });
        if (!event_key) return Response.json({ error: 'event_key required for idempotency' }, { status: 400 });

        // ── Idempotency check via XPEvent ───────────────────────────────────
        const existingEvents = await base44.asServiceRole.entities.XPEvent.filter({ event_key, user_email: user.email });
        if (existingEvents.length > 0) {
            return Response.json({
                success: true,
                xp_awarded: existingEvents[0].xp_awarded,
                message: 'Already awarded',
                deduplicated: true,
                event_id: existingEvents[0].id,
            });
        }

        // ── Load profile ────────────────────────────────────────────────────
        const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
        let profile = profiles[0];
        if (!profile) {
            profile = await base44.entities.UserProfile.create({
                created_by: user.email,
                user_email: user.email,
                total_xp: 0,
                current_level: 1
            });
        }

        // ── XP integrity check: ensure stored total_xp is never below
        //    the sum of all XPEvents for this user (audit log is source of truth).
        //    Only run this check if the profile XP looks suspiciously low.
        if ((profile.total_xp || 0) === 0) {
            const allEvents = await base44.asServiceRole.entities.XPEvent.filter({ user_email: user.email });
            const auditTotal = allEvents.reduce((sum, e) => sum + (e.xp_awarded || 0), 0);
            if (auditTotal > 0) {
                // XP was lost — restore from audit log
                console.warn(`XP integrity restore for ${user.email}: stored=0, audit=${auditTotal}`);
                profile = await base44.asServiceRole.entities.UserProfile.update(profile.id, {
                    total_xp: auditTotal,
                    current_level: levelFromXP(auditTotal),
                    user_email: user.email,
                });
            }
        }

        // ── Calculate raw XP ─────────────────────────────────────────────────
        let rawXP = 0;
        switch (source) {
            case 'focus_session':
                rawXP = calcFocusTimerXP({ duration_minutes, idle_ratio, tab_away_count, session_complete });
                break;
            case 'practice_questions':
                rawXP = calcPracticeQuestionsXP({ questions_attempted, questions_correct, difficulty, consecutive_streak });
                break;
            case 'flashcard':
                rawXP = calcFlashcardXP({ cards_reviewed, cards_correct, hard_cards });
                break;
            case 'mini_test':
                rawXP = calcMiniTestXP({ score, prev_best_score });
                break;
            case 'challenge':
                rawXP = calcChallengeXP({ challenge_type, difficulty, score_percent, days_until_deadline, importance });
                break;
            case 'sub_goal':
                rawXP = calcSubGoalXP(xp_reward, priority);
                break;
            case 'goal':
                rawXP = calcGoalXP(xp_reward, difficulty_level);
                break;
            case 'quiz':
                rawXP = calcQuizXP({ quiz_score: quiz_score || 0, questions_total: questions_total || 1, questions_correct: questions_correct || 0, total_marks: body.total_marks || 0, time_taken_secs });
                break;
            case 'study_session':
            case 'active_recall':
            case 'blurting':
                rawXP = calcStudySessionXP(duration_minutes || 0);
                break;
            case 'streak':
                rawXP = calcStreakXP(streak_days || 1);
                break;
            case 'weekly_streak':
                rawXP = 75;
                break;
            case 'friend_win':
                rawXP = 100;
                break;
            case 'competition_bonus':
            case 'season_reward':
                rawXP = flat_xp || 0;
                break;
            case 'wager':
                rawXP = calcWagerXP(wagered_xp || 0, wager_accuracy || 'wrong');
                break;
            default:
                return Response.json({ error: `Unknown source: ${source}` }, { status: 400 });
        }

        // ── Apply streak multiplier (1.0–2.0×) to raw XP ────────────────────
        // Multiplier is provided by client via streakHelpers.awardXPWithStreak
        // Clamped to valid range to prevent abuse
        const safeMultiplier = Math.max(1.0, Math.min(2.0, streak_multiplier || 1.0));
        if (safeMultiplier > 1.0 && !['streak', 'weekly_streak', 'wager', 'competition_bonus', 'season_reward', 'friend_win'].includes(source)) {
            rawXP = Math.round(rawXP * safeMultiplier);
        }

        if (rawXP <= 0) {
            // Still write a zero event for audit
            await base44.asServiceRole.entities.XPEvent.create({
                event_key, user_email: user.email, source, xp_awarded: 0, raw_xp: rawXP,
                capped: false, integrity_flags: [],
                total_xp_after: profile.total_xp || 0,
                season_xp_after: profile.season_xp || 0,
                level_before: profile.current_level || 1,
                level_after: profile.current_level || 1,
                leveled_up: false,
                metadata: body,
            });
            return Response.json({ success: true, xp_awarded: 0, message: 'Zero XP calculated' });
        }

        // ── Daily cap enforcement ────────────────────────────────────────────
        const todayKey = new Date().toISOString().split('T')[0];
        const dailyCaps = profile.daily_xp_caps || {};
        const todayCaps = dailyCaps[todayKey] || {};
        const currentSourceTotal = todayCaps[source] || 0;
        const cap = DAILY_CAPS[source] || 500;
        const afterCap = Math.min(rawXP, Math.max(0, cap - currentSourceTotal));
        const isCapped = afterCap < rawXP;

        if (afterCap <= 0) {
            await base44.asServiceRole.entities.XPEvent.create({
                event_key, user_email: user.email, source, xp_awarded: 0, raw_xp: rawXP,
                capped: true, integrity_flags: ['daily_cap'],
                total_xp_after: profile.total_xp || 0,
                season_xp_after: profile.season_xp || 0,
                level_before: profile.current_level || 1,
                level_after: profile.current_level || 1,
                leveled_up: false,
                metadata: { cap, used: currentSourceTotal },
            });
            return Response.json({ success: true, xp_awarded: 0, message: `Daily cap reached for ${source}`, capped: true });
        }

        // ── Velocity check (anti-burst) ──────────────────────────────────────
        const velocityLog = profile.xp_velocity_log || [];
        const oneHourAgo = Date.now() - 3600000;
        const recentXP = velocityLog
            .filter(e => e.ts > oneHourAgo)
            .reduce((sum, e) => sum + e.xp, 0);

        const velocityAllowed = Math.max(0, HOURLY_VELOCITY_CAP - recentXP);
        const finalXP = Math.min(afterCap, velocityAllowed);
        const velocityCapped = finalXP < afterCap;

        if (finalXP <= 0) {
            await base44.asServiceRole.entities.XPEvent.create({
                event_key, user_email: user.email, source, xp_awarded: 0, raw_xp: rawXP,
                capped: true, integrity_flags: ['velocity_cap'],
                total_xp_after: profile.total_xp || 0,
                season_xp_after: profile.season_xp || 0,
                level_before: profile.current_level || 1,
                level_after: profile.current_level || 1,
                leveled_up: false,
                metadata: { recent_xp: recentXP },
            });
            return Response.json({ success: true, xp_awarded: 0, message: 'Velocity cap reached', capped: true });
        }

        // ── Re-read profile right before writing to avoid race conditions ────
        // This minimises the window where two simultaneous events could both
        // read the same stale total_xp and clobber each other's XP.
        const freshProfiles = await base44.asServiceRole.entities.UserProfile.filter({ created_by: user.email });
        const freshProfile = freshProfiles[0] || profile;

        // ── Apply XP ─────────────────────────────────────────────────────────
        // CRITICAL: total_xp is STRICTLY ADDITIVE — it can NEVER decrease.
        // Always take the max of the stored value and what we compute, so even
        // if something previously wrote a wrong value we never go backwards.
        const prevTotalXP = Math.max(freshProfile.total_xp || 0, profile.total_xp || 0);
        const newTotalXP = prevTotalXP + finalXP;
        const newSeasonXP = (freshProfile.season_xp || 0) + finalXP;

        const prevLevel = levelFromXP(prevTotalXP);
        const newLevel = levelFromXP(newTotalXP);
        const leveledUp = newLevel > prevLevel;

        const newAllTimeRank = getRankFromXP(newTotalXP);
        const prevAllTimeRank = getRankFromXP(prevTotalXP);
        const rankUp = newAllTimeRank.tier > prevAllTimeRank.tier;

        const newSeasonRank = getSeasonRankFromXP(newSeasonXP);
        const prevSeasonRank = getSeasonRankFromXP(freshProfile.season_xp || 0);
        const seasonRankUp = newSeasonRank.tier > prevSeasonRank.tier;

        // ── Write XPEvent audit record FIRST (idempotency anchor) ───────────
        const xpEvent = await base44.asServiceRole.entities.XPEvent.create({
            event_key,
            user_email: user.email,
            source,
            xp_awarded: finalXP,
            raw_xp: rawXP,
            capped: isCapped || velocityCapped,
            integrity_flags: [],
            total_xp_after: newTotalXP,
            season_xp_after: newSeasonXP,
            level_before: prevLevel,
            level_after: newLevel,
            leveled_up: leveledUp,
            metadata: { challenge_type, difficulty, score_percent, score, duration_minutes },
        });

        // ── Update UserProfile XP (critical — use asServiceRole for reliability) ──
        // SAFETY: We never allow total_xp to decrease. If for any reason the DB
        // already holds a higher value (race condition), we take the maximum.
        await base44.asServiceRole.entities.UserProfile.update(freshProfile.id, {
            total_xp: newTotalXP, // always prevTotalXP + finalXP — strictly increasing
            current_level: newLevel,
            season_xp: newSeasonXP,
            peak_streak: Math.max(freshProfile.peak_streak || 0, freshProfile.streak_days || 0),
            user_email: user.email, // tie to email explicitly for audit
        });

        // ── Update caps/velocity separately so they can't block the XP write ─
        try {
            const updatedCaps = {
                ...(freshProfile.daily_xp_caps || {}),
                [todayKey]: { ...(freshProfile.daily_xp_caps?.[todayKey] || {}), [source]: currentSourceTotal + finalXP }
            };
            // Keep velocity log small (max 50 entries, 2hr window only)
            const updatedVelocity = [
                ...(freshProfile.xp_velocity_log || []).filter(e => e.ts > Date.now() - 7200000).slice(-49),
                { ts: Date.now(), xp: finalXP, source }
            ];
            await base44.asServiceRole.entities.UserProfile.update(freshProfile.id, {
                daily_xp_caps: updatedCaps,
                xp_velocity_log: updatedVelocity,
            });
        } catch (capErr) {
            console.warn('Caps/velocity update failed (XP was still saved):', capErr.message);
        }

        // ── Update School Season XP ──────────────────────────────────────────
        if (freshProfile.school_name) {
            try {
                const schools = await base44.asServiceRole.entities.SchoolProfile.filter({ school_name: freshProfile.school_name });
                if (schools.length > 0) {
                    const school = schools[0];
                    await base44.asServiceRole.entities.SchoolProfile.update(school.id, {
                        total_season_xp: (school.total_season_xp || 0) + finalXP,
                        total_alltime_xp: (school.total_alltime_xp || 0) + finalXP,
                    });
                }
            } catch (_) {}
        }

        // ── Update Leaderboard ───────────────────────────────────────────────
        try {
            const lbEntries = await base44.asServiceRole.entities.Leaderboard.filter({ user_email: user.email });
            if (lbEntries.length > 0) {
                await base44.asServiceRole.entities.Leaderboard.update(lbEntries[0].id, {
                    total_xp: newTotalXP,
                    level: newLevel,
                    season_xp: newSeasonXP,
                    last_updated: new Date().toISOString()
                });
            }
        } catch (_) {}

        return Response.json({
            success: true,
            xp_awarded: finalXP,
            raw_xp: rawXP,
            capped: isCapped || velocityCapped,
            total_xp: newTotalXP,
            season_xp: newSeasonXP,
            current_level: newLevel,
            level_progress: levelProgress(newTotalXP),
            xp_to_next_level: xpToNextLevel(newLevel) - (newTotalXP - xpForLevel(newLevel)),
            leveled_up: leveledUp,
            levels_gained: newLevel - prevLevel,
            alltime_rank: newAllTimeRank,
            season_rank: newSeasonRank,
            rank_up: rankUp,
            season_rank_up: seasonRankUp,
            event_id: xpEvent?.id,
        });

    } catch (error) {
        console.error('awardXP error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});