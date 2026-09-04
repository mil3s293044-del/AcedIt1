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

import { LADDER_COMPLETE_AT } from "@/lib/drill";

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
export function cardFromModule(mod, { subject, questionTitle, source, topic } = {}) {
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
                // WHICH SORT of small error this is, because the drill rungs
                // differ. A criterion is a thing the assessor wanted and did
                // not get; a note is the marker's remark on wording that may
                // or may not have cost a mark. Only a mistake with the
                // student's own words in it can be drilled by spotting the
                // error in them.
                kind: mod.kind === "note" ? "note" : "criterion",
                // The quiz this came from, as a grouping label. The CARD's
                // `topic` is the constant "Mistake bank" — it has to be, or
                // the review shelf splits one student's bank into a deck per
                // quiz — so the real topic lives here, where a screen can
                // group by it without touching the deck key.
                topic: clip(topic, 80),
                criterion: text,
                quote,
                // What would have scored, kept separately from the criterion.
                // The criterion is what the assessor was LOOKING FOR; `wanted`
                // is the wording that would have earned it, and the two rungs
                // that ask a student to produce something need the second.
                wanted: firstFix(fixes, mod.wanted),
                question_title: where,
                cost: Number(mod.cost) || 0,
                lost,
                // The question this came from, so the ladder can end where the
                // mistake actually happened. Without it a banked mistake can
                // be rehearsed forever and never re-faced in the place that
                // will mark it — see `clearedBy`.
                source: sourceRef(source),
                banked_at: new Date().toISOString(),
            },
        },
    };
}

/** The wording that would have scored, if the marker gave one. */
const firstFix = (fixes, wanted) => str(fixes?.[0]) || str(wanted) || "";

/**
 * A pointer back to the question, normalised so a missing one is absent rather
 * than half-present. `{ quiz_id: undefined }` reads as a source in every
 * truthiness check and is not one.
 */
function sourceRef(source) {
    const quizId = str(source?.quizId || source?.quiz_id);
    const idx = Number(source?.qIndex ?? source?.q_index);
    if (!quizId || !Number.isInteger(idx) || idx < 0) return null;
    return { quiz_id: quizId, q_index: idx };
}

/** Is this row one of the bank's? Used by the filtered view. */
export const isBankCard = (card) => card?.topic === BANK_TOPIC;

/**
 * Flashcards with the mistake bank taken out — what every DECK surface reads.
 *
 * ─── Why this has to exist ──────────────────────────────────────────────────
 * A banked mistake is a `flashcards` row, because that is how it gets an SM-2
 * schedule without a second scheduler. It is not a FLASHCARD in the sense the
 * rest of the app means: it has no deck the student built, its topic is the
 * constant "Mistake bank", its front asks for the fix to one dropped criterion,
 * and it belongs to /MistakeBank, which is where the ladder, the case gate and
 * the "am I actually fixing these" fraction live.
 *
 * Nothing filtered them out, so they leaked everywhere a flashcard is read: a
 * "Mistake bank" deck sat on the flashcard shelf beside Chemistry, its cards
 * counted toward due totals and retention, and the exam builder was willing to
 * ask an exam question made of one marker's note about a phrase.
 *
 * Applied at the READ, per surface, rather than inside the shim: /MistakeBank
 * and the Quizzes hero genuinely want these rows, and a global exclusion with
 * an opt-out is the kind of magic that silently empties a screen later. An
 * explicit call at each site is greppable, which this bug proves is worth more
 * than the brevity.
 */
export const deckCards = (cards = []) =>
    (Array.isArray(cards) ? cards.filter((c) => !isBankCard(c)) : []);

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
 * How long a gap, on top of the whole ladder, before the rehearsal counts.
 *
 * A week. One clean recall the day after banking something is short-term
 * memory, and calling that fixed is the flattery the rank system exists to
 * refuse — a student told they have fixed something they have not is being set
 * up for the SAC. The interval is that claim from the scheduler's side: it
 * only pushes a card a week out once the card has earned it.
 */
const FIXED_INTERVAL_DAYS = 7;

/**
 * Where a mistake is up to. Four states, because "not started" and "still
 * getting it wrong" are different things and lumping them together hides the
 * only one that needs action today.
 */
/**
 * Has the card been through the whole drill ladder? Rehearsal only — not the
 * same as fixed, which also needs the question earned back.
 *
 * ─── Why `repetitions` and not the consecutive counters ─────────────────────
 * This used to ask for two consecutive good recalls, which was wrong twice.
 *
 * It did not mean what it said. SM-2 keeps `consecutive_good` and
 * `consecutive_easy` as separate streaks and each rating RESETS the other, so
 * a student who rated a card Good and then Easy — two clean recalls in a row,
 * the second better than the first — was sitting on a maximum streak of one
 * and could never finish. Rating a mistake honestly should never hold it back.
 *
 * And it could be satisfied without climbing the ladder. Two clean recalls
 * puts a card on the SECOND rung; a mistake could be called rehearsed having
 * never been asked to spot the error in its own sentence or rewrite it.
 * "Pass all the modules" has to mean passing all the modules.
 *
 * `repetitions` is the counter the RUNGS are read off, so this now agrees with
 * the ladder by construction — and SM-2 increments it on any clean recall and
 * resets it on a lapse, which is exactly the quantity meant all along.
 */
export function ladderDone(card) {
    return (Number(card?.repetitions) || 0) >= LADDER_COMPLETE_AT
        && (card?.interval_days || 0) >= FIXED_INTERVAL_DAYS;
}

/**
 * Did the student go back and actually earn this criterion?
 *
 * ─── Why rehearsal is not enough ────────────────────────────────────────────
 * Everything above this line measures whether a student can RECALL what the
 * assessor wanted, on a card, in isolation, after being reminded of it four
 * times. That is worth measuring and it is not what a SAC asks. The rehearsal
 * ladder ends one step short of the only evidence that settles it: writing the
 * thing again, in the question it went wrong in, and having it marked.
 *
 * So a mistake is cleared when a LATER attempt at its own question records
 * this criterion as earned. Later than the banking, because an attempt from
 * before the mistake existed cannot be evidence that it is gone.
 *
 * ─── The match refuses rather than guesses ──────────────────────────────────
 * Criterion text is written by the model afresh on each marking, so the same
 * criterion comes back reworded. Exact match, then containment of at least
 * twelve characters — the same shape of rule `criterionIndexFor` uses in
 * quizMarking, and for the same reason: crediting a student with fixing
 * something they did not fix is the one error this whole screen exists to
 * refuse. Unmatched simply means not yet cleared, which is safe and visible.
 */
export function clearedBy(card, attempts = []) {
    const { criterion, source, bankedAt } = mistakeMeta(card);
    if (!source || !criterion) return null;
    const want = key(criterion);
    if (!want) return null;
    const since = Date.parse(bankedAt) || 0;

    for (const a of attempts) {
        if (a?.quiz_id !== source.quizId) continue;
        const when = Date.parse(a.date || a.created_date || "") || 0;
        // Same-day re-sits are allowed: `date` is a plain date on these rows,
        // so requiring strictly later would discard the most common case —
        // marking a quiz and immediately redoing the question.
        if (when && since && when < since - DAY) continue;
        const results = Array.isArray(a?.extra?.question_results) ? a.extra.question_results : [];
        const r = results.find((x) => x?.q_index === source.qIndex);
        if (!r) continue;
        const got = (Array.isArray(r.criteria) ? r.criteria : [])
            .filter((c) => c?.got).map((c) => key(c.text)).filter(Boolean);
        if (got.some((g) => g === want || contains(g, want))) {
            return { at: a.date || a.created_date || null, full: r.marks >= r.marks_max };
        }
    }
    return null;
}

const DAY = 86400000;
const key = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
/** One criterion says the other, in enough words to be sure of it. */
const contains = (a, b) =>
    (a.length >= 12 && b.includes(a)) || (b.length >= 12 && a.includes(b));

/**
 * Where a mistake is up to. FIVE states, because "rehearsed but never re-sat"
 * is a real place to be and calling it fixed is the flattery this screen
 * exists to refuse — while calling it "working" hides that there is exactly
 * one thing left to do about it.
 *
 * `attempts` is optional. Without it the redo gate cannot be evaluated, so the
 * function reports the ladder alone and a caller that has no attempt history
 * behaves exactly as it did before the gate existed.
 */
export function fixState(card, attempts) {
    if (!card) return "new";
    const reviews = (card.review_count_again || 0) + (card.review_count_hard || 0)
        + (card.review_count_good || 0) + (card.review_count_easy || 0);
    const done = ladderDone(card);

    if (done) {
        // No attempts to check against, or a card banked before the gate
        // existed and carrying no source: the ladder is all the evidence there
        // will ever be, so it stands. Holding those cards at "drilled" forever
        // would be marking a student down for when they banked something.
        if (!attempts) return "fixed";
        const { source } = mistakeMeta(card);
        if (!source) return "fixed";
        return clearedBy(card, attempts) ? "fixed" : "drilled";
    }

    if (reviews === 0) return "new";
    // Their most recent answer is what "still" means. A card with four early
    // lapses that they have since recalled twice is going the right way, and
    // filing it under slipping would be reporting history as news.
    if (card.last_quality != null && card.last_quality <= 2) return "slipping";
    return "working";
}

export const FIX_STATES = ["slipping", "new", "working", "drilled", "fixed"];

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
    const src = m?.source;
    return {
        kind: m?.kind === "note" ? "note" : "criterion",
        // Older cards carry no topic of their own; the question they came from
        // is the next best label and is never worse than "No topic".
        topic: str(m?.topic) || str(m?.question_title),
        criterion: str(m?.criterion),
        quote: str(m?.quote),
        wanted: str(m?.wanted),
        questionTitle: str(m?.question_title),
        cost: Number(m?.cost) > 0 ? Number(m.cost) : 0,
        lost: m?.lost !== false,
        // Absent on every card banked before the redo gate existed. Those
        // cards still drill and still count; they simply cannot be closed by
        // re-sitting anything, which `fixState` handles rather than leaving
        // them stuck one rung from the end forever.
        source: str(src?.quiz_id) && Number.isInteger(src?.q_index)
            ? { quizId: str(src.quiz_id), qIndex: src.q_index } : null,
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
export function repeatOffenders(cards = [], { min = 2, attempts } = {}) {
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
            fixed: g.cards.every((c) => fixState(c, attempts) === "fixed"),
            // How many are still open, so a partly-fixed repeat says so. "3×"
            // on a criterion the student has already nailed twice is history
            // reported as news, and it is the same error `fixState` refuses to
            // make about a single card.
            open: g.cards.filter((c) => fixState(c, attempts) !== "fixed").length,
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
/**
 * Retired: mastered, and cleared out of the bank by the student.
 *
 * ─── Why this is not a delete ───────────────────────────────────────────────
 * `retired_at` is the field /Review already uses for "I know this", and its
 * reasoning holds exactly here: the only other exit from a review queue is
 * `is_active: false`, which destroys the card — so a student who has genuinely
 * fixed a mistake had to choose between being asked about it forever and
 * losing it before revision week. Retiring keeps the card, takes it out of
 * every queue in the app (due.js reports it as `known` before it checks
 * anything else), and is one field to undo.
 *
 * It is also why clearing the bank is safe to offer casually. An action that
 * cannot be taken back has to be defended with a confirmation dialog, and a
 * confirmation dialog on a routine action is how students learn to click
 * through them.
 */
export const isRetired = (card) => !!card?.retired_at;

export function bankSummary(cards = [], isReady = () => false, attempts) {
    const all = cards.filter(isBankCard);
    // The WORKING SET. A retired mistake is not outstanding and not a card in
    // the pile; it is history, and counting it in either would mean the two
    // numbers on the headline never move when a student clears one.
    const mine = all.filter((c) => !isRetired(c));
    const cleared = all.filter(isRetired);
    const counts = { slipping: 0, new: 0, working: 0, drilled: 0, fixed: 0 };
    const subjects = new Map();

    for (const card of mine) {
        const state = fixState(card, attempts);
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
        all,
        cleared,
        // Lifetime, so the achievement survives clearing the pile. A student
        // who has fixed and cleared fourteen should not be shown a bank that
        // says zero of zero.
        clearedCount: cleared.length,
        total: mine.length,
        ...counts,
        // Everything that is not yet fixed is still costing marks.
        outstanding: mine.length - counts.fixed,
        // Rehearsed to the end of the ladder and waiting on one thing: sitting
        // the question again. Surfaced separately because it is the shortest
        // path to a number going up that the student has.
        awaitingRedo: counts.drilled,
        ready: mine.filter(isReady).length,
        subjects: [...subjects.values()].sort((a, b) => b.total - a.total),
        repeats: repeatOffenders(mine, { min: 2, attempts }),
    };
}

// ─── Cases: the mistakes from one question, and when it is done with ────────

/**
 * A CASE is one question and everything you got wrong on it.
 *
 * ─── Why the question is the unit ───────────────────────────────────────────
 * A dropped criterion is the right size to DRILL and the wrong size to
 * finish on. Three criteria from one question are three cards that rehearse
 * separately and then have to come back together, because the thing that
 * proves you have them is the question, whole, marked — not three cards in a
 * row on a Tuesday.
 *
 * So the two levels are honest about different things:
 *
 *   A MISTAKE is fixed when it has cleared the ladder AND its own criterion
 *   was earned on a later sit. That is proof about that one criterion.
 *
 *   A CASE is closed when every mistake on it is fixed AND a later sit scored
 *   FULL MARKS. Full marks is the only evidence that nothing was traded — a
 *   student can earn the criterion they drilled while dropping a different one
 *   in the same answer, and calling that finished would be the flattery this
 *   screen refuses.
 *
 * Mistakes with no source question form no case. They are still drilled and
 * still counted; there is simply nothing to re-sit them in.
 */
export function casesFor(cards = [], attempts = [], quizzes = []) {
    const byQuiz = new Map(quizzes.map((q) => [q.id, q]));
    const groups = new Map();

    for (const card of cards.filter(isBankCard)) {
        const meta = mistakeMeta(card);
        if (!meta.source) continue;
        const k = `${meta.source.quizId}:${meta.source.qIndex}`;
        if (!groups.has(k)) {
            const quiz = byQuiz.get(meta.source.quizId) || null;
            groups.set(k, {
                key: k,
                quizId: meta.source.quizId,
                qIndex: meta.source.qIndex,
                quiz,
                question: quiz?.questions?.[meta.source.qIndex] || null,
                title: quiz?.title || meta.questionTitle,
                subject: card.subject_name || quiz?.subject || null,
                cards: [],
            });
        }
        groups.get(k).cards.push(card);
    }

    return [...groups.values()].map((g) => {
        const states = g.cards.map((c) => fixState(c, attempts));
        const allFixed = states.every((st) => st === "fixed");
        const full = fullMarksSince(g, attempts);
        return {
            ...g,
            states,
            total: g.cards.length,
            fixed: states.filter((st) => st === "fixed").length,
            // Everything rehearsed, nothing left but sitting it again.
            readyToRedo: g.cards.length > 0 && states.every((st) => st === "fixed" || st === "drilled"),
            fullMarks: !!full,
            closed: allFixed && !!full,
        };
    }).sort((a, b) => (a.closed === b.closed ? b.total - a.total : a.closed ? 1 : -1));
}

/** A later sit of this exact question that scored everything available. */
function fullMarksSince(group, attempts = []) {
    const earliest = group.cards.reduce((min, c) => {
        const t = Date.parse(mistakeMeta(c).bankedAt) || 0;
        return min === 0 || (t && t < min) ? t : min;
    }, 0);
    for (const a of attempts) {
        if (a?.quiz_id !== group.quizId) continue;
        const when = Date.parse(a.date || a.created_date || "") || 0;
        if (when && earliest && when < earliest - DAY) continue;
        const results = Array.isArray(a?.extra?.question_results) ? a.extra.question_results : [];
        const r = results.find((x) => x?.q_index === group.qIndex);
        if (!r || r.marks == null || r.marks_max == null) continue;
        if (r.marks >= r.marks_max) return { at: a.date || a.created_date || null };
    }
    return null;
}

// ─── Grouping: subject, then topic ──────────────────────────────────────────

/**
 * The bank as a shelf: subject → topic → mistakes.
 *
 * ─── Why two levels and not one ─────────────────────────────────────────────
 * A flat list of thirty mistakes is a list nobody reads to the end of, and its
 * only order is "worst first" — which is right for deciding what to do next
 * and wrong for the other thing a student does here, which is sit down to work
 * on ONE subject before a SAC. Subject is the unit they think in; topic is the
 * unit the assessment is set on.
 *
 * Every level counts what is READY, because that is what its button will play.
 * A group offering "Review 6" that turns out to be one card due and five
 * scheduled for next week is the kind of small lie that costs a screen its
 * credibility.
 *
 * TOPIC IS NOT THE CARD'S `topic` FIELD. That is the constant "Mistake bank",
 * which it must be — the review shelf keys decks on subject|topic|unit, so a
 * real topic there would split one student's bank into a deck per quiz. The
 * grouping label lives in `extra.mistake.topic`.
 */
export function groupBank(cards = [], { isReady = () => false, attempts } = {}) {
    const bySubject = new Map();

    for (const card of cards.filter(isBankCard)) {
        if (isRetired(card)) continue;
        const meta = mistakeMeta(card);
        const subject = card.subject_name || "No subject";
        const topic = meta.topic || "No topic";

        if (!bySubject.has(subject)) {
            bySubject.set(subject, { subject, cards: [], ready: 0, fixed: 0, topics: new Map() });
        }
        const s = bySubject.get(subject);
        if (!s.topics.has(topic)) {
            s.topics.set(topic, { topic, subject, cards: [], ready: 0, fixed: 0 });
        }
        const t = s.topics.get(topic);

        const ready = isReady(card);
        const fixed = fixState(card, attempts) === "fixed";
        for (const bucket of [s, t]) {
            bucket.cards.push(card);
            if (ready) bucket.ready += 1;
            if (fixed) bucket.fixed += 1;
        }
    }

    return [...bySubject.values()]
        .map((s) => ({
            ...s,
            total: s.cards.length,
            // Most still to do first, at both levels: this list is a work
            // queue, and a subject with nothing left in it does not get to sit
            // at the top of one.
            topics: [...s.topics.values()]
                .map((t) => ({ ...t, total: t.cards.length, outstanding: t.cards.length - t.fixed }))
                .sort((a, b) => (b.outstanding - a.outstanding) || a.topic.localeCompare(b.topic)),
            outstanding: s.cards.length - s.fixed,
        }))
        .sort((a, b) => (b.outstanding - a.outstanding) || a.subject.localeCompare(b.subject));
}

/**
 * The fields to write when a student clears a mastered mistake, and to undo it.
 *
 * Returned rather than written, the same shape `due.js` uses, so this file
 * stays free of round trips and the caller owns the failure case.
 */
export const retireMistake = (now = new Date().toISOString()) => ({ retired_at: now });
export const restoreMistake = () => ({ retired_at: null });
