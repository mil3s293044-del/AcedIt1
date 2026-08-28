/**
 * guided walkthrough assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/guidedRun.test.mjs
 *
 * Two classes of bug live here, and they fail differently.
 *
 * The first is silent: a step points at `[data-run-target="quizzes"]`, someone
 * rewrites the quiz header, and the attribute goes. Nothing throws — Ace just
 * stops appearing, and we would find out from a student. So the selectors are
 * asserted against the real page source, the same way routes.test.mjs asserts
 * routes against pages.config.
 *
 * The second is the one that pays out wrongly: a step advancing on anything
 * other than a row that exists. Every predicate is asserted against both a
 * shape that proves it and one that does not, including the empty shape.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    FREE_STEPS, PREMIUM_STEPS, ALL_STEPS, RUN_IDS, STEP_XP, FINISH_XP,
    readRuns, runRecord, withRunPatch, runProgress, chooseRun, activeRun,
    unpaidSteps, preexistingSteps, xpFor, eventKeyFor, stepsFor,
} from "@/lib/guidedRun";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ── The steps point at things that exist ────────────────────────────────────

check("every step's target attribute exists in the page it names", () => {
    for (const s of ALL_STEPS) {
        assert.ok(fs.existsSync(s.file), `${s.id}: ${s.file} does not exist`);
        const src = strip(fs.readFileSync(s.file, "utf8"));
        // '[data-run-target="quizzes"]' → the attribute value it needs to find.
        const value = s.target.match(/data-run-target="([^"]+)"/)?.[1];
        assert.ok(value, `${s.id}: target is not a data-run-target selector`);
        // Most anchors are a literal attribute. One is set from inside a map
        // over the technique tiles, so the literal never appears in source —
        // for those the file has to carry BOTH the attribute and the value,
        // which still fails if either the anchor or the name is removed. That
        // is a proxy for "the selector matches in the browser", not a proof of
        // it; the exact check is the click-through in a real page.
        const literal = src.includes(`data-run-target="${value}"`);
        const bound = src.includes("data-run-target=") && src.includes(`"${value}"`);
        assert.ok(
            literal || bound,
            `${s.id}: nothing in ${s.file} carries data-run-target="${value}" — ` +
            `the step will render but Ace will never point at anything`);
    }
});

check("every step links to a page that is actually routed", () => {
    const config = strip(fs.readFileSync("src/pages.config.js", "utf8"));
    const m = config.match(/export const PAGES = \{([\s\S]*?)\n\}/);
    assert.ok(m, "PAGES object not found outside comments");
    const routes = [...m[1].matchAll(/"([A-Za-z0-9_]+)"\s*:/g)].map((x) => x[1]);
    for (const s of ALL_STEPS) {
        const key = s.to.replace(/^\//, "").split("?")[0];
        assert.ok(routes.includes(key), `${s.id}: /${key} is not a registered route`);
        assert.equal(s.page, key, `${s.id}: page "${s.page}" and to "${s.to}" disagree`);
    }
});

check("step ids and event keys are unique", () => {
    const ids = ALL_STEPS.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate step id");
    const keys = ids.map(eventKeyFor);
    assert.equal(new Set(keys).size, keys.length, "two steps would share an XP event_key");
});

check("every step carries the copy the card renders", () => {
    for (const s of ALL_STEPS) {
        for (const field of ["label", "ask", "why", "here"]) {
            assert.ok(s[field]?.length > 0, `${s.id}: missing ${field}`);
        }
        // Voice guardrails from CLAUDE.md. A tour is exactly where a tired
        // writer reaches for "Don't just re-read".
        for (const banned of ["Don't", "Fix it", "No excuses", "Embarrassing"]) {
            for (const field of ["ask", "why", "here"]) {
                assert.ok(!s[field].includes(banned), `${s.id}.${field} uses banned word "${banned}"`);
            }
        }
    }
});

// ── Evidence: a row exists, or the step is not done ─────────────────────────

const [subjectsStep, quizStep, recallStep] = FREE_STEPS;

check("no step is done on empty data", () => {
    for (const s of ALL_STEPS) {
        assert.equal(s.done({}), false, `${s.id} claimed done with nothing to show for it`);
    }
});

check("no step throws on a shape we did not expect", () => {
    const junk = { subjects: "nope", quizAttempts: 7, techniques: null, aiResults: { a: 1 } };
    for (const s of ALL_STEPS) {
        assert.doesNotThrow(() => s.done(junk), `${s.id} threw`);
        assert.equal(runProgress(s.run, junk).steps.find((x) => x.id === s.id).done, false);
    }
});

check("the quiz step wants a SAT quiz, not a generated one", () => {
    assert.equal(quizStep.done({ quizzes: [{ id: "q1" }] }), false,
        "a quiz that was generated and never opened is not the rep");
    assert.equal(quizStep.done({ quizAttempts: [{ id: "a1" }] }), true);
});

check("the recall step accepts either table it can land in", () => {
    // The trap the ATAR planning component already fell into: the technique
    // rows and the session rows are different tables, and Study writes both.
    assert.equal(recallStep.done({ techniques: [{ technique_name: "active_recall" }] }), true);
    assert.equal(recallStep.done({ recallSessions: [{ id: "r1" }] }), true);
    assert.equal(recallStep.done({ techniques: [{ technique_name: "pomodoro" }] }), false);
});

check("AI tool steps read both spellings of -ise", () => {
    const [explain] = PREMIUM_STEPS;
    assert.equal(explain.done({ aiResults: [{ tool_type: "concept_explainer" }] }), true);
    const summarise = PREMIUM_STEPS.find((s) => s.id === "premium_teach");
    assert.equal(summarise.done({ aiResults: [{ tool_type: "TEACHING_ASSISTANT" }] }), true,
        "casing should not lose a student's history");
});

// ── Progress derives, never remembers ───────────────────────────────────────

check("the active step is the first one with no evidence, not a stored cursor", () => {
    // Step three done, step two not — students do this constantly.
    const data = { subjects: [{ id: "s" }], recallSessions: [{ id: "r" }] };
    const p = runProgress("free", data);
    assert.equal(p.active.id, quizStep.id);
    assert.equal(p.doneCount, 2);
    assert.equal(p.complete, false);
});

check("a student who came through the signup wizard starts on the quiz", () => {
    const p = runProgress("free", { subjects: [{ id: "s" }] });
    assert.equal(p.steps[0].done, true, "subjects were collected by the wizard");
    assert.equal(p.active.id, quizStep.id, "nobody is asked to redo work they have done");
});

check("a run with every step satisfied reports complete", () => {
    const p = runProgress("free", {
        subjects: [{ id: "s" }], quizAttempts: [{ id: "a" }], recallSessions: [{ id: "r" }],
    });
    assert.equal(p.complete, true);
    assert.equal(p.active, null);
});

// ── Stored state ────────────────────────────────────────────────────────────

check("an unreadable profile normalises to unstarted rather than throwing", () => {
    for (const p of [null, {}, { extra: null }, { extra: { guided_run: "yes" } },
                     { extra: { guided_run: { free: 7 } } }]) {
        const runs = readRuns(p);
        for (const id of RUN_IDS) {
            assert.equal(runs[id].status, "unstarted");
            assert.deepEqual(runs[id].paid, []);
            assert.deepEqual(runs[id].preexisting, []);
        }
    }
});

check("a patch keeps everything else living in extra", () => {
    const profile = {
        extra: {
            daily_intent: { mode: "cramming", date: "2026-08-28" },
            intent_log: [1, 2, 3],
            year_level: 12,
            guided_run: { free: { status: "active", paid: ["free_subjects"] } },
        },
    };
    const next = withRunPatch(profile, "free", { status: "done" });
    assert.deepEqual(next.daily_intent, profile.extra.daily_intent);
    assert.deepEqual(next.intent_log, [1, 2, 3]);
    assert.equal(next.year_level, 12);
    assert.equal(next.guided_run.free.status, "done");
    assert.deepEqual(next.guided_run.free.paid, ["free_subjects"], "paid history survived the patch");
    assert.equal(next.guided_run.premium.status, "unstarted", "the other run is still there");
    assert.equal(profile.extra.guided_run.free.status, "active", "the input was not mutated");
});

// ── Which run, if any ───────────────────────────────────────────────────────

check("a brand new student gets the free run", () => {
    assert.equal(chooseRun({ extra: {} }), "free");
});

check("premium wins the moment it is owed", () => {
    const done = { extra: { guided_run: { free: { status: "done" } } } };
    assert.equal(chooseRun(done, { premium: true }), "premium");
    assert.equal(chooseRun(done, { premium: false }), null);
    // Mid-way through the free run and they upgrade: show them what they bought.
    const midway = { extra: { guided_run: { free: { status: "active" } } } };
    assert.equal(chooseRun(midway, { premium: true }), "premium");
});

check("a run the student stopped stays stopped", () => {
    const skipped = { extra: { guided_run: { free: { status: "skipped" } } } };
    assert.equal(chooseRun(skipped), null);
    assert.equal(chooseRun(skipped, { premium: true }), "premium");
});

check("both runs finished means no card, ever", () => {
    const p = { extra: { guided_run: { free: { status: "done" }, premium: { status: "done" } } } };
    assert.equal(chooseRun(p, { premium: true }), null);
});

check("a run whose steps are all already satisfied never opens", () => {
    const profile = { extra: {} };
    const everything = {
        subjects: [{ id: "s" }], quizAttempts: [{ id: "a" }], recallSessions: [{ id: "r" }],
    };
    assert.equal(activeRun(profile, everything), null, "nothing to ask for, so nothing to dismiss");
    assert.equal(activeRun(profile, { subjects: [{ id: "s" }] }), "free");
    assert.equal(activeRun(profile, null), null, "nothing loaded yet proves nothing either way");
});

// ── Payout ──────────────────────────────────────────────────────────────────

check("only finished, unpaid steps are worth a call", () => {
    const data = { subjects: [{ id: "s" }], quizAttempts: [{ id: "a" }] };
    const rec = { ...runRecord({ extra: {} }, "free"), paid: ["free_subjects"] };
    const owed = unpaidSteps("free", data, rec).map((s) => s.id);
    assert.deepEqual(owed, ["free_quiz"]);
});

check("work finished before the run opened is ticked but never paid for", () => {
    // Switching this on hands a run to every existing account. Most of them
    // already have subjects and have sat a quiz, so paying on "the row exists"
    // alone would post 80 XP to a hundred-odd students for logging in.
    const data = { subjects: [{ id: "s" }], quizAttempts: [{ id: "a" }] };
    const rec = { ...runRecord({ extra: {} }, "free"), preexisting: preexistingSteps("free", data) };
    assert.deepEqual(rec.preexisting, ["free_subjects", "free_quiz"]);
    assert.deepEqual(unpaidSteps("free", data, rec), []);

    // ...and the same steps still count toward the progress bar, because they
    // are done. Being told to redo them would be the worse bug.
    const prog = runProgress("free", data, rec);
    assert.equal(prog.doneCount, 2);
    assert.equal(prog.active.id, "free_recall");

    // The step they then go and do inside the run pays normally.
    const after = { ...data, recallSessions: [{ id: "r" }] };
    assert.deepEqual(unpaidSteps("free", after, rec).map((s) => s.id), ["free_recall"]);
});

check("a run opened with nothing done pays for all of it", () => {
    assert.deepEqual(preexistingSteps("free", {}), []);
    const rec = runRecord({ extra: {} }, "free");
    const everything = {
        subjects: [{ id: "s" }], quizAttempts: [{ id: "a" }], recallSessions: [{ id: "r" }],
    };
    assert.equal(unpaidSteps("free", everything, rec).length, 3);
});

check("the last step of a run carries the finish bonus", () => {
    for (const id of RUN_IDS) {
        const steps = stepsFor(id);
        for (const s of steps.slice(0, -1)) assert.equal(xpFor(s.id), STEP_XP, s.id);
        assert.equal(xpFor(steps[steps.length - 1].id), STEP_XP + FINISH_XP);
    }
    assert.equal(xpFor("not_a_step"), 0);
});

check("the payout is idempotent on a key derived from the step", () => {
    assert.equal(eventKeyFor("free_quiz"), "guided_run_free_quiz");
});

console.log(`\n${passed} passed`);
