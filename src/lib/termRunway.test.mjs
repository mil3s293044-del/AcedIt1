/**
 * termRunway assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/termRunway.test.mjs
 *
 * ═══ A FLAG NOBODY CAN ACT ON IS A VERDICT, NOT A PROMPT ════════════════════
 * The runway exists to answer one question the planner had no screen for: "is
 * anything coming up that I have done nothing about?" So the rules that decide
 * when it says "no prep planned" carry the file. It must say it when it is
 * true and close enough to matter, and never when it is false — never for a
 * session planned for another subject, never for a SAC seven weeks out, never
 * on SAC day itself, and never because a session was claimed by the SAC
 * before it.
 *
 * And the headline it writes reads the TERM. The runway's header prints the
 * next SAC's countdown at display size, so a headline restating it is the
 * same fact twice, one above the other.
 *
 * Every check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    termRunway, runwayLead, isPrepFor, daysFrom,
    RUNWAY_WEEKS, PREP_WINDOW_DAYS, MAX_LANES, SOON_DAYS,
    lanesHeight, LANE_H, STALK_FOOT, CARD_H, hasPrepLine,
} from "@/lib/termRunway";
import { SOON_DAYS as QUEUE_SOON } from "@/lib/studyQueue";
import { dayStep } from "@/lib/dayStep";

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

// A Thursday, so the week has days on both sides of it.
const TODAY = "2026-10-15";
const day = (n) => {
    const d = new Date(`${TODAY}T00:00:00`);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const sac = (id, subject, n, extra = {}) => ({ id, subject_name: subject, title: `${subject} SAC`, due_date: day(n), ...extra });
const plan = (id, subject, n, extra = {}) => ({ id, subject_name: subject, title: `Flashcards: ${subject}`, date: day(n), ...extra });
const run = (assessments, plans = []) => termRunway({ today: TODAY, assessments, plans });
const one = (r, id) => [...r.sacs, ...r.later].find((s) => s.id === id);

/* ─── The track ───────────────────────────────────────────────────────────── */

check("the track starts on THIS week's Monday and runs eight weeks", () => {
    const r = run([]);
    assert.equal(r.from, "2026-10-12", "the track does not start on Monday");
    assert.equal(r.span, RUNWAY_WEEKS * 7);
    assert.equal(daysFrom(r.from, r.to), RUNWAY_WEEKS * 7 - 1);
    assert.equal(r.weeks.length, RUNWAY_WEEKS);
    assert.ok(r.todayX > 0 && r.todayX < 1 / RUNWAY_WEEKS, "today is not inside the first week");
});

check("a pin sits on its own date", () => {
    const r = run([sac("a", "Chemistry", 6)]);
    const s = one(r, "a");
    // Centre of the day: (days from Monday + 0.5) / span.
    assert.ok(Math.abs(s.x - (daysFrom(r.from, s.due) + 0.5) / r.span) < 1e-9);
});

check("done, dateless and past assessments are not on a runway about what is coming", () => {
    const r = run([
        sac("done", "Chemistry", 5, { is_completed: true }),
        { id: "nodate", subject_name: "Legal Studies", title: "x", due_date: null },
        sac("past", "Methods", -2),
        sac("junk", "English", 0, { due_date: {} }),
        sac("live", "Physics", 10),
    ]);
    assert.deepEqual([...r.sacs, ...r.later].map((s) => s.id), ["live"]);
});

check("past the eighth week is LATER, never squeezed onto the edge", () => {
    const r = run([sac("near", "Chemistry", 9), sac("far", "Biology", 70)]);
    assert.deepEqual(r.sacs.map((s) => s.id), ["near"]);
    assert.deepEqual(r.later.map((s) => s.id), ["far"]);
    assert.equal(r.next.id, "near");
});

check("the next SAC can be past the edge, and then the header still has it", () => {
    const r = run([sac("far", "Biology", 70)]);
    assert.equal(r.sacs.length, 0);
    assert.equal(r.next?.id, "far", "nothing in view is not nothing tracked");
});

check("pins too close to share a lane rise into the next one, and stop at MAX_LANES", () => {
    const r = run([1, 2, 3, 4, 5].map((n, i) => sac(`s${i}`, `Subject ${i}`, n)));
    const lanes = r.sacs.map((s) => s.lane);
    assert.notEqual(lanes[0], lanes[1], "two pins a day apart share a lane");
    assert.ok(lanes.every((l) => l >= 0 && l < MAX_LANES), `a pin was drawn off the panel: ${lanes}`);
    assert.ok(r.lanes <= MAX_LANES);
    const spread = run([sac("a", "Chemistry", 3), sac("b", "Legal Studies", 40)]);
    assert.deepEqual(spread.sacs.map((s) => s.lane), [0, 0], "pins weeks apart were stacked for no reason");
});

/* ─── What counts as prep ─────────────────────────────────────────────────── */

check("prep is a session for the SAME subject — by field, then by title", () => {
    const s = { subject_name: "Chemistry" };
    assert.equal(isPrepFor({ subject_name: "Chemistry", title: "x" }, s), true);
    assert.equal(isPrepFor({ subject_name: "chemistry ", title: "x" }, s), true, "case or a stray space split one subject in two");
    assert.equal(isPrepFor({ subject_name: "Physics", title: "Chemistry crossover" }, s), false,
        "a session tagged for another subject was credited off its title");
    assert.equal(isPrepFor({ subject_name: null, title: "Chemistry: redox" }, s), true, "a hand-typed title was ignored");
});

check("A SESSION WITH NO SUBJECT IS NOBODY'S PREP", () => {
    const r = run([sac("a", "Chemistry", 5)], [{ id: "p", subject_name: null, title: "Pomodoro: catch-up", date: day(2) }]);
    assert.equal(one(r, "a").planned, 0, "an untagged session was credited to the nearest SAC");
});

check("only the run-up counts: inside PREP_WINDOW_DAYS before the date, never on it or after", () => {
    const r = run([sac("a", "Chemistry", 25)], [
        plan("early", "Chemistry", 25 - PREP_WINDOW_DAYS - 1),
        plan("in", "Chemistry", 25 - PREP_WINDOW_DAYS),
        plan("on", "Chemistry", 25),
    ]);
    assert.deepEqual(one(r, "a").prep.map((p) => p.id), ["in"]);
});

check("A SESSION IS CLAIMED ONCE: the run-up stops at the previous SAC in that subject", () => {
    const r = run([sac("first", "Chemistry", 5), sac("second", "Chemistry", 12)], [
        plan("before-first", "Chemistry", 3),
        plan("between", "Chemistry", 8),
    ]);
    assert.deepEqual(one(r, "first").prep.map((p) => p.id), ["before-first"]);
    assert.deepEqual(one(r, "second").prep.map((p) => p.id), ["between"],
        "a session before the first SAC was counted again for the second");
});

/* ─── "No prep planned" ───────────────────────────────────────────────────── */

check("flagged: inside a fortnight and nothing planned", () => {
    assert.equal(one(run([sac("a", "Legal Studies", 9)]), "a").needsPrep, true);
});

check("not flagged once a session is planned ahead, or one was done", () => {
    assert.equal(one(run([sac("a", "Legal Studies", 9)], [plan("p", "Legal Studies", 4)]), "a").needsPrep, false);
    assert.equal(one(run([sac("a", "Legal Studies", 9)], [plan("p", "Legal Studies", -2, { is_completed: true })]), "a").needsPrep, false);
});

check("A RUN-UP OF SESSIONS THAT CAME AND WENT UNDONE IS STILL UNPLANNED", () => {
    const r = run([sac("a", "Legal Studies", 9)], [plan("p", "Legal Studies", -2)]);
    assert.equal(one(r, "a").needsPrep, true, "a missed session counted as a plan");
});

check("far off is a normal state of affairs, not a flag", () => {
    assert.equal(one(run([sac("a", "English", SOON_DAYS + 1)]), "a").needsPrep, false);
    assert.equal(one(run([sac("a", "English", SOON_DAYS)]), "a").needsPrep, true, "the fortnight's own last day was not counted");
});

check("SAC DAY IS NEVER FLAGGED — there is no session left to plan before it", () => {
    assert.equal(one(run([sac("a", "Chemistry", 0)]), "a").needsPrep, false);
    assert.equal(one(run([sac("a", "Chemistry", 1)]), "a").needsPrep, true, "tomorrow still has today to plan in");
});

check("'soon' is the queue's fortnight, imported, never restated", () => {
    assert.equal(SOON_DAYS, QUEUE_SOON);
    const src = strip(read("src/lib/termRunway.js"));
    assert.match(src, /import \{ SOON_DAYS \} from "@\/lib\/studyQueue"/);
    assert.doesNotMatch(src, /SOON_DAYS\s*=\s*\d/, "a second copy of the fortnight");
});

/* ─── Ticks ───────────────────────────────────────────────────────────────── */

check("a tick says done, planned or missed, and missed only for a day that has passed", () => {
    const r = run([sac("a", "Chemistry", 9)], [
        plan("done", "Chemistry", -2, { is_completed: true }),
        plan("missed", "Chemistry", -1),
        plan("today", "Chemistry", 0),
        plan("ahead", "Chemistry", 3),
    ]);
    const t = Object.fromEntries(r.ticks.map((x) => [x.id, x]));
    assert.equal(t.done.done, true);
    assert.equal(t.missed.missed, true);
    assert.equal(t.today.missed, false, "today's session was called missed before the day was over");
    assert.equal(t.ahead.missed, false);
    assert.equal(t.ahead.done, false);
});

check("no tick is drawn before the track starts", () => {
    const r = run([sac("a", "Chemistry", 3)], [plan("old", "Chemistry", -10, { is_completed: true })]);
    assert.equal(one(r, "a").done, 1, "it still counts as prep done");
    assert.equal(r.ticks.length, 0, "a tick was placed off the left of the track");
});

/* ─── The headline ────────────────────────────────────────────────────────── */

check("one unplanned SAC is NAMED, with how far out it is", () => {
    const line = runwayLead(run([sac("a", "Chemistry", 6), sac("b", "Legal Studies", 9)], [plan("p", "Chemistry", 2)]));
    assert.match(line, /Legal Studies/);
    assert.match(line, /9 days/);
});

check("several unplanned SACs are counted rather than listed", () => {
    const line = runwayLead(run([sac("a", "Chemistry", 6), sac("b", "Legal Studies", 9)]));
    assert.match(line, /^2 SACs/);
});

check("THE HEADLINE NEVER RESTATES THE COUNTDOWN the header prints at display size", () => {
    // Next SAC 20 days out, nothing flagged: the number 20 belongs to the header.
    const line = runwayLead(run([sac("a", "Physics", 20)]));
    assert.doesNotMatch(line, /\b20\b/, `"${line}" repeats the header's countdown`);
    const covered = runwayLead(run([sac("a", "Chemistry", 6)], [plan("p", "Chemistry", 2)]));
    assert.doesNotMatch(covered, /\b6\b/, `"${covered}" repeats the header's countdown`);
    assert.match(covered, /prep planned/);
});

check("reassurance is only offered when it is true", () => {
    const line = runwayLead(run([sac("a", "Chemistry", 6), sac("b", "Methods", 10)],
        [plan("p", "Chemistry", 2), plan("q", "Methods", 4)]));
    assert.match(line, /All 2 SACs/);
    const flagged = runwayLead(run([sac("a", "Chemistry", 6), sac("b", "Methods", 10)], [plan("p", "Chemistry", 2)]));
    assert.doesNotMatch(flagged, /All|has prep planned/, "it reassured with an unplanned SAC on the runway");
});

check("with nothing tracked the headline names the page and leaves the ASK to the runway", () => {
    // The empty header carries the ask with its button; two asks on one screen
    // is the paper-cut the planner has already been through once.
    const line = runwayLead(run([]));
    assert.doesNotMatch(line, /\btrack\b/i, `"${line}" asks a second time`);
    assert.equal(runwayLead(null), line);
});

check("no banned word in anything the runway prints", () => {
    const lines = [
        runwayLead(run([])),
        runwayLead(run([sac("a", "Chemistry", 1)])),
        runwayLead(run([sac("a", "Chemistry", 1), sac("b", "Methods", 2)])),
        runwayLead(run([sac("a", "Chemistry", 0)])),
        runwayLead(run([sac("a", "Physics", 30)])),
    ];
    for (const l of lines) assert.doesNotMatch(l, /\b(Don't|Fix it|No excuses|Embarrassing|Move)\b/, l);
});

check("junk never throws", () => {
    assert.doesNotThrow(() => termRunway());
    assert.doesNotThrow(() => termRunway({ today: "nonsense", assessments: [null, {}], plans: [null, { date: {} }] }));
});

/* ─── The phone week's swipe ──────────────────────────────────────────────── */

check("a swipe is a day, and crossing Sunday or Monday moves the week", () => {
    assert.deepEqual(dayStep(3, 1, 0), { weekDelta: 0, index: 4 });
    assert.deepEqual(dayStep(6, 1, 0), { weekDelta: 1, index: 0 }, "Sunday did not lead to next Monday");
    assert.deepEqual(dayStep(0, -1, 0), { weekDelta: -1, index: 6 }, "Monday did not lead back to Sunday");
});

check("the swipe stops at the board's own bounds", () => {
    assert.equal(dayStep(0, -1, -1), null, "swiped before the earliest week the chevrons allow");
    assert.equal(dayStep(6, 1, 8, { max: 8 }), null, "swiped past the furthest week the chevrons allow");
    assert.notEqual(dayStep(3, 1, 8, { max: 8 }), null, "a day inside the last week was refused");
    assert.equal(dayStep(-1, 1, 0), null);
    assert.equal(dayStep(NaN, 1, 0), null);
});

/* ─── The lanes ───────────────────────────────────────────────────────────── */

check("THE LANES ARE AS TALL AS THE CARDS THEY HOLD — no hole under the heading", () => {
    // Reserving a four-line card on every lane left ~20px of air between the
    // track's heading and a row of three-line pins, on the first card of the
    // page. And never SHORTER than a card: a lane that clips its pin hides the
    // countdown on it.
    const short = { lane: 0, needsPrep: false, planned: 0 };
    const full = { lane: 0, needsPrep: false, planned: 2 };
    const flagged = { lane: 0, needsPrep: true, planned: 0 };
    assert.ok(lanesHeight([short]) < lanesHeight([full]), "a row of three-line cards reserved a four-line one");
    assert.equal(lanesHeight([flagged]), lanesHeight([full]), "a flagged card is four lines too");
    assert.equal(lanesHeight([]), 24);
    for (const set of [[short], [full], [short, { ...full, lane: 1 }], [{ ...short, lane: 2 }, full]]) {
        const h = lanesHeight(set);
        for (const s of set) {
            const top = s.lane * LANE_H + STALK_FOOT + (hasPrepLine(s) ? CARD_H.full : CARD_H.short);
            assert.ok(top <= h, `a lane-${s.lane} card reaches ${top}px in a ${h}px lane`);
            assert.ok(h - top <= 8 || set.some((o) => o.lane > s.lane), `${h - top}px of slack above the top card`);
        }
    }
});

/* ─── The page ────────────────────────────────────────────────────────────── */

check("the planner's headline is the term's read, and the old countdown hero is gone", () => {
    const goals = strip(read("src/pages/Goals.jsx"));
    assert.match(goals, /const coachLine = runwayLead\(runway\)/, "the headline is not the runway's read");
    assert.match(goals, /<TermRunway\b/, "the runway is not mounted");
    assert.match(goals, /<TermRunway\b[^>]*\blead=\{coachLine\}/, "the headline is not the track's heading");
    assert.doesNotMatch(goals, /SacHero/, "the old hero is still referenced");
    assert.ok(!fs.existsSync("src/components/planner/SacHero.jsx"), "SacHero.jsx is still on disk");
});

check("THE HORIZON OPENS THE PAGE, and the headline is not drawn a second time above it", () => {
    // "The horizon should be put to the top." The runway is the first thing
    // in the page body, and the coach line lives inside it — a second copy
    // as its own block above would be the ragged headline row back again.
    const goals = strip(read("src/pages/Goals.jsx"));
    const body = goals.slice(goals.indexOf("<div className=\"min-h-screen bg-background\">", goals.indexOf("const intentionCard")));
    const first = body.search(/<(TermRunway|StrategyCheckIn|SectionHead|h1)\b/);
    assert.ok(first > -1, "nothing found in the page body — re-point this check");
    assert.match(body.slice(first), /^<TermRunway\b/, "something renders above the horizon");
    assert.doesNotMatch(body, /<h1\b/, "the page draws its own headline beside the runway's");
    // Every reference, not just the bare `{intentionCard}` — a second copy
    // gated on a width is written `{phone && intentionCard}`, which is
    // exactly the shape this replaced.
    assert.equal((body.match(/\bintentionCard\b/g) || []).length, 1,
        "today's intention is placed in more than one spot (or none)");
    assert.doesNotMatch(goals, /\bwide && intentionCard|!wide && intentionCard/, "the intention is placed by width again");
});

check("every section opens on ONE header, so they all start the same way", () => {
    // Four hand-written headers had drifted to three bottom margins and two
    // heights. The one shape is SectionHead; a bare section heading in the
    // page body is the drift coming back.
    const goals = strip(read("src/pages/Goals.jsx"));
    const at = goals.indexOf("function SectionHead(");
    assert.ok(at > -1, "SectionHead is gone — re-point this check");
    const end = goals.indexOf("\n}\n", at);
    const outside = goals.slice(0, at) + goals.slice(end);
    assert.doesNotMatch(outside, /<h2\b/, "a section heading is hand-written outside SectionHead");
    assert.ok((goals.match(/<SectionHead\b/g) || []).length >= 3, "the sections stopped using SectionHead");
});

check("the runway's two halves sit on one left edge", () => {
    // The countdown padded px-7 and the track px-6, so their first words
    // started 4px apart on one card.
    const src = strip(read("src/components/planner/TermRunway.jsx"));
    const gutters = [...src.matchAll(/\bpx-(\d+) sm:px-(\d+) pt-\d/g)].map((m) => `${m[1]}/${m[2]}`);
    assert.ok(gutters.length >= 3, `found ${gutters.length} panels — re-point this check`);
    assert.equal(new Set(gutters).size, 1, `the runway's panels pad differently: ${gutters.join(", ")}`);
});

check("EXACTLY ONE week view is mounted: the agenda on a phone, the drag board otherwise", () => {
    // Rendered both and CSS-hidden, every session would carry two sets of
    // controls, and the drag board would still be live under a phone.
    const goals = strip(read("src/pages/Goals.jsx"));
    const at = goals.indexOf("{phone ? (");
    assert.ok(at > -1, "the week view does not branch on the phone breakpoint");
    const branch = goals.slice(at, goals.indexOf("</DragDropContext>", at));
    assert.match(branch, /^\{phone \? \(\s*<PhoneWeek\b/, "the phone branch is not the agenda");
    assert.match(branch, /\) : \(\s*<DragDropContext\b/, "the other branch is not the drag board");
    assert.match(goals, /const phone = !useMedia\("\(min-width: 640px\)"\)/, "the split is not read from the breakpoint");
});

check("the agenda's swipe bounds come from dayStep, not a second copy of them", () => {
    const goals = strip(read("src/pages/Goals.jsx"));
    assert.match(goals, /dayStep\(agendaIndex, delta, weekOffset, \{ max: MAX_WEEKS_AHEAD \}\)/);
});

check("A DRAG THAT ENDS ON A ROW IS STILL A DRAG — every agenda tap goes through the guard", () => {
    // Without it, releasing a swipe over a row ticks the session off or opens
    // it on the way past. The day pills sit outside the draggable and are
    // exempt by name.
    const src = strip(read("src/components/planner/PhoneWeek.jsx"));
    const strip0 = src.indexOf("function DayStrip(");
    const strip1 = src.indexOf("function Row(");
    assert.ok(strip0 > -1 && strip1 > strip0, "the strip moved — re-point this exemption");
    const rest = src.slice(0, strip0) + src.slice(strip1);
    const clicks = rest.match(/onClick=\{[^}]*/g) || [];
    assert.ok(clicks.length >= 4, `only found ${clicks.length} handlers — the scan is reading the wrong file`);
    for (const c of clicks) assert.match(c, /^onClick=\{\(\) => guard\(/, `${c} skips the drag guard`);
});

console.log(`\ntermRunway: ${passed} checks passed`);
