/**
 * achievements — what the app is willing to say a student has done.
 *
 * ─── Why this moved out of server.mjs ───────────────────────────────────────
 * The catalogue was an inline array of 24 objects whose `check` functions were
 * booleans, and FIVE of them measured something the app does not do:
 *
 *   FRIEND_MAGNET   queried `friendships.friend_email` — a column that has
 *                   never existed (the table has requester_email /
 *                   recipient_email). PostgREST rejected it, the count came
 *                   back null, and 150 XP was unreachable by construction.
 *   ROADMAP_DONE    counted `study_roadmaps`, and `StudyRoadmap.create` has
 *                   ZERO call sites — the Study Roadmap page redirects. 600 XP
 *                   for a feature that was retired.
 *   COMPETE_FIRST   said "Join your first competition" and counted
 *                   `creator_email = you`, so joining somebody else's battle
 *                   by code earned nothing.
 *   FIRST_SESSION   said "Complete your first study session" and counted
 *                   `study_sessions` alone — which takes quizzes and the
 *                   activity tracker. Pomodoro, blurting, active recall and
 *                   spaced repetition all write to `study_techniques`, so a
 *                   student who only used the Study page never unlocked it.
 *                   That is the read-every-table trap CLAUDE.md already
 *                   records twice, for the third time.
 *
 * An achievement nobody can reach is worse than no achievement: it teaches a
 * student that the grid is decoration, after which the reachable ones stop
 * pulling too.
 *
 * ─── PROGRESS, NOT A BOOLEAN ────────────────────────────────────────────────
 * Every entry reports `{ value, target }` rather than true/false. That is what
 * lets a locked tile say "18 of 25 quizzes" instead of showing a padlock —
 * fourteen of twenty-four tiles were identical grey boxes telling a student
 * nothing about what to chase. `unlocked` is derived from the same numbers, so
 * a tile's progress bar and its locked state cannot disagree.
 *
 * ─── One catalogue, both sides ──────────────────────────────────────────────
 * The server evaluates it to grant XP; the client reads it to draw the grid
 * and the near-miss. It is pure data plus one pure function per entry, so both
 * can hold it and neither can drift. The STATS come from the server only —
 * `buildAchievementStats` in server.mjs is the single reader of the database,
 * because a client that could name its own counts could name its own unlocks.
 */

/** Loudness of the unlock, and the colour of the crest. */
export const RARITIES = ["common", "rare", "epic", "legendary"];

/** How much ceremony an unlock earns. Read by AchievementUnlock. */
export const CEREMONY = {
    common:    { hold: 2600, confetti: 0,  takesScreen: false },
    rare:      { hold: 3200, confetti: 40, takesScreen: false },
    epic:      { hold: 4200, confetti: 90, takesScreen: true },
    legendary: { hold: 5200, confetti: 160, takesScreen: true },
};

const at = (value, target) => ({ value: Math.max(0, Number(value) || 0), target });

/**
 * The catalogue.
 *
 * `progress(stats)` is pure and returns `{ value, target }`. Adding an entry
 * means adding its stat to `buildAchievementStats` too — a progress function
 * reading a stat nobody computes reports 0 forever, which is exactly the
 * failure this file exists to stop repeating.
 */
export const ACHIEVEMENTS = [
    // ─── Common — the first week ────────────────────────────────────────────
    { code: "FIRST_SPARK", name: "First Spark", desc: "Earn your first 100 XP",
      icon: "Sparkles", rarity: "common", reward_xp: 50, sort: 1,
      progress: (s) => at(s.total_xp, 100) },

    // Reads BOTH study tables. See the header: this counted `study_sessions`
    // alone, so the entire Study page — pomodoro, blurting, recall, spaced
    // repetition — did not count as "a study session".
    { code: "FIRST_SESSION", name: "Day One", desc: "Finish your first study session",
      icon: "Play", rarity: "common", reward_xp: 50, sort: 2,
      progress: (s) => at(s.study_count, 1) },

    { code: "FIRST_QUIZ", name: "First Paper", desc: "Sit your first quiz",
      icon: "FileText", rarity: "common", reward_xp: 50, sort: 3,
      progress: (s) => at(s.quiz_count, 1) },

    { code: "SUBJECT_PICKED", name: "Enrolled", desc: "Add your first VCE subject",
      icon: "BookOpen", rarity: "common", reward_xp: 50, sort: 4,
      progress: (s) => at(s.subject_count, 1) },

    { code: "STREAK_3", name: "Three In A Row", desc: "Study three days running",
      icon: "Flame", rarity: "common", reward_xp: 100, sort: 5,
      progress: (s) => at(s.peak_streak, 3) },

    // The mistake bank exists to be emptied, and nothing rewarded emptying it.
    { code: "FIRST_FIX", name: "Owned It", desc: "Fix your first banked mistake",
      icon: "Wrench", rarity: "common", reward_xp: 100, sort: 6,
      progress: (s) => at(s.mistakes_fixed, 1) },

    // ─── Rare — the habit ───────────────────────────────────────────────────
    { code: "STREAK_7", name: "Week One", desc: "Study seven days running",
      icon: "Flame", rarity: "rare", reward_xp: 200, sort: 10,
      progress: (s) => at(s.peak_streak, 7) },

    { code: "QUIZ_25", name: "Twenty-Five Papers", desc: "Sit 25 quizzes",
      icon: "FileText", rarity: "rare", reward_xp: 250, sort: 11,
      progress: (s) => at(s.quiz_count, 25) },

    // `requester_email` / `recipient_email` — `friend_email` never existed.
    { code: "FRIEND_MAGNET", name: "Squad", desc: "Study alongside 3 friends",
      icon: "Users", rarity: "rare", reward_xp: 150, sort: 12,
      progress: (s) => at(s.friend_count, 3) },

    // Counts every battle you are IN, not only the ones you started.
    { code: "COMPETE_FIRST", name: "In The Ring", desc: "Join a battle or a duel",
      icon: "Swords", rarity: "rare", reward_xp: 150, sort: 13,
      progress: (s) => at(s.competition_count, 1) },

    { code: "GOAL_FIRST", name: "On The Record", desc: "Set your first study goal",
      icon: "Target", rarity: "rare", reward_xp: 150, sort: 14,
      progress: (s) => at(s.goal_count, 1) },

    { code: "BLURTING_5", name: "Blurter", desc: "Finish 5 blurting sessions",
      icon: "PencilLine", rarity: "rare", reward_xp: 200, sort: 15,
      progress: (s) => at(s.blurting_count, 5) },

    { code: "ACTIVE_RECALL_5", name: "Recall Adept", desc: "Finish 5 active recall sessions",
      icon: "Lightbulb", rarity: "rare", reward_xp: 200, sort: 16,
      progress: (s) => at(s.active_recall_count, 5) },

    // ─── Rare — what the app can PROVE ──────────────────────────────────────
    // Replaces ROADMAP_DONE, which pointed at a retired page. Verified hours
    // are hours somebody was called out on and answered for, which is the one
    // measure of study the app can genuinely stand behind.
    { code: "VERIFIED_5H", name: "Receipts", desc: "Get 5 hours of study verified",
      icon: "ShieldCheck", rarity: "rare", reward_xp: 250, sort: 17,
      progress: (s) => at(s.verified_minutes, 300) },

    // Breadth, and it reads the same coverage the subject hub draws.
    // ─── The weekly league ──────────────────────────────────────────────────
    // These three read COUNTS THAT GO UP, never `best_weekly_rank`. A rank is
    // backwards — 1 beats 4 — so an achievement keyed on it cannot draw a
    // progress bar and would come back "unreachable" from the maxed-stats
    // guard, which probes every stat at 1e9. "2 of 3 podiums" is a bar; "best
    // finish 4th" is a fact with nothing to chase in it.
    //
    // A week only counts if there was somebody to beat — see the group-size
    // floors in buildAchievementStats. Winning a league of one is the "1st of
    // 1" the league page already refuses to print.
    { code: "LEAGUE_WEEK", name: "Weigh In", desc: "Finish your first league week",
      icon: "CalendarCheck", rarity: "rare", reward_xp: 250, sort: 19,
      progress: (s) => at(s.league_weeks, 1) },

    { code: "BREADTH_4", name: "All Fronts", desc: "Study 4 different subjects in a week",
      icon: "Layers", rarity: "rare", reward_xp: 200, sort: 18,
      progress: (s) => at(s.best_week_subjects, 4) },

    // ─── Epic — the things that are actually hard ───────────────────────────
    { code: "STREAK_14", name: "Two-Week Wonder", desc: "Study fourteen days running",
      icon: "Flame", rarity: "epic", reward_xp: 500, sort: 20,
      progress: (s) => at(s.peak_streak, 14) },

    { code: "QUIZ_100", name: "Hundred Papers", desc: "Sit 100 quizzes",
      icon: "FileText", rarity: "epic", reward_xp: 700, sort: 21,
      progress: (s) => at(s.quiz_count, 100) },

    { code: "COMPETE_WIN", name: "First Blood", desc: "Win a battle",
      icon: "Trophy", rarity: "epic", reward_xp: 500, sort: 22,
      progress: (s) => at(s.competition_wins, 1) },

    { code: "XP_5K", name: "Five Grand", desc: "Earn 5,000 lifetime XP",
      icon: "Zap", rarity: "epic", reward_xp: 500, sort: 23,
      progress: (s) => at(s.total_xp, 5000) },

    // ─── Epic — compete, which had three and two of them broken ─────────────
    { code: "CALLOUT_SURVIVED", name: "Prove It", desc: "Pass a call-out somebody put on you",
      icon: "ShieldCheck", rarity: "epic", reward_xp: 600, sort: 24,
      progress: (s) => at(s.callouts_passed, 1) },

    { code: "MISTAKES_10", name: "Ten Down", desc: "Fix 10 banked mistakes",
      icon: "Wrench", rarity: "epic", reward_xp: 600, sort: 25,
      progress: (s) => at(s.mistakes_fixed, 10) },

    { code: "LEAGUE_PODIUM", name: "Podium", desc: "Finish a league week in the top 3",
      icon: "Medal", rarity: "epic", reward_xp: 750, sort: 27,
      progress: (s) => at(s.league_podiums, 1) },

    // The moment most students quit is the day after they break a streak.
    { code: "COMEBACK", name: "Back From The Dead", desc: "Rebuild a 7-day streak after losing one",
      icon: "RotateCcw", rarity: "epic", reward_xp: 500, sort: 26,
      progress: (s) => at(s.comeback_streaks, 1) },

    // ─── Legendary ──────────────────────────────────────────────────────────
    { code: "STREAK_30", name: "Monthly Master", desc: "Study thirty days running",
      icon: "Flame", rarity: "legendary", reward_xp: 1500, sort: 30,
      progress: (s) => at(s.peak_streak, 30) },

    { code: "STREAK_60", name: "Marathon", desc: "Study sixty days running",
      icon: "Flame", rarity: "legendary", reward_xp: 3000, sort: 31,
      progress: (s) => at(s.peak_streak, 60) },

    // Gem rather than Crown: Top Dog took the crown, which fits winning a week
    // far better than it fits a lifetime XP total, and two unrelated
    // legendaries under one glyph is not the differentiating-a-set case the
    // icon rule allows — it is the same picture meaning two things.
    { code: "XP_25K", name: "XP Tycoon", desc: "Earn 25,000 lifetime XP",
      icon: "Gem", rarity: "legendary", reward_xp: 2000, sort: 32,
      progress: (s) => at(s.total_xp, 25000) },

    { code: "QUIZ_250", name: "Two Fifty", desc: "Sit 250 quizzes",
      icon: "FileText", rarity: "legendary", reward_xp: 2000, sort: 33,
      progress: (s) => at(s.quiz_count, 250) },

    { code: "COMPETE_5", name: "Conqueror", desc: "Win 5 battles",
      icon: "Swords", rarity: "legendary", reward_xp: 2000, sort: 34,
      progress: (s) => at(s.competition_wins, 5) },

    // Off the forecasting engine, and unfakeable by construction: the scoring
    // rule pays zero for restating the app's own base rate, so a positive
    // score over ten calls means the student knew something it did not.
    { code: "CALIBRATED", name: "Reads The Room", desc: "Beat the base rate across 10 settled calls",
      icon: "LineChart", rarity: "legendary", reward_xp: 2500, sort: 35,
      progress: (s) => at(s.calibrated_calls, 10) },

    // Top of a whole week's board. The only achievement here that somebody
    // else can take from you by working harder, which is the entire point of
    // it being the loudest one on the compete side.
    { code: "LEAGUE_WIN", name: "Top Dog", desc: "Win a league week outright",
      icon: "Crown", rarity: "legendary", reward_xp: 2500, sort: 36,
      progress: (s) => at(s.league_wins, 1) },
];

export const ACHIEVEMENT_BY_CODE = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.code, a]));

/**
 * One achievement against a student's stats.
 *
 * `unlocked` is DERIVED from value/target rather than stored beside it, so a
 * tile's bar and its padlock cannot tell different stories.
 */
export function evaluate(achievement, stats = {}) {
    const { value, target } = achievement.progress(stats || {});
    const t = target > 0 ? target : 1;
    return {
        value,
        target: t,
        unlocked: value >= t,
        // Clamped: a student on 40,000 XP is at 100% of the 25k badge, not
        // 160%, and a bar past its own track renders outside the tile.
        ratio: Math.max(0, Math.min(1, value / t)),
    };
}

/**
 * The whole catalogue, evaluated, with the ones already granted marked.
 *
 * `held` is what the database says has been unlocked. It WINS over the
 * computed value: a student who earned "25 quizzes" and later had attempts
 * deleted keeps the badge. An achievement is a record of something that
 * happened, not a live readout — taking one back is the one thing this must
 * never do.
 */
export function board(stats = {}, held = []) {
    const heldSet = new Set(held.map((h) => (typeof h === "string" ? h : h?.code)).filter(Boolean));
    return ACHIEVEMENTS.map((a) => {
        const ev = evaluate(a, stats);
        return {
            ...a,
            ...ev,
            unlocked: ev.unlocked || heldSet.has(a.code),
            // So a surface can tell "granted" from "qualifies but the grant
            // has not run yet" — the self-heal on Ranked closes that gap.
            granted: heldSet.has(a.code),
        };
    });
}

/**
 * What to chase next: the closest ones not yet unlocked.
 *
 * Sorted by how near they are rather than by rarity — the point is a target a
 * student can actually reach this week, and a legendary at 2% is not one.
 * Anything at zero progress is excluded: "0 of 250 quizzes" is not a near
 * miss, it is the whole achievement, and it belongs in the grid rather than in
 * a list headed "almost there".
 */
export function nearest(stats = {}, held = [], limit = 3) {
    return board(stats, held)
        .filter((a) => !a.unlocked && a.ratio > 0)
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, limit);
}

/** Totals for the header. */
export function summary(stats = {}, held = []) {
    const rows = board(stats, held);
    const unlocked = rows.filter((r) => r.unlocked);
    return {
        unlocked: unlocked.length,
        total: rows.length,
        pct: rows.length ? Math.round((unlocked.length / rows.length) * 100) : 0,
        // Lifetime reward XP banked, which is a bigger number than students
        // expect and worth printing.
        xpEarned: unlocked.reduce((sum, r) => sum + (r.reward_xp || 0), 0),
        xpAvailable: rows.reduce((sum, r) => sum + (r.reward_xp || 0), 0),
    };
}

/**
 * The rarest few a student holds — what goes beside their name.
 *
 * An achievement nobody else can see is a private checklist rather than
 * something competitive, so the leaderboard row and a battle row carry the
 * top of this list.
 */
export function showcase(stats = {}, held = [], limit = 3) {
    const rank = Object.fromEntries(RARITIES.map((r, i) => [r, i]));
    return board(stats, held)
        .filter((a) => a.unlocked)
        .sort((a, b) => (rank[b.rarity] ?? 0) - (rank[a.rarity] ?? 0) || b.reward_xp - a.reward_xp)
        .slice(0, limit);
}
