/**
 * quizSetup assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/quizSetup.test.mjs
 *
 * ═══ EVERY FAILURE HERE RENDERS PERFECTLY ═══════════════════════════════════
 * A paper whose marks are all 5, a summary printing a midpoint as a total, a
 * command-term table the generator was never shown, a stimulus rule that got
 * switched OFF by a checkbox — not one of them throws, and three of them are
 * simply a different number from the one printed beside them. That is the class
 * `quizScore.test.mjs` and `fnResult.test.mjs` exist for, pointed at the screen
 * where the paper is ASKED for rather than the one where it is marked.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    allocate, maxFor, pickedKinds, paperShape, markRule, stimulusAsk, roundMinutes,
    MARK_MIN, MARK_MAX, COUNT_MIN, COUNT_MAX, MINUTES_PER_MARK,
    QUESTION_KINDS, TERM_MAX, MCQ_MARKS,
} from "@/lib/quizSetup";
import { COMMAND_TERMS, commandTermRule, getExaminerPrompt } from "@/lib/subjectExaminerPrompts";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log("  ok ", name); };
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
/* Comments stripped before every scan — a comment naming the thing it refuses
   is not the thing, the false positive three other test files had to learn. */
const code = (rel) => read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const QUIZZES = "src/pages/Quizzes.jsx";
const RECALL = "src/components/study/ActiveRecall.jsx";
const BLURT = "src/components/study/BlurtingMethod.jsx";
const FIELDS = "src/components/quizzes/QuizSetupFields.jsx";

/* ── A PAPER IS A SPREAD, NOT ONE NUMBER ─────────────────────────────────── */

ok("a range gives a RANGE of totals, and says it is one", () => {
    const p = paperShape({ kinds: ["mcq", "short"], counts: { mcq: 7 }, count: 12, markLo: 2, markHi: 6 });
    assert.equal(p.mcq + p.short, 12);
    assert.ok(p.varied, "a 2-to-6 paper reported a single total");
    assert.ok(p.marksLo < p.marksHi);
    // Both ends are REACHABLE: every written question could legitimately land
    // on either, so these bound the paper rather than estimating it.
    assert.equal(p.marksLo, p.mcq * MCQ_MARKS + p.short * 2);
    assert.equal(p.marksHi, p.mcq * MCQ_MARKS + p.short * 6);
});

ok("both handles on one value is ONE number, not a range of width zero", () => {
    const p = paperShape({ kinds: ["short"], count: 10, markLo: 4, markHi: 4 });
    assert.equal(p.varied, false);
    assert.equal(p.marksLo, p.marksHi);
    assert.equal(p.marksLo, 40);
});

ok("NOTHING AVERAGES THE RANGE INTO A TOTAL", () => {
    // The tempting line is `(lo + hi) / 2`, which prints "38 marks" over a
    // 44-mark paper — the invented figure every other screen here refuses.
    const src = code("src/lib/quizSetup.js");
    assert.ok(!/\/\s*2\b/.test(src), "a midpoint crept into the paper's arithmetic");
    assert.ok(!/\bavg|\bmean\b|average/i.test(src), "the shape started averaging its own range");
});

ok("crossed handles are swapped, never read as an empty paper", () => {
    const a = paperShape({ kinds: ["short"], count: 5, markLo: 7, markHi: 2 });
    const b = paperShape({ kinds: ["short"], count: 5, markLo: 2, markHi: 7 });
    assert.deepEqual(a, b);
    assert.ok(a.marksLo > 0, "a reversed pair produced a paper worth nothing");
});

ok("every figure is clamped to the control's own ends", () => {
    const p = paperShape({ kinds: ["short"], count: 999, markLo: -4, markHi: 90 });
    assert.ok(p.total <= COUNT_MAX);
    assert.equal(p.markLo, MARK_MIN);
    assert.equal(p.markHi, MARK_MAX);
    assert.ok(Number.isFinite(p.marksHi) && p.marksHi > 0);
});

/* ── THE KINDS ARE A SET, AND THE COUNTS SUM TO THE TOTAL ────────────────── */

ok("the counts always add up to the total, whatever is stored", () => {
    for (const kinds of [["mcq"], ["mcq", "short"], ["short", "multipart"],
                         ["mcq", "short", "multipart"]]) {
        for (const n of [COUNT_MIN, 7, 12, 30]) {
            for (const counts of [{}, { mcq: 99 }, { mcq: 0, short: -4 }, { short: 3 }]) {
                const a = allocate({ kinds, counts, count: n });
                const sum = Object.values(a).reduce((t, v) => t + v, 0);
                assert.equal(sum, n, `${kinds} at ${n} summed to ${sum}`);
            }
        }
    }
});

ok("EVERY PICKED KIND KEEPS AT LEAST ONE", () => {
    // The old slider could put 95% of two questions on MCQ and return a "mixed"
    // paper with nothing written on it. A kind on the chip row and absent from
    // the paper is the control saying one thing and the quiz being another.
    const a = allocate({ kinds: ["mcq", "short", "multipart"], counts: { mcq: 999 }, count: 12 });
    for (const id of ["mcq", "short", "multipart"]) assert.ok(a[id] >= 1, `${id} came back ${a[id]}`);
});

ok("the LAST kind is catalogue order, never tap order", () => {
    // It absorbs the remainder, so which one it is has to be the same on every
    // render — a stepper whose neighbour moves because of the order somebody
    // tapped in is a control nobody can predict.
    assert.deepEqual(pickedKinds(["multipart", "mcq"]), ["mcq", "multipart"]);
    assert.deepEqual(allocate({ kinds: ["multipart", "mcq"], counts: { mcq: 4 }, count: 10 }),
                     allocate({ kinds: ["mcq", "multipart"], counts: { mcq: 4 }, count: 10 }));
});

ok("the remainder is not set by hand, and a stepper stops where it must", () => {
    const at = { kinds: ["mcq", "short", "multipart"], counts: {}, count: 12 };
    assert.equal(maxFor("multipart", at), 0, "the last kind grew a stepper");
    // Ten leaves one each for the two kinds after it, and no more.
    assert.equal(maxFor("mcq", at), 10);
    assert.equal(maxFor("nonsense", at), 0);
});

ok("an unknown kind is dropped rather than carried", () => {
    assert.deepEqual(pickedKinds(["mcq", "jellyfish"]), ["mcq"]);
    assert.deepEqual(allocate({ kinds: ["jellyfish"], count: 10 }), {});
});

ok("MULTIPART COUNTS AS WRITTEN, because it carries an allocation", () => {
    // Only an MCQ is fixed at one mark. An extended question's range is the sum
    // of its parts, so it has to be inside the mark range like any other.
    const p = paperShape({ kinds: ["mcq", "multipart"], counts: { mcq: 6 },
        count: 10, markLo: 3, markHi: 9 });
    assert.equal(p.mcq, 6);
    assert.equal(p.short, 4, "extended questions fell out of the written count");
    assert.equal(p.marksLo, 6 * MCQ_MARKS + 4 * 3);
});

ok("THE 0.6 AND THE FOURTH 'TYPE' ARE BOTH GONE", () => {
    // The split was hard-coded in the prompt AND restated in the preview, and
    // "Mixed" was a type that secretly meant two types at that ratio.
    const src = code(QUIZZES);
    assert.ok(!/num_questions\s*\*\s*0\.6/.test(src), "the 60/40 split is back in Quizzes.jsx");
    assert.ok(!/mcq_share/.test(src + code(FIELDS)), "the balance slider is back");
    assert.ok(!/question_types/.test(src + code(FIELDS)), "the one-of-four type row is back");
    assert.ok(src.includes("paperShape("), "the page stopped reading the one model");
    assert.ok(/kind_counts/.test(src) && /kind_counts/.test(code(FIELDS)),
        "the per-kind counts are not wired to anything");
});

ok("A KIND NOBODY PICKED IS COERCED TO ONE THEY DID", () => {
    const src = code(QUIZZES);
    assert.ok(/if \(!shape\.alloc\.mcq\) forcedType = "short_answer";/.test(src),
        "a written-only paper can come back half multiple choice");
    assert.ok(/if \(!shape\.alloc\.short && !shape\.alloc\.multipart\) forcedType = "mcq";/.test(src),
        "an MCQ-only paper can come back half written");
});

ok("the prompt states a line per kind, and the total again", () => {
    const src = code(QUIZZES);
    assert.ok(/kindLines\.push/.test(src), "the counts stopped being stated per kind");
    assert.ok(/Total questions: \$\{shape\.total\}/.test(src),
        "a model given three counts and no sum rounds one of them out");
    assert.ok(/if \(multipartTarget\) \{/.test(src),
        "the extended-response brief is sent whether or not any were asked for");
});

ok("the chip row cannot empty the paper", () => {
    const src = code(FIELDS);
    assert.ok(/disabled=\{on && picked\.length === 1\}/.test(src),
        "the last kind can be untapped, which is a paper of no questions");
});

ok("the prompt and the strip are built from the SAME shape", () => {
    const src = code(QUIZZES);
    // One call for the generate, one memo for the footer. A third would be a
    // third answer to "how many of each", which is how this went wrong before.
    assert.equal((src.match(/paperShape\(\{/g) || []).length, 2,
        "a second derivation of the paper's shape appeared");
    assert.ok(/shape\.alloc\./.test(src) && /shape\.total/.test(src),
        "the prompt stopped taking its counts from the shape");
});

/* ── MARKS PER QUESTION ──────────────────────────────────────────────────── */

ok("`marks_per_short` is gone from the tree", () => {
    for (const f of [QUIZZES, RECALL, BLURT]) {
        assert.ok(!read(f).includes("marks_per_short"), `${f} still carries the flat allocation`);
    }
});

ok("the mark rule names BOTH ends and asks for variation", () => {
    const r = markRule({ markLo: 2, markHi: 6, short: 5 });
    assert.ok(r.includes("2") && r.includes("6"), "an end of the range went unnamed");
    assert.ok(/VARY|vary/.test(r), "the model was handed a range and no instruction to use it");
    assert.ok(/more questions at the low end/i.test(r),
        "without weighting the spread comes back uniform, which is a range in name only");
});

ok("a collapsed range asks for exactly that figure, and no spread", () => {
    const r = markRule({ markLo: 3, markHi: 3, short: 4 });
    assert.ok(/exactly 3 marks/.test(r));
    assert.ok(!/VARY/.test(r), "a single allocation was still told to vary");
});

ok("no written questions means no mark rule at all", () => {
    assert.equal(markRule({ markLo: 2, markHi: 6, short: 0 }), "");
});

ok("an unstated allocation falls to the LOW end, never the middle", () => {
    // Marks are the denominator a score is a percentage of, so crediting a
    // question the model left blank with more than was asked for quietly
    // deflates every score on the paper.
    const src = code(QUIZZES);
    assert.ok(/const marksValue = shape\.markLo;/.test(src),
        "the fallback allocation stopped being the low end of the range");
});

/* ── THE STIMULUS RULE MAY NEVER BE SWITCHED OFF ─────────────────────────── */

ok("the ASK is additive, and the RULE is unconditional", () => {
    assert.equal(stimulusAsk(false), "", "the off state emitted an instruction");
    const on = stimulusAsk(true);
    assert.ok(/never invent a source/i.test(on),
        "the ask relaxed the refusal it is supposed to repeat");

    const src = code(QUIZZES);
    // EVERY site, not the first one. The rule is interpolated into two prompts
    // — the generator and reshuffle — and a check that stops at the first match
    // passes while the other is wrapped in a ternary. Each use has to be a bare
    // `${STIMULUS_RULE}` alone on its line: the moment one is made conditional,
    // a question can point at material it does not carry and the marker docks
    // the student for the gap it created.
    const uses = src.split("\n").filter(l => l.includes("STIMULUS_RULE")
        && !l.includes("from \"@/lib/quizSchema\"") && !l.includes("STIMULUS_RULE_INLINE"));
    assert.ok(uses.length >= 2, "the rule stopped reaching both generators");
    for (const l of uses) {
        assert.equal(l.trim(), "${STIMULUS_RULE}",
            `STIMULUS_RULE is no longer sent unconditionally: ${l.trim()}`);
    }
    assert.ok(/stimulusAsk\(aiSettings\.include_stimulus\)/.test(src),
        "the toggle reaches nothing");
});

/* ── THE COMMAND TERMS ARE ONE LIST ──────────────────────────────────────── */

ok("the prompt block is DERIVED from the list, not typed beside it", () => {
    assert.ok(COMMAND_TERMS.length >= 15);
    const block = getExaminerPrompt("Biology");
    for (const t of COMMAND_TERMS) {
        assert.ok(block.includes(`- ${t.term.toUpperCase()}: ${t.behaviour}`),
            `${t.term} is in the list and not in the block the model is sent`);
    }
    const src = code("src/lib/subjectExaminerPrompts.js");
    assert.ok(!/- DEFINE:/.test(src),
        "the terms are written out a second time as prose");
});

ok("an emphasis is a request, and an unknown id is dropped", () => {
    assert.equal(commandTermRule([]), "", "an empty pick still shouted at the model");
    assert.equal(commandTermRule(["nonsense"]), "",
        "a term that is not in the table reached the model as a bare word");
    const r = commandTermRule(["explain", "evaluate"]);
    assert.ok(r.includes("EXPLAIN") && r.includes("EVALUATE"));
    assert.ok(/not a ban on the rest/i.test(r),
        "a paper made only of 'evaluate' is not a paper");
});

ok("THE GENERATOR FINALLY SEES THEM", () => {
    // Six surfaces imported this table and the one that WRITES the questions
    // was not among them — the same gap that was closed on the marker.
    const src = code(QUIZZES);
    assert.ok(/commandTermRule\(aiSettings\.command_terms\)/.test(src),
        "the chosen terms never reach the prompt");
    assert.ok(code(FIELDS).includes("COMMAND_TERMS.map("), "the chooser stopped reading the real table");
});

ok("the chooser caps the emphasis", () => {
    const src = code(FIELDS);
    assert.ok(/command_terms\.length >= TERM_MAX/.test(src),
        `leaning on all ${COMMAND_TERMS.length} terms is no emphasis at all`);
    assert.ok(TERM_MAX > 1 && TERM_MAX < COMMAND_TERMS.length);
});

/* ── THE SETTINGS ARE ONE LITERAL ────────────────────────────────────────── */

ok("DEFAULT_AI_SETTINGS is declared once and used everywhere", () => {
    const src = code(QUIZZES);
    assert.equal((src.match(/const DEFAULT_AI_SETTINGS = \{/g) || []).length, 1);
    // Initial state plus the two resets. Written out three times, a field added
    // to one was a field the other two silently dropped.
    assert.ok((src.match(/DEFAULT_AI_SETTINGS\)/g) || []).length >= 3,
        "a reset went back to writing its own object literal");
});

/* ── THE TIME IS A RULE A STUDENT CAN CHECK ──────────────────────────────── */

ok("the minutes come off the marks, and the rate is printed", () => {
    assert.equal(roundMinutes(MINUTES_PER_MARK * 30), 45);
    assert.ok(roundMinutes(1) >= 5, "a one-mark paper reported no time at all");
    const src = code(QUIZZES);
    assert.ok(/\{MINUTES_PER_MARK\} min a mark/.test(src),
        "the estimate stopped saying what it was computed from, which makes it decoration");
});

/* ── ACTIVE RECALL ───────────────────────────────────────────────────────── */

ok("the count the student picked reaches the generator", () => {
    const src = code(RECALL);
    assert.ok(!/8-12 active recall questions/.test(src),
        "the prompt still asks for 8-12 whatever the control says");
    assert.ok(/EXACTLY \$\{questionCount\}/.test(src));
});

ok("DEPTH IS SET, not merely declared", () => {
    const src = code(RECALL);
    // The schema has carried basic|intermediate|advanced since this file was
    // written and nothing ever set it — collect-nothing-you-don't-use, inverted.
    assert.ok(/enum: \["basic", "intermediate", "advanced"\]/.test(src),
        "the schema field this control exists for is gone");
    assert.ok(/DEPTH_BRIEF\[depth\]/.test(src), "the depth control reaches no prompt");
    assert.ok(/Set "difficulty" on every question to/.test(src),
        "the schema field is still filled in by the model rather than by the student");
});

ok("three minutes a question is ONE number now", () => {
    const src = code(RECALL);
    assert.ok(!/length \* 180/.test(src), "the session clock went back to a hard-coded 180");
    assert.ok(/\* pace \* 60/.test(src), "the clock stopped reading the pace control");
    assert.ok(/questionCount \* pace/.test(src),
        "the estimate under the control is a second copy of the pace again");
});

/* ── BLURTING ────────────────────────────────────────────────────────────── */

ok("the focus the student picked is what they are ASKED for and what is MARKED", () => {
    const src = code(BLURT);
    assert.ok(/FOCUS_BRIEF\[focus\]\.ask/.test(src),
        "the writing screen still asks for everything whatever was chosen");
    assert.ok(/FOCUS_BRIEF\[focus\]\?\.mark/.test(src),
        "the marking never hears which of the four they were going for");
});

ok("A PERCENTAGE SAYS WHICH BAR IT WAS MARKED AT", () => {
    // Three strictnesses and one figure is three numbers a student cannot
    // compare — the "two surfaces, one question" failure, inside one panel.
    const src = code(BLURT);
    assert.ok(/marked_at: strictness/.test(src), "the level is not recorded with the result");
    assert.ok(/aiFeedback\.marked_at/.test(src), "the panel never says which bar it used");
    assert.ok(/STRICT_BRIEF\[strictness\]/.test(src), "the level reaches no prompt");
});

ok("no level goes soft on the gaps", () => {
    const src = read(BLURT);
    assert.ok(/still name everything they missed/i.test(src),
        "the gentle setting became a screen telling a student they are fine");
});

/* ── ONE CONTROL, NOT THREE COPIES ───────────────────────────────────────── */

ok("all three setup screens draw the same control", () => {
    for (const f of [FIELDS, RECALL, BLURT]) {
        assert.ok(read(f).includes('from "@/components/shared/SetupControls"'),
            `${f} rolls its own setup control`);
    }
    // The two hand-rolled rows these replaced.
    assert.ok(!/aria-pressed=\{questionCount === n\}/.test(code(RECALL)));
    assert.ok(!/aria-pressed=\{sessionDuration === min\}/.test(code(BLURT)));
});

ok("the slider draws a thumb per value", () => {
    // The shadcn default renders exactly one `<Thumb>` whatever it is handed,
    // so a two-handle range drew one handle and the second end could never be
    // dragged. It renders perfectly and is simply the wrong control.
    const src = code("src/components/ui/slider.jsx");
    assert.ok(/values\.map\(/.test(src), "the slider went back to a single thumb");
    assert.ok(/props\.value \?\? props\.defaultValue/.test(src),
        "the slider stopped reading how many values it was given");
});

ok("the scanner recognises the shapes it is looking for", () => {
    // Every scan above is a regex over source, so a renamed file or a moved
    // block would make them all pass by matching nothing.
    for (const f of [QUIZZES, RECALL, BLURT, FIELDS, "src/lib/quizSetup.js",
        "src/components/shared/SetupControls.jsx", "src/components/ui/slider.jsx"]) {
        assert.ok(read(f).length > 400, `${f} is missing or empty`);
    }
    assert.ok(COUNT_MIN < COUNT_MAX && MARK_MIN < MARK_MAX);
    assert.ok(QUESTION_KINDS.length >= 3 && QUESTION_KINDS[0].id === "mcq");
    // Exactly one kind is fixed at one mark; the rest carry an allocation.
    assert.equal(QUESTION_KINDS.filter(k => !k.written).length, 1);
});

console.log(`\nquizSetup: ${n} checks passed`);
