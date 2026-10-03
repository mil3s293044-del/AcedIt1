/**
 * boardMovement — which way a row has gone since the week opened.
 *
 * ─── Why a board needs this ─────────────────────────────────────────────────
 * A leaderboard without movement is a list of facts about other people. The
 * order is the only information in it, and an order that looks the same every
 * time you open it reads as a fixture rather than a race — which is the
 * complaint this module exists to answer. One arrow per row is the cheapest
 * thing that turns a ranking into something with motion in it: a student who
 * has climbed four places this week can SEE that they climbed four places, and
 * the person above them can see somebody coming.
 *
 * ─── A LOWER RANK NUMBER IS BETTER, which is the one sign error here ────────
 * 4th → 2nd is a gain of two places, so the delta is `was - now`. Writing it
 * the other way round renders perfectly and draws every climb as a fall: the
 * student who had the best week on the board is shown a red arrow. It is
 * asserted rather than commented, because the arithmetic is one character and
 * nothing on screen would say it had been flipped.
 *
 * ─── AND IT NEVER INVENTS A POSITION ────────────────────────────────────────
 * Four separate ways a rank can be absent, and every one of them must draw
 * SOMETHING OTHER than a number of places:
 *
 *   No snapshot at all — the first week this shipped, or the first load of a
 *   week before the write lands. There is no previous board, so there is no
 *   movement, and a column of dashes is the honest answer.
 *
 *   A student not IN the snapshot — new, or newly ranked (the ATAR needs three
 *   study days). They did not climb from last place; they were not there.
 *   `dir: "new"` draws as a NEW badge rather than as "+30".
 *
 *   `Number(null) === 0`. Coercing a missing rank gives 0, and 0 is a better
 *   position than every real one, so every new student is reported as having
 *   FALLEN from an imaginary zeroth place — a plausible, wrong, red arrow on
 *   exactly the rows that should be celebrating. This trap has now reached
 *   `criterionIndexFor`, `expiredKeys`, `markPercent`, `standingOf`,
 *   `closingFacts`, `weakTopicsFrom` and this; it is checked for, not hoped
 *   about.
 *
 *   Held position — a real zero, and a different thing from not knowing.
 *   `dir: "level"` and `places: 0`, so the row can draw a quiet dash that
 *   means "still there" rather than nothing at all.
 *
 * ─── Movement is SINCE THE WEEK OPENED, not since the last page load ────────
 * The snapshot is taken once, by whoever opens Ranked first in a given week,
 * and compared against now. So the column resets on Monday and fills in as the
 * week goes — the league's own rhythm, on the board beside it — rather than
 * measuring against a moving window nobody can name. On Monday morning most
 * rows are level, which is true and is why `level` draws quietly.
 */

/** A real, finite, positive placing — anything else is "we do not know". */
const realRank = (v) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

/**
 * Positions keyed by email, from a list already in board order.
 *
 * Taken from the ORDER rather than recomputed from values, so a rank here can
 * never disagree with the row the student is looking at — the same reason
 * `Ranked`'s `field` is the one source for both the visible rows and the
 * standing maths.
 */
export function rankMap(rows = []) {
    const out = {};
    rows.forEach((r, i) => {
        const email = r?.user_email;
        if (email && !(email in out)) out[email] = i + 1;
    });
    return out;
}

/**
 * One row's movement. `snapshot` is the whole map so a MISSING key and a
 * present-but-odd value are told apart here rather than by the caller.
 *
 * Returns null when there is nothing honest to say, which is what the renderer
 * tests — a null draws no chip at all rather than an empty one.
 */
export function movementFor(now, was) {
    const n = realRank(now);
    if (n == null) return null;
    const w = realRank(was);
    // NOT `was || something`: a missing rank is not a bad rank. They are new
    // to this board, which is its own thing to say.
    if (w == null) return { dir: "new", places: 0 };
    const places = w - n;                    // 4th → 2nd is +2 places GAINED
    if (places === 0) return { dir: "level", places: 0 };
    return { dir: places > 0 ? "up" : "down", places: Math.abs(places) };
}

/**
 * Every visible row's movement, or null for the whole board.
 *
 * NULL IS A FIRST-CLASS ANSWER. With no snapshot the board draws no movement
 * column — not a column of "new" badges, which would tell thirty students they
 * had just arrived on a board they have been on for a term.
 *
 * ─── THE SNAPSHOT IS RE-RANKED WITHIN THESE ROWS, and it has to be ──────────
 * The stored map is the whole field's positions. The board a student is
 * looking at may be a SCOPE of that field — Friends, or their school — and in
 * a scope of five, being 2nd now against a stored 7th is not "up five
 * places", it is two numbers from two different boards subtracted. So last
 * week's placing is recomputed as the row's position AMONG THESE ROWS when
 * sorted by its stored rank. Subsetting cannot reorder anybody, so that is
 * exactly their scope placing at snapshot time, and on the global board it is
 * the stored number back again.
 *
 * What it cannot know is who was in the scope LAST week — a friend added on
 * Wednesday is counted into both halves. Snapshotting every friendship to
 * close that would be a table per student per week for a one-place wobble on
 * a board of five, and today's membership is the reading a student expects
 * ("of the people I'm racing, I've moved up two").
 */
export function movementMap(rows = [], snapshot = null) {
    if (!snapshot || typeof snapshot !== "object") return null;
    // An empty map is a snapshot that recorded nobody, which is the same as
    // not having one.
    if (!Object.keys(snapshot).length) return null;

    const now = rankMap(rows);

    // Last week's placing within THIS set of rows. `realRank` first, so a key
    // present with a junk value is treated as absent rather than sorted to
    // the front of the board.
    const seen = rows
        .map(r => ({ email: r?.user_email, was: realRank(snapshot[r?.user_email]) }))
        .filter(x => x.email && x.was != null)
        .sort((a, b) => a.was - b.was);
    const wasScoped = {};
    seen.forEach((x, i) => { if (!(x.email in wasScoped)) wasScoped[x.email] = i + 1; });

    const out = {};
    for (const [email, rank] of Object.entries(now)) {
        const m = movementFor(rank, wasScoped[email]);
        if (m) out[email] = m;
    }
    return out;
}

/** "Up 4" / "Down 2" / "Holding" / "New" — for a screen reader and a tooltip. */
export function movementLabel(m) {
    if (!m) return null;
    if (m.dir === "new") return "New on this board";
    if (m.dir === "level") return "Holding position";
    return `${m.dir === "up" ? "Up" : "Down"} ${m.places} place${m.places === 1 ? "" : "s"}`;
}
