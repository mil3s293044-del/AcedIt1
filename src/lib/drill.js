/**
 * drill — the same mistake, asked harder each time you get it right.
 *
 * ─── The problem with a flashcard here ──────────────────────────────────────
 * A banked mistake used to be an ordinary two-sided card: read the prompt,
 * read the model wording, rate yourself. That is RECOGNITION, and recognition
 * is the weakest thing you can do with a mistake — it feels like learning
 * because the answer looks familiar when you see it, which is exactly the
 * illusion the whole app exists to argue against. The landing page calls
 * rereading out by name and then the mistake bank did the same thing in a
 * nicer frame.
 *
 * ─── The ladder ─────────────────────────────────────────────────────────────
 * So a mistake gets harder as the student gets it right:
 *
 *   RECOGNISE  first time. What they wrote, and what would have scored. There
 *              is nothing to retrieve yet — they have not been told the answer
 *              once. Asking somebody to produce a wording nobody has shown
 *              them is a test, not a drill.
 *   CLOZE      once they have seen it. The model wording with the load-bearing
 *              terms removed, and those same terms as the word bank. Cheap,
 *              fast, and it targets precisely the words the criterion turns on.
 *   PRODUCE    once they can fill it in. The criterion alone, and a box. This
 *              is the one that transfers to a SAC, because a SAC is a box.
 *
 * Expanding retrieval plus the generation effect, on the app's own schedule —
 * the stage is read off `repetitions`, which SM-2 already maintains, so
 * nothing new is stored and the ladder cannot drift out of step with the
 * scheduler.
 *
 * ─── A stage that cannot be built is never forced ───────────────────────────
 * A cloze needs at least two blankable terms. Some model wordings do not have
 * them — a one-clause fix, an answer that is all common words. Rather than
 * blanking a stopword and asking a student to guess "the", the ladder falls
 * back a rung. Every function here returns null instead of degrading.
 */

export const STAGES = ["recognise", "cloze", "produce"];

/** Correct recalls before the rung goes up. */
const CLOZE_AFTER = 1;
const PRODUCE_AFTER = 3;

// Blanking one of these teaches nothing and reads as a bug.
const STOP = new Set(`a an the and or but of to in on at by for with from as is are was were
be been being it its this that these those they them their there then than so such which who whom
whose what when where why how not no nor if into over under about across through during before
after above below up down out off again further once here also very can will just do does did
your you i we he she has have had would could should may might must own same too s t don now`
    .split(/\s+/));

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ");

/**
 * Which rung this card is on.
 *
 * Read off the SM-2 counters rather than stored, so a card reset by a lapse
 * drops back down the ladder with the scheduler rather than staying hard while
 * its interval collapses — which would be the worst of both.
 */
export function drillStage(card) {
    const reps = Number(card?.repetitions) || 0;
    if (reps >= PRODUCE_AFTER) return "produce";
    if (reps >= CLOZE_AFTER) return "cloze";
    return "recognise";
}

/**
 * The words a cloze should remove.
 *
 * THE CRITERION DECIDES. A term that appears in both the model wording and the
 * criterion is a term the mark turns on — "fairness", "equality", "access" —
 * and those are exactly what a student who wrote a vague answer left out.
 * Words that appear only in the answer are its scaffolding, and blanking
 * scaffolding produces a puzzle about grammar rather than about the subject.
 *
 * Falls back to the rarest long words in the answer when the criterion shares
 * nothing with it, because a criterion phrased in completely different words
 * is still a real criterion.
 */
export function keyTerms(answer, criterion, { max = 3 } = {}) {
    const words = norm(answer).split(/\s+/).filter(Boolean);
    const critSet = new Set(norm(criterion).split(/\s+/).filter(Boolean));

    const seen = new Set();
    const candidate = (w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w);

    const shared = [];
    const rest = [];
    words.forEach((w, i) => {
        if (!candidate(w) || seen.has(w)) return;
        seen.add(w);
        // NEVER THE FIRST WORD. A passage that opens with a hole gives the
        // student nothing to work from — the whole value of a cloze is the
        // context around the gap, and the opening word has none before it.
        // "______ uphold the principle of fairness" is a guessing game;
        // "Remedies uphold the principle of ______" is a drill.
        if (i === 0) return;
        (critSet.has(w) ? shared : rest).push(w);
    });
    // Longest first within each group: a longer word is more likely to be the
    // technical one, and a four-letter near-stopword makes a weak blank.
    const byLen = (a, b) => b.length - a.length;
    const picked = [...shared.sort(byLen), ...rest.sort(byLen)].slice(0, max);
    return picked;
}

/**
 * Deterministic shuffle, seeded from the card id.
 *
 * The word bank must not reorder on every render — a student who looks away
 * and back to find the options moved will not trust the screen. Seeded rather
 * than sorted, because alphabetical order would put the answer to the first
 * blank first often enough to be a tell.
 */
function seededShuffle(list, seed) {
    let h = 0;
    for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        h = (h * 1103515245 + 12345) >>> 0;
        const j = h % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * The model wording as a fill-in-the-gap, or null if it cannot be one.
 *
 * Returns segments so the renderer never has to parse a string with markers in
 * it — text, blank, text, blank — plus the shuffled bank. Only the FIRST
 * occurrence of a term is blanked: removing every "fairness" from a paragraph
 * leaves a sentence nobody can read, let alone complete.
 */
export function buildCloze(card, { minBlanks = 2, maxBlanks = 3 } = {}) {
    const answer = String(card?.answer || "").trim();
    if (!answer) return null;
    // The first wording only. A back with two alternatives joined by "or" is
    // for reading; blanking both is asking the same question twice.
    const body = answer.split(/\n\s*or\s*\n/i)[0].trim();
    // Three gaps, not four. Four holes in one sentence stops being a recall
    // exercise and becomes a word-order puzzle, and the extra one is always
    // the weakest candidate by definition.
    const terms = keyTerms(body, card?.extra?.mistake?.criterion || "", { max: maxBlanks });
    if (terms.length < minBlanks) return null;

    const segments = [];
    let cursor = 0;
    const used = [];
    for (const term of terms) {
        // Word-boundary match on the original text, so the blank lands on the
        // real casing and the rest of the sentence survives intact.
        const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        const rel = body.slice(cursor).search(re);
        if (rel === -1) continue;
        const at = cursor + rel;
        const matched = body.slice(at).match(re)[0];
        segments.push({ text: body.slice(cursor, at) });
        segments.push({ blank: used.length, answer: matched });
        used.push(matched);
        cursor = at + matched.length;
    }
    if (used.length < minBlanks) return null;
    segments.push({ text: body.slice(cursor) });

    return {
        segments,
        answers: used,
        bank: seededShuffle(used, card?.id || used.join("")),
    };
}

/** Case- and punctuation-insensitive, because a drill is not a spelling test. */
export const sameTerm = (a, b) => norm(a).trim() === norm(b).trim();

/**
 * Did they fill every gap correctly?
 *
 * Returns the per-blank verdict as well as the total, because "you got two of
 * three" with no indication of WHICH is a mark without a reason — the same
 * failure the quiz marking exists to fix.
 */
export function gradeCloze(cloze, filled = []) {
    if (!cloze) return null;
    const each = cloze.answers.map((a, i) => sameTerm(a, filled[i] || ""));
    const right = each.filter(Boolean).length;
    return { each, right, total: cloze.answers.length, allRight: right === cloze.answers.length };
}

/**
 * The rating a result suggests, on the app's 1–4 scale.
 *
 * SUGGESTS. The student still presses the button — an app that grades a typed
 * answer and then schedules the card on its own verdict has taken away the one
 * judgement only they can make, which is whether they actually knew it or
 * guessed. Everything else in the review flow is self-rated and this stays
 * consistent with it.
 */
export function suggestRating({ right, total }) {
    if (!total) return null;
    if (right === total) return 4;
    if (right >= Math.ceil(total * 0.6)) return 3;
    if (right > 0) return 2;
    return 1;
}

/**
 * What to actually show, given the card and what could be built.
 *
 * One place decides, so the runner never has to ask "is there a cloze" and
 * "which stage" separately and risk answering them inconsistently.
 */
export function drillFor(card) {
    const stage = drillStage(card);
    if (stage === "cloze") {
        const cloze = buildCloze(card);
        return cloze ? { stage: "cloze", cloze } : { stage: "recognise" };
    }
    if (stage === "produce") {
        // Produce needs something to mark against. Without a criterion the
        // prompt would be "write the answer to the card you cannot see".
        const criterion = String(card?.extra?.mistake?.criterion || "").trim();
        return criterion ? { stage: "produce", criterion } : { stage: "recognise" };
    }
    return { stage: "recognise" };
}
