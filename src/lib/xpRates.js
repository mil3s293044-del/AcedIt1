/**
 * xpRates — what the app ACTUALLY pays, published.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 * "Where XP comes from" was a hand-typed table on the Ranked profile, and it
 * was wrong in four places and advertised two features a student can no longer
 * reach. That is the EXACT failure its own comment claims to have fixed: it
 * says, in the file, that it dropped an "AI Challenges" row because the
 * feature was never wired up and "retire something, grep the copy" — and then
 * kept a Score wagers row and a Competitions row through the Compete rebuild,
 * which replaced both with markets that pay CREDITS and no XP at all.
 *
 * What was wrong:
 *
 *   Flashcards   printed "0.6–1.5 XP/card". The live path is
 *                `awardXPIncremental` type `flashcard_card`, which pays 2 for
 *                a card you got right and 1 for one you did not. Wrong at both
 *                ends, and in the direction that undersells the app.
 *   Focus        printed "1.6–96 XP/hr". A study session, active recall and
 *                blurting all go to `calcStudySessionXP` at 4 XP a minute —
 *                240 an hour. The 1.6 is the per-minute drip constant and the
 *                96 is nothing in the server at all.
 *   Quizzes      printed "8–50 XP". The rule is 2 XP a mark, which is a rule a
 *                student can check against a paper in front of them; a range
 *                is a number they can only take on trust.
 *   Wagers       printed "up to 3.5× bet". `calcWagerXP` is ×3 exact, ×1.5
 *                close — and nothing in the UI can place one any more.
 *
 * ─── A RULE, NOT A RANGE ────────────────────────────────────────────────────
 * Every row states the arithmetic where there is any: "4 XP a minute", "2 XP a
 * mark", "2 XP a card". A student can multiply that by what they just did and
 * check the number that landed, which is the whole point of publishing it. A
 * range is unfalsifiable, and an unfalsifiable number on a page about your own
 * progress is decoration.
 *
 * ─── AND IT IS PINNED TO THE SERVER ─────────────────────────────────────────
 * `server.mjs` owns the calculators and cannot be imported (it boots Express
 * on load), so `xpRates.test.mjs` PARSES them out and RUNS them against every
 * figure below — the `mirrors.test.mjs` idiom, which compares behaviour rather
 * than source so a reformat passes and a changed rate fails. That is what
 * stops this drifting back into being wrong, which it did silently for months
 * because nothing anywhere connected the two.
 */

/** The streak multiplier's range, from `awardXP`'s own clamp. */
export const STREAK_MULT_MAX = 2.0;

/**
 * Everything a student can currently earn XP from, in the order they will meet
 * it. `check` is what the test runs against the server; a row with no `check`
 * is one whose figure is a policy constant rather than a calculator output,
 * and the test asserts that constant instead.
 */
export const XP_RATES = [
    {
        id: "study",
        label: "Study sessions",
        rate: "4 XP a minute",
        note: "Pomodoro, active recall, blurting, mind maps and Feynman, by the minute actually studied",
        // calcStudySessionXP(60)
        check: { fn: "calcStudySessionXP", args: [60], expect: 240 },
    },
    {
        id: "flashcard",
        label: "Flashcards",
        rate: "2 XP a card",
        note: "1 if you miss it — reviewing a card you got wrong still counts",
        // The incremental drip, which is what SpacedRepetition actually calls.
        check: { incremental: "flashcard_card", correct: 2, wrong: 1 },
    },
    {
        id: "quiz",
        label: "Quizzes",
        rate: "2 XP a mark",
        note: "the marks you earned, not the questions you answered",
        check: { fn: "calcQuizXP", args: [{ total_marks: 17 }], expect: 34 },
    },
    {
        id: "exam",
        label: "Exam mode",
        rate: "20–40 XP",
        note: "more when you beat your own best on that paper",
        check: { fn: "calcMiniTestXP", args: [{ score: 0 }], expect: 20 },
    },
    {
        id: "subgoal",
        label: "Sub-goals",
        rate: "40–65 XP",
        note: "the goal's own reward, weighted by how you set its priority",
        // calcSubGoalXP(undefined, "low") → 50 × 0.8, and "high" → 50 × 1.3.
        check: { fn: "calcSubGoalXP", args: [null, "low"], expect: 40 },
        also: { fn: "calcSubGoalXP", args: [null, "high"], expect: 65 },
    },
    {
        id: "goal",
        label: "Full goals",
        rate: "240–540 XP",
        note: "by the difficulty you set when you made it",
        check: { fn: "calcGoalXP", args: [null, "easy"], expect: 240 },
        also: { fn: "calcGoalXP", args: [null, "very_hard"], expect: 540 },
    },
    {
        id: "streak",
        label: "Daily streak",
        rate: "15–100 XP",
        note: "15 to start, 2 more a day, capped at 100",
        check: { fn: "calcStreakXP", args: [1], expect: 17 },
        also: { fn: "calcStreakXP", args: [500], expect: 100 },
    },
    {
        id: "league",
        label: "League podium",
        rate: "a small bonus",
        // Deliberately not a figure. The league's XP is kept small ON PURPOSE
        // — it feeds level, rank AND the ATAR, so a payout big enough to move
        // somebody's study score would make that score partly a measure of how
        // competitive they are. Printing it invites exactly the grinding it is
        // sized to avoid; the credits are the real prize and the Podium prints
        // those.
        note: "finishing top three — the credits are the real prize",
    },
];

/**
 * What this table may NOT say, and why it is written down rather than simply
 * absent.
 *
 * Both of these paid XP once, both are still live in `server.mjs` so anything
 * mid-flight can still settle, and NEITHER can be reached from the UI since
 * Compete became a market board. Advertising a way to earn XP that no button
 * leads to is the thing this file exists to stop, so the test asserts their
 * absence by id — otherwise the obvious "restore the old table" fixes nothing
 * and nobody notices.
 */
export const RETIRED_SOURCES = ["wager", "competition"];

/** The one sentence under the table. Says what applies to all of it. */
export const XP_FOOTNOTE =
    `Your streak multiplier applies to all of it, up to ${STREAK_MULT_MAX}×. ` +
    "Daily caps stop grinding — difficulty and accuracy are what move the number.";
