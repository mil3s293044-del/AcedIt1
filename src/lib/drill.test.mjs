/**
 * drill ladder assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/drill.test.mjs
 *
 * Two failures these exist to keep out. A rung asked too early — producing a
 * wording nobody has shown you yet is a test, not a drill. And a cloze built
 * out of stopwords, which turns a subject question into a grammar puzzle and
 * teaches the student that the exercise is noise.
 */
import assert from "node:assert/strict";
import {
    drillStage, keyTerms, buildCloze, gradeCloze, suggestRating, drillFor, sameTerm,
    buildSpot, gradeSpot, ladderFor, ladderProgress, LADDER,
} from "@/lib/drill";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const CARD = (over = {}) => ({
    id: "c1",
    question: "Discuss the importance of remedies — what did the assessor want?",
    answer: "Remedies uphold the principle of fairness by ensuring accountability, "
        + "the principle of equality by restoring wronged parties, and the principle "
        + "of access by providing a mechanism to enforce rights",
    repetitions: 0,
    extra: { mistake: { criterion: "Explicit reference to fairness, equality and access to justice" } },
    ...over,
});

// ─── the rungs ──────────────────────────────────────────────────────────────

check("a mistake nobody has been shown the answer to starts on recognise", () => {
    // Asking somebody to produce a wording they have never seen is a test.
    assert.equal(drillStage(CARD()), "recognise");
});

check("the rung climbs with the scheduler's own counter", () => {
    assert.equal(drillStage(CARD({ repetitions: 1 })), "spot");
    assert.equal(drillStage(CARD({ repetitions: 2 })), "cloze");
    assert.equal(drillStage(CARD({ repetitions: 3 })), "cloze");
    assert.equal(drillStage(CARD({ repetitions: 4 })), "repair");
    assert.equal(drillStage(CARD({ repetitions: 9 })), "repair");
});

check("a lapse drops the rung, because SM-2 resets repetitions", () => {
    // Staying on `produce` while the interval collapses is the worst of both.
    assert.equal(drillStage(CARD({ repetitions: 0 })), "recognise");
    assert.equal(drillStage(null), "recognise");
});

// ─── the gaps ───────────────────────────────────────────────────────────────

check("the criterion decides which words are blanked", () => {
    const terms = keyTerms(CARD().answer, CARD().extra.mistake.criterion);
    // These are what the mark turns on, and they are in both.
    assert.ok(terms.includes("fairness"));
    assert.ok(terms.includes("equality"));
    assert.ok(terms.includes("access"));
});

check("a stopword is never a blank", () => {
    const terms = keyTerms("the principle of the thing is that it was and it were", "");
    assert.ok(!terms.some((t) => ["the", "of", "that", "and", "was", "were", "principle"].includes(t) && t.length < 4));
    for (const t of terms) assert.ok(t.length >= 4, `blanked "${t}"`);
});

check("a cloze reads as text with holes in it, not a string with markers", () => {
    const c = buildCloze(CARD());
    assert.ok(c.segments.length > 2);
    const blanks = c.segments.filter((s) => s.blank != null);
    assert.equal(blanks.length, c.answers.length);
    // Reassembling the segments with their answers gives the original wording
    // back, which is the only proof the blanking did not eat any text.
    const rebuilt = c.segments.map((s) => (s.blank != null ? s.answer : s.text)).join("");
    assert.equal(rebuilt, CARD().answer);
});

check("the word bank is exactly the missing words, shuffled and stable", () => {
    const a = buildCloze(CARD());
    const b = buildCloze(CARD());
    assert.deepEqual([...a.bank].sort(), [...a.answers].sort(), "no invented distractors");
    assert.deepEqual(a.bank, b.bank, "the same card must not reshuffle between renders");
});

check("the opening word is never a gap", () => {
    // A passage that starts with a hole has no context before it, which is the
    // one thing a cloze exists to give you.
    const c = buildCloze(CARD());
    assert.ok(!c.answers.some((a) => a.toLowerCase() === "remedies"),
        `blanked the first word: ${c.answers.join(", ")}`);
    assert.deepEqual(c.answers.map((a) => a.toLowerCase()), ["fairness", "equality", "access"]);
});

check("three gaps at most", () => {
    // Four holes in one sentence is a word-order puzzle, not recall.
    assert.ok(buildCloze(CARD()).answers.length <= 3);
});

check("only the first occurrence of a term is blanked", () => {
    // Removing every "fairness" from a paragraph leaves a sentence nobody can
    // read, let alone complete.
    const c = buildCloze(CARD({
        answer: "Justice: fairness matters and fairness recurs and equality matters too",
    }));
    const rebuilt = c.segments.map((s) => (s.blank != null ? s.answer : s.text)).join("");
    assert.match(rebuilt, /fairness matters and fairness recurs/);
    assert.equal(c.answers.filter((w) => w.toLowerCase() === "fairness").length, 1);
});

check("a wording with nothing worth blanking makes no cloze", () => {
    // Better to fall back a rung than to ask somebody to guess "the".
    assert.equal(buildCloze(CARD({ answer: "It is not the same as it was" })), null);
    assert.equal(buildCloze(CARD({ answer: "" })), null);
    assert.equal(buildCloze({}), null);
});

check("only the first of two alternative wordings is used", () => {
    const c = buildCloze(CARD({
        answer: `Remedies uphold fairness and equality\n\nor\n\nRemedies promote accountability and balance`,
    }));
    const rebuilt = c.segments.map((s) => (s.blank != null ? s.answer : s.text)).join("");
    assert.ok(!rebuilt.includes("accountability"), "blanking both asks the same question twice");
});

// ─── marking the gaps ───────────────────────────────────────────────────────

check("a gap is marked on the word, not the punctuation or the case", () => {
    assert.ok(sameTerm("Fairness", "fairness "));
    assert.ok(sameTerm("access,", "access"));
    assert.ok(!sameTerm("access", "equality"));
});

check("the verdict says WHICH gap, not just how many", () => {
    const c = buildCloze(CARD());
    const wrong = c.answers.map((a, i) => (i === 0 ? "nonsense" : a));
    const g = gradeCloze(c, wrong);
    assert.equal(g.each[0], false);
    assert.equal(g.right, c.answers.length - 1);
    assert.equal(g.allRight, false);
    assert.ok(gradeCloze(c, c.answers).allRight);
});

check("the rating is a SUGGESTION scaled to how much they got", () => {
    // The student still presses the button; an app that schedules on its own
    // verdict takes away the one judgement only they can make.
    assert.equal(suggestRating({ right: 3, total: 3 }), 4);
    assert.equal(suggestRating({ right: 2, total: 3 }), 3);
    assert.equal(suggestRating({ right: 1, total: 3 }), 2);
    assert.equal(suggestRating({ right: 0, total: 3 }), 1);
    assert.equal(suggestRating({ right: 0, total: 0 }), null);
});

// ─── what the runner is handed ──────────────────────────────────────────────

check("a stage that cannot be built falls back rather than rendering broken", () => {
    // Cloze rung, but the wording has no blankable terms and there is no
    // quote to spot in either.
    assert.equal(drillFor(CARD({ repetitions: 2, answer: "It is not the same" })).stage, "recognise");
    // Repair rung, but no criterion to mark against — the prompt would be
    // "rewrite this to satisfy the thing you cannot see". It lands on the rung
    // below, which IS buildable from the model wording alone.
    assert.equal(drillFor(CARD({ repetitions: 5, extra: {} })).stage, "cloze");
});

check("the fallback CASCADES rather than dropping exactly one rung", () => {
    // Repair rung with no criterion falls to cloze; no blankable terms there
    // either, so it must keep falling — stopping at cloze would render an
    // empty exercise.
    const card = CARD({ repetitions: 5, answer: "It is not the same", extra: { mistake: {} } });
    assert.equal(drillFor(card).stage, "recognise");
});

check("a buildable stage comes with everything the screen needs", () => {
    const cloze = drillFor(CARD({ repetitions: 2 }));
    assert.equal(cloze.stage, "cloze");
    assert.ok(cloze.cloze.segments.length);
    const repair = drillFor(CARD({ repetitions: 5 }));
    assert.equal(repair.stage, "repair");
    assert.match(repair.criterion, /fairness/);
});

// ─── spot the error ─────────────────────────────────────────────────────────

const SPOTTABLE = (over = {}) => CARD({
    repetitions: 1,
    extra: { mistake: {
        criterion: "Names the principle of equality",
        quote: "the court was nice to both people",
        wanted: "the court applied the principle of equality to both parties",
        ...over,
    } },
});

check("the target is the words that are theirs alone", () => {
    const spot = buildSpot(SPOTTABLE());
    const wrong = spot.words.filter((w) => w.wrong).map((w) => w.text);
    assert.ok(wrong.includes("nice"), `got ${wrong.join(", ")}`);
    assert.ok(wrong.includes("people"));
    // Present in the model wording, so not an error.
    assert.ok(!wrong.includes("court"));
    assert.ok(!wrong.includes("both"));
});

check("a stopword that differs is never a target", () => {
    // Two phrasings always differ on glue words. Asking somebody to tap "was"
    // teaches them the exercise is noise.
    const spot = buildSpot(SPOTTABLE());
    for (const w of spot.words.filter((x) => x.wrong)) {
        assert.ok(!["the", "was", "to", "of"].includes(w.text.toLowerCase()), `targeted "${w.text}"`);
    }
});

check("the sentence survives the tokenising exactly", () => {
    const spot = buildSpot(SPOTTABLE());
    assert.equal(spot.words.map((w) => w.text).join(""), "the court was nice to both people");
});

check("no quote, or no wording to compare it against, means no spot", () => {
    assert.equal(buildSpot(SPOTTABLE({ quote: "" })), null);
    assert.equal(buildSpot(SPOTTABLE({ wanted: "" })), null);
    assert.equal(buildSpot({}), null);
});

check("two wordings that say the same thing have nothing to find", () => {
    assert.equal(buildSpot(SPOTTABLE({
        quote: "the court applied equality", wanted: "the court applied equality",
    })), null);
});

check("a sentence that is wrong end to end is a rewrite, not a spot", () => {
    // Every word a target means the rung above (repair) is the honest ask.
    assert.equal(buildSpot(SPOTTABLE({
        quote: "completely unrelated sentence here", wanted: "nothing shared whatsoever",
    })), null);
});

check("tapping everything does not pass", () => {
    const spot = buildSpot(SPOTTABLE());
    const everything = spot.words.filter((w) => !w.space).map((w) => w.index);
    const g = gradeSpot(spot, everything);
    assert.equal(g.allRight, false, "a winning strategy that is not knowing the answer");
    assert.ok(g.falsePositives.length > 0);
    assert.ok(g.right < g.total);
});

check("the exact targets, and nothing else, is full marks", () => {
    const spot = buildSpot(SPOTTABLE());
    const g = gradeSpot(spot, spot.words.filter((w) => w.wrong).map((w) => w.index));
    assert.ok(g.allRight);
    assert.equal(g.right, g.total);
    assert.equal(g.falsePositives.length, 0);
});

check("only the most load-bearing differences are targets", () => {
    // A casual sentence against a tight model phrase differs almost
    // everywhere. Flagging all of it is not a drill, it is "your sentence is
    // wrong", and it makes tapping every word the winning move.
    const spot = buildSpot(SPOTTABLE({
        quote: "the situation was unfair to Mary because she got less money",
        wanted: "equality is undermined because like cases are not treated alike",
    }));
    const wrong = spot.words.filter((w) => w.wrong).map((w) => w.text);
    assert.ok(wrong.length <= 4, `flagged ${wrong.length}: ${wrong.join(", ")}`);
    assert.ok(wrong.includes("situation"), `got ${wrong.join(", ")}`);
    assert.ok(!wrong.includes("got"), "three-letter filler is not the mistake");
});

// ─── The tracker ────────────────────────────────────────────────────────────
//
// The ladder was completely invisible: a student saw one exercise, rated it,
// and had no way to know whether that was the first of two or the third of
// five. These exist to keep the tracker honest about the steps a given card
// will actually see — a progress bar over rungs that can never be built is
// worse than no progress bar.

const FULL = (over = {}) => CARD({
    extra: { mistake: {
        criterion: "Explicit reference to fairness, equality and access to justice",
        quote: "the court was nice to both people",
        wanted: "the court applied the principle of equality to both parties",
        source: { quiz_id: "q1", q_index: 0 },
    } },
    ...over,
});

check("a fresh mistake is on the first rung with everything ahead of it", () => {
    const steps = ladderFor(FULL({ repetitions: 0 }));
    assert.equal(steps.length, LADDER.length);
    assert.equal(steps[0].state, "current");
    assert.ok(steps.slice(1).every((s) => s.state === "todo"));
    assert.equal(ladderProgress(steps).done, 0);
});

check("the counter moves the marker, and everything behind it is done", () => {
    const steps = ladderFor(FULL({ repetitions: 2 }));
    assert.equal(steps[0].state, "done");
    assert.equal(steps[1].state, "done");
    assert.equal(steps[2].state, "current");     // cloze
    assert.equal(ladderProgress(steps).done, 2);
});

check("the redo step is only DONE when the gate says so", () => {
    // The gate lives outside the card — rehearsal cannot mark itself proven.
    const drilled = ladderFor(FULL({ repetitions: 6 }), { laddered: true });
    assert.equal(drilled[4].state, "current");
    assert.notEqual(ladderProgress(drilled).pct, 100);

    const proven = ladderFor(FULL({ repetitions: 6 }), { laddered: true, cleared: true });
    assert.equal(proven[4].state, "done");
    assert.equal(ladderProgress(proven).pct, 100);
});

check("a finished rehearsal reads as finished, not parked on the last rung", () => {
    // `repetitions` stops climbing at the top rehearsal rung, so without this
    // a student who has done everything looks at four of five forever.
    const parked = ladderFor(FULL({ repetitions: 9 }));
    assert.equal(parked.find((s) => s.id === "repair").state, "current");
    const finished = ladderFor(FULL({ repetitions: 9 }), { laddered: true });
    assert.equal(finished.find((s) => s.id === "repair").state, "done");
    assert.equal(finished.find((s) => s.id === "redo").state, "current");
});

check("a rung this card can never see is SKIPPED, not pending", () => {
    // No quote means no spot, ever. Drawing it as a step the student is
    // working towards is a progress bar that will jump.
    const noQuote = ladderFor(CARD({
        repetitions: 0,
        extra: { mistake: { criterion: "Names the transfer", source: { quiz_id: "q", q_index: 0 } } },
    }));
    assert.equal(noQuote.find((s) => s.id === "spot").state, "skipped");
    assert.equal(noQuote.find((s) => s.id === "recognise").state, "current");
});

check("skipped steps are out of the denominator", () => {
    // Otherwise a card with two reachable rungs caps out at 40% and reads as
    // permanently unfinished.
    const steps = ladderFor(CARD({
        repetitions: 9,
        answer: "It is not the same",
        extra: { mistake: { criterion: "Names it" } },
    }), { cleared: false });
    const p = ladderProgress(steps);
    assert.ok(p.total < LADDER.length, `counted all ${p.total}`);
    assert.ok(p.total >= 1);
});

check("a mistake with no source question shows no redo step", () => {
    // There is nothing to sit again, and mistakeBank reports it fixed on the
    // ladder alone rather than holding it one rung short forever.
    const steps = ladderFor(CARD({ repetitions: 1, extra: { mistake: { criterion: "x" } } }));
    assert.equal(steps.find((s) => s.id === "redo").state, "skipped");
});

console.log(`\n${passed} passed`);
