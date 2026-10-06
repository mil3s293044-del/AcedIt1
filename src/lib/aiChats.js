/**
 * aiChats — the student's own AI conversations, as a list they can pick up.
 *
 * ─── ONE PREDICATE FOR "IS THIS A CHAT" ─────────────────────────────────────
 * Saved results are a mixed table: a chat row carries a `messages` array, and a
 * legacy single-shot tool result (a cheat sheet, a set of generated questions)
 * does not. The dashboard's Recent list and `UnifiedChat`'s own sidebar both
 * need that test, and two copies would let one screen show a student something
 * the other says they do not have — on two lists of the same rows. This is the
 * copy; both import it.
 *
 * ─── NOTHING IS STORED ──────────────────────────────────────────────────────
 * Every conversation already persists through `saveResult`, so "recent" is a
 * read of rows that exist rather than a second table of pointers at them. The
 * rule `redoQueue`, `subjectHub` and `priceHistory` already keep: derived, so
 * it cannot go stale or disagree with what it is made of.
 */

import { labelForTool } from "./toolLabels.js";

/** How many conversations the dashboard offers. It is a shelf, not a history. */
export const RECENT_MAX = 4;

/**
 * The saved rows that are conversations.
 *
 * A row whose `messages` array is empty is NOT one: a chat that was opened and
 * never sent has nothing to reopen, and offering it puts a dead row at the top
 * of the one list whose whole promise is picking work back up.
 */
export function chatRows(rows = []) {
    return (rows || []).filter(
        (r) => r && Array.isArray(r.input_data?.messages) && r.input_data.messages.length > 0
    );
}

/** The first thing the student actually said. */
function firstAsk(row) {
    const msgs = row?.input_data?.messages || [];
    const first = msgs.find((m) => m?.role === "user" && String(m.content || "").trim());
    return String(first?.content || "").trim();
}

/** How long a fallback title may run before it is cut. */
const TITLE_MAX = 64;

/**
 * The ask, short enough to be a title.
 *
 * CUT ON A WORD, NEVER MID-WORD. A hard slice produced "…can you walk me t",
 * which reads as a rendering fault rather than as an abbreviation — the same
 * complaint the mistake bank's clipped questions drew, one surface along. The
 * ellipsis is what says it was cut; without it a sentence simply stops.
 */
function clipTitle(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (t.length <= TITLE_MAX) return t;
    const cut = t.slice(0, TITLE_MAX);
    const space = cut.lastIndexOf(" ");
    // A single word longer than the limit has no space to cut at, so it is cut
    // where it stands rather than returned whole.
    return `${(space > TITLE_MAX * 0.5 ? cut.slice(0, space) : cut).replace(/[,;:.\s]+$/, "")}\u2026`;
}

/** When a row was last touched, as a number, or null. */
function timeOf(row) {
    const raw = row?.updated_date || row?.created_date || row?.savedAt || null;
    if (!raw) return null;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : null;
}

/**
 * The conversations worth offering, newest first.
 *
 * ─── A ROW WITH NO TIMESTAMP SORTS LAST, IT IS NOT DROPPED ──────────────────
 * `Number(null)` is 0, which is 1970 — coerced, an undated local-storage row
 * would sort to the bottom silently, and taking the other branch and dropping
 * it loses a real conversation over a missing field. It is kept and ordered
 * after everything dated, which is the `expiredKeys` rule pointed at a list
 * rather than at a delete.
 *
 * The PREVIEW is what the student asked, never the model's reply: the row is a
 * way back to a thing they were working on, and their own words are what they
 * will recognise. The title is used when there is one, because `saveResult`
 * writes a real one and it is shorter than the ask.
 */
export function recentChats(rows = [], max = RECENT_MAX) {
    const items = [];
    for (const row of chatRows(rows)) {
        if (!row.id) continue;
        const ask = firstAsk(row);
        if (!ask) continue;
        items.push({
            id: String(row.id),
            row,
            title: clipTitle(row.title || ask),
            ask,
            tool: row.tool_type || row.input_data?.tool || null,
            toolLabel: labelForTool(row.tool_type || row.input_data?.tool),
            subject: row.subject_name || row.input_data?.subject || null,
            turns: (row.input_data?.messages || []).filter((m) => m?.role === "user").length,
            at: timeOf(row),
        });
    }
    items.sort((a, b) => {
        if (a.at == null && b.at == null) return 0;
        if (a.at == null) return 1;
        if (b.at == null) return -1;
        return b.at - a.at;
    });
    return items.slice(0, Math.max(0, max));
}

/**
 * How much each tool has actually been used, off the rows already loaded.
 *
 * ─── A CATALOGUE OF TWELVE IDENTICAL ENTRIES IS WHAT READS AS GENERATED ─────
 * The toolkit was twelve cards carrying a name and a blurb and nothing else —
 * the same shape whoever you are, which is exactly what a machine-made layout
 * looks like. Every saved conversation already names its tool, so "4 chats ·
 * 2 Oct" is a real fact about THEM, counted rather than fetched, on the page
 * whose own rule is that every line should be checkable.
 *
 * ─── A TOOL NEVER OPENED RETURNS NOTHING, NEVER ZERO ────────────────────────
 * `studyQueue`'s rule: a list that reaches a respectable length by printing
 * "0 chats" teaches a student that the numbers here are decoration. An absent
 * key is the honest answer and the row simply draws nothing.
 *
 * It reads through `chatRows`, so a thread opened and never sent does not count
 * — the same predicate the Recent list and the chat's own sidebar read. And it
 * is UNCAPPED, unlike `recentChats`: the four most recent are a list, this is a
 * tally, and counting off a capped list would report four as the most anybody
 * has ever used anything.
 */
export function toolUsage(rows = []) {
    const out = {};
    // `chatRows` hands back the RAW rows it kept rather than shaped items — the
    // first draft read `r.tool` and `r.at` off them and tallied nothing at all,
    // silently, because an absent key is indistinguishable from a tool nobody
    // has opened. It is the SAME derivation `recentChats` does, including the
    // "no student message is not a conversation" rule, or the tally and the
    // list beneath it would disagree about one table.
    for (const row of chatRows(rows)) {
        const msgs = row.input_data?.messages || [];
        if (!msgs.some((m) => m?.role === "user" && String(m.content || "").trim())) continue;
        const id = String(row.tool_type || row.input_data?.tool || "");
        if (!id) continue;
        const seen = out[id] || (out[id] = { count: 0, at: 0 });
        seen.count += 1;
        const at = timeOf(row);
        if (at && at > seen.at) seen.at = at;
    }
    return out;
}

export default { chatRows, recentChats, toolUsage, RECENT_MAX };
