/**
 * PhoneWeek — the planner's week on a phone: seven day pills, and the chosen
 * day as an agenda you can swipe through.
 *
 * ─── THE BOARD WAS SEVEN COLUMNS STACKED INTO ONE ──────────────────────────
 * Below `sm` the drag board fell to a single column, so a week was seven
 * stacked boxes — Monday at the top, Sunday a long scroll down — and the
 * only way to see Thursday was to scroll past three days you were not asking
 * about. Dragging a chip from Monday to Friday meant holding it through that
 * scroll. The board is a desktop object: seven columns side by side is what
 * makes "move it to Wednesday" a gesture. A phone wants the other shape every
 * calendar app on it already uses — the week as a strip, one day at a time.
 *
 * So the strip answers "what does my week look like" at a glance — a dot per
 * session, filled when done, a diamond on a SAC day — and the agenda answers
 * "what am I doing today", which is the question a phone is opened to ask.
 * Rescheduling is the session's own Edit, one tap from its row.
 *
 * ─── A SWIPE IS A DAY, AND A WEEK IS JUST SEVEN OF THEM ────────────────────
 * Swiping past Sunday lands on next Monday rather than stopping at the edge;
 * the parent moves the week. The bounds are the board's own (`canStep`), so
 * the phone cannot reach a week the desktop could not.
 *
 * A drag that ends on a row is still a drag: the release would otherwise fire
 * that row's click and tick a session off, or open it, on the way past.
 *
 * ─── THE CHECK IS THE BIGGEST TARGET ON THE ROW ────────────────────────────
 * Ticking a session off is the one thing done on this screen many times a
 * day, so it is a 40px button at the thumb's end of the row rather than the
 * board's 16px box, and it springs when it lands.
 */
import React, { useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, Plus, Repeat, Flag } from "lucide-react";
import { fmtDate } from "@/lib/safeDate";

const SWIPE_PX = 56;
const SWIPE_V = 420;
const EASE = [0.16, 1, 0.3, 1];

function DayStrip({ days, selected, onSelect }) {
    return (
        <div role="tablist" aria-label="Days of the week" className="grid grid-cols-7 gap-1" data-day-strip>
            {days.map((d) => {
                const on = d.key === selected;
                const total = d.plans.length;
                const done = d.plans.filter((p) => p.is_completed).length;
                const dots = Math.min(total, 3);
                const label = d.isToday ? "Today" : d.dayName;
                return (
                    <button key={d.key} type="button" role="tab" aria-selected={on}
                        onClick={() => onSelect(d.key)}
                        aria-label={`${fmtDate(d.key, "EEEE d MMMM")}: ${total} planned, ${done} done${d.sacs.length ? `, ${d.sacs.length} assessment due` : ""}`}
                        className="relative flex flex-col items-center rounded-2xl pt-2 pb-2.5 transition-colors hover:bg-secondary/60">
                        {on && (
                            <motion.span layoutId="planner-day" aria-hidden="true"
                                className="absolute inset-0 rounded-2xl bg-foreground"
                                transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                        )}
                        <span className={`relative text-[10px] font-black uppercase tracking-wider leading-none ${
                            on ? "text-background/70" : d.isToday ? "text-primary" : d.isPast ? "text-muted-foreground/45" : "text-muted-foreground"}`}>
                            {label}
                        </span>
                        <span className={`relative font-display font-black text-xl leading-tight tabular-nums mt-0.5 ${
                            on ? "text-background" : d.isToday ? "text-primary" : d.isPast ? "text-muted-foreground/50" : "text-foreground"}`}>
                            {d.dayNum}
                        </span>
                        {/* Load: a dot per session up to three, done first, and
                            a diamond for an assessment — read at a glance across
                            the week without opening a single day. */}
                        <span className="relative flex items-center gap-[3px] h-1.5 mt-1" aria-hidden="true">
                            {d.sacs.length > 0 && (
                                <span className="w-1.5 h-1.5 rotate-45 rounded-[1px] bg-streak" />
                            )}
                            {Array.from({ length: dots }, (_, i) => (
                                <span key={i} className={`w-1.5 h-1.5 rounded-full ${
                                    i < done ? (on ? "bg-background" : "bg-primary") : (on ? "bg-background/35" : "bg-foreground/25")}`} />
                            ))}
                            {total > 3 && (
                                <span className={`text-[9px] font-black leading-none ${on ? "text-background/70" : "text-muted-foreground"}`}>+</span>
                            )}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function Row({ p, info, onToggle, onOpen, guard, reduce }) {
    const { Icon } = info;
    return (
        <motion.li layout={!reduce} className={`flex items-stretch rounded-2xl border bg-surface overflow-hidden ${
            p.is_completed ? "border-border/60" : "border-border"}`}>
            <span aria-hidden="true" className={`w-1.5 flex-shrink-0 ${info.rail}`} />
            <button type="button" onClick={() => guard(() => onOpen(p))} aria-label={`Open ${p.title}`}
                className="min-w-0 flex-1 text-left flex items-start gap-3 pl-3 pr-2 py-3">
                <span className={`w-14 flex-shrink-0 text-xs font-bold tabular-nums pt-0.5 ${
                    p.is_completed ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                    {info.time || "Anytime"}
                </span>
                <span className="min-w-0 flex-1">
                    <span className={`block text-[15px] font-bold leading-snug ${
                        p.is_completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {Icon && <Icon className="w-4 h-4 inline-block mr-1.5 -mt-0.5 text-muted-foreground" />}
                        {info.title}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                        {[info.dur ? `${info.dur} min` : null, info.subject].filter(Boolean).join(" · ") || " "}
                        {info.repeat && <Repeat className="w-3 h-3 inline ml-1.5 -mt-0.5 opacity-60" />}
                    </span>
                </span>
            </button>
            <div className="flex items-center pr-3">
                <motion.button type="button" onClick={() => guard(() => onToggle(p))}
                    aria-label={`Mark ${p.title} ${p.is_completed ? "not done" : "done"}`}
                    aria-pressed={!!p.is_completed}
                    whileTap={reduce ? undefined : { scale: 0.86 }}
                    className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-colors ${
                        p.is_completed ? "bg-primary border-primary text-primary-foreground" : "border-border text-transparent hover:border-primary"}`}>
                    <AnimatePresence initial={false}>
                        {p.is_completed && (
                            <motion.span key="tick"
                                initial={reduce ? false : { scale: 0, rotate: -30 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={reduce ? undefined : { scale: 0, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 520, damping: 18 }}>
                                <Check className="w-5 h-5" strokeWidth={3} />
                            </motion.span>
                        )}
                    </AnimatePresence>
                </motion.button>
            </div>
        </motion.li>
    );
}

export default function PhoneWeek({
    days, selected, onSelect, onStep, canStep = () => true,
    describe, actualByDate, onToggle, onOpen, onAdd,
}) {
    const reduce = useReducedMotion();
    const [dir, setDir] = useState(0);
    const dragged = useRef(false);

    const idx = Math.max(0, days.findIndex((d) => d.key === selected));
    const day = days[idx];
    if (!day) return null;

    const select = (key) => {
        const j = days.findIndex((d) => d.key === key);
        setDir(j > idx ? 1 : -1);
        onSelect(key);
    };
    const step = (delta) => {
        if (!canStep(delta)) return;
        setDir(delta);
        onStep(delta);
    };
    // Swallow the click a drag ends on.
    const guard = (fn) => { if (!dragged.current) fn(); };

    const done = day.plans.filter((p) => p.is_completed).length;
    const studied = actualByDate?.get?.(day.key) || 0;
    const shift = reduce ? 0 : 36;

    return (
        <div className="space-y-3" data-phone-week>
            <DayStrip days={days} selected={day.key} onSelect={select} />

            <div className="relative overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                    <motion.div key={day.key} custom={dir}
                        variants={{
                            enter: (d) => ({ x: d * shift, opacity: 0 }),
                            center: { x: 0, opacity: 1 },
                            exit: (d) => ({ x: -d * shift, opacity: 0 }),
                        }}
                        initial="enter" animate="center" exit="exit"
                        transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
                        drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.22}
                        onDragStart={() => { dragged.current = true; }}
                        onDragEnd={(e, info) => {
                            const { offset, velocity } = info;
                            if (offset.x < -SWIPE_PX || velocity.x < -SWIPE_V) step(1);
                            else if (offset.x > SWIPE_PX || velocity.x > SWIPE_V) step(-1);
                            setTimeout(() => { dragged.current = false; }, 0);
                        }}
                        className="space-y-3">
                        <div className="flex items-end justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="font-display font-extrabold text-foreground text-lg leading-tight">
                                    {fmtDate(day.key, "EEEE d MMMM")}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                                    {day.plans.length
                                        ? `${done} of ${day.plans.length} done${studied ? ` · ${studied}m studied` : ""}`
                                        : studied ? `${studied}m studied` : day.isPast ? "Nothing was planned" : "Nothing planned yet"}
                                </p>
                            </div>
                            {!day.isPast && (
                                <button type="button" onClick={() => guard(() => onAdd(day.key))}
                                    className="flex-shrink-0 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold bg-primary/10 text-primary hover:bg-primary/15 transition-colors">
                                    <Plus className="w-4 h-4" /> Add
                                </button>
                            )}
                        </div>

                        {day.sacs.map((a) => (
                            <div key={a.id} className="rounded-2xl bg-gradient-to-br from-streak to-streak/80 text-white px-4 py-3 shadow-soft flex items-center gap-3">
                                <Flag className="w-5 h-5 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-white/75 leading-tight">
                                        {(a.assessment_type || "sac").toUpperCase()} due
                                    </p>
                                    <p className="text-sm font-black leading-tight truncate">{a.subject_name} — {a.title}</p>
                                </div>
                            </div>
                        ))}

                        {day.plans.length > 0 ? (
                            <ul className="space-y-2">
                                {day.plans.map((p) => (
                                    <Row key={p.id} p={p} info={describe(p)} onToggle={onToggle} onOpen={onOpen}
                                        guard={guard} reduce={reduce} />
                                ))}
                            </ul>
                        ) : !day.isPast && day.sacs.length === 0 ? (
                            <button type="button" onClick={() => guard(() => onAdd(day.key))}
                                className="w-full rounded-2xl border-2 border-dashed border-border/70 py-7 flex flex-col items-center gap-1 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors">
                                <Plus className="w-5 h-5" />
                                <span className="text-sm font-bold">Plan something</span>
                            </button>
                        ) : null}

                        <p className="text-[11px] text-muted-foreground text-center pt-1">
                            Swipe for the next day · tap a session for its details
                        </p>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
