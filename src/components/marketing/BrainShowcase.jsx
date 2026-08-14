/**
 * BrainShowcase — the app's actual brain, on the landing page, driven by the
 * app's actual neuroscience model.
 *
 * NOTHING HERE IS MARKETING ART. The rotating cloud is BrainModel, the same
 * component the Study page and the Analytics cognition tab render. The regions
 * it lights come from TECHNIQUE_NEURO in lib/neuro, which is the same table the
 * product uses, with the same citations attached. Pick a technique and you are
 * looking at exactly what a student sees inside.
 *
 * That matters more than it sounds. The claim being made is "this app is built
 * on the research", and the cheapest way to make that claim is a stock photo of
 * a glowing brain and the word "neuroscience". Wiring the marketing page to the
 * product's own model means the claim is checkable: if the science in the app
 * changed, this section would change with it, because there is only one copy.
 *
 * THE PICTURE IS ATMOSPHERE, THE TEXT IS THE CONTENT. Every fact is in the HTML
 * beside the canvas, so a screen reader, a search engine and anyone with
 * reduced motion gets all of it. If the canvas never painted, nothing factual
 * would be lost.
 *
 * The caveat line is not decoration either. fMRI localisation is coarse and
 * "region X lights up" is a simplification of a distributed process. Saying so
 * out loud is the difference between citing research and borrowing its
 * authority.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BrainModel from "@/components/study/BrainModel";
import { TECHNIQUE_NEURO, REGIONS, REGION_NOTE } from "@/lib/neuro";

/** The order they are worth meeting in, not the order the object happens to be in. */
const ORDER = ["active_recall", "spaced_repetition", "blurting", "exam", "pomodoro"];

const LABEL = {
    active_recall: "Active recall",
    spaced_repetition: "Spaced repetition",
    blurting: "Blurting",
    exam: "Exam mode",
    pomodoro: "Focus blocks",
};

export default function BrainShowcase() {
    const [key, setKey] = useState(ORDER[0]);
    const tech = TECHNIQUE_NEURO[key];
    if (!tech) return null;

    return (
        <div data-brain-showcase className="grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-14 items-center">

            {/* ── The picker, and what the technique actually does ──────── */}
            <div>
                <div className="flex flex-wrap gap-2 mb-7">
                    {ORDER.map((k) => (
                        <button
                            key={k}
                            data-tech={k}
                            data-tech-on={k === key ? "1" : "0"}
                            onClick={() => setKey(k)}
                            className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition-all
                                cursor-pointer ${
                                k === key
                                    ? "bg-primary text-white border-primary shadow-pop"
                                    : "bg-white/[0.04] text-white/70 border-white/15 hover:border-white/35"}`}
                        >
                            {LABEL[k]}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                    >
                        <h3 className="font-display font-extrabold text-2xl sm:text-3xl
                            tracking-tight text-white leading-tight">
                            {tech.headline}
                        </h3>
                        <p className="text-white/60 mt-4 leading-relaxed text-sm sm:text-base">
                            {tech.network}
                        </p>

                        <div className="mt-6 space-y-2">
                            {tech.regions.slice(0, 4).map((r) => (
                                <div key={r.id} className="flex items-start gap-3">
                                    <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ background: `hsl(var(--${r.tone}))` }} />
                                    <p className="text-sm text-white/75 leading-snug">
                                        <span className="font-bold text-white">
                                            {REGIONS[r.id]?.short || r.id}
                                        </span>
                                        {"  "}{r.role}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ── The brain ─────────────────────────────────────────────── */}
            <div>
                <BrainModel regions={tech.regions} height={380} glow />
                <p className="text-[11px] text-white/35 leading-relaxed mt-4 max-w-md">
                    {REGION_NOTE}
                </p>
            </div>
        </div>
    );
}
