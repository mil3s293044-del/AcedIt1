/**
 * workpiece — the thing you are working ON, and the tools that act on it.
 *
 * ─── A CHAT LOSES THE ARTIFACT ──────────────────────────────────────────────
 * /AITools was nine personas behind a dropdown. Ask the essay planner for a
 * plan and the plan is a message in a scroll; the next tool cannot act on it,
 * so the student copies it back in and restates the context. One piece of work
 * meant up to nine separate conversations about it, none of which knew about
 * the others.
 *
 * So the WORKPIECE is the object and the tools are operations on it. What each
 * tool produced stays on the bench, in order, and every later tool has the ones
 * before it as context. That is the difference between a workshop and a chat
 * window, and it is also the shape of how a SAC actually gets done: explain,
 * plan, draft, mark, fix.
 *
 * ─── A TOOL IS A VERB, NOT A PERSON ─────────────────────────────────────────
 * "Math Tutor" is somebody you talk to. "Work it through" is something you do
 * to a problem. The personas are unchanged underneath — `chatTools.js` still
 * owns the prompts, the options and the feature tag that bills them — and this
 * module is the layer that says what each one DOES and what it can do it to.
 *
 * ─── A TOOL THAT CANNOT ACT ON THIS WORKPIECE IS NOT OFFERED ────────────────
 * You do not memorise a quadratic and you do not mark a concept. A dropdown
 * cannot express that and a toolbar must, or the bench is a nine-item menu with
 * the same problem the dropdown had. `toolsFor` returns only what applies, in
 * the order it is worth doing, and the FIRST one is the one the bench leads
 * with. Nothing is hidden for being advanced; it is hidden for being
 * inapplicable, which is a fact about the workpiece rather than a judgement
 * about the student.
 *
 * ─── NOTHING HERE CALLS A MODEL ─────────────────────────────────────────────
 * Same rule `toolBrief.js` keeps. This picks the tools, writes the opening
 * message and names the step; the model runs when the student presses one.
 */

import { personaFor } from "./toolBrief.js";

/* ── What a workpiece can be ─────────────────────────────────────────────── */

/**
 * The five shapes a piece of work comes in.
 *
 * These are about WHAT THE THING IS, never where it came from — a question you
 * missed and a question you typed are the same object once it is on the bench,
 * and the tools that act on it do not care which door it arrived through. The
 * source is carried separately so the bench can SAY where it came from.
 */
export const KINDS = {
    question: {
        id: "question",
        label: "A question",
        hint: "An exam or SAC question you want to get right.",
    },
    writing: {
        id: "writing",
        label: "Something you wrote",
        hint: "An essay, a paragraph, a response to be marked.",
    },
    problem: {
        id: "problem",
        label: "A problem",
        hint: "Maths or working you are stuck on.",
    },
    material: {
        id: "material",
        label: "Material",
        hint: "Notes, a chapter, a slide deck to turn into something.",
    },
    topic: {
        id: "topic",
        label: "A topic",
        hint: "An idea or area you do not have yet.",
    },
};

export const KIND_LIST = Object.values(KINDS);

/** Is this a kind the bench knows? Anything else cannot be given tools. */
export const isKind = (id) => Object.prototype.hasOwnProperty.call(KINDS, String(id || ""));

/* ── The operations ──────────────────────────────────────────────────────── */

/**
 * Every tool, as a verb, with what it can act on.
 *
 * `tool` is the `chatTools.js` id and is what actually runs — this adds the
 * VERB, the kinds it applies to, and the opening message. `rank` is the order
 * within a kind, lowest first, and it is the order a student would actually do
 * them in rather than a popularity guess: understand it, then plan it, then
 * produce, then check, then rehearse.
 *
 * `study_coach` is deliberately ABSENT. It is advice about studying rather than
 * an operation on a piece of work, so putting it on a bench beside "mark it"
 * would be the one tool here that does nothing to the thing in front of you.
 * It stays reachable as its own chat.
 */
export const OPERATIONS = [
    {
        id: "explain",
        tool: "concept_explainer",
        verb: "Explain it",
        does: "What this is actually asking, from the start.",
        appliesTo: ["question", "problem", "topic", "material"],
        rank: 10,
        seed: (w) => `Explain this properly, from the start, and check I have got it.\n\n${w.body}`,
    },
    {
        id: "work",
        tool: "math_tutor",
        verb: "Work it through",
        does: "Step by step, with the working shown.",
        appliesTo: ["problem", "question"],
        rank: 20,
        seed: (w) => `Work this through step by step. Show every line, and stop to check I am following.\n\n${w.body}`,
    },
    {
        id: "plan",
        tool: "essay_planner",
        verb: "Plan it",
        does: "A contention, a structure and the evidence.",
        appliesTo: ["question", "writing"],
        rank: 30,
        seed: (w) => `Help me plan a response to this — contention, structure, and what evidence each part needs.\n\n${w.body}`,
    },
    {
        id: "mark",
        tool: "english_mentor",
        verb: "Mark it",
        does: "Against the real criteria, like an assessor.",
        appliesTo: ["writing"],
        rank: 40,
        seed: (w) => `Mark this against the VCAA criteria. Tell me what a full-mark version would have contained.\n\n${w.body}`,
    },
    {
        id: "test",
        tool: "exam_questions",
        verb: "Question me",
        does: "Exam-style questions, with marking guides.",
        appliesTo: ["topic", "material", "question", "problem"],
        rank: 50,
        seed: (w) => `Write me exam-style questions on this, with marking guides.\n\n${w.body}`,
    },
    {
        id: "condense",
        tool: "note_summariser",
        verb: "Condense it",
        does: "Down to what is worth revising.",
        appliesTo: ["material", "topic"],
        rank: 60,
        seed: (w) => `Condense this down to what is actually worth revising.\n\n${w.body}`,
    },
    {
        id: "teach",
        tool: "teaching_assistant",
        verb: "Teach it back",
        does: "You explain, it asks why.",
        appliesTo: ["topic", "material"],
        rank: 70,
        seed: (w) => `I am going to teach you this. Play a student who asks why, and stop me where I am vague.\n\n${w.body}`,
    },
    {
        id: "memorise",
        tool: "line_memoriser",
        verb: "Memorise it",
        does: "Line by line, until it holds.",
        appliesTo: ["material"],
        rank: 80,
        seed: (w) => `Help me memorise this line by line.\n\n${w.body}`,
    },
];

/** One operation by its id. */
export const operationById = (id) =>
    OPERATIONS.find((o) => o.id === String(id || "")) || null;

/**
 * The tools that can act on this workpiece, best first.
 *
 * SUBJECT OVERRIDES RANK FOR ONE PAIR ONLY. `personaFor` already decides which
 * persona marks a subject's written work, and a maths question belongs with the
 * tutor rather than the explainer however the ranks fall. Letting the subject
 * reorder everything would make the toolbar move about for reasons a student
 * cannot see, so it promotes exactly the one operation whose tool the subject
 * names, and nothing else shifts.
 *
 * ─── A FALLBACK IS NOT A NOMINATION, and promoting one was visibly wrong ────
 * `personaFor` returns `exam_questions` for everything it does not recognise —
 * which is the honest default for MARKING and is not a statement that questions
 * are the thing to do first. Promoted on it, every subject that is not maths or
 * English led with "Question me": a Chemistry criterion the student keeps
 * dropping opened offering to test them on it rather than to explain it, which
 * is the wrong end of the ladder and was obvious the moment the bench was drawn.
 * Only a SPECIALIST persona promotes; the general one leaves the ranks alone.
 */
const SPECIALIST = new Set(["math_tutor", "english_mentor"]);

export function toolsFor(workpiece) {
    const kind = workpiece?.kind;
    if (!isKind(kind)) return [];
    const named = personaFor(workpiece?.subject);
    const persona = SPECIALIST.has(named) ? named : null;
    return OPERATIONS
        .filter((o) => o.appliesTo.includes(kind))
        .slice()
        .sort((a, b) => {
            const pa = a.tool === persona ? 0 : 1;
            const pb = b.tool === persona ? 0 : 1;
            return pa - pb || a.rank - b.rank;
        });
}

/** The one the bench leads with, or null when nothing applies. */
export const leadTool = (workpiece) => toolsFor(workpiece)[0] || null;

/* ── Building one ────────────────────────────────────────────────────────── */

/**
 * Where it came from, printed on the bench.
 *
 * The SOURCE is not the kind. A question you missed and a question you typed
 * are the same object with the same tools; what differs is what the bench can
 * honestly say above it, and whether there is somewhere to send the student
 * back to. `ref` is that link and is null for anything typed or uploaded —
 * there is nowhere to go back to, and inventing one would be a dead end.
 */
export const SOURCES = {
    missed:     { id: "missed",     label: "A question you missed" },
    mistake:    { id: "mistake",    label: "A criterion you keep dropping" },
    assessment: { id: "assessment", label: "From your planner" },
    slipping:   { id: "slipping",   label: "Cards that are slipping" },
    typed:      { id: "typed",      label: "You wrote this" },
    uploaded:   { id: "uploaded",   label: "You uploaded this" },
    chat:       { id: "chat",       label: "You worked on this before" },
};

/** Trim and bound a body. A workpiece is a thing to work on, not a textbook. */
export const BODY_MAX = 6000;

/**
 * The identity of a workpiece, which is WHAT IT IS and not when it was picked.
 *
 * A bench is reconstructed by grouping the steps saved against it (`bench.js`),
 * so a workpiece needs a key that is the same every time the same thing is put
 * on the bench. Derived from the kind and the body, which is the honest reading:
 * the same question picked out of the mistake bank on Tuesday and again on
 * Friday is ONE piece of work, and a timestamp or a random id would have made
 * it two benches with the Tuesday half stranded.
 *
 * FNV-1a over the normalised text — no dependency, and deterministic across
 * engines, which a key used to group stored rows has to be. It is not a
 * security hash and nothing here depends on it being one: a collision would
 * merge two benches, which is visible and recoverable, and the inputs are the
 * student's own text rather than anything an attacker chooses.
 */
export function workpieceKey({ kind = "", body = "" } = {}) {
    const text = `${kind}\u0000${String(body || "").replace(/\s+/g, " ").trim().toLowerCase()}`;
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return `wp_${h.toString(36)}_${text.length.toString(36)}`;
}

/**
 * Make a workpiece.
 *
 * It REFUSES rather than guessing: no body and there is nothing to work on, an
 * unknown kind and there are no tools to offer. Both return null, and the bench
 * draws its empty state rather than a bench holding nothing — the rule every
 * builder in `toolBrief` and `studyQueue` already keeps.
 */
export function makeWorkpiece({
    kind,
    body = "",
    title = "",
    subject = null,
    source = "typed",
    ref = null,
    files = [],
    key = null,
} = {}) {
    const text = String(body || "").trim();
    if (!text || !isKind(kind)) return null;
    const clipped = text.slice(0, BODY_MAX);
    return {
        kind,
        body: clipped,
        // KEYED ON THE CLIPPED BODY, which is the body that gets stored. Keying
        // on the full text would give a 6,001-character paste a different key
        // from the one that comes back out of the step row it was saved on.
        // A caller may pass one — an adopted chat keys on its ROW, because its
        // kind is not known at the moment the bench opens and a key that moved
        // when the student named the kind would split the bench in half.
        key: key ? String(key) : workpieceKey({ kind, body: clipped }),
        title: String(title || "").trim() || titleFrom(text),
        subject: subject || null,
        source: SOURCES[source] ? source : "typed",
        // A REF IS A WAY BACK, never a decoration. Carried only when the thing
        // it points at is a real screen in this app.
        ref: ref && ref.page ? ref : null,
        files: Array.isArray(files) ? files : [],
    };
}

/**
 * A title from the body, when nobody gave one.
 *
 * It takes the first SENTENCE rather than the first N characters, because a
 * question clipped mid-clause reads as broken text — the failure
 * `autoBankRows` was deleted for, which stored a clipped stem as a heading and
 * put it on screen cut off mid-word. A sentence that is itself too long still
 * gets cut, with an ellipsis so the cut is visible rather than silent.
 */
export function titleFrom(body = "") {
    const text = String(body || "").replace(/\s+/g, " ").trim();
    if (!text) return "Untitled";
    const stop = text.search(/[.?!]\s|$/);
    const first = (stop > 0 ? text.slice(0, stop + 1) : text).trim();
    if (first.length <= 72) return first;
    return `${first.slice(0, 69).trimEnd()}…`;
}

/* ── Steps ───────────────────────────────────────────────────────────────── */

/**
 * What a tool run leaves behind.
 *
 * A step is a CONVERSATION, which is why the bench did not need a second send
 * path: `UnifiedChat` already streams, handles artifacts, bills the right
 * feature and persists. A step is that conversation scoped to one operation on
 * one workpiece, so "make it harder" and "I still do not get part b" land where
 * they belong instead of in a general thread about everything.
 */
export function stepTitle(op, workpiece) {
    if (!op) return "Step";
    const subject = workpiece?.subject ? ` · ${workpiece.subject}` : "";
    return `${op.verb}${subject}`;
}

/**
 * The opening message for an operation.
 *
 * It CARRIES THE WORKPIECE, which is the entire point: the student never
 * restates what they are working on, and every step after the first is about
 * the same thing by construction rather than by them remembering to say so.
 */
export function seedFor(op, workpiece) {
    if (!op || !workpiece?.body) return "";
    return op.seed(workpiece);
}

export default {
    KINDS, KIND_LIST, isKind, OPERATIONS, operationById,
    toolsFor, leadTool, SOURCES, makeWorkpiece, titleFrom, workpieceKey,
    stepTitle, seedFor, BODY_MAX,
};
