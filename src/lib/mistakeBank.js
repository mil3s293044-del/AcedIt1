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
 *
 * ─── One builder, because a mistake is a MARK, not a quote ──────────────────
 * There were two builders, one for an annotated phrase and one for a missed
 * criterion, and only the phrase one was ever wired up. That is why a student
 * could save "you wrote 'goes up' where the command term was EXPLAIN" and
 * could not save "did not name the electron transfer" — and the second is the
 * bigger mistake, because it is the one whose words are missing from the page
 * altogether. Both are now the same thing: a MODULE from quizMarking, which is
 * one mark, with or without a phrase to point at.
 */

/** The marker. Also the topic students see on the deck, so it has to read well. */
export const BANK_TOPIC = "Mistake bank";

const str = (v) => String(v ?? "").trim();
const clip = (s, n) => {
    const t = str(s);
    return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/**
 * A stable identity for "have I already saved this one".
 *
 * Scoped to the question, because two questions on one paper genuinely can
 * drop the same criterion and both are worth rehearsing — but a key of the
 * bare quote made the second one look already-saved. Derived from the mark
 * itself rather than from array position, so it survives the modules being
 * reordered underneath it.
 */
export const bankKey = (mod, questionIndex = 0) => {
    const id = str(mod?.text) || str(mod?.quote) || str(mod?.id);
    return id ? `q${questionIndex}:${id.toLowerCase()}` : "";
};

/**
 * A flashcard row from one mark on a marked answer.
 *
 * Never returns null for a mark that was LOST. That is the whole repair: every
 * mistake a student can see, they can save. The criterion text is itself a
 * usable back — it is already phrased as what the assessor was looking for —
 * so a card can always be built even when the marker offered no wording.
 *
 * A surviving imprecision (`risk`) still needs a fix to be worth a card; with
 * no wording to rehearse there is nothing on the back but the observation.
 */
export function cardFromModule(mod, { subject, questionTitle } = {}) {
    if (!mod) return null;
    const lost = mod.status === "lost";
    const text = str(mod.text);
    const fixes = (mod.fixes || []).map(str).filter(Boolean);
    if (!text && !fixes.length) return null;
    if (!lost && !fixes.length) return null;

    const where = clip(questionTitle, 60);
    // What they actually wrote, when the marker could point at it. This is what
    // makes the card feel like their own paper rather than a generic prompt.
    const quote = str(mod.evidence?.[0]?.quote);

    const front = quote
        ? `${where ? `${where} — ` : ""}you wrote “${clip(quote, 80)}”. What did the assessor want instead?`
        : `${where ? `${where} — ` : ""}${text}. What did the assessor need to see?`;

    // Back: the wording that scores, then why. Never the mistake on its own.
    const back = [
        fixes.length ? fixes.join("\n\nor\n\n") : str(mod.wanted) || text,
        fixes.length ? (str(mod.wanted) || str(mod.detail)) : str(mod.detail),
    ].filter(Boolean).join("\n\n");

    return {
        subject_name: subject || null,
        topic: BANK_TOPIC,
        unit: lost ? "Lost mark" : "Imprecise wording",
        question: front,
        answer: back || text,
        is_active: true,
        // A dropped mark is a demonstrated weak spot, so it enters the schedule
        // as one rather than waiting its turn behind cards they already know.
        is_weak_spot: lost,
    };
}

/** Is this row one of the bank's? Used by the filtered view. */
export const isBankCard = (card) => card?.topic === BANK_TOPIC;
