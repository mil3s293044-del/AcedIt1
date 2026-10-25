/**
 * answer bank assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/answerBank.test.mjs
 *
 * ═══ THE ANSWERS WORTH LEARNING, ON A LADDER ════════════════════════════════
 * A saved answer is a flashcard row with a marker, drilled read → fill →
 * rebuild → write, on the scheduler the mistake bank already uses. What can go
 * wrong silently: a lost-marks answer saved as one worth learning, a rung that
 * cannot be built served anyway, a fill or rebuild that grades the wrong thing,
 * and a saved answer leaking onto the flashcard shelf. Every check below was
 * verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    ANSWER_TOPIC, isAnswerCard, cardFromAnswer, exemplarMeta, answerSaved, answerStage, answerLearned,
    answerState, answerCloze, rebuildOf, gradeRebuild, writeOf, gradeWrite, suggestFrom, answerDrillFor,
    answerSteps, answerRung, answerAfter, answerMoveOf, parseSavedAnswer, isLegacySaved, cardFromSaved,
    LEARNED_AT, REBUILD_MAX_WORDS,
} from "@/lib/answerBank";
import { deckCards, BANK_TOPIC } from "@/lib/mistakeBank";
import { runSummary, moveLine } from "@/lib/bankRun";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const read = (rel) => fs.readFileSync(rel, "utf8");
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const ANSWER = "Oxidation is the loss of electrons at the anode, while reduction is the gain of electrons at the cathode, so electrons flow through the external circuit from anode to cathode.";
const make = (over = {}) => ({
    id: "a1",
    ...cardFromAnswer({
        question: "Explain why electrons flow from the anode to the cathode in a galvanic cell. (3 marks)",
        answer: ANSWER,
        kind: "own",
        subject: "Chemistry",
        topic: "Galvanic cells",
        marks: 3, outOf: 3,
        criteria: ["Oxidation occurs at the anode", "Electrons flow through the external circuit", "Reduction at the cathode"],
        source: { quizId: "qz1", qIndex: 2 },
    }),
    repetitions: 0, interval_days: 0, total_reviews: 0,
    ...over,
});

check("a saved answer is a marked flashcard row, and the shelf never sees it", () => {
    const c = make();
    assert.equal(c.topic, ANSWER_TOPIC);
    assert.equal(c.unit, ANSWER_TOPIC, "unit is constant, or the review shelf splits the bank into a deck per quiz");
    assert.ok(isAnswerCard(c));
    const deck = { id: "d", topic: "Redox", question: "q", answer: "a" };
    const bank = { id: "m", topic: BANK_TOPIC, question: "q", answer: "a" };
    assert.deepEqual(deckCards([deck, c, bank]).map((x) => x.id), ["d"],
        "deckCards must take the answer bank out of every deck surface, the same as the mistake bank");
});

check("your own answer is only worth learning when it scored everything", () => {
    assert.equal(cardFromAnswer({ question: "Q", answer: "A", kind: "own", marks: 2, outOf: 3 }), null,
        "rehearsing a response that lost marks rehearses the loss");
    assert.equal(cardFromAnswer({ question: "Q", answer: "A", kind: "own" }), null,
        "an own answer with no marks on file is not proven to have scored");
    assert.equal(exemplarMeta(cardFromAnswer({ question: "Q", answer: "A", kind: "own", marks: 3, outOf: 3 })).kind, "own");
    assert.equal(exemplarMeta(cardFromAnswer({ question: "Q", answer: "A", kind: "model" })).kind, "model");
    assert.equal(cardFromAnswer({ question: "Q", answer: "—", kind: "model" }), null, "a dash is not a model answer");
    assert.equal(cardFromAnswer({ question: "", answer: "A" }), null);
});

check("provenance is kept whole and reads back defaulted", () => {
    const m = exemplarMeta(make());
    assert.equal(m.topic, "Galvanic cells");
    assert.equal(m.outOf, 3);
    assert.deepEqual(m.source, { quizId: "qz1", qIndex: 2 });
    assert.equal(m.criteria.length, 3);
    const bare = exemplarMeta({ topic: ANSWER_TOPIC, question: "Q", answer: "A" });
    assert.equal(bare.kind, "model");
    assert.equal(bare.source, null);
    assert.equal(bare.marks, null, "Number(null) is 0 — a missing mark must not read as a zero");
});

check("an answer already saved reads as saved, keyed on where it came from", () => {
    const c = make();
    assert.ok(answerSaved([c], { quizId: "qz1", qIndex: 2 }));
    assert.ok(!answerSaved([c], { quizId: "qz1", qIndex: 3 }));
    assert.ok(answerSaved([{ ...c, retired_at: "2026-01-01" }], { quizId: "qz1", qIndex: 2 }),
        "a put-away answer is still saved — offering it again would put a second copy back in the queue");
    assert.ok(!answerSaved([{ ...c, is_active: false }], { quizId: "qz1", qIndex: 2 }), "a deleted one is not");
    assert.ok(answerSaved([cardFromAnswer({ question: "What is a  cell?", answer: "A" })], { question: "what is a cell" }),
        "with no source the question text is the key, normalised");
});

check("the rung is read off repetitions, read → fill → rebuild → write", () => {
    assert.equal(answerStage(make({ repetitions: 0 })), "read");
    assert.equal(answerStage(make({ repetitions: 1 })), "fill");
    assert.equal(answerStage(make({ repetitions: 2 })), "rebuild");
    assert.equal(answerStage(make({ repetitions: 3 })), "rebuild");
    assert.equal(answerStage(make({ repetitions: 4 })), "write");
    assert.equal(answerDrillFor(make({ repetitions: 0 })).stage, "read");
    assert.equal(answerDrillFor(make({ repetitions: 1 })).stage, "fill");
    assert.equal(answerDrillFor(make({ repetitions: 2 })).stage, "rebuild");
    assert.equal(answerDrillFor(make({ repetitions: 4 })).stage, "write");
});

check("learned needs the whole ladder AND a week", () => {
    assert.ok(!answerLearned(make({ repetitions: LEARNED_AT, interval_days: 3 })), "a day-after recall is not learned");
    assert.ok(!answerLearned(make({ repetitions: LEARNED_AT - 1, interval_days: 30 })));
    assert.ok(answerLearned(make({ repetitions: LEARNED_AT, interval_days: 7 })));
    assert.equal(answerState(make()), "new");
    assert.equal(answerState(make({ repetitions: 2, total_reviews: 3, last_quality: 4 })), "rehearsing");
    assert.equal(answerState(make({ repetitions: 0, total_reviews: 3, last_quality: 1 })), "slipping");
    assert.equal(answerState(make({ repetitions: LEARNED_AT, interval_days: 9, total_reviews: 5 })), "learned");
});

check("the fill blanks the words the marks turned on, and refuses when there are none", () => {
    const cloze = answerCloze(make());
    assert.ok(cloze, "a three-mark explain has blankable terms");
    assert.ok(cloze.answers.length >= 2);
    const crit = make().extra.exemplar.criteria.join(" ").toLowerCase();
    assert.ok(cloze.answers.some((t) => crit.includes(t.toLowerCase())),
        "the criterion decides what is blanked — words in both the criterion and the answer first");
    assert.equal(answerCloze(make({ answer: "Yes it is." })), null, "nothing blankable is no fill, never a blanked stopword");
});

check("the gaps are placed in READING order, so a long answer keeps them all", () => {
    // keyTerms ranks longest-first and the cloze walk only searches forward, so
    // a key term that appears BEFORE the longest one was dropped. On a whole
    // saved answer that left one gap, and the fill rung was struck off as
    // unbuildable — found on the first screenshot of the answer bank.
    const long = make({
        answer: "The salt bridge lets ions flow between the half-cells: anions migrate to the anode half-cell and cations migrate to the cathode half-cell, which keeps each half-cell electrically neutral so the reaction can keep going.",
    });
    const cloze = answerCloze(long);
    assert.ok(cloze, "a long answer with four key terms has a fill");
    assert.ok(cloze.answers.length >= 3, `only ${cloze.answers.length} gaps survived the walk`);
    const at = cloze.answers.map((t) => long.answer.indexOf(t));
    assert.deepEqual(at, [...at].sort((a, b) => a - b), "the gaps are not in reading order");
    assert.notEqual(answerSteps(long).find((s) => s.id === "fill").state, "skipped");
});

check("the rebuild is every word as its first letter, punctuation kept", () => {
    const r = rebuildOf(make());
    assert.ok(r);
    assert.equal(r.words[0].cue, "O________", "Oxidation → O + one gap per remaining letter");
    assert.ok(r.words.some((w) => /,$/.test(w.cue)), "a comma stays where it was");
    assert.equal(rebuildOf(make({ answer: "Too short here." })), null, "under six words there is nothing to rebuild");
    assert.equal(rebuildOf(make({ answer: "x ".repeat(REBUILD_MAX_WORDS + 5) })), null, "a whole page is transcription");
    assert.equal(rebuildOf(make({ answer: "The derivative is $\\frac{dy}{dx} = 2x$ evaluated at the point given here." })), null,
        "a first-letter skeleton of maths is noise");
});

check("a rebuild is graded on the wording IN ORDER, not on spelling", () => {
    const r = rebuildOf(make());
    assert.equal(gradeRebuild(r, ANSWER).pct, 100);
    assert.ok(gradeRebuild(r, ANSWER.toUpperCase().replace(/,/g, "")).allRight, "case and punctuation do not count");
    const shuffled = ANSWER.split(" ").reverse().join(" ");
    assert.ok(gradeRebuild(r, shuffled).pct <= 35, "the same words backwards is the gist, not the wording");
    assert.ok(gradeRebuild(r, "Electrons flow from anode to cathode through the circuit because oxidation happens.").pct < 50,
        "a paraphrase is the gist, which the write rung asks for, not this one");
    assert.equal(gradeRebuild(r, "").pct, 0);
});

check("the write rung checks for the load-bearing terms and names the missing ones", () => {
    const w = writeOf(make());
    assert.ok(w.terms.length >= 2);
    const all = gradeWrite(w, ANSWER);
    assert.equal(all.missed.length, 0);
    assert.ok(all.allRight);
    const some = gradeWrite(w, "Electrons move in the circuit.");
    assert.ok(some.missed.length > 0, "what is missing is named, so the check can be read line by line");
    const oneShort = gradeWrite(w, ANSWER.replace(new RegExp(w.terms[0], "ig"), "thing"));
    assert.equal(oneShort.missed.length, 1);
    assert.equal(oneShort.allRight, false, "one load-bearing term missing is not all right");
    assert.equal(gradeWrite(w, "").right, 0);
    assert.equal(gradeWrite(w, "").allRight, false, "nothing written is never all right");
});

check("a result SUGGESTS a rating on the 1–4 scale", () => {
    assert.equal(suggestFrom({ pct: 100 }), 4);
    assert.equal(suggestFrom({ pct: 80 }), 3);
    assert.equal(suggestFrom({ pct: 40 }), 2);
    assert.equal(suggestFrom({ pct: 5 }), 1);
    assert.equal(suggestFrom({ right: 3, total: 3 }), 4);
    assert.equal(suggestFrom(null), null);
});

check("a rung that cannot be built falls back, and the fall CASCADES", () => {
    // Maths: no rebuild, and nothing worth blanking either.
    const maths = make({ answer: "$x = 2$ and $y = 3$ so $x + y = 5$", extra: { exemplar: { criteria: [] } }, repetitions: 2 });
    assert.equal(answerDrillFor(maths).stage, "read", "rebuild → fill → read when neither can be built");
    const steps = answerSteps(maths);
    assert.equal(steps.find((s) => s.id === "rebuild").state, "skipped");
    assert.equal(steps.find((s) => s.id === "fill").state, "skipped");
    assert.equal(steps.filter((s) => s.state === "current").length, 1, "exactly one step is lit, and it is the one served");
    assert.equal(steps.find((s) => s.state === "current").id, "read");
    // From the TOP: a write-rung answer whose question went missing cannot be
    // written from the question, so it falls to the rebuild below it rather
    // than skipping a rung it could have had.
    const noQuestion = make({ question: "", repetitions: 4, extra: { exemplar: { question: "" } } });
    assert.equal(answerDrillFor(noQuestion).stage, "rebuild", "write → rebuild when the question is gone");
});

check("the tracker lights the step the drill will serve", () => {
    for (const reps of [0, 1, 2, 3, 4]) {
        const c = make({ repetitions: reps });
        const current = answerSteps(c).filter((s) => s.state === "current");
        assert.equal(current.length, 1, `reps ${reps}`);
        assert.equal(current[0].id, answerDrillFor(c).stage, `reps ${reps}`);
    }
    assert.ok(answerSteps(make({ repetitions: LEARNED_AT, interval_days: 8 })).every((s) => s.state === "done" || s.state === "skipped"));
});

check("a rating moves the answer the way the scheduler says, in the run's vocabulary", () => {
    const c = make({ repetitions: 1, interval_days: 1, easiness_factor: 2.5, total_reviews: 1 });
    const good = answerMoveOf(c, answerAfter(c, 3));
    assert.equal(good.kind, "climbed", "fill → rebuild");
    assert.equal(answerMoveOf(c, answerAfter(c, 1)).kind, "slipped");
    const near = make({ repetitions: LEARNED_AT - 1, interval_days: 10, easiness_factor: 2.5, total_reviews: 6 });
    const after = answerAfter(near, 4);
    assert.equal(answerMoveOf(near, after).kind, "learned");
    assert.equal(answerRung(after).id, "learned");
});

check("the run counts a learned answer as up, and says so", () => {
    const s = runSummary([{ id: "x", kind: "learned", from: "Write it", to: "Learned" }, { id: "y", kind: "held" }]);
    assert.equal(s.learned.length, 1, "runSummary must carry a learned group, or a learned answer is filed under held");
    assert.equal(s.up, 1);
    assert.ok(/learned/i.test(moveLine({ kind: "learned" })));
});

check("an old saved answer parses, and moves in as the MODEL answer", () => {
    const row = {
        id: "s1", tool_type: "saved_answer", subject_name: "Legal Studies", topic: "Remedies",
        content: "**Question**\nDefine a remedy.\n\n**Your answer**\nA thing a court does\n\n**Model answer**\nA remedy is the means by which a court restores a plaintiff.\n\n**What went wrong**\nToo vague.",
    };
    const p = parseSavedAnswer(row);
    assert.equal(p.question, "Define a remedy.");
    assert.equal(p.yours, "A thing a court does");
    assert.ok(/restores a plaintiff/.test(p.model));
    assert.ok(isLegacySaved(row));
    assert.ok(!isLegacySaved({ ...row, extra: { moved_to: "c9" } }), "once moved it is not offered twice");
    const card = cardFromSaved(row);
    assert.equal(card.answer, p.model, "the old save never recorded whether their answer scored");
    assert.equal(exemplarMeta(card).topic, "Remedies");
    const theirs = cardFromSaved({ ...row, content: "**Question**\nQ?\n\n**Your answer**\nMine\n\n**Model answer**\n—" });
    assert.equal(exemplarMeta(theirs).kind, "yours_unmarked", "their own words, labelled as never marked");
});

/** Every effect body in a source file, walked by paren depth from `useEffect(`. */
function effectBodies(src) {
    const out = [];
    let at = src.indexOf("useEffect(");
    while (at !== -1) {
        let depth = 0;
        let i = at + "useEffect".length;
        for (; i < src.length; i += 1) {
            if (src[i] === "(") depth += 1;
            else if (src[i] === ")") { depth -= 1; if (depth === 0) break; }
        }
        out.push(src.slice(at, i + 1));
        at = src.indexOf("useEffect(", i);
    }
    return out;
}

check("nothing in the answer bank migrates on page load", () => {
    // An effect that writes is a write because the page opened. Moving an old
    // saved answer in is a TAP — it creates a card the student then drills on
    // a schedule, and that is theirs to decide.
    const page = strip(read("src/pages/Revision.jsx"));
    const bodies = effectBodies(page);
    assert.ok(bodies.length >= 1, "the walk reached the page's effects");
    for (const b of bodies) {
        assert.ok(!/moveLegacy|cardFromSaved|Flashcard\.create|bulkCreate/.test(b),
            `an effect on the Revision page writes cards: ${b.slice(0, 80)}`);
    }
    assert.ok(effectBodies("useEffect(() => { go(f(x)); }, [x]); useEffect(() => {}, []);").length === 2, "the walker splits effects");
});

console.log(`\n${passed} checks passed`);
