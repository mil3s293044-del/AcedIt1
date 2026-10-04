/**
 * bench — the benches a student already has, reconstructed from their chats.
 *
 * ─── NOTHING IS STORED, AND THAT IS NOT A SAVING ────────────────────────────
 * A bench is a workpiece plus the steps run on it. Every step IS a conversation
 * and `UnifiedChat` already persists one, so a bench needs no row, no table and
 * no migration: `input_data.workpiece` rides on the step rows that already
 * save, and a bench is what you get by grouping them. Derived, so it cannot go
 * stale, double up, or disagree with the steps it is made of — the rule
 * `redoQueue`, `subjectHub` and `priceHistory` already keep.
 *
 * ─── EVERY SAVED CHAT IS A BENCH, INCLUDING THE ONES FROM BEFORE ────────────
 * There are months of conversations on this site that predate the workpiece
 * entirely. Leaving them to a history sidebar would strand them on the one
 * screen that was rebuilt around picking up work you had already started, so a
 * chat with no workpiece becomes a DRAFT: its first message is the thing on the
 * bench, and the one fact it is missing is what KIND of thing that is.
 *
 * ─── A DRAFT IS NOT A WORKPIECE, because the kind decides the tools ─────────
 * It is tempting to infer the kind from the tool that was used, and it does not
 * survive contact with the table: only `english_mentor` and `line_memoriser`
 * name a single kind, and every other tool applies to two, three or four. So an
 * inferred kind would be a guess on most rows, and a wrong one silently removes
 * the tool the student came for. The bench ASKS, once, which is the same
 * refusal `WorkPicker` makes about typed work and the same one `coverage` makes
 * about an unrecognised topic.
 */

import { titleFrom, workpieceKey } from "./workpiece.js";
import { labelForTool } from "./toolLabels.js";

/**
 * The tool a step was run with, in words.
 *
 * From `toolLabels.js` rather than `chatTools.js`, which carries icons and
 * React — this module is imported by the plain-node test loader and has to stay
 * resolvable without a bundler. That map also keeps the names of RETIRED tools,
 * so a coaching chat saved before the rebuild still says what it was instead of
 * reopening quietly labelled as the first tool in the list.
 */
const toolLabel = labelForTool;

/** How many benches the shelf offers. It is a shelf, not a history. */
export const BENCH_MAX = 4;

/**
 * The saved rows that are conversations.
 *
 * The SAME predicate `UnifiedChat`'s sidebar uses, exported rather than
 * restated, so the shelf and the sidebar cannot come to disagree about what
 * counts as a chat. A legacy single-shot tool result has no `messages` array
 * and is not one.
 */
export function chatRows(rows = []) {
    return (rows || []).filter(
        (r) => r && Array.isArray(r.input_data?.messages) && r.input_data.messages.length > 0
    );
}

/** The first thing the student actually said in a conversation. */
function firstAsk(row) {
    const msgs = row?.input_data?.messages || [];
    const first = msgs.find((m) => m?.role === "user" && String(m.content || "").trim());
    return String(first?.content || "").trim();
}

/**
 * A chat that predates the bench, as something to put on it.
 *
 * It REFUSES rather than opening empty: a conversation with no student message
 * in it has nothing to work on, so it is not offered. The key is the ROW ID —
 * not a hash of the body — because the kind is not known yet, and a key that
 * changed the moment the student named the kind would split one bench into two
 * halfway through.
 */
export function draftFromChat(row) {
    if (!row?.id) return null;
    const body = firstAsk(row);
    if (!body) return null;
    return {
        key: String(row.id),
        body,
        title: String(row.title || "").trim() || titleFrom(body),
        subject: row.subject_name || row.input_data?.subject || null,
        source: "chat",
        ref: null,
        files: row.input_data?.files || [],
    };
}

/** Which bench a saved conversation belongs to. */
export function benchKeyOf(row) {
    const wp = row?.input_data?.workpiece;
    if (wp?.key) return String(wp.key);
    // A workpiece saved before keys existed still groups, by the same hash
    // `makeWorkpiece` would have given it.
    if (wp?.kind && wp?.body) return workpieceKey(wp);
    return row?.id ? String(row.id) : null;
}

/** One step, off the conversation that is it. */
export function stepFromRow(row, workpiece) {
    // `input_data.operation` is on rows saved by the bench build and is read
    // only as a fallback label now — the scan names a step by its FINDING.
    const opLabel = labelForTool(row?.input_data?.tool || row?.tool_type);
    return {
        id: String(row.id),
        // The conversation this step IS. Opening the step reopens it rather
        // than starting a second thread about the same thing, which is the
        // whole reason a step is worth being a step.
        convId: String(row.id),
        conv: row,
        op: row?.input_data?.operation || null,
        tool: row.tool_type || row.input_data?.tool || null,
        title: String(row.title || "").trim() || opLabel || "Earlier",
        // WHICH TOOL IT WAS is the preview for a step that has no operation —
        // every adopted chat, which is most of what is on this site. The row
        // otherwise drew as a bare line with a glyph and nothing to read, and
        // the tool is the one fact about it the student can act on.
        preview: toolLabel(row.tool_type) || "",
        at: row.updated_date || row.created_date || null,
    };
}

const when = (r) => Date.parse(r?.created_date || r?.updated_date || "") || 0;

/**
 * The benches, newest work first.
 *
 * A bench carries EITHER a workpiece or a draft and never both: a stored
 * workpiece is a thing the bench already knows the kind of, and a draft is one
 * it does not. Steps are oldest first, because the bench reads as the order the
 * work was done in — explain, plan, draft, mark — which is the argument
 * `workpiece.js` opens with.
 */
export function benches(rows = [], { max = BENCH_MAX } = {}) {
    const groups = new Map();
    for (const row of chatRows(rows)) {
        const key = benchKeyOf(row);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }

    const out = [];
    for (const [key, group] of groups) {
        group.sort((a, b) => when(a) - when(b));
        // ANY row in the group that carries a workpiece carries the SAME one —
        // the kind and the body are both inside the key, so two rows with
        // different workpieces are two different benches by construction. What
        // this search is for is the ADOPTED case, where the first row is a chat
        // from before the bench existed and has none, and every step run since
        // does. Taking `group[0]` unconditionally would leave such a bench a
        // draft forever, asking for a kind the student had already given.
        const stored = group.find((r) => r.input_data?.workpiece?.kind)
            ?.input_data.workpiece || null;
        const draft = stored ? null : draftFromChat(group[0]);
        if (!stored && !draft) continue;
        const piece = stored || draft;
        out.push({
            key,
            workpiece: stored,
            draft,
            title: piece.title || titleFrom(piece.body || ""),
            subject: piece.subject || null,
            steps: group.map((r) => stepFromRow(r, stored)),
            at: group[group.length - 1].updated_date || group[group.length - 1].created_date || null,
        });
    }

    out.sort((a, b) => (Date.parse(b.at || "") || 0) - (Date.parse(a.at || "") || 0));
    return out.slice(0, max);
}

export default { benches, chatRows, draftFromChat, benchKeyOf, stepFromRow, BENCH_MAX };
