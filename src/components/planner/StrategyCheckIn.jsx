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
import AceBody from "@/components/ace/AceBody";
import { TECHNIQUES, TECHNIQUE_IDS, applyRules } from "@/lib/strategise";
import { describeOutcomes, describeRemaining, strategyStanding, dayKey } from "@/lib/strategyState";
import { durationOf } from "@/lib/planTags";
import { fmtDate } from "@/lib/safeDate";

// What a student can say about a day that has passed. Deliberately three
// options — "did you do it" is a yes/no that most real days fail, and a plan
// revised as if a half-done session never happened throws away real progress.
const OUTCOMES = [
    { id: "done",    label: "Did it",  icon: Check, cls: "border-primary bg-primary/10 text-primary", pose: "happy" },
    { id: "partly",  label: "Partly",  icon: Minus, cls: "border-xp bg-xp/10 text-xp",                pose: "stand" },
    { id: "skipped", label: "Missed",  icon: X,     cls: "border-streak bg-streak/10 text-streak",    pose: "think" },
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

export default function StrategyCheckIn({ strategy, onRevised, onDismiss, open = false, onOpen }) {
    const { toast } = useToast();
    const [step, setStep] = useState(0);
    // Only what the student explicitly picked. Seeding this from
    // `is_completed` snapshotted the tick state at mount, so a session ticked
    // off elsewhere while the card sat open would still be reported as missed.
    // The default is derived at read time instead.
    const [outcomes, setOutcomes] = useState({});
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

    /**
     * One question at a time.
     *
     * This was a purple card that expanded into a form: every past session
     * listed at once with three buttons each, then a load picker, then a
     * submit. That's a survey, and a student scrolls past a survey.
     *
     * Ace asks about one session, you answer, he asks about the next. Same
     * data, same model call, same rules — but "how did Tuesday go" is a
     * question a person asks, and people answer those.
     *
     * `step` walks the past sessions, then the load question, then the
     * confirm. His pose follows your answers rather than being decoration:
     * he's pleased when you did it and thinking when you didn't, and never
     * disappointed, because a missed session is information.
     */
    const past = strategy.past;
    const total = past.length + 2;            // sessions + load + confirm
    const onSession = step < past.length;
    const session = onSession ? past[step] : null;
    const lastAnswer = session ? null : OUTCOMES.find(o => o.id === outcomes[past[past.length - 1]?.id]);

    const answer = (sessionId, outcomeId) => {
        setOutcomes(prev => ({ ...prev, [sessionId]: outcomeId }));
        setStep(n => n + 1);
    };

    if (!open) {
        return (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                data-ace-checkin="closed"
                className="rounded-2xl border-2 border-border bg-surface p-4 shadow-soft
                    flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-display font-extrabold text-foreground truncate">{sacLabel}</p>
                    <p className={`text-sm font-bold ${TONE[standing.tone]}`}>{standing.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {strategy.sac?.due_date ? `Due ${fmtDate(strategy.sac.due_date, "EEE d MMM")} · ` : ""}
                        {strategy.future.length} session{strategy.future.length === 1 ? "" : "s"} still to come
                    </p>
                </div>
                <Button size="sm" onClick={() => onOpen?.()} className="gap-1.5 flex-shrink-0">
                    Check in <ChevronRight className="w-4 h-4" />
                </Button>
            </motion.div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            data-ace-checkin={onSession ? "session" : step === past.length ? "load" : "confirm"}
            className="rounded-2xl border-2 border-border bg-surface p-4 shadow-soft">

            <div className="flex items-end gap-3">
                <AceBody className="w-20 sm:w-24 flex-shrink-0"
                    pose={busy ? "think" : lastAnswer?.pose || "offer"} title="Ace" />

                <div className="flex-1 min-w-0 mb-1">
                    {/* Progress, as words rather than a bar — three questions
                        is not enough to need a bar, and "2 of 5" tells you the
                        one thing a bar would. */}
                    <p className="stat-label mb-1">
                        {sacLabel} · {Math.min(step + 1, total)} of {total}
                    </p>

                    <AnimatePresence mode="wait">
                        <motion.div key={step}
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.16 }}>

                            {onSession && (
                                <>
                                    <p className="font-display font-extrabold text-foreground leading-snug">
                                        How did {fmtDate(session.date, "EEEE")} go?
                                    </p>
                                    <p className="text-xs text-muted-foreground leading-snug mt-0.5 mb-2.5">
                                        {session.title} · {durationOf(session) || 40}m planned
                                    </p>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {OUTCOMES.map(o => (
                                            <button key={o.id} onClick={() => answer(session.id, o.id)}
                                                data-ace-answer={o.id}
                                                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl
                                                    text-xs font-bold border-2 transition-all
                                                    border-border text-foreground hover:${o.cls.split(" ")[0]}
                                                    hover:bg-secondary`}>
                                                <o.icon className="w-3.5 h-3.5" /> {o.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {step === past.length && (
                                <>
                                    <p className="font-display font-extrabold text-foreground leading-snug">
                                        And how did that feel?
                                    </p>
                                    <p className="text-xs text-muted-foreground leading-snug mt-0.5 mb-2.5">
                                        Be honest — it changes how much I put in the days left.
                                    </p>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {FEEL.map(f => (
                                            <button key={f.id} title={f.hint}
                                                onClick={() => { setFeel(f.id); setStep(n => n + 1); }}
                                                data-ace-feel={f.id}
                                                className="px-3 py-2 rounded-xl text-xs font-bold border-2
                                                    border-border text-foreground hover:bg-secondary transition-all">
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {step > past.length && (
                                <>
                                    <p className="font-display font-extrabold text-foreground leading-snug">
                                        {busy ? "Rebuilding it now…" : "Right — shall I rebuild the days left?"}
                                    </p>
                                    <p className="text-xs text-muted-foreground leading-snug mt-0.5 mb-2.5">
                                        Only the days still ahead change. Anything you&rsquo;ve ticked off stays as it is.
                                    </p>
                                    <div className="flex gap-2 flex-wrap">
                                        <Button size="sm" onClick={revise} disabled={busy} className="gap-1.5">
                                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                            Go on then
                                        </Button>
                                        <Button size="sm" variant="ghost" disabled={busy}
                                            onClick={() => { onDismiss?.(); }}>
                                            Leave it
                                        </Button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}
