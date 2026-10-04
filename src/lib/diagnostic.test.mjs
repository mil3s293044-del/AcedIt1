/**
 * diagnostic — the scan, and the four ways it could quietly stop being honest.
 *
 * Every assertion here is a property that renders perfectly when broken: a
 * readout that always finds something, a loop that never reaches the all-clear,
 * a grammar finding on a Chemistry answer, a fault with no repair behind it.
 * None of them throws and none of them is visible in a screenshot of one run.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    FAULTS, FAULT_LIST, isFault, familyOf, faultApplies, faultsFor,
    anchorOf, normaliseFinding, readScan, markedSegments,
    setCleared, progressOf, nextOpen, applyRescan, openKeys, repairSeed,
    FINDINGS_MAX, SCAN_FEATURE, SCAN_MODEL, WORK_MAX,
} from "./diagnostic.js";
import { scanSystem, scanPrompt, SCAN_SCHEMA, rescanPrompt } from "./diagnosticPrompt.js";
import { TOOL_LABELS, labelForTool } from "./toolLabels.js";
import { PRICE, ALREADY_CHEAP } from "./chips.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log("  ok ", name); };

const WORK = "The rate goes up when heated because particles move faster and collide more.";
const raw = (over = {}) => ({ fault: "precision", says: "Everyday wording.", ...over });

/* ── Every fault can actually be repaired ────────────────────────────────── */

ok("EVERY FAULT NAMES A TOOL THAT EXISTS", () => {
    // A finding whose tool is not in the catalogue renders a button that opens
    // the WRONG persona — `toolById` falls back to the first tool rather than
    // returning null, so it fails by looking like it worked.
    for (const f of FAULT_LIST) {
        assert.ok(labelForTool(f.tool), `fault ${f.id} routes to "${f.tool}", which is not a tool`);
        assert.ok(TOOL_LABELS[f.tool], `fault ${f.id} routes to a RETIRED tool`);
    }
});

ok("THE THREE REPAIRS THE REBUILD ADDED ARE REACHABLE", () => {
    // Each exists because a fault class had no repair. If one is ever dropped
    // from the catalogue its fault silently routes nowhere.
    for (const id of ["command_term", "precision", "allocation"]) {
        assert.ok(TOOL_LABELS[id], `${id} is not in the catalogue`);
        assert.ok(FAULT_LIST.some((f) => f.tool === id), `${id} repairs no fault`);
    }
});

ok("every fault is ranked uniquely, so the order is not arbitrary", () => {
    const ranks = FAULT_LIST.map((f) => f.rank);
    assert.equal(new Set(ranks).size, ranks.length);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
});

/* ── Subject gating ─────────────────────────────────────────────────────── */

ok("GRAMMAR IS NOT A FAULT IN CHEMISTRY, and that is not a detail", () => {
    // markingPrompt.js records that VCAA does not penalise spelling or notation
    // outside the English studies. A readout that flagged expression on a
    // Chemistry answer would send a student to spend an evening on the one
    // thing that was never going to earn a mark, with the app's authority
    // behind it.
    assert.equal(faultApplies(FAULTS.expression, "Chemistry"), false);
    assert.equal(faultApplies(FAULTS.expression, "Mathematical Methods"), false);
    assert.equal(faultApplies(FAULTS.expression, "English"), true);
    assert.equal(faultApplies(FAULTS.expression, "Literature"), true);
    assert.equal(faultApplies(FAULTS.expression, "EAL"), true);
});

ok("THERE IS NO WORKING TO SHOW IN AN ENGLISH ESSAY", () => {
    assert.equal(faultApplies(FAULTS.working, "English"), false);
    assert.equal(faultApplies(FAULTS.working, "Chemistry"), true);
    assert.equal(faultApplies(FAULTS.working, "Mathematical Methods"), true);
});

ok("`subjectIsMathHeavy` IS NOT THE GATE, and Chemistry is why", () => {
    // That flag decides whether a prompt needs the LaTeX rules, so it is TRUE
    // for Chemistry — routed on it, a Chemistry student was sent to the maths
    // tutor. The families are name matches for the same reason the learning
    // areas are hand-mapped.
    assert.equal(familyOf("Chemistry"), "other");
    assert.equal(familyOf("Mathematical Methods"), "maths");
    assert.equal(familyOf("English Language"), "english");
});

ok("THE GATE REACHES THE PROMPT, not just the validator", () => {
    // Dropping an inapplicable finding after the fact still PAID for it and
    // still spent one of the student's six. The menu the scan is handed is
    // already filtered.
    const chem = scanSystem("Chemistry");
    assert.ok(!/"expression"/.test(chem), "the Chemistry scan is still offered expression");
    assert.ok(/"working"/.test(chem));
    const eng = scanSystem("English");
    assert.ok(/"expression"/.test(eng));
    assert.ok(!/"working"/.test(eng), "the English scan is still offered working");
});

/* ── Reading a scan back ────────────────────────────────────────────────── */

ok("CLEAN IS A RESULT, not an error", () => {
    // The property the whole design rests on. A scan that always finds five
    // faults is a horoscope, and the first good paragraph told it is broken
    // costs every later finding its credibility.
    const out = readScan({ findings: [] }, { work: WORK, subject: "Chemistry" });
    assert.equal(out.ok, true);
    assert.deepEqual(out.findings, []);
    assert.equal(progressOf(out.findings).allClear, true);
});

ok("THE PROMPT SAYS CLEAN IS ALLOWED, in as many words", () => {
    const sys = scanSystem("Chemistry");
    assert.ok(/CLEAN IS A REAL ANSWER/.test(sys));
    assert.ok(/empty findings array/i.test(sys));
    assert.ok(/do not pad/i.test(sys) || /Do NOT pad/.test(sys));
});

ok("AN OFF-MENU FAULT IS DROPPED, never rendered as a mystery row", () => {
    assert.equal(normaliseFinding(raw({ fault: "vibes" }), { work: WORK }), null);
    assert.equal(normaliseFinding(raw({ fault: "" }), { work: WORK }), null);
});

ok("a finding with nothing written in it is dropped", () => {
    assert.equal(normaliseFinding(raw({ says: "" }), { work: WORK }), null);
    assert.equal(normaliseFinding(raw({ says: "   " }), { work: WORK }), null);
});

ok("A GATED FAULT IS DROPPED EVEN IF THE MODEL RETURNS IT", () => {
    // Belt as well as braces: the menu excludes it, and a model that reports it
    // anyway does not reach the screen.
    const f = normaliseFinding(raw({ fault: "expression", says: "Comma splice." }),
        { work: WORK, subject: "Chemistry" });
    assert.equal(f, null);
});

ok("the readout is capped and sorted worst-first", () => {
    const many = Array.from({ length: 12 }, () => raw());
    const out = readScan({ findings: many }, { work: WORK, subject: "Chemistry" });
    assert.ok(out.findings.length <= FINDINGS_MAX);
    const ranks = out.findings.map((f) => f.rank);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
});

ok("keys are unique, so clearing one cannot clear another", () => {
    const out = readScan({ findings: [raw(), raw(), raw()] }, { work: WORK, subject: "Chemistry" });
    assert.equal(new Set(out.findings.map((f) => f.key)).size, out.findings.length);
});

ok("a scan that came back as nothing at all is still readable", () => {
    for (const bad of [null, undefined, {}, { findings: "no" }, { findings: null }]) {
        assert.deepEqual(readScan(bad, { work: WORK }).findings, []);
    }
});

/* ── Pointing ───────────────────────────────────────────────────────────── */

ok("A QUOTE IS AN EXACT MATCH OR IT IS NOTHING", () => {
    // annotate.js settled this: no fuzzy matching, because underlining the
    // wrong six words and saying they cost a mark sends a student to rewrite a
    // sentence that was fine.
    assert.ok(anchorOf("move faster", WORK));
    assert.equal(anchorOf("moves faster", WORK), null);
    assert.equal(anchorOf("", WORK), null);
});

ok("AN UNQUOTABLE FINDING KEEPS ITS ROW", () => {
    // The strongest findings are the unquotable ones — "never names the
    // mechanism" is unquotable precisely in that the words are absent. Dropping
    // them would delete the important half of every readout.
    const f = normaliseFinding(raw({ quote: "words that are not there" }), { work: WORK });
    assert.ok(f, "a finding whose quote did not match was dropped entirely");
    assert.equal(f.anchor, null);
    assert.ok(f.says);
});

ok("OVERLAPPING UNDERLINES ARE DROPPED, not nested or merged", () => {
    const fs = [
        { key: "a", fault: "precision", anchor: anchorOf("move faster", WORK) },
        { key: "b", fault: "understanding", anchor: anchorOf("faster and collide", WORK) },
    ];
    const segs = markedSegments(WORK, fs);
    const marked = segs.filter((s) => s.key);
    assert.equal(marked.length, 1, "two overlapping spans both underlined");
    assert.equal(marked[0].key, "a");
    // And the text is never altered by the split.
    assert.equal(segs.map((s) => s.text).join(""), WORK);
});

ok("the segments round-trip whatever the findings are", () => {
    assert.equal(markedSegments(WORK, []).map((s) => s.text).join(""), WORK);
    assert.deepEqual(markedSegments("", [{ key: "a", anchor: { start: 0, end: 1 } }]), []);
});

/* ── The loop terminates ────────────────────────────────────────────────── */

ok("A RE-SCAN MAY CLEAR AND MAY KEEP. IT MAY NOT ADD.", () => {
    // This is what makes the all-clear reachable. Left to append, each pass
    // finds new or reshaped faults and a student who worked for an hour sees a
    // readout as red as when they started.
    const before = readScan({ findings: [raw(), raw({ fault: "understanding", says: "x" })] },
        { work: WORK, subject: "Chemistry" }).findings;
    const after = applyRescan(before, [before[1].key, "a-key-that-was-never-in-this-run"]);
    assert.equal(after.length, before.length, "a re-scan added a finding");
    assert.equal(after.find((f) => f.key === before[0].key).cleared, true);
    assert.equal(after.find((f) => f.key === before[1].key).cleared, false);
});

ok("A RE-SCAN DOES NOT RE-OPEN WHAT THE STUDENT CLEARED", () => {
    const first = readScan({ findings: [raw()] }, { work: WORK, subject: "Chemistry" }).findings;
    const cleared = setCleared(first, first[0].key, true);
    // The model says it is still there. The student already said otherwise.
    const after = applyRescan(cleared, [first[0].key]);
    assert.equal(after[0].cleared, true);
});

ok("a re-scan with nothing still open clears everything", () => {
    const f = readScan({ findings: [raw(), raw()] }, { work: WORK, subject: "Chemistry" }).findings;
    assert.equal(progressOf(applyRescan(f, [])).allClear, true);
});

ok("THE RE-SCAN PROMPT ASKS ONLY ABOUT WHAT IS OPEN", () => {
    const f = readScan({ findings: [raw()] }, { work: WORK, subject: "Chemistry" }).findings;
    const p = rescanPrompt(WORK, f);
    assert.ok(p.includes(f[0].key));
    assert.ok(/discarded/i.test(p), "the prompt does not say new findings are thrown away");
});

ok("progress reads the way the trace draws it", () => {
    const f = readScan({ findings: [raw(), raw(), raw()] }, { work: WORK, subject: "Chemistry" }).findings;
    assert.deepEqual(progressOf(f), { total: 3, cleared: 0, open: 3, pct: 0, allClear: false });
    const one = setCleared(f, f[0].key, true);
    assert.equal(progressOf(one).cleared, 1);
    assert.equal(nextOpen(one).key, f[1].key);
    assert.equal(nextOpen(applyRescan(f, [])), null);
    assert.deepEqual(openKeys(one), [f[1].key, f[2].key]);
});

/* ── Price and model ────────────────────────────────────────────────────── */

ok("THE SCAN HAS A PUBLISHED PRICE", () => {
    // Everything else on this page costs what chips.js published. An unpriced
    // feature falls through to DEFAULT_PRICE, which is the dearest in the
    // table — a scan silently billing like a quiz generate.
    assert.ok(PRICE[SCAN_FEATURE] > 0, "the scan has no price of its own");
    assert.ok(PRICE[SCAN_FEATURE] < PRICE.ai_chat, "a scan should not cost more than a chat turn");
});

ok("IT IS PINNED TO HAIKU, not left to the `fast` flag", () => {
    // `FAST_MODEL` falls back to MODEL when ANTHROPIC_FAST_MODEL is unset, so a
    // price claim resting on it is true on one deploy and wrong on the next.
    assert.match(SCAN_MODEL, /haiku/i);
    const src = readFileSync(new URL("../../server.mjs", import.meta.url), "utf8");
    assert.ok(/feature === SCAN_FEATURE \? SCAN_MODEL/.test(src),
        "the server no longer forces the scan onto the pinned model");
    // And Saver cannot make it cheaper, because it already is.
    assert.ok(ALREADY_CHEAP.has(SCAN_FEATURE));
});

/* ── The repair ─────────────────────────────────────────────────────────── */

ok("THE REPAIR SEED CARRIES ONE FINDING, never the whole readout", () => {
    const f = readScan({ findings: [raw({ quote: "move faster", wanted: "kinetic energy" }), raw({ fault: "understanding", says: "Second one." })] },
        { work: WORK, subject: "Chemistry" }).findings;
    const seed = repairSeed(f[0], WORK);
    assert.ok(seed.includes(f[0].says));
    assert.ok(!seed.includes(f[1].says), "the seed carries a second finding — the repair fixes ONE thing");
    assert.ok(seed.includes(WORK), "the seed does not carry the work");
    assert.ok(/do not rewrite/i.test(seed));
    assert.equal(repairSeed(null, WORK), "");
});

ok("the work is bounded everywhere it is sent", () => {
    const long = "x".repeat(WORK_MAX + 500);
    assert.ok(repairSeed({ fault: "precision", says: "s" }, long).length < long.length);
    assert.ok(scanPrompt(long, { subject: "Chemistry" }).length < long.length + 2000);
});

ok("WITHOUT THE QUESTION, TWO FAULTS MAY NOT BE CLAIMED", () => {
    // Both are statements about a question the scan cannot see. Reporting them
    // anyway is the `markPercent` failure: a guess that reads as a measurement.
    const blind = scanPrompt(WORK, { subject: "Chemistry" });
    assert.ok(/do NOT report/.test(blind));
    assert.ok(blind.includes("command_term") && blind.includes("allocation"));
    const sighted = scanPrompt(WORK, { subject: "Chemistry", question: "Explain the trend." });
    assert.ok(!/do NOT report/.test(sighted));
});

/* ── Nothing here runs a model ──────────────────────────────────────────── */

ok("NOTHING IN THE MODEL CALLS OR STORES ANYTHING", () => {
    const src = readFileSync(new URL("./diagnostic.js", import.meta.url), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const bad of ["InvokeLLM", ".create(", ".update(", "localStorage", "supabase", "fetch("]) {
        assert.ok(!src.includes(bad), `diagnostic.js must stay pure — found ${bad}`);
    }
});

ok("the schema asks for exactly what readScan reads", () => {
    const props = SCAN_SCHEMA.properties.findings.items.properties;
    for (const k of ["fault", "says", "wanted", "quote"]) assert.ok(props[k], `schema is missing ${k}`);
    assert.deepEqual(SCAN_SCHEMA.properties.findings.items.required, ["fault", "says"]);
});

ok("THE BENCH VOCABULARY IS GONE FROM EVERY SCREEN", () => {
    // The words a student reads. Storage keys deliberately did NOT move —
    // `input_data.workpiece` is on real rows — which is the sideLabels rule:
    // only the label changes.
    for (const file of ["../pages/AITools.jsx", "../components/ai_tools/Readout.jsx",
                        "../components/ai_tools/ScanIntake.jsx"]) {
        // WHAT A STUDENT READS, which is not the same as what the file says.
        // Import paths, class names and identifiers legitimately keep the old
        // word — `bench.js` groups rows on a stored key and renaming it would
        // strand them, which is the sideLabels rule. So comments, imports and
        // className values come out before the scan, or it reports the module
        // path as the defect: the false-positive class fnResult.test.mjs and
        // hookDeps.test.mjs each had to learn.
        const src = readFileSync(new URL(file, import.meta.url), "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
            .replace(/^\s*import .*$/gm, "")
            .replace(/className=\{?`[^`]*`\}?/g, "").replace(/className="[^"]*"/g, "");
        // `\n` is excluded from the string class DELIBERATELY. Without it the
        // match runs from one quote to the next across hundreds of lines and
        // reports the whole file as one string — which is how the first draft
        // of this scan "found" the word in an import three screens away.
        // The two forms need DIFFERENT newline rules and that is not a detail.
        // A quoted literal must stay on one line or the match runs from one
        // quote to the next across the whole file. A JSX text node is bounded
        // by its own angle brackets and is routinely wrapped over three lines —
        // excluding newlines there made the scan blind to every paragraph on
        // the page, which is most of the copy it exists to read.
        const strings = [...src.matchAll(/"([^"\\/@\n]{4,})"|>([^<>{}]{4,})</g)]
            .map((m) => m[1] || m[2]).join(" | ");
        assert.ok(!/\bbench\b/i.test(strings), `${file} still says "bench" to a student`);
        assert.ok(!/\bworkpiece\b/i.test(strings), `${file} still says "workpiece" to a student`);
    }
});

console.log(`\ndiagnostic: ${n} checks passed`);
