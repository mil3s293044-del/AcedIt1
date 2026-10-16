/**
 * ToolPalette — the one place a tool is chosen.
 *
 * ─── THREE PICKERS FOR ONE CHOICE WAS TWO TOO MANY ──────────────────────────
 * The chat offered a dropdown in the composer, twelve rows in the welcome and a
 * big icon at the top naming the current tool. Three controls for one fact,
 * and the dropdown was the worst of them: twelve names in a flat list, no
 * blurb, no grouping, and it went DISABLED the moment a conversation started,
 * so the only way to use a different tool was to find "New chat" first.
 *
 * This is the replacement, and it is reached two ways that are the same panel:
 * the tool chip in the composer, and typing `/` at the start of a message —
 * which is how anybody who has used Slack or Notion already expects to switch
 * modes without lifting their hands. In slash mode the composer IS the search
 * box, so the palette draws none of its own and the parent forwards the arrow
 * keys through `handleKey`.
 *
 * ─── GROUPED BY WHEN, UNTIL YOU TYPE ────────────────────────────────────────
 * With no search it is the welcome's map — the four phases in order — because a
 * student who does not know what "Precision Pass" means can still place
 * themselves on "after you write". Once they type it is one ranked list, names
 * first (`filterTools`), because somebody typing already knows roughly what
 * they want and a grouping would push the match down the screen.
 *
 * ─── PICKING A TOOL MID-CHAT STARTS A NEW ONE, AND SAYS SO FIRST ────────────
 * A conversation belongs to one tool — its prompt, its format signature and its
 * history are that tool's — so switching cannot re-point the thread on screen.
 * The old dropdown refused with a toast after the fact. The palette states the
 * consequence above the list, before the choice is made.
 *
 * ─── IT IS NOT PORTALLED ────────────────────────────────────────────────────
 * The room's tokens are declared on `.console` and inherit DOWN the tree; a
 * Radix popover portals to `<body>`, outside the room, where every
 * `--console-*` is blank. It is positioned against the composer instead, which
 * is also what lets it sit exactly as wide as the box it belongs to.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { filterTools } from "@/lib/chatModel";
import { toolsByPhase, toneForTool } from "@/lib/toolLabels";

const ToolPalette = forwardRef(function ToolPalette({
    tools = [],
    activeId = null,
    // A string in slash mode, where the composer is the search box. `null`
    // means the palette owns its own search input.
    query = null,
    placement = "up",
    note = "",
    anchorRef = null,
    onPick,
    onClose,
}, ref) {
    const ownSearch = query == null;
    const [typed, setTyped] = useState("");
    const q = ownSearch ? typed : query;

    // Grouped while nothing is typed; one ranked list once something is.
    const bands = useMemo(() => (q.trim() ? null : toolsByPhase(tools)), [q, tools]);
    const flat = useMemo(
        () => (bands ? bands.flatMap((b) => b.tools) : filterTools(tools, q)),
        [bands, tools, q],
    );

    // Opens on the CURRENT tool, so Enter on an untouched palette is a no-op
    // rather than a switch to whatever happens to be first.
    const [active, setActive] = useState(() => Math.max(0, flat.findIndex((t) => t.id === activeId)));
    useEffect(() => {
        // A new search starts at its best match.
        if (q.trim()) setActive(0);
    }, [q]);
    useEffect(() => {
        if (active > flat.length - 1) setActive(Math.max(0, flat.length - 1));
    }, [flat.length, active]);

    const rowRefs = useRef([]);
    useEffect(() => {
        rowRefs.current[active]?.scrollIntoView?.({ block: "nearest" });
    }, [active]);

    const rootRef = useRef(null);
    // Outside a click closes it. The composer is not "outside": in slash mode
    // the student is typing into it, and the tool chip toggles on its own.
    useEffect(() => {
        const down = (e) => {
            if (rootRef.current?.contains(e.target)) return;
            if (anchorRef?.current?.contains(e.target)) return;
            onClose?.();
        };
        document.addEventListener("mousedown", down);
        document.addEventListener("touchstart", down, { passive: true });
        return () => {
            document.removeEventListener("mousedown", down);
            document.removeEventListener("touchstart", down);
        };
    }, [anchorRef, onClose]);

    /** True when the key was the palette's. */
    const handleKey = (e) => {
        if (e.key === "ArrowDown") { setActive((i) => (flat.length ? (i + 1) % flat.length : 0)); return true; }
        if (e.key === "ArrowUp") { setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0)); return true; }
        if (e.key === "Enter" || e.key === "Tab") {
            const t = flat[active];
            if (t) onPick?.(t.id);
            return true;
        }
        if (e.key === "Escape") { onClose?.(); return true; }
        return false;
    };
    useImperativeHandle(ref, () => ({ handleKey }));

    const row = (t, i) => {
        const tone = toneForTool(t.id);
        const Icon = t.icon;
        const on = i === active;
        return (
            <button
                key={t.id}
                ref={(el) => { rowRefs.current[i] = el; }}
                type="button"
                role="option"
                aria-selected={on}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick?.(t.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors
                    ${on ? "bg-[var(--console-panel-2)]" : ""}`}
            >
                {Icon && <Icon className={`h-4 w-4 flex-shrink-0 ${tone.ink}`} aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold leading-tight text-[var(--console-ink)]">{t.label}</span>
                    <span className="block truncate text-[11.5px] leading-snug text-[var(--console-ink-dim)]">{t.blurb}</span>
                </span>
                {t.id === activeId && (
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-[var(--console-accent-ink)]" aria-label="Current tool" />
                )}
            </button>
        );
    };

    let index = -1;
    return (
        <div
            ref={rootRef}
            className={`absolute left-0 right-0 z-30 overflow-hidden rounded-2xl border border-[var(--console-line)]
                bg-[var(--console-panel)] shadow-soft-lg
                ${placement === "up" ? "bottom-full mb-2" : "top-full mt-2"}`}
        >
            {ownSearch && (
                <div className="flex items-center gap-2 border-b border-[var(--console-line-soft)] px-3">
                    <Search className="h-4 w-4 flex-shrink-0 text-[var(--console-ink-faint)]" aria-hidden="true" />
                    <input
                        autoFocus
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        onKeyDown={(e) => { if (handleKey(e)) e.preventDefault(); }}
                        placeholder="Find a tool"
                        aria-label="Find a tool"
                        className="h-11 w-full bg-transparent text-sm text-[var(--console-ink)]
                            placeholder:text-[var(--console-ink-faint)] focus:outline-none"
                    />
                </div>
            )}
            {note && (
                <p className="px-3.5 pt-2.5 text-[11.5px] leading-snug text-[var(--console-ink-dim)]">{note}</p>
            )}
            <div role="listbox" aria-label="Tools" className="max-h-[min(22rem,52vh)] overflow-y-auto p-1.5">
                {flat.length === 0 && (
                    <p className="px-3 py-6 text-center text-xs text-[var(--console-ink-faint)]">
                        No tool matches &ldquo;{q.trim()}&rdquo;.
                    </p>
                )}
                {bands
                    ? bands.map((band) => (
                        <div key={band.id} className="pb-1">
                            <p className={`px-2.5 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.1em] ${band.ink}`}>
                                {band.label}
                            </p>
                            {band.tools.map((t) => { index += 1; return row(t, index); })}
                        </div>
                    ))
                    : flat.map((t, i) => row(t, i))}
            </div>
            {/* The keys are printed on a keyboard device only; on a phone they
                describe something nobody can press. */}
            <div className="hidden sm:flex items-center gap-3 border-t border-[var(--console-line-soft)] px-3.5 py-2
                text-[10.5px] text-[var(--console-ink-faint)]">
                <span><kbd className="font-sans font-bold">↑↓</kbd> choose</span>
                <span><kbd className="font-sans font-bold">Enter</kbd> open</span>
                <span><kbd className="font-sans font-bold">Esc</kbd> close</span>
            </div>
        </div>
    );
});

export default ToolPalette;
