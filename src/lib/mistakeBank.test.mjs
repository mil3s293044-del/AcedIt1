/**
 * mistake bank assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/mistakeBank.test.mjs
 *
 * The bug these exist to keep out: a mistake the student can SEE but cannot
 * SAVE. There were two card builders, one for a quoted phrase and one for a
 * missed criterion, and only the phrase one was ever wired up — so exactly the
 * marks with nothing to quote, which are the ones whose words are missing from
 * the answer, were the ones with no button.
 */
import assert from "node:assert/strict";
import {
    cardFromModule, isBankCard, bankKey, BANK_TOPIC,
    fixState, mistakeMeta, repeatOffenders, bankSummary,
    ladderDone, clearedBy, casesFor,
    isRetired, groupBank, retireMistake, restoreMistake,
} from "@/lib/mistakeBank";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const QUOTED = {
    id: "c0",
    kind: "criterion",
    status: "lost",
    text: "Names the electron transfer",
    detail: "VCAA wants the transfer stated, not inferred.",
    wanted: "The number of electrons, explicitly.",
    worth: 2, cost: 2,
    evidence: [{ id: "a0", quote: "goes into solution" }],
    fixes: ["loses two electrons"],
};

// The one that used to have no button at all: a mark lost because words are
// ABSENT, so there is nothing in the answer to underline.
const UNQUOTED = {
    id: "c1", kind: "criterion", status: "lost",
    text: "States oxidation at the anode",
    detail: "", wanted: "The half-equation, named as oxidation.",
    worth: 1, cost: 1, evidence: [], fixes: [],
};

check("the card asks for the FIX, never rehearsing the mistake", () => {
    const c = cardFromModule(QUOTED, { subject: "Chemistry", questionTitle: "Q3b" });
    assert.ok(c.answer.startsWith("loses two electrons"), "the back is what scores");
    assert.ok(c.question.includes("goes into solution"), "the front recalls what they wrote");
    assert.ok(c.question.includes("Q3b"));
    assert.equal(c.subject_name, "Chemistry");
    assert.equal(c.topic, BANK_TOPIC);
    assert.equal(c.is_active, true);
    assert.equal(c.is_weak_spot, true, "a dropped mark is a demonstrated weak spot");
});

check("a lost mark with NOTHING to quote still makes a card", () => {
    const c = cardFromModule(UNQUOTED, { questionTitle: "Q3b" });
    assert.ok(c, "this is the whole repair — it used to return nothing");
    assert.ok(c.question.includes("States oxidation at the anode"));
    assert.ok(c.answer.includes("half-equation"), "the back is what the assessor wanted");
});

check("a lost mark with no wording at all still has a usable back", () => {
    const c = cardFromModule({ ...UNQUOTED, wanted: "", detail: "" });
    // The criterion text is already phrased as what the assessor was looking
    // for, so it is a legitimate back — never a blank one.
    assert.equal(c.answer, "States oxidation at the anode");
});

check("an imprecision that survived needs a fix to be worth a card", () => {
    // Nothing was lost, so with no wording to rehearse the card has no back.
    assert.equal(cardFromModule({ ...UNQUOTED, status: "risk", wanted: "", fixes: [] }), null);
    const c = cardFromModule({ ...UNQUOTED, status: "risk", fixes: ["say it as a half-equation"] });
    assert.ok(c);
    assert.equal(c.is_weak_spot, false, "it did not cost a mark, so it is not a weak spot");
    // The lost/imprecise distinction lives in the row, not the deck key — see
    // the note on `unit`.
    assert.equal(c.extra.mistake.lost, false);
    assert.equal(c.unit, BANK_TOPIC);
});

check("two fixes both reach the back", () => {
    const c = cardFromModule({ ...QUOTED, fixes: ["loses two electrons", "is oxidised, losing 2e-"] });
    assert.ok(c.answer.includes("loses two electrons"));
    assert.ok(c.answer.includes("is oxidised, losing 2e-"));
});

check("long quotes are clipped so the front stays readable", () => {
    const c = cardFromModule({ ...QUOTED, evidence: [{ id: "a0", quote: "x".repeat(200) }] }, {});
    assert.ok(c.question.length < 200, `front was ${c.question.length} chars`);
    assert.ok(c.question.includes("…"));
});

check("nothing at all makes no card", () => {
    assert.equal(cardFromModule(null), null);
    assert.equal(cardFromModule({ status: "lost", text: "", fixes: [] }), null);
});

check("bank cards are recognisable, and other cards are not", () => {
    assert.equal(isBankCard({ topic: BANK_TOPIC }), true);
    assert.equal(isBankCard({ topic: "Blurting gaps" }), false);
    assert.equal(isBankCard(null), false);
});

check("the same mark banks once, but the same criterion on another question does not collide", () => {
    // Keyed per question: two questions can genuinely drop the same criterion
    // and both are worth rehearsing. Under the old bare-quote key the second
    // one rendered as already saved.
    assert.equal(bankKey(QUOTED, 0), bankKey({ ...QUOTED, id: "c9" }, 0), "identity is the mark, not its position");
    assert.notEqual(bankKey(QUOTED, 0), bankKey(QUOTED, 3));
    assert.equal(bankKey({ text: "  Padded " }, 1), "q1:padded");
    assert.equal(bankKey(null), "");
});


// ─── Reading the bank back ──────────────────────────────────────────────────
//
// The screen exists to show mistakes LEAVING. If "fixed" is generous it is
// flattery, and a student told they have fixed something they have not is
// being set up for the SAC.

const card = (over = {}) => ({
    topic: BANK_TOPIC, subject_name: "Chemistry", question: "q", answer: "a",
    review_count_again: 0, review_count_hard: 0, review_count_good: 0, review_count_easy: 0,
    consecutive_good: 0, consecutive_easy: 0, interval_days: 0, ...over,
});

check("a banked mistake nobody has been asked about yet is NEW, not slipping", () => {
    // Lumping these together hides the one state that needs action today.
    assert.equal(fixState(card()), "new");
});

check("the rehearsal is done only when every rung has been passed", () => {
    // Two clean recalls puts a card on the SECOND rung. Calling that rehearsed
    // means a mistake can be "fixed" having never been asked to spot the error
    // in its own sentence or rewrite it — which is the whole ladder.
    assert.equal(fixState(card({ repetitions: 2, review_count_good: 2, interval_days: 30, last_quality: 3 })), "working");
    // Every rung passed, but the scheduler has not pushed it out a week yet.
    assert.equal(fixState(card({ repetitions: 5, review_count_good: 5, interval_days: 3, last_quality: 3 })), "working");
    assert.equal(fixState(card({ repetitions: 5, review_count_good: 5, interval_days: 7, last_quality: 3 })), "fixed");
});

check("rating a card honestly never holds it back", () => {
    // SM-2 keeps `consecutive_good` and `consecutive_easy` as SEPARATE streaks
    // and each rating resets the other, so a student who rated Good and then
    // Easy — two clean recalls, the second better than the first — sat on a
    // maximum streak of one and could never finish. `repetitions` is the
    // counter that actually means "clean recalls since the last lapse".
    const mixed = card({
        repetitions: 5, interval_days: 9, last_quality: 4,
        review_count_good: 3, review_count_easy: 2,
        consecutive_good: 0, consecutive_easy: 1,
    });
    assert.equal(fixState(mixed), "fixed");
});

check("slipping is their LAST answer, not their history", () => {
    // Four early lapses since recalled twice is going the right way; filing it
    // under slipping reports history as news.
    assert.equal(fixState(card({ repetitions: 5, review_count_again: 4, review_count_good: 5, interval_days: 8, last_quality: 3 })), "fixed");
    assert.equal(fixState(card({ review_count_again: 1, consecutive_good: 0, last_quality: 1 })), "slipping");
    assert.equal(fixState(card({ review_count_hard: 1, last_quality: 2 })), "slipping");
});

check("a card banked before provenance existed still reads", () => {
    // The bank predates extra.mistake. Those cards must still count and
    // review; they just cannot be grouped by criterion.
    const m = mistakeMeta(card());
    assert.equal(m.criterion, "");
    assert.equal(m.cost, 0);
    assert.equal(mistakeMeta(null).criterion, "");
});

check("provenance is read back off the card", () => {
    const c = card({ extra: { mistake: { criterion: "Names the transfer", quote: "goes up", cost: 2, question_title: "Q3b" } } });
    const m = mistakeMeta(c);
    assert.equal(m.criterion, "Names the transfer");
    assert.equal(m.cost, 2);
    assert.equal(m.questionTitle, "Q3b");
});

check("a mistake made once is an incident, not a pattern", () => {
    const one = [card({ extra: { mistake: { criterion: "Misreads the command term" } } })];
    assert.deepEqual(repeatOffenders(one), []);
});

check("the same criterion across subjects is one repeat", () => {
    const crit = (subject) => card({ subject_name: subject, extra: { mistake: { criterion: "Misreads the command term" } } });
    const r = repeatOffenders([crit("Chemistry"), crit("Biology"), crit("Chemistry")]);
    assert.equal(r.length, 1);
    assert.equal(r[0].count, 3);
    assert.deepEqual(r[0].subjects.sort(), ["Biology", "Chemistry"]);
    assert.equal(r[0].fixed, false);
});

check("a repeat is only fixed when EVERY instance is", () => {
    // One outstanding copy of a repeated mistake is still a mistake you make.
    const done = { repetitions: 5, review_count_good: 5, interval_days: 9, last_quality: 3 };
    const crit = (over) => card({ extra: { mistake: { criterion: "Same thing" } }, ...over });
    assert.equal(repeatOffenders([crit(done), crit(done)])[0].fixed, true);
    const partly = repeatOffenders([crit(done), crit({})])[0];
    assert.equal(partly.fixed, false);
    // "3×" on a criterion they have already nailed twice is history reported
    // as news, so a partly-fixed repeat says how many are still open.
    assert.equal(partly.count, 2);
    assert.equal(partly.open, 1);
});

check("the summary counts only the bank, and adds up", () => {
    const rows = [
        card(),                                                                       // new
        card({ last_quality: 1, review_count_again: 1 }),                             // slipping
        card({ last_quality: 3, review_count_good: 1, consecutive_good: 1 }),          // working
        card({ last_quality: 3, repetitions: 5, review_count_good: 5, interval_days: 8 }), // fixed
        { topic: "Blurting gaps", subject_name: "Chemistry" },                        // not ours
    ];
    const s = bankSummary(rows, (c) => c.last_quality === 1);
    assert.equal(s.total, 4, "the blurting card is not a mistake-bank card");
    assert.deepEqual([s.slipping, s.new, s.working, s.fixed], [1, 1, 1, 1]);
    assert.equal(s.outstanding, 3, "everything not fixed is still costing marks");
    assert.equal(s.slipping + s.new + s.working + s.fixed, s.total);
    assert.equal(s.ready, 1, "readiness comes from the injected rule, not from here");
    assert.equal(s.subjects[0].subject, "Chemistry");
    assert.equal(s.subjects[0].fixed, 1);
    assert.equal(s.subjects[0].ready, 1);
});

check("an empty bank summarises to zeroes rather than throwing", () => {
    const s = bankSummary([], () => false);
    assert.equal(s.total, 0);
    assert.equal(s.outstanding, 0);
    assert.deepEqual(s.subjects, []);
    assert.deepEqual(s.repeats, []);
    assert.equal(bankSummary().total, 0);
});

check("a banked card carries its provenance and lands in ONE deck", () => {
    const c = cardFromModule(QUOTED, { subject: "Chemistry", questionTitle: "Q3b" });
    assert.equal(c.extra.mistake.criterion, "Names the electron transfer");
    assert.equal(c.extra.mistake.cost, 2);
    assert.equal(c.extra.mistake.quote, "goes into solution");
    // topic|unit is the deck key on the shelf. Varying unit split one student's
    // bank into two decks per subject.
    assert.equal(c.unit, BANK_TOPIC);
    assert.equal(cardFromModule(UNQUOTED, {}).unit, BANK_TOPIC);
    assert.equal(fixState(c), "new");
});


// ─── The redo gate ──────────────────────────────────────────────────────────
//
// Rehearsal measures whether a student can RECALL what the assessor wanted, on
// a card, after being reminded four times. A SAC does not ask that. These
// assertions exist to stop the ladder alone being reported as "fixed", which
// is the flattery the whole screen is built to refuse — and, just as
// importantly, to stop the opposite: a card banked before the gate existed
// being held one rung short of done forever for a reason its owner cannot see.

const DAY = 86400000;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString().slice(0, 10);

const DRILLED = (over = {}) => ({
    id: "d1",
    topic: BANK_TOPIC,
    repetitions: 6,
    consecutive_good: 3,
    interval_days: 12,
    last_quality: 4,
    review_count_good: 3,
    subject_name: "Legal Studies",
    extra: { mistake: {
        kind: "criterion",
        criterion: "Explicit reference to access to justice",
        quote: "people can use the courts",
        wanted: "the principle of access to justice",
        source: { quiz_id: "q1", q_index: 2 },
        banked_at: new Date(Date.now() - 20 * DAY).toISOString(),
        lost: true,
    } },
    ...over,
});

const SIT = (over = {}) => ({
    quiz_id: "q1", date: ago(2),
    extra: { question_results: [{
        q_index: 2, marks: 4, marks_max: 6,
        criteria: [{ text: "Explicit reference to access to justice", got: true }],
    }] },
    ...over,
});

check("the ladder alone is not fixed once a redo is possible", () => {
    assert.ok(ladderDone(DRILLED()), "fixture must have cleared the ladder");
    assert.equal(fixState(DRILLED(), []), "drilled");
});

check("earning the criterion again on the real question is what fixes it", () => {
    assert.equal(fixState(DRILLED(), [SIT()]), "fixed");
});

check("an attempt from BEFORE the mistake was banked proves nothing", () => {
    // It is the attempt the mistake came from, or one older still.
    assert.equal(fixState(DRILLED(), [SIT({ date: ago(40) })]), "drilled");
});

check("dropping the criterion again on the re-sit is not a fix", () => {
    const missed = SIT({ extra: { question_results: [{
        q_index: 2, marks: 2, marks_max: 6,
        criteria: [{ text: "Explicit reference to access to justice", got: false }],
    }] } });
    assert.equal(fixState(DRILLED(), [missed]), "drilled");
});

check("a different question on the same quiz is not evidence", () => {
    const elsewhere = SIT({ extra: { question_results: [{
        q_index: 5, marks: 6, marks_max: 6,
        criteria: [{ text: "Explicit reference to access to justice", got: true }],
    }] } });
    assert.equal(fixState(DRILLED(), [elsewhere]), "drilled");
});

check("a reworded criterion still matches, if it says the same thing", () => {
    // The model writes the criteria afresh every marking, so requiring an
    // exact string would mean nothing ever cleared.
    const reworded = SIT({ extra: { question_results: [{
        q_index: 2, marks: 5, marks_max: 6,
        criteria: [{ text: "Makes explicit reference to access to justice in the response", got: true }],
    }] } });
    assert.ok(clearedBy(DRILLED(), [reworded]));
});

check("a criterion that merely shares a few words does NOT match", () => {
    // Crediting the wrong fix is the one error this screen exists to refuse.
    const other = SIT({ extra: { question_results: [{
        q_index: 2, marks: 5, marks_max: 6,
        criteria: [{ text: "Reference to a case", got: true }],
    }] } });
    assert.equal(clearedBy(DRILLED(), [other]), null);
});

check("a card banked before the gate existed is not held hostage by it", () => {
    // No source means no question to re-sit. Reporting it as "drilled" forever
    // would mark a student down for WHEN they banked something.
    const legacy = DRILLED({ extra: { mistake: {
        criterion: "Names the transfer", banked_at: new Date().toISOString(),
    } } });
    assert.equal(fixState(legacy, []), "fixed");
});

check("with no attempt history at all, the ladder stands", () => {
    // A caller that never loaded attempts must behave as it did before the
    // gate existed rather than reporting everything as unfinished.
    assert.equal(fixState(DRILLED()), "fixed");
    assert.equal(fixState(DRILLED(), undefined), "fixed");
});

// ─── Cases ──────────────────────────────────────────────────────────────────

const QUIZ = { id: "q1", title: "Legal — Remedies", subject: "Legal Studies",
    questions: [{}, {}, { question: "Explain access to justice." }] };

check("a case gathers the mistakes from one question", () => {
    const other = DRILLED({ id: "d2", extra: { mistake: {
        ...DRILLED().extra.mistake, criterion: "Names the principle of fairness",
    } } });
    const [c] = casesFor([DRILLED(), other], [SIT()], [QUIZ]);
    assert.equal(c.total, 2);
    assert.equal(c.quizId, "q1");
    assert.equal(c.qIndex, 2);
    assert.equal(c.title, "Legal — Remedies");
});

check("a case is CLOSED only on full marks, not on every mistake fixed", () => {
    // A student can earn the criterion they drilled and drop a different one
    // in the same answer. Calling that finished is the trade this refuses.
    const [partial] = casesFor([DRILLED()], [SIT()], [QUIZ]);
    assert.equal(partial.fixed, 1, "the mistake itself is fixed");
    assert.equal(partial.fullMarks, false);
    assert.equal(partial.closed, false);

    const [full] = casesFor([DRILLED()], [SIT({ extra: { question_results: [{
        q_index: 2, marks: 6, marks_max: 6,
        criteria: [{ text: "Explicit reference to access to justice", got: true }],
    }] } })], [QUIZ]);
    assert.equal(full.closed, true);
});

check("a case with everything rehearsed says it is ready to re-sit", () => {
    const [c] = casesFor([DRILLED()], [], [QUIZ]);
    assert.ok(c.readyToRedo, "the one thing left is sitting the question");
    assert.equal(c.closed, false);
});

check("mistakes with no source question form no case", () => {
    const loose = DRILLED({ extra: { mistake: { criterion: "Something" } } });
    assert.equal(casesFor([loose], [], [QUIZ]).length, 0);
});

check("the summary counts what is waiting on a re-sit", () => {
    const sum = bankSummary([DRILLED()], () => false, []);
    assert.equal(sum.drilled, 1);
    assert.equal(sum.awaitingRedo, 1);
    assert.equal(sum.fixed, 0);
    assert.equal(sum.outstanding, 1);
});


// ─── Clearing a mastered mistake ────────────────────────────────────────────
//
// The only other exit from a review queue is is_active: false, which destroys
// the card — so a student who had genuinely fixed something had to choose
// between being asked forever and losing it before revision week. These keep
// clearing reversible, and keep the achievement after the pile is empty.

check("retiring keeps the card and is one field to undo", () => {
    const patch = retireMistake("2026-09-03T00:00:00.000Z");
    assert.equal(patch.retired_at, "2026-09-03T00:00:00.000Z");
    assert.equal(Object.keys(patch).length, 1, "nothing else is touched");
    assert.equal(restoreMistake().retired_at, null);
    assert.ok(isRetired({ retired_at: "2026-09-03T00:00:00.000Z" }));
    assert.ok(!isRetired({}));
});

check("a cleared mistake leaves the working set but not the record", () => {
    const done = DRILLED({ id: "gone", retired_at: new Date().toISOString() });
    const sum = bankSummary([DRILLED(), done], () => false, []);
    assert.equal(sum.total, 1, "the pile is what is left to do");
    assert.equal(sum.cards.length, 1);
    assert.equal(sum.clearedCount, 1);
    assert.equal(sum.all.length, 2, "still there, still countable");
    // The achievement survives an empty bank.
    const emptied = bankSummary([done], () => false, []);
    assert.equal(emptied.total, 0);
    assert.equal(emptied.clearedCount, 1);
});

// ─── Grouping ───────────────────────────────────────────────────────────────

const AT = (subject, topic, over = {}) => DRILLED({
    id: `${subject}-${topic}-${over.id || Math.random()}`,
    subject_name: subject,
    ...over,
    extra: { mistake: { ...DRILLED().extra.mistake, topic, ...(over.mistake || {}) } },
});

check("the bank groups subject, then topic", () => {
    const groups = groupBank([
        AT("Legal Studies", "Remedies", { id: "a" }),
        AT("Legal Studies", "Remedies", { id: "b" }),
        AT("Legal Studies", "Courts", { id: "c" }),
        AT("Chemistry", "Polymers", { id: "d" }),
    ], { attempts: [] });

    assert.equal(groups.length, 2);
    const legal = groups.find((g) => g.subject === "Legal Studies");
    assert.equal(legal.total, 3);
    assert.equal(legal.topics.length, 2);
    assert.equal(legal.topics.find((t) => t.topic === "Remedies").total, 2);
});

check("every level counts what its own button would actually play", () => {
    // "Review 6" that turns out to be one due card and five scheduled is the
    // small lie that costs a screen its credibility.
    const ready = new Set(["a"]);
    const [g] = groupBank([
        AT("Legal Studies", "Remedies", { id: "a" }),
        AT("Legal Studies", "Remedies", { id: "b" }),
    ], { isReady: (c) => ready.has(c.id), attempts: [] });
    assert.equal(g.total, 2);
    assert.equal(g.ready, 1);
    assert.equal(g.topics[0].ready, 1);
});

check("a cleared mistake is in no group", () => {
    const groups = groupBank([
        AT("Legal Studies", "Remedies", { id: "a" }),
        AT("Legal Studies", "Remedies", { id: "b", retired_at: new Date().toISOString() }),
    ], { attempts: [] });
    assert.equal(groups[0].total, 1);
});

check("the subject with the most left to do sorts first", () => {
    const groups = groupBank([
        AT("Chemistry", "Polymers", { id: "a" }),
        AT("Legal Studies", "Remedies", { id: "b" }),
        AT("Legal Studies", "Courts", { id: "c" }),
    ], { attempts: [] });
    assert.equal(groups[0].subject, "Legal Studies");
});

check("a mistake with no topic of its own still lands somewhere", () => {
    // Every card banked before the topic existed. "No topic" is a group; a
    // card that vanishes from the shelf is a card the student cannot reach.
    const legacy = DRILLED({ id: "old", extra: { mistake: {
        criterion: "Names the transfer", banked_at: new Date().toISOString(),
    } } });
    const groups = groupBank([legacy], { attempts: [] });
    assert.equal(groups.length, 1);
    assert.equal(groups[0].topics.length, 1);
    assert.ok(groups[0].topics[0].topic);
});

console.log(`\n${passed} passed`);
