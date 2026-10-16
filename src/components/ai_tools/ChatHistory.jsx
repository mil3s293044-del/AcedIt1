/**
 * ChatHistory — the conversations a student can carry on, by when.
 *
 * ─── IT WAS FOLDERED BY TOOL ────────────────────────────────────────────────
 * Six chats in six tools drew six uppercase headings over six rows, each with a
 * count of "1", and the newest conversation sat wherever its tool fell in the
 * catalogue. What a student remembers about a chat they want back is WHEN, and
 * roughly what it was about — the tool is a glyph on the row, which is all the
 * room it needs. `historyGroups` buckets on local days.
 *
 * ─── DELETE ASKS ONCE, AND A PHONE CAN REACH IT ─────────────────────────────
 * The trash button was `opacity-0` until hover, so on a phone it did not exist,
 * and on a laptop one click deleted a conversation outright. It is visible on
 * any device without hover, faded until hover on one with it, and the first
 * press turns it into "Delete?" — a second press is the delete. A slip of the
 * cursor down a list of rows is the commonest way to lose one.
 *
 * The search box is shown whenever there is history to search: a box over an
 * empty rail is a control with nothing to do.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Plus, Search, Trash2 } from "lucide-react";
import { historyGroups } from "@/lib/chatModel";
import { toneForTool } from "@/lib/toolLabels";
import { fmtDate } from "@/lib/safeDate";
import { CHAT_TOOLS, toolById } from "./chatTools";

/** What sits under a title: the day for anything older than yesterday, then the subject. */
function metaFor(item, groupId) {
    const parts = [];
    if (item.at != null && groupId === "week") parts.push(fmtDate(new Date(item.at), "EEEE", ""));
    if (item.at != null && groupId === "earlier") parts.push(fmtDate(new Date(item.at), "d MMM", ""));
    if (item.subject) parts.push(item.subject);
    if (!parts.length && item.toolLabel) parts.push(item.toolLabel);
    return parts.filter(Boolean).join(" · ");
}

export default function ChatHistory({ rows = [], activeId = null, onOpen, onDelete, onNew, now }) {
    const [query, setQuery] = useState("");
    const [confirming, setConfirming] = useState(null);

    // A "Delete?" left armed is a trap for the next click, so it disarms itself.
    useEffect(() => {
        if (!confirming) return undefined;
        const t = setTimeout(() => setConfirming(null), 3500);
        return () => clearTimeout(t);
    }, [confirming]);

    const groups = useMemo(() => historyGroups(rows, { now: now || new Date(), query }), [rows, query, now]);
    const hasHistory = useMemo(() => historyGroups(rows, { now: now || new Date() }).length > 0, [rows, now]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="space-y-2 p-3 pb-1">
                <button
                    type="button"
                    onClick={onNew}
                    className="flex w-full items-center gap-2 rounded-xl border border-[var(--console-line)]
                        bg-[var(--console-panel)] px-3 py-2 text-[13px] font-bold text-[var(--console-ink)]
                        transition-colors hover:border-[rgb(var(--console-accent-rgb)/0.55)]"
                >
                    <Plus className="h-4 w-4 text-[var(--console-accent-ink)]" aria-hidden="true" />
                    New chat
                </button>
                {hasHistory && (
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2
                            text-[var(--console-ink-faint)]" aria-hidden="true" />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search your chats"
                            aria-label="Search your chats"
                            className="w-full rounded-lg border border-[var(--console-line)] bg-[var(--console-panel-2)]
                                py-1.5 pl-8 pr-2 text-xs text-[var(--console-ink)]
                                placeholder:text-[var(--console-ink-faint)]
                                focus:border-[var(--console-accent-ink)] focus:outline-none"
                        />
                    </div>
                )}
            </div>

            <nav aria-label="Your chats" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {!hasHistory && (
                    <p className="px-3 py-6 text-center text-xs leading-relaxed text-[var(--console-ink-faint)]">
                        Your chats save here as you go, so you can pick any of them back up.
                    </p>
                )}
                {hasHistory && groups.length === 0 && (
                    <p className="px-3 py-6 text-center text-xs text-[var(--console-ink-faint)]">
                        Nothing matches &ldquo;{query.trim()}&rdquo;.
                    </p>
                )}
                {groups.map((g) => (
                    <section key={g.id} aria-label={g.label}>
                        <h3 className="px-2 pb-1 pt-3 text-[11px] font-bold text-[var(--console-ink-faint)]">{g.label}</h3>
                        {g.items.map((item) => {
                            const active = String(item.id) === String(activeId);
                            const live = CHAT_TOOLS.some((t) => t.id === item.tool);
                            const Icon = live ? toolById(item.tool).icon : null;
                            const tone = toneForTool(item.tool);
                            const armed = confirming === item.id;
                            return (
                                <div
                                    key={item.id}
                                    className={`group relative flex items-center gap-1 rounded-lg transition-colors
                                        ${active ? "bg-[var(--console-panel-2)]" : "hover:bg-[var(--console-panel-2)]"}`}
                                >
                                    {active && (
                                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[var(--console-accent)]" aria-hidden="true" />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => onOpen?.(item.row)}
                                        aria-current={active ? "true" : undefined}
                                        className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-2.5 text-left"
                                    >
                                        {Icon
                                            ? <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${tone.ink}`} aria-hidden="true" />
                                            : <span className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />}
                                        <span className="min-w-0">
                                            <span className="block truncate text-[13px] font-semibold text-[var(--console-ink)]">
                                                {item.title}
                                            </span>
                                            <span className="block truncate text-[11px] text-[var(--console-ink-faint)]">
                                                {metaFor(item, g.id)}
                                            </span>
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (armed) { setConfirming(null); onDelete?.(item.row); }
                                            else setConfirming(item.id);
                                        }}
                                        aria-label={armed ? "Confirm delete" : `Delete “${item.title}”`}
                                        className={`mr-1 flex h-7 flex-shrink-0 items-center justify-center rounded-md transition-all
                                            ${armed
                                                ? "bg-streak/15 px-2 text-[11px] font-bold text-streak"
                                                : `w-7 text-[var(--console-ink-faint)] hover:bg-streak/10 hover:text-streak
                                                   [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100`}`}
                                    >
                                        {armed ? "Delete?" : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                                    </button>
                                </div>
                            );
                        })}
                    </section>
                ))}
            </nav>

            <div className="border-t border-[var(--console-line)] p-2">
                <Link
                    to="/AIToolsHistory"
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold text-[var(--console-ink-faint)]
                        transition-colors hover:bg-[var(--console-panel-2)] hover:text-[var(--console-ink)]"
                >
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" /> Saved results
                </Link>
            </div>
        </div>
    );
}
