/**
 * planTags — the metadata that rides along in a StudyPlan's `notes` field.
 *
 * `study_plans` 400s on unknown columns, so duration, recurrence, the owning
 * Strategise plan and the free-text note all share the one text field that
 * already exists:
 *
 *     "[rec:abc123][str:5f3a2b1c][dur:40] bring the formula sheet"
 *
 * These live here rather than in Goals.jsx because the Strategise check-in
 * needs to read the same tags, and a second copy of the regexes is exactly how
 * `[str:]` came to be written by Strategise, never stripped by the planner,
 * and shown to students as part of their note text.
 */

const REC_TAG = /\[rec:([a-z0-9-]+)\]/i;
const DUR_TAG = /\[dur:(\d+)\]/i;
const STR_TAG = /\[str:([a-z0-9-]+)\]/i;

/** Recurrence series id, or null. */
export const recIdOf = (plan) => plan?.notes?.match(REC_TAG)?.[1] || null;

/** Owning Strategise plan id, or null. */
export const stratIdOf = (plan) => plan?.notes?.match(STR_TAG)?.[1] || null;

/** Planned minutes, or null when the session predates duration tagging. */
export const durationOf = (plan) => {
    const m = plan?.notes?.match(DUR_TAG);
    return m ? Number(m[1]) : null;
};

/** The student-visible part of the note, with every tag removed. */
export const noteTextOf = (plan) =>
    (plan?.notes || "").replace(REC_TAG, "").replace(DUR_TAG, "").replace(STR_TAG, "").trim() || null;

/**
 * Rebuild the notes field from its parts. Editing a session must not orphan it
 * from its recurrence series or its Strategise plan, so both ids are carried
 * through even though the edit form never shows them.
 */
export const buildNotes = (recId, duration, text, stratId) => {
    const tags = `${recId ? `[rec:${recId}]` : ""}${stratId ? `[str:${stratId}]` : ""}${duration ? `[dur:${duration}]` : ""}`;
    const body = (text || "").trim();
    return `${tags}${body ? ` ${body}` : ""}` || null;
};
