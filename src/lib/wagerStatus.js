/**
 * wagerStatus — the one vocabulary `score_wagers.status` is allowed to speak.
 *
 * ─── What went wrong ────────────────────────────────────────────────────────
 * `score_wagers` carries a CHECK constraint, written in migration 0008:
 *
 *     check (status in ('active','resolved','cancelled'))
 *
 * The forecast layer was written months later against a different vocabulary —
 * `pending` while open, `won`/`lost` once settled — and nothing in lint, the
 * build, the test suite or the page-mount sweep compares a string literal in
 * JavaScript against a constraint in SQL. So `placeForecast` inserted
 * `status: "pending"`, Postgres rejected the row, and the feature returned a
 * 500 on EVERY call ever made. Not a regression: it had never once worked.
 *
 * ─── STATUS IS THE LIFECYCLE. THE OUTCOME IS A SEPARATE FACT. ───────────────
 * That is the actual lesson, and it is why this resolves toward the
 * constraint's vocabulary rather than widening it. `won`/`lost` crams two
 * orthogonal axes into one column — did this settle, and did you win — so two
 * halves of the codebase reasonably picked different axes and the column could
 * not satisfy both. Lifecycle lives here; the verdict lives in
 * `extra.forecast.outcome` alongside the rest of the forecast payload, and the
 * payout in `xp_outcome`.
 *
 * `resolveScoreWager` and the Arena already spoke this vocabulary, so this is
 * the forecast layer rejoining the codebase rather than a new convention.
 *
 * Import it on BOTH sides. The drift is the bug; a shared module is the fix.
 */

/** The only three values the column accepts. */
export const WAGER = {
    /** Placed, stake escrowed, not yet decided. */
    OPEN: "active",
    /** Decided. The verdict is `extra.forecast.outcome`, the payout `xp_outcome`. */
    SETTLED: "resolved",
    /** Nothing was ever tested — the stake goes back whole and nobody was right. */
    VOID: "cancelled",
};

/** Exactly the set migration 0008's CHECK constraint allows. */
export const WAGER_STATUSES = [WAGER.OPEN, WAGER.SETTLED, WAGER.VOID];

export const isOpenWager = (row) => row?.status === WAGER.OPEN;

/**
 * What actually happened, for a screen to draw.
 *
 * Reads the verdict from `extra.forecast.outcome` rather than inferring it
 * from `xp_outcome`, because a payout of exactly 0 is legitimate and ambiguous:
 * the proper scoring rule pays zero for restating the app's own base rate, so
 * "0" means both "a maximally wrong call" and "you agreed with the house".
 * Only the recorded outcome can tell those apart.
 */
export function wagerOutcome(row) {
    if (!row) return "open";
    if (row.status === WAGER.VOID) return "void";
    if (row.status !== WAGER.SETTLED) return "open";
    const o = row?.extra?.forecast?.outcome;
    if (o === true) return "won";
    if (o === false) return "lost";
    // Settled by a path that recorded no verdict (the pre-forecast wager
    // resolver). `accuracy` is that path's own record of how it went.
    if (row.accuracy === "wrong") return "lost";
    if (row.accuracy) return "won";
    return "settled";
}
