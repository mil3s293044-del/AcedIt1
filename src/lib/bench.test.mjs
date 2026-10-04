/**
 * bench — benches reconstructed from saved conversations.
 *
 * The assertions here are the ones where a student LOSES WORK and nothing on
 * screen says so: two benches for one piece because the key moved, a chat from
 * before the workpiece existed stranded off the shelf, steps in the wrong
 * order, or an adopted bench that splits in half the moment its kind is named.
 * None of them throws and none of them is visible in a render.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    benches, chatRows, draftFromChat, benchKeyOf, stepFromRow, BENCH_MAX,
} from "./bench.js";
import { makeWorkpiece, workpieceKey, SOURCES, isKind } from "./workpiece.js";
import { TOOL_LABELS, labelForTool } from "./toolLabels.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log("  ok ", name); };

const WP = makeWorkpiece({
    kind: "question",
    body: "Explain why graphite conducts electricity but diamond does not.",
    subject: "Chemistry",
    source: "mistake",
});

const msgs = (text = "hello") => ([
    { role: "user", content: text },
    { role: "assistant", content: "right then" },
]);

const row = (over = {}) => ({
    id: over.id || "r1",
    tool_type: over.tool_type ?? "concept_explainer",
    title: over.title ?? "Explain this",
    subject_name: over.subject_name ?? "Chemistry",
    created_date: over.created_date || "2026-10-01T09:00:00.000Z",
    updated_date: over.updated_date,
    input_data: {
        messages: over.messages === undefined ? msgs() : over.messages,
        subject: over.subject ?? "Chemistry",
        ...(over.workpiece === undefined ? { workpiece: WP } : (over.workpiece ? { workpiece: over.workpiece } : {})),
        ...(over.operation === undefined ? { operation: "explain" } : (over.operation ? { operation: over.operation } : {})),
    },
});

/* ── What counts as a chat ──────────────────────────────────────────────── */

ok("A LEGACY TOOL RESULT IS NOT A CHAT and is not put on the shelf", () => {
    const rows = [
        { id: "a", input_data: { messages: [] } },
        { id: "b", input_data: {} },
        { id: "c", content: "a cheat sheet" },
        { id: "d" },
        row({ id: "e" }),
    ];
    assert.deepEqual(chatRows(rows).map((r) => r.id), ["e"]);
});

ok("THE PREDICATE IS SHARED WITH THE SIDEBAR, never restated", () => {
    // `UnifiedChat` filters its sidebar the same way. Two copies would let the
    // shelf and the sidebar disagree about what the student has.
    const src = readFileSync(new URL("../components/ai_tools/UnifiedChat.jsx", import.meta.url), "utf8");
    const inline = /\.filter\(\s*c\s*=>\s*Array\.isArray\(c\.input_data\?\.messages\)/.test(src);
    assert.ok(
        !inline || /chatRows/.test(src),
        "UnifiedChat still rolls its own chat-row filter — import chatRows from bench.js"
    );
});

/* ── Grouping ───────────────────────────────────────────────────────────── */

ok("THE KEY IS WHAT THE THING IS, so one piece is one bench", () => {
    const out = benches([
        row({ id: "r1", created_date: "2026-10-01T09:00:00.000Z" }),
        row({ id: "r2", created_date: "2026-10-02T09:00:00.000Z", operation: "test" }),
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].steps.length, 2);
    assert.equal(out[0].key, WP.key);
});

ok("THE SAME PIECE PICKED TWICE KEYS THE SAME, whatever the whitespace", () => {
    const a = makeWorkpiece({ kind: "question", body: "  What is  a buffer? " });
    const b = makeWorkpiece({ kind: "question", body: "what is a buffer?" });
    assert.equal(a.key, b.key);
    // A different KIND is a different piece — it has different tools.
    assert.notEqual(a.key, makeWorkpiece({ kind: "topic", body: "What is a buffer?" }).key);
});

ok("A WORKPIECE SAVED BEFORE KEYS EXISTED STILL GROUPS", () => {
    // Rows written by the first bench release carry a workpiece with no key.
    const { key, ...keyless } = WP;
    assert.equal(key, WP.key);
    const out = benches([
        row({ id: "r1", workpiece: keyless }),
        row({ id: "r2", created_date: "2026-10-02T09:00:00.000Z" }),
    ]);
    assert.equal(out.length, 1, "a keyless workpiece must hash to the same bench");
    assert.equal(out[0].key, workpieceKey(WP));
});

ok("TWO DIFFERENT PIECES ARE TWO BENCHES", () => {
    const other = makeWorkpiece({ kind: "writing", body: "My paragraph about Macbeth." });
    const out = benches([row({ id: "r1" }), row({ id: "r2", workpiece: other })]);
    assert.equal(out.length, 2);
});

ok("STEPS ARE OLDEST FIRST, because the bench reads as the order of the work", () => {
    const out = benches([
        row({ id: "late", created_date: "2026-10-03T09:00:00.000Z", operation: "test" }),
        row({ id: "early", created_date: "2026-10-01T09:00:00.000Z" }),
    ]);
    assert.deepEqual(out[0].steps.map((s) => s.id), ["early", "late"]);
});

ok("BENCHES ARE NEWEST WORK FIRST, and capped", () => {
    const rows = [];
    for (let i = 0; i < BENCH_MAX + 3; i++) {
        rows.push(row({
            id: `r${i}`,
            workpiece: makeWorkpiece({ kind: "question", body: `question number ${i}` }),
            created_date: `2026-09-0${i + 1}T09:00:00.000Z`,
        }));
    }
    const out = benches(rows);
    assert.equal(out.length, BENCH_MAX);
    // Newest first: r8, r7, r6, r5…
    assert.equal(out[0].steps[0].id, `r${BENCH_MAX + 2}`);
    const times = out.map((b) => Date.parse(b.at));
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
});

/* ── Adopting a chat that predates the bench ────────────────────────────── */

ok("A CHAT WITH NO WORKPIECE IS A DRAFT, not dropped", () => {
    const out = benches([row({ id: "old", workpiece: null, operation: null })]);
    assert.equal(out.length, 1);
    assert.equal(out[0].workpiece, null);
    assert.ok(out[0].draft, "a chat from before the bench must still reach the shelf");
    assert.equal(out[0].draft.key, "old", "an adopted draft keys on its ROW");
    assert.equal(out[0].draft.source, "chat");
});

ok("THE DRAFT'S SOURCE IS A REAL SOURCE, so the header can name it", () => {
    assert.ok(SOURCES.chat, "workpiece.SOURCES needs a `chat` entry or the eyebrow prints nothing");
});

ok("THE FIRST THING THE STUDENT SAID IS THE BODY, never the reply", () => {
    const d = draftFromChat(row({
        id: "x", workpiece: null, operation: null,
        messages: [
            { role: "assistant", content: "Hi! What are we doing?" },
            { role: "user", content: "Mark this paragraph for me." },
            { role: "assistant", content: "..." },
        ],
    }));
    assert.equal(d.body, "Mark this paragraph for me.");
});

ok("A CHAT THE STUDENT NEVER SPOKE IN IS NOT OFFERED", () => {
    const d = draftFromChat(row({
        id: "x", workpiece: null, operation: null,
        messages: [{ role: "assistant", content: "Hello" }],
    }));
    assert.equal(d, null);
    // And it does not reach the shelf either, rather than arriving blank.
    assert.equal(benches([row({
        id: "x", workpiece: null, operation: null,
        messages: [{ role: "assistant", content: "Hello" }],
    })]).length, 0);
});

ok("A BLANK MESSAGE IS NOT A BODY", () => {
    assert.equal(draftFromChat(row({
        id: "x", workpiece: null, operation: null,
        messages: [{ role: "user", content: "   " }, { role: "assistant", content: "ok" }],
    })), null);
});

ok("NAMING THE KIND DOES NOT SPLIT THE BENCH", () => {
    // The whole point of keying an adopted draft on its ROW. Once the student
    // says what it is, the next step persists a real workpiece — and it has to
    // land on the same bench as the conversation it was adopted from.
    const legacy = row({ id: "old", workpiece: null, operation: null });
    const named = makeWorkpiece({
        kind: "writing",
        body: draftFromChat(legacy).body,
        source: "chat",
        key: draftFromChat(legacy).key,
    });
    const next = row({
        id: "new", workpiece: named, operation: "mark",
        created_date: "2026-10-05T09:00:00.000Z",
    });
    const out = benches([legacy, next]);
    assert.equal(out.length, 1, "the adopted chat and the step after it must be one bench");
    assert.equal(out[0].steps.length, 2);
    // And it is no longer a draft: the most recent stored workpiece wins, or a
    // bench adopted from a legacy row would ask for its kind forever.
    assert.ok(out[0].workpiece, "a bench whose later step carries a workpiece is no longer a draft");
    assert.equal(out[0].workpiece.kind, "writing");
});

/* ── Steps ──────────────────────────────────────────────────────────────── */

ok("A STEP CARRIES THE CONVERSATION IT IS, or it cannot be reopened", () => {
    const s = stepFromRow(row({ id: "r9" }), WP);
    assert.equal(s.convId, "r9");
    assert.ok(s.conv, "the row itself has to ride along — UnifiedChat hydrates from it");
    assert.ok(s.conv.input_data.messages.length);
});

ok("EVERY LIVE TOOL ROUND-TRIPS THROUGH A SAVED ROW", () => {
    for (const id of Object.keys(TOOL_LABELS)) {
        const s = stepFromRow(row({ id: "r", title: "", tool_type: id }), WP);
        assert.equal(s.tool, id);
        assert.equal(s.title, TOOL_LABELS[id], `step lost its name for ${id}`);
        assert.equal(s.preview, TOOL_LABELS[id]);
    }
});

ok("A RETIRED TOOL KEEPS ITS OWN NAME, never the first tool's", () => {
    // `toolById` falls back to CHAT_TOOLS[0], so a coaching chat saved before
    // the rebuild would otherwise reopen quietly labelled "Math Tutor" — a
    // wrong answer wearing the right label.
    assert.equal(labelForTool("study_coach"), "Study Coach");
    assert.notEqual(labelForTool("study_coach"), TOOL_LABELS.math_tutor);
    const s = stepFromRow(row({ id: "r", title: "", tool_type: "study_coach" }), WP);
    assert.equal(s.title, "Study Coach");
});

ok("AN UNKNOWN TOOL IS NOT NAMED AT ALL", () => {
    assert.equal(labelForTool("frobnicate"), "");
    const s = stepFromRow(row({ id: "r", tool_type: "frobnicate", title: "Something older" }), WP);
    assert.equal(s.title, "Something older");
});

ok("A STEP WITH NO TITLE FALLS BACK TO ITS TOOL, then to Earlier", () => {
    // The tool's own name is a better fallback than a placeholder and it is
    // free, so "Earlier" is only reached by a row with nothing at all on it.
    assert.equal(stepFromRow(row({ id: "r", title: "" }), null).title, "Concept Explainer");
    assert.equal(stepFromRow(row({ id: "r", title: "", tool_type: "" }), null).title, "Earlier");
});

/* ── Keys ───────────────────────────────────────────────────────────────── */

ok("benchKeyOf PREFERS THE STORED KEY over anything derived", () => {
    const pinned = { ...WP, key: "wp_pinned" };
    assert.equal(benchKeyOf(row({ workpiece: pinned })), "wp_pinned");
});

ok("benchKeyOf FALLS BACK TO THE ROW and never to null for a real row", () => {
    assert.equal(benchKeyOf(row({ id: "solo", workpiece: null })), "solo");
    assert.equal(benchKeyOf({}), null);
});

ok("THE KEY IS ON THE CLIPPED BODY, which is the body that gets stored", () => {
    // `makeWorkpiece` clips to BODY_MAX. Keying the full text would give a long
    // paste a different key from the one that comes back off its own step row.
    const long = "x".repeat(7000);
    const w = makeWorkpiece({ kind: "material", body: long });
    assert.equal(w.key, workpieceKey({ kind: "material", body: w.body }));
    const out = benches([row({ id: "r", workpiece: w })]);
    assert.equal(out[0].key, w.key);
});

/* ── Nothing is stored ──────────────────────────────────────────────────── */

ok("NOTHING HERE WRITES, and no bench table is invented", () => {
    const src = readFileSync(new URL("./bench.js", import.meta.url), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    for (const bad of [".create(", ".update(", ".delete(", "invokeLLM", "localStorage", "supabase"]) {
        assert.ok(!src.includes(bad), `bench.js must stay derived — found ${bad}`);
    }
});

ok("AN EMPTY ACCOUNT HAS NO SHELF, which is a real answer", () => {
    assert.deepEqual(benches([]), []);
    assert.deepEqual(benches(null), []);
    assert.deepEqual(benches(undefined), []);
});

ok("every bench on the shelf is openable", () => {
    const out = benches([
        row({ id: "a" }),
        row({ id: "b", workpiece: null, operation: null, created_date: "2026-10-02T09:00:00.000Z" }),
    ]);
    assert.equal(out.length, 2);
    for (const b of out) {
        assert.ok(b.key, "a bench with no key cannot be keyed in a list");
        assert.ok(b.title, "a bench with no title is a blank row");
        assert.ok(b.steps.length > 0, "a bench with no steps came from no rows");
        const piece = b.workpiece || b.draft;
        assert.ok(piece?.body, "a bench with no body opens empty");
        if (b.workpiece) assert.ok(isKind(b.workpiece.kind));
        else assert.equal(b.workpiece, null);
    }
});

/* ── The wiring, which is invisible when it breaks ──────────────────────── */

const strip = (f) => readFileSync(new URL(f, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

ok("THE STEP SAVES ITS WORKPIECE, or no bench can ever find it again", () => {
    // Everything above is arithmetic over rows that have to CARRY the
    // workpiece. If `persist` drops it the bench still works perfectly for one
    // session and the shelf is empty forever — no error, no warning, and the
    // student's work is stranded one reload later.
    const src = strip("../components/ai_tools/UnifiedChat.jsx");
    const body = src.slice(src.indexOf("const persist"), src.indexOf("const flushPersist"));
    assert.ok(body.length > 100, "could not find persist() — the scan below would pass vacuously");
    assert.ok(/input_data:\s*\{[\s\S]*?workpiece/.test(body),
        "persist() no longer writes the workpiece into input_data");
    assert.ok(/input_data:\s*\{[\s\S]*?operation/.test(body),
        "persist() no longer writes the operation into input_data");
    // THROUGH A REF, not the closure. `persist` is memoised on `user` alone, so
    // reading the prop directly saves whatever was mounted when it was built —
    // the trap `startFromSuggestion` and the pomodoro commit both record.
    assert.ok(/wpRef\.current/.test(body) && /opRef\.current/.test(body),
        "persist() reads the workpiece through the closure — use a ref");
});

ok("THE PAGE HANDS THE WORKPIECE DOWN, so a repair saves against its work", () => {
    const src = strip("../pages/AITools.jsx");
    for (const prop of ["workpiece={", "operation={"]) {
        assert.ok(src.includes(prop), `AITools no longer passes ${prop} to UnifiedChat`);
    }
});

ok("A SAVED RUN REOPENS AS THE WORK, never as stale findings", () => {
    // The scan is not stored, deliberately: findings are claims about a
    // VERSION, and a student who comes back has usually revised. Printing the
    // old readout over the new text would be the "ephemeral reference on a
    // permanent row" failure — a lie on a timer — so reopening sets the work
    // and an EMPTY finding list, and the student re-scans if they want one.
    const src = strip("../pages/AITools.jsx");
    const fn = src.slice(src.indexOf("const openRecent"), src.indexOf("if (premium === undefined)"));
    assert.ok(fn.length > 60, "could not find openRecent");
    assert.ok(/setFindings\(\[\]\)/.test(fn),
        "openRecent restores findings from a saved row — they describe a version that has moved");
});

ok("A DEEP-LINKED SUBJECT REACHES THE PROMPT, not just the options", () => {
    // Every tool's `system(s, o)` reads the subject off `s` — which is
    // `subjectName` — and `subjectBlock(s)` is what loads that study's VCAA
    // examiner profile. Set on `toolOptions` alone, the link landed on the
    // right tool with the subject nowhere the prompt could see it, so a bench
    // opened on a Chemistry question ran the general VCE preamble. It renders
    // identically either way; the only symptom is a worse answer.
    const src = strip("../components/ai_tools/UnifiedChat.jsx");
    const branch = src.slice(src.indexOf("if (startConversation"), src.indexOf("const seed ="));
    assert.ok(branch.length > 100, "could not find the deep-link branch");
    assert.ok(/setSubjectName\(subject\)/.test(branch),
        "the linked subject never reaches subjectName, so no examiner profile loads");
    // And a reopened conversation restores its own subject for the same reason.
    assert.ok(/setSubjectName\(c\.input_data\?\.subject/.test(branch),
        "a reopened step loses its subject");
});

console.log(`\nbench: ${n} checks passed`);
