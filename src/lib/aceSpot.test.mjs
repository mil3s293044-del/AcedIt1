/**
 * placed-Ace assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/aceSpot.test.mjs
 *
 * ═══ HE WAS A STICKER WHEREVER HE WAS PLACED ════════════════════════════════
 * Present on the first frame, one pose forever, blind to what happened beside
 * him. AceSpot gives every placed Ace an arrival, a gesture that settles into
 * a resting pose his fidgets can reach, and reactions the page fires. None of
 * that throws when it breaks — he simply goes back to being a picture — so
 * the rules are pure and the wiring is scanned.
 *
 * Every check below was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    RESTING, CALM_IDLE, REACTIONS, REACT_MS, settleFor, cueFor, shownPose,
    isTextEntry, ENTRANCES, entranceFor,
} from "@/lib/aceSpot";

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

const BODY = read("src/components/ace/AceBody.jsx");
const posesBlock = BODY.slice(BODY.indexOf("const POSES = {"), BODY.indexOf("\n};", BODY.indexOf("const POSES = {")));
const POSES = new Set([...posesBlock.matchAll(/^\s{4}([a-zA-Z0-9]+):\s*\{/gm)].map((m) => m[1]));
const SPOT = strip(read("src/components/ace/AceSpot.jsx"));

/* ── The rules ────────────────────────────────────────────────────────── */

check("RESTING is AceBody's own resting set", () => {
    const m = BODY.match(/const RESTING = new Set\(\[([^\]]*)\]\)/);
    assert.ok(m, "could not read AceBody's RESTING — has it moved?");
    const theirs = [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]).sort();
    assert.deepEqual([...RESTING].sort(), theirs);
});

check("every pose this names is one AceBody can draw", () => {
    assert.ok(POSES.size > 20, `only read ${POSES.size} poses`);
    for (const r of Object.values(REACTIONS)) assert.ok(POSES.has(r.pose), `reaction pose ${r.pose} does not exist`);
    for (const p of POSES) assert.ok(POSES.has(settleFor(p)), `${p} settles into ${settleFor(p)}, which does not exist`);
});

check("every gesture settles somewhere his fidgets can reach — except sleep", () => {
    for (const p of POSES) {
        const s = settleFor(p);
        assert.ok(RESTING.includes(s) || s === "sleep", `${p} settles into ${s}, where he would never fidget`);
    }
    for (const r of RESTING) assert.equal(settleFor(r), r, `${r} is already resting`);
    assert.equal(settleFor("sleep"), "sleep", "he woke up for a fidget on the break screen");
    assert.equal(settleFor("yawn"), "sleep");
    assert.equal(settleFor("cheer"), "happy");
    assert.equal(settleFor("nope"), "stand");
});

check("what is drawn: reduced motion is exactly what it was before", () => {
    const cue = { pose: "cheer", ms: 900, n: 1 };
    assert.equal(shownPose({ pose: "point", reduce: true, cue, introDone: true }), "point");
    assert.equal(shownPose({ pose: "sleep", intro: "yawn", reduce: true }), "sleep", "a reduced-motion break shows him mid-yawn");
});

check("what is drawn: reaction, then hold, then arrival, then settled", () => {
    const cue = { pose: "cheer", ms: 900, n: 1 };
    assert.equal(shownPose({ pose: "point", cue, introDone: true }), "cheer");
    assert.equal(shownPose({ pose: "think", hold: true, introDone: true }), "think", "a held pose settled");
    assert.equal(shownPose({ pose: "point", introDone: false }), "point");
    assert.equal(shownPose({ pose: "sleep", intro: "yawn", introDone: false }), "yawn");
    assert.equal(shownPose({ pose: "point", introDone: true }), "stand", "he points forever");
    assert.equal(shownPose({ pose: "sleep", intro: "yawn", introDone: true }), "sleep");
    assert.equal(shownPose({ pose: "point", cue: { pose: null, n: 2 }, introDone: true }), "stand", "a released hover stuck");
});

check("calm: a fidget every 8–12 seconds, slower than his own corner", () => {
    assert.ok(CALM_IDLE.min >= 8000 && CALM_IDLE.min + CALM_IDLE.spread <= 12000, JSON.stringify(CALM_IDLE));
    const own = BODY.match(/const IDLE_MIN = (\d+), IDLE_SPREAD = (\d+);/);
    assert.ok(own, "could not read AceBody's own cadence");
    assert.ok(CALM_IDLE.min > Number(own[1]), "a placed Ace fidgets as often as the corner one");
});

check("a cue plays every time, and a hover is held", () => {
    const a = cueFor("added");
    const b = cueFor("added", a);
    assert.notEqual(a.n, b.n, "the same reaction twice in a row only plays once");
    assert.equal(a.pose, "cheer");
    assert.equal(cueFor("eager").ms, null, "a hover reaction times out under the pointer");
    assert.equal(cueFor("point").ms, null);
    assert.equal(cueFor("done").ms, REACTIONS.done.ms);
    assert.equal(cueFor("wave").pose, "wave", "a bare pose is a reaction too");
    assert.equal(cueFor("wave").ms, REACT_MS);
    assert.equal(cueFor(null).pose, null);
});

check("typing is a text field, not any control", () => {
    for (const el of [{ tagName: "TEXTAREA" }, { tagName: "INPUT", type: "text" }, { tagName: "input", type: "email" },
        { tagName: "INPUT", type: "search" }, { tagName: "INPUT" }, { tagName: "DIV", isContentEditable: true }]) {
        assert.ok(isTextEntry(el), JSON.stringify(el));
    }
    for (const el of [{ tagName: "INPUT", type: "checkbox" }, { tagName: "INPUT", type: "range" },
        { tagName: "BUTTON" }, { tagName: "DIV" }, null, undefined, "INPUT"]) {
        assert.ok(!isTextEntry(el), JSON.stringify(el));
    }
});

check("arrivals: none under reduced motion, and no easing framer throws on", () => {
    assert.deepEqual(entranceFor("rise", { reduce: true }), {});
    assert.deepEqual(entranceFor("none"), {});
    assert.equal(entranceFor("hop", { delay: 0.5 }).transition.delay, 0.5);
    const named = new Set(["linear", "easeIn", "easeOut", "easeInOut", "circIn", "circOut", "circInOut", "backIn", "backOut", "backInOut", "anticipate"]);
    for (const [k, e] of Object.entries(ENTRANCES)) {
        const ease = e.transition.ease;
        if (typeof ease === "string") assert.ok(named.has(ease), `${k} uses "${ease}", which framer throws on`);
        // Keyframes must agree in length with `times`, or framer guesses.
        for (const v of Object.values(e.animate)) {
            if (Array.isArray(v)) assert.equal(v.length, e.transition.times?.length, `${k} keyframes and times disagree`);
        }
    }
});

/* ── The wiring ───────────────────────────────────────────────────────── */

check("a placed Ace idles calmly, and holds still while you type or he reacts", () => {
    assert.match(SPOT, /idleEvery=\{CALM_IDLE\}/);
    assert.match(SPOT, /idle=\{idle && !typing && !live\}/);
    assert.match(strip(BODY), /idleEvery\?\.min \?\? IDLE_MIN/, "AceBody ignores the calm cadence");
});

check("the arrival replays whenever the page changes what he is saying", () => {
    assert.match(SPOT, /\}, \[pose, intro, delay\]\);/);
});

check("the typing watch removes exactly what it added", () => {
    // An anonymous focusout listener cannot be removed, so every placed Ace
    // that unmounted left one behind.
    const adds = [...SPOT.matchAll(/addEventListener\("(\w+)", (\w+)\)/g)].map((m) => `${m[1]}:${m[2]}`).sort();
    const removes = [...SPOT.matchAll(/removeEventListener\("(\w+)", (\w+)\)/g)].map((m) => `${m[1]}:${m[2]}`).sort();
    assert.ok(adds.length >= 2);
    assert.deepEqual(adds, removes);
});

check("a hover reaction is for a pointer, not a tap", () => {
    assert.match(SPOT, /e\.pointerType !== "touch"/);
});

const PLACED = [
    "src/components/planner/TermRunway.jsx",
    "src/pages/Dashboard.jsx",
    "src/pages/Friends.jsx",
    "src/pages/MistakeBank.jsx",
    "src/components/study/PomodoroTimer.jsx",
    "src/components/study/WhatToTest.jsx",
    "src/components/study/MindMaps.jsx",
    "src/components/progress/AceVerdict.jsx",
    "src/components/study/SessionCompleteModal.jsx",
    "src/components/planner/StrategyCheckIn.jsx",
];

check("every placed Ace goes through AceSpot", () => {
    for (const f of PLACED) {
        const src = strip(read(f));
        assert.ok(/<AceSpot\b/.test(src), `${f} has no AceSpot`);
        assert.ok(!/<AceBody\b/.test(src), `${f} draws a bare AceBody again — a sticker`);
    }
});

check("the planner tells him what happened", () => {
    const goals = strip(read("src/pages/Goals.jsx"));
    const add = goals.slice(goals.indexOf("const addSac = async"), goals.indexOf("const handleAddSac"));
    assert.match(add, /ace\.react\("added"\)/, "tracking a SAC goes unremarked");
    const tick = goals.slice(goals.indexOf("const togglePlanDone"), goals.indexOf("const requestDeletePlan"));
    assert.match(tick, /if \(!p\.is_completed\) ace\.react\("done"\)/, "he reacts to a session being un-ticked, or to none");
    assert.match(goals, /<TermRunway[\s\S]{0,300}cue=\{ace\.cue\}/);
    const runway = strip(read("src/components/planner/TermRunway.jsx"));
    assert.match(runway, /<Header next=\{next\} runway=\{runway\} cue=\{cue\} \/>/);
    assert.match(runway, /<AceSpot className="w-full" pose=\{feel\.pose\} entrance="slide" cue=\{cue\}/);
});

check("Friends tells him about a copied link and a sent request", () => {
    const friends = strip(read("src/pages/Friends.jsx"));
    assert.match(friends, /ace\.react\("copied"\)/);
    assert.match(friends, /ace\.react\("added"\)/);
    assert.match(friends, /<AceSpot[^>]*cue=\{ace\.cue\}/);
});

check("on a break he yawns and falls asleep, and stays asleep", () => {
    const pomo = strip(read("src/components/study/PomodoroTimer.jsx"));
    const spots = [...pomo.matchAll(/<AceSpot[^>]*>/g)].map((m) => m[0]);
    assert.equal(spots.length, 2);
    for (const s of spots) assert.match(s, /pose="sleep" intro="yawn"/);
});

check("the check-in holds him thinking while a plan builds", () => {
    assert.match(strip(read("src/components/planner/StrategyCheckIn.jsx")), /<AceSpot[^>]*hold=\{busy\}/);
});

console.log(`\n${passed} placed-Ace checks passed`);
