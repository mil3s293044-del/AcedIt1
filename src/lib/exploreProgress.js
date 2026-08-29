/**
 * exploreProgress — what the student has actually done, per feature.
 *
 * Read by the Help page (which was called Explore when this was written, hence
 * the filename). It listed all thirty-four features identically, a catalogue
 * rather than a map: nothing on the page knew the difference between the
 * technique someone runs every day and the one they have never opened. The
 * page was already loading the rows that answer that question and using them
 * for one thing only — swapping a dead link for its prerequisite.
 *
 * ─── The one rule ───────────────────────────────────────────────────────────
 * POSITIVE EVIDENCE ONLY. A tick means "there is a row proving you did this".
 * No tick means "nothing here proves it either way" — NOT "you haven't".
 * Several features leave no trace a client can read (reading Analytics, opening
 * a Guide, a Revision Mode run that only writes an XP event), and telling a
 * student they have never done something they did last night is the fastest
 * way to make them stop believing the rest of the page. So `used` is a set of
 * things we can vouch for, `measurable` is what could ever appear in it, and
 * the count is honest about its own denominator.
 */
import { FEATURES, BY_ID } from "@/lib/aceKnowledge";

const any = (list) => Array.isArray(list) && list.length > 0;
const techniqueUsed = (techniques, name) =>
    Array.isArray(techniques) && techniques.some((t) => t?.technique_name === name);
/**
 * `tool_type` on ai_saved_results is whatever the tool wrote at the time, and
 * the schema's own comment shows both spellings in the wild
 * ('note_summariser' and 'note_summarizer'). Compare loosely rather than lose
 * a student's history to a z.
 */
const toolUsed = (results, id) =>
    Array.isArray(results) && results.some((r) =>
        String(r?.tool_type || "").toLowerCase().replace(/z/g, "s") === id.replace(/z/g, "s"));

/**
 * Feature id → the evidence that proves it was used. A feature absent from
 * this table is simply unmeasurable from the client, and says so.
 */
const EVIDENCE = {
    subjects:          (d) => any(d.subjects),
    assessments:       (d) => any(d.assessments),

    pomodoro:          (d) => techniqueUsed(d.techniques, "pomodoro"),
    spaced_repetition: (d) => techniqueUsed(d.techniques, "spaced_repetition")
                              || (Array.isArray(d.flashcards) && d.flashcards.some((c) => (c?.total_reviews || 0) > 0)),
    active_recall:     (d) => techniqueUsed(d.techniques, "active_recall") || any(d.recallSessions),
    blurting:          (d) => techniqueUsed(d.techniques, "blurting") || any(d.blurtSessions),
    mind_map:          (d) => any(d.maps),
    // A rebuild attempt is a child map carrying parent_map_id; a layer is one
    // carrying drill_from_map_id. Same rows the Mind Maps page reads.
    mindmap_recall:    (d) => Array.isArray(d.maps) && d.maps.some((m) => m?.parent_map_id),
    mindmap_layers:    (d) => Array.isArray(d.maps) && d.maps.some((m) => m?.drill_from_map_id),

    quizzes:           (d) => any(d.quizzes) || any(d.quizAttempts),

    planner:           (d) => any(d.plans),
    week_plan:         (d) => any(d.plans),

    friends:           (d) => any(d.friends),
    competitions:      (d) => any(d.competitions),
    study_groups:      (d) => any(d.groups),
};
for (const id of ["concept_explainer", "math_tutor", "english_mentor", "essay_planner",
                  "exam_questions", "teaching_assistant", "note_summariser", "line_memoriser"]) {
    EVIDENCE[id] = (d) => toolUsed(d.aiResults, id);
}

/** Every feature whose use this can ever prove. The honest denominator. */
export const MEASURABLE = FEATURES.filter((f) => EVIDENCE[f.id]).map((f) => f.id);

/** The features we can vouch for. Empty when nothing has loaded. */
export function featureUsage(data) {
    if (!data) return new Set();
    const used = new Set();
    for (const id of MEASURABLE) {
        try { if (EVIDENCE[id](data)) used.add(id); }
        catch { /* a shape we didn't expect proves nothing */ }
    }
    return used;
}

/**
 * Worth trying next.
 *
 * Ordered by what the usage audit actually found, not by what looks tidy:
 * students reliably pick the passive half of every technique. Sixty percent
 * have built a mind map and none had rebuilt one; nobody had run active recall
 * or blurting, both of which sit one tab away from the Pomodoro timer they use
 * constantly. So retrieval practice leads, and setup outranks everything
 * because most of the app stays dark without it.
 *
 * Nothing blocked is ever suggested — a recommendation you can't act on is
 * worse than none — and nothing already done, obviously.
 */
const PRIORITY = [
    "subjects", "assessments",
    "active_recall", "blurting", "mindmap_recall", "spaced_repetition",
    "quizzes", "mind_map", "planner", "pomodoro",
    "concept_explainer", "note_summariser", "teaching_assistant",
    "friends",
];

export function suggestNext(data, { limit = 3, ready = null, isBlocked = null } = {}) {
    if (!data) return [];
    const used = featureUsage(data);
    const out = [];
    for (const id of PRIORITY) {
        if (out.length >= limit) break;
        const f = BY_ID[id];
        if (!f || used.has(id)) continue;
        if (ready && isBlocked && isBlocked(f, ready)) continue;
        out.push(f);
    }
    return out;
}
