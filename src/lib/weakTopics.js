/**
 * weakTopics — the topics costing a student marks.
 *
 * Lifted out of WeakTopicsPanel so pure logic doesn't live in a component:
 * recallSuggest needs this to answer "what should I test?", and a plain
 * module shouldn't have to import JSX to reach a function that only does
 * arithmetic.
 */
// A topic needs enough reviews behind it before "you're weak at this" is a fair
// claim — two failed cards on a brand-new deck is noise, not a weakness.
const MIN_REVIEWS = 5;

export function weakTopicsFrom(flashcards = []) {
    const byTopic = {};
    for (const c of flashcards || []) {
        // Null-guarded: this used to be fed only by a loader that always
        // returned objects. It's a shared lib now and gets called with
        // whatever the caller has.
        if (!c?.topic) continue;
        const key = `${c.subject_name || "General"}:::${c.topic}`;
        const t = byTopic[key] || (byTopic[key] = {
            subject: c.subject_name || "General", topic: c.topic,
            reviews: 0, landed: 0, weakCards: 0, cards: 0,
        });
        t.cards += 1;
        t.reviews += c.total_reviews || 0;
        t.landed += (c.review_count_good || 0) + (c.review_count_easy || 0);
        if (c.is_weak_spot) t.weakCards += 1;
    }

    return Object.values(byTopic)
        .filter((t) => t.weakCards > 0 || t.reviews >= MIN_REVIEWS)
        .map((t) => ({
            ...t,
            // Share of reviews that didn't land. No reviews yet but flagged
            // cards still counts as worth attention, just without a rate.
            missRate: t.reviews > 0 ? Math.round((1 - t.landed / t.reviews) * 100) : null,
        }))
        .filter((t) => t.weakCards > 0 || (t.missRate ?? 0) >= 30)
        .sort((a, b) => (b.weakCards - a.weakCards) || ((b.missRate ?? 0) - (a.missRate ?? 0)))
        .slice(0, 6);
}
