/**
 * study page assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/studyPage.test.mjs
 *
 * The page leads with ONE next step, says one counted fact under each
 * technique, and names the technique once. Every rule here is a sentence a
 * student could check, and every one was broken by putting the bug back.
 */
// Melbourne, because the bugs this file holds are all about a LOCAL day: in a
// UTC container a UTC string and a local one are the same string, and an
// injected `toISOString` would pass silently. Node re-reads TZ on change.
process.env.TZ = "Australia/Melbourne";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    daysUntil, fmtMinutes, minutesSummary, nextDeadline, dominantTechnique,
    techniqueFacts, nextStep, greetingFor, TECHNIQUE_IDS, FALLBACK_FACT,
    READY_NUDGE, DEADLINE_URGENT, DEADLINE_SOON, DEADLINE_SHOWN,
} from "@/lib/studyPage";
import { dayKey } from "@/lib/studyLog";
import { todaysIntent } from "@/lib/studyIntent";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
/** Comments stripped, so a sentence explaining a bug is not read as the bug. */
const code = (rel) => read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

/** A scan that fails names the pattern, not the whole file it searched. */
const absent = (src, re, msg = String(re)) => assert.ok(!re.test(src), `found ${msg}`);
const present = (src, re, msg = String(re)) => assert.ok(re.test(src), `missing ${msg}`);

// A Friday afternoon, local.
const FRI = new Date(2026, 9, 16, 15, 0, 0);
const off = (n, d = FRI) => dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));

// ─── days are local, and counted on the calendar ────────────────────────────

check("an assessment due tomorrow is ONE day away at 3pm, not zero", () => {
    // differenceInDays(dueDate, now) floored nine hours to 0 → "Exam today".
    assert.equal(daysUntil(off(1), FRI), 1);
    assert.equal(daysUntil(off(0), FRI), 0);
    assert.equal(daysUntil(off(-2), FRI), -2);
});

check("a day across a daylight-saving change is still one day", () => {
    // Melbourne goes forward on the first Sunday of October.
    const sat = new Date(2026, 9, 3, 23, 30);
    assert.equal(daysUntil("2026-10-04", sat), 1);
    assert.equal(daysUntil("2026-10-05", sat), 2);
});

check("junk is not a day — no length test, no rollover", () => {
    for (const bad of [null, undefined, "", {}, "[object Ob", "2026-13-01", "2026-02-31", "16/10/2026"]) {
        assert.equal(daysUntil(bad, FRI), null, String(bad));
    }
});

check("minutes read BOTH tables, on local days, Monday-anchored", () => {
    const sessions = [
        { id: "q1", date: off(0), duration_minutes: 20 },           // a quiz today
        { id: "q2", date: off(-4), duration_minutes: 30 },          // Monday
    ];
    const techniques = [
        { id: "t1", date: off(0), session_duration: 25, technique_name: "pomodoro" },
        { id: "t2", date: off(-5), session_duration: 40, technique_name: "blurting" }, // last Sunday
        { id: "t3", date: off(1), session_duration: 90, technique_name: "pomodoro" },  // tomorrow
    ];
    const m = minutesSummary(sessions, techniques, FRI);
    assert.equal(m.today, 45, "today is the quiz AND the pomodoro");
    assert.equal(m.week, 75, "Sunday is last week; a row dated tomorrow has not happened");
});

check("a row with no day counts nowhere", () => {
    const m = minutesSummary([{ duration_minutes: 50 }], [{ session_duration: 50 }], FRI);
    assert.deepEqual(m, { today: 0, week: 0 });
});

check("the next deadline skips the past and the completed, and takes the soonest", () => {
    const d = nextDeadline([
        { title: "Old", due_date: off(-1) },
        { title: "Done", due_date: off(1), is_completed: true },
        { title: "Methods SAC", due_date: off(5) },
        { title: "Chem SAC", due_date: off(2) },
        { title: "Junk", due_date: "soon" },
    ], FRI);
    assert.deepEqual(d, { days: 2, title: "Chem SAC" });
    assert.equal(nextDeadline([], FRI), null);
});

// ─── the fact under each technique ──────────────────────────────────────────

check("every technique gets a fact, and a description when nothing is live", () => {
    const f = techniqueFacts({ now: FRI, truncated: true });
    assert.deepEqual(Object.keys(f).sort(), [...TECHNIQUE_IDS].sort());
    for (const id of ["pomodoro", "active_recall", "blurting", "mind_map", "exam"]) {
        assert.equal(f[id].live, false, id);
        assert.equal(f[id].text, FALLBACK_FACT[id], id);
    }
});

check("spaced repetition says READY, and tells caught up apart from empty", () => {
    assert.equal(techniqueFacts({ ready: 14, deckCards: 30, now: FRI }).spaced_repetition.text, "14 ready");
    assert.equal(techniqueFacts({ ready: 0, deckCards: 30, now: FRI }).spaced_repetition.text, "All caught up");
    assert.equal(techniqueFacts({ ready: 0, deckCards: 0, now: FRI }).spaced_repetition.text, "No decks yet");
    for (const n of [1, 6, 200]) {
        assert.doesNotMatch(techniqueFacts({ ready: n, now: FRI }).spaced_repetition.text, /due/i);
    }
});

check("Revision Mode names a SAC only inside the window, on calendar days", () => {
    const fact = (days) => techniqueFacts({ deadline: days == null ? null : { days, title: "x" }, now: FRI }).exam;
    assert.equal(fact(0).text, "SAC today");
    assert.equal(fact(1).text, "SAC tomorrow");
    assert.equal(fact(3).text, "SAC in 3 days");
    assert.equal(fact(DEADLINE_SHOWN).live, true);
    assert.equal(fact(DEADLINE_SHOWN + 1).live, false);
    assert.equal(fact(null).text, FALLBACK_FACT.exam);
});

check("a logged technique says today's minutes, else when it was last used", () => {
    const f = techniqueFacts({
        now: FRI,
        techniques: [
            { technique_name: "pomodoro", date: off(0), session_duration: 25 },
            { technique_name: "pomodoro", date: off(0), session_duration: 20 },
            // Oldest first, so "the first row wins" cannot pass for "the latest".
            { technique_name: "blurting", date: off(-9), session_duration: 10 },
            { technique_name: "blurting", date: off(-1), session_duration: 10 },
            { technique_name: "mind_map", date: off(-20), session_duration: 10 },
            { technique_name: "active_recall", date: off(2), session_duration: 10 }, // ahead of today
        ],
    });
    assert.equal(f.pomodoro.text, "45m today");
    assert.equal(f.blurting.text, "Yesterday", "the LATEST row, not the first");
    assert.equal(f.mind_map.text, "3 weeks ago");
    assert.equal(f.active_recall.text, "Not tried yet", "a row dated tomorrow is not a use");
});

check("'Not tried yet' is never said off a truncated read", () => {
    const full = techniqueFacts({ now: FRI, truncated: false });
    const cut = techniqueFacts({ now: FRI, truncated: true });
    assert.equal(full.blurting.text, "Not tried yet");
    assert.equal(cut.blurting.text, FALLBACK_FACT.blurting);
    assert.equal(cut.blurting.live, false);
});

check("a habit is four sessions at 70%, inside the last seven days", () => {
    const row = (name, n) => ({ technique_name: name, date: off(-n) });
    assert.equal(dominantTechnique([row("pomodoro", 0), row("pomodoro", 1), row("pomodoro", 2)], FRI), null,
        "three is a coincidence");
    assert.equal(dominantTechnique([row("pomodoro", 0), row("pomodoro", 1), row("pomodoro", 2), row("blurting", 3)], FRI),
        "pomodoro");
    assert.equal(dominantTechnique([row("pomodoro", 0), row("pomodoro", 1), row("blurting", 2), row("blurting", 3)], FRI),
        null);
    assert.equal(dominantTechnique([row("pomodoro", 0), row("pomodoro", 8), row("pomodoro", 9), row("pomodoro", 10)], FRI),
        null, "last week is not this week");
});

// ─── the next step ──────────────────────────────────────────────────────────

const intent = (technique, duration = 45) => ({ duration, plan: { technique } });

check("the order is the one the comment states", () => {
    const all = {
        timerLive: true, deadline: { days: 2, title: "Chem SAC" }, intent: intent("pomodoro"),
        ready: 20, todayMins: 0, dominant: "pomodoro",
    };
    assert.equal(nextStep(all).id, "timer");
    assert.equal(nextStep({ ...all, timerLive: false }).id, "deadline");
    assert.equal(nextStep({ ...all, timerLive: false, deadline: { days: DEADLINE_URGENT + 1, title: "x" } }).id, "intent",
        "their own word beats a SAC that is not urgent yet");
    assert.equal(nextStep({ ...all, timerLive: false, intent: null, deadline: { days: DEADLINE_SOON, title: "x" } }).id,
        "deadline", "a SAC this week beats a pile of cards");
    assert.equal(nextStep({ ready: READY_NUDGE, todayMins: 0 }).id, "cards");
    assert.equal(nextStep({ ready: READY_NUDGE - 1, todayMins: 0 }).id, "start");
    assert.equal(nextStep({ ready: 0, todayMins: 30, dominant: "pomodoro" }).id, "mix");
    assert.equal(nextStep({ ready: 0, todayMins: 30 }).id, "stack");
    assert.equal(nextStep({ ready: 0, todayMins: 90 }).id, "done");
});

check("a done day pushes nothing", () => {
    const s = nextStep({ todayMins: 120 });
    assert.equal(s.cta, null);
    assert.equal(s.tab, null);
});

check("an intent stops leading once they have done that much", () => {
    assert.equal(nextStep({ intent: intent("active_recall", 60), todayMins: 59 }).id, "intent");
    assert.notEqual(nextStep({ intent: intent("active_recall", 60), todayMins: 60 }).id, "intent");
});

check("free study with nothing ready does not send them to an empty deck", () => {
    assert.equal(nextStep({ intent: intent("spaced_repetition", 25), ready: 3 }).tab, "spaced_repetition");
    const none = nextStep({ intent: intent("spaced_repetition", 25), ready: 0 });
    assert.notEqual(none.id, "intent");
    assert.notEqual(none.tab, "spaced_repetition");
});

check("every step opens the technique it talks about", () => {
    const cases = [
        [nextStep({ timerLive: true }), "pomodoro"],
        [nextStep({ deadline: { days: 1, title: "x" } }), "exam"],
        [nextStep({ intent: intent("pomodoro") }), "pomodoro"],
        [nextStep({ intent: intent("active_recall") }), "active_recall"],
        [nextStep({ ready: 9 }), "spaced_repetition"],
        [nextStep({ todayMins: 10, dominant: "active_recall" }), "blurting"],
        [nextStep({ todayMins: 10, dominant: "pomodoro" }), "active_recall"],
    ];
    for (const [s, tab] of cases) {
        assert.equal(s.tab, tab, s.id);
        assert.ok(TECHNIQUE_IDS.includes(s.tab), s.id);
        assert.ok(s.cta, `${s.id} needs a button`);
    }
});

check("a button names where it goes and never promises to start anything", () => {
    // It opens the technique and scrolls to it. "Start a focus block" on a
    // button that only opens the timer is a suggestion that says it will
    // build the thing and does not.
    const all = [
        nextStep({ timerLive: true }), nextStep({ deadline: { days: 1, title: "x" } }),
        nextStep({ intent: intent("pomodoro") }), nextStep({ intent: intent("active_recall") }),
        nextStep({ intent: intent("spaced_repetition"), ready: 2 }), nextStep({ ready: 9 }),
        nextStep({}), nextStep({ todayMins: 10, dominant: "pomodoro" }), nextStep({ todayMins: 10 }),
    ];
    for (const st of all) assert.doesNotMatch(st.cta, /^Start\b/, `${st.id}: "${st.cta}"`);
});

check("the deadline sentence counts calendar days", () => {
    assert.equal(nextStep({ deadline: { days: 0, title: "Chem SAC" } }).title, "Chem SAC is today.");
    assert.equal(nextStep({ deadline: { days: 1, title: "Chem SAC" } }).title, "Chem SAC is tomorrow.");
    assert.equal(nextStep({ deadline: { days: 3, title: "Chem SAC" } }).title, "Chem SAC is in 3 days.");
});

check("the greeting follows the student's clock", () => {
    assert.equal(greetingFor(8), "Morning");
    assert.equal(greetingFor(13), "Afternoon");
    assert.equal(greetingFor(19), "Evening");
    assert.equal(greetingFor(23), "Late night");
    assert.equal(greetingFor(2), "Late night");
});

check("fmtMinutes", () => {
    assert.equal(fmtMinutes(0), "0m");
    assert.equal(fmtMinutes(45), "45m");
    assert.equal(fmtMinutes(120), "2h");
    assert.equal(fmtMinutes(135), "2h 15m");
    assert.equal(fmtMinutes(null), "0m");
});

// ─── today's intent is read on a LOCAL day ──────────────────────────────────

check("an intent set at 8am in Melbourne is today's intent", () => {
    // 8am Melbourne is 9pm the previous day in UTC — the window in which the
    // UTC read called a breakfast answer stale.
    const FIXED = new Date(2026, 9, 16, 8, 0, 0).getTime();
    const Real = Date;
    class Fixed extends Real {
        constructor(...a) { if (a.length === 0) super(FIXED); else super(...a); }
        static now() { return FIXED; }
    }
    globalThis.Date = Fixed;
    try {
        const got = todaysIntent({ extra: { daily_intent: { date: "2026-10-16", mode: "cramming" } } });
        assert.ok(got, "the intent was read as stale");
        assert.equal(got.plan.technique, "active_recall");
        assert.equal(todaysIntent({ extra: { daily_intent: { date: "2026-10-15", mode: "cramming" } } }), null);
    } finally {
        globalThis.Date = Real;
    }
});

// ─── the page ───────────────────────────────────────────────────────────────

const STUDY = "src/pages/Study.jsx";

check("the page reads the model rather than re-deriving it", () => {
    const s = code(STUDY);
    for (const fn of ["minutesSummary", "techniqueFacts", "nextStep", "nextDeadline"]) {
        present(s, new RegExp(`\\b${fn}\\(`), `${fn} is not called`);
    }
    // The two ways it got a day wrong: UTC parsing and 24-hour flooring.
    absent(s, /\bdifferenceInDays\b/);
    absent(s, /\bisToday\(/);
    absent(s, /startOfWeek\(/);
});

check("the technique is named once: no hero card, no tile grid", () => {
    const s = code(STUDY);
    absent(s, /Selected technique/);
    absent(s, /Suggested today/);
    absent(s, /Top pick/);
    absent(s, /Six techniques|Five evidence-based/);
});

check("no technique carries a title card of its own", () => {
    absent(code("src/components/study/PomodoroTimer.jsx"), /Pomodoro Timer|Focus and productivity timer/);
    absent(code("src/components/study/ActiveRecall.jsx"), /<h2[^>]*>\s*Active Recall\s*</);
    absent(code("src/components/study/BlurtingMethod.jsx"), /<h2[^>]*>\s*Blurting Method\s*</);
    absent(code("src/components/study/ExamMode.jsx"), /<h2[^>]*>\s*Revision Mode\s*</);
    absent(code("src/components/study/MindMaps.jsx"), /One map per subject/);
});

check("the science sits UNDER the tool and opens only when asked", () => {
    const s = code(STUDY);
    // EVERY science panel after EVERY tool render: the first one against the
    // last one, so a panel added above the tool cannot hide behind the one
    // that is still below it.
    const tool = s.lastIndexOf("techniqueComponents[activeTab]");
    const science = s.search(/<NeuroPanel\b/);
    assert.ok(tool > 0 && science > 0, "both are rendered");
    assert.ok(science > tool, "a science panel is drawn before the tool");
    absent(s, /grid-cols-\[minmax\(0,1fr\)_380px\]/, "a 380px rail beside the tool");
    // Folded by default: only an explicit "open" opens it.
    present(s, /getItem\("acedit\.study\.science"\)\s*===\s*"open"/);
});

check("the betting vocabulary is gone from the page", () => {
    const s = code(STUDY);
    absent(s, /\bante\b|\bthe pot\b|\bwager|\bbet\b/i);
    absent(s, /useStakes|DUEL_METRICS/);
});

check("the deck shelf counts READY and says so", () => {
    const s = code("src/components/study/SpacedRepetition.jsx");
    absent(s, /\}\s*due\s*<\/span>/);
});

check("no banned word in anything the model prints", () => {
    const s = code("src/lib/studyPage.js");
    const strings = s.match(/(["'`])(?:\\.|(?!\1).)*\1/g) || [];
    for (const str of strings) {
        absent(str, /\bDon't\b|\bFix it\b|\bNo excuses\b|\bEmbarrassing\b|\bMove\b/, str);
    }
});

console.log(`\n${passed} study page checks passed`);
