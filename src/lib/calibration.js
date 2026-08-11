/**
 * calibration — do you know what you know?
 *
 * A student rates their confidence BEFORE the verdict is revealed, and this
 * compares the two. That gap is the thing nothing else in the app measures,
 * and it's the failure that actually sinks people: re-reading produces a
 * strong feeling of knowing without the knowledge, so the student walks into
 * the SAC confident and wrong. Testing yourself only fixes that if you look at
 * where your confidence was misplaced.
 *
 * The two errors are not the same and are never averaged together:
 *
 *   OVERCONFIDENT — sure, and wrong. The dangerous one. These are the topics
 *   that get crossed off a revision list and cost marks on the day.
 *
 *   UNDERCONFIDENT — unsure, and right. Cheap by comparison, but it wastes
 *   revision time on material that's already solid, and it's worth knowing.
 *
 * The order matters and the UI has to enforce it: a confidence rating
 * collected after the answer is revealed measures nothing at all.
 */

export const CONFIDENCE = [
    { value: 1, label: "No idea",   blurb: "Guessing",              tone: "streak" },
    { value: 2, label: "Shaky",     blurb: "Something, not sure",   tone: "xp" },
    { value: 3, label: "Fairly sure", blurb: "Think I've got it",   tone: "chart-3" },
    { value: 4, label: "Certain",   blurb: "Could write it out",    tone: "primary" },
];

/** Confident enough that being wrong is a real problem. */
const CONFIDENT = 3;
/** Marks at or above this count as knowing it. */
const CORRECT = 0.6;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * @param answers [{ confidence: 1..4, score: 0..1 } | { confidence, verdict: "Correct" }]
 */
export function calibrate(answers = []) {
    const rows = [];
    for (const a of answers || []) {
        const c = num(a?.confidence);
        if (c == null || c < 1) continue;
        // Either a 0–1 score or one of the marker's verdicts. An unmarked
        // answer has no truth to compare against and is skipped, not counted
        // as wrong.
        let correct = null;
        const s = num(a?.score);
        if (s != null) correct = s >= CORRECT;
        else if (a?.verdict === "Correct") correct = true;
        else if (a?.verdict === "Partially Correct") correct = true;
        else if (a?.verdict === "Incorrect") correct = false;
        if (correct == null) continue;
        rows.push({ ...a, confidence: c, correct, confident: c >= CONFIDENT });
    }

    if (!rows.length) {
        return {
            rated: 0, overconfident: [], underconfident: [], aligned: 0,
            confidentTotal: 0, unsureTotal: 0, accuracy: null,
            hasData: false, verdict: null,
        };
    }

    const overconfident = rows.filter(r => r.confident && !r.correct);
    const underconfident = rows.filter(r => !r.confident && r.correct);
    const confidentTotal = rows.filter(r => r.confident).length;
    const unsureTotal = rows.length - confidentTotal;

    return {
        rated: rows.length,
        rows,
        overconfident,
        underconfident,
        aligned: rows.length - overconfident.length - underconfident.length,
        confidentTotal,
        unsureTotal,
        accuracy: rows.filter(r => r.correct).length / rows.length,
        // Share of the answers you were sure about that were actually wrong.
        // This is the number worth remembering, and it's null rather than zero
        // when nothing was answered confidently.
        overconfidenceRate: confidentTotal ? overconfident.length / confidentTotal : null,
        hasData: true,
    };
}

/**
 * One honest sentence. Deliberately not congratulatory when the calibration is
 * bad, and deliberately not alarmed when the sample is two questions.
 */
export function calibrationVerdict(c) {
    if (!c?.hasData) return null;
    if (c.rated < 4) {
        return `Only ${c.rated} rated answer${c.rated === 1 ? "" : "s"} — too few to say much about your calibration yet.`;
    }
    const over = c.overconfident.length;
    const under = c.underconfident.length;
    if (over === 0 && under === 0) {
        return "Your confidence matched your answers on every question. That's the goal — you know what you know.";
    }
    if (over >= 2 && c.overconfidenceRate >= 0.3) {
        return `You were sure about ${c.confidentTotal} and wrong on ${over} of them. That gap is the dangerous one: those are the topics you'd cross off a revision list and lose marks on.`;
    }
    if (over > 0) {
        return `${over} answer${over === 1 ? "" : "s"} you were sure about didn't land. Worth a second look — feeling certain is not the same as being right.`;
    }
    return `You got ${under} right that you weren't sure about. You know this better than you think, and revising it again would be time you don't need to spend.`;
}

/**
 * The topics to actually do something about, worst first. Overconfident
 * misses only — being right while unsure needs no action beyond noticing it.
 */
export function overconfidentItems(c, limit = 5) {
    if (!c?.hasData) return [];
    return [...c.overconfident]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, limit);
}
