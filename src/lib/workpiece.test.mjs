/**
 * workpiece — the bench's model.
 *
 * What is asserted here is the half that renders perfectly while being wrong:
 * a toolbar offering an operation that cannot act on the thing in front of it,
 * a seed that forgets to carry the work, a title clipped mid-word.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    KINDS, KIND_LIST, isKind, makeWorkpiece, titleFrom,
    SOURCES, BODY_MAX, workpieceKey,
} from "./workpiece.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log("  ok ", name); };

const wp = (over) => makeWorkpiece({ kind: "question", body: "Explain the trend.", ...over });

/* ── What a workpiece is ─────────────────────────────────────────────────── */

/* ── What applies, and what must not ─────────────────────────────────────── */

/* ── Building one ────────────────────────────────────────────────────────── */

ok("A WORKPIECE WITH NO BODY IS NOT A WORKPIECE", () => {
    assert.equal(makeWorkpiece({ kind: "question", body: "" }), null);
    assert.equal(makeWorkpiece({ kind: "question", body: "   " }), null);
    assert.equal(makeWorkpiece({ kind: "nope", body: "real text" }), null);
});

ok("the body is bounded, because a scan is not a textbook", () => {
    const w = makeWorkpiece({ kind: "material", body: "x".repeat(BODY_MAX + 500) });
    assert.equal(w.body.length, BODY_MAX);
});

ok("A TITLE IS CUT AT A SENTENCE, never mid-word", () => {
    assert.equal(titleFrom("Explain the trend. Then justify it."), "Explain the trend.");
    // A long first sentence still has to be cut, and the cut is VISIBLE — a
    // silent clip is what put a stem on screen reading as broken text.
    const long = titleFrom(`${"word ".repeat(40)}end.`);
    assert.ok(long.length <= 72, "a title stays short");
    assert.ok(long.endsWith("…"), "a cut says it was cut");
    assert.ok(!/\s…$/.test(long), "no dangling space before the ellipsis");
    assert.equal(titleFrom(""), "Untitled");
});

ok("A REF IS A WAY BACK OR IT IS NOTHING", () => {
    // Typed and uploaded work has nowhere to return to, and a link that goes
    // nowhere is worse than no link.
    assert.equal(wp({ ref: { label: "nowhere" } }).ref, null, "a ref with no page is dropped");
    const back = wp({ ref: { page: "MistakeBank", label: "In your bank" } });
    assert.equal(back.ref.page, "MistakeBank");
});

ok("an unknown source falls back rather than being printed raw", () => {
    assert.equal(wp({ source: "smuggled" }).source, "typed");
    assert.equal(wp({ source: "missed" }).source, "missed");
});

/* ── The seed ────────────────────────────────────────────────────────────── */

/* ── The property the module rests on ────────────────────────────────────── */

ok("NOTHING HERE CALLS A MODEL", () => {
    const src = readFileSync(new URL("./workpiece.js", import.meta.url), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    for (const bad of ["streamingAI", "InvokeLLM", "invoke(", "fetch(", ".create(", ".update("]) {
        assert.ok(!src.includes(bad), `workpiece must not reach for ${bad}`);
    }
});

console.log(`\nworkpiece: ${n} checks passed`);
