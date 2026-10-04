/**
 * toolBrief — subject routing, and the one query a handover uses.
 *
 * The brief's card builders moved to `workpieceSources.js` when /AITools became
 * a bench; what is left is the routing every screen shares and the query string
 * the deep links are built from. Both fail SILENTLY when wrong — a wrong
 * persona marks an essay like a maths problem, and a misspelled key lands on
 * the right page with nothing opened.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { personaFor, toolQuery } from "./toolBrief.js";
import { CHAT_TOOLS } from "../components/ai_tools/chatTools.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log("  ok ", name); };

ok("a subject routes to the persona that marks its work", () => {
    assert.equal(personaFor("Mathematical Methods"), "math_tutor");
    assert.equal(personaFor("Specialist Mathematics"), "math_tutor");
    assert.equal(personaFor("General Mathematics"), "math_tutor");
    assert.equal(personaFor("English"), "english_mentor");
    assert.equal(personaFor("Literature"), "english_mentor");
    assert.equal(personaFor("English (EAL)"), "english_mentor");
});

ok("`subjectIsMathHeavy` IS NOT THE ROUTE, and this is why", () => {
    // That flag decides whether a prompt needs the LaTeX rules, so it is true
    // for Chemistry, Physics, Economics and Psychology. Routed on it, a student
    // with a Chemistry SAC was sent to the MATH TUTOR.
    for (const s of ["Chemistry", "Physics", "Economics", "Psychology", "Biology"]) {
        assert.equal(personaFor(s), "exam_questions", `${s} must not go to the maths tutor`);
    }
});

ok("anything unrecognised gets the general examiner rather than a guess", () => {
    assert.equal(personaFor(""), "exam_questions");
    assert.equal(personaFor(null), "exam_questions");
    assert.equal(personaFor("Food Studies"), "exam_questions");
});

ok("EVERY PERSONA IT CAN RETURN IS A REAL TOOL", () => {
    // An id that does not match `chatTools.js` falls back to the FIRST tool
    // rather than failing, so a typo here runs the wrong persona silently.
    const ids = new Set(CHAT_TOOLS.map((t) => t.id));
    for (const s of ["Mathematical Methods", "English", "Chemistry", ""]) {
        assert.ok(ids.has(personaFor(s)), `${personaFor(s)} is not a chat tool`);
    }
});

ok("the query names the keys the chat actually reads", () => {
    const q = toolQuery({ tool: "concept_explainer", seed: "why", subject: "Chemistry" });
    const p = new URLSearchParams(q);
    assert.equal(p.get("tool"), "concept_explainer");
    assert.equal(p.get("q"), "why");
    assert.equal(p.get("subject"), "Chemistry");

    // THE READER IS THE TEST. A key spelled differently here lands on the right
    // page with nothing opened, and nothing anywhere reports it.
    const chat = readFileSync(
        new URL("../components/ai_tools/UnifiedChat.jsx", import.meta.url), "utf8");
    for (const key of ["tool", "q", "subject"]) {
        assert.ok(chat.includes(`params.get("${key}")`), `UnifiedChat never reads "${key}"`);
    }
});

ok("an empty field is omitted rather than sent blank", () => {
    assert.equal(toolQuery({ tool: "math_tutor" }), "tool=math_tutor");
    assert.equal(toolQuery({}), "");
});

ok("NOTHING HERE CALLS A MODEL", () => {
    const src = readFileSync(new URL("./toolBrief.js", import.meta.url), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    for (const bad of ["InvokeLLM", "streamingAI", "invoke(", "fetch("]) {
        assert.ok(!src.includes(bad), `toolBrief must not reach for ${bad}`);
    }
});

console.log(`\ntoolBrief: ${n} checks passed`);
