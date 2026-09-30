/**
 * marking-eval assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/evalCases.test.mjs
 *
 * THE GRADER IS CODE THAT DECIDES WHETHER THE APP WAS RIGHT, so it is verified
 * before anything is spent on it. Every function in `eval/quizMarking/grade.mjs`
 * runs here against hand-built marking responses — no API key, no network, no
 * cost. A grader first exercised during a paid pass is one whose bugs are paid
 * for twice: once in the run, and again in the conclusion drawn from it.
 *
 * Three classes of failure this guards, all silent:
 *
 * 1. TRAINING ON THE TEST SET. The worked marks in `examinerReports.js` go INTO
 *    the marking prompt. A case that duplicates one would measure copying and
 *    would score near-perfectly while teaching nothing. The overlap check is
 *    the only thing standing between this eval and that.
 *
 * 2. A ONE-DIRECTIONAL CASE SET. Removing "be lenient on phrasing" makes a
 *    marker stricter. A set composed only of answers that should lose marks
 *    would score a marker that fails everything at 100% — the change would look
 *    like a triumph and the app would be unusable. The set must carry answers
 *    that must NOT be docked, and this asserts it does.
 *
 * 3. NOT-APPLICABLE COUNTED AS PASS. Most checks return null where they do not
 *    apply — an MCQ has no criteria to sum, a dropped-mark answer has no
 *    full-marks silence to keep. Folding those in as passes gives a metric that
 *    rises as the set grows, which is worse than no metric.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    awardedMark, criteriaSumOk, quotesVerbatim, annotationsLinked,
    cleanIsSilent, missedHaveNotes, programmaticGrade, registerScore, feedbackText,
} from "../../eval/quizMarking/grade.mjs";
import { EXEMPLARS } from "@/lib/examinerReports";
import { getProfiledSubjects } from "@/lib/subjectExaminerPrompts";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const ROOT = process.cwd();
const BOOK = JSON.parse(fs.readFileSync(path.join(ROOT, "eval/quizMarking/cases.json"), "utf8"));
const CASES = BOOK.cases;
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* ── The case set ────────────────────────────────────────────────────────── */

check("the set is big enough for its own noise floor to mean something", () => {
    // Under fifteen cases one flaky result swings the headline. This is the
    // floor the eval guidance sets, and it is also roughly where a single case
    // stops being worth five points of pass-rate.
    assert.ok(CASES.length >= 15, `only ${CASES.length} cases`);
    const ids = CASES.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate case id");
    for (const c of CASES) assert.ok(/^[a-z0-9-]+$/.test(c.id), `${c.id} is not a path-safe id`);
});

check("NO CASE DUPLICATES A WORKED MARK FROM THE PROMPT", () => {
    // The exemplars are few-shot examples inside `markingSystem`. Scoring the
    // marker on them measures whether it can copy, which it can.
    const inPrompt = new Set();
    for (const rows of Object.values(EXEMPLARS)) {
        for (const ex of rows) {
            inPrompt.add(norm(ex.question));
            inPrompt.add(norm(ex.answer));
        }
    }
    for (const c of CASES) {
        assert.ok(!inPrompt.has(norm(c.question)),
            `${c.id} asks a question that is a worked mark in the prompt`);
        if (c.student_answer) {
            assert.ok(!inPrompt.has(norm(c.student_answer)),
                `${c.id} uses a student answer the prompt already shows marked`);
        }
    }
});

check("EVERY CASE CARRIES A GOLD MARK THAT IS REACHABLE", () => {
    for (const c of CASES) {
        assert.ok(Number.isInteger(c.marks) && c.marks > 0, `${c.id} has no allocation`);
        assert.ok(Number.isInteger(c.gold_marks), `${c.id} has no gold mark`);
        assert.ok(c.gold_marks >= 0 && c.gold_marks <= c.marks,
            `${c.id} golds ${c.gold_marks} out of ${c.marks}`);
        assert.ok(c.gold_note && c.gold_note.length > 60,
            `${c.id} states a gold with no reasoning — nobody can review that`);
    }
});

check("PROVENANCE IS DECLARED, and a claimed report is cited", () => {
    // "A VCAA assessor awarded this" and "the conventions imply this" are
    // different claims, and the headline means different things under each.
    for (const c of CASES) {
        assert.ok(["convention-derived", "examiner-report", "teacher"].includes(c.gold_source),
            `${c.id} has gold_source "${c.gold_source}"`);
        if (c.gold_source === "examiner-report") {
            assert.ok(c.cite, `${c.id} claims a real report without citing it`);
        }
        assert.ok(c.tags.includes(c.gold_source), `${c.id} does not tag its provenance`);
    }
});

check("BOTH DIRECTIONS ARE REPRESENTED, or a harsh marker scores 100%", () => {
    const shouldNotDock = CASES.filter((c) => c.tags.includes("should_not_dock"));
    assert.ok(shouldNotDock.length >= 4,
        `only ${shouldNotDock.length} cases that must NOT lose marks`);
    for (const c of shouldNotDock) {
        assert.equal(c.gold_marks, c.marks, `${c.id} is tagged should_not_dock but golds below full`);
    }
    // And full marks must not be the whole set either, or a generous marker wins.
    const full = CASES.filter((c) => c.gold_marks === c.marks).length;
    assert.ok(full >= 4 && full <= CASES.length - 8,
        `${full} of ${CASES.length} cases gold at full marks — the set leans one way`);
    const zero = CASES.filter((c) => c.gold_marks === 0).length;
    assert.ok(zero >= 2, "no case golds at zero, so nothing tests refusing to give credit");
});

check("every case names a subject that has a real examiner profile", () => {
    // A misspelled subject falls back to the _default profile, so the case
    // would silently be marked without the conventions it was written to test.
    const profiled = new Set(getProfiledSubjects());
    for (const c of CASES) {
        assert.ok(profiled.has(c.subject), `${c.id} names "${c.subject}", which has no profile`);
    }
});

check("the discriminating cases are the ones the prompt change should move", () => {
    // If the eval cannot see the change, the change cannot be evaluated. These
    // are the cases whose gold depends on a convention the marker only has
    // because the profile now reaches it.
    const disc = CASES.filter((c) => c.tags.includes("discriminating"));
    assert.ok(disc.length >= 5, `only ${disc.length} discriminating cases`);
    const ids = new Set(disc.map((c) => c.id));
    for (const needed of ["methods-exact-form", "bio-command-term", "right-answer-no-working"]) {
        assert.ok(ids.has(needed), `${needed} is not marked discriminating`);
    }
});

/* ── The grader, against hand-built marking responses ────────────────────── */

const crit = (text, got, worth, note = "") => ({ text, got, worth, note });

check("THE RECONCILED MARK WINS over the model's stated total", () => {
    // quizScore.js's rule: when the stated figure contradicts the criteria, the
    // criteria are the ledger. Grading the raw claim would score the marker on
    // a number no student ever sees.
    const fb = {
        marks: 5,                                  // the model's claim
        criteria: [crit("a", true, 1), crit("b", false, 1, "x"), crit("c", true, 1)],
    };
    assert.equal(awardedMark(fb, 3), 2, "took the stated total instead of the criteria");
    // With no usable criteria the stated figure is all there is, clamped.
    assert.equal(awardedMark({ marks: 9, criteria: [] }, 3), 3);
    assert.equal(awardedMark({ marks: -4, criteria: [] }, 3), 0);
    assert.equal(awardedMark({ criteria: [] }, 3), null, "no number at all is null, not zero");
    // A criterion with no text or no worth is not usable and must not silently
    // drag the total down.
    assert.equal(awardedMark({ marks: 2, criteria: [{ text: "", got: true, worth: 2 }] }, 2), 2);
});

check("worths must sum to the allocation, and an empty list is N/A", () => {
    assert.equal(criteriaSumOk({ criteria: [crit("a", true, 2), crit("b", false, 1, "x")] }, 3), true);
    assert.equal(criteriaSumOk({ criteria: [crit("a", true, 2)] }, 3), false);
    assert.equal(criteriaSumOk({ criteria: [] }, 3), null, "an MCQ has nothing to itemise");
    assert.equal(criteriaSumOk({}, 3), null);
});

check("A PARAPHRASED QUOTE IS A DROPPED ANNOTATION, and nothing reports it", () => {
    // annotate.js matches EXACTLY and discards anything that does not, so this
    // check is measuring feedback the student silently never receives.
    const answer = "The rate goes up because the particles move faster.";
    assert.equal(quotesVerbatim({ annotations: [{ quote: "the particles move faster" }] }, answer), true);
    assert.equal(quotesVerbatim({ annotations: [{ quote: "particles moving faster" }] }, answer), false,
        "a paraphrase passed — it would be dropped in the app");
    assert.equal(quotesVerbatim({ annotations: [{ quote: "The Particles Move Faster" }] }, answer), false,
        "case differs, so it would not match");
    assert.equal(quotesVerbatim({ annotations: [] }, answer), null, "zero annotations is normal");
    assert.equal(quotesVerbatim({ annotations: [{ quote: "  " }] }, answer), null);
});

check("`Number(null) === 0` MUST NOT LINK AN ANNOTATION TO CRITERION ZERO", () => {
    // The trap that has now reached six modules in this repo. Coercing a
    // missing index attaches every unlinked annotation to the first criterion,
    // which blames the wrong mark — exactly what the join exists to prevent.
    const criteria = [crit("a", true, 1), crit("b", false, 1, "x")];
    assert.equal(annotationsLinked({ criteria, annotations: [{ criterion_index: 1 }] }), true);
    assert.equal(annotationsLinked({ criteria, annotations: [{ criterion_index: null }] }), false);
    assert.equal(annotationsLinked({ criteria, annotations: [{}] }), false);
    assert.equal(annotationsLinked({ criteria, annotations: [{ criterion_index: 7 }] }), false);
    assert.equal(annotationsLinked({ criteria, annotations: [{ criterion_index: 1.5 }] }), false);
    assert.equal(annotationsLinked({ criteria, annotations: [] }), null);
});

check("A CLEAN MARK IS SILENT, and the check only applies where it can", () => {
    const clean = { what_wrong: "", improve: "", annotations: [], criteria: [crit("a", true, 2)] };
    assert.equal(cleanIsSilent(clean, 2, 2), true);
    assert.equal(cleanIsSilent({ ...clean, improve: "Great work, keep it up!" }, 2, 2), false);
    assert.equal(cleanIsSilent({ ...clean, annotations: [{ quote: "x" }] }, 2, 2), false);
    // Not full marks: the rule has nothing to say, and counting it as a pass
    // would inflate the metric across most of the set.
    assert.equal(cleanIsSilent({ ...clean, improve: "Name the transfer." }, 1, 2), null);
});

check("a missed criterion carries a note that stands on its own", () => {
    const long = "A full-mark response names the activation energy explicitly.";
    assert.equal(missedHaveNotes({ criteria: [crit("a", false, 1, long)] }), true);
    assert.equal(missedHaveNotes({ criteria: [crit("a", false, 1, "")] }), false);
    assert.equal(missedHaveNotes({ criteria: [crit("a", false, 1, "more detail")] }), false,
        "a note too short to act on is not a note");
    assert.equal(missedHaveNotes({ criteria: [crit("a", true, 1)] }), null, "nothing was missed");
});

check("the whole grade drops N/A rather than scoring it", () => {
    const mcqCase = CASES.find((c) => c.id === "mcq-right");
    const g = programmaticGrade(mcqCase, { marks: 1, criteria: [], annotations: [], what_wrong: "", improve: "" });
    assert.equal(g.mark_exact, 1);
    assert.equal(g.mark_mae, 0);
    assert.ok(!("crit_sum" in g), "an MCQ with no criteria was scored on summing them");
    assert.ok(!("quote_ok" in g), "no annotations, so nothing to check");
    assert.equal(g.clean_silent, 1, "full marks and silent");
});

check("A WRONG MARK IS CAUGHT, and the size of the miss is reported", () => {
    const c = CASES.find((x) => x.id === "methods-exact-form");   // gold 1 of 2
    const lenient = programmaticGrade(c, {
        marks: 2, criteria: [crit("method", true, 1), crit("accuracy", true, 1)],
        annotations: [], what_wrong: "", improve: "",
    });
    assert.equal(lenient.mark_exact, 0, "awarding the decimal full marks scored as exact");
    assert.equal(lenient.mark_mae, 1);

    const right = programmaticGrade(c, {
        marks: 1,
        criteria: [crit("method", true, 1), crit("exact value", false, 1, "A full-mark response states 3/4 rather than 0.75.")],
        annotations: [{ quote: "0.75", criterion_index: 1 }], what_wrong: "x", improve: "y",
    });
    assert.equal(right.mark_exact, 1);
    assert.equal(right.mark_mae, 0);
    assert.equal(right.quote_ok, 1, "the quote is in the answer");
    assert.equal(right.link_ok, 1);
    assert.equal(right.note_ok, 1);
});

check("an unparseable response is a scored failure, not an error", () => {
    const c = CASES.find((x) => x.id === "bio-partial");          // 4 marks
    const g = programmaticGrade(c, {});
    assert.equal(g.mark_exact, 0);
    assert.equal(g.mark_mae, 4, "a response with no mark is out by the whole allocation");
});

check("the multipart case grades against the PAPER's total, not one part", () => {
    const c = CASES.find((x) => x.id === "multipart-split");
    assert.equal(c.marks, 5);
    assert.equal(c.parts.reduce((t, p) => t + p.marks, 0), 5, "the parts do not sum to the allocation");
    // Part (b) earns the conclusion and drops the reasoning, which is what the
    // gold says — itemising it as one missed 3-mark criterion would award 2 and
    // is the shape that made this fixture wrong the first time.
    const g = programmaticGrade(c, {
        marks: 3,
        criteria: [
            crit("(a) applies conservation of momentum to reach 1.0 m/s", true, 2),
            crit("(b) concludes the collision is inelastic", true, 1),
            crit("(b) shows kinetic energy before and after", false, 2,
                "A full-mark response computes Ek before and after and states that it is not conserved."),
        ],
        annotations: [], what_wrong: "x", improve: "y",
    });
    assert.equal(g.mark_exact, 1);
    assert.equal(g.crit_sum, 1);
});

check("THE JUDGE'S NULLS LEAVE THE DENOMINATOR", () => {
    // A block where four claims apply and all four hold is 1.0. Counting the
    // inapplicable fifth as a pass would give the same number to a block that
    // failed one — the two must not be indistinguishable.
    assert.equal(registerScore({
        addresses_response: 1, no_praise: 1, names_command_term: null,
        says_what_would_score: 1, no_invented_criticism: 1,
    }), 1);
    assert.equal(registerScore({
        addresses_response: 1, no_praise: 0, names_command_term: null,
        says_what_would_score: 1, no_invented_criticism: 1,
    }), 0.75);
    assert.equal(registerScore({}), null, "nothing applied, so there is no score");
    assert.equal(registerScore(null), null);
});

check("the judge is shown what the STUDENT reads, and never the gold", () => {
    const text = feedbackText({
        what_wrong: "The response describes rather than evaluates.",
        improve: "",
        criteria: [crit("weighs both sides", false, 2, "A full-mark response reaches a judgement.")],
        annotations: [{ quote: "uses visible light", issue: "description, not evaluation", wanted: "a judgement", fixes: ["On balance it is unsuitable"] }],
    });
    assert.match(text, /describes rather than evaluates/);
    assert.match(text, /weighs both sides/);
    assert.match(text, /uses visible light/);
    assert.ok(!/gold/i.test(text), "the rendered feedback leaked a gold field");
    assert.equal(feedbackText({}), "(the marker returned no feedback at all)");
});

/* ── The harness is pointed at the real thing ────────────────────────────── */

check("the runner marks through `markingSystem`, not a prompt of its own", () => {
    // An eval that builds its own prompt measures that prompt. The whole point
    // is to measure the one the app ships.
    const src = fs.readFileSync(path.join(ROOT, "eval/quizMarking/run-eval.mjs"), "utf8");
    assert.ok(/import \{ markingSystem \}/.test(src), "the runner does not import the real system block");
    assert.ok(/system: \[\{ type: 'text', text: system, cache_control/.test(src),
        "the system block is not sent as a cached system block, so the cache figures are meaningless");
    assert.ok(/No answer provided/.test(src),
        "a blank answer must be sent the way production sends it, or the blank case tests nothing real");
});

check("_state.json declares the metrics the grader actually emits", () => {
    // The report reads per-case scores from `grade` and draws columns from
    // `metrics`. A declared metric the runner never populates renders as
    // dashes; an emitted one that is not declared is invisible.
    const st = JSON.parse(fs.readFileSync(path.join(ROOT, ".claude/hillclimb/quiz-marking/_state.json"), "utf8"));
    const declared = st.metrics.map((m) => m.id);
    assert.equal(declared[0], "mark_exact", "the headline metric must be first");
    assert.equal(st.metrics[0].kind, "binary", "the headline must be the first binary metric");
    for (const m of st.metrics) assert.ok(m.label.length <= 14, `"${m.label}" is too long for the legend`);

    // Everything the grader can emit, gathered from a case that exercises all of it.
    const c = CASES.find((x) => x.id === "half-right-terminology");
    const emitted = Object.keys(programmaticGrade(c, {
        marks: 2,
        criteria: [crit("a", true, 1), crit("b", true, 1), crit("c", false, 1, "A full-mark response says molecules are separated, not bonds broken.")],
        annotations: [{ quote: "stronger bonds", criterion_index: 2 }],
        what_wrong: "x", improve: "y",
    }));
    for (const id of emitted) {
        assert.ok(declared.includes(id), `the grader emits "${id}" and _state.json does not declare it`);
    }
    assert.ok(declared.includes("register"), "the judge metric is not declared");

    // The harness gate hashes these; a path that has moved silently covers nothing.
    for (const p of st.harness_paths) {
        assert.ok(fs.existsSync(path.join(ROOT, p)), `harness_paths names a missing file: ${p}`);
    }
});

console.log(`\nevalCases: ${passed} checks passed`);
