/**
 * StrategyCheckIn — the "adapt daily" half of Strategise.
 *
 * Strategise plans the whole run-up up front. That's the right shape for a
 * plan, and the wrong shape for a week: a student misses Tuesday, and by
 * Thursday every remaining day is a lie they've learned to scroll past.
 *
 * This asks what actually happened on the days that have passed, then rewrites
 * only the days that haven't — through the same model call and the same rules
 * as the original plan, so the revision is constrained exactly as the draft
 * was. It appears on the Planner because that's what gets opened in the
 * morning, and it stays quiet unless there's both something to report and
 * something left to change.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Check, X, Minus, ChevronRight, RotateCcw } from "lucide-react";
import { TECHNIQUES, TECHNIQUE_IDS, applyRules } from "@/lib/strategise";
import { describeOutcomes, describeRemaining, strategyStanding, dayKey } from "@/lib/strategyState";
import { durationOf } from "@/lib/planTags";
import { fmtDate } from "@/lib/safeDate";

// What a student can say about a day that has passed. Deliberately three
// options — "did you do it" is a yes/no that most real days fail, and a plan
// revised as if a half-done session never happened throws away real progress.
const OUTCOMES = [
    { id: "done", label: "Did it", icon: Check, cls: "border-primary bg-primary/10 text-primary" },
    { id: "partly", label: "Partly", icon: Minus, cls: "border-xp bg-xp/10 text-xp" },
    { id: "skipped", label: "Missed", icon: X, cls: "border-streak bg-streak/10 text-streak" },
];

const FEEL = [
    { id: "easy", label: "Too easy", hint: "I want more of a push" },
    { id: "right", label: "About right", hint: "Keep the intensity" },
    { id: "hard", label: "Too much", hint: "Scale it back so I actually do it" },
];

const TONE = {
    good: "text-primary",
    warn: "text-xp",
    bad: "text-streak",
    ok: "text-muted-foreground",
};

export default function StrategyCheckIn({ strategy, onRevised, onDismiss }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    // Only what the student explicitly picked. Seeding this from
    // `is_completed` snapshotted the tick state at mount, so a session ticked
    // off elsewhere while the card sat open would still be reported as missed.
    // The default is derived at read time instead.
    const [outcomes, setOutcomes] = useState({});
    const outcomeOf = (s) => outcomes[s.id] || (s.is_completed ? "done" : "skipped");
    const [feel, setFeel] = useState("right");
    const [busy, setBusy] = useState(false);

    const standing = strategyStanding(strategy);
    const sacLabel = strategy.sac
        ? `${strategy.sac.subject_name || ""} ${strategy.sac.title || ""}`.trim()
        : strategy.subject || "your plan";

    const revise = async () => {
        setBusy(true);
        try {
            const today = dayKey();
            const remainingDates = [...new Set(strategy.future.map(s => s.date))];
            // The revision reuses the original per-day budget rather than
            // inventing one — the student already told us what a day of theirs
            // is worth, and "too much" should shrink that, not reset it.
            const plannedPerDay = Math.max(
                20,
                Math.round(strategy.future.reduce((n, s) => n + (durationOf(s) || 40), 0)
                    / Math.max(1, remainingDates.length)),
            );
            const budget = feel === "hard" ? Math.max(20, Math.round(plannedPerDay * 0.7))
                : feel === "easy" ? Math.round(plannedPerDay * 1.25)
                : plannedPerDay;

            const res = await base44.integrations.Core.InvokeLLM({
                feature: "roadmap_ai_gen",
                prompt: `Revise the remaining days of a student's study plan for one assessment, given what actually happened so far.

ASSESSMENT: ${sacLabel}${strategy.sac?.due_date ? ` — due ${strategy.sac.due_date}` : ""}
TODAY: ${today}

WHAT WAS PLANNED FOR THE DAYS THAT HAVE PASSED, AND HOW THEY WENT:
${describeOutcomes(strategy, outcomes)}

HOW THE WORKLOAD HAS FELT: ${FEEL.find(f => f.id === feel)?.label} — ${FEEL.find(f => f.id === feel)?.hint}

WHAT IS CURRENTLY PLANNED FOR THE DAYS STILL TO COME:
${describeRemaining(strategy)}

Rewrite the remaining days only. Available dates: ${remainingDates.join(", ")}.
Aim for about ${budget} minutes per day.

Techniques you may schedule:
${TECHNIQUE_IDS.map(id => `- ${id}: ${TECHNIQUES[id].blurb}`).join("\n")}

Rules:
- Never schedule a date outside the available dates listed.
- Topics from sessions that were MISSED still need covering — fold them back in, don't silently drop them.
- Topics marked PARTLY need a shorter second pass, not a full repeat.
- Topics marked DONE should come back once for spaced retrieval, not be re-taught.
- If a lot was missed, cut scope rather than cramming everything into the days that are left. Say so in "why".
- Keep at least one timed, full-format practice before the assessment.
- "why" is one short sentence to the student about what that session buys them.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        sessions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    date: { type: "string" },
                                    technique: { type: "string", enum: TECHNIQUE_IDS },
                                    topic: { type: "string" },
                                    duration: { type: "number" },
                                    why: { type: "string" },
                                },
                                required: ["date", "technique", "topic", "duration", "why"],
                            },
                        },
                    },
                    required: ["sessions"],
                },
            });

            const raw = (res?.data ?? res)?.sessions || [];
            const revised = applyRules(raw, {
                days: remainingDates,
                availableDays: remainingDates,
                minutesPerDay: budget,
                confidence: feel === "hard" ? 2 : 3,
            });
            if (!revised.sessions.length) throw new Error("The revision came back empty — nothing was changed.");

            // Replace only the future, unfinished sessions of this plan. A
            // session already ticked off is a record of something that
            // happened; rewriting it would be rewriting history.
            const replaceable = strategy.future.filter(s => !s.is_completed);
            for (const s of replaceable) await base44.entities.StudyPlan.delete(s.id);
            for (const s of revised.sessions) {
                await base44.entities.StudyPlan.create({
                    title: `${TECHNIQUES[s.technique].label}: ${s.topic}`,
                    subject_name: strategy.subject || null,
                    date: s.date,
                    start_time: null,
                    is_completed: false,
                    notes: `[str:${strategy.id}][dur:${s.duration}] ${s.why}`,
                });
            }

            toast({
                variant: "success",
                title: "Plan rebuilt around where you actually are",
                description: `${revised.sessions.length} sessions across the ${remainingDates.length} days left.`,
            });
            onRevised?.();
        } catch (e) {
            toast({ title: "Couldn't rebuild the plan", description: e.message, variant: "destructive" });
        } finally {
            setBusy(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border-2 border-chart-4/30 bg-chart-4/5 p-5 shadow-soft">
            {/* No Ace in here. He asks the question once, above the whole
                group — see Goals.jsx. Three of these cards used to mean three
                identical Aces stacked in a column. */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="stat-label text-chart-4">Strategy check-in</p>
                    <p className="font-display font-extrabold text-foreground mt-1">
                        {sacLabel}
                    </p>
                    <p className={`text-sm font-bold mt-0.5 ${TONE[standing.tone]}`}>{standing.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {strategy.sac?.due_date
                            ? `Due ${fmtDate(strategy.sac.due_date, "EEE d MMM")} · `
                            : ""}
                        {strategy.future.length} session{strategy.future.length === 1 ? "" : "s"} still to come
                    </p>
                </div>
                {!open && (
                    <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5 flex-shrink-0 bg-chart-4 hover:bg-chart-4/90 text-white btn-3d">
                        Check in <ChevronRight className="w-4 h-4" />
                    </Button>
                )}
            </div>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden">
                        <div className="pt-4 space-y-4">
                            <div className="space-y-2">
                                {strategy.past.map(s => (
                                    <div key={s.id} className="rounded-2xl bg-surface border-2 border-border p-3">
                                        <p className="text-sm font-bold text-foreground leading-snug">{s.title}</p>
                                        <p className="text-[11px] text-muted-foreground mb-2">
                                            {fmtDate(s.date, "EEE d MMM")} · {durationOf(s) || 40}m planned
                                        </p>
                                        <div className="flex gap-1.5">
                                            {OUTCOMES.map(o => (
                                                <button key={o.id}
                                                    onClick={() => setOutcomes(prev => ({ ...prev, [s.id]: o.id }))}
                                                    aria-pressed={outcomeOf(s) === o.id}
                                                    className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                                                        outcomeOf(s) === o.id ? o.cls : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                                                    <o.icon className="w-3.5 h-3.5" /> {o.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <p className="stat-label mb-1.5">How has the load felt?</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {FEEL.map(f => (
                                        <button key={f.id} onClick={() => setFeel(f.id)} title={f.hint}
                                            aria-pressed={feel === f.id}
                                            className={`px-2 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                                feel === f.id ? "border-chart-4 bg-chart-4/10 text-chart-4" : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button onClick={revise} disabled={busy} className="flex-1 gap-1.5 bg-chart-4 hover:bg-chart-4/90 text-white btn-3d">
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                    Rebuild the days left
                                </Button>
                                <Button variant="ghost" onClick={() => { setOpen(false); onDismiss?.(); }} disabled={busy} className="rounded-xl">
                                    Not now
                                </Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Only the days still ahead get rewritten. Anything you've already ticked off stays exactly as it is.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
