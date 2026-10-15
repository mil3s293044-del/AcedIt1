/**
 * BirthdayPicker — a birthday in three taps: the day, the month, the year.
 *
 * ─── THE BROWSER'S PICKER OPENS ON THIS MONTH ───────────────────────────────
 * On the second screen of the signup wizard a sixteen-year-old met the native
 * date input, which on a desktop opens on October 2026 and has to be paged
 * back two hundred times, or typed into in an order the placeholder does not
 * show. It was the only control in the funnel the app had not designed, at the
 * point where a first impression is still being formed. `datePick.js`'s header
 * has the rest of the reasoning.
 *
 * ─── THREE SLOTS, ONE OPEN AT A TIME ────────────────────────────────────────
 * Day · Month · Year, in the order an Australian writes them, each a tile that
 * shows its answer at display size. The open one has a grid under it; picking
 * moves to the next empty slot, so a student who just taps is done in three.
 * Tapping a filled slot reopens it — nothing has to be cleared first.
 *
 * THE YEAR IS THE SLOW ONE, so its first page is the years a student can
 * plausibly have been born in (twelve to twenty-one years back) and older
 * years are a page back, not a scroll through a century.
 *
 * ─── "31 FEBRUARY" IS SAID, NOT SWALLOWED ───────────────────────────────────
 * A day and a month picked separately can disagree. The day slot goes red, the
 * reason is printed, and the day grid reopens with the real count of days —
 * a picker that quietly refuses a pair looks broken. Nothing is reported
 * upward until the three make a real date (`composeIso`), so the age rules
 * downstream only ever see a complete answer or none.
 *
 * ─── IT IS THE APP'S CONTROL, ON THE APP'S TOKENS ──────────────────────────
 * It sits in the wizard and in `AgeGate`, both of which follow the theme, so
 * every ink here is a token. The open slot is marked by one ring that SLIDES
 * between tiles (`layoutId`), the tab-pill idiom Progress uses, so the eye
 * follows the question rather than hunting for it.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import {
    MONTHS, MONTHS_SHORT, daysInMonth, composeIso, splitIso, partsProblem,
    yearPage, pageFor, longLabel,
} from "@/lib/datePick";

const ORDER = ["day", "month", "year"];
const EASE = [0.16, 1, 0.3, 1];

/** The next slot still needing an answer, starting after `from`. */
function nextEmpty(parts, from) {
    const i = from ? ORDER.indexOf(from) : -1;
    const rot = [...ORDER.slice(i + 1), ...ORDER.slice(0, i + 1)];
    return rot.find((k) => parts[k] == null) ?? null;
}

function Slot({ id, label, value, placeholder, open, bad, onOpen, layoutGroup, reduce }) {
    return (
        <button type="button" onClick={onOpen} aria-expanded={open} aria-controls={`${id}-panel`}
            aria-label={`${label}${value != null ? `, ${value}` : ", not chosen yet"}`}
            className={`relative text-left rounded-2xl border-2 px-3 pt-2 pb-2.5 bg-surface transition-colors
                ${bad ? "border-streak" : open ? "border-transparent" : "border-border hover:border-foreground/25"}`}>
            {open && !bad && (
                <motion.span layoutId={layoutGroup} aria-hidden="true"
                    className="absolute -inset-[2px] rounded-2xl border-2 border-primary ring-4 ring-primary/15"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} />
            )}
            <span className={`relative block text-[10px] font-black uppercase tracking-widest
                ${bad ? "text-streak" : open ? "text-primary" : "text-muted-foreground"}`}>
                {label}
            </span>
            <span className="relative block h-8 overflow-hidden">
                <AnimatePresence initial={false} mode="popLayout">
                    <motion.span key={value ?? "empty"}
                        initial={reduce ? false : { y: 14, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={reduce ? undefined : { y: -14, opacity: 0 }}
                        transition={{ duration: 0.22, ease: EASE }}
                        className={`block font-display font-black text-2xl leading-8 tabular-nums truncate
                            ${value != null ? "text-foreground" : "text-muted-foreground/40"}`}>
                        {value ?? placeholder}
                    </motion.span>
                </AnimatePresence>
            </span>
        </button>
    );
}

/** One cell of a grid. Selected is the brand fill; everything else is quiet. */
function Cell({ on, onClick, children, label, className = "" }) {
    return (
        <button type="button" onClick={onClick} aria-pressed={on} aria-label={label}
            className={`rounded-xl font-bold tabular-nums transition-colors
                ${on ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-foreground hover:bg-secondary active:bg-secondary/80"} ${className}`}>
            {children}
        </button>
    );
}

export default function BirthdayPicker({ value = "", onChange, idPrefix = "acedit-dob", today }) {
    const reduce = useReducedMotion();
    const now = useMemo(() => today || new Date(), [today]);
    const [parts, setParts] = useState(() => splitIso(value));
    const [open, setOpen] = useState(() => nextEmpty(splitIso(value)));
    const [page, setPage] = useState(() => pageFor(splitIso(value).year, now));
    const sent = useRef(value);

    // A value set from OUTSIDE (a stored birthday arriving, a reset) wins over
    // the slots. One this component reported itself is already in them.
    useEffect(() => {
        if (value === sent.current) return;
        sent.current = value;
        const next = splitIso(value);
        if (next.year == null && value) return;          // junk: keep what is picked
        setParts(next);
        if (next.year != null) setPage(pageFor(next.year, now));
    }, [value, now]);

    const problem = partsProblem(parts.day, parts.month, parts.year);
    const iso = composeIso(parts.day, parts.month, parts.year);

    const pick = (slot, v) => {
        const next = { ...parts, [slot]: v };
        setParts(next);
        const out = composeIso(next.day, next.month, next.year) || "";
        sent.current = out;
        onChange?.(out);
        // A day the month cannot hold sends the student straight back to the
        // day, with the real count of days on the grid.
        if (partsProblem(next.day, next.month, next.year)) { setOpen("day"); return; }
        setOpen(nextEmpty(next, slot));
    };

    const yp = yearPage(page, now);
    const days = daysInMonth(parts.month, parts.year);
    const panelId = `${idPrefix}-panel`;
    const ring = `${idPrefix}-ring`;
    const slide = reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } };

    return (
        <div>
            <div className="grid grid-cols-[1fr_1.3fr_1.2fr] gap-2" role="group" aria-label="Date of birth">
                <Slot id={idPrefix} label="Day" value={parts.day} placeholder="DD" layoutGroup={ring}
                    open={open === "day"} bad={!!problem} onOpen={() => setOpen(open === "day" ? null : "day")} reduce={reduce} />
                <Slot id={idPrefix} label="Month" value={parts.month ? MONTHS_SHORT[parts.month - 1] : null}
                    placeholder="Month" layoutGroup={ring}
                    open={open === "month"} onOpen={() => setOpen(open === "month" ? null : "month")} reduce={reduce} />
                <Slot id={idPrefix} label="Year" value={parts.year} placeholder="YYYY" layoutGroup={ring}
                    open={open === "year"} onOpen={() => setOpen(open === "year" ? null : "year")} reduce={reduce} />
            </div>

            {problem && (
                <p role="alert" className="text-sm font-bold text-streak mt-2.5">
                    {problem} Pick the day again.
                </p>
            )}

            <div id={panelId} className="overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                    {open === "day" && (
                        <motion.div key="day" {...slide} transition={{ duration: 0.16, ease: EASE }}
                            className="grid grid-cols-7 gap-1 mt-3" data-birthday-panel="day">
                            {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                                <Cell key={d} on={parts.day === d} label={`${d}`} onClick={() => pick("day", d)}
                                    className="h-10 text-sm">
                                    {d}
                                </Cell>
                            ))}
                        </motion.div>
                    )}
                    {open === "month" && (
                        <motion.div key="month" {...slide} transition={{ duration: 0.16, ease: EASE }}
                            className="grid grid-cols-4 gap-1.5 mt-3" data-birthday-panel="month">
                            {MONTHS_SHORT.map((m, i) => (
                                <Cell key={m} on={parts.month === i + 1} label={MONTHS[i]}
                                    onClick={() => pick("month", i + 1)} className="h-11 text-sm">
                                    {m}
                                </Cell>
                            ))}
                        </motion.div>
                    )}
                    {open === "year" && (
                        <motion.div key="year" {...slide} transition={{ duration: 0.16, ease: EASE }}
                            className="mt-3" data-birthday-panel="year">
                            <div className="flex items-center justify-between mb-1.5">
                                <button type="button" onClick={() => setPage(yp.from - 10)} disabled={!yp.canBack}
                                    aria-label="Earlier years"
                                    className="inline-flex items-center gap-0.5 h-8 pl-1.5 pr-2.5 rounded-lg text-xs font-bold
                                        text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30">
                                    <ChevronLeft className="w-4 h-4" /> Earlier
                                </button>
                                <span className="text-xs font-bold text-muted-foreground tabular-nums">
                                    {yp.from}–{yp.to}
                                </span>
                                <button type="button" onClick={() => setPage(yp.from + 10)} disabled={!yp.canForward}
                                    aria-label="Later years"
                                    className="inline-flex items-center gap-0.5 h-8 pl-2.5 pr-1.5 rounded-lg text-xs font-bold
                                        text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30">
                                    Later <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                                {yp.years.map((y) => (
                                    <Cell key={y} on={parts.year === y} label={`${y}`}
                                        onClick={() => pick("year", y)} className="h-11 text-sm">
                                        {y}
                                    </Cell>
                                ))}
                            </div>
                        </motion.div>
                    )}
                    {open == null && iso && (
                        <motion.p key="done" {...slide} transition={{ duration: 0.2, ease: EASE }}
                            className="flex items-center gap-2 mt-3 text-sm font-bold text-foreground" data-birthday-done>
                            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                                <Check className="w-3 h-3" strokeWidth={3.5} />
                            </span>
                            {longLabel(iso)}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
