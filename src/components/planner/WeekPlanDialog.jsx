/**
 * WeekPlanDialog — "Plan this week for me", and show the working.
 *
 * The version this replaces asked for an hours budget, sent everything to a
 * language model and returned a list of plausible sessions with no way to tell
 * why any of them was there. This proposes the same shape of thing from the
 * student's own data, and every row says what put it on the list.
 *
 * Nothing saves until it's approved. That was the one part of the original
 * worth keeping — a planner that writes to your week without asking is a
 * planner you stop opening.
 */
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarDays, Sparkles, AlertTriangle, Check, Loader2, Info } from "lucide-react";
import { planWeek } from "@/lib/weekPlan";

const HOURS = [3, 5, 8, 12];
const LENGTHS = [25, 40, 60];
const DAYS = [
    { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
    { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" },
    { key: "sun", label: "Sun" },
];

/** Reason badge colours. Urgency reads from the tint; the text stays foreground. */
const REASON_STYLE = {
    slipping:   "bg-streak/20",
    assessment: "bg-xp/25",
    retrieval:  "bg-chart-4/20",
    unstable:   "bg-chart-3/15",
    untouched:  "bg-secondary",
    balance:    "bg-secondary",
};

export default function WeekPlanDialog({
    open, onOpenChange, weekStart, subjects = [], assessments = [],
    flashcards = [], techniques = [], existingPlans = [], onSave, saving = false,
}) {
    const [hours, setHours] = useState(5);
    const [sessionMinutes, setSessionMinutes] = useState(40);
    const [maxPerDay, setMaxPerDay] = useState(2);   // exposed below
    const [daysOff, setDaysOff] = useState([]);
    const [startTime, setStartTime] = useState("16:00");
    const [proposal, setProposal] = useState(null);

    const toggleDay = (key) =>
        setDaysOff(prev => (prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]));

    const plan = useMemo(() => planWeek({
        weekStart, today: new Date(), subjects, assessments, flashcards, techniques,
        existingPlans, hours, sessionMinutes, maxPerDay, daysOff, startTime,
    }), [weekStart, subjects, assessments, flashcards, techniques, existingPlans,
         hours, sessionMinutes, maxPerDay, daysOff, startTime]);

    // The proposal is a snapshot the student can tick through. Re-deriving it
    // from `plan` on every keystroke would undo their ticks.
    const shown = proposal ?? plan.sessions;
    const chosen = shown.filter(s => s.include);
    const totalMins = chosen.reduce((s, x) => s + x.duration_minutes, 0);

    const toggle = (id) =>
        setProposal((proposal ?? plan.sessions).map(s => (s.id === id ? { ...s, include: !s.include } : s)));

    const regenerate = () => setProposal(null);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-chart-4" /> Plan this week for me
                    </DialogTitle>
                    <DialogDescription>
                        Built from what you've actually logged — not a guess. Every session says why it's there.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* ── What you've got ── */}
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <p className="stat-label mb-1.5">Time this week</p>
                            <div className="flex gap-1.5">
                                {HOURS.map(h => (
                                    <button key={h} onClick={() => { setHours(h); regenerate(); }}
                                        className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition-colors ${
                                            hours === h ? "border-chart-4 bg-chart-4/10 text-foreground"
                                                : "border-border text-muted-foreground hover:text-foreground"}`}>
                                        {h}h
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="stat-label mb-1.5">Session length</p>
                            <div className="flex gap-1.5">
                                {LENGTHS.map(m => (
                                    <button key={m} onClick={() => { setSessionMinutes(m); regenerate(); }}
                                        className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition-colors ${
                                            sessionMinutes === m ? "border-chart-4 bg-chart-4/10 text-foreground"
                                                : "border-border text-muted-foreground hover:text-foreground"}`}>
                                        {m}m
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-[1fr_auto] gap-4">
                        <div>
                            <p className="stat-label mb-1.5">Days you can't study</p>
                            <div className="flex gap-1">
                                {DAYS.map(dd => (
                                    <button key={dd.key} onClick={() => { toggleDay(dd.key); regenerate(); }}
                                        aria-pressed={daysOff.includes(dd.key)}
                                        className={`flex-1 rounded-lg border-2 py-1.5 text-[11px] font-bold transition-colors ${
                                            daysOff.includes(dd.key)
                                                ? "border-streak/40 bg-streak/10 text-muted-foreground line-through"
                                                : "border-border text-foreground hover:border-chart-4/50"}`}>
                                        {dd.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div>
                                <p className="stat-label mb-1.5">Max/day</p>
                                <div className="flex gap-1">
                                    {[1, 2, 3].map(n => (
                                        <button key={n} onClick={() => { setMaxPerDay(n); regenerate(); }}
                                            className={`w-9 rounded-lg border-2 py-1.5 text-[11px] font-bold transition-colors ${
                                                maxPerDay === n ? "border-chart-4 bg-chart-4/10 text-foreground"
                                                    : "border-border text-muted-foreground hover:text-foreground"}`}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                            <p className="stat-label mb-1.5">Start at</p>
                            <input type="time" value={startTime} aria-label="Start time"
                                onChange={(e) => { setStartTime(e.target.value); regenerate(); }}
                                className="rounded-xl border-2 border-border bg-surface px-3 py-2 text-sm font-bold text-foreground" />
                            </div>
                        </div>
                    </div>

                    {/* ── The plan ── */}
                    {!plan.hasData ? (
                        <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center">
                            <p className="text-sm font-bold text-foreground">Nothing to plan around yet.</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                Add your subjects, track a SAC or review a deck, and this fills in. It builds
                                the week from what you've logged rather than inventing one.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-baseline justify-between gap-3">
                                <p className="stat-label">{chosen.length} session{chosen.length === 1 ? "" : "s"} proposed</p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                    {Math.floor(totalMins / 60)}h {totalMins % 60}m of your {hours}h
                                </p>
                            </div>

                            <ul className="space-y-2">
                                {shown.map((s, i) => (
                                    <motion.li key={s.id}
                                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                                        <button onClick={() => toggle(s.id)} aria-pressed={s.include}
                                            className={`w-full text-left rounded-2xl border-2 p-3 transition-colors ${
                                                s.include ? "border-chart-4/40 bg-chart-4/[0.04]" : "border-border opacity-55"}`}>
                                            <div className="flex items-start gap-3">
                                                <span className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                                                    s.include ? "border-chart-4 bg-chart-4" : "border-border"}`}>
                                                    {s.include && <Check className="w-3 h-3 text-white" />}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                                        <span className="text-sm font-bold text-foreground">{s.title}</span>
                                                        <span className="text-[11px] text-muted-foreground tabular-nums">
                                                            {format(new Date(`${s.date}T00:00:00`), "EEE d MMM")} · {s.start_time} · {s.duration_minutes}m
                                                        </span>
                                                    </div>
                                                    {/* The reason IS the feature. A session you can't
                                                        see the justification for is one you delete. */}
                                                    <p className="text-xs text-muted-foreground leading-snug mt-1">
                                                        <span className={`pill mr-1.5 ${REASON_STYLE[s.reason] || "bg-secondary"} text-foreground`}>
                                                            {s.reasonLabel}
                                                        </span>
                                                        {s.why}{s.evidence ? ` — ${s.evidence}` : ""}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    </motion.li>
                                ))}
                            </ul>

                            {/* What the budget couldn't cover, said out loud. */}
                            {plan.unmet.length > 0 && (
                                <div className="rounded-2xl border-2 border-streak/25 bg-streak/5 p-3">
                                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 text-streak" />
                                        {hours}h doesn't cover everything
                                    </p>
                                    <ul className="mt-1.5 space-y-0.5">
                                        {plan.unmet.map(u => (
                                            <li key={`${u.reason}-${u.subject}`} className="text-xs text-muted-foreground leading-snug">
                                                {u.count} more {u.label.toLowerCase()}
                                                {u.subject ? ` for ${u.subject}` : ""} — {u.why}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <p className="text-[11px] text-muted-foreground leading-snug flex items-start gap-1.5">
                                <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                Ordered by what it costs to skip: cards about to slip, then anything assessed
                                soon, then the balance of your techniques. Nothing is saved until you hit the
                                button.
                            </p>
                        </>
                    )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:flex-1 rounded-xl">
                        Cancel
                    </Button>
                    <Button onClick={() => onSave(chosen)} disabled={!chosen.length || saving}
                        className="sm:flex-[2] gap-1.5 bg-chart-4 hover:bg-chart-4/90 text-white rounded-xl btn-3d">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Put {chosen.length} session{chosen.length === 1 ? "" : "s"} on my week
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
