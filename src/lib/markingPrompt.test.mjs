/**
 * marking-prompt assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/markingPrompt.test.mjs
 *
 * Every failure this file guards renders perfectly, passes lint, passes the
 * build, and produces a marked quiz a student will read and act on. There is no
 * runtime signal for any of them, which is the same reason `fnResult.test.mjs`
 * and `quizScore.test.mjs` exist.
 *
 * THREE CLASSES:
 *
 * 1. THE PROFILE NOT REACHING THE MARKER. This is the bug the module was
 *    written for. `subjectExaminerPrompts.js` was imported by six surfaces and
 *    the one that MARKS took only the LaTeX rules from it, so the prompt asked
 *    for a VCAA examiner's report with none of VCAA's conventions in it. A
 *    scan over QuizPlayer is what catches that coming back — an import quietly
 *    reverting to `getLatexRules` is invisible in a diff review of a 1,000-line
 *    file.
 *
 * 2. A PROMPT ARGUING WITH ITSELF. "Be lenient on phrasing" sat above mark
 *    conventions saying a decimal cannot earn a mark the question asked for
 *    exactly. Both instructions are reasonable; together they are a coin toss
 *    the student pays for. The scan asserts the contradiction has not returned.
 *
 * 3. CACHING THAT DOES NOT CACHE. A system block under the model's minimum
 *    prefix is sent in full and billed in full, every call, and reports
 *    `cache_creation_input_tokens: 0` with no error. The only way to notice is
 *    to check the size against the floor, which is what `cachesFor` does.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    markingSystem, cachesFor, cacheFloorFor, approxTokens, MIN_CACHEABLE_PREFIX,
} from "@/lib/markingPrompt";
import { EXEMPLARS, DISTRIBUTIONS, exemplarsFor, exemplarSection, distributionNote } from "@/lib/examinerReports";
import { getProfiledSubjects, getExaminerPrompt, subjectIsMathHeavy } from "@/lib/subjectExaminerPrompts";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Source with comments removed, so a note ABOUT a pattern is not the pattern. */
const withoutComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

/* ── 1. The profile reaches the marker ───────────────────────────────────── */

check("THE MARKING PROMPT CARRIES THE SUBJECT'S EXAMINER PROFILE", () => {
    // The whole point. A profile the marker cannot see is a profile that does
    // not exist, and the prompt's own instruction to "use the command term" is
    // unanswerable without the command-term table.
    const block = markingSystem("Chemistry");
    const profile = getExaminerPrompt("Chemistry");
    assert.ok(block.includes(profile), "the examiner profile is not in the marking block");
    assert.ok(/VCAA COMMAND TERMS/.test(block), "the command-term table is missing");
    assert.ok(/MARK ALLOCATION CONVENTIONS/.test(block), "the mark conventions are missing");
    assert.ok(/COMMON STUDENT ERRORS/.test(block), "the per-subject error list is missing");
});

check("QuizPlayer marks THROUGH the composer, not off the LaTeX rules alone", () => {
    // The original bug, pinned at its source. QuizPlayer imported
    // `getLatexRules` and nothing else from the examiner module.
    const src = read("src/components/quizzes/QuizPlayer.jsx");
    assert.ok(/markingSystem/.test(src), "QuizPlayer no longer composes the marking system block");
    assert.ok(/system:\s*markingSystem\(/.test(src),
        "the block is built but not passed as `system` — it would not be cached");
    // BOTH model calls in this file, not just the marking one: `askWhyRight`
    // sends the identical block so it rides the same cache entry, and an
    // examiner profile that reaches one call and not its neighbour is the
    // half-wired state this module was written to end.
    const calls = (withoutComments(src).match(/Core\.InvokeLLM\(\{[\s\S]{0,400}/g) || []);
    assert.equal(calls.length, 2, "the number of model calls in QuizPlayer moved — re-check this scan");
    for (const call of calls) {
        assert.ok(/system:\s*markingSystem\(/.test(call),
            "a model call here sends no examiner profile");
    }
    assert.ok(!/getLatexRules\(\)/.test(withoutComments(src)),
        "QuizPlayer is back on the bare LaTeX rules, which is the bug this module replaced");
});

check("the SERVER hoists a declared system block, or nothing is cached", () => {
    // `system` is only a cacheable prefix if the server puts it in `request.system`
    // with cache_control. Reading it and concatenating it back into the user
    // message would work perfectly and cache nothing.
    const src = read("server.mjs");
    assert.ok(/splitSystemAndUser\(promptText,\s*params\.system\)/.test(src),
        "the server ignores params.system, so a declared block rides in the user message");
    assert.ok(/cache_control:\s*\{\s*type:\s*"ephemeral"\s*\}/.test(src),
        "the system block is sent without cache_control");
    // And the field is model-directed text from the client, so it is scanned.
    assert.ok(/detectThreat\(`\$\{params\.system/.test(src),
        "params.system bypasses the threat scan that params.prompt goes through");
});

/* ── 2. The prompt does not argue with itself ─────────────────────────────── */

check("\"BE LENIENT ON PHRASING\" IS GONE, because the conventions contradict it", () => {
    const block = markingSystem("Mathematical Methods");
    assert.ok(!/lenient on phrasing/i.test(block),
        "the leniency line is back, above conventions saying a decimal earns no mark");
    // Comments stripped: this file's own note explains the line that was
    // removed, and a scan that cannot tell an explanation from an instruction
    // makes the codebase unable to record its own fixes.
    assert.ok(!/lenient on phrasing/i.test(withoutComments(read("src/components/quizzes/QuizPlayer.jsx"))));
    // What was actually meant survives, stated about the things VCAA also does
    // not penalise — otherwise this test would just push markers toward harshness.
    assert.ok(/do\s+not\s+deduct\s+for\s+spelling/i.test(block),
        "removing the leniency line must not leave the marker penalising spelling");
});

check("ONE LaTeX rule set, never two", () => {
    // `getLatexRules()` IS the block `getExaminerPrompt` appends for a math-heavy
    // subject, so composing both prints the delimiter rules twice — contradictory
    // in no way, but duplicated instructions and duplicated cached tokens.
    for (const subject of ["Mathematical Methods", "Specialist Mathematics", "Chemistry"]) {
        const block = markingSystem(subject);
        const hits = block.match(/MATHEMATICAL NOTATION \(REQUIRED\)/g) || [];
        assert.equal(hits.length, 1, `${subject} states the LaTeX rules ${hits.length} times`);
    }
    // And a prose subject still gets them — a quiz can contain a figure anywhere.
    assert.ok(!subjectIsMathHeavy("Legal Studies"));
    assert.ok(/MATHEMATICAL NOTATION \(REQUIRED\)/.test(markingSystem("Legal Studies")));
});

/* ── 3. Caching that actually caches ─────────────────────────────────────── */

check("the composed block CLEARS the floor on every model marking runs on", () => {
    // Under the floor is not an error and not visible: the block is sent and
    // billed in full and the usage line reports a zero.
    for (const model of ["claude-sonnet-5-5", "claude-sonnet-4-6", "claude-opus-5"]) {
        for (const subject of ["Chemistry", "English", "Legal Studies", "Anything Unprofiled"]) {
            assert.ok(cachesFor(subject, model),
                `${subject} on ${model} is under the ${cacheFloorFor(model)}-token floor`);
        }
    }
});

check("AN UNKNOWN MODEL GETS THE STRICTEST FLOOR, never the loosest", () => {
    // Guessing generously would report a block as cached while it is billed in
    // full on every mark, which is the silent direction.
    const strictest = Math.max(...Object.values(MIN_CACHEABLE_PREFIX));
    assert.equal(cacheFloorFor("claude-who-knows"), strictest);
    assert.equal(cacheFloorFor(""), strictest);
    assert.equal(cacheFloorFor(null), strictest);
    // Longest prefix wins, the same rule priceFor keeps: 5-5 is not 5.
    assert.ok(cacheFloorFor("claude-sonnet-5-5") <= cacheFloorFor("claude-sonnet-5"));
    assert.equal(cacheFloorFor("claude-haiku-4-5-20251001"), MIN_CACHEABLE_PREFIX["claude-haiku-4-5"]);
});

check("Haiku's floor is NOT cleared, and that is recorded rather than hidden", () => {
    // SAVER_EXCLUDES ships empty on purpose, so a Saver student's marking runs
    // on Haiku 4.5, whose minimum prefix is 4096. The block is ~2-3k, so it does
    // not cache there. Asserted so the fact stays true in the file that claims
    // it, rather than drifting into an unearned "it caches everywhere".
    assert.equal(cachesFor("Chemistry", "claude-haiku-4-5"), false);
    assert.equal(MIN_CACHEABLE_PREFIX["claude-haiku-4-5"], 4096);
});

check("the estimator over-counts rather than under-counts", () => {
    // A block this calls big enough really is. Four chars per token is above the
    // real ratio for English prose, so the estimate is pessimistic.
    assert.equal(approxTokens(""), 0);
    assert.equal(approxTokens(null), 0);
    assert.equal(approxTokens("abcd"), 1);
    assert.equal(approxTokens("abcde"), 2, "partial tokens round up");
});

/* ── The worked marks ────────────────────────────────────────────────────── */

check("every exemplar's criteria worths sum to its allocation", () => {
    // The rubric demands this of the model, so an exemplar that breaks it is
    // teaching the opposite of the instruction next to it.
    for (const [subject, rows] of Object.entries(EXEMPLARS)) {
        for (const ex of rows) {
            const sum = ex.criteria.reduce((t, c) => t + c.worth, 0);
            assert.equal(sum, ex.outOf, `${subject} exemplar worths sum to ${sum}, not ${ex.outOf}`);
            const got = ex.criteria.filter((c) => c.got).reduce((t, c) => t + c.worth, 0);
            assert.equal(got, ex.awarded,
                `${subject} exemplar awards ${ex.awarded} but its met criteria are worth ${got}`);
        }
    }
});

check("A MISSED CRITERION ALWAYS CARRIES ITS NOTE, and a met one never does", () => {
    // The rubric's own words: "a missed criterion with an empty note is a mark
    // the student cannot act on". An exemplar that shows one demonstrates the
    // failure it is meant to prevent.
    for (const [subject, rows] of Object.entries(EXEMPLARS)) {
        for (const ex of rows) {
            for (const c of ex.criteria) {
                if (c.got) assert.equal(c.note, "", `${subject}: a met criterion carries a note`);
                else assert.ok(c.note && c.note.length > 40,
                    `${subject}: missed criterion "${c.text.slice(0, 40)}" has no usable note`);
            }
        }
    }
});

check("every exemplar declares what it is DERIVED FROM", () => {
    // "A VCAA assessor awarded this 1 of 3" and "these are the published
    // conventions applied to an answer" are different claims. A model told the
    // second is the first has been miscalibrated on purpose, so the provenance
    // is data and the prompt prints it.
    for (const [subject, rows] of Object.entries(EXEMPLARS)) {
        for (const ex of rows) {
            assert.ok(["study-design", "examiner-report"].includes(ex.source),
                `${subject} exemplar has source "${ex.source}"`);
            if (ex.source === "examiner-report") {
                assert.ok(ex.cite, `${subject} claims a real report without citing it`);
            }
        }
        const section = exemplarSection(subject);
        assert.ok(/not a quoted report|real examiner's report/.test(section),
            `${subject}'s rendered section does not state its provenance`);
    }
});

check("an exemplar only exists for a subject with a real profile", () => {
    // A key that does not match `vceSubjects`' spelling silently attaches worked
    // marks to nothing — `getExaminerPrompt` falls back to _default and the
    // exemplars are looked up under the name the caller passed.
    const profiled = new Set(getProfiledSubjects());
    for (const subject of Object.keys(EXEMPLARS)) {
        assert.ok(profiled.has(subject),
            `"${subject}" has worked marks but no examiner profile — check the spelling`);
    }
});

check("an unknown subject degrades to no section, never an empty heading", () => {
    assert.deepEqual(exemplarsFor("Underwater Basket Weaving"), []);
    assert.equal(exemplarSection("Underwater Basket Weaving"), null);
    assert.deepEqual(exemplarsFor(undefined), []);
    assert.equal(exemplarSection(null), null);
    // And the block still composes — the marker must not lose the profile and
    // the rubric because a subject has no worked marks yet.
    const block = markingSystem("Underwater Basket Weaving");
    assert.ok(/HOW TO MARK/.test(block));
    assert.ok(!/WORKED MARKS/.test(block), "a heading over no examples");
});

/* ── Distributions: the carrier ships empty, and says nothing ────────────── */

check("NO MARK DISTRIBUTION IS INVENTED", () => {
    // VCAA's per-question percentages are the most examiner-like datum there is
    // and there is no honest way to produce them from this repo. Fabricating
    // "31% of the state earned this mark" and attributing it to VCAA is the
    // failure `closingFacts` refuses on the first-run screen, one screen in.
    assert.deepEqual(DISTRIBUTIONS, {}, "figures appeared here — where did they come from?");
    assert.equal(distributionNote("Chemistry"), null);
    for (const subject of Object.keys(EXEMPLARS)) {
        const block = markingSystem(subject);
        assert.ok(!/HOW THE STATE SCORED/.test(block),
            `${subject} prints a distribution section with no distribution data`);
        assert.ok(!/\d+% of (the state|candidates|students)/.test(block),
            `${subject}'s block quotes a state percentage`);
    }
});

check("the carrier WORKS, so pasting real figures in is the whole change", () => {
    // Shipping an unused code path is how a feature is discovered broken a year
    // later. Exercised against a fixture rather than against shipped data.
    DISTRIBUTIONS["Chemistry"] = {
        "2023 Exam Q4b": { cite: "VCAA 2023 Chemistry Examination Report", outOf: 3, spread: [41, 28, 19, 12], average: 1.0 },
    };
    try {
        const note = distributionNote("Chemistry");
        assert.ok(note, "a populated distribution produced no note");
        assert.match(note, /2023 Exam Q4b/);
        assert.match(note, /0: 41%/);
        assert.match(note, /3: 12%/);
        assert.match(note, /state average 1\/3/);
        assert.ok(markingSystem("Chemistry").includes(note), "the note is built but not composed in");
        // A row with no spread is not a row.
        DISTRIBUTIONS["Chemistry"]["2024 Exam Q1"] = { outOf: 2 };
        assert.ok(!/2024 Exam Q1/.test(distributionNote("Chemistry")));
    } finally {
        delete DISTRIBUTIONS["Chemistry"];
    }
    assert.deepEqual(DISTRIBUTIONS, {}, "the fixture leaked into shipped data");
});

console.log(`\nmarkingPrompt: ${passed} checks passed`);
