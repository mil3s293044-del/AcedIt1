/**
 * DatePicker — a day near today: the next few as chips, the month as a grid,
 * and what is already on each day marked on it.
 *
 * ─── AN EVENT IS ONE DECISION, AND THE QUESTION BEHIND IT IS "WHEN AM I FREE"
 * The planner asked for a SAC's date and a session's day with the browser's
 * date input — a bare box that says nothing about the week it is being put
 * into. So a student could track a Chemistry SAC on the same day as a Methods
 * one and only find out on the runway afterwards. Here the days that already
 * carry something are DOTTED on the grid, and picking one says what is there,
 * so a clash shows before it is made rather than after.
 *
 * ─── TWO SHAPES OF ONE CONTROL ──────────────────────────────────────────────
 * `quick` puts the next few days up front as chips — the shape for a session,
 * which is nearly always this week. `collapsible` keeps the month grid behind
 * a chip until it is wanted, and opens it on its own when the day already
 * chosen is not one of the chips (an edit to a session three weeks out must
 * not open on a row that does not contain it). A SAC is weeks away, so its
 * picker is the grid alone.
 *
 * ─── MONDAY FIRST, LIKE EVERY WEEK THIS APP DRAWS ──────────────────────────
 * `monthGrid` starts on Monday because `studyLog.weekStart` does, and a grid
 * whose weeks start a day earlier than the board two inches above it is the
 * "this week meant two different weeks" failure in a calendar.
 *
 * Days outside `min`/`max` are drawn and disabled rather than left out — a
 * month grid with holes in it stops being a calendar. The chips are the
 * opposite: a shortcut that does not work is not offered at all.
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
    monthGrid, shiftMonth, quickDays, inRange, dateOf, isoOf, longLabel, MONTHS, WEEKDAYS,
} from "@/lib/datePick";

const EASE = [0.16, 1, 0.3, 1];

/** Static classes per tone, because the JIT cannot see an assembled one. */
const DOT = {
    streak: "bg-streak",
    primary: "bg-primary",
    xp: "bg-xp",
    "chart-3": "bg-chart-3",
    "chart-4": "bg-chart-4",
    muted: "bg-muted-foreground/50",
};

function Dots({ items = [], on }) {
    if (!items.length) return null;
    return (
        <span aria-hidden="true" className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
            {items.slice(0, 3).map((m, i) => (
                <span key={i} className={`w-1 h-1 rounded-full ${on ? "bg-primary-foreground" : DOT[m.tone] || DOT.muted}`} />
            ))}
        </span>
    );
}

export default function DatePicker({
    value = "", onChange, min, max, marks = {}, quick = 0, collapsible = false,
    idPrefix = "acedit-date", today, label, echo = true,
}) {
    const reduce = useReducedMotion();
    const todayIso = useMemo(() => isoOf(today || new Date()), [today]);
    const start = useMemo(() => (min && min > todayIso ? min : todayIso), [min, todayIso]);
    const chips = useMemo(() => (quick ? quickDays(start, quick, { min, max }) : []), [quick, start, min, max]);
    const inChips = chips.some((c) => c.iso === value);

    const viewOf = (iso) => {
        const d = dateOf(iso) || dateOf(start) || new Date();
        return { year: d.getFullYear(), month: d.getMonth() + 1 };
    };
    const [view, setView] = useState(() => viewOf(value));
    const [dir, setDir] = useState(0);
    const [gridOpen, setGridOpen] = useState(() => !collapsible || (!!value && !inChips));

    // A value set from outside (an edit opening on another session) brings the
    // grid to its month, and opens it if the chips cannot show it.
    useEffect(() => {
        const d = dateOf(value);
        if (!d) return;
        setView((v) => (v.year === d.getFullYear() && v.month === d.getMonth() + 1
            ? v : { year: d.getFullYear(), month: d.getMonth() + 1 }));
    }, [value]);
    useEffect(() => {
        if (collapsible && value && !inChips) setGridOpen(true);
    }, [collapsible, value, inChips]);

    const weeks = useMemo(() => monthGrid(view.year, view.month), [view]);
    const first = `${view.year}-${String(view.month).padStart(2, "0")}-01`;
    const prev = shiftMonth(view, -1);
    const next = shiftMonth(view, 1);
    const canPrev = !min || isoOf(new Date(view.year, view.month - 1, 0)) >= min;
    const canNext = !max || isoOf(new Date(next.year, next.month - 1, 1)) <= max;

    const go = (delta) => {
        setDir(delta);
        setView(delta < 0 ? prev : next);
    };
    const pick = (iso) => {
        if (!inRange(iso, min, max)) return;
        const d = dateOf(iso);
        if (d.getMonth() + 1 !== view.month) go(iso < first ? -1 : 1);
        onChange?.(iso);
    };

    const here = marks[value] || [];
    const shift = reduce ? 0 : 28;

    return (
        <div data-date-picker={idPrefix}>
            {(label || (collapsible && chips.length > 0)) && (
                <div className="flex items-center justify-between gap-3 mb-1.5">
                    {label ? <p className="stat-label">{label}</p> : <span />}
                    {/* THE WAY TO THE MONTH IS NOT AT THE END OF A SCROLLING ROW.
                        It was the eighth chip, which on a phone sat past the
                        edge of a row nobody knows scrolls — so the one control
                        reaching beyond this week was the one most likely to be
                        missed. It sits with the label, always on screen. */}
                    {collapsible && chips.length > 0 && (
                        <button type="button" onClick={() => setGridOpen((o) => !o)} aria-expanded={gridOpen}
                            aria-controls={`${idPrefix}-grid`}
                            className={`inline-flex items-center gap-1 h-7 px-2 -mr-1 rounded-lg text-xs font-bold transition-colors
                                ${gridOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                            <CalendarDays className="w-3.5 h-3.5" /> {gridOpen ? "Hide calendar" : "Another day"}
                        </button>
                    )}
                </div>
            )}

            {chips.length > 0 && (
                /* `w-0 min-w-full`: A SCROLLING ROW STILL HANDS ITS CONTENT
                   WIDTH UP to whatever sizes it. Inside a grid — and the dialog
                   this sits in IS one — that widened the column to all seven
                   chips and put a horizontal scrollbar on the page at 390.
                   Zero intrinsic width, then fill the container. */
                <div className="w-0 min-w-full flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none]
                    [mask-image:linear-gradient(to_right,black_88%,transparent)]" role="group" aria-label="The next few days">
                    {chips.map((c) => {
                        const on = c.iso === value;
                        return (
                            <motion.button key={c.iso} type="button" onClick={() => pick(c.iso)} aria-pressed={on}
                                aria-label={longLabel(c.iso)}
                                whileTap={reduce ? undefined : { scale: 0.94 }}
                                className={`relative flex-shrink-0 w-[3.6rem] h-14 rounded-2xl border-2 flex flex-col items-center
                                    justify-center transition-colors ${on
                                        ? "bg-primary border-primary text-primary-foreground shadow-soft"
                                        : "bg-surface border-border text-foreground hover:border-foreground/25"}`}>
                                <span className={`text-[10px] font-black uppercase tracking-wider leading-none
                                    ${on ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                    {c.label === "Tomorrow" ? "Tmrw" : c.label}
                                </span>
                                <span className="font-display font-black text-lg leading-tight tabular-nums">{c.day}</span>
                                <Dots items={marks[c.iso]} on={on} />
                            </motion.button>
                        );
                    })}
                </div>
            )}

            <AnimatePresence initial={false}>
                {gridOpen && (
                    <motion.div id={`${idPrefix}-grid`} key="grid"
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.24, ease: EASE }}
                        className="overflow-hidden">
                        <div className={`rounded-2xl border border-border bg-surface p-2.5 ${chips.length ? "mt-2" : ""}`}>
                            <div className="flex items-center justify-between mb-1.5">
                                <button type="button" onClick={() => go(-1)} disabled={!canPrev}
                                    aria-label={`${MONTHS[prev.month - 1]} ${prev.year}`}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground
                                        hover:bg-secondary hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="relative h-6 flex-1 overflow-hidden text-center">
                                    <AnimatePresence initial={false} mode="popLayout" custom={dir}>
                                        <motion.span key={first} custom={dir}
                                            initial={{ x: dir * shift, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                                            exit={{ x: -dir * shift, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}
                                            className="block font-display font-extrabold text-sm text-foreground leading-6">
                                            {MONTHS[view.month - 1]} {view.year}
                                        </motion.span>
                                    </AnimatePresence>
                                </span>
                                <button type="button" onClick={() => go(1)} disabled={!canNext}
                                    aria-label={`${MONTHS[next.month - 1]} ${next.year}`}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground
                                        hover:bg-secondary hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-7 mb-0.5" aria-hidden="true">
                                {WEEKDAYS.map((w) => (
                                    <span key={w} className="text-center text-[10px] font-black uppercase tracking-wider text-muted-foreground/70 py-1">
                                        {w.slice(0, 2)}
                                    </span>
                                ))}
                            </div>

                            <div className="relative overflow-hidden">
                                <AnimatePresence initial={false} mode="popLayout" custom={dir}>
                                    <motion.div key={first} custom={dir}
                                        initial={{ x: dir * shift * 2, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                                        exit={{ x: -dir * shift * 2, opacity: 0 }} transition={{ duration: 0.22, ease: EASE }}
                                        className="grid grid-cols-7 gap-0.5" role="grid" aria-label={`${MONTHS[view.month - 1]} ${view.year}`}>
                                        {weeks.flat().map((c) => {
                                            const on = c.iso === value;
                                            const ok = inRange(c.iso, min, max);
                                            const isToday = c.iso === todayIso;
                                            return (
                                                <button key={c.iso} type="button" onClick={() => pick(c.iso)} disabled={!ok}
                                                    aria-pressed={on} aria-label={`${longLabel(c.iso)}${(marks[c.iso] || []).length ? `, ${marks[c.iso].map((m) => m.label).join(", ")}` : ""}`}
                                                    className={`relative h-10 rounded-xl text-sm font-bold tabular-nums transition-colors
                                                        disabled:opacity-25 disabled:cursor-not-allowed
                                                        ${on ? "bg-primary text-primary-foreground shadow-soft"
                                                            : c.inMonth ? "text-foreground hover:bg-secondary enabled:active:bg-secondary/80"
                                                            : "text-muted-foreground/45 hover:bg-secondary/60"}
                                                        ${isToday && !on ? "ring-2 ring-inset ring-primary/45" : ""}`}>
                                                    {c.day}
                                                    <Dots items={marks[c.iso]} on={on} />
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* The answer, in words, and what is already on it. A clash is
                worth saying BEFORE the button, which is the whole reason the
                days are marked at all. */}
            {value && (echo || here.length > 0) && (
                <div className="mt-2 text-sm" aria-live="polite">
                    {/* `echo={false}` where the day is already printed nearby —
                        the plan dialog's own title carries it. */}
                    {echo && (
                        <p className="font-bold text-foreground">{longLabel(value, { year: value.slice(0, 4) !== todayIso.slice(0, 4) })}</p>
                    )}
                    {here.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                            {here.map((m, i) => (
                                <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT[m.tone] || DOT.muted}`} />
                                    {m.label}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
