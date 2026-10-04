/**
 * diagnostic — a piece of work, scanned, with every fault located and clearable.
 *
 * ─── A TOOL IS A REPAIR FOR A FAULT, NOT A PERSONA ──────────────────────────
 * /AITools was nine personas behind a dropdown, and then eight verbs on a
 * "bench". Both asked the student the two hardest parts of the job first: which
 * tool solves this, and what exactly is wrong. A student who could answer the
 * second question usually would not need the first.
 *
 * So the app ANSWERS it. The work is scanned, every fault it finds is located
 * and named, and each one carries the tool that repairs it. You clear them one
 * at a time until the readout is all clear. The tools did not change — they
 * are reorganised around what they FIX, which is also why three obvious ones
 * were missing: nothing in the app had ever offered to check a command term.
 *
 * ─── IT MUST BE ABLE TO COME BACK CLEAN ─────────────────────────────────────
 * The single most important property here. A scan that always finds five
 * faults is a horoscope, and the first time a student pastes something good and
 * is told it is broken, every later finding is read as decoration too — the
 * exact failure `recallSuggest` records a screenshot catching ("0% of your
 * reviews on this missed" under a pill reading *Costing you marks*). `CLEAN` is
 * a real outcome with a real screen, and the prompt says so in as many words.
 *
 * ─── THE FAULT SET IS FIXED AT SCAN TIME, so the loop converges ─────────────
 * The obvious build re-scans after every repair, and it does not terminate: the
 * model finds new or reshaped faults each pass and the all-clear a student is
 * working toward never arrives. That is the non-convergence this codebase
 * already records about review bots. So a scan produces ONE set, `applyRescan`
 * may only CLEAR or KEEP what is already in it, and anything new a later pass
 * thinks it sees is discarded rather than appended.
 *
 * ─── AND THE STUDENT CLEARS IT, never the model ─────────────────────────────
 * `drill.js` makes this call already: "the model SUGGESTS a rating and
 * highlights that button; the student still presses one. An app that schedules
 * a card off its own verdict has taken the one judgement only they can make."
 * Identical here. The repair tool helps; whether they actually understand it
 * now is theirs to say. The re-scan exists as PROOF for anyone who wants it,
 * priced like anything else.
 *
 * ─── NOTHING HERE CALLS A MODEL ─────────────────────────────────────────────
 * This builds the prompt, validates what comes back, and keeps the state. The
 * page runs the call. Same split `markingPrompt.js` and `toolBrief.js` keep.
 */

import { personaFor } from "./toolBrief.js";

/* ── What the scan costs, and what it runs on ────────────────────────────── */

/**
 * The scan is a REAL model call and is priced like one.
 *
 * `toolBrief` calls no model on purpose and its reasoning does not transfer:
 * that was a diagnosis of the student's HISTORY, which is arithmetic over rows
 * they already own and can therefore check line by line. A diagnosis of a
 * paragraph they typed thirty seconds ago cannot be arithmetic — there is
 * nothing to count. So this is a model call, and the honest thing is to say so
 * and put the price on the button, which is megaUpload's rule.
 *
 * The split is worth stating: **diagnosing your history is free, diagnosing
 * your work costs a scan.** One is counting; the other is reading.
 */
export const SCAN_FEATURE = "ai_scan";

/**
 * It runs on Haiku, and that is a constant rather than the `fast` flag.
 *
 * `fast: true` routes to `ANTHROPIC_FAST_MODEL`, which FALLS BACK TO SONNET
 * when the variable is unset — so a price claim resting on it would be true on
 * one deploy and wrong on another, silently. `megaUpload` pins `MEGA_MODEL` for
 * the same reason and the server forces it the same way.
 *
 * Haiku is the right model for this on the merits, not only the price: locating
 * and classifying faults against a fixed menu is bulk comprehension, which is
 * what the mega read already uses it for. The REPAIRS run on the student's own
 * tier, because a repair is judgement.
 */
export const SCAN_MODEL = "claude-haiku-4-5-20251001";
export const SCAN_MODEL_LABEL = "Haiku 4.5";

/** The longest piece of work a scan will read. */
export const WORK_MAX = 6000;

/**
 * How many faults one readout may carry.
 *
 * A readout with twelve rows is a guilt list, which is the screen /MistakeBank
 * was written not to be. Six is the most a student can hold and still believe
 * the all-clear is reachable — and a scan that genuinely found more has found
 * something structural, which the top three will already be saying.
 */
export const FINDINGS_MAX = 6;

/* ── The fault classes ───────────────────────────────────────────────────── */

/**
 * Every fault the scan may report, and the tool that repairs it.
 *
 * This is a FIXED MENU, and that is the whole guard. A scan allowed to invent
 * its own categories produces a different vocabulary every run, cannot be
 * routed to a tool, and cannot be counted — so the prompt is handed these ids
 * and anything else that comes back is dropped rather than rendered as a
 * mystery row with no repair behind it.
 *
 * `code` is the short form the readout prints in mono beside each row. It is
 * not decoration: it is what makes two findings of the same class legible as
 * the same class at a glance, and it is what a student would say out loud.
 *
 * `applies` gates a fault to the subjects where it is REAL — see below.
 *
 * `rank` is the order they are worked in, and it is the order they cost marks:
 * misreading the command term loses the whole question, a missing term loses
 * part of one. Same argument `studyQueue`'s four tiers make.
 */
export const FAULTS = {
    command_term: {
        id: "command_term",
        code: "CT",
        label: "Command term",
        means: "The question asked for one thing and the answer does another.",
        tool: "command_term",
        applies: "all",
        rank: 10,
    },
    understanding: {
        id: "understanding",
        code: "UN",
        label: "Understanding",
        means: "The idea underneath this is wrong or missing.",
        tool: "concept_explainer",
        applies: "all",
        rank: 20,
    },
    evidence: {
        id: "evidence",
        code: "EV",
        label: "Evidence",
        means: "A claim with nothing behind it.",
        tool: "essay_planner",
        applies: "all",
        rank: 30,
    },
    working: {
        id: "working",
        code: "WK",
        label: "Working",
        means: "Steps the marker needs to see are not on the page.",
        tool: "math_tutor",
        applies: "maths",
        rank: 40,
    },
    precision: {
        id: "precision",
        code: "PR",
        label: "Precision",
        means: "Everyday wording where the study design wants the term.",
        tool: "precision",
        applies: "all",
        rank: 50,
    },
    structure: {
        id: "structure",
        code: "ST",
        label: "Structure",
        means: "No contention, or the argument does not arrive.",
        tool: "essay_planner",
        applies: "all",
        rank: 60,
    },
    allocation: {
        id: "allocation",
        code: "AL",
        label: "Mark fit",
        means: "The answer is the wrong size for the marks on offer.",
        tool: "allocation",
        applies: "all",
        rank: 70,
    },
    expression: {
        id: "expression",
        code: "EX",
        label: "Expression",
        means: "Grammar and phrasing that costs marks here.",
        tool: "english_mentor",
        applies: "english",
        rank: 80,
    },
};

export const FAULT_LIST = Object.values(FAULTS).sort((a, b) => a.rank - b.rank);

export const isFault = (id) =>
    Object.prototype.hasOwnProperty.call(FAULTS, String(id || ""));

/**
 * Which subject family a study belongs to, for gating.
 *
 * Name matches over the studies the catalogue profiles, which is exact at this
 * size — the same call `personaFor` and `subjectBrowse`'s hand-mapped learning
 * areas both make, and for the same reason: every heuristic that could derive
 * this gets something wrong, and `subjectIsMathHeavy` is TRUE for Chemistry.
 */
export function familyOf(subject) {
    const persona = personaFor(subject);
    if (persona === "math_tutor") return "maths";
    if (persona === "english_mentor") return "english";
    return "other";
}

/**
 * May this fault be reported about this subject?
 *
 * ─── FLAGGING GRAMMAR ON A CHEMISTRY ANSWER IS MISEDUCATING ─────────────────
 * `markingPrompt.js` records that VCAA does not penalise spelling, or notation
 * written legibly another way, outside the English studies — the leniency is
 * stated in the marking rubric for exactly that reason. So a readout that puts
 * EXPRESSION on a Chemistry response is not merely noisy: it sends a student to
 * spend their evening on the one thing that was never going to earn them a
 * mark, with the app's authority behind it.
 *
 * WORKING is gated the other way, and more loosely: it is real wherever an
 * answer carries steps, which is most of the sciences, so it is allowed
 * everywhere EXCEPT the English studies, where there is no working to show.
 */
export function faultApplies(fault, subject) {
    const f = FAULTS[String(fault?.id || fault || "")];
    if (!f) return false;
    const family = familyOf(subject);
    if (f.applies === "all") return true;
    if (f.applies === "english") return family === "english";
    if (f.applies === "maths") return family !== "english";
    return false;
}

/** The faults a scan of this subject is allowed to look for. */
export const faultsFor = (subject) =>
    FAULT_LIST.filter((f) => faultApplies(f, subject));

/* ── Reading a scan back ─────────────────────────────────────────────────── */

const str = (v) => String(v ?? "").trim();

/**
 * Where a finding points, if it points anywhere.
 *
 * EXACT STRING MATCH, and an unquotable finding keeps its row. `annotate.js`
 * settled this once: no fuzzy matching, because underlining the wrong six words
 * and saying they cost a mark sends a student to rewrite a sentence that was
 * fine, and it costs every later annotation its credibility.
 *
 * And the row survives the miss, which is the half `MarkModule` had to learn:
 * "does not name the transfer" is unquotable PRECISELY because the words are
 * absent, so the findings that most need explaining are the ones with nothing
 * to underline. Dropping them would delete the important half of the readout.
 */
export function anchorOf(quote, work) {
    const q = str(quote);
    if (!q) return null;
    const at = String(work || "").indexOf(q);
    if (at < 0) return null;
    return { quote: q, start: at, end: at + q.length };
}

/**
 * One finding, validated.
 *
 * Returns null for anything that cannot be drawn as a row a student can act on:
 * a fault class this build does not have, a fault that does not apply to this
 * subject, or a finding with nothing written in it. An empty row teaches that
 * the readout is padding.
 */
export function normaliseFinding(raw, { work = "", subject = null, index = 0 } = {}) {
    const id = str(raw?.fault).toLowerCase();
    if (!isFault(id)) return null;
    const fault = FAULTS[id];
    if (!faultApplies(fault, subject)) return null;
    const says = str(raw?.says);
    if (!says) return null;
    return {
        // Stable within a run, so clearing one cannot move another.
        key: `${id}:${index}`,
        fault: id,
        code: fault.code,
        label: fault.label,
        tool: fault.tool,
        rank: fault.rank,
        says,
        // What a full-mark version would have had. Optional: the scan is
        // allowed to locate a fault it cannot write the fix for, and saying
        // nothing beats inventing a model answer.
        wanted: str(raw?.wanted) || null,
        anchor: anchorOf(raw?.quote, work),
        cleared: false,
    };
}

/**
 * A whole scan, validated.
 *
 * `findings: []` IS A RESULT, not an error — see the header. The caller tells
 * the two apart on `ok`, never on the length.
 */
export function readScan(raw, { work = "", subject = null } = {}) {
    const rows = Array.isArray(raw?.findings) ? raw.findings : [];
    const findings = rows
        .map((r, i) => normaliseFinding(r, { work, subject, index: i }))
        .filter(Boolean)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, FINDINGS_MAX);
    return { ok: true, findings, scannedAt: new Date().toISOString() };
}

/**
 * The work, split into plain runs and underlined runs.
 *
 * ─── OVERLAPS ARE DROPPED, not merged or nested ─────────────────────────────
 * `annotate.js` settled this for the marking panel and the reasoning is the
 * same: two findings claiming overlapping spans cannot both underline, and the
 * resolutions all lie. Nesting says the inner phrase carries both faults, which
 * nobody asserted; merging invents a span neither finding named. The later one
 * loses its UNDERLINE and keeps its row, so nothing is hidden — it simply stops
 * pointing, which is what an unquotable finding does anyway.
 *
 * Ordered by position rather than by rank, because this is the TEXT: it reads
 * top to bottom whatever order the list beside it is in.
 */
export function markedSegments(work = "", findings = []) {
    const text = String(work || "");
    if (!text) return [];
    const spans = (findings || [])
        .filter((f) => f.anchor)
        .map((f) => ({ ...f.anchor, key: f.key, fault: f.fault, cleared: !!f.cleared }))
        .sort((a, b) => a.start - b.start || b.end - a.end);

    const kept = [];
    let reach = 0;
    for (const sp of spans) {
        if (sp.start < reach) continue;   // overlaps the one before it
        kept.push(sp);
        reach = sp.end;
    }

    const out = [];
    let at = 0;
    for (const sp of kept) {
        if (sp.start > at) out.push({ text: text.slice(at, sp.start) });
        out.push({ text: text.slice(sp.start, sp.end), key: sp.key, fault: sp.fault, cleared: sp.cleared });
        at = sp.end;
    }
    if (at < text.length) out.push({ text: text.slice(at) });
    return out;
}

/* ── Working through them ────────────────────────────────────────────────── */

/** Mark one cleared, or put it back. Immutable, so the trace re-renders. */
export function setCleared(findings = [], key, cleared = true) {
    return (findings || []).map((f) => (f.key === key ? { ...f, cleared: !!cleared } : f));
}

/**
 * Where the run is up to.
 *
 * `allClear` is true for a scan that found nothing AND for one whose findings
 * have all been cleared, because they are the same statement about the work.
 */
export function progressOf(findings = []) {
    const list = findings || [];
    const cleared = list.filter((f) => f.cleared).length;
    return {
        total: list.length,
        cleared,
        open: list.length - cleared,
        pct: list.length ? Math.round((cleared / list.length) * 100) : 100,
        allClear: cleared === list.length,
    };
}

/** The next thing to work on, or null when there is nothing left. */
export const nextOpen = (findings = []) =>
    (findings || []).find((f) => !f.cleared) || null;

/**
 * A re-scan may CLEAR and may KEEP. It may not ADD.
 *
 * This is what makes the all-clear reachable. Left to append, each pass finds
 * new or reshaped faults and the list never empties — the student works for an
 * hour and the readout is as red as when they started, which is worse than not
 * offering the re-scan at all.
 *
 * So the second pass is asked ONE question per open finding — is this still
 * true — and its answer may only move a finding from open to cleared. Already
 * cleared findings are not re-examined either: a student who fixed something
 * and said so is not told otherwise by a cheaper model on a later pass.
 */
export function applyRescan(findings = [], stillOpenIds = []) {
    const open = new Set((stillOpenIds || []).map((k) => String(k)));
    return (findings || []).map((f) =>
        f.cleared ? f : { ...f, cleared: !open.has(f.key) }
    );
}

/**
 * The opening message the repair tool is handed.
 *
 * It carries the WORK and the one finding, and nothing else. A repair prompt
 * that restated the whole readout would have the tool fixing six things in one
 * conversation, which is how a readout stops being a list of clearable items
 * and becomes another general chat about an essay.
 *
 * Like every other opening message in this app it is put in the COMPOSER and
 * not sent — the price is on screen before a chip is spent, which is
 * megaUpload's rule and the one the first-win run keeps too.
 */
export function repairSeed(finding, work = "") {
    if (!finding) return "";
    const f = FAULTS[finding.fault];
    const quote = finding.anchor?.quote
        ? `\n\nThe scan pointed at: "${finding.anchor.quote}"`
        : "";
    const wanted = finding.wanted ? `\nWhat would have scored: ${finding.wanted}` : "";
    return `A scan of my work flagged this as a ${f?.label || "fault"} problem.

What it said: ${finding.says}${wanted}${quote}

Here is the work:
"""
${String(work || "").slice(0, WORK_MAX)}
"""

Help me fix this ONE thing. Do not rewrite the whole answer.`;
}

/** What a re-scan is allowed to ask about. */
export const openKeys = (findings = []) =>
    (findings || []).filter((f) => !f.cleared).map((f) => f.key);

export default {
    FAULTS, FAULT_LIST, isFault, familyOf, faultApplies, faultsFor,
    anchorOf, normaliseFinding, readScan, markedSegments,
    setCleared, progressOf, nextOpen, applyRescan, openKeys, repairSeed,
    SCAN_FEATURE, SCAN_MODEL, SCAN_MODEL_LABEL, WORK_MAX, FINDINGS_MAX,
};
