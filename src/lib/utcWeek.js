/**
 * The server's week: Monday 00:00 UTC. ONE copy.
 *
 * It was written out three times — `currentWeekStartUTC` in server.mjs,
 * `weekKeyUTC` in slate.js, and the chip ledger was about to need a third.
 * Three copies of "which Monday is it" is three chances for a ledger to roll
 * over on a different day from the screen reading it.
 *
 * UTC rather than local is a recorded, known offset (CLAUDE.md: the weekly AI
 * budget resets about ten hours late for a Melbourne student), not a choice
 * this module makes. Imported by server.mjs through chips.js and slate.js, so
 * it stays plain and relative.
 */

const toTime = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const t = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(String(v));
    return Number.isFinite(t) ? t : null;
};

/** The Monday (UTC) of the week holding `d`, as YYYY-MM-DD. */
export function weekKeyUTC(d = new Date()) {
    const x = new Date(toTime(d) ?? Date.now());
    const day = x.getUTCDay();
    x.setUTCDate(x.getUTCDate() - ((day + 6) % 7));
    return x.toISOString().slice(0, 10);
}
