/**
 * toolBrief — how a screen hands a problem to a tool.
 *
 * ─── WHAT THIS WAS, AND WHY IT IS SMALLER ───────────────────────────────────
 * It used to build a BRIEF: three cards above the chat naming what was worth
 * using a tool for, counted off the student's own rows. The argument was right
 * and it is not gone — it is one screen further on. `/AITools` is a BENCH now
 * (src/lib/workpiece.js), and `workpieceSources.js` offers the same findings as
 * things to put ON the bench rather than as links that seed a chat, which is
 * strictly more: a candidate arrives as an object the tools act on, carrying a
 * way back to where it came from.
 *
 * Two surfaces answering "what is worth working on" is the shape this codebase
 * keeps deleting, so the builders went with the component they fed. What stays
 * is the part nothing else owns: WHICH PERSONA a subject belongs to, and the
 * one query string every screen hands a problem over with.
 *
 * `personaFor` is also read by `workpiece.js`, which is why it lives here
 * rather than moving with the cards.
 */

/**
 * The persona a SUBJECT's written work belongs to.
 *
 * ─── `subjectIsMathHeavy` IS THE WRONG FLAG, and it was the obvious one ─────
 * It exists to decide whether a prompt needs the LaTeX delimiter rules, so it
 * is TRUE for Chemistry, Physics, Economics and Psychology — subjects whose
 * answers carry working. Routed on it, a student with a Chemistry SAC was sent
 * to the MATH TUTOR, which reads as the app not knowing what subject they take.
 * Caught by this module's own test on its first run.
 *
 * So both branches are name matches over the studies the catalogue profiles,
 * which is exact at this size: four mathematics studies and four English ones.
 * There is no field saying "this is assessed as an essay" to read instead, and
 * a heuristic over the name is what gets Data Analytics wrong — the same reason
 * `subjectBrowse`'s learning areas are hand-mapped rather than derived.
 *
 * Anything else gets the general examiner, which is the honest default: a wrong
 * persona is worse than a general one.
 */
export function personaFor(subject) {
    const s = String(subject || "");
    if (!s) return "exam_questions";
    if (/\bMathematic(s|al)\b/i.test(s)) return "math_tutor";
    if (/\bEnglish\b|\bLiterature\b|\bEAL\b/i.test(s)) return "english_mentor";
    return "exam_questions";
}

/**
 * The query string that hands a problem to a tool.
 *
 * ONE BUILDER, because every screen that knows something needs to hand it over
 * the same way — the mistake bank's repeat rows, the subject hub's course gap.
 * Three copies of "tool, q, subject" is three chances for one of them to spell
 * a key differently, and the failure is silent: the link lands on the right
 * page and the thing it promised to open simply does not.
 *
 * No routing in here. No module in src/lib imports `@/utils`, so the caller
 * prepends `createPageUrl("AITools")` and this stays pure and testable.
 */
export function toolQuery({ tool, seed = "", subject = null } = {}) {
    const q = new URLSearchParams();
    if (tool) q.set("tool", tool);
    if (seed) q.set("q", seed);
    if (subject) q.set("subject", subject);
    return q.toString();
}

export default { personaFor, toolQuery };
