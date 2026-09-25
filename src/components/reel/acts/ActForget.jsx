/**
 * Act II — WHAT YOU LOSE. The forgetting curve, dragged rather than watched.
 *
 * THE ARGUMENT ONLY LANDS IF THEY MOVE IT THEMSELVES. A chart of two lines is
 * a claim; a handle you drag until the number reads 12% is something you did to
 * yourself, and the difference in how hard it lands is the entire reason this
 * act is interactive rather than animated. The old page drew this on scroll,
 * which meant the student watched a number fall past them — a fact about a
 * chart. Dragging makes it a fact about their Tuesday.
 *
 * THE CURVE IS THE PRODUCT'S OWN. `aloneAt` and `spacedAt` come from lib/reel,
 * which derives them from `RETENTION_K` in lib/retention — the constant the
 * scheduler itself uses, derived from SM-2's 90% target. Nothing here is drawn
 * for effect: if the app's scheduling model changed, this picture would change
 * with it, because there is only one copy. A marketing chart that has drifted
 * from the product's model is worse than a wrong chart; it is a promise the app
 * then fails to keep.
 *
 * AND THE MODEL IS GENEROUS. `ALONE_S = 4.5` leaves a fifth of it after a week,
 * which is kinder than the literature would draw. Overstating the decay to make
 * the pitch land would be the exact thing this file refuses.
 *
 * A RANGE INPUT, NOT A HAND-ROLLED DRAG. It is reachable by keyboard, it is
 * announced correctly, it works under a screen reader and on touch, and it
 * cannot get stuck in a pointer-capture state. What it does NOT get is the
 * browser's own paint job — `accent-color` fills half a track and leaves the
 * rest to the user agent, which draws it from `color-scheme` rather than from
 * anything on this page. The fill is on the INPUT's own background, positioned
 * from the value, the same way the Compete floor's slider is.
 */
import React, { useState, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { aloneAt, spacedAt, forgettingReadout, CURVE_DAYS, REVIEWS } from "@/lib/reel";
import { useAct } from "@/components/reel/ReelContext";
import Cue from "@/components/reel/Cue";

/* PAD_T IS HEADROOM FOR THE SAW, not a margin. The reviewed line returns to
   FULL recall at every review, so at PAD_T = 14 those peaks sat against the
   top edge of the viewBox and the fourth review's marker read as a dot
   floating free of a line that appeared to stop early. The line has to have
   somewhere to go when it recovers, or the one thing this chart is
   demonstrating is the thing you cannot see. */
const W = 720, H = 210, PAD_L = 16, PAD_R = 16, PAD_T = 26, PAD_B = 22;
const px = (d) => PAD_L + (d / CURVE_DAYS) * (W - PAD_L - PAD_R);
const py = (r) => PAD_T + (1 - r) * (H - PAD_T - PAD_B);

/** Sampled once at module load — neither line depends on anything at runtime. */
const PATHS = (() => {
    let alone = `M ${px(0)} ${py(1)}`;
    let spaced = `M ${px(0)} ${py(1)}`;
    for (let d = 0.25; d <= CURVE_DAYS; d += 0.25) {
        alone += ` L ${px(d)} ${py(aloneAt(d))}`;
        spaced += ` L ${px(d)} ${py(spacedAt(d))}`;
    }
    // Review markers: the cumulative days the ladder actually lands on, and
    // ONLY the ones that fit on the chart. The old version's fourth review
    // landed on day 33 of a 30-day chart, so the picture quietly disagreed
    // with its own caption about how many reviews there were.
    const marks = [];
    let at = 0;
    for (const iv of REVIEWS) { at += iv; if (at <= CURVE_DAYS) marks.push(at); }
    return { alone, spaced, marks };
})();

const INK = "#F4F7FB";

export default function ActForget() {
    const { advance, deal, played } = useAct("forget");
    const reduce = useReducedMotion();
    const [days, setDays] = useState(0);
    const r = useMemo(() => forgettingReadout(days), [days]);

    const onDrag = (v) => {
        const d = Number(v);
        setDays(d);
        deal({ readout: forgettingReadout(d) });
    };

    const fillPct = (days / CURVE_DAYS) * 100;

    return (
        <div className="w-full flex flex-col items-center text-center" style={{ color: INK }}>
            <p className="text-[11px] sm:text-xs font-black tracking-[0.2em] uppercase opacity-40">
                The problem
            </p>
            {/* One line at desktop. At lg:3.1rem in a max-w-3xl this broke as
                "Then your brain threw it / out." — an orphan, and the extra
                line pushed the cue under the fixed hand rail. */}
            <h2 className="mt-2 font-display font-black leading-[1.03] tracking-tight
                           text-[7vw] sm:text-[3.4vw] lg:text-[2.6rem] max-w-4xl">
                You did the work.{" "}
                <span className="opacity-45">Then your brain threw it out.</span>
            </h2>

            {/* THE READOUT LEADS, because it is the thing that changes when they
                drag and it has to be the biggest thing on screen or the drag
                does not feel connected to anything. */}
            <div className="mt-5 flex items-end justify-center gap-8 sm:gap-14 tabular-nums">
                <div>
                    <div className="font-display font-black leading-none text-[14vw] sm:text-[4.4rem]"
                         style={{ color: "#FF4B4B" }}>
                        {r.alone}<span className="text-[6vw] sm:text-[2rem]">%</span>
                    </div>
                    <div className="mt-1 text-[10px] sm:text-xs font-black uppercase tracking-wider opacity-50">
                        Studied once
                    </div>
                </div>
                <div>
                    <div className="font-display font-black leading-none text-[14vw] sm:text-[4.4rem] text-primary">
                        {r.spaced}<span className="text-[6vw] sm:text-[2rem]">%</span>
                    </div>
                    <div className="mt-1 text-[10px] sm:text-xs font-black uppercase tracking-wider opacity-50">
                        Reviewed on schedule
                    </div>
                </div>
            </div>

            {/* The chart. Atmosphere — every figure is in the HTML above it, so
                nothing factual is lost if this never paints. */}
            <div className="mt-4 w-full max-w-3xl">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-hidden>
                    <line x1={PAD_L} y1={py(0)} x2={W - PAD_R} y2={py(0)}
                          stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
                    {/* Where full recall sits, so the review peaks are read as
                        returning TO something rather than as noise. */}
                    <line x1={PAD_L} y1={py(1)} x2={W - PAD_R} y2={py(1)}
                          stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="3 6" />
                    <motion.path
                        d={PATHS.alone} fill="none" stroke="#FF4B4B" strokeWidth="3" strokeLinecap="round"
                        initial={{ pathLength: 0 }} animate={{ pathLength: played ? 1 : 0 }}
                        transition={{ duration: reduce ? 0 : 1.1, ease: "easeOut" }}
                    />
                    <motion.path
                        d={PATHS.spaced} fill="none" stroke="#58CC02" strokeWidth="3" strokeLinecap="round"
                        initial={{ pathLength: 0 }} animate={{ pathLength: played ? 1 : 0 }}
                        transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : 0.25, ease: "easeOut" }}
                    />
                    {PATHS.marks.map((d) => (
                        <circle key={d} cx={px(d)} cy={py(1)} r="4" fill="#58CC02" opacity="0.9" />
                    ))}
                    {/* The playhead. Drawn only once they have moved it: at day
                        zero a marker on the y-axis implies a reading that has
                        not been taken. */}
                    {days > 0 && (
                        <g>
                            <line x1={px(days)} y1={PAD_T} x2={px(days)} y2={py(0)}
                                  stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" strokeDasharray="4 4" />
                            <circle cx={px(days)} cy={py(aloneAt(days))} r="6" fill="#FF4B4B" />
                            <circle cx={px(days)} cy={py(spacedAt(days))} r="6" fill="#58CC02" />
                        </g>
                    )}
                </svg>
            </div>

            {/* The control. */}
            <div className="mt-2 w-full max-w-lg px-2">
                <input
                    type="range"
                    min={0} max={CURVE_DAYS} step={1} value={days}
                    onChange={(e) => onDrag(e.target.value)}
                    aria-label="Days since you studied it"
                    aria-valuetext={`${days} days: ${r.alone}% left unreviewed, ${r.spaced}% reviewed`}
                    className="reel-range w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, ${INK} 0%, ${INK} ${fillPct}%, rgba(244,247,251,0.16) ${fillPct}%, rgba(244,247,251,0.16) 100%)`,
                    }}
                />
                <div className="mt-2 flex justify-between text-[10px] sm:text-xs font-bold opacity-45">
                    <span>the day you studied it</span>
                    <span className="font-black opacity-90">
                        {days === 0 ? "drag me" : `${days} day${days === 1 ? "" : "s"} later`}
                    </span>
                    <span>{CURVE_DAYS} days</span>
                </div>
            </div>

            <Cue done={days > 0} onAdvance={advance} nextLabel="So how do you know what you actually dropped?" ink={INK}>
                Drag to see what is left
            </Cue>
        </div>
    );
}
