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
    KINDS, KIND_LIST, isKind, OPERATIONS, operationById,
    toolsFor, leadTool, makeWorkpiece, titleFrom, seedFor, stepTitle, BODY_MAX,
} from "./workpiece.js";
import { CHAT_TOOLS } from "../components/ai_tools/chatTools.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log("  ok ", name); };

const wp = (over) => makeWorkpiece({ kind: "question", body: "Explain the trend.", ...over });

/* ── Every operation names a real tool ───────────────────────────────────── */

ok("EVERY OPERATION RUNS A TOOL THAT EXISTS", () => {
    // An id that does not match `chatTools.js` falls back to the FIRST tool
    // rather than failing, so a typo here would silently run the maths tutor
    // over an essay and nothing would say so.
    const ids = new Set(CHAT_TOOLS.map((t) => t.id));
    for (const op of OPERATIONS) {
        assert.ok(ids.has(op.tool), `${op.id} names "${op.tool}", which is not a chat tool`);
    }
});

ok("every operation applies to at least one real kind", () => {
    for (const op of OPERATIONS) {
        assert.ok(op.appliesTo.length, `${op.id} applies to nothing`);
        for (const k of op.appliesTo) assert.ok(isKind(k), `${op.id} applies to unknown kind "${k}"`);
    }
});

ok("EVERY KIND HAS AT LEAST ONE TOOL", () => {
    // A kind a student can pick that then offers an empty toolbar is a dead
    // end on the one screen whose whole promise is that it gives you something
    // to do with the thing you brought.
    for (const k of KIND_LIST) {
        const tools = toolsFor({ kind: k.id, body: "x", subject: null });
        assert.ok(tools.length, `${k.id} has no operations`);
    }
});

ok("THE STUDY COACH IS NOT AN OPERATION", () => {
    // It is advice about studying rather than something done to a piece of
    // work, so on a bench beside "mark it" it would be the one tool that does
    // nothing to the thing in front of you.
    assert.ok(!OPERATIONS.some((o) => o.tool === "study_coach"));
});

/* ── What applies, and what must not ─────────────────────────────────────── */

ok("A TOOL THAT CANNOT ACT ON THIS WORKPIECE IS NOT OFFERED", () => {
    const problem = toolsFor(wp({ kind: "problem" })).map((o) => o.id);
    assert.ok(!problem.includes("memorise"), "you do not memorise a quadratic");
    assert.ok(!problem.includes("mark"), "there is nothing written to mark");

    const topic = toolsFor(wp({ kind: "topic" })).map((o) => o.id);
    assert.ok(!topic.includes("mark"), "you cannot mark a concept");

    const writing = toolsFor(wp({ kind: "writing" })).map((o) => o.id);
    assert.ok(writing.includes("mark"), "writing is the thing that gets marked");
    assert.ok(!writing.includes("work"), "an essay is not worked through line by line");
});

ok("THE SUBJECT PROMOTES ITS OWN PERSONA AND NOTHING ELSE MOVES", () => {
    const plain = toolsFor(wp({ kind: "question", subject: "Legal Studies" }));
    const maths = toolsFor(wp({ kind: "question", subject: "Mathematical Methods" }));
    const english = toolsFor(wp({ kind: "writing", subject: "English" }));

    assert.equal(maths[0].tool, "math_tutor", "a maths question leads with the tutor");
    assert.equal(english[0].tool, "english_mentor", "English writing leads with the mentor");

    // ── A FALLBACK IS NOT A NOMINATION ──────────────────────────────────────
    // `personaFor` returns `exam_questions` for everything it does not
    // recognise. Promoted on that, EVERY subject but maths and English led with
    // "Question me" — a Chemistry criterion the student keeps dropping opened
    // offering to test them rather than explain it. Only a specialist promotes.
    assert.equal(plain[0].id, "explain",
        "an unrecognised subject must leave the ranks alone");
    const chem = toolsFor(wp({ kind: "question", subject: "Chemistry" }));
    assert.equal(chem[0].id, "explain", "Chemistry is not a maths or English study");

    // The SET is unchanged — promotion reorders, it never adds or removes, or
    // the toolbar would gain and lose buttons for a reason a student cannot see.
    assert.deepEqual(
        [...maths.map((o) => o.id)].sort(),
        [...plain.map((o) => o.id)].sort(),
        "the subject must not change WHICH tools apply");

    // ── AND THE CASE THAT ACTUALLY BITES ────────────────────────────────────
    // The pair above cannot catch a promotion that ADDS, because for a question
    // both personas' tools already apply — the first draft of this test proved
    // nothing, and only injecting the bug and watching it pass showed that. The
    // real hazard is a kind the persona's tool does NOT apply to: a Methods
    // TOPIC must not be offered "work it through", because a topic is not
    // worked through line by line however mathematical the subject is.
    const mathsTopic = toolsFor(wp({ kind: "topic", subject: "Specialist Mathematics" }));
    assert.ok(!mathsTopic.some((o) => o.id === "work"),
        "the subject promoted a tool that cannot act on this kind");
    assert.deepEqual(
        [...mathsTopic.map((o) => o.id)].sort(),
        [...toolsFor(wp({ kind: "topic", subject: "Legal Studies" })).map((o) => o.id)].sort(),
        "a topic offers the same tools whatever the subject");
});

ok("an unknown kind gets no tools rather than all of them", () => {
    assert.deepEqual(toolsFor({ kind: "banana", body: "x" }), []);
    assert.deepEqual(toolsFor(null), []);
    assert.equal(leadTool(null), null);
});

/* ── Building one ────────────────────────────────────────────────────────── */

ok("A WORKPIECE WITH NO BODY IS NOT A WORKPIECE", () => {
    assert.equal(makeWorkpiece({ kind: "question", body: "" }), null);
    assert.equal(makeWorkpiece({ kind: "question", body: "   " }), null);
    assert.equal(makeWorkpiece({ kind: "nope", body: "real text" }), null);
});

ok("the body is bounded, because a bench is not a textbook", () => {
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

ok("THE SEED CARRIES THE WORKPIECE, which is the whole point", () => {
    // If it did not, the student would restate what they are working on for
    // every tool — the exact complaint the bench replaced.
    //
    // EVERY OPERATION, not the ones one fixture happens to reach. The first
    // draft looped `toolsFor(a question)`, which never includes `mark` — so the
    // marking seed could have dropped the essay entirely and this passed. Each
    // operation is checked against a workpiece of a kind it actually applies to.
    for (const op of OPERATIONS) {
        const w = makeWorkpiece({
            kind: op.appliesTo[0],
            body: "Evaluate the integral of x e^x.",
            subject: "Mathematical Methods",
        });
        const seed = seedFor(op, w);
        assert.ok(seed.includes(w.body), `${op.id} drops the work from its opening message`);
        assert.ok(seed.length > w.body.length + 10, `${op.id} sends the body and no instruction`);
    }
});

ok("a seed with nothing to work on is empty rather than an instruction about nothing", () => {
    assert.equal(seedFor(operationById("explain"), null), "");
    assert.equal(seedFor(null, wp()), "");
});

ok("a step is titled by what was DONE, not by the tool's brand name", () => {
    const t = stepTitle(operationById("mark"), wp({ subject: "English" }));
    assert.ok(t.startsWith("Mark it"), `got ${t}`);
    assert.ok(t.includes("English"));
    // "English Mentor" is a persona; a bench records operations.
    assert.ok(!/Mentor|Tutor|Planner/.test(t), "a step is a verb, not a persona");
});

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
