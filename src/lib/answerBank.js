/**
 * answerBank — the answers worth learning, kept somewhere they come back.
 *
 * ─── The other half of the mistake bank ─────────────────────────────────────
 * The mistake bank keeps what cost a mark, and drills the FIX. That is half of
 * revision. The other half is the answer that scored everything: a four-mark
 * "explain" that hit every criterion, a definition worded exactly the way the
 * assessor wanted, the model answer to a question a student keeps half-getting.
 * A student revising for a SAC wants those IN THEIR HEAD, worded that way, and
 * the app had nowhere to put them but a read-only list on the Quizzes page.
 *
 * ─── Why this is a flashcard row ─────────────────────────────────────────────
 * The same reason a mistake is (mistakeBank.js's header): the single most
 * useful thing to do with an answer you want to keep is be asked for it again a
 * few days later. SM-2 over `flashcards` already does that, so a saved answer
 * IS a flashcard row with a marker on it — `topic: "Answer bank"`, constant for
 * the reason the bank's topic is constant — and `deckCards` takes it out of
 * every DECK surface. It is not a flashcard a student built; it is a response.
 *
 * ─── The ladder: recall, not recognition ────────────────────────────────────
 * A two-sided card would show the answer and ask "did you know it". That is
 * recognition, the illusion this app argues against everywhere else. So an
 * answer gets harder as the student gets it right, the way a mistake does:
 *
 *   READ     the question, the answer, and what earned the marks. Nothing to
 *            retrieve yet.
 *   FILL     the answer with the words the marks turned on taken out, and those
 *            words as the bank. The cloze builder the mistake bank already uses.
 *   REBUILD  every word as its first letter. Type the answer back. The cue is
 *            just enough to pull the wording rather than the gist.
 *   WRITE    the question alone. Write it. Checked against the words that
 *            earned the marks — a check the student can read line by line,
 *            never a verdict from nowhere.
 *
 * The rung is read off `repetitions`, the counter SM-2 already maintains, so
 * nothing new is stored and a lapse drops the answer back down WITH the
 * scheduler. A rung that cannot be built for this answer — no blankable terms,
 * an answer that is mostly maths — is skipped, and the skip cascades.
 */
import { keyTerms, buildCloze, suggestRating } from "@/lib/drill";
import { calculateNextReview, reviewPatch } from "@/lib/sm2";

/** The marker. Also what a student reads on a card that slips through somewhere. */
export const ANSWER_TOPIC = "Answer bank";

export const isAnswerCard = (card) => card?.topic === ANSWER_TOPIC;
export const isRetiredAnswer = (card) => !!card?.retired_at;

const str = (v) => String(v ?? "").trim();
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim();

/** Normalised so a pointer with a missing half is absent, never half-present. */
function sourceRef(source) {
    const quizId = str(source?.quizId || source?.quiz_id);
    const idx = Number(source?.qIndex ?? source?.q_index);
    if (!quizId || !Number.isInteger(idx) || idx < 0) return null;
    return { quiz_id: quizId, q_index: idx };
}

/**
 * A flashcard row from an answer worth keeping, or null when there is nothing
 * to keep.
 *
 * `kind` is WHOSE answer it is, and it is the most important field here:
 *   own    the student's own answer, and it scored everything available. Their
 *          words, proven on a marked paper — the best possible thing to learn.
 *   model  the marker's model answer, for a question they did not score in
 *          full. Somebody else's words, and the card says so, because learning
 *          a model answer is a different act from keeping your own.
 *
 * An `own` answer that did NOT score full marks is saved as nothing. Rehearsing
 * a response that lost marks rehearses the loss; the mistake bank is where that
 * answer belongs, and the model answer is what to learn instead.
 */
export function cardFromAnswer({
    question, answer, kind = "model", subject, topic, marks, outOf, criteria = [], source, why,
} = {}) {
    const q = str(question);
    const a = str(answer);
    if (!q || !a || a === "—") return null;
    const own = kind === "own";
    const m = Number(marks);
    const o = Number(outOf);
    if (own && !(Number.isFinite(m) && Number.isFinite(o) && o > 0 && m >= o)) return null;

    return {
        subject_name: subject || null,
        topic: ANSWER_TOPIC,
        // CONSTANT, for the same reason the mistake bank's is: the review shelf
        // keys decks on subject|topic|unit, and a real topic here would split
        // the bank into a deck per quiz the day something stopped filtering it.
        unit: ANSWER_TOPIC,
        question: q,
        answer: a,
        is_active: true,
        is_weak_spot: false,
        extra: {
            exemplar: {
                kind: own ? "own" : "model",
                // The grouping label. Never the card's `topic`, which is constant.
                topic: str(topic).slice(0, 80),
                question: q,
                marks: Number.isFinite(m) ? m : null,
                out_of: Number.isFinite(o) && o > 0 ? o : null,
                // What the answer EARNED. This is what the fill rung blanks
                // against and what the write rung checks for, so a saved answer
                // with its criteria is drilled on exactly the words that scored.
                criteria: (Array.isArray(criteria) ? criteria : []).map(str).filter(Boolean).slice(0, 12),
                why: str(why),
                source: sourceRef(source),
                saved_at: new Date().toISOString(),
            },
        },
    };
}

/** Provenance, defaulted, so a row with none still reads. */
export function exemplarMeta(card) {
    const e = card?.extra?.exemplar || {};
    const src = e.source;
    return {
        // Three, and the third exists only for answers moved in from the old
        // saved-answers list with no model answer: theirs, and never marked.
        kind: e.kind === "own" ? "own" : e.kind === "yours_unmarked" ? "yours_unmarked" : "model",
        topic: str(e.topic),
        question: str(e.question) || str(card?.question),
        answer: str(card?.answer),
        marks: Number.isFinite(Number(e.marks)) && e.marks !== null ? Number(e.marks) : null,
        outOf: Number(e.out_of) > 0 ? Number(e.out_of) : null,
        criteria: Array.isArray(e.criteria) ? e.criteria.map(str).filter(Boolean) : [],
        why: str(e.why),
        source: str(src?.quiz_id) && Number.isInteger(src?.q_index)
            ? { quizId: str(src.quiz_id), qIndex: src.q_index } : null,
        savedAt: str(e.saved_at) || str(card?.created_date),
    };
}

/**
 * Has this question already been saved? Keyed on the question it came from
 * when there is one (the question can be reworded in the editor; its place
 * cannot), and on the normalised question text otherwise.
 *
 * A RETIRED card still counts as saved — putting an answer away is "I know
 * this", and offering to save it again would put a second copy back in the
 * queue it was just taken out of.
 */
export function answerSaved(cards = [], { quizId, qIndex, question } = {}) {
    const want = norm(question);
    return cards.some((c) => {
        if (!isAnswerCard(c) || c?.is_active === false) return false;
        const m = exemplarMeta(c);
        if (quizId && Number.isInteger(qIndex) && m.source) {
            return m.source.quizId === quizId && m.source.qIndex === qIndex;
        }
        return !!want && norm(m.question) === want;
    });
}

// ─── The ladder ─────────────────────────────────────────────────────────────

/** The labels are the ASK, not the technique. */
export const ANSWER_LADDER = [
    { id: "read",    label: "Read it",    blurb: "Read it through, and what earned the marks." },
    { id: "fill",    label: "Fill it",    blurb: "Put back the words the marks turned on." },
    { id: "rebuild", label: "Rebuild it", blurb: "Every word is its first letter. Write it back." },
    { id: "write",   label: "Write it",   blurb: "Just the question. Write the answer." },
];

/** Good recalls before the rung goes up — the mistake ladder's own cadence. */
const FILL_AFTER = 1;
const REBUILD_AFTER = 2;
const WRITE_AFTER = 4;

/** The count at which every rung has been passed. */
export const LEARNED_AT = WRITE_AFTER + 1;

/**
 * A week, on top of the whole ladder. One clean write the day after reading it
 * is short-term memory; calling that learned is the flattery the mistake bank's
 * FIXED_INTERVAL_DAYS refuses, for the same reason.
 */
export const LEARNED_INTERVAL_DAYS = 7;

/** Rebuilding a paragraph past this is copying out, not recall. */
export const REBUILD_MAX_WORDS = 120;
/** Under this there is nothing to rebuild that the fill rung did not ask. */
export const REBUILD_MIN_WORDS = 6;

const reps = (card) => Number(card?.repetitions) || 0;

/** Which rung the counter has reached, before the buildability check. */
export function answerStage(card) {
    const r = reps(card);
    if (r >= WRITE_AFTER) return "write";
    if (r >= REBUILD_AFTER) return "rebuild";
    if (r >= FILL_AFTER) return "fill";
    return "read";
}

export function answerLearned(card) {
    return reps(card) >= LEARNED_AT && (Number(card?.interval_days) || 0) >= LEARNED_INTERVAL_DAYS;
}

/**
 * Where an answer is up to. Four states, read off the scheduler:
 *   new         never drilled
 *   slipping    their LAST answer was a lapse — history is not news
 *   rehearsing  on the ladder
 *   learned     every rung, a week apart
 */
export function answerState(card) {
    if (!card) return "new";
    if (answerLearned(card)) return "learned";
    const reviews = (card.review_count_again || 0) + (card.review_count_hard || 0)
        + (card.review_count_good || 0) + (card.review_count_easy || 0) + (Number(card.total_reviews) || 0);
    if (!reviews && !reps(card)) return "new";
    if (card.last_quality != null && card.last_quality <= 2) return "slipping";
    return "rehearsing";
}

export const ANSWER_STATES = ["slipping", "new", "rehearsing", "learned"];

const wordsOf = (text) => String(text || "").split(/\s+/).filter(Boolean);
const hasMaths = (text) => /\$[^$]+\$|\\\(|\\\[|\\frac|\\sqrt/.test(String(text || ""));

/** How many gaps a fill gets: more for a longer answer, never more than five. */
export function blanksFor(answer) {
    const n = wordsOf(answer).length;
    return n <= 25 ? 3 : n <= 60 ? 4 : 5;
}

/** The words the marks turned on, for the fill and write rungs. */
const criteriaText = (card) => exemplarMeta(card).criteria.join(" ");

/** The fill-the-gaps exercise, or null. The mistake bank's builder, aimed at an answer. */
export function answerCloze(card) {
    if (!card?.answer) return null;
    const max = blanksFor(card.answer);
    return buildCloze(
        { id: card.id, answer: card.answer, extra: { mistake: { criterion: criteriaText(card) } } },
        { minBlanks: 2, maxBlanks: max },
    );
}

/**
 * The answer as first letters: every word kept as its opening character with
 * the rest drawn as a gap of the same length, punctuation as it was.
 *
 * Null when the rung cannot be built: too short to be worth it, too long to
 * be recall rather than transcription, or written in maths — a first-letter
 * skeleton of `\frac{dy}{dx}` is noise.
 */
export function rebuildOf(card) {
    const answer = str(card?.answer).split(/\n\s*or\s*\n/i)[0].trim();
    const words = wordsOf(answer);
    if (words.length < REBUILD_MIN_WORDS || words.length > REBUILD_MAX_WORDS) return null;
    if (hasMaths(answer)) return null;
    const cue = words.map((w) => {
        const m = w.match(/^([^A-Za-z0-9]*)([A-Za-z0-9])([A-Za-z0-9'’-]*)([^A-Za-z0-9]*)$/);
        if (!m) return { text: w, cue: w };
        const [, pre, first, rest, post] = m;
        return { text: w, cue: `${pre}${first}${"_".repeat(rest.length)}${post}` };
    });
    return { words: cue, total: words.length, answer };
}

/** A word's identity for matching: lower case, letters and digits only. */
const wordKey = (w) => String(w || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Which words of `want` the longest common subsequence keeps — the in-order
 * match, walked back so the screen can show WHICH words came back rather than
 * only how many. "18 of 30" with no indication of which is a mark with no
 * reason, the failure `gradeCloze` already refuses.
 */
function lcsMatch(want, got) {
    const m = want.length; const n = got.length;
    const t = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i -= 1) {
        for (let j = n - 1; j >= 0; j -= 1) {
            t[i][j] = want[i] === got[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
        }
    }
    const kept = new Array(m).fill(false);
    let i = 0; let j = 0;
    while (i < m && j < n) {
        if (want[i] === got[j]) { kept[i] = true; i += 1; j += 1; }
        else if (t[i + 1][j] >= t[i][j + 1]) i += 1;
        else j += 1;
    }
    return kept;
}

/**
 * How much of the wording came back, IN ORDER. Order matters because the point
 * of this rung is the wording, and the same words shuffled is the gist, which
 * the write rung asks for. Spelling of case and punctuation is not counted:
 * this is not a spelling test.
 *
 * `each` lines up with `rebuild.words`: true for a word that came back, false
 * for one that did not, null for a word that is only punctuation (a dash) and
 * so is neither.
 */
export function gradeRebuild(rebuild, typed = "") {
    if (!rebuild) return null;
    const keys = rebuild.words.map((w) => wordKey(w.text));
    const live = keys.map((k, i) => (k ? i : -1)).filter((i) => i >= 0);
    const want = live.map((i) => keys[i]);
    const got = String(typed || "").split(/\s+/).map(wordKey).filter(Boolean);
    const kept = lcsMatch(want, got);
    const each = keys.map(() => null);
    live.forEach((wi, k) => { each[wi] = kept[k]; });
    const right = kept.filter(Boolean).length;
    const total = want.length;
    const pct = total ? Math.round((right / total) * 100) : 0;
    return { right, total, pct, each, allRight: total > 0 && right / total >= 0.95 };
}

const tokens = (text) => norm(text).split(" ").filter(Boolean);

/**
 * The write rung: the question, and the terms the answer has to contain.
 * Always buildable while there is a question — with no terms to check for, the
 * student compares the two answers themselves, which is the honest fallback.
 */
export function writeOf(card) {
    const m = exemplarMeta(card);
    if (!m.question || !m.answer) return null;
    const n = wordsOf(m.answer).length;
    const max = n <= 25 ? 4 : n <= 60 ? 6 : 8;
    return { question: m.question, terms: keyTerms(m.answer, criteriaText(card), { max }) };
}

/** Which of the load-bearing terms made it into what they wrote. */
export function gradeWrite(write, typed = "") {
    if (!write) return null;
    const have = ` ${tokens(typed).join(" ")} `;
    const hit = []; const missed = [];
    for (const term of write.terms) {
        const t = tokens(term).join(" ");
        (t && have.includes(` ${t} `) ? hit : missed).push(term);
    }
    return { hit, missed, right: hit.length, total: write.terms.length, allRight: missed.length === 0 && hit.length > 0 };
}

/** The rating a result suggests. SUGGESTS — the student presses the button. */
export function suggestFrom(grade) {
    if (!grade) return null;
    if ("pct" in grade) {
        if (grade.pct >= 95) return 4;
        if (grade.pct >= 70) return 3;
        if (grade.pct >= 35) return 2;
        return 1;
    }
    return suggestRating(grade);
}

/**
 * What to put on the table for this card. One place decides, and the fallbacks
 * CASCADE: a rebuild rung with no rebuild falls to a fill, and a fill with
 * nothing blankable falls to a read. Checking one level down and stopping
 * leaves an empty exercise.
 */
export function answerDrillFor(card) {
    const stage = answerStage(card);
    if (stage === "write") {
        const write = writeOf(card);
        if (write) return { stage: "write", write };
    }
    if (stage === "write" || stage === "rebuild") {
        const rebuild = rebuildOf(card);
        if (rebuild) return { stage: "rebuild", rebuild };
    }
    if (stage !== "read") {
        const cloze = answerCloze(card);
        if (cloze) return { stage: "fill", cloze };
    }
    return { stage: "read" };
}

const STAGE_INDEX = Object.fromEntries(ANSWER_LADDER.map((s, i) => [s.id, i]));
const STAGE_LABEL = Object.fromEntries(ANSWER_LADDER.map((s) => [s.id, s.label]));

/**
 * The ladder as it will be drilled: skipped rungs struck through (and out of
 * the denominator), the rung the drill will SERVE lit as current. The same
 * shape `ladderFor` returns, so `LadderTrack` draws both.
 */
export function answerSteps(card) {
    const buildable = {
        read: true,
        fill: !!answerCloze(card),
        rebuild: !!rebuildOf(card),
        write: !!writeOf(card),
    };
    const learned = answerLearned(card);
    const at = STAGE_INDEX[answerDrillFor(card).stage];
    return ANSWER_LADDER.map((step, i) => {
        if (!buildable[step.id]) return { ...step, state: "skipped" };
        if (learned) return { ...step, state: "done" };
        return { ...step, state: i < at ? "done" : i === at ? "current" : "todo" };
    });
}

/** Where a card is, and how far off the next rung — `rungOf`'s shape. */
export function answerRung(card) {
    const steps = answerSteps(card);
    if (answerLearned(card)) {
        return { index: ANSWER_LADDER.length, id: "learned", label: "Learned", steps, next: null, needs: 0 };
    }
    const stage = answerDrillFor(card).stage;
    const index = STAGE_INDEX[stage];
    const r = reps(card);
    let next = null; let needs = 0;
    for (let k = r + 1; k <= LEARNED_AT; k += 1) {
        if (k >= LEARNED_AT) { next = "learned"; needs = k - r; break; }
        const ahead = answerDrillFor({ ...card, repetitions: k }).stage;
        if (STAGE_INDEX[ahead] > index) { next = STAGE_LABEL[ahead]; needs = k - r; break; }
    }
    return { index, id: stage, label: STAGE_LABEL[stage], steps, next, needs };
}

/** The card after a rating, through the one scheduler. */
export function answerAfter(card, quality) {
    const updates = calculateNextReview(quality, card);
    return { ...card, ...reviewPatch(updates, quality), total_reviews: (card.total_reviews || 0) + 1 };
}

/**
 * What one rating did to one answer, in the mistake run's vocabulary so one
 * run can carry both: climbed, closer, held, slipped — and `learned` where a
 * mistake would be `fixed`.
 */
export function answerMoveOf(before, after) {
    const a = answerRung(before);
    const b = answerRung(after);
    const rb = reps(before);
    const ra = reps(after);
    let kind;
    if (answerLearned(after) && !answerLearned(before)) kind = "learned";
    else if (ra < rb) kind = "slipped";
    else if (ra > rb) kind = b.index > a.index ? "climbed" : "closer";
    else kind = "held";
    return { id: before.id, kind, from: a.label, to: b.label, fromIndex: a.index, toIndex: b.index, next: b.next, needs: b.needs };
}

// ─── Saved answers from before this existed ─────────────────────────────────

/**
 * The Quizzes page has been saving answers as a markdown blob on
 * `ai_saved_results` (tool_type `saved_answer`) — question, your answer, the
 * model answer, what went wrong. Readable, and impossible to drill.
 *
 * Parsed on READ, never migrated on page load: a page that writes rows because
 * it was opened is the `autoBankRows` mistake. A student moves one into the
 * bank with a tap, and the old row is marked `moved_to` so it is not offered
 * twice.
 */
export function parseSavedAnswer(row) {
    const text = String(row?.content || "");
    const section = (name) => {
        const re = new RegExp(`\\*\\*${name}\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\s*\\*\\*[A-Z][^*]*\\*\\*|$)`, "i");
        const m = text.match(re);
        return m ? m[1].trim() : "";
    };
    const question = section("Question");
    const yours = section("Your answer");
    const model = section("Model answer") || section("Correct answer");
    const why = section("What went wrong");
    return {
        question,
        yours: yours === "No answer" ? "" : yours,
        model: model === "—" ? "" : model,
        why,
    };
}

/** A legacy saved answer that has not been moved into the bank yet. */
export const isLegacySaved = (row) =>
    row?.tool_type === "saved_answer" && !row?.extra?.moved_to;

/**
 * The card a legacy saved answer becomes. The MODEL answer when there is one:
 * the old save never recorded whether the student's own answer scored, and
 * learning an answer that may have lost marks rehearses the loss. Their own
 * answer only when it is all there is — and then it is labelled as theirs.
 */
export function cardFromSaved(row) {
    const p = parseSavedAnswer(row);
    if (!p.question) return null;
    const useModel = !!p.model;
    const answer = useModel ? p.model : p.yours;
    if (!answer) return null;
    const card = cardFromAnswer({
        question: p.question,
        answer,
        kind: "model",
        subject: row?.subject_name || null,
        topic: row?.topic || row?.input_data?.quiz_title || "",
        why: p.why,
    });
    if (card && !useModel) card.extra.exemplar.kind = "yours_unmarked";
    return card;
}

export default {
    ANSWER_TOPIC, isAnswerCard, cardFromAnswer, exemplarMeta, answerSaved, ANSWER_LADDER, LEARNED_AT,
    answerStage, answerLearned, answerState, answerCloze, rebuildOf, gradeRebuild, writeOf, gradeWrite,
    suggestFrom, answerDrillFor, answerSteps, answerRung, answerAfter, answerMoveOf, parseSavedAnswer,
    isLegacySaved, cardFromSaved,
};
