/**
 * studyMove — what a subject actually needs next.
 *
 * Pulled out of the dashboard's hand so it can be tested. It is the piece of
 * that panel with real branching in it, and the fixture only ever exercises one
 * of the three: every deck in the harness has cards due, so "Drill" and "Test
 * yourself" were shipping unverified behind a screenshot that looked right.
 *
 * IT RETURNS A QUERY, NOT A URL. The route is `createPageUrl`'s business and
 * that module is TypeScript; a pure function that already knows the answer
 * should not also have to know the page's path in order to be importable by a
 * test runner. The caller joins the two.
 *
 * THE ORDER OF THE BRANCHES IS THE WHOLE OPINION. Cards due beat a weak spot,
 * because a due card is decaying against a clock and a weak spot has been weak
 * for a fortnight and will keep. And when nothing is pressing the move is to
 * TEST, not to review: there is nothing to review, and the useful question at
 * that point is what you have actually got rather than another pass over
 * material the scheduler already believes you know.
 */

/** @returns {{query: string, verb: string, detail: string, urgent?: boolean}} */
export function studyMove(row) {
    const subject = String(row?.subject || "");
    const q = (tab) => `?tab=${tab}&subject=${encodeURIComponent(subject)}`;
    const due = Number(row?.due) || 0;
    const weak = Number(row?.weak) || 0;

    if (due > 0) {
        return { query: q("spaced_repetition"), verb: "Review",
                 detail: `${due} due`, urgent: true };
    }
    if (weak > 0) {
        return { query: q("spaced_repetition"), verb: "Drill",
                 detail: `${weak} weak` };
    }
    return { query: q("active_recall"), verb: "Test yourself", detail: "nothing due" };
}
