/**
 * chatModel assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/chatModel.test.mjs
 *
 * ═══ THE CHAT STAYED THE PAGE; WHAT CHANGED IS HOW IT BEHAVES ═══════════════
 * Four earlier shapes of /AITools put something in front of the chat and the
 * chat outlasted all four, so this release left it as the page and rebuilt the
 * behaviour around it. Everything here is something that renders perfectly
 * while being wrong: a chat filed under the wrong day, a fresh chat opening on
 * a tool the student never asked for, a copy button that a phone cannot reach,
 * a send whose price is nowhere on screen.
 *
 * Every check below was verified by putting the bug back.
 */
process.env.TZ = "Australia/Melbourne";

import assert from "node:assert/strict";
import fs from "node:fs";
import {
    HISTORY_GROUPS, historyBucket, historyGroups, lastUsedTool, openingTool, FALLBACK_TOOL,
    FOLLOW_UPS, followUpsFor, slashQuery, filterTools, strandFor,
} from "@/lib/chatModel";
import { TOOL_LABELS, isLiveTool } from "@/lib/toolLabels";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};
const read = (rel) => fs.readFileSync(rel, "utf8");
/** Comments stripped: a sentence naming a defect is not the defect. */
const strip = (src) => src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/* A Melbourne evening: 7:30pm local on a Wednesday. */
const NOW = new Date(2026, 9, 14, 19, 30);
const at = (y, m, d, h = 12, min = 0) => new Date(y, m, d, h, min).toISOString();
const row = (id, tool, title, when, extra = {}) => ({
    id, tool_type: tool, title, updated_date: when, created_date: when,
    input_data: { tool, messages: [{ role: "user", content: title }, { role: "assistant", content: "ok" }] },
    ...extra,
});

/* ── History ─────────────────────────────────────────────────────────────── */

check("a chat at 9am Melbourne is TODAY, though it is yesterday in UTC", () => {
    // 9am on the 14th local is 10pm on the 13th UTC — `toISOString().slice`
    // would file it under yesterday. dayKey is local.
    const nine = new Date(2026, 9, 14, 9, 0).getTime();
    assert.equal(new Date(nine).toISOString().slice(0, 10), "2026-10-13", "fixture is not straddling UTC midnight");
    assert.equal(historyBucket(nine, NOW), "today");
});

check("the four buckets, at their edges", () => {
    assert.equal(historyBucket(new Date(2026, 9, 14, 0, 5).getTime(), NOW), "today");
    assert.equal(historyBucket(new Date(2026, 9, 13, 23, 55).getTime(), NOW), "yesterday");
    assert.equal(historyBucket(new Date(2026, 9, 8, 12).getTime(), NOW), "week");
    assert.equal(historyBucket(new Date(2026, 9, 7, 12).getTime(), NOW), "earlier");
    // A clock that disagrees with ours is not a chat from tomorrow.
    assert.equal(historyBucket(new Date(2026, 9, 15, 9).getTime(), NOW), "today");
});

check("an UNDATED chat is kept and goes last — never filed as 1970, never dropped", () => {
    // `Number(null)` is 0. Coerced, a local-storage row with no timestamp is
    // the oldest thing anybody ever said; dropped, it is a lost conversation.
    assert.equal(historyBucket(null, NOW), "earlier");
    assert.equal(historyBucket(undefined, NOW), "earlier");
    const groups = historyGroups([
        row("u", "math_tutor", "Undated chat", null, { updated_date: null, created_date: null }),
        row("e", "math_tutor", "Old chat", at(2026, 7, 1)),
    ], { now: NOW });
    const earlier = groups.find((g) => g.id === "earlier");
    assert.deepEqual(earlier.items.map((c) => c.id), ["e", "u"]);
});

check("newest first inside a bucket, on the LAST touch rather than the first", () => {
    const rows = [
        row("a", "math_tutor", "Started this morning", at(2026, 9, 14, 8)),
        row("b", "english_mentor", "Started last week, carried on tonight", at(2026, 9, 14, 19), { created_date: at(2026, 9, 6) }),
        row("c", "concept_explainer", "Lunchtime", at(2026, 9, 14, 13)),
    ];
    const today = historyGroups(rows, { now: NOW })[0];
    assert.equal(today.id, "today");
    assert.deepEqual(today.items.map((c) => c.id), ["b", "c", "a"]);
});

check("empty buckets are not drawn, and the order is the calendar's", () => {
    const groups = historyGroups([
        row("w", "math_tutor", "A week ago", at(2026, 9, 10)),
        row("t", "math_tutor", "Today", at(2026, 9, 14, 10)),
    ], { now: NOW });
    assert.deepEqual(groups.map((g) => g.id), ["today", "week"]);
    assert.deepEqual(HISTORY_GROUPS.map((g) => g.id), ["today", "yesterday", "week", "earlier"]);
    // "Last 7 days", not "This week" — two weeks on two screens has shipped
    // here once already.
    assert.ok(!HISTORY_GROUPS.some((g) => /this week/i.test(g.label)));
});

check("search matches what the ROW SHOWS: title, tool, subject — not the reply", () => {
    const rows = [
        row("a", "math_tutor", "Implicit differentiation", at(2026, 9, 14), { subject_name: "Mathematical Methods" }),
        row("b", "english_mentor", "My Crucible paragraph", at(2026, 9, 14), {
            input_data: { messages: [{ role: "user", content: "My Crucible paragraph" }, { role: "assistant", content: "differentiation is mentioned here" }] },
        }),
    ];
    const ids = (q) => historyGroups(rows, { now: NOW, query: q }).flatMap((g) => g.items.map((c) => c.id));
    assert.deepEqual(ids("differ"), ["a"], "a hit buried in a reply shows a title without the word");
    assert.deepEqual(ids("english"), ["b"]);
    assert.deepEqual(ids("methods"), ["a"]);
    assert.deepEqual(ids("nothing like this"), []);
});

check("a thread opened and never sent is not history", () => {
    const groups = historyGroups([{ id: "x", tool_type: "math_tutor", updated_date: at(2026, 9, 14), input_data: { messages: [] } }], { now: NOW });
    assert.deepEqual(groups, []);
});

/* ── Which tool a chat opens on ──────────────────────────────────────────── */

const recent = [
    row("old", "english_mentor", "older", at(2026, 9, 1)),
    row("new", "concept_explainer", "newer", at(2026, 9, 12)),
];

check("the order is: conversation, link, intent, last used, then Study Coach", () => {
    assert.deepEqual(openingTool({ conversation: "precision", link: "allocation", intent: "math_tutor", rows: recent }),
        { id: "precision", why: "conversation" });
    assert.deepEqual(openingTool({ link: "allocation", intent: "math_tutor", rows: recent }), { id: "allocation", why: "link" });
    assert.deepEqual(openingTool({ intent: "math_tutor", rows: recent }), { id: "math_tutor", why: "intent" });
    assert.deepEqual(openingTool({ rows: recent }), { id: "concept_explainer", why: "last" });
    assert.deepEqual(openingTool({}), { id: FALLBACK_TOOL, why: "fallback" });
    assert.equal(FALLBACK_TOOL, "study_coach");
});

check("A FRESH CHAT IS NOT MATH TUTOR BY ACCIDENT", () => {
    // It was `CHAT_TOOLS[0]` for everybody. Nothing about an account with no
    // history says maths.
    assert.notEqual(openingTool({}).id, "math_tutor");
});

check("a stale link or a retired tool falls through rather than winning", () => {
    assert.deepEqual(openingTool({ link: "ai_scan", rows: recent }), { id: "concept_explainer", why: "last" });
    assert.deepEqual(openingTool({ conversation: "", link: null, intent: "nope" }), { id: FALLBACK_TOOL, why: "fallback" });
    const retiredNewest = [...recent, row("r", "workpiece_bench", "retired", at(2026, 9, 13))];
    assert.equal(lastUsedTool(retiredNewest), "concept_explainer", "the newest LIVE tool, not the newest row");
});

check("the chat asks this model which tool to open, rather than taking CHAT_TOOLS[0]", () => {
    const chat = strip(read("src/components/ai_tools/UnifiedChat.jsx"));
    assert.match(chat, /openingTool\(\{/, "the opening tool is decided somewhere else");
    assert.ok(!/useState\(CHAT_TOOLS\[0\]\.id\)/.test(chat), "a fresh chat still starts on the first tool in the list");
});

/* ── Follow-ups ──────────────────────────────────────────────────────────── */

check("every live tool has one to three follow-ups, and nothing else has any", () => {
    for (const id of Object.keys(TOOL_LABELS)) {
        const list = followUpsFor(id);
        assert.ok(list.length >= 1 && list.length <= 3, `${id} has ${list.length} follow-ups`);
        assert.equal(new Set(list.map((f) => f.id)).size, list.length, `${id} repeats an id`);
    }
    for (const id of Object.keys(FOLLOW_UPS)) assert.ok(isLiveTool(id), `${id} is not a tool`);
    assert.deepEqual(followUpsFor("nope"), []);
    assert.deepEqual(followUpsFor(null), []);
});

check("a follow-up reads like the STUDENT, because tapping it sends it", () => {
    const banned = /\b(Don't|Fix it|No excuses|Embarrassing|Move)\b/;
    for (const [id, list] of Object.entries(FOLLOW_UPS)) {
        for (const f of list) {
            assert.ok(f.label.length >= 4 && f.label.length <= 28, `${id}/${f.id}: label "${f.label}" is not chip-sized`);
            assert.ok(f.text.length > f.label.length, `${id}/${f.id}: the message is shorter than its label`);
            assert.ok(!banned.test(`${f.label} ${f.text}`), `${id}/${f.id} uses a banned word`);
            // It is a message, not an instruction to the model about the student.
            assert.ok(!/\bthe student\b/i.test(f.text), `${id}/${f.id} talks about the student in the third person`);
        }
    }
});

/* ── Choosing a tool ─────────────────────────────────────────────────────── */

check("a slash opens the palette only at the very start, with one word after it", () => {
    assert.equal(slashQuery("/"), "");
    assert.equal(slashQuery("/math"), "math");
    assert.equal(slashQuery("/Teach"), "Teach");
    assert.equal(slashQuery("/math tutor"), null, "a space ends the command");
    assert.equal(slashQuery("1/2"), null);
    assert.equal(slashQuery("and/or"), null);
    assert.equal(slashQuery(" /math"), null);
    assert.equal(slashQuery("//"), null);
    assert.equal(slashQuery(""), null);
    assert.equal(slashQuery(null), null);
});

const TOOLS = Object.entries(TOOL_LABELS).map(([id, label]) => ({ id, label, blurb: "" }));
TOOLS.find((t) => t.id === "study_coach").blurb = "Stuck? Start here — planning a week too.";

check("the palette search: names first, prefix before substring, then the rest", () => {
    const ids = (q) => filterTools(TOOLS, q).map((t) => t.id);
    assert.deepEqual(ids("").length, TOOLS.length, "an empty search hides tools");
    assert.equal(ids("math")[0], "math_tutor");
    assert.equal(ids("teach")[0], "teaching_assistant");
    // A word-start inside the name counts as a prefix: "tutor" finds Math Tutor.
    assert.equal(ids("tutor")[0], "math_tutor");
    // "plan" is in a name (Essay Planner) and a blurb (Study Coach): name first.
    assert.deepEqual(ids("plan"), ["essay_planner", "study_coach"]);
    // The phase is searchable: "after" finds what you reach for after you write.
    assert.ok(ids("after").includes("english_mentor") && ids("after").includes("precision"));
    assert.deepEqual(ids("zzzz"), []);
});

check("ties keep catalogue order, so the list does not reshuffle per keystroke", () => {
    const a = filterTools(TOOLS, "e").map((t) => t.id);
    const b = filterTools(TOOLS, "e").map((t) => t.id);
    assert.deepEqual(a, b);
    const prefixed = filterTools(TOOLS, "e").filter((t) => t.label.toLowerCase().split(/\s+/).some((w) => w.startsWith("e")));
    const order = TOOLS.filter((t) => prefixed.includes(t)).map((t) => t.id);
    assert.deepEqual(prefixed.map((t) => t.id), order);
});

/* ── Subject and strand ──────────────────────────────────────────────────── */

check("a maths subject IS a strand, so the two can no longer disagree", () => {
    assert.equal(strandFor("Mathematical Methods"), "methods");
    assert.equal(strandFor("Specialist Mathematics"), "specialist");
    assert.equal(strandFor("General Mathematics"), "general");
    assert.equal(strandFor("Foundation Mathematics"), "foundation");
    assert.equal(strandFor("Chemistry"), null);
    assert.equal(strandFor(""), null);
    assert.equal(strandFor(null), null);
});

/* ── The screen: properties a render passes and a phone fails ───────────── */

const CHAT = strip(read("src/components/ai_tools/UnifiedChat.jsx"));
const HISTORY = strip(read("src/components/ai_tools/ChatHistory.jsx"));

check("A PHONE CAN REACH EVERY CONTROL ON A MESSAGE", () => {
    // Copy, Edit and Try again were `opacity-0` until hovered, which on a touch
    // screen is never. Every hover-reveal in the chat and the rail must be
    // scoped to a device that HAS hover; a bare `group-hover` cannot tell a
    // phone from a laptop.
    for (const [name, src] of [["UnifiedChat", CHAT], ["ChatHistory", HISTORY]]) {
        const bare = src.match(/(^|[\s"`])(group-hover:opacity-100|opacity-0)(?=[\s"`])/g) || [];
        assert.deepEqual(bare, [], `${name} hides a control behind hover with no hover check`);
        const strings = src.match(/[`"][^`"]*group-hover:opacity-100[^`"]*[`"]/g) || [];
        for (const str of strings) {
            assert.match(str, /\[@media\(hover:hover\)\]:group-hover:opacity-100/, `${name}: ${str.slice(0, 80)}`);
        }
    }
    // The shared reveal is defined once and is the one used on messages.
    assert.match(CHAT, /const HOVER_REVEAL = "\[@media\(hover:hover\)\]:opacity-0 /);
    assert.ok((CHAT.match(/\$\{HOVER_REVEAL\}|: HOVER_REVEAL\}/g) || []).length >= 2,
        "the message rows no longer use the shared reveal");
});

check("THE LATEST REPLY'S CONTROLS ARE ALWAYS SHOWN", () => {
    assert.match(CHAT, /i === lastIndex \? "" : HOVER_REVEAL/,
        "the last reply's Copy and Try again hide until hover again");
});

check("THE PRICE IS ON SCREEN BEFORE IT IS SPENT", () => {
    // "Each send spends from this week's chips" named no number, and the
    // tools cost different amounts. The figure is the one the server charges.
    assert.match(CHAT, /const price = priceOf\(tool\.feature, tier\)/);
    assert.match(CHAT, /\{price\} chips\s*\n?\s*<\/span>/, "the composer no longer prints the price by send");
    assert.match(CHAT, /\{price\} chips a message/, "a phone is no longer told the price");
    assert.match(CHAT, /Next · \{price\} chips/, "a follow-up spends without its price beside it");
    // And the count left moves with what this session spent.
    assert.match(CHAT, /stack\.remaining - spentHere/);
    assert.match(CHAT, /setSpentHere\(\(n\) => n \+ usedPrice\)/);
});

check("a follow-up is the SAME send as typing, not a second copy of it", () => {
    assert.match(CHAT, /onClick=\{\(\) => send\(\{ text: f\.text \}\)\}/);
    assert.match(CHAT, /const followUps = followUpsFor\(tool\.id\)/);
    // Never offered under a failure: "a harder one" than an error is nonsense.
    assert.match(CHAT, /!m\.failed/);
});

check("ONE TOOL PICKER, reachable by the chip and by `/`", () => {
    assert.ok(!/@\/components\/ui\/select/.test(CHAT), "the old dropdown is back beside the palette");
    assert.match(CHAT, /<ToolPalette/);
    assert.match(CHAT, /slashQuery\(value\) != null/, "typing / no longer opens the palette");
    assert.match(CHAT, /paletteRef\.current\?\.handleKey\(e\)/, "the composer does not hand its arrow keys to the palette");
    // Mid-chat a new tool starts a new chat, and the palette says so first.
    assert.match(CHAT, /Picking a tool starts a new chat/);
});

check("THE SUBJECT DECIDES THE STRAND, so the two cannot disagree", () => {
    assert.match(CHAT, /const strand = strandFor\(subject\)/);
    const setup = strip(read("src/components/ai_tools/ComposerSetup.jsx"));
    assert.match(setup, /g\.key === "strand" && strandFor\(subject\)/, "the strand row is drawn beside a maths subject");
});

check("HISTORY IS BY DATE, and a delete asks once", () => {
    // The groups the rail DRAWS. A bare `historyGroups(rows,` passed with the
    // drawn list replaced, because the "is there any history" check calls it
    // too — a scan that matches somewhere is not a scan.
    assert.match(HISTORY, /const groups = useMemo\(\(\) => historyGroups\(rows, \{[^}]*\bquery\b[^}]*\}\)/);
    assert.match(HISTORY, /\{groups\.map\(\(g\) =>/);
    assert.ok(!/openFolders/.test(CHAT + HISTORY), "the tool folders are back");
    // The first press arms, the second deletes.
    assert.match(HISTORY, /if \(armed\) \{ setConfirming\(null\); onDelete\?\.\(item\.row\); \}/);
    assert.match(HISTORY, /else setConfirming\(item\.id\)/);
});

check("the thread follows a reply as it grows, and offers a way back down", () => {
    // KaTeX and the follow-up row land AFTER the last message change.
    assert.match(CHAT, /new ResizeObserver\(/);
    assert.match(CHAT, /if \(stickRef\.current\) el\.scrollTop = el\.scrollHeight/);
    assert.match(CHAT, /!atBottom &&/, "there is no way back to the latest reply");
    // It no longer drags a student who scrolled up back down on every token.
    assert.ok(!/scrollIntoView\(\{ behavior: "smooth", block: "end" \}\)/.test(CHAT));
});

check("A DROPPED FILE NEVER REPLACES THE APP", () => {
    // A drop the page does not prevent is opened by the browser in place of
    // the chat. It is taken even for a tool that reads no files.
    assert.match(CHAT, /const onDrop = \(e\) => \{\s*if \(!hasFiles\(e\) \|\| locked\) return;\s*e\.preventDefault\(\);/);
    assert.match(CHAT, /onDragOver=\{onDragOver\}/);
    // Photos are resized like every other upload surface.
    assert.match(CHAT, /await acceptFiles\(\[file\], \{ toast \}\)/);
});

check("the free account's panel points at what it means", () => {
    // It said "what is above" — written when the suggestions sat over the
    // composer. They are below it.
    assert.ok(!/is above/i.test(CHAT), "the upgrade panel points the wrong way again");
});

console.log(`\n${passed} passed`);
