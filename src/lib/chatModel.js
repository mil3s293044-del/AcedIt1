/**
 * chatModel — the decisions the AI chat makes that are not drawing.
 *
 * /AITools is a chat, and four earlier shapes of that page each put something
 * in front of it and each lost to it. So this release did not change WHAT the
 * page is; it changed how it behaves, and every behaviour that could be wrong
 * without anything throwing lives here as a pure function the test can run:
 * which chats go under "Yesterday", which tool a fresh chat opens on, what a
 * follow-up chip says, what a search over twelve tools returns.
 *
 * ─── HISTORY IS BY DATE, NOT BY TOOL ────────────────────────────────────────
 * The rail used to fold conversations by tool. With six chats in six tools that
 * was six uppercase headings over six rows, and the newest chat was wherever
 * its tool happened to sit in the catalogue. What a student remembers about a
 * chat they want back is WHEN it was and what it was about; the tool is a glyph
 * on the row. `historyGroups` buckets on LOCAL days through `studyLog`'s own
 * `dayKey`, because `toISOString` is UTC and would put a 9am Melbourne chat
 * under yesterday.
 *
 * "Last 7 days", not "This week". `date-fns` defaults `startOfWeek` to Sunday
 * and this codebase has already shipped two different weeks on two screens
 * once; a rolling seven days has no week to disagree about.
 *
 * ─── A FRESH CHAT OPENS ON WHAT THEY USE, NOT ON WHATEVER IS FIRST ──────────
 * It opened on Math Tutor for everybody — not by decision, but because it is
 * `CHAT_TOOLS[0]`. A Legal Studies student who had never asked a maths
 * question met "Works it through with you, one hint at a time" as the page's
 * subtitle. `openingTool` states the order instead: a reopened conversation,
 * then a link somebody pressed, then what they said today is for, then the tool
 * they used last, then Study Coach — "Stuck? Start here" is the honest default
 * for somebody who has given us nothing to go on.
 */
import { recentChats } from "@/lib/aiChats";
import { dayKey } from "@/lib/studyLog";
import { PHASES, phaseOf, isLiveTool, labelForTool } from "@/lib/toolLabels";

/* ── History ─────────────────────────────────────────────────────────────── */

export const HISTORY_GROUPS = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "week", label: "Last 7 days" },
    { id: "earlier", label: "Earlier" },
];

const MS_DAY = 86400000;

/** Whole local days between two instants — midnight to midnight, so DST cannot split one. */
function daysBetween(at, now) {
    const a = new Date(at); a.setHours(12, 0, 0, 0);
    const b = new Date(now); b.setHours(12, 0, 0, 0);
    return Math.round((b - a) / MS_DAY);
}

/** Which bucket an instant falls in, or "earlier" for one with no date. */
export function historyBucket(at, now = new Date()) {
    // `at` is a number or null. A null is NOT 1970: `Number(null)` is 0, and a
    // coerced undated row would be filed as the oldest thing anybody ever said.
    // It is kept, and it goes last.
    if (at == null || !Number.isFinite(Number(at))) return "earlier";
    const d = daysBetween(Number(at), now);
    // A row dated in the future is a clock that disagrees with ours, not a chat
    // from tomorrow — it is today's.
    if (d <= 0 || dayKey(new Date(Number(at))) === dayKey(new Date(now))) return "today";
    if (d === 1) return "yesterday";
    if (d < 7) return "week";
    return "earlier";
}

/**
 * The rail: conversations newest first, bucketed by local day, optionally
 * narrowed by a search.
 *
 * The search matches what the ROW SHOWS — the title, the tool's name and the
 * subject. It does not search message bodies: the rows are loaded so it could,
 * and a hit buried in turn nine would show a title that does not contain the
 * word, which is a result nobody can see the reason for.
 *
 * Empty buckets are dropped. A heading over nothing is a broken filter.
 */
export function historyGroups(rows = [], { now = new Date(), query = "" } = {}) {
    const q = String(query || "").trim().toLowerCase();
    const items = recentChats(rows, Infinity).filter((c) => {
        if (!q) return true;
        return `${c.title} ${c.toolLabel} ${c.subject || ""}`.toLowerCase().includes(q);
    });
    const by = new Map(HISTORY_GROUPS.map((g) => [g.id, []]));
    for (const c of items) by.get(historyBucket(c.at, now)).push(c);
    return HISTORY_GROUPS
        .map((g) => ({ ...g, items: by.get(g.id) }))
        .filter((g) => g.items.length > 0);
}

/* ── Which tool a chat opens on ──────────────────────────────────────────── */

/** The tool somebody who has given us nothing to go on is offered. */
export const FALLBACK_TOOL = "study_coach";

/** The tool on their newest conversation, if it is one they can still open. */
export function lastUsedTool(rows = []) {
    const newest = recentChats(rows, Infinity).find((c) => isLiveTool(c.tool));
    return newest ? newest.tool : null;
}

/**
 * Which tool, and why. Each candidate is checked against the catalogue rather
 * than trusted: a stale link or a retired tool on an old row falls through to
 * the next reason instead of landing on an empty switcher.
 *
 * `toolById` in chatTools.js FALLS BACK TO THE FIRST TOOL rather than returning
 * null, so nothing here may be fed through it before it is checked — doing so
 * makes every candidate look valid and the order below means nothing.
 */
export function openingTool({ conversation = null, link = null, intent = null, rows = [] } = {}) {
    if (isLiveTool(conversation)) return { id: conversation, why: "conversation" };
    if (isLiveTool(link)) return { id: link, why: "link" };
    if (isLiveTool(intent)) return { id: intent, why: "intent" };
    const last = lastUsedTool(rows);
    if (last) return { id: last, why: "last" };
    return { id: FALLBACK_TOOL, why: "fallback" };
}

/* ── Follow-ups ──────────────────────────────────────────────────────────── */

/**
 * What a student is most likely to say next, per tool.
 *
 * FIXED, never generated. A model writing its own follow-ups would be a second
 * call on every reply to save the student typing six words, and the result is
 * the same three suggestions for everybody anyway. These are written in the
 * student's voice because tapping one SENDS it — the text is their message, so
 * it has to read like them.
 *
 * Tapping one spends a send, which is why the chip prints the price. Every
 * other place this page seeds a message puts it in the composer instead; the
 * difference is that a follow-up is read in full on the chip before the tap,
 * and the price is beside it.
 */
export const FOLLOW_UPS = {
    math_tutor: [
        { id: "harder", label: "A harder one", text: "Give me a harder question like that one. Let me try it before you show any working." },
        { id: "full", label: "The full solution", text: "Show me the full worked solution, every step." },
        { id: "slower", label: "That step, slower", text: "Go back over the step I am most likely to get wrong, more slowly." },
    ],
    english_mentor: [
        { id: "another", label: "Upgrade another sentence", text: "Rewrite another of my sentences at A+ standard and tell me what changed." },
        { id: "lift", label: "What lifts it a mark?", text: "What is the single change that would lift this by a mark?" },
        { id: "contention", label: "A stronger contention", text: "Give me a stronger version of my contention." },
    ],
    exam_questions: [
        { id: "harder", label: "Make them harder", text: "Make these harder — closer to the end of the exam." },
        { id: "more", label: "Five more", text: "Five more on the same content, from different angles." },
        { id: "short", label: "Quick 1–2 markers", text: "Give me quick 1–2 mark questions on the same content." },
    ],
    concept_explainer: [
        { id: "example", label: "Another example", text: "Give me another worked example, a bit different from that one." },
        { id: "simpler", label: "Simpler", text: "Explain it again more simply, as if I am seeing it for the first time." },
        { id: "quiz", label: "Quiz me on it", text: "Ask me three short questions on that and mark my answers." },
    ],
    essay_planner: [
        { id: "sharper", label: "A sharper contention", text: "Push my contention further — give me a sharper, more nuanced one." },
        { id: "topics", label: "Topic sentences", text: "Write a topic sentence for each body paragraph." },
        { id: "counter", label: "The counter-argument", text: "What is the strongest counter-argument, and where would I deal with it?" },
    ],
    teaching_assistant: [
        { id: "gaps", label: "What did I leave out?", text: "Step out of character for a moment: what did I explain badly or leave out?" },
    ],
    note_summariser: [
        { id: "traps", label: "The exam traps", text: "What are the common exam traps in this material?" },
        { id: "test", label: "Test me", text: "Ask me five recall questions on this, one at a time." },
    ],
    line_memoriser: [
        { id: "smaller", label: "Smaller pieces", text: "Split it into smaller pieces." },
    ],
    command_term: [
        { id: "another", label: "Another sentence", text: "Do the same for another sentence in my answer." },
        { id: "confused", label: "Terms people mix up", text: "Which other command terms get confused with this one, and how do they differ?" },
    ],
    precision: [
        { id: "terms", label: "The terms that pay", text: "List the ten terms this topic pays for, with a one-line definition each." },
        { id: "quiz", label: "Quiz me on them", text: "Quiz me on those terms, one at a time." },
    ],
    allocation: [
        { id: "full", label: "A full-mark version", text: "Show me what a full-mark answer to this would contain, point by point." },
        { id: "trim", label: "Where to cut", text: "Show me where to cut so it fits the marks." },
    ],
    study_coach: [
        { id: "week", label: "Plan this week", text: "Turn that into a plan for this week, day by day." },
        { id: "short", label: "I have 30 minutes", text: "I only have 30 minutes tonight. What should I do with it?" },
    ],
};

/** The follow-ups for a tool, or none for one this list does not know. */
export function followUpsFor(toolId) {
    return FOLLOW_UPS[String(toolId || "")] || [];
}

/* ── Choosing a tool ─────────────────────────────────────────────────────── */

/**
 * A `/` at the very start of the composer opens the palette, and the word
 * after it is the search. Anything else is a message: "1/2", "and/or" and a
 * slash followed by a space are not commands.
 */
export function slashQuery(input) {
    const m = String(input ?? "").match(/^\/([^\s/]*)$/);
    return m ? m[1] : null;
}

/**
 * The palette's search over the catalogue. Name matches lead (a prefix ahead
 * of a substring), then the blurb and the phase — so "plan" finds Essay
 * Planner before the coach that mentions planning, and "after" finds the tools
 * you reach for after you write. Catalogue order breaks ties, so the list does
 * not reshuffle between keystrokes.
 */
export function filterTools(tools = [], query = "") {
    const q = String(query || "").trim().toLowerCase();
    const list = (tools || []).filter(Boolean);
    if (!q) return list;
    const phaseLabel = (id) => (PHASES.find((p) => p.id === phaseOf(id)) || {}).label || "";
    const scored = [];
    list.forEach((t, i) => {
        const label = String(t.label || labelForTool(t.id) || "").toLowerCase();
        const words = label.split(/\s+/);
        let score = null;
        if (label.startsWith(q) || words.some((w) => w.startsWith(q))) score = 0;
        else if (label.includes(q)) score = 1;
        else if (`${t.blurb || ""} ${phaseLabel(t.id)}`.toLowerCase().includes(q)) score = 2;
        if (score != null) scored.push({ t, score, i });
    });
    return scored.sort((a, b) => a.score - b.score || a.i - b.i).map((s) => s.t);
}

/* ── Subject and strand ──────────────────────────────────────────────────── */

/**
 * The Math Tutor strand a subject IS, or null.
 *
 * The composer offered a subject picker reading "No subject" beside a strand
 * row reading "Mathematical Methods" — two controls for one fact, free to
 * disagree, and the prompt resolves the disagreement by letting the strand win
 * silently. When the subject is one of the four maths studies it decides the
 * strand and the strand row is not drawn; only with no subject, or a subject
 * that is not maths, is there anything left for the strand to say.
 */
export function strandFor(subject) {
    const s = String(subject || "");
    if (/\bFoundation Mathematics\b/i.test(s)) return "foundation";
    if (/\bGeneral Mathematics\b/i.test(s)) return "general";
    if (/\bMathematical Methods\b/i.test(s)) return "methods";
    if (/\bSpecialist Mathematics\b/i.test(s)) return "specialist";
    return null;
}

export default {
    HISTORY_GROUPS, historyBucket, historyGroups,
    FALLBACK_TOOL, lastUsedTool, openingTool,
    FOLLOW_UPS, followUpsFor, slashQuery, filterTools, strandFor,
};
