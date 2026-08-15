/**
 * ScalingReport — what the subjects you just picked are actually worth.
 *
 * THE PROBLEM THIS SOLVES. Four of the six wizard screens took something and
 * gave nothing back. A form that asks five questions and answers none of them
 * is a form, however good it looks, and the persuasion was all stacked on one
 * screen at the end where it read as a pitch because that is what it was.
 *
 * So this pays out the moment the subjects are in. It is the VTAC 2025 Scaling
 * Report, filtered to exactly the subjects this student takes, which is a
 * genuinely useful document that nobody hands a Year 11 at the point they are
 * choosing anything. Most students hear about scaling as a rumour: Specialist
 * is worth doing "because it scales", Further "drags you down". Here are the
 * actual numbers, for their actual line-up, with the source named.
 *
 * WHY IT PERSUADES BY BEING USEFUL. Nothing on this panel is a claim about
 * AcedIt. It is data the app happened to be holding, given away before signup,
 * and the argument it makes is the strongest kind available: this product
 * knows what it is talking about. A student who learns something true at step
 * two believes the graph at step five.
 *
 * THE NUMBERS ARE VTAC'S, NOT OURS, and the citation says so. `scaling_factor`
 * and `mean_study_score` come straight out of src/data/vceSubjects.js, which
 * documents the 2025 report as its source. Custom subjects, and anything not in
 * the catalogue, carry no scaling data and are listed separately rather than
 * being drawn at zero — a subject shown with a flat bar it never earned is a
 * lie the picture tells on its own.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { VCE_SUBJECTS } from "@/data/vceSubjects";
import { colorFor } from "@/components/cards/cardIdentity";

/** "+4" → 4, "-3.5" → -3.5, anything unparseable → null. */
function factorOf(sub) {
    const raw = sub?.scaling_info?.scaling_factor;
    if (raw == null) return null;
    const n = Number(String(raw).replace(/[^\d.+-]/g, ""));
    return Number.isFinite(n) ? n : null;
}

/**
 * Join the picked subjects to the catalogue.
 *
 * Matched on code first and name second, because a custom subject the student
 * typed can collide on neither and must fall through to the unscaled list.
 */
export function scalingFor(picked = []) {
    const scaled = [];
    const unscaled = [];
    picked.forEach((p) => {
        const cat = VCE_SUBJECTS.find(
            (v) => (p.code && v.code === p.code) || v.name === p.name);
        const f = factorOf(cat);
        if (cat && f != null) {
            scaled.push({
                name: cat.name,
                factor: f,
                mean: cat.scaling_info?.mean_study_score ?? null,
                note: cat.scaling_info?.scaling_description || "",
                color: colorFor(cat.name),
            });
        } else {
            unscaled.push(p.name);
        }
    });
    scaled.sort((a, b) => b.factor - a.factor);
    return { scaled, unscaled };
}

/** A raw 30 in this subject becomes this. The number students actually want. */
const scaled30 = (f) => Math.round(30 + f);

export default function ScalingReport({ subjects = [] }) {
    const reduce = useReducedMotion();
    const { scaled, unscaled } = scalingFor(subjects);
    if (scaled.length === 0 && unscaled.length === 0) return null;

    // The bars are drawn around zero, because scaling goes both ways and a
    // chart with its baseline at the minimum would make a subject that scales
    // DOWN look like a small positive. The widest bar in either direction sets
    // the scale, so the picture is honest about the spread in this hand rather
    // than against some fixed maximum nobody has.
    const reach = Math.max(4, ...scaled.map((s) => Math.abs(s.factor)));

    return (
        <motion.div
            data-scaling-report
            className="card-soft p-5 lg:p-6"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                <p className="stat-label text-primary">Your scaling report</p>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    VTAC 2025
                </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                What a raw study score of 30 becomes in each of your subjects, from
                the official report. Most students only ever hear this as a rumour.
            </p>

            <div className="space-y-3">
                {scaled.map((s, i) => {
                    const up = s.factor >= 0;
                    const pct = (Math.abs(s.factor) / reach) * 50;
                    return (
                        <div key={s.name} data-scale-row={s.name}>
                            <div className="flex items-baseline justify-between gap-3 mb-1">
                                <span className="text-[13px] font-bold text-foreground truncate
                                    flex items-center gap-1.5 min-w-0">
                                    {/* The subject's colour lives on a dot, not
                                        on the bar. On the bar it was actively
                                        misleading: Mathematical Methods hashes
                                        to red, so a subject that scales UP was
                                        drawn in the colour every other chart in
                                        the app uses for loss. */}
                                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ background: s.color }} />
                                    <span className="truncate">{s.name}</span>
                                </span>
                                <span className="text-[13px] font-bold tabular-nums flex-shrink-0
                                    text-muted-foreground">
                                    30 <span className="text-muted-foreground/50">→</span>{" "}
                                    <span className={up ? "text-primary" : "text-streak"}>
                                        {scaled30(s.factor)}
                                    </span>
                                </span>
                            </div>
                            {/* Zero is the centre line. Bars grow out from it. */}
                            <div className="relative h-2.5 rounded-full bg-muted/60 overflow-hidden">
                                <span aria-hidden="true"
                                    className="absolute inset-y-0 left-1/2 w-px bg-border" />
                                <motion.span
                                    className={`absolute inset-y-0 rounded-full ${
                                        up ? "bg-primary" : "bg-streak"}`}
                                    style={{ [up ? "left" : "right"]: "50%" }}
                                    initial={reduce ? { width: `${pct}%` } : { width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={reduce
                                        ? { duration: 0 }
                                        : { duration: 0.55, delay: 0.15 + i * 0.07,
                                            ease: [0.2, 0.8, 0.2, 1] }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {unscaled.length > 0 && (
                <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                    No published scaling for {unscaled.join(", ")}
                    {unscaled.length === 1 ? " yet" : ""}. Left off rather than drawn at zero.
                </p>
            )}

            <p className="text-[11px] text-muted-foreground/70 mt-5 pt-4 border-t border-border
                leading-relaxed">
                VTAC 2025 Scaling Report. Scaling is applied to the whole state, not to you,
                and it is not a reason to drop a subject you are good at.
            </p>
        </motion.div>
    );
}
