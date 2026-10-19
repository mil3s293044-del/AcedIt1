/**
 * science card assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/neuroPanel.test.mjs
 *
 * ═══ ONE LINE A BEAT, AND EVERY LINE POINTS AT A PAPER ══════════════════════
 * The card was five boxes of prose with its sources in a list nothing pointed
 * at. It is three beats at one line each, footnoted, and it reacts to the
 * session while it runs. These hold the copy to its sources, the live state
 * to what the timer actually broadcast, and the wiring to the five techniques
 * that fire it. Every check was verified by putting the bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { TECHNIQUE_NEURO, REGIONS } from "@/lib/neuro";
import {
    citesFor, utilityCite, regionChips, pomodoroLive, pomodoroLine, breakFocus,
    pulseFor, shouldPulse, brainLine, PULSE_GAP_MS, PULSE_HOLD_MS, BEATS,
} from "@/lib/neuroPanel";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const read = (rel) => fs.readFileSync(rel, "utf8");
/** A comment naming the broken form is not the broken form. */
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const IDS = Object.keys(TECHNIQUE_NEURO);
const BANNED = /\bDon't\b|\bFix it\b|\bNo excuses\b|\bEmbarrassing\b|\bMove\b/;

/* ── The copy ─────────────────────────────────────────────────────────────── */

check("EVERY BEAT IS ONE LINE: a brief, a catch and a gist per region, short enough to be a line", () => {
    for (const id of IDS) {
        const t = TECHNIQUE_NEURO[id];
        assert.ok(t.brief && t.brief.length <= 110, `${id}: brief missing or a paragraph (${t.brief?.length})`);
        assert.ok(t.catch && t.catch.length <= 90, `${id}: catch missing or a paragraph (${t.catch?.length})`);
        for (const r of t.regions) {
            assert.ok(r.gist && r.gist.length <= 38, `${id}/${r.id}: gist missing or too long`);
            assert.ok(REGIONS[r.id], `${id}: ${r.id} is not a region the brain can draw`);
        }
        for (const line of [t.brief, t.catch, t.headline, t.breakLine, ...t.regions.map((r) => r.gist)].filter(Boolean)) {
            assert.ok(!BANNED.test(line), `${id}: banned word in "${line}"`);
        }
    }
});

check("EVERY FOOTNOTE RESOLVES, every source is cited somewhere, and the lines that make claims cite one", () => {
    for (const id of IDS) {
        const t = TECHNIQUE_NEURO[id];
        for (const beat of BEATS) {
            const nums = t.cites?.[beat] || [];
            assert.equal(citesFor(t, beat).length, nums.length, `${id}/${beat}: a footnote leads nowhere`);
        }
        for (const beat of ["brain", "chart", "catch"]) {
            assert.ok(citesFor(t, beat).length > 0, `${id}: the ${beat} line cites nothing`);
        }
        if (t.caveat) assert.ok(citesFor(t, "caveat").length > 0, `${id}: "Worth knowing" makes a claim and cites nothing`);
        const cited = new Set([...BEATS.flatMap((b) => t.cites?.[b] || []), t.effect?.cite, utilityCite(t)?.n].filter(Boolean));
        t.sources.forEach((s, i) => assert.ok(cited.has(i + 1), `${id}: source ${i + 1} (${s.ref.slice(0, 30)}) is cited by nothing`));
        if (t.effect) {
            assert.ok(Number.isInteger(t.effect.cite) && t.sources[t.effect.cite - 1], `${id}: the effect size points at no paper`);
            assert.ok(t.sources[t.effect.cite - 1].ref.startsWith(t.effect.source.split(" ")[0]),
                `${id}: the effect size cites ${t.sources[t.effect.cite - 1].ref.slice(0, 20)}, not ${t.effect.source}`);
        }
    }
    const bad = { sources: [{ ref: "A", note: "x" }], cites: { brain: [0, 1, 2, 1.5] } };
    assert.deepEqual(citesFor(bad, "brain").map((c) => c.n), [1], "an out-of-range footnote was printed");
});

check("A UTILITY BADGE IS DUNLOSKY'S VERDICT, so it only appears beside Dunlosky's review", () => {
    for (const id of IDS) {
        const t = TECHNIQUE_NEURO[id];
        if (t.utility) assert.ok(utilityCite(t), `${id}: a "${t.utility} utility" badge with no Dunlosky source behind it`);
    }
    // Concept mapping is not one of Dunlosky's ten.
    assert.equal(TECHNIQUE_NEURO.mind_map.utility, null, "mind maps carry a rating Dunlosky never gave");
});

check("the chips are the technique's own regions, in its order, with the short name and the gist", () => {
    const chips = regionChips(TECHNIQUE_NEURO.pomodoro);
    assert.deepEqual(chips.map((c) => c.id), TECHNIQUE_NEURO.pomodoro.regions.map((r) => r.id));
    assert.equal(chips[0].label, "dlPFC");
    assert.equal(chips[0].gist, "Holds the goal, blocks the rest");
    assert.deepEqual(regionChips({ regions: [{ id: "nowhere" }] }), [], "a region the brain cannot draw got a chip");
});

/* ── The Pomodoro, live ───────────────────────────────────────────────────── */

const POMO = TECHNIQUE_NEURO.pomodoro;

check("a running block sits on the curve at its FLOORED minute, and nothing honest means nothing placed", () => {
    const at = (left, total = 1500, extra = {}) => pomodoroLive({ isActive: true, isRunning: true, isBreak: false, timeLeft: left, total, ...extra }, POMO.chart);
    assert.deepEqual([at(1500 - 12 * 60 - 59).minute, at(1500 - 12 * 60 - 59).label], [12, "You · 12 min"], "12:59 read as 13");
    assert.equal(at(1500).minute, 0);
    assert.equal(pomodoroLive({ isActive: false, timeLeft: 100, total: 1500 }, POMO.chart), null, "an idle timer was placed");
    assert.equal(pomodoroLive({ isActive: true, timeLeft: 100 }, POMO.chart), null, "no total, so the block length was guessed");
    assert.equal(pomodoroLive({ isActive: true, timeLeft: null, total: 1500 }, POMO.chart), null, "Number(null) placed a block at its end");
    assert.equal(pomodoroLive(null, POMO.chart), null);
    const long = at(0, 90 * 60);
    assert.deepEqual([long.x, long.label], [50, "You · 50+ min"], "a long block ran off the chart");
    assert.equal(at(600, 1500, { isRunning: false }).paused, true);
});

check("a break lights the daydreaming network, places no marker, and says why", () => {
    const live = pomodoroLive({ isActive: true, isRunning: true, isBreak: true, timeLeft: 120, total: 300 }, POMO.chart);
    assert.equal(live.phase, "break");
    assert.equal(live.x, null, "a break was drawn on the attention curve");
    assert.deepEqual(breakFocus(live, POMO), ["mpfc", "pcc"]);
    assert.equal(pomodoroLine(live, POMO), POMO.breakLine);
    assert.equal(breakFocus(pomodoroLive({ isActive: true, isRunning: true, timeLeft: 100, total: 1500 }, POMO.chart), POMO), null,
        "focus time isolated the daydreaming network");
});

/* ── Pulses, and what the line says ───────────────────────────────────────── */

check("a pulse is built only from regions the technique already names; the Pomodoro has its timer instead", () => {
    for (const id of IDS) {
        const p = pulseFor(id);
        if (id === "pomodoro") { assert.equal(p, null); continue; }
        assert.ok(p, `${id} has no pulse`);
        const named = new Set(TECHNIQUE_NEURO[id].regions.map((r) => r.id));
        for (const r of p.ids) assert.ok(named.has(r), `${id}: pulses ${r}, which its card never names`);
    }
    assert.equal(pulseFor("active_recall").line, "Retrieval · Hippocampus + vlPFC");
    assert.equal(pulseFor("nonsense"), null);
    // Every shipped config is already well-formed, so the refusal needs a
    // fixture to be tested at all: a pulse naming a region the card never
    // shows would light something the student has no chip for.
    const odd = { t: { regions: [{ id: "hippocampus" }], live: { line: "Recall", regions: ["hippocampus", "motor"] } } };
    assert.deepEqual(pulseFor("t", odd).ids, ["hippocampus"], "a pulse lit a region its card never names");
    assert.equal(pulseFor("t", { t: { regions: [{ id: "acc" }], live: { line: "Recall", regions: ["motor"] } } }), null);
});

check("a burst is one pulse: the gap holds, an unknown last pulse never blocks, a bad clock never fires", () => {
    assert.equal(shouldPulse(null, 1000), true);
    assert.equal(shouldPulse(1000, 1000 + PULSE_GAP_MS - 1), false);
    assert.equal(shouldPulse(1000, 1000 + PULSE_GAP_MS), true);
    assert.equal(shouldPulse(1000, NaN), false);
});

check("THE LINE'S ORDER: a fresh pulse, then what they picked, then the timer, then the brief — each with its paper", () => {
    const now = 10_000;
    const live = pomodoroLive({ isActive: true, isRunning: true, isBreak: false, timeLeft: 900, total: 1500 }, POMO.chart);
    const pulse = { line: "Recall · X", at: now - 100 };
    assert.equal(brainLine({ data: POMO, picked: "acc", live, pulse, now }).kind, "pulse");
    assert.equal(brainLine({ data: POMO, picked: "acc", live, pulse: { ...pulse, at: now - PULSE_HOLD_MS }, now }).kind, "region",
        "a stale pulse held the line");
    assert.equal(brainLine({ data: POMO, picked: "acc", live, now }).kind, "region", "the timer talked over a region they picked");
    const timed = brainLine({ data: POMO, live, now });
    assert.deepEqual([timed.kind, timed.beat], ["live", "chart"], "the minute line cites the brain, not the attention study");
    assert.equal(brainLine({ data: POMO, now }).text, POMO.brief);
    const resting = brainLine({ data: POMO, live: pomodoroLive({ isActive: true, isRunning: true, isBreak: true, timeLeft: 9, total: 300 }, POMO.chart), now });
    assert.equal(resting.beat, "brain", "the break line cites the attention study instead of the network paper");
});

/* ── Wiring ───────────────────────────────────────────────────────────────── */

const panel = strip(read("src/components/study/NeuroPanel.jsx"));
const brain = strip(read("src/components/study/BrainModel.jsx"));
const chart = strip(read("src/components/study/EvidenceChart.jsx"));
const timer = strip(read("src/components/study/PomodoroTimer.jsx"));

check("EVERY TECHNIQUE FIRES ITS OWN PULSE, and the card listens on the same name", () => {
    const where = {
        spaced_repetition: "src/components/study/SpacedRepetition.jsx",
        active_recall: "src/components/study/ActiveRecall.jsx",
        blurting: "src/components/study/BlurtingMethod.jsx",
        exam: "src/components/study/ExamMode.jsx",
        mind_map: "src/components/study/MindMaps.jsx",
    };
    for (const [id, file] of Object.entries(where)) {
        // EVERY call, not one: the exam fires from two places, and a scan that
        // finds one good call passes with the other naming nobody.
        const calls = [...strip(read(file)).matchAll(/signalBrain\("([^"]+)"/g)].map((m) => m[1]);
        assert.ok(calls.length > 0, `${id} never tells the card the work happened`);
        for (const c of calls) assert.equal(c, id, `${file} signals "${c}", which no card answers to`);
        assert.ok(pulseFor(id), `${id} fires a pulse its card cannot draw`);
    }
    assert.ok(/new CustomEvent\("acedit:brain"/.test(strip(read("src/lib/brainSignal.js"))));
    assert.ok(/addEventListener\("acedit:brain"/.test(panel), "nothing listens for the pulse");
    assert.ok(/addEventListener\("timerStateChanged"/.test(panel), "the card cannot hear the timer");
});

check("a skipped recall question pulses nothing; a rating pulses before anything awaits", () => {
    const ar = strip(read("src/components/study/ActiveRecall.jsx"));
    assert.ok(/\.trim\(\)\) signalBrain\("active_recall"/.test(ar), "moving past a BLANK answer pulsed the brain");
    const sr = strip(read("src/components/study/SpacedRepetition.jsx"));
    const body = sr.slice(sr.indexOf("const handleRateCard"), sr.indexOf("const handleRateCard") + 3000);
    assert.ok(body.indexOf("signalBrain(") > -1 && body.indexOf("signalBrain(") < body.indexOf("await "),
        "the pulse waits on a database write, so it lands after the student has moved on");
});

check("THE TIMER BROADCASTS ITS TOTAL, which is what the curve is placed against", () => {
    const at = timer.indexOf("const globalTimerState = {");
    assert.ok(at > -1);
    const obj = timer.slice(at, timer.indexOf("};", at));
    assert.ok(/\btotal:/.test(obj), "the broadcast has no total, so the card cannot place the student");
});

check("the brain is driven through REFS, so a tap or a tick never tears the canvas loop down", () => {
    assert.ok(/\}, \[regions, height, reduced, glow, plate\]\);/.test(brain),
        "the draw effect re-runs on focus, pulse or label — every second of a running timer");
    for (const r of ["focusRef", "pulseRef", "labelIdRef"]) assert.ok(brain.includes(`${r}.current`), `${r} is never read`);
    assert.ok(/const pk = reduced \|\|/.test(brain), "a pulse flashes under reduced motion");
    assert.ok(/tag\.style\.transform/.test(brain), "the label is positioned through React state, sixty renders a second");
});

check("the chart keeps its provenance, draws its line by a clip, and nothing it said was lost", () => {
    assert.ok(/<Provenance chart=\{chart\} \/>/.test(chart), "a schematic chart renders without saying so");
    assert.ok(/clipPath=\{`url\(#\$\{clip\}\)`\}/.test(chart) && !/pathLength/.test(chart), "the line is tweened, not revealed");
    assert.ok(/caption=\{false\}/.test(panel) && /lead=\{data\.chart\?\.caption\}/.test(panel),
        "the caption was hidden from the chart and not moved behind its footnote");
    assert.ok(/lead=\{data\.feelsLike\}/.test(panel), "the long 'feels like' went nowhere");
    assert.ok(/\{data\.caveat\}/.test(panel), "the caveat is gone");
    assert.ok(/\{REGION_NOTE\}/.test(panel), "the brain no longer says it is a schematic");
});

console.log(`\n${passed} science card checks passed`);
