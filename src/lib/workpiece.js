/**
 * workpiece — the piece of work a scan is about, and where it came from.
 *
 * ─── IT IS THE OBJECT, NOT THE ROUTING ──────────────────────────────────────
 * This module used to be the whole model behind a "bench": a kind of thing,
 * and the operations that applied to it. `diagnostic.js` replaced the routing
 * half — the scan reads the work and names the faults, and each fault carries
 * its own repair, so nothing has to ask the student what sort of thing they
 * have before it can help.
 *
 * What is left is the part the scan does not do and should not: what the thing
 * IS (`makeWorkpiece`), what identifies it across sessions (`workpieceKey`,
 * which `bench.js` groups saved conversations on), and where it came from
 * (`SOURCES`, printed so a candidate pulled out of the mistake bank carries a
 * way back to it).
 *
 * ─── THE STORED SHAPE DID NOT MOVE ──────────────────────────────────────────
 * `input_data.workpiece` is on real rows, saved by real students. Renaming it
 * to match the new vocabulary would strand every one of them, which is the rule
 * `sideLabels` already keeps about yes and no: ONLY THE LABEL MOVES. Every word
 * a student reads is the scan's; the key underneath stays as it is.
 */


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

/* ── The operations are GONE, and `diagnostic.js` is why ─────────────────── */

/**
 * This file used to carry eight OPERATIONS — a verb per tool, with the kinds it
 * applied to — and `toolsFor` routed from the kind of thing on the bench to the
 * tools that could act on it.
 *
 * That is a SECOND answer to the question the scan now answers properly. The
 * bench asked "what sort of thing is this?" and offered everything that could
 * apply; the scan reads the work and names what is actually wrong, and each
 * fault carries its own repair. Keeping both would mean a student could be
 * offered "Mark it" by the kind router while the readout said the only fault
 * was a command term — two surfaces answering "which tool", disagreeing, with
 * nothing on screen saying which to believe. That is the shape this codebase
 * keeps deleting.
 *
 * What survives here is what the scan does NOT do: identity (`workpieceKey`),
 * provenance (`SOURCES`), and the shape a candidate from the student's own
 * work arrives in. `KINDS` stays with it — a candidate still says what it is,
 * and the intake prints it — but nothing ROUTES on it any more.
 */

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
 * A step is still a CONVERSATION, which is why there is no second send path —
 * but its title and its opening message come from the FINDING it repairs now
 * (`diagnostic.repairSeed`), not from an operation. `bench.js` names an older
 * step from its tool instead, through `toolLabels.js`.
 */


export default {
    KINDS, KIND_LIST, isKind,
    SOURCES, makeWorkpiece, titleFrom, workpieceKey, BODY_MAX,
};
