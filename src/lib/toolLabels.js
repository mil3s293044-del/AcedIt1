/**
 * toolLabels — what each tool is CALLED, out of the `.jsx` catalogue.
 *
 * `chatTools.js` carries lucide icons and React, so `server.mjs` cannot import
 * it and the plain-node test loader cannot resolve it — the same wall that made
 * `XP_RANKS` move out of `xpSystem.jsx` into `xpRanks.js`. Anything that needs
 * only the NAME reads this and `chatTools.js` imports it back, so there is one
 * copy and a renamed tool renames everywhere.
 *
 * ─── A RETIRED TOOL STILL HAS A NAME ────────────────────────────────────────
 * `study_coach` left the catalogue when the page was rebuilt around faults —
 * it gives advice about studying, which is not a repair on a piece of work, and
 * /Review answers that question properly with numbers a student can check.
 * (The study_coach FEATURE is untouched: that is Ace the companion, a different
 * surface with its own price.)
 *
 * Its name stays here because real students have saved conversations tagged
 * with it. `toolById` falls back to the FIRST tool rather than returning null,
 * so without this an old coaching chat would reopen quietly labelled "Math
 * Tutor" — a wrong answer wearing the right label, which is the failure mode
 * this codebase keeps naming.
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
};

/** Gone from the catalogue, still on rows students saved. */
export const RETIRED_TOOLS = {
    study_coach: "Study Coach",
};

/** The name, or "" — never another tool's name. */
export const labelForTool = (id) =>
    TOOL_LABELS[String(id || "")] || RETIRED_TOOLS[String(id || "")] || "";

/** Is this tool still something a student can open? */
export const isLiveTool = (id) =>
    Object.prototype.hasOwnProperty.call(TOOL_LABELS, String(id || ""));

export default { TOOL_LABELS, RETIRED_TOOLS, labelForTool, isLiveTool };
