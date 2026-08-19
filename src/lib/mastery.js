/**
 * mastery — how well a card is known, and by extension how well a subject is.
 *
 * This lived as a module-local const inside SpacedRepetition.jsx, which meant
 * the number that decides a card's RANK everywhere in the app was reachable
 * from exactly one screen. The dashboard could not show you the rank of your
 * own subjects without either importing a 1600-line review component or
 * writing a second copy of the formula, and a second copy is how two parts of
 * an app start disagreeing about the same fact.
 *
 * THE FORMULA IS UNCHANGED, deliberately. This is a move, not a rewrite: the
 * weights below are the ones the review deck has been using, so a card that
 * shows as a Queen in the deck shows as a Queen everywhere else. Anything that
 * looks arguable about them is out of scope here and should be argued about
 * once, in this file, where the whole app will follow.
 *
 *   40%  success rate       good + easy over all reviews
 *   30%  interval length    a longer schedule means more confidence
 *   20%  ease factor        how easily it keeps coming back
 *   10%  recency            recently reviewed is more relevant
 *
 * A card with no reviews scores 0 and comes out a two. That is correct and it
 * is the whole basis of the promise onboarding makes: ranks are earned.
 */
import { isDue } from "./due.js";

/** Mastery 0–100 for a single card. */
export function cardMastery(card) {
    const again = card?.review_count_again || 0;
    const hard = card?.review_count_hard || 0;
    const good = card?.review_count_good || 0;
    const easy = card?.review_count_easy || 0;
    const total = again + hard + good + easy;
    if (total === 0) return 0;

    const successRate = (good + easy) / total;
    const intervalScore = Math.min((card.interval_days || 1) / 30, 1);
    const ef = card.easiness_factor || 2.5;
    const efScore = Math.max(0, Math.min((ef - 1.3) / (3.0 - 1.3), 1));

    let recencyScore = 0;
    if (card.last_reviewed_date) {
        const daysSince = Math.floor(
            (Date.now() - new Date(card.last_reviewed_date).getTime()) / 86400000);
        recencyScore = Math.max(0, 1 - daysSince / 30);
    }

    const raw = successRate * 0.40 + intervalScore * 0.30 + efScore * 0.20 + recencyScore * 0.10;
    return Math.round(raw * 100);
}

/**
 * Due today, or overdue.
 *
 * This used to be its own rule, and a wrong one: it treated a card with no
 * next_review_date as due, so a freshly generated deck reported every card in
 * it as overdue before anybody opened one. Three other files had three other
 * versions of the same test. There is one now, in due.js, and it also knows
 * about the cards a student has marked known or put off — which this could not,
 * because those states did not exist.
 *
 * Re-exported rather than replaced at every call site so the name that six
 * files already import keeps working.
 */
export { isDue as isCardDue };

/**
 * Roll a pile of flashcards up into one row per subject.
 *
 * MASTERY IS THE PLAIN MEAN over the subject's cards, not a weighted or
 * trimmed one. The temptation is to discount unreviewed cards so a subject
 * does not look worse than it feels, and that is exactly the flattery the rank
 * system exists to refuse: a hundred cards you have never opened IS a subject
 * you do not know yet, and the card should say so.
 *
 * Subjects are returned strongest first, because the hand is meant to be read
 * like a hand — the high cards on one end — and because the interesting one is
 * whichever is lowest, which is then reliably at the same end every time.
 */
export function subjectHand(flashcards = [], today) {
    const bySubject = new Map();

    flashcards.forEach((c) => {
        const name = c?.subject_name;
        if (!name) return;
        if (!bySubject.has(name)) {
            bySubject.set(name, { subject: name, cards: 0, due: 0, weak: 0, sum: 0, topics: new Set() });
        }
        const row = bySubject.get(name);
        row.cards += 1;
        row.sum += cardMastery(c);
        if (isDue(c, today)) row.due += 1;
        if (c.is_weak_spot) row.weak += 1;
        if (c.topic) row.topics.add(c.topic);
    });

    return [...bySubject.values()]
        .map((r) => ({
            subject: r.subject,
            cards: r.cards,
            due: r.due,
            weak: r.weak,
            topics: [...r.topics],
            mastery: r.cards ? Math.round(r.sum / r.cards) : 0,
        }))
        .sort((a, b) => b.mastery - a.mastery || a.subject.localeCompare(b.subject));
}
