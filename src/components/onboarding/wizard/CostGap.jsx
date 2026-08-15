/**
 * CostGap — the price difference as a shape, over a real VCE year.
 *
 * "$90 an hour versus $5 a week" is a true sentence that lands as two numbers
 * and is forgotten by the next screen. The same fact drawn over forty school
 * weeks is a pair of lines that pull apart until one of them is off the top,
 * and the number at the end is one nobody has to be talked into: about three
 * and a half thousand dollars against two hundred.
 *
 * WHAT IT DOES NOT DO is sneer at tutors. A good tutor is worth the money and
 * pretending otherwise would insult every student who has one, most of whom
 * did not choose the price. The caption says the honest thing: this is not
 * better than a tutor, it is forty weeks of something rather than one hour of
 * something else, and it is there on a Sunday night.
 *
 * DRAWN AS SVG WITH THE NUMBERS COMPUTED, not as a picture with the figures
 * typed in underneath. The totals in the labels come off the same arrays the
 * lines are drawn from, so the graph and the caption cannot drift apart, which
 * is exactly what happens to a chart whose summary is written by hand.
 *
 * The assumptions are printed. $90/hour once a week in term time is the
 * Melbourne rate and 40 weeks is the VCE school year; anyone who thinks either
 * is wrong can see what they would change.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

const WEEKS = 40;
const TUTOR_HOURLY = 90;
const ACEDIT_WEEKLY = 5;

const W = 320, H = 168, PAD_L = 40, PAD_R = 12, PAD_T = 14, PAD_B = 26;
const plotW = W - PAD_L - PAD_R;
const plotH = H - PAD_T - PAD_B;

/** Cumulative spend, week by week. Both series come from here. */
function series(perWeek) {
    return Array.from({ length: WEEKS + 1 }, (_, w) => w * perWeek);
}

const TUTOR = series(TUTOR_HOURLY);
const ACEDIT = series(ACEDIT_WEEKLY);
const TOP = TUTOR[WEEKS];

const x = (w) => PAD_L + (w / WEEKS) * plotW;
const y = (v) => PAD_T + plotH - (v / TOP) * plotH;
const path = (vals) => vals.map((v, w) => `${w === 0 ? "M" : "L"}${x(w)} ${y(v)}`).join(" ");

const money = (n) => `$${n.toLocaleString("en-AU")}`;

export default function CostGap() {
    const reduce = useReducedMotion();
    const view = { once: true, margin: "-60px" };

    return (
        <div data-cost-gap className="card-soft p-5 lg:p-6">
            <p className="stat-label text-primary mb-1">One VCE year, both ways</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Cumulative spend across {WEEKS} school weeks.
            </p>

            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
                aria-label={`Cumulative cost over ${WEEKS} weeks: a tutor reaches ${money(TOP)}, AcedIt reaches ${money(ACEDIT[WEEKS])}.`}>
                {/* Horizontal rules. Four is enough to read a value off and few
                    enough that the lines stay the loudest thing on the chart. */}
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                    <g key={f}>
                        <line x1={PAD_L} x2={W - PAD_R} y1={y(TOP * f)} y2={y(TOP * f)}
                            className="stroke-border" strokeWidth="1" />
                        <text x={PAD_L - 6} y={y(TOP * f) + 3} textAnchor="end"
                            className="fill-muted-foreground text-[8px] font-bold">
                            {f === 0 ? "$0" : `$${Math.round((TOP * f) / 100) / 10}k`}
                        </text>
                    </g>
                ))}

                {/* The gap itself, filled. The area between the lines IS the
                    thing being argued, and leaving it empty makes the reader
                    do the subtraction. */}
                <motion.path
                    d={`${path(TUTOR)} L${x(WEEKS)} ${y(ACEDIT[WEEKS])} ${
                        ACEDIT.map((v, w) => `L${x(WEEKS - w)} ${y(ACEDIT[WEEKS - w])}`).join(" ")} Z`}
                    className="fill-primary/10"
                    initial={reduce ? { opacity: 1 } : { opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={view}
                    transition={{ duration: 0.5, delay: 0.5 }}
                />

                <motion.path d={path(TUTOR)} fill="none" className="stroke-streak"
                    strokeWidth="2.5" strokeLinecap="round"
                    initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                    whileInView={{ pathLength: 1 }} viewport={view}
                    transition={{ duration: 0.9, ease: "easeInOut" }} />
                <motion.path d={path(ACEDIT)} fill="none" className="stroke-primary"
                    strokeWidth="2.5" strokeLinecap="round"
                    initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                    whileInView={{ pathLength: 1 }} viewport={view}
                    transition={{ duration: 0.9, ease: "easeInOut", delay: 0.1 }} />

                <text x={PAD_L} y={H - 8} className="fill-muted-foreground text-[8px] font-bold">
                    Week 1
                </text>
                <text x={W - PAD_R} y={H - 8} textAnchor="end"
                    className="fill-muted-foreground text-[8px] font-bold">
                    Week {WEEKS}
                </text>
            </svg>

            {/* The totals, off the same arrays the lines were drawn from. */}
            <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl bg-secondary/60 border border-border p-3">
                    <span className="flex items-center gap-1.5 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-streak flex-shrink-0" />
                        <span className="stat-label text-muted-foreground">A tutor</span>
                    </span>
                    <p className="font-display font-extrabold text-foreground text-xl leading-none tabular-nums">
                        {money(TOP)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        One hour a week at ${TUTOR_HOURLY}
                    </p>
                </div>
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
                    <span className="flex items-center gap-1.5 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
                        <span className="stat-label text-primary">AcedIt</span>
                    </span>
                    <p className="font-display font-extrabold text-foreground text-xl leading-none tabular-nums">
                        {money(ACEDIT[WEEKS])}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        Every day, every subject
                    </p>
                </div>
            </div>

            <p className="text-[11px] text-muted-foreground/70 mt-4 leading-relaxed">
                A good tutor is worth what they charge, and this is not a claim to be better
                than one. It is {WEEKS} weeks of something against {WEEKS} hours of something
                else, and it is awake at eleven on a Sunday.
            </p>
        </div>
    );
}
