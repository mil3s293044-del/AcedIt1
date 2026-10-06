/**
 * toolLabels — what each tool is CALLED, and WHEN a student reaches for it.
 *
 * `chatTools.js` carries lucide icons and React, so `server.mjs` cannot import
 * it and the plain-node test loader cannot resolve it — the same wall that made
 * `XP_RANKS` move out of `xpSystem.jsx` into `xpRanks.js`. Anything that needs
 * only the NAME or the GROUPING reads this and `chatTools.js` imports it back,
 * so there is one copy and a renamed tool renames everywhere.
 *
 * ─── THE PHASE IS THE DASHBOARD'S MAP ───────────────────────────────────────
 * Twelve tools in one grid is the dropdown again with more pixels: a student
 * who does not already know what "Precision Pass" means has to read twelve
 * blurbs to find out which one is theirs. Grouping them by WHEN YOU REACH FOR
 * ONE is the only axis a student can place themselves on without knowing any
 * of the names — somebody with a SAC on Friday knows whether they have written
 * anything yet.
 *
 * It is deliberately NOT grouped by subject: most of the catalogue applies to
 * any study, so three groups would be tiny and one would hold everything. And
 * not by relevance either, which would be a ranking nobody can check on a
 * screen whose other half is built out of facts they can.
 */

export const TOOL_LABELS = {
    math_tutor: "Math Tutor",
    english_mentor: "English Mentor",
    exam_questions: "Exam Questions",
    concept_explainer: "Concept Explainer",
    essay_planner: "Essay Planner",
    teaching_assistant: "Teach It Back",
    note_summariser: "Note Summariser",
    line_memoriser: "Line Memoriser",
    command_term: "Command Term",
    precision: "Precision Pass",
    allocation: "Mark Fit",
    study_coach: "Study Coach",
};

/**
 * Gone from the catalogue, still on rows students saved.
 *
 * ─── IT SHIPS EMPTY, AND THE MECHANISM IS THE POINT ─────────────────────────
 * `study_coach` was briefly retired and is back, so there is nothing in here
 * today. What stays is the CARRIER, the same posture `DISTRIBUTIONS` takes in
 * examinerReports.js: `toolById` falls back to the FIRST tool rather than
 * returning null, so a conversation saved against a tool that later leaves the
 * catalogue would reopen quietly labelled "Math Tutor" — a wrong answer wearing
 * the right label. Add a retired id here and every reader keeps its name.
 *
 * The test exercises that path against a fixture so it cannot rot unused, and
 * separately asserts the shipped map is empty.
 */
export const RETIRED_TOOLS = {};

/**
 * When a student reaches for a tool. Ordered as a session runs.
 *
 * `blurb` is what the heading cannot say on its own: the group name places the
 * student, the sentence tells them what they get. Both are short because four
 * paragraphs of section copy above a grid is the thing nobody reads.
 */
export const PHASES = [
    {
        id: "start",
        label: "Before you start",
        blurb: "Understand the material, and work out what to write.",
        spine: "bg-chart-3", ink: "text-chart-3",
    },
    {
        id: "work",
        label: "While you work",
        blurb: "Stuck in the middle of a question, or unsure what it is asking.",
        spine: "bg-xp", ink: "text-xp",
    },
    {
        id: "after",
        label: "After you write",
        blurb: "Your answer, read the way an assessor reads it.",
        spine: "bg-chart-4", ink: "text-chart-4",
    },
    {
        id: "test",
        label: "To test yourself",
        blurb: "Find out whether it has actually stuck.",
        spine: "bg-primary", ink: "text-primary",
    },
];

/** The phase each tool belongs to. Every live tool has exactly one. */
export const TOOL_PHASE = {
    concept_explainer: "start",
    note_summariser: "start",
    essay_planner: "start",
    study_coach: "start",

    math_tutor: "work",
    command_term: "work",
    allocation: "work",

    english_mentor: "after",
    precision: "after",

    exam_questions: "test",
    teaching_assistant: "test",
    line_memoriser: "test",
};

/** The name, or "" — never another tool's name. */
export const labelForTool = (id) =>
    TOOL_LABELS[String(id || "")] || RETIRED_TOOLS[String(id || "")] || "";

/** Is this tool still something a student can open? */
export const isLiveTool = (id) =>
    Object.prototype.hasOwnProperty.call(TOOL_LABELS, String(id || ""));

/** Which phase, or "" for a tool with none. */
export const phaseOf = (id) => TOOL_PHASE[String(id || "")] || "";

/**
 * The colour a tool is drawn in, which is its PHASE and never its own accent.
 *
 * ─── ONE DEVICE MAY NOT MEAN TWO THINGS ON ONE SCREEN ───────────────────────
 * `chatTools.js` gives every tool an `accentSolid`/`accentText` of its own, and
 * the dashboard used both: the direction rows took the TOOL's hue as a spine
 * while the toolkit grouped the same tools into four phases. So "Teach It Back"
 * was blue at the top of the page and sat in a band organised by something else
 * below it — twelve hues against four, with nothing saying which mattered.
 *
 * Colour means WHEN YOU REACH FOR IT, everywhere here. A tool has exactly one
 * on this page, a run of rows sharing a spine reads as a BAND (the way
 * QueueRow's tiers do) rather than as twelve identities, and the glyphs still
 * tell a repeated set apart by SHAPE, which is the stronger channel anyway.
 *
 * The per-tool accents are untouched and still used by the chat.
 */
const PHASE_BY_ID = Object.fromEntries(PHASES.map((p) => [p.id, p]));

/** `{ spine, ink }` for a tool, or the neutral pair for one with no phase. */
export const toneForTool = (id) =>
    PHASE_BY_ID[phaseOf(id)] || { spine: "bg-muted", ink: "text-muted-foreground" };

/**
 * Tools grouped into the phases, in `PHASES` order.
 *
 * Takes the catalogue rather than reading it, because the catalogue is a `.jsx`
 * neighbour this module may not import. A phase with nothing in it is DROPPED —
 * a heading over an empty grid is a broken filter rather than a section, the
 * rule `subjectBrowse` already keeps about its learning areas.
 */
export function toolsByPhase(tools = []) {
    const out = [];
    for (const phase of PHASES) {
        const items = (tools || []).filter((t) => t && phaseOf(t.id) === phase.id);
        if (items.length) out.push({ ...phase, tools: items });
    }
    return out;
}

export default {
    TOOL_LABELS, RETIRED_TOOLS, PHASES, TOOL_PHASE,
    labelForTool, isLiveTool, phaseOf, toneForTool, toolsByPhase,
};
