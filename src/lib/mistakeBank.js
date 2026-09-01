/**
 * mistakeBank — the mistakes you keep making, put somewhere they come back.
 *
 * ─── Why this is not its own table ──────────────────────────────────────────
 * The single most useful thing you can do with a mistake is be asked about it
 * again, a few days later, when you have forgotten you made it. This app
 * already has an engine that does exactly that — SM-2 over `flashcards` — and
 * a precedent for feeding it: blurting turns its misses into cards tagged
 * "Blurting gaps".
 *
 * So a banked mistake IS a flashcard, with a marker on it. It shows up in the
 * review queue on its own schedule, it counts toward the same mastery maths,
 * and the bank view is a filter rather than a second system. A separate
 * mistakes table would have needed its own scheduler, its own review screen
 * and its own analytics, and it would have been a list nobody opened.
 *
 * ─── The card asks for the FIX, not the mistake ─────────────────────────────
 * The prompt is what the assessor wanted; the answer is the wording that
 * scores. A card that showed the error and asked "what was wrong with this?"
 * would be rehearsing the mistake, which is the opposite of the point.
 */

/** The marker. Also the topic students see on the deck, so it has to read well. */
export const BANK_TOPIC = "Mistake bank";

const clip = (s, n) => {
    const t = String(s || "").trim();
    return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/**
 * A flashcard row from one annotation on a marked answer.
 *
 * Returns null when there is nothing to rehearse — an annotation with no
 * suggested wording teaches nothing, and a card with a blank back is worse
 * than no card.
 */
export function cardFromAnnotation(ann, { subject, questionTitle } = {}) {
    const fix = String(ann?.fix || "").trim();
    const quote = String(ann?.quote || "").trim();
    if (!fix || !quote) return null;
    const where = clip(questionTitle, 60);
    return {
        subject_name: subject || null,
        topic: BANK_TOPIC,
        unit: ann.criterion || null,
        // Front: the situation and what they actually wrote.
        question: `${where ? `${where} — ` : ""}you wrote “${clip(quote, 80)}”. What does the assessor want instead?`,
        // Back: the wording that scores, and why. Never the mistake on its own.
        answer: ann.issue ? `${fix}\n\n${ann.issue}` : fix,
        is_active: true,
    };
}

/**
 * A card from a criterion that was missed.
 *
 * The criterion text IS the prompt — it is already phrased as what the
 * assessor was looking for — and the note is the explanation.
 */
export function cardFromCriterion(criterion, { subject, questionTitle } = {}) {
    const text = String(criterion?.text || "").trim();
    if (!text || criterion?.got) return null;
    const where = clip(questionTitle, 60);
    return {
        subject_name: subject || null,
        topic: BANK_TOPIC,
        unit: "Missed criterion",
        question: `${where ? `${where} — ` : ""}${text}. What did the assessor need to see?`,
        answer: String(criterion?.note || "").trim() || text,
        is_active: true,
    };
}

/** Is this row one of the bank's? Used by the filtered view. */
export const isBankCard = (card) => card?.topic === BANK_TOPIC;

/**
 * A stable key for "have I already banked this one".
 *
 * The quote, because that is what the student sees underlined — banking the
 * same phrase twice from one marked answer should be impossible, and the
 * button says so rather than silently making a duplicate card.
 */
export const bankKey = (ann) => String(ann?.quote || "").trim();
