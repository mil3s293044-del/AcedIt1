/**
 * quizSit — one sit of a quiz, from the shelf to the scored hand.
 *
 * The journey is four screens (the shelf, the table before a sit, the sit,
 * the results) and every one of them printed a number about the quiz. They
 * worked those numbers out for themselves and disagreed in front of a student:
 *
 *   - THE RESULTS MIXED UNITS. The headline was 71% of MARKS, and directly
 *     under it "2 right · 4 total" counted QUESTIONS. Marks are the currency on
 *     every other surface (quizScore.js), so a four-mark question half done is
 *     two marks, not "wrong".
 *   - TWO COUNTS OF ONE THING. "You lost marks on 2 questions" sat beside a
 *     button reading "Redo the 1 you missed". Both were true, of different
 *     predicates, and nothing on screen said which was which.
 *   - THE SAC ALLOWANCE HAND-ROLLED ITS MARKS as `Number(q.marks) || 1`, which
 *     reads a multipart question worth nine as one mark and a written answer
 *     with no stored allocation as one mark — the `q.marks || 5` bug this
 *     codebase has fixed four times, in its fifth place.
 *   - "NEXT QUIZ" WAS THE FIRST ROW. `quizzes[0]`, with a sentence about active
 *     recall under it, whatever the student had or had not sat.
 *
 * So this is the arithmetic for the whole journey, pure, so a test can hold it.
 * Everything is derived from rows the page already loads; nothing is stored.
 */
import { normaliseQuestion } from "@/lib/quizSchema";
import { needsDrill } from "@/lib/quizScore";
import { effectiveScore } from "@/lib/quizDeck";
import { isRetryAttempt } from "@/lib/quizInsight";
import { MINUTES_PER_MARK, roundMinutes } from "@/lib/quizSetup";
import { rankFor, RANKS } from "@/components/cards/cardIdentity";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const stampOf = (a) => new Date(a?.created_date || a?.date || 0).getTime() || 0;

/* ── The paper ────────────────────────────────────────────────────────────── */

/** A timed SAC never runs shorter than this, however small the paper. */
export const SAC_MIN_MINUTES = 15;

/**
 * What is on the paper: how many questions, how many marks, and roughly how
 * long it takes. Marks come through `normaliseQuestion`, the one allocation —
 * a multipart question is the sum of its parts and an MCQ is one.
 *
 * `minutes` is the estimate printed before a sit, rounded the way the
 * generator's own footer rounds it, so the paper a student was promised in the
 * dialog and the paper on the table read the same. `sacMinutes` is the clock a
 * timed sit starts on: VCAA's working rate, unrounded, with a floor.
 */
export function paperFacts(quiz) {
    const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
    let marks = 0, mcq = 0, written = 0, multipart = 0;
    questions.forEach((q, i) => {
        const shape = normaliseQuestion(q, i);
        marks += shape.marks;
        if (shape.multipart) multipart += 1;
        else if (q?.type === "mcq") mcq += 1;
        else written += 1;
    });
    return {
        questions: questions.length,
        marks,
        mcq,
        written,
        multipart,
        minutes: marks > 0 ? roundMinutes(marks * MINUTES_PER_MARK) : 0,
        sacMinutes: Math.max(SAC_MIN_MINUTES, Math.ceil(marks * MINUTES_PER_MARK)),
    };
}

/* ── A quiz's history ─────────────────────────────────────────────────────── */

/** Whole local days between two instants — a sit at 11pm was "yesterday" at 1am. */
export function daysBetween(from, to = Date.now()) {
    const a = new Date(from); const b = new Date(to);
    if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return null;
    a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 86400000);
}

/** "today", "yesterday", "3 days ago". */
export function agoLabel(days) {
    if (!isNum(days)) return null;
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    return `${days} days ago`;
}

/**
 * One quiz's sits. A "wrong only" retry counts as a TRY and never as a SIT —
 * the split every reader of this data keeps — so it is in `tries` and nowhere
 * else. `best` is NULL for a quiz never sat, which the deck face draws as a two
 * and the table says in words; it is never 0.
 */
export function sitHistory(quiz, attempts = [], now = Date.now()) {
    const mine = (Array.isArray(attempts) ? attempts : []).filter((a) => a?.quiz_id === quiz?.id);
    const sits = mine.filter((a) => !isRetryAttempt(a)).sort((a, b) => stampOf(b) - stampOf(a));
    const scored = sits.filter((a) => isNum(effectiveScore(a)));
    const best = scored.length ? Math.max(...scored.map(effectiveScore)) : null;
    const lastRow = scored[0] || null;
    return {
        tries: mine.length,
        sits: sits.length,
        best,
        last: lastRow ? {
            score: Math.round(effectiveScore(lastRow)),
            days: daysBetween(lastRow.created_date || lastRow.date, now),
        } : null,
        // The rank on the deck face: your best, or a two for a quiz never sat.
        rank: rankFor(best ?? 0),
    };
}

/* ── The one next sit ─────────────────────────────────────────────────────── */

/** Under this, the last sit is worth running back. */
export const LOW_SCORE = 60;
/** A quiz last sat this long ago is due another go. */
export const STALE_DAYS = 7;

/**
 * Which quiz to sit next, and the fact that chose it — a reason a student can
 * check against the deck face, never a slogan.
 *
 *   low     the last sit was under LOW_SCORE, at least a day ago. Not the same
 *           day: running a paper straight back is rehearsing the answers you
 *           just saw, and the results screen already offered the questions
 *           missed.
 *   new     a quiz nobody has sat, newest first — material that has never been
 *           tested at all.
 *   stale   the last sit was STALE_DAYS or more ago, the longest first.
 *   lowest  otherwise, the lowest last sit.
 *
 * Null when there is nothing with questions in it to sit.
 */
export function nextSit(quizzes = [], attempts = [], now = Date.now()) {
    const rows = (Array.isArray(quizzes) ? quizzes : [])
        .filter((q) => Array.isArray(q?.questions) && q.questions.length > 0)
        .map((quiz) => ({ quiz, h: sitHistory(quiz, attempts, now) }));
    if (!rows.length) return null;

    const pick = (reason, list, order) => {
        if (!list.length) return null;
        const { quiz, h } = [...list].sort(order)[0];
        return { quiz, reason, score: h.last?.score ?? null, days: h.last?.days ?? null, best: h.best };
    };

    return pick("low", rows.filter(({ h }) => h.last && h.last.score < LOW_SCORE && h.last.days >= 1),
        (a, b) => a.h.last.score - b.h.last.score)
        || pick("new", rows.filter(({ h }) => h.sits === 0),
            (a, b) => stampOf(b.quiz) - stampOf(a.quiz))
        || pick("stale", rows.filter(({ h }) => h.last && h.last.days >= STALE_DAYS),
            (a, b) => b.h.last.days - a.h.last.days)
        || pick("lowest", rows.filter(({ h }) => h.last),
            (a, b) => a.h.last.score - b.h.last.score)
        // Sat, but never scored (every marking failed): still a sit to offer.
        || pick("new", rows, (a, b) => stampOf(b.quiz) - stampOf(a.quiz));
}

/** The reason, in words. Every figure in it is on the deck face too. */
export function nextSitLine(next) {
    if (!next) return null;
    const when = agoLabel(next.days);
    if (next.reason === "low") return `Last sat ${when} at ${next.score}%.`;
    if (next.reason === "new") return "You have not sat this one yet.";
    if (next.reason === "stale") return `Last sat ${when}, at ${next.score}%.`;
    if (next.reason === "lowest") return `Your lowest last sit, at ${next.score}%.`;
    return null;
}

/* ── The scored hand ──────────────────────────────────────────────────────── */

/**
 * One question's card in the hand.
 *
 *   full     every mark
 *   part     dropped a mark or two, at or above the drill line
 *   missed   under the drill line — exactly the questions "Redo" re-asks,
 *            because it is `needsDrill`, not a second threshold
 *   pending  written work the marker has not returned (still marking, or the
 *            marking failed) — neither right nor wrong
 *
 * So "lost marks on N" is part + missed and "redo N" is missed, and the hand
 * shows both: the student can see which cards each sentence counted.
 */
export function cardState(question, mark, marked) {
    if (!marked || !mark || !(mark.outOf > 0)) return "pending";
    if (mark.auto >= mark.outOf) return "full";
    if (needsDrill(question, mark)) return "missed";
    return "part";
}

/**
 * The hand. `markAt(i)` is the question's mark (quizScore's `questionMark`
 * shape); `isMarked(i)` says whether that mark is known yet — an MCQ is known
 * the moment it is answered, written work when the marker returns.
 */
export function handOf(questions = [], markAt, isMarked) {
    return (Array.isArray(questions) ? questions : []).map((q, i) => {
        const mark = typeof markAt === "function" ? markAt(i) : null;
        const marked = typeof isMarked === "function" ? !!isMarked(i) : !!mark;
        const state = cardState(q, mark, marked);
        return {
            index: i,
            outOf: mark?.outOf ?? normaliseQuestion(q, i).marks,
            auto: state === "pending" ? null : mark.auto,
            state,
        };
    });
}

/**
 * The headline, in MARKS. Over the cards that are marked: a written answer
 * still with the marker is not zero, and a percentage that counts it as zero
 * is a claim about work nobody has read. `pct` is null when nothing is marked.
 *
 * When every card is marked this is exactly `attemptScore(...).autoPct`, the
 * number that is saved and paid XP on; when the marking failed it is exactly
 * the MCQ-only fallback the player saves instead. The test holds both.
 */
export function handTotal(hand = []) {
    let awarded = 0, outOf = 0, pendingMarks = 0;
    let lost = 0, missed = 0, full = 0, pending = 0;
    for (const c of hand) {
        if (c.state === "pending") { pending += 1; pendingMarks += c.outOf; continue; }
        awarded += c.auto;
        outOf += c.outOf;
        if (c.state === "full") full += 1;
        if (c.state === "part" || c.state === "missed") lost += 1;
        if (c.state === "missed") missed += 1;
    }
    return {
        awarded, outOf, pendingMarks,
        pct: outOf > 0 ? Math.round((awarded / outOf) * 100) : null,
        full, lost, missed, pending,
    };
}

/**
 * The total as it stands while the cards turn: only a card that has finished
 * turning adds, so the count-up IS the cards being added rather than a number
 * animating on its own. A pending card adds nothing even if it is somehow in
 * `turned`. With every marked card turned it lands exactly on the headline.
 */
export function marksShown(hand = [], turned = new Set()) {
    return hand.reduce((sum, c) =>
        sum + (c.state !== "pending" && turned.has(c.index) ? c.auto : 0), 0);
}

/* ── The deck face turning ────────────────────────────────────────────────── */

/**
 * Whether this sit changes the quiz's card on the shelf.
 *
 * RANK IS YOUR BEST SCORE (QuizDeck's contract), so the face only moves when a
 * sit beats the best — and then only if the new best is a different card. A
 * first sit turns the two a never-sat quiz shows into whatever it earned. A
 * retry never moves it: it is not a measurement of the quiz.
 *
 * Null when nothing changed, so the results screen draws nothing rather than a
 * "no change" it would have to explain.
 */
export function rankTurn({ previousBest = null, score = null, isRetry = false } = {}) {
    if (isRetry || !isNum(score)) return null;
    const first = !isNum(previousBest);
    if (!first && score <= previousBest) return null;
    const from = rankFor(first ? 0 : previousBest);
    const to = rankFor(score);
    return {
        first,
        from,
        to,
        // The card itself only turns when the rank moved. A new best on the
        // same card is still a new best, and is said in words.
        turned: RANKS.indexOf(to) > RANKS.indexOf(from),
    };
}

/* ── The reveal ───────────────────────────────────────────────────────────── */

/**
 * When each card of the hand lands and turns, in seconds. Dealt fast and
 * turned one at a time, but CAPPED: a thirty-question paper must not hold a
 * student for six seconds of card turns before they can read their mark. The
 * stagger shrinks as the hand grows so the whole reveal stays inside the cap.
 */
export const HAND = { dealGap: 0.05, dealCap: 0.5, turnStart: 0.55, turnGap: 0.16, turnCap: 1.6, turn: 0.42 };

export function handTiming(n) {
    const count = Math.max(0, Number(n) || 0);
    const dealGap = count > 1 ? Math.min(HAND.dealGap, HAND.dealCap / (count - 1)) : 0;
    const turnGap = count > 1 ? Math.min(HAND.turnGap, HAND.turnCap / (count - 1)) : 0;
    const dealAt = (i) => +(i * dealGap).toFixed(3);
    const turnAt = (i) => +(HAND.turnStart + i * turnGap).toFixed(3);
    return {
        dealAt,
        turnAt,
        // When the last card is face up — the total settles and the deck card
        // may turn after it.
        doneAt: count ? +(turnAt(count - 1) + HAND.turn).toFixed(3) : 0,
    };
}

export default {
    SAC_MIN_MINUTES, paperFacts, daysBetween, agoLabel, sitHistory,
    LOW_SCORE, STALE_DAYS, nextSit, nextSitLine,
    cardState, handOf, handTotal, marksShown, rankTurn, HAND, handTiming,
};
