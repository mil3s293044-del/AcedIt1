/**
 * ForgettingCurve — the one picture that explains the whole product.
 *
 * Two lines over a month. One is what a single pass through your notes leaves
 * you with. The other is the same material with reviews landing on it. The
 * first falls off a cliff inside a week; the second never leaves the top of
 * the chart. Nobody needs the argument spelled out after seeing it, which is
 * why this is worth more than any paragraph on the page.
 *
 * THE CURVE IS THE APP'S OWN MATHS. lib/retention models memory as
 * R(t) = e^(-t/S) and pins stability from the SM-2 interval as S = I / ln(10/9),
 * on the reasoning that the scheduler places the next review at the point
 * where recall has fallen to about 90%. The same two expressions are used
 * here. It is not a hand-drawn swoosh that looks roughly right, and it is not
 * a second model invented for marketing: change the retention model and this
 * chart changes with it.
 *
 * WHAT IT DOES NOT CLAIM. The unreviewed line's stability is a stand-in for
 * "read it once and walked away", and how fast that actually decays depends on
 * the person and the material. The label says schematic for that reason. The
 * SHAPE is the finding, and the shape is not in dispute.
 *
 * The reviews are drawn as cards, because that is what they are in the app.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

/** The same relation lib/retention pins stability with. */
const K = Math.log(10 / 9);            // ≈ 0.10536
const stability = (intervalDays) => intervalDays / K;
const recall = (t, S) => Math.exp(-t / S);

const DAYS = 30;

/**
 * One pass and nothing after it. The stability here stands in for a single
 * unreinforced exposure; it is the only number on this chart that is a
 * judgement call rather than a consequence of the model, and it is a generous
 * one. At S = 4.5 you still have a fifth of it after a week.
 */
const ALONE_S = 4.5;

/**
 * A realistic SM-2 ladder: tomorrow, then three days, then eight, then a
 * fortnight. Each review resets recall to full and buys a longer interval, which
 * is the entire trick and the reason the second line stays up.
 */
const REVIEWS = [1, 3, 8, 14];

/** Sample both lines once, at load, in chart space. */
function build(w, h, pad) {
    const x = (d) => pad + (d / DAYS) * (w - pad * 2);
    const y = (r) => pad + (1 - r) * (h - pad * 2);

    let alone = `M ${x(0)} ${y(1)}`;
    for (let d = 0.5; d <= DAYS; d += 0.5) alone += ` L ${x(d)} ${y(recall(d, ALONE_S))}`;

    // The reviewed line, walked interval by interval. Recall decays from full
    // to about 0.9 across each one, then the review puts it back to full.
    // EVERYTHING IS CLAMPED TO THE AXIS. The last review used to land on day
    // 33 on a 30-day chart, so the line ran out past the right-hand edge and
    // the fourth review marker was never drawn at all: the picture quietly
    // disagreed with its own caption about how many reviews there were.
    let spaced = `M ${x(0)} ${y(1)}`;
    const marks = [];
    let at = 0;
    for (const iv of REVIEWS) {
        const S = stability(iv);
        for (let step = 0.25; step <= iv && at + step <= DAYS; step += 0.25) {
            spaced += ` L ${x(at + step)} ${y(recall(step, S))}`;
        }
        at += iv;
        if (at > DAYS) break;
        marks.push({ day: at, x: x(at), y: y(1) });
        spaced += ` L ${x(at)} ${y(1)}`;                 // the review
    }
    // Past the last review it keeps decaying, slowly, on the long interval.
    const tailS = stability(REVIEWS[REVIEWS.length - 1] * 2.4);
    for (let step = 0.5; at + step <= DAYS; step += 0.5) {
        spaced += ` L ${x(at + step)} ${y(recall(step, tailS))}`;
    }
    return { alone, spaced, marks, x, y };
}

const W = 760, H = 320, PAD = 34;
const { alone, spaced, marks, x, y } = build(W, H, PAD);

export default function ForgettingCurve() {
    const reduce = useReducedMotion();
    const draw = (delay) => (reduce
        ? { pathLength: 1, transition: { duration: 0.2 } }
        : { pathLength: 1, transition: { duration: 1.6, delay, ease: "easeInOut" } });

    return (
        <div data-forgetting-curve className="w-full">
            <div className="overflow-x-auto">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]"
                    role="img"
                    aria-label="Two lines over thirty days. Without review, recall falls below a
                        fifth within a week and to almost nothing by day fourteen. With reviews on
                        days 1, 4, 12 and 26, recall never drops below about 90 percent.">

                    {/* Grid, and the one line that matters: 90 percent. */}
                    {[0, 0.25, 0.5, 0.75, 1].map((r) => (
                        <line key={r} x1={PAD} x2={W - PAD} y1={y(r)} y2={y(r)}
                            stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                    ))}
                    <line x1={PAD} x2={W - PAD} y1={y(0.9)} y2={y(0.9)}
                        stroke="rgba(88,204,2,0.35)" strokeWidth="1" strokeDasharray="4 5" />
                    {/* Left-hand end, because the reviewed line runs along the
                        right-hand end of this exact row and the label was
                        sitting underneath it. */}
                    <text x={PAD + 4} y={y(0.9) + 15} textAnchor="start"
                        className="fill-primary/70 text-[11px] font-bold">90% recall</text>

                    {[0, 7, 14, 21, 30].map((d) => (
                        <text key={d} x={x(d)} y={H - 8} textAnchor="middle"
                            className="fill-white/30 text-[11px] font-semibold">
                            {d === 0 ? "Day 0" : `Day ${d}`}
                        </text>
                    ))}

                    {/* Read once, never again. */}
                    <motion.path d={alone} fill="none" stroke="#FF4B4B" strokeWidth="3"
                        strokeLinecap="round"
                        initial={reduce ? false : { pathLength: 0 }}
                        whileInView={draw(0.1)}
                        viewport={{ once: true, margin: "-80px" }} />

                    {/* Reviewed as it fades. */}
                    <motion.path d={spaced} fill="none" stroke="#58CC02" strokeWidth="3"
                        strokeLinecap="round"
                        initial={reduce ? false : { pathLength: 0 }}
                        whileInView={draw(0.5)}
                        viewport={{ once: true, margin: "-80px" }} />

                    {/* Each review, as the card it is in the app. */}
                    {marks.map((m, i) => (
                        <motion.g key={m.day}
                            initial={reduce ? false : { opacity: 0, y: -8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-80px" }}
                            transition={{ delay: 0.8 + i * 0.16, duration: 0.35 }}>
                            <rect x={m.x - 7} y={m.y - 20} width="14" height="19" rx="2.5"
                                fill="#fff" stroke="#0D1626" strokeWidth="1" />
                            <text x={m.x} y={m.y - 8} textAnchor="middle"
                                className="fill-[#0D1626] text-[9px] font-black">
                                {i + 1}
                            </text>
                        </motion.g>
                    ))}
                </svg>
            </div>

            <div className="flex flex-wrap items-center gap-x-7 gap-y-2 mt-6">
                <span className="inline-flex items-center gap-2 text-sm text-white/70">
                    <span className="w-6 h-[3px] rounded-full" style={{ background: "#FF4B4B" }} />
                    Read it once
                </span>
                <span className="inline-flex items-center gap-2 text-sm text-white/70">
                    <span className="w-6 h-[3px] rounded-full" style={{ background: "#58CC02" }} />
                    Reviewed as it fades
                </span>
                <span className="text-xs text-white/35">
                    Schematic. R(t) = e raised to minus t over S, the same decay AcedIt schedules
                    your reviews from.
                </span>
            </div>
        </div>
    );
}
