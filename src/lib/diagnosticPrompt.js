/**
 * diagnosticPrompt — what the scan is told, and what it may answer.
 *
 * Split from `diagnostic.js` so the model and the validation stay importable by
 * `server.mjs` without dragging 35 subjects of examiner profile in behind them.
 * Same split `markingPrompt.js` keeps from `quizScore.js`.
 *
 * ─── IT IS SHOWN THE RULES IT IS MARKING AGAINST ────────────────────────────
 * `subjectExaminerPrompts.js` carries the mark conventions, the key
 * terminology, the full VCAA command-term table and a per-subject list of how
 * candidates actually lose marks. CLAUDE.md records that the MARKER was asked
 * to write like an examiner with that file sitting two imports away unused; a
 * scan whose entire job is naming faults would be the same mistake again, so
 * it opens with the profile.
 *
 * ─── AND THE FAULT MENU IS CLOSED ───────────────────────────────────────────
 * The scan picks from `FAULTS` and may not invent a category. An open
 * vocabulary gives a different readout every run, cannot be routed to a tool,
 * and cannot be counted — and `readScan` drops anything off-menu, so an
 * invented one is silently lost work rather than a visible error.
 */

import { getExaminerPrompt } from "./subjectExaminerPrompts.js";
import { FAULTS, faultsFor, FINDINGS_MAX, WORK_MAX } from "./diagnostic.js";

/**
 * The cacheable half: everything identical for every scan in a subject.
 *
 * Only the student's work changes between calls, so this is a SYSTEM block for
 * the reason `markingSystem` is: left inline it is re-billed in full on every
 * scan, and the examiner profile is most of its weight.
 */
export function scanSystem(subject) {
    const menu = faultsFor(subject)
        .map((f) => `- "${f.id}" (${f.label}) — ${f.means}`)
        .join("\n");

    return `${getExaminerPrompt(subject || "")}

ROLE: You are running a fault scan over one piece of a VCE student's work. You
are not marking it and you are not rewriting it. You are locating what would
cost marks, naming each one, and stopping.

THE FAULT CLASSES. Every finding must be exactly one of these ids:
${menu}

Anything you would want to report that is not on this list is NOT REPORTED.
The list is what the app can repair; a finding it cannot route is a finding the
student cannot act on.

CLEAN IS A REAL ANSWER, AND IT IS THE RIGHT ONE OFTEN. Good work exists. If
this response would earn its marks, return an empty findings array. Do NOT pad
toward a quota, do NOT downgrade a strong answer to have something to say, and
do NOT report style preferences — a scan that always finds something is one the
student stops believing, and then the real findings go unread too.

AT MOST ${FINDINGS_MAX} FINDINGS, worst first. If there are more than that, the
ones you leave out are the ones worth least.

QUOTE VERBATIM OR NOT AT ALL. A quote must be a character-for-character span of
the student's text so the app can underline it in place. If the fault is that
something is ABSENT — a mechanism never named, a term never used — there is
nothing to quote and you leave the quote empty. That is expected and it is not
a weaker finding; it is usually the strongest one.

WRITE LIKE AN EXAMINER'S REPORT. Address the RESPONSE, not the student. No
praise, no encouragement, no "you might want to". Say what is wrong in one
sentence and what a full-mark version would have contained in another.`;
}

/** The response shape. Flat on purpose — one array, four string fields. */
export const SCAN_SCHEMA = {
    type: "object",
    properties: {
        findings: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    fault: { type: "string" },
                    says: { type: "string" },
                    wanted: { type: "string" },
                    quote: { type: "string" },
                },
                required: ["fault", "says"],
            },
        },
    },
    required: ["findings"],
};

/**
 * The scan itself.
 *
 * `question` and `marks` are optional and the prompt SAYS they are missing
 * rather than inventing them: an allocation finding against a denominator
 * nobody supplied is the `markPercent` failure — a number that reads as a
 * measurement and is a guess.
 */
export function scanPrompt(work, { subject = null, question = null, marks = null } = {}) {
    const text = String(work || "").slice(0, WORK_MAX);
    const head = [
        subject ? `SUBJECT: ${subject}` : null,
        question ? `THE QUESTION THEY WERE ANSWERING:\n${question}` : null,
        marks ? `MARKS AVAILABLE: ${marks}` : null,
    ].filter(Boolean).join("\n\n");

    const noQuestion = question
        ? ""
        : `\n\nThe question itself was not supplied. Judge the response on its own terms, and do NOT report a "${FAULTS.command_term.id}" or "${FAULTS.allocation.id}" finding — both are claims about a question you cannot see.`;

    return `${head}${head ? "\n\n" : ""}THE STUDENT'S WORK:
"""
${text}
"""

Scan it. Return findings, worst first, or an empty array if it would earn its marks.${noQuestion}`;
}

/**
 * The second pass, and it asks ONE question per open finding.
 *
 * It is deliberately NOT another scan. `applyRescan` can only clear or keep,
 * so asking for a fresh read would spend a call on findings that get thrown
 * away — and would tempt whoever reads this next into appending them, which is
 * the non-convergence the whole design is arranged against.
 */
export function rescanPrompt(work, open = []) {
    const text = String(work || "").slice(0, WORK_MAX);
    const list = (open || [])
        .map((f) => `- id "${f.key}" — [${f.code}] ${f.says}`)
        .join("\n");

    return `The student has revised their work. Here is the current version:
"""
${text}
"""

These findings were open against the previous version:
${list}

For EACH id, answer only whether the fault is STILL PRESENT in the version
above. Do not look for anything new — new findings are discarded, so reporting
one costs the student a finding they could have had. Return the ids that are
still present.`;
}

/** What `rescanPrompt` may answer with. */
export const RESCAN_SCHEMA = {
    type: "object",
    properties: {
        still_present: { type: "array", items: { type: "string" } },
    },
    required: ["still_present"],
};

export default { scanSystem, scanPrompt, SCAN_SCHEMA, rescanPrompt, RESCAN_SCHEMA };
