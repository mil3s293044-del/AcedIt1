/**
 * toolBrief — the brief that replaced a blank chat box.
 *
 * The things asserted here are the ones that RENDER PERFECTLY and are simply
 * wrong about the student they describe: a percentage multiplied twice, a zero
 * read as evidence, a model call smuggled into a module whose whole argument is
 * that it makes none.
 */
import assert from "node:assert/strict";
import {
    personaFor, assessmentCard, repeatCard, weakTopicCard, slippingCard,
    toolBrief, BRIEF_MAX,
} from "./toolBrief.js";
import {
    TOOL_LABELS, RETIRED_TOOLS, PHASES, TOOL_PHASE,
    labelForTool, isLiveTool, phaseOf, toolsByPhase,
} from "./toolLabels.js";
import { chatRows, recentChats, RECENT_MAX } from "./aiChats.js";
import { PRICE, ALREADY_CHEAP } from "./chips.js";
import { readFileSync } from "node:fs";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log("  ok ", name); };

const NOW = new Date("2026-10-04T09:00:00+10:00");
const inDays = (d) => {
    const t = new Date(NOW); t.setDate(t.getDate() + d);
    return t.toISOString().slice(0, 10);
};

/* ── Routing ─────────────────────────────────────────────────────────────── */

ok("a subject routes to the persona that marks its work", () => {
    assert.equal(personaFor("Mathematical Methods"), "math_tutor");
    assert.equal(personaFor("Specialist Mathematics"), "math_tutor");
    assert.equal(personaFor("English"), "english_mentor");
    assert.equal(personaFor("Literature"), "english_mentor");
    assert.equal(personaFor("English (EAL)"), "english_mentor");
    // Anything unrecognised gets the general examiner rather than a guess.
    assert.equal(personaFor("Chemistry"), "exam_questions");
    assert.equal(personaFor(""), "exam_questions");
    assert.equal(personaFor(null), "exam_questions");
});

/* ── Assessments ─────────────────────────────────────────────────────────── */

ok("the NEAREST assessment wins, and a far one is not offered at all", () => {
    const rows = [
        { id: "a", subject_name: "Chemistry", title: "Unit 4 SAC", due_date: inDays(9) },
        { id: "b", subject_name: "Biology", title: "Prac report", due_date: inDays(2) },
        { id: "c", subject_name: "Legal", title: "Essay", due_date: inDays(90) },
    ];
    const card = assessmentCard(rows, NOW);
    assert.equal(card.subject, "Biology");
    assert.match(card.fact, /in 2 days/);
});

ok("a completed or past assessment is never offered", () => {
    assert.equal(assessmentCard(
        [{ id: "a", subject_name: "Chemistry", due_date: inDays(3), is_completed: true }], NOW), null);
    assert.equal(assessmentCard(
        [{ id: "b", subject_name: "Chemistry", due_date: inDays(-3) }], NOW), null);
    // A row with no subject cannot be routed to a persona, so it is skipped
    // rather than sent to a general one about nothing.
    assert.equal(assessmentCard([{ id: "c", due_date: inDays(1) }], NOW), null);
});

ok("today and tomorrow are words, not \"in 0 days\"", () => {
    const a = assessmentCard([{ id: "x", subject_name: "Chemistry", due_date: inDays(0) }], NOW);
    assert.match(a.fact, /today/);
    const b = assessmentCard([{ id: "y", subject_name: "Chemistry", due_date: inDays(1) }], NOW);
    assert.match(b.fact, /tomorrow/);
});

/* ── The weak-topic card, and the percentage that is already a percentage ── */

// THE REAL COLUMNS, read off supabase/schema.json rather than invented. The
// first draft of this fixture wrote `times_reviewed` / `times_correct`, which
// are not flashcard columns at all, so weakTopicsFrom counted zero reviews and
// every assertion here passed or failed for the wrong reason — the same shape
// the queue probe hit writing `correct:` where the table carries `is_correct`.
const weakCard = (over) => ({
    id: "c1", subject_name: "Chemistry", topic: "Redox", is_active: true,
    total_reviews: 10, review_count_good: 3, review_count_easy: 0,
    is_weak_spot: true, ...over,
});

ok("A MISS RATE IS ALREADY A PERCENTAGE and is never multiplied again", () => {
    const card = weakTopicCard([weakCard()]);
    assert.ok(card, "a topic with real misses makes a card");
    const pct = Number(/(\d+)%/.exec(card.fact)[1]);
    assert.ok(pct > 0 && pct <= 100, `miss rate printed as ${pct}%, which is not a percentage`);
});

ok("A 0% MISS RATE IS NOT EVIDENCE OF COSTING MARKS", () => {
    // weakTopicsFrom keeps a topic on `weakCards > 0` ALONE, so a deck whose
    // every review LANDED still arrives with a real missRate of 0 — and
    // `missRate != null` is true of 0. Printing "0% of your reviews missed"
    // under an offer to fix it is the app telling a student their clean record
    // is the problem.
    const clean = weakCard({ total_reviews: 10, review_count_good: 10 });
    assert.equal(weakTopicCard([clean]), null);
});

ok("a topic with NO reviews behind it is not scored at all", () => {
    // missRate is null there, and Number(null) is 0 — the trap that would make
    // an unopened topic read as a perfect record rather than as no record.
    const fresh = weakCard({ total_reviews: 0, review_count_good: 0 });
    assert.equal(weakTopicCard([fresh]), null);
});

ok("a maths topic goes to the tutor and everything else to the explainer", () => {
    const m = weakTopicCard([weakCard({ subject_name: "Mathematical Methods" })]);
    assert.equal(m.tool, "math_tutor");
    const c = weakTopicCard([weakCard({ subject_name: "Chemistry" })]);
    assert.equal(c.tool, "concept_explainer");
});

/* ── Repeats ─────────────────────────────────────────────────────────────── */

const bankCard = (criterion, subject, i) => ({
    id: `m${i}`, topic: "Mistake bank", subject_name: subject, is_active: true,
    question: "q", answer: "a",
    extra: { mistake: { criterion, topic: "Bonding", question: "Q", cost: 1 } },
});

ok("ONE drop is an instance; a card is only made for a repeat", () => {
    const once = [bankCard("links structure to property", "Chemistry", 1)];
    assert.equal(repeatCard(once), null);
    const twice = [
        bankCard("links structure to property", "Chemistry", 1),
        bankCard("links structure to property", "Chemistry", 2),
    ];
    const card = repeatCard(twice);
    assert.ok(card, "two drops of one criterion is a pattern worth naming");
    assert.match(card.fact, /2 times/);
    assert.equal(card.subject, "Chemistry");
});

ok("a criterion dropped across TWO subjects names neither", () => {
    // `subjects` is a set of every subject it was dropped in. Naming one of
    // several would be picking arbitrarily, and the fact is about the writing
    // rather than about a subject.
    const card = repeatCard([
        bankCard("does not name the transfer", "Chemistry", 1),
        bankCard("does not name the transfer", "Biology", 2),
    ]);
    assert.ok(card);
    assert.equal(card.subject, null);
    assert.ok(!/Chemistry|Biology/.test(card.fact), "it must not claim one of the two");
});

/* ── Slipping ────────────────────────────────────────────────────────────── */

ok("slipping cards go to TEACH IT BACK, never to an explainer", () => {
    // The student has already met this material and RECALL is what failed, so
    // being told it again is recognition — the illusion drill.js refuses.
    const old = {
        id: "s1", subject_name: "Biology", topic: "Cells", is_active: true,
        total_reviews: 4, review_count_good: 4, interval_days: 2,
        last_reviewed_date: "2026-01-01", next_review_date: "2026-01-03",
    };
    const card = slippingCard([old], NOW.getTime());
    if (card) {
        assert.equal(card.tool, "teaching_assistant");
        assert.equal(card.subject, "Biology");
    }
});

/* ── The brief ───────────────────────────────────────────────────────────── */

ok("AN EMPTY ACCOUNT GETS NO CARDS AND NO LEAD", () => {
    assert.deepEqual(toolBrief({}), []);
});

ok("NO BUILDER PADS THE BRIEF with a row whose number is not real", () => {
    // Every card printed must carry a figure above zero somewhere in its fact,
    // or a date. A brief that reaches a respectable length on zeroes teaches a
    // student the numbers here are decoration.
    const b = toolBrief({
        assessments: [{ id: "a", subject_name: "Chemistry", title: "SAC", due_date: inDays(3) }],
        bankCards: [
            bankCard("links structure to property", "Chemistry", 1),
            bankCard("links structure to property", "Chemistry", 2),
        ],
        cards: [weakCard()],
        now: NOW,
    });
    assert.ok(b.length >= 2, "a loaded account gets several cards");
    for (const c of b) {
        assert.ok(!/\b0\b\s*(%|times|cards)/.test(c.fact), `zero row: ${c.fact}`);
        assert.ok(c.seed && c.seed.length > 20, "every card carries a real opening message");
        assert.ok(c.tool, "every card names a tool");
    }
});

ok("the brief is capped and sorted by what it costs to skip", () => {
    const b = toolBrief({
        assessments: [{ id: "a", subject_name: "Chemistry", title: "SAC", due_date: inDays(1) }],
        bankCards: [
            bankCard("links structure to property", "Chemistry", 1),
            bankCard("links structure to property", "Chemistry", 2),
        ],
        cards: [weakCard()],
        now: NOW,
    });
    assert.ok(b.length <= BRIEF_MAX, "never more than the cap");
    // A DATE LEADS. It is the only thing here that cannot be moved.
    assert.equal(b[0].kind, "assessment");
    for (let i = 1; i < b.length; i++) {
        assert.ok(b[i - 1].urgency >= b[i].urgency, "sorted by urgency");
    }
});

ok("THERE IS NO SEPARATE LEAD, because it printed the first card twice", () => {
    // `briefLead` returned cards[0].fact, which the first card then printed
    // again in bold directly below it. One sentence, twice, on a screen whose
    // whole claim is that every line on it is worth reading. The heading frames
    // instead, and the cards lead themselves — so nothing may export a lead.
    const src = readFileSync(new URL("./toolBrief.js", import.meta.url), "utf8");
    assert.ok(!/export function briefLead/.test(src), "a lead would duplicate card one");
});

/* ── The property the whole module rests on ──────────────────────────────── */

ok("NOTHING HERE CALLS A MODEL, asserted as an absence", () => {
    // The diagnosis is arithmetic so a student can check it; the agent is what
    // they hand it to. An agent that reads the data and writes the diagnosis is
    // what was deleted from Insights, and it would arrive here by somebody
    // importing streamingAI or invoking a function from this module.
    const src = readFileSync(new URL("./toolBrief.js", import.meta.url), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    for (const bad of ["streamingAI", "invoke(", "InvokeLLM", "fetch(", "anthropic"]) {
        assert.ok(!src.includes(bad), `toolBrief must not reach for ${bad}`);
    }
});

ok("NOTHING IS STORED, so a card cannot go stale", () => {
    const src = readFileSync(new URL("./toolBrief.js", import.meta.url), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    for (const bad of [".create(", ".update(", "localStorage", "sessionStorage"]) {
        assert.ok(!src.includes(bad), `toolBrief must not write ${bad}`);
    }
});

/* ── The toolkit: twelve tools, four phases ──────────────────────────────── */

ok("every live tool has exactly one phase, and every phase has tools", () => {
    for (const id of Object.keys(TOOL_LABELS)) {
        const p = phaseOf(id);
        assert.ok(p, `${id} has no phase, so it would not be drawn at all`);
        assert.ok(PHASES.some((x) => x.id === p), `${id} names a phase that does not exist`);
    }
    // A HEADING OVER NOTHING IS A BROKEN FILTER. Four labelled bands with one
    // of them empty reads as a bug, so the grouping must cover every phase.
    const all = Object.keys(TOOL_LABELS).map((id) => ({ id }));
    assert.equal(toolsByPhase(all).length, PHASES.length);
});

ok("TOOL_PHASE names no tool the catalogue does not have", () => {
    for (const id of Object.keys(TOOL_PHASE)) {
        assert.ok(
            Object.prototype.hasOwnProperty.call(TOOL_LABELS, id),
            `${id} has a phase and is not a live tool, so the band would draw a ghost`
        );
    }
});

ok("an EMPTY phase is dropped, and the order is PHASES' order", () => {
    const onlyWork = Object.keys(TOOL_PHASE)
        .filter((id) => TOOL_PHASE[id] === "work").map((id) => ({ id }));
    const g = toolsByPhase(onlyWork);
    assert.equal(g.length, 1, "three empty bands must not be drawn");
    assert.equal(g[0].id, "work");

    // Ordered by the session, never by however the catalogue happens to be
    // written: "after you write" above "before you start" is a map that argues
    // with itself.
    const shuffled = [{ id: "exam_questions" }, { id: "math_tutor" }, { id: "concept_explainer" }];
    assert.deepEqual(toolsByPhase(shuffled).map((x) => x.id), ["start", "work", "test"]);
});

ok("the CATALOGUE and the label map name the same twelve tools", () => {
    // One copy of the names (`toolLabels.js`), read back by `chatTools.js`. A
    // label with no tool draws nothing; a tool with no label reads as the first
    // tool in the list, because `toolById` falls back rather than returning
    // null. Both render perfectly.
    const src = readFileSync(new URL("../components/ai_tools/chatTools.js", import.meta.url), "utf8");
    const ids = [...src.matchAll(/^\s*id: "([a-z_]+)",$/gm)].map((m) => m[1]);
    assert.deepEqual([...ids].sort(), Object.keys(TOOL_LABELS).sort());
    // Every one reads its name from the map rather than restating it.
    for (const id of ids) {
        assert.ok(src.includes(`label: TOOL_LABELS.${id}`), `${id} restates its own label`);
    }
});

ok("study_coach is back in the catalogue, at the price it always had", () => {
    // It left when the page was rebuilt around faults on one piece of work.
    // The page is a dashboard again and "I do not know what to do" is what the
    // first screen is for. The FEATURE was never touched — that is Ace the
    // companion — so its chip price must still be the cheap one.
    assert.ok(Object.prototype.hasOwnProperty.call(TOOL_LABELS, "study_coach"));
    assert.equal(PRICE.study_coach, 2);
    assert.ok(ALREADY_CHEAP.has("study_coach"));
});

/* ── A retired tool keeps its name ───────────────────────────────────────── */

ok("RETIRED_TOOLS ships EMPTY, and the mechanism still works", () => {
    assert.deepEqual(Object.keys(RETIRED_TOOLS), []);
    // Exercised against a fixture so the path cannot rot unused — the posture
    // `DISTRIBUTIONS` takes in examinerReports.js. Without it a conversation
    // saved against a tool that later leaves the catalogue reopens quietly
    // labelled "Math Tutor": a wrong answer wearing the right label.
    RETIRED_TOOLS.__fixture = "Old Tool";
    try {
        assert.equal(labelForTool("__fixture"), "Old Tool");
        assert.equal(isLiveTool("__fixture"), false);
        assert.equal(phaseOf("__fixture"), "", "a retired tool is not in the toolkit");
    } finally {
        delete RETIRED_TOOLS.__fixture;
    }
    assert.equal(labelForTool("math_tutor"), "Math Tutor");
    assert.equal(labelForTool("nope"), "");
    assert.equal(labelForTool(null), "");
});

/* ── Recent conversations ────────────────────────────────────────────────── */

const chat = (over = {}) => ({
    id: over.id || "c1",
    tool_type: over.tool_type ?? "math_tutor",
    title: over.title,
    subject_name: over.subject_name ?? null,
    created_date: over.created_date,
    updated_date: over.updated_date,
    input_data: { messages: over.messages ?? [{ role: "user", content: "a real ask" }] },
});

ok("a row is a CHAT only if somebody said something in it", () => {
    const rows = [
        chat({ id: "a" }),
        chat({ id: "b", messages: [] }),
        { id: "c", input_data: {} },
        { id: "d" },
        null,
        // A legacy single-shot tool result: content, no transcript.
        { id: "e", tool_type: "note_summariser", content: "a cheat sheet" },
    ];
    assert.deepEqual(chatRows(rows).map((r) => r.id), ["a"]);
});

ok("newest first, and an UNDATED row sorts last rather than being dropped", () => {
    // `Number(null)` is 0, which is 1970 — coerced, an undated local-storage
    // row sorts to the bottom silently; dropped, a real conversation is lost
    // over a missing field. It is kept, and ordered after everything dated.
    const out = recentChats([
        chat({ id: "old", created_date: "2026-09-01T00:00:00.000Z" }),
        chat({ id: "undated" }),
        chat({ id: "new", created_date: "2026-10-03T00:00:00.000Z" }),
    ]);
    assert.deepEqual(out.map((r) => r.id), ["new", "old", "undated"]);
});

ok("an updated row is ordered on when it was UPDATED", () => {
    // A conversation carried on today belongs at the top even though it was
    // started last month — which is the whole promise of the list.
    const out = recentChats([
        chat({ id: "fresh", created_date: "2026-10-03T00:00:00.000Z" }),
        chat({ id: "revived", created_date: "2026-09-01T00:00:00.000Z", updated_date: "2026-10-04T08:00:00.000Z" }),
    ]);
    assert.deepEqual(out.map((r) => r.id), ["revived", "fresh"]);
});

ok("a conversation with no STUDENT message is not offered", () => {
    // Nothing to recognise and nothing to carry on: the preview is their own
    // words, so a thread that only holds a reply has nothing to show.
    assert.deepEqual(recentChats([chat({ messages: [{ role: "assistant", content: "hi" }] })]), []);
    assert.deepEqual(recentChats([chat({ messages: [{ role: "user", content: "   " }] })]), []);
});

ok("the title falls back to the ask, CUT ON A WORD", () => {
    // A hard slice produced "...can you walk me t", which reads as a rendering
    // fault rather than as an abbreviation. Only the screenshot said so.
    const long = "I keep losing the chain rule on the inside function, can you walk me through one";
    const [row] = recentChats([chat({ title: "", messages: [{ role: "user", content: long }] })]);
    assert.ok(row.title.length <= 70);
    assert.ok(row.title.endsWith("\u2026"), "a cut sentence has to say it was cut");
    const body = row.title.slice(0, -1);
    assert.ok(long.startsWith(body));
    assert.ok(!/\S$/.test(long[body.length] || " "), `cut mid-word: ${row.title}`);
    // A title that FITS is left exactly alone — no ellipsis on a short one.
    const [short] = recentChats([chat({ id: "s", title: "Chain rule" })]);
    assert.equal(short.title, "Chain rule");
    // One unbroken word longer than the limit still gets cut rather than
    // returned whole, or a pasted URL would run the width of the card.
    const [wordy] = recentChats([chat({ id: "w", title: "x".repeat(200) })]);
    assert.ok(wordy.title.length <= 70 && wordy.title.endsWith("\u2026"));
    assert.equal(row.toolLabel, "Math Tutor");

    RETIRED_TOOLS.__fixture = "Old Tool";
    try {
        const [r2] = recentChats([chat({ tool_type: "__fixture" })]);
        assert.equal(r2.toolLabel, "Old Tool", "a retired tool must not read as Math Tutor");
    } finally {
        delete RETIRED_TOOLS.__fixture;
    }
});

ok("the list is CAPPED", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
        chat({ id: `c${i}`, created_date: `2026-10-0${(i % 9) + 1}T00:00:00.000Z` }));
    assert.equal(recentChats(rows).length, RECENT_MAX);
    assert.equal(recentChats(rows, 2).length, 2);
    assert.equal(recentChats([]).length, 0);
    assert.equal(recentChats(null).length, 0);
});

/* ── Every card opens something that exists ──────────────────────────────── */

ok("every brief card names a LIVE tool", () => {
    // A card pointing at an id the catalogue does not have lands on the first
    // tool in the list — the right page with the wrong thing open, which is the
    // half-wired shape this app keeps meeting.
    const cards = toolBrief({
        assessments: [{ id: "a", subject_name: "Chemistry", title: "SAC", due_date: inDays(2) }],
        bankCards: [
            bankCard("links structure to property", "Chemistry", 1),
            bankCard("links structure to property", "Chemistry", 2),
        ],
        cards: [weakCard()],
        now: NOW,
    });
    assert.ok(cards.length > 0);
    for (const c of cards) assert.ok(isLiveTool(c.tool), `${c.tool} is not in the catalogue`);
    // And the routing's own answers, which are what the assessment card uses.
    for (const s of ["Mathematical Methods", "English", "Chemistry", ""]) {
        assert.ok(isLiveTool(personaFor(s)));
    }
});

/* ── The revert: nothing reaches a module that is gone ───────────────────── */

const SRC_FILES = [
    "../pages/AITools.jsx",
    "../components/ai_tools/ToolsDashboard.jsx",
    "../components/ai_tools/ToolBrief.jsx",
    "../components/ai_tools/UnifiedChat.jsx",
];
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
/* COMMENTS ARE STRIPPED FIRST. A comment naming the thing it refuses is not the
   thing — the false positive `fnResult.test.mjs` and `hookDeps.test.mjs` each
   had to learn, and the cost of not learning it is worse than a red suite: the
   obvious way to make it green is to delete the sentence that says why. */
const stripped = (rel) => read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

ok("the deleted modules are gone and nothing imports them", () => {
    for (const rel of SRC_FILES) {
        const src = stripped(rel);
        for (const bad of [
            "@/lib/bench", "@/lib/workpiece", "@/lib/workpieceSources",
            "@/lib/diagnostic", "@/lib/diagnosticPrompt",
            "ai_tools/Readout", "ai_tools/ScanIntake",
        ]) {
            assert.ok(!src.includes(bad), `${rel} still imports ${bad}`);
        }
    }
    for (const gone of [
        "./bench.js", "./workpiece.js", "./workpieceSources.js", "./diagnostic.js",
    ]) {
        assert.throws(() => readFileSync(new URL(gone, import.meta.url)), `${gone} is still on disk`);
    }
});

ok("ONE chat-row predicate, and the sidebar reads it", () => {
    // Two copies would let the sidebar and the dashboard's Recent list
    // disagree about what the student has, on two lists of one table.
    const src = stripped("../components/ai_tools/UnifiedChat.jsx");
    assert.ok(/import \{ chatRows \} from "@\/lib\/aiChats"/.test(src));
    assert.ok(src.includes("chatRows(convs)"));
    assert.ok(
        !/input_data\?\.messages\)\s*&&/.test(src),
        "UnifiedChat is restating the predicate instead of importing it"
    );
});

ok("a `?tool=` DEEP LINK still opens the chat, not the dashboard", () => {
    // Every `toolQuery` link in the app builds one — MistakeBank's repeat rows,
    // SubjectHub's course gap. Landing them on a dashboard is the half-wired
    // shape this app keeps meeting: the right page, and the thing it promised
    // to open does not open.
    const src = stripped("../pages/AITools.jsx");
    assert.ok(/URLSearchParams\(window\.location\.search\)\.get\("tool"\)/.test(src));
    assert.ok(src.includes("<UnifiedChat"), "the chat is still rendered");
    assert.ok(src.includes("<ToolsDashboard"), "the dashboard is still rendered");
    // EACH PROP IS CHECKED FOR A VALUE, not for its own name. The first draft
    // asserted the string was present, and `startConversation={null}` contains
    // it — so dropping the wiring and keeping the attribute passed. Verified by
    // putting exactly that back.
    for (const prop of ["startTool", "startSubject", "startSeed", "startConversation", "onExit"]) {
        const m = new RegExp(`${prop}=\\{\\s*(null|undefined|""|'')\\s*\\}`);
        assert.ok(src.includes(`${prop}=`), `the chat is opened without ${prop}`);
        assert.ok(!m.test(src), `${prop} is wired to a literal nothing`);
    }
    // And a Recent row carries the row itself, or reopening it starts a second
    // thread about the same thing instead of continuing the first.
    assert.ok(/conv: item\.row/.test(src), "a reopened conversation must carry its row");
});

ok("the dashboard draws all three blocks", () => {
    const src = stripped("../components/ai_tools/ToolsDashboard.jsx");
    assert.ok(src.includes("<ToolBrief"), "the direction cards lead");
    assert.ok(src.includes("toolsByPhase(CHAT_TOOLS)"), "the toolkit is the real catalogue, grouped");
    assert.ok(/recent\.length > 0/.test(src), "an empty Recent band must not be drawn");
    assert.ok(src.includes("<RecentRow"), "the conversations are drawn");
    const page = stripped("../pages/AITools.jsx");
    assert.ok(/import \{ recentChats \} from "@\/lib\/aiChats"/.test(page));
    assert.ok(/import \{ toolBrief \} from "@\/lib\/toolBrief"/.test(page));
});

ok("ARRIVING COSTS NOTHING, asserted as an absence", () => {
    // The dashboard is arithmetic over rows the page already loaded plus a read
    // of conversations that already save. A model call here would be a charge
    // for walking onto the screen, and the seed is put in the composer rather
    // than sent for the same reason.
    for (const rel of ["../pages/AITools.jsx", "../components/ai_tools/ToolsDashboard.jsx",
        "../components/ai_tools/ToolBrief.jsx"]) {
        const src = stripped(rel);
        for (const bad of ["InvokeLLM", "invokeLLMStream", "streamingAI"]) {
            assert.ok(!src.includes(bad), `${rel} must not call a model`);
        }
    }
    // And no price survives for a scan nobody can run.
    assert.ok(!Object.prototype.hasOwnProperty.call(PRICE, "ai_scan"));
    assert.ok(!ALREADY_CHEAP.has("ai_scan"));
    const server = readFileSync(new URL("../../server.mjs", import.meta.url), "utf8");
    assert.ok(!server.includes("SCAN_MODEL"), "the server still pins a model for a deleted feature");
    assert.ok(!server.includes("lib/diagnostic.js"), "the server still imports a deleted module");
});

ok("the SAVED ROW IS MERGED, never refetched on every turn", () => {
    // `UnifiedChat` persists after every completed reply, so re-reading the
    // tables on each one would be five round trips per message to update a list
    // the student cannot currently see.
    const src = stripped("../pages/AITools.jsx");
    assert.ok(!src.includes("savedAt"), "a save counter is a refetch on every turn");
    assert.ok(/onSaved=\{noteSaved\}/.test(src));
    assert.ok(/const noteSaved = useCallback\(\(row\) =>/.test(src));
    assert.ok(src.includes("setConvs("), "the handler must merge into the list it owns");
});

ok("the empty state does not point at a composer that is not there", () => {
    // "Pick a tool below, or just start typing" was written when the brief sat
    // directly above a chat box. On a dashboard there is nothing to type into,
    // so the sentence pointed at a control that does not exist — the class of
    // failure that cannot be wrong at runtime and only a scan catches.
    const src = stripped("../components/ai_tools/ToolBrief.jsx");
    assert.ok(!/start typing/i.test(src), "the empty state still offers a composer");
    assert.ok(!/<textarea|<input/i.test(src), "the dashboard has no composer to offer");
});

ok("the BENCH and SCAN vocabulary is gone from what a student reads", () => {
    // Copy cannot be wrong at runtime, so nothing but a scan catches it. The
    // two forms need DIFFERENT newline rules: a quoted literal must stay on one
    // line, or one match runs from one quote to the next across the whole file
    // and reports an import three screens away as the defect; a JSX text node
    // is bounded by its own angle brackets and is routinely wrapped over three
    // lines, so excluding newlines there would make this blind to every
    // paragraph on the page.
    const banned = /\b(bench|benches|workpiece|readout|diagnostics?|fault|faults)\b/i;
    for (const rel of SRC_FILES) {
        const src = stripped(rel);
        const copy = [
            ...[...src.matchAll(/"([^"\n]{4,})"/g)].map((m) => m[1]),
            ...[...src.matchAll(/'([^'\n]{4,})'/g)].map((m) => m[1]),
            ...[...src.matchAll(/>([^<>{}]{4,})</g)].map((m) => m[1]),
        ];
        for (const line of copy) {
            // Class names and import paths are not copy.
            if (/^[a-z0-9@/._-]+$/i.test(line.trim())) continue;
            if (/(^|\s)(w-|h-|p-|m-|text-|bg-|border-|rounded-|flex|grid|gap-|min-|max-)/.test(line)) continue;
            assert.ok(!banned.test(line), `${rel} still says: ${line.trim().slice(0, 80)}`);
        }
    }
});

console.log(`\ntoolBrief: ${n} checks passed`);
