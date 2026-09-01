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

check("fixed needs two clean recalls AND a real gap", () => {
    // One clean recall the day after banking it is short-term memory.
    assert.equal(fixState(card({ review_count_good: 1, consecutive_good: 1, interval_days: 30, last_quality: 3 })), "working");
    assert.equal(fixState(card({ review_count_good: 2, consecutive_good: 2, interval_days: 3, last_quality: 3 })), "working");
    assert.equal(fixState(card({ review_count_good: 2, consecutive_good: 2, interval_days: 7, last_quality: 3 })), "fixed");
    // Easy counts the same way, on its own counter.
    assert.equal(fixState(card({ review_count_easy: 2, consecutive_easy: 2, interval_days: 10, last_quality: 4 })), "fixed");
});

check("slipping is their LAST answer, not their history", () => {
    // Four early lapses since recalled twice is going the right way; filing it
    // under slipping reports history as news.
    assert.equal(fixState(card({ review_count_again: 4, review_count_good: 2, consecutive_good: 2, interval_days: 8, last_quality: 3 })), "fixed");
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
    const done = { review_count_good: 2, consecutive_good: 2, interval_days: 9, last_quality: 3 };
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
        card({ last_quality: 3, review_count_good: 2, consecutive_good: 2, interval_days: 8 }), // fixed
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

console.log(`\n${passed} passed`);
