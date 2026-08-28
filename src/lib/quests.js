/**
 * quests — what a student can back themselves to actually do.
 *
 * Back Yourself asked for a metric and a number: "300 XP in 72 hours". That is
 * a bet on a counter, and a counter is the thing students already game — it
 * rewards grinding whatever is cheapest, which is exactly the behaviour the
 * rest of the app is trying to move away from.
 *
 * A quest names a specific act instead. "Try a technique you've never used."
 * "Plan your weekend before Friday night." "Sit one timed paper." Each is a
 * decision rather than a total, and each is the kind of thing students know
 * they should do and don't.
 *
 * The hard rule: **every quest must be verifiable from data the app already
 * records.** A wager settled on the honour system isn't a wager. If a quest
 * can't be checked, it doesn't belong here — that constraint is why this list
 * is shorter than the brainstorm that produced it.
 *
 * Shared by the client (which renders these) and server.mjs (which verifies
 * them), so the promise on the card and the check behind it can't drift.
 */

/**
 * `check` is a spec the server interprets — see verifyQuest in server.mjs.
 *   { kind: "metric",       metric, target }        counter over the window
 *   { kind: "new_technique" }                       one never used in 30 days
 *   { kind: "planned_days", days, min }             sessions planned on given weekdays
 *   { kind: "deep_work",    minutes }               one unbroken session that long
 *   { kind: "subjects",     count }                 distinct subjects touched
 *   { kind: "timed_paper",  count }                 Revision Mode / mock runs
 *   { kind: "beat_average", ratio }                 vs the trailing 14-day rate
 *   { kind: "plan_clear" }                          every planned session done
 *   { kind: "every_day" }                           no zero days in the window
 *   { kind: "weak_spots",   count }                 weak cards actually revisited
 */
export const QUEST_CATEGORIES = {
    habit:    { label: "Build the habit", accent: "primary" },
    stretch:  { label: "Push yourself",   accent: "streak" },
    craft:    { label: "Study better",    accent: "chart-3" },
    admin:    { label: "Get organised",   accent: "chart-4" },
};

export const QUESTS = [
    // ── Study better ────────────────────────────────────────────────────────
    {
        id: "new_technique",
        title: "Try something you've never tried",
        blurb: "Use a study technique you haven't touched in a month. Blurting, active recall, a timed paper — anything new to you.",
        why: "The technique you default to is the one you're most comfortable with, which is rarely the one that works hardest.",
        icon: "FlaskConical", category: "craft", difficulty: 2,
        windows: [72, 168], defaultWindow: 72,
        check: { kind: "new_technique" },
    },
    {
        id: "timed_paper",
        title: "Sit one paper under real conditions",
        blurb: "One full Revision Mode run — timed, closed book, no pausing to look things up.",
        why: "Practice that matches the assessment transfers; practice that doesn't, doesn't.",
        icon: "Timer", category: "craft", difficulty: 3,
        windows: [72, 168], defaultWindow: 168,
        check: { kind: "timed_paper", count: 1 },
    },
    {
        id: "weak_spots",
        title: "Go back for the ones you keep missing",
        blurb: "Review five cards currently flagged as weak spots — the ones you've rated 'again' more than once.",
        why: "Re-reading what you already know feels productive and moves nothing.",
        icon: "Target", category: "craft", difficulty: 2,
        windows: [48, 72, 168], defaultWindow: 72,
        check: { kind: "weak_spots", count: 5 },
    },
    {
        id: "interleave",
        title: "Mix three subjects in one stretch",
        blurb: "Study three different subjects inside the window instead of blocking one.",
        why: "Mixing feels harder while you do it and holds up far better a week later.",
        icon: "Shuffle", category: "craft", difficulty: 2,
        windows: [48, 72], defaultWindow: 72,
        check: { kind: "subjects", count: 3 },
    },

    // ── Get organised ───────────────────────────────────────────────────────
    {
        id: "plan_weekend",
        title: "Plan your weekend before it starts",
        blurb: "Get at least three sessions on the board for Saturday and Sunday.",
        why: "The weekend is where the most time is and the least of it gets used.",
        icon: "CalendarCheck", category: "admin", difficulty: 1,
        windows: [24, 48], defaultWindow: 48,
        check: { kind: "planned_days", days: [6, 0], min: 3 },
    },
    {
        id: "plan_clear",
        title: "Finish everything you planned",
        blurb: "Every session on your planner inside this window gets ticked off. No leftovers.",
        why: "A plan you routinely don't finish teaches you to ignore your own planner.",
        icon: "CheckCircle2", category: "admin", difficulty: 3,
        windows: [48, 72, 168], defaultWindow: 72,
        check: { kind: "plan_clear" },
    },

    // ── Build the habit ─────────────────────────────────────────────────────
    {
        id: "every_day",
        title: "Don't miss a day",
        blurb: "Something on every single day of the window. Twenty minutes counts.",
        why: "Spacing beats cramming, and the gap you skip is the one that costs you.",
        icon: "Flame", category: "habit", difficulty: 2,
        windows: [72, 168], defaultWindow: 72,
        check: { kind: "every_day" },
    },
    {
        id: "deep_work",
        title: "One proper block, no phone",
        blurb: "A single unbroken session of 45 minutes or more.",
        why: "Six fragmented ten-minute stints are not an hour of study.",
        icon: "Wind", category: "habit", difficulty: 2,
        windows: [24, 48, 72], defaultWindow: 48,
        check: { kind: "deep_work", minutes: 45 },
    },

    // ── Push yourself ───────────────────────────────────────────────────────
    {
        id: "beat_average",
        title: "Beat your own average",
        blurb: "Study more than your usual daily rate over the whole window.",
        why: "Measured against you a fortnight ago, not against anybody else.",
        icon: "TrendingUp", category: "stretch", difficulty: 3,
        windows: [72, 168], defaultWindow: 72,
        check: { kind: "beat_average", ratio: 1.2 },
    },
    {
        id: "cards_target",
        title: "Clear a hundred cards",
        blurb: "A hundred flashcard reviews inside the window.",
        why: "The blunt one. Sometimes volume is exactly what's missing.",
        icon: "Layers", category: "stretch", difficulty: 2,
        windows: [24, 48, 72], defaultWindow: 48,
        check: { kind: "metric", metric: "flashcards", target: 100 },
    },
    {
        id: "minutes_target",
        title: "Put five hours in",
        blurb: "Three hundred minutes of recorded study inside the window.",
        why: "Straight time on the tools, when that's the honest gap.",
        icon: "Hourglass", category: "stretch", difficulty: 3,
        windows: [72, 168], defaultWindow: 168,
        check: { kind: "metric", metric: "study_minutes", target: 300 },
    },
];

export const QUEST_BY_ID = Object.fromEntries(QUESTS.map(q => [q.id, q]));

/**
 * The payout multiplier. Harder quests and tighter windows pay more, because
 * a wager that pays the same for "plan your weekend" and "don't miss a day for
 * a week" tells the student the app can't tell the difference.
 */
export function questMultiplier(quest, windowHours) {
    if (!quest) return 1.5;
    const byDifficulty = { 1: 1.3, 2: 1.6, 3: 2.0 }[quest.difficulty] || 1.5;
    // A shorter deadline on the same quest is a harder promise to keep.
    const widest = Math.max(...quest.windows);
    const tightness = windowHours >= widest ? 0 : 0.2;
    return Math.round((byDifficulty + tightness) * 10) / 10;
}

export const WINDOW_LABEL = { 24: "1 day", 48: "2 days", 72: "3 days", 168: "1 week" };
