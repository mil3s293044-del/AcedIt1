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
        // CONSTANT. The review deck groups by subject|topic|unit, so putting
        // "Lost mark" / "Imprecise wording" here split one student's bank into
        // two decks per subject on the shelf. The distinction is real but it
        // belongs in the row, not in the deck key.
        unit: BANK_TOPIC,
        question: front,
        answer: back || text,
        is_active: true,
        // A dropped mark is a demonstrated weak spot, so it enters the schedule
        // as one rather than waiting its turn behind cards they already know.
        is_weak_spot: lost,
        // Provenance, so the bank can group by criterion and say what a
        // mistake cost. Kept structured rather than parsed back out of the
        // question text, which is prose and will be reworded.
        extra: {
            mistake: {
                criterion: text,
                quote,
                question_title: where,
                cost: Number(mod.cost) || 0,
                lost,
                banked_at: new Date().toISOString(),
            },
        },
    };
}

/** Is this row one of the bank's? Used by the filtered view. */
export const isBankCard = (card) => card?.topic === BANK_TOPIC;

// ─── Reading the bank back ──────────────────────────────────────────────────
//
// A bank that only accumulates is a guilt list, and a guilt list is a screen
// nobody opens twice. What makes it worth a visit is watching mistakes LEAVE,
// so everything below exists to answer one question: which of these have I
// actually fixed?
//
// The answer is read off the SM-2 counters the review engine already keeps.
// Nothing new is stored to support it — a second source of truth about how
// well a card is known is how two screens start disagreeing about the same
// card, which is the whole reason `mastery.js` and `sm2.js` exist.

/**
 * How many clean recalls, and how long a gap, before a mistake is FIXED.
 *
 * Two, not one. One clean recall the day after banking it is short-term
 * memory, and calling that fixed is the flattery the rank system exists to
 * refuse — a student who is told they have fixed something they have not is
 * being set up for the SAC. The interval is the same claim from the other
 * side: the scheduler only pushes a card a week out once it has earned it.
 */
const FIXED_STREAK = 2;
const FIXED_INTERVAL_DAYS = 7;

/**
 * Where a mistake is up to. Four states, because "not started" and "still
 * getting it wrong" are different things and lumping them together hides the
 * only one that needs action today.
 */
export function fixState(card) {
    if (!card) return "new";
    const good = card.consecutive_good || 0;
    const easy = card.consecutive_easy || 0;
    const reviews = (card.review_count_again || 0) + (card.review_count_hard || 0)
        + (card.review_count_good || 0) + (card.review_count_easy || 0);

    if (reviews === 0) return "new";
    if (Math.max(good, easy) >= FIXED_STREAK && (card.interval_days || 0) >= FIXED_INTERVAL_DAYS) return "fixed";
    // Their most recent answer is what "still" means. A card with four early
    // lapses that they have since recalled twice is going the right way, and
    // filing it under slipping would be reporting history as news.
    if (card.last_quality != null && card.last_quality <= 2) return "slipping";
    return "working";
}

export const FIX_STATES = ["slipping", "new", "working", "fixed"];

/**
 * Provenance, for the cards that carry it.
 *
 * Written into `extra.mistake` when the card is banked. Older cards have none
 * — the bank predates it — so every read is defaulted rather than guarded at
 * the call site, and a card with no provenance still counts, still reviews and
 * still shows its state. It just cannot be grouped by criterion.
 */
export function mistakeMeta(card) {
    const m = card?.extra?.mistake;
    return {
        criterion: str(m?.criterion),
        quote: str(m?.quote),
        questionTitle: str(m?.question_title),
        cost: Number(m?.cost) > 0 ? Number(m.cost) : 0,
        lost: m?.lost !== false,
        bankedAt: str(m?.banked_at) || str(card?.created_date),
    };
}

/**
 * The mistakes that keep happening.
 *
 * The quiz results screen finds themes ACROSS the questions of one attempt;
 * this is the same idea across the whole bank, and it is the most valuable
 * thing on the screen: a student told "you have dropped this same criterion
 * four times" has one thing to fix instead of four.
 *
 * Two is the floor, for the reason the themes prompt gives — a single
 * occurrence is an incident, not a pattern, and calling it one teaches a
 * student to distrust the label.
 */
export function repeatOffenders(cards = [], { min = 2 } = {}) {
    const groups = new Map();
    for (const card of cards) {
        const { criterion } = mistakeMeta(card);
        if (!criterion) continue;
        const k = criterion.toLowerCase();
        if (!groups.has(k)) groups.set(k, { criterion, cards: [], subjects: new Set() });
        const g = groups.get(k);
        g.cards.push(card);
        if (card.subject_name) g.subjects.add(card.subject_name);
    }
    return [...groups.values()]
        .filter((g) => g.cards.length >= min)
        .map((g) => ({
            criterion: g.criterion,
            count: g.cards.length,
            subjects: [...g.subjects],
            // Fixed only when EVERY instance is. One outstanding copy of a
            // repeated mistake is still a mistake you are making.
            fixed: g.cards.every((c) => fixState(c) === "fixed"),
            // How many are still open, so a partly-fixed repeat says so. "3×"
            // on a criterion the student has already nailed twice is history
            // reported as news, and it is the same error `fixState` refuses to
            // make about a single card.
            open: g.cards.filter((c) => fixState(c) !== "fixed").length,
        }))
        .sort((a, b) => b.count - a.count || a.criterion.localeCompare(b.criterion));
}

/**
 * The whole bank in the numbers the screen prints.
 *
 * `isReady` is injected rather than imported so this file stays free of date
 * logic — due.js already owns that rule, and owning it twice is how a card
 * shows as due on one screen and not on another.
 *
 * READY is not the same as DUE, and the difference matters here. due.js counts
 * a never-reviewed card as NEW rather than due, deliberately: a freshly
 * generated deck of sixty must not report sixty cards overdue before anyone
 * has opened one. But a freshly banked mistake is not unopened material — the
 * student demonstrably got it wrong on a marked quiz an hour ago, and there is
 * no reason to make them wait. So the page passes "due or new", and a bank
 * with five mistakes in it never greets them with "nothing to do today".
 */
export function bankSummary(cards = [], isReady = () => false) {
    const mine = cards.filter(isBankCard);
    const counts = { slipping: 0, new: 0, working: 0, fixed: 0 };
    const subjects = new Map();

    for (const card of mine) {
        const state = fixState(card);
        counts[state] += 1;
        const name = card.subject_name || "No subject";
        if (!subjects.has(name)) subjects.set(name, { subject: name, total: 0, fixed: 0, ready: 0 });
        const s = subjects.get(name);
        s.total += 1;
        if (state === "fixed") s.fixed += 1;
        if (isReady(card)) s.ready += 1;
    }

    return {
        cards: mine,
        total: mine.length,
        ...counts,
        // Everything that is not yet fixed is still costing marks.
        outstanding: mine.length - counts.fixed,
        ready: mine.filter(isReady).length,
        subjects: [...subjects.values()].sort((a, b) => b.total - a.total),
        repeats: repeatOffenders(mine),
    };
}
