/**
 * ForChip — "For Chem · Unit 3 SAC 1", on anything a student owns.
 *
 * One chip on every surface that can be tagged: the deck on the shelf, the
 * quiz pack, a banked mistake, a saved answer, a mind map, a chat. Tapping it
 * lists the SACs still coming (this subject's first) with a tick beside the
 * ones it is already for; a tick is the tag, written to the SAC's own row.
 *
 * ─── IT IS NOT DRAWN WHEN THERE IS NOTHING TO TAG FOR ───────────────────────
 * A student with no SAC on the planner would get a chip that opens an empty
 * list, which is a control over nothing. The planner is where a SAC is made,
 * and that is said where a SAC is the subject: in Revision.
 *
 * ─── PORTALLED, EXCEPT IN THE CONSOLE ───────────────────────────────────────
 * The rows a chip sits in clip their overflow, so the list goes to the body,
 * placed from the chip's rect. The chat is the exception: it draws in the
 * console room, whose palette is scoped to `.console`, and a list portalled
 * out of it would lose every token. `ink` is a NAMED preset, the AceShuffle
 * rule: the chip and the list are one decision, and splitting their colours
 * across props is how half of it gets made.
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Tag, Check } from "lucide-react";
import { chipLabel, tagLabel } from "@/lib/sacTags";
import { useToast } from "@/components/ui/use-toast";

const INKS = {
    app: {
        off: "border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
        on: "border border-transparent bg-secondary text-foreground hover:bg-secondary/70",
        glyphOn: "text-primary",
        panel: "border border-border bg-surface shadow-xl",
        row: "hover:bg-secondary",
        head: "text-muted-foreground",
        title: "text-foreground",
        meta: "text-muted-foreground",
        boxOn: "bg-primary border-primary text-primary-foreground",
        boxOff: "border-border",
        rule: "border-border",
    },
    console: {
        off: "border border-dashed border-[var(--console-line)] text-[var(--console-ink-dim)] hover:text-[var(--console-ink)]",
        on: "border border-transparent bg-[var(--console-panel-2)] text-[var(--console-ink)]",
        glyphOn: "text-[var(--console-accent-ink)]",
        panel: "border border-[var(--console-line)] bg-[var(--console-panel)] shadow-xl",
        row: "hover:bg-[var(--console-panel-2)]",
        head: "text-[var(--console-ink-faint)]",
        title: "text-[var(--console-ink)]",
        meta: "text-[var(--console-ink-dim)]",
        boxOn: "bg-[var(--console-accent)] border-[var(--console-accent)] text-[var(--console-on-accent)]",
        boxOff: "border-[var(--console-line)]",
        rule: "border-[var(--console-line-soft)]",
    },
};

/** When a SAC is, in the words a student uses. */
export function whenLabel(folder) {
    const d = folder?.daysAway;
    if (d == null) return "";
    if (d < 0) return "finished";
    if (d === 0) return "today";
    if (d === 1) return "tomorrow";
    return `in ${d} days`;
}

/**
 * Open, close on a tap elsewhere or Escape, and open upward when there is no
 * room below. The rect is measured on open and again as the page scrolls, for a
 * list that is portalled.
 */
function useMenu() {
    const [open, setOpen] = useState(false);
    const [up, setUp] = useState(false);
    const [rect, setRect] = useState(null);
    const box = useRef(null);
    const list = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const inside = (t) => (box.current && box.current.contains(t)) || (list.current && list.current.contains(t));
        const away = (e) => { if (!inside(e.target)) setOpen(false); };
        const esc = (e) => { if (e.key === "Escape") setOpen(false); };
        // A portalled list is placed from a rect, so when the page moves the
        // list FOLLOWS the chip — closing on any scroll shut it the instant it
        // opened, because the tap that opens a chip near the fold also scrolls
        // it into view. It closes only once the chip has left the screen.
        let raf = 0;
        const scrolled = (e) => {
            if (list.current && list.current.contains(e.target)) return;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const r = box.current?.getBoundingClientRect();
                if (!r || r.bottom < 0 || r.top > window.innerHeight) { setOpen(false); return; }
                setRect({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
            });
        };
        document.addEventListener("pointerdown", away);
        document.addEventListener("keydown", esc);
        window.addEventListener("scroll", scrolled, true);
        window.addEventListener("resize", scrolled);
        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener("pointerdown", away);
            document.removeEventListener("keydown", esc);
            window.removeEventListener("scroll", scrolled, true);
            window.removeEventListener("resize", scrolled);
        };
    }, [open]);
    const flip = () => {
        if (!open && box.current) {
            const r = box.current.getBoundingClientRect();
            setUp(window.innerHeight - r.bottom < 300 && r.top > 300);
            setRect({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
        }
        setOpen((v) => !v);
    };
    return { open, up, rect, box, list, flip, close: () => setOpen(false) };
}

/**
 * The list a chip opens: a heading, one row per SAC with its tick, and a footnote.
 *
 * PORTALLED unless the ink is a scoped room's. A mistake's row and a saved
 * answer's both clip their overflow (they animate open by height), so a list
 * placed inside them was cut off at the row's edge. Portalled, it is placed
 * `fixed` from the chip's measured rect. The console keeps it IN PLACE,
 * because its palette is scoped to `.console` and a list under the body would
 * lose every token.
 */
function Menu({ menu, I, align, title, items, isOn, onPick, footer, single = false, portal = true }) {
    const reduce = useReducedMotion();
    const W = 288;
    const place = portal && menu.rect ? {
        position: "fixed",
        width: W,
        left: Math.max(8, Math.min(align === "right" ? menu.rect.right - W : menu.rect.left, window.innerWidth - W - 8)),
        ...(menu.up ? { bottom: window.innerHeight - menu.rect.top + 6 } : { top: menu.rect.bottom + 6 }),
    } : undefined;
    const body = (
        <AnimatePresence>
            {menu.open && (
                <motion.div ref={menu.list} role="listbox" aria-multiselectable={single ? undefined : "true"}
                    initial={reduce ? false : { opacity: 0, y: menu.up ? 4 : -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: menu.up ? 4 : -4, scale: 0.98 }}
                    transition={{ duration: 0.14 }}
                    style={place}
                    className={`rounded-2xl p-1.5 ${I.panel} ${place
                        ? "z-[70] max-w-[calc(100vw-1rem)]"
                        : `absolute z-50 w-72 max-w-[calc(100vw-2rem)] ${menu.up ? "bottom-full mb-1.5" : "top-full mt-1.5"} ${align === "right" ? "right-0" : "left-0"}`}`}>
                    <p className={`px-2.5 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider ${I.head}`}>{title}</p>
                    <ul className="max-h-64 overflow-y-auto">
                        {items.map((f) => {
                            const ticked = isOn(f);
                            return (
                                <li key={f.key}>
                                    <button type="button" role="option" aria-selected={ticked}
                                        onClick={() => onPick(f)} data-for-option={f.key}
                                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors ${I.row}`}>
                                        <span className={`w-4 h-4 border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                            ${single ? "rounded-full" : "rounded-[5px]"} ${ticked ? I.boxOn : I.boxOff}`}>
                                            {ticked && <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className={`block text-xs font-bold truncate ${I.title}`}>{f.label ?? tagLabel(f)}</span>
                                            {f.kind === "sac" && <span className={`block text-[11px] ${I.meta}`}>{whenLabel(f)}</span>}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {footer && (
                        <p className={`mt-1 border-t px-2.5 pt-2 pb-1 text-[11px] leading-snug ${I.rule} ${I.meta}`}>{footer}</p>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
    return portal && typeof document !== "undefined" ? createPortal(body, document.body) : body;
}

export default function ForChip({ tags, kind, id, subject, ink = "app", align = "left", compact = false, className = "" }) {
    const I = INKS[ink] || INKS.app;
    const { toast } = useToast();
    const menu = useMenu();

    if (!tags?.ready || id == null || id === "") return null;
    const targets = tags.targets({ subject, kind, id });
    if (!targets.length) return null;
    const mine = tags.claimedBy(kind, id);
    const on = new Set(mine.map((f) => f.key));
    const label = chipLabel(mine);

    const toggle = async (folder) => {
        const next = !on.has(folder.key);
        try {
            await tags.toggle(folder.key, kind, id, next);
        } catch {
            toast({ title: "That tag did not save", description: "Try it again in a moment.", variant: "destructive" });
        }
    };

    return (
        <div ref={menu.box} className={`relative inline-flex ${className}`} onClick={(e) => e.stopPropagation()}>
            {compact ? (
                // The pack's gutter: three 28px buttons already share 176px, so
                // here the tag is a fourth button of the same size, filled when
                // set. The SAC's name is in its label and in the list it opens.
                <button type="button" onClick={menu.flip} aria-expanded={menu.open} aria-haspopup="listbox"
                    data-for-chip={kind}
                    aria-label={label ? `For ${label}` : "Tag for a SAC"} title={label ? `For ${label}` : "Tag for a SAC"}
                    className={`w-7 h-7 grid place-items-center rounded-lg border cursor-pointer transition-colors
                        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring
                        ${label ? "bg-primary/15 border-primary/40 text-primary" : "bg-surface/90 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                    <Tag className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
            ) : (
                <button type="button" onClick={menu.flip} aria-expanded={menu.open} aria-haspopup="listbox"
                    data-for-chip={kind}
                    className={`inline-flex items-center gap-1.5 h-7 max-w-[15rem] px-2.5 rounded-full text-[11px] font-bold transition-colors ${label ? I.on : I.off}`}>
                    <Tag className={`w-3 h-3 flex-shrink-0 ${label ? I.glyphOn : ""}`} aria-hidden="true" />
                    <span className="truncate">{label ? `For ${label}` : "Tag for a SAC"}</span>
                </button>
            )}
            <Menu menu={menu} I={I} align={align} title="For which SAC" items={targets} portal={ink !== "console"}
                isOn={(f) => on.has(f.key)} onPick={toggle}
                footer="Anything tagged shows up in that SAC's folder in Revision." />
        </div>
    );
}

/**
 * "Studying for Chem · Unit 3 SAC 1" — what the time logged on the Study page
 * is FOR, set once for the sitting. ONE SAC or none, because a session is one
 * sitting: stamping it for two SACs would count the same minutes twice.
 *
 * Every session saved while it is set carries the stamp (`withStamp`), which
 * is how a pomodoro, a blurt or a recall session reaches a SAC's run-up.
 */
export function FocusChip({ tags, value, onChange, align = "right", className = "" }) {
    const I = INKS.app;
    const menu = useMenu();
    if (!tags?.ready) return null;
    const sacs = tags.folders?.sacs || [];
    if (!sacs.length) return null;
    const current = sacs.find((f) => f.key === value) || null;
    const NONE = { key: "__none__", label: "Nothing in particular", kind: "none" };
    return (
        <div ref={menu.box} className={`relative inline-flex ${className}`}>
            <button type="button" onClick={menu.flip} aria-expanded={menu.open} aria-haspopup="listbox"
                data-study-for={current ? current.key : ""}
                className={`inline-flex items-center gap-1.5 h-7 max-w-[16rem] px-2.5 rounded-full text-[11px] font-bold transition-colors ${current ? I.on : I.off}`}>
                <Tag className={`w-3 h-3 flex-shrink-0 ${current ? I.glyphOn : ""}`} aria-hidden="true" />
                <span className="truncate">{current ? `Studying for ${tagLabel(current)}` : "What is this for?"}</span>
            </button>
            <Menu menu={menu} I={I} align={align} title="Studying for" single
                items={[...sacs, NONE]}
                isOn={(f) => (f.key === NONE.key ? !current : f.key === value)}
                onPick={(f) => { onChange(f.key === NONE.key ? null : f.key); menu.close(); }}
                footer="Sessions you finish while this is set count toward that SAC's run-up." />
        </div>
    );
}

/**
 * "Tagged for Chem · Unit 3 SAC 1", on a screen reached from inside a SAC's
 * folder (`?for=`). What the student is about to make will be tagged for that
 * SAC, and the line says so BEFORE it happens, with a way out — a tag nobody
 * saw being applied is the guess this feature refuses everywhere else.
 */
export function ForNote({ tags, forKey, onClear, ink = "app", what = "Tagged for", className = "" }) {
    const I = INKS[ink] || INKS.app;
    if (!forKey || !tags?.ready) return null;
    const folder = (tags.folders?.all || []).find((f) => f.key === forKey);
    if (!folder) return null;
    return (
        <p className={`flex items-center gap-1.5 text-xs ${I.meta} ${className}`} data-for-note>
            <Tag className={`w-3 h-3 flex-shrink-0 ${I.glyphOn}`} aria-hidden="true" />
            <span className="min-w-0 truncate">
                {what} <span className={`font-bold ${I.title}`}>{tagLabel(folder)}</span>
            </span>
            {onClear && (
                <button type="button" onClick={onClear}
                    className={`ml-1 flex-shrink-0 font-bold underline underline-offset-2 ${I.meta}`}>
                    Remove
                </button>
            )}
        </p>
    );
}
