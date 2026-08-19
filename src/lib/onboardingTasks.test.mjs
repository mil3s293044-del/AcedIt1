/**
 * onboardingTasks assertions.
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/onboardingTasks.test.mjs
 *
 * The regression case is a student who came through the whole signup wizard.
 * They answered everything, and the dashboard still told them to go and set up.
 */
import assert from "node:assert/strict";
import { taskState, outstandingTasks, needsSetup, setupCopy } from "@/lib/onboardingTasks";

let passed = 0;
const check = (name, fn) => {
    try {
        fn();
        passed += 1;
        console.log(`  ok  ${name}`);
    } catch (err) {
        console.error(`FAIL  ${name}\n      ${err.message}`);
        process.exitCode = 1;
    }
};

/** Exactly what AuthContext writes when the wizard finishes, plus signup name. */
const wizardGraduate = {
    full_name: "Miles",
    goal_atar: 92,
    goal_course_name: "Computer Science",
    onboarding_tasks: { subjects_selected: true, goals_set: true },  // note: no username_set
};

/** What the OLD gate computed. */
const oldGate = (p) => {
    const t = p.onboarding_tasks || {};
    return !!(t.username_set && t.subjects_selected && t.goals_set);
};

console.log("\nonboardingTasks\n");

check("a wizard graduate is not nagged to set up [REGRESSION]", () => {
    assert.equal(oldGate(wizardGraduate), false, "the old gate really did nag them");
    assert.equal(needsSetup(wizardGraduate, { hasSubjects: true }), false,
        "someone who answered every wizard question owes us nothing");
});

check("a name from the auth provider counts as a username", () => {
    // AuthContext never wrote username_set, so this had to be derived.
    assert.equal(taskState({ full_name: "Miles" }).username_set, true);
    assert.equal(taskState({ username: "miles" }).username_set, true);
    assert.equal(taskState({ display_name: "Miles" }).username_set, true);
    assert.equal(taskState({}).username_set, false);
});

check("blank and whitespace names do not count", () => {
    assert.equal(taskState({ full_name: "" }).username_set, false);
    assert.equal(taskState({ username: "   " }).username_set, false);
});

check("a goal counts however it was expressed", () => {
    assert.equal(taskState({ goal_atar: 92 }).goals_set, true);
    assert.equal(taskState({ goal_course_name: "Law" }).goals_set, true);
    assert.equal(taskState({ goal_university: "Monash" }).goals_set, true);
    assert.equal(taskState({}).goals_set, false);
});

check("goal_atar of 0 does not read as unset", () => {
    // A real edge: 0 is falsy, and someone can legitimately store it.
    assert.equal(taskState({ goal_atar: 0 }).goals_set, false, "0 is not a target anyone set");
    assert.equal(taskState({ goal_atar: 1 }).goals_set, true);
});

check("subject rows count even when the flag was never written", () => {
    assert.equal(taskState({}, { hasSubjects: true }).subjects_selected, true);
    assert.equal(taskState({}, { hasSubjects: false }).subjects_selected, false);
    assert.equal(taskState({ onboarding_tasks: { subjects_selected: true } }).subjects_selected, true);
});

check("a brand new account with nothing still gets the full nudge", () => {
    const fresh = {};
    assert.deepEqual(outstandingTasks(fresh, { hasSubjects: false }),
        ["username_set", "subjects_selected", "goals_set"]);
    assert.equal(needsSetup(fresh, { hasSubjects: false }), true);
});

check("an explicit dismissal always wins", () => {
    const dismissed = { onboarding_completed: true };
    assert.equal(needsSetup(dismissed, { hasSubjects: false }), false);
});

check("no profile means no nudge", () => {
    assert.equal(needsSetup(null), false);
    assert.equal(needsSetup(undefined), false);
});

check("copy matches how much is actually left", () => {
    // "Quick setup. Five minutes." in front of one field is what taught
    // students to ignore this card.
    const oneLeft = setupCopy({ goal_atar: 92 }, { hasSubjects: true });
    assert.match(oneLeft.title, /username/i);
    assert.doesNotMatch(oneLeft.title, /five minutes/i);

    const allLeft = setupCopy({}, { hasSubjects: false });
    assert.match(allLeft.title, /3 things/);

    assert.equal(setupCopy(wizardGraduate, { hasSubjects: true }), null,
        "nothing outstanding means nothing to say");
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}\n`);
