/**
 * DistanceToTarget — the goal and the score, finally in the same place.
 *
 * This replaces a poster that showed the target ATAR as a large number and
 * nothing else. The target lived on the Dashboard, the AcedIt ATAR lived on
 * Ranked, and the two never met, so the number on the poster was a wish with
 * no distance attached to it.
 *
 * The strip answers three things in order: where you are, how far that is from
 * where you said you wanted to be, and which single component has the most
 * ATAR still sitting on it — priced, in points, by the same formula the server
 * scores with. "Breadth is your thinnest slice" was already being said; what
 * was missing was whether fixing it was worth 0.1 or 5.
 */
import React from "react";
import { motion } from "framer-motion";
import { GraduationCap, ArrowRight, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { bestLever } from "@/lib/atarLift";
import AceTip from "@/components/ace/AceTip";

// Accent tokens measure between 2.1:1 and 4.0:1 as small text on this card's
// tinted background, so numbers and links are foreground here. The chart-3
// identity lives in the tint, the icon and the progress fill, which are
// graphics and only owe 3:1.

/** How each component is actually moved, and where that happens. */
const LEVER_META = {
    mastery:     { label: "Mastery",     how: "a quiz or a flashcard round moves it fastest",            to: "Quizzes" },
    consistency: { label: "Consistency", how: "showing up again tomorrow counts for more than a long session today", to: "Study" },
    effort:      { label: "Effort",      how: "one longer sitting lifts it faster than several short ones", to: "Study" },
    breadth:     { label: "Breadth",     how: "a technique you haven't touched this month is the quickest lift", to: "Study" },
    planning:    { label: "Planning",    how: "setting a goal or blocking out tomorrow is the quickest lift", to: "Goals" },
};

/** The scale starts at 30 because that's the floor of the AcedIt ATAR, not 0. */
const FLOOR = 30;

export default function DistanceToTarget({ atar, goalAtar, components, courseName, university, qualitativeGoal }) {
    const hasScore = atar != null && Number.isFinite(Number(atar));
    const score = hasScore ? Number(atar) : null;
    const goal = Number(goalAtar);
    const gap = hasScore ? goal - score : null;
    const past = gap != null && gap <= 0;
    const lever = bestLever(components);
    const meta = lever ? LEVER_META[lever.key] : null;

    // Where the two markers sit on a 30–goal track. Clamped so a student above
    // their goal doesn't push the marker off the end.
    const span = Math.max(1, goal - FLOOR);
    const pct = hasScore ? Math.max(0, Math.min(100, ((score - FLOOR) / span) * 100)) : 0;

    return (
        <div className="relative overflow-hidden rounded-2xl bg-surface border border-border shadow-soft p-5 lg:p-6">
            <GraduationCap className="absolute -top-4 -right-4 w-28 h-28 text-chart-3/[0.07] pointer-events-none" />

            <div className="relative flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
                {/* ── The target ── */}
                <div className="flex-shrink-0">
                    <p className="stat-label text-foreground/70 mb-1 inline-flex items-center gap-1">
                        Your shot at <AceTip term="atar" />
                    </p>
                    <p className="font-display font-extrabold text-foreground leading-none"
                        style={{ fontSize: "clamp(2.5rem, 6vw, 3.75rem)" }}>
                        {Number.isFinite(goal) ? goal : "-"}
                    </p>
                    {(courseName || university) && (
                        <div className="mt-2">
                            {courseName && <p className="font-bold text-foreground text-sm leading-tight">{courseName}</p>}
                            {university && <p className="text-xs text-foreground/70">at {university}</p>}
                        </div>
                    )}
                </div>

                {/* ── The distance ── */}
                <div className="min-w-0 flex-1">
                    {!hasScore ? (
                        <p className="text-sm text-foreground/70 leading-snug">
                            Your AcedIt ATAR unlocks after three study days. Once it's there, this shows
                            exactly how far off {Number.isFinite(goal) ? goal : "your target"} you are and
                            what closes the gap.
                        </p>
                    ) : (
                        <>
                            <div className="flex items-baseline justify-between gap-3 mb-1.5">
                                <span className="text-sm font-bold text-foreground tabular-nums">
                                    {score.toFixed(2)} now
                                </span>
                                {past ? (
                                    <span className="inline-flex items-center gap-1 text-sm font-bold text-foreground">
                                        <Trophy className="w-3.5 h-3.5" /> past your goal
                                    </span>
                                ) : (
                                    <span className="text-sm font-bold text-foreground tabular-nums">
                                        {gap.toFixed(2)} to go
                                    </span>
                                )}
                            </div>

                            <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.8, delay: 0.15 }}
                                    className={`h-full rounded-full ${past ? "bg-primary" : "bg-chart-3"}`} />
                            </div>
                            <div className="flex justify-between text-[10px] text-foreground/70 mt-1">
                                <span>{FLOOR}</span>
                                <span className="tabular-nums">{Number.isFinite(goal) ? goal : ""}</span>
                            </div>

                            {/* The lever, priced. */}
                            {past ? (
                                <p className="text-xs text-foreground/70 leading-snug mt-3">
                                    Holding it there is what turns it from a good month into a result.
                                </p>
                            ) : lever && meta && lever.stepGain > 0 ? (
                                <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
                                    <p className="text-xs text-foreground/70 leading-snug min-w-0 flex-1">
                                        <span className="font-bold text-foreground">{meta.label}</span> has the most
                                        left on it. Sitting at {lever.value}, worth up to{" "}
                                        <span className="font-bold text-foreground tabular-nums">+{lever.maxGain.toFixed(2)}</span>.
                                        {" "}Ten points there is <span className="font-bold text-foreground tabular-nums">+{lever.stepGain.toFixed(2)}</span>,
                                        and {meta.how}.
                                    </p>
                                    <Link to={createPageUrl(meta.to)} className="flex-shrink-0">
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground underline underline-offset-2">
                                            Lift {meta.label.toLowerCase()} <ArrowRight className="w-3 h-3" />
                                        </span>
                                    </Link>
                                </div>
                            ) : null}
                        </>
                    )}

                    {qualitativeGoal && (
                        <p className="text-xs text-foreground/70 italic leading-relaxed mt-3 pt-3 border-t border-chart-3/15">
                            “{qualitativeGoal}”
                        </p>
                    )}

                    <Link to={createPageUrl("Goals")}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-foreground/70 hover:text-foreground mt-3 transition-colors">
                        Edit goal <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
