/**
 * TheBrain — the neuroscience beat, in the middle of the funnel rather than
 * nowhere at all.
 *
 * The pitch AcedIt actually has is not "AI for study". It is that the human
 * brain learns in a particular way, that the way most students study fights
 * it, and that the AI is aimed at the techniques which do not. That argument
 * was on the landing page and completely absent from the flow where somebody
 * is deciding whether to pay, which is the one place it is worth making.
 *
 * NOTHING HERE IS MARKETING ART. The rotating cloud is BrainModel, the
 * component the Study page and the Analytics cognition tab render. The regions
 * come from TECHNIQUE_NEURO in lib/neuro. The graph is EvidenceChart, drawing
 * the same data the product shows you inside. Pick a technique and you are
 * looking at exactly what a paying user sees, before paying.
 *
 * That is the difference between citing research and borrowing its authority.
 * A stock photo of a glowing brain and the word "neuroscience" costs nothing
 * and proves nothing. This is checkable: every panel carries its source, the
 * charts say whether they are schematic or approximate, and if the science in
 * the app changed this screen would change with it, because there is one copy
 * of it.
 *
 * IT IS INTERACTIVE ON PURPOSE. A read-only slab between two questions is a
 * wall, and people scroll past walls. Choosing which technique to look at
 * takes a second, and someone who has chosen has read.
 *
 * THE PICTURE IS ATMOSPHERE, THE TEXT IS THE CONTENT. Every fact is in the
 * HTML beside the canvas, so a screen reader, a search engine and anyone on
 * reduced motion gets all of it. If the canvas never painted, nothing factual
 * would be lost.
 */
import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import BrainModel from "@/components/study/BrainModel";
import EvidenceChart from "@/components/study/EvidenceChart";
import { TECHNIQUE_NEURO, REGIONS, REGION_NOTE, chartMax } from "@/lib/neuro";

/**
 * Four, not six. The full table has Pomodoro and mind maps in it too, and both
 * are worth reading, but this screen sits between two questions and its job is
 * to be finished. These are the four the product is actually built on, in the
 * order they are worth meeting: the one with the biggest evidence base first.
 */
const ORDER = ["active_recall", "spaced_repetition", "blurting", "exam"];

const LABEL = {
    active_recall: "Active recall",
    spaced_repetition: "Spaced repetition",
    blurting: "Blurting",
    exam: "Exam conditions",
};

export default function TheBrain() {
    const reduce = useReducedMotion();
    const [key, setKey] = useState(ORDER[0]);
    const tech = TECHNIQUE_NEURO[key];
    if (!tech) return null;

    return (
        <div data-the-brain className="space-y-5">
            {/* The picker. Chips rather than cards: there are four of them, they
                change one panel, and a row of playing cards here would compete
                with the hand at the bottom of the screen for the same job. */}
            <div className="flex flex-wrap gap-2">
                {ORDER.map((k) => (
                    <button
                        key={k}
                        type="button"
                        data-brain-tech={k}
                        aria-pressed={k === key}
                        onClick={() => setKey(k)}
                        className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${
                            k === key
                                ? "bg-primary text-primary-foreground border-primary shadow-pop"
                                : "bg-surface text-muted-foreground border-border hover:border-primary/40"}`}
                    >
                        {LABEL[k]}
                    </button>
                ))}
            </div>

            <div className="card-soft overflow-hidden">
                {/* The brain itself, on its own ground so the canvas has
                    something to sit against rather than floating on cream. */}
                <div className="bg-[#0D1626] relative">
                    <BrainModel regions={tech.regions} height={230} glow />
                    <div className="absolute inset-x-0 bottom-0 p-3 flex flex-wrap gap-x-4 gap-y-1.5">
                        {tech.regions.slice(0, 4).map((r) => (
                            <span key={r.id} className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ background: `hsl(var(--${r.tone}))` }} />
                                <span className="text-[10px] font-bold text-white/70">
                                    {REGIONS[r.id]?.short || r.id}
                                </span>
                            </span>
                        ))}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={key}
                        className="p-5 lg:p-6"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                        transition={{ duration: 0.22 }}
                    >
                        <h3 className="font-display font-extrabold text-foreground
                            text-lg lg:text-xl leading-snug tracking-tight">
                            {tech.headline}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-2.5">
                            {tech.network}
                        </p>

                        {/* The graph. This is the part that does the work: the
                            crossover on active recall is the single most
                            persuasive picture in study science, and it is one
                            most students have never seen. */}
                        {tech.chart && (
                            <div className="mt-5 pt-5 border-t border-border">
                                <EvidenceChart chart={tech.chart} max={chartMax(tech.chart)} />
                            </div>
                        )}

                        {/* What it feels like, which is the objection. Every one
                            of these techniques feels worse than the thing it
                            replaces, and a student who is not warned about that
                            quits in week two and concludes it did not work. */}
                        {tech.feelsLike && (
                            <div className="mt-5 rounded-xl bg-secondary/60 border border-border p-3.5">
                                <p className="stat-label text-muted-foreground mb-1.5">
                                    What it feels like
                                </p>
                                <p className="text-[13px] text-foreground/85 leading-relaxed">
                                    {tech.feelsLike}
                                </p>
                            </div>
                        )}

                        {tech.effect && (
                            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                                <span className="font-bold text-foreground">
                                    Effect size g ≈ {tech.effect.g.toFixed(2)}
                                </span>
                                {" "}for {tech.effect.label}
                                {tech.effect.approx ? ", approximately" : ""}.{" "}
                                {tech.effect.source}.
                            </p>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                {REGION_NOTE}
            </p>
        </div>
    );
}
