/**
 * What a shared deck CARRIES, and what the recipient GETS.
 *
 * A deck sent to a friend crosses a boundary twice — out of the sharer's rows
 * into a JSON blob, and out of that blob into the recipient's rows — and until
 * now each of the three crossings in the app made up its own answer:
 *
 * - **`subject_code` is not a flashcards column.** Both writers put it in the
 *   blob and Friends.jsx then SPREAD the blob into `Flashcard.create`, so
 *   PostgREST 400'd, the `Promise.all` rejected, and **accepting a shared deck
 *   has never once worked.** The knowledge was already in the codebase:
 *   SpacedRepetition.jsx carries the comment "schema has no subject_code column
 *   on flashcards — keeping the field would 400 the insert" seventy lines above
 *   the share path that keeps it.
 * - **The group importer dropped `unit`**, and the review shelf keys decks on
 *   subject|topic|unit — so an imported deck split away from the subject it
 *   belongs to, under a blank unit.
 * - **A spread carries whatever is in the blob.** Today's writers whitelist six
 *   fields, so nothing leaks; a row written by an older build, or by the next
 *   writer somebody adds, carries the SHARER'S SM-2 state — and `retired_at`
 *   most of all, which would hand a friend a deck that is already "I know
 *   this" and therefore invisible in every queue in the app.
 *
 * So the crossing is TWO pure functions and nothing is spread. `outgoingCard`
 * is what may leave; `importedCard` is what may arrive. Both are keyed on an
 * explicit list, because a deletion decision and a column list have the same
 * property: you cannot check them from inside the handler that already ran.
 */

/**
 * The content fields a card carries between students. Deliberately NOT the
 * `flashcards` column list: identity (`id`, `created_by`), scheduling and the
 * per-quality counters are the SHARER'S and may never travel.
 *
 * `unit` is here because the review shelf keys decks on subject|topic|unit.
 */
export const SHARED_CARD_FIELDS = ["subject_name", "unit", "topic", "question", "answer"];

const text = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

/** One card, as it goes into `flashcard_data` / `resource_data.flashcards`. */
export function outgoingCard(card, deck = null) {
    const src = card || {};
    const fallback = deck || {};
    return {
        subject_name: text(src.subject_name || fallback.subject_name),
        unit: text(src.unit || fallback.unit),
        topic: text(src.topic || fallback.topic),
        question: text(src.question),
        answer: text(src.answer),
    };
}

/**
 * The deck a share carries. A card missing its question or answer is DROPPED —
 * both are `not null` in the schema, so one empty card would otherwise reject
 * the whole insert on the recipient's side and lose the other fifty-nine.
 */
export function outgoingDeck(deck) {
    const cards = Array.isArray(deck?.cards) ? deck.cards : [];
    return cards.map((c) => outgoingCard(c, deck)).filter((c) => c.question && c.answer);
}

/**
 * One row for the recipient. Every SM-2 field is written EXPLICITLY at its
 * starting value rather than left to the column default, so this reads as what
 * it is: a brand-new card that has never been seen, whatever state the sharer's
 * copy was in.
 *
 * `next_review_date` is null on purpose. `due.js` counts a never-reviewed card
 * as NEW, which is the honest reading; dating it tomorrow would hide a freshly
 * imported deck for a day on a screen the student opened to use it.
 */
export function importedCard(card, deckId) {
    const c = outgoingCard(card);
    return {
        subject_name: c.subject_name,
        unit: c.unit,
        topic: c.topic,
        question: c.question,
        answer: c.answer,
        deck_id: deckId,
        is_active: true,

        repetitions: 0,
        easiness_factor: 2.5,
        interval_days: 0,
        next_review_date: null,
        last_reviewed_date: null,
        last_quality: null,
        total_reviews: 0,
        retired_at: null,
        snoozed_until: null,

        session_skip_count: 0,
        review_count_again: 0,
        review_count_hard: 0,
        review_count_good: 0,
        review_count_easy: 0,
        consecutive_good: 0,
        consecutive_easy: 0,
        is_weak_spot: false,
    };
}

/** Every row to insert for one accepted share. */
export function importedDeck(cards, deckId) {
    const list = Array.isArray(cards) ? cards : [];
    return list.map((c) => importedCard(c, deckId)).filter((c) => c.question && c.answer);
}

/** A deck id for an import, unique per accept. */
export function importDeckId(prefix = "deck") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
