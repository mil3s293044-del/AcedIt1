/**
 * ScoreCurve — the state's study-score distribution, with your target on it.
 *
 * ─── The curve IS the input ─────────────────────────────────────────────────
 * `goal_study_score` has been on `user_subjects` since migration 0002 and
 * nothing has ever set it, so a chart of it would have been a chart of null.
 * Drag the handle and the target moves; there is no separate control, because
 * a slider under a picture of a slider is two things doing one job.
 *
 * ─── What the two shaded regions MEAN ───────────────────────────────────────
 * This is the whole reason to draw a curve rather than print a number. The
 * area under a distribution is a COUNT of people, so:
 *
 *   left of the marker    everyone you would finish ahead of
 *   right of the marker   everyone still ahead of you — the "top X%"
 *
 * The right tail is inked harder even though it is the smaller region,
 * because it is the one the number refers to. A student dragging from 30 to 45
 * watches that sliver close, which is the fact "top 2%" is trying to convey
 * and cannot.
 *
 * ─── Nothing here is estimated ──────────────────────────────────────────────
 * VCAA constructs every study's raw score to mean 30, SD 7. See studyScore.js
 * for why the subject's catalogue mean is NOT plotted on this curve — it is a
 * scaled figure, and putting it here would be off by up to eleven points.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
    SCORE_MIN, SCORE_MAX, STATE_MEAN, clampScore, curvePoints, topPercentLabel,
} from "@/lib/studyScore";

// The drawing box. Wide and short: this is a strip beside a row, not a chart
// on a dashboard, and a tall bell in a card row reads as a hill nobody climbs.
const W = 300;
const H = 76;
const PAD_B = 12;               // the axis rule and its numbers
const PAD_T = 11;               // the handle, which sits above the curve
// Horizontal inset, and it is not cosmetic: the ticks are centred on their own
// score, so a "50" drawn at x = W has half of itself outside the viewBox and
// renders as a lone "5".
const PAD_X = 11;

const xOf = (score) =>
    PAD_X + ((score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * (W - 2 * PAD_X);
const yOf = (height) => (H - PAD_B) - height * (H - PAD_B - PAD_T);

/** The outline, once. The shape never changes, so neither does this. */
const POINTS = curvePoints(80);
const OUTLINE = POINTS
    .map((p, i) => `${i ? "L" : "M"}${xOf(p.score).toFixed(2)} ${yOf(p.height).toFixed(2)}`)
    .join(" ");

/**
 * The whole area under the curve, once, closed down to the baseline.
 *
 * The two shaded regions are this ONE path shown through two clip rectangles,
 * and the marker moves by animating those rectangles. The obvious alternative
 * — rebuilding the path for each region and tweening `d` — cannot work here:
 * an interpolator can only walk between two paths with the same number of
 * points, and a region from 0 to 12 has a different sample count from one from
 * 0 to 44, so it would snap rather than sweep. Clipping also guarantees the
 * fill and the stroke are the same curve, instead of two samplings of one
 * function that can leave a hairline of background between them.
 */
const AREA = `${OUTLINE} L${xOf(SCORE_MAX)} ${H - PAD_B} L${xOf(SCORE_MIN)} ${H - PAD_B} Z`;

const TICKS = [10, 20, 30, 40, 50];

export default function ScoreCurve({ target, tone, scaled, onChange, onCommit, label }) {
    const svgRef = useRef(null);
    // `useId` returns ":r3:" and a colon in an id is legal in XML but hostile
    // in a `url(#...)` reference. PlayingCard's CardBack sanitises for the same
    // reason — two curves on one page must not resolve to one gradient.
    const uid = `sc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
    const reduce = useReducedMotion();
    const [dragging, setDragging] = useState(false);
    // Mount animation runs once. Re-running it whenever the target changes
    // would replay a 700ms sweep on every step of a drag.
    const [entered, setEntered] = useState(false);
    useEffect(() => { const t = setTimeout(() => setEntered(true), 30); return () => clearTimeout(t); }, []);

    const set = target == null ? null : clampScore(target);
    // Unset shows the handle at the mean, dashed and muted, and the readout
    // asks rather than reporting. Drawn solid it would claim a target of 30 —
    // the app inventing an answer to the question it is asking.
    const shown = set ?? STATE_MEAN;

    const scoreAt = useCallback((clientX) => {
        const box = svgRef.current?.getBoundingClientRect();
        if (!box || !box.width) return null;
        const ratio = (clientX - box.left) / box.width;
        return clampScore(SCORE_MIN + ratio * (SCORE_MAX - SCORE_MIN));
    }, []);

    // Pointer capture on the SVG, so a drag that leaves the strip keeps
    // tracking — the handle is 14px wide and the curve is 74px tall, so a
    // vertical wobble mid-drag would otherwise drop it.
    const onPointerDown = (e) => {
        e.preventDefault();
        const next = scoreAt(e.clientX);
        if (next == null) return;
        setDragging(true);
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
        onChange?.(next);
    };
    const onPointerMove = (e) => {
        if (!dragging) return;
        const next = scoreAt(e.clientX);
        if (next != null) onChange?.(next);
    };
    const endDrag = (e) => {
        if (!dragging) return;
        setDragging(false);
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
        // The write happens ONCE, here. Committing on every move would be a
        // round trip per pixel of a drag across fifty of them.
        onCommit?.();
    };

    const onKeyDown = (e) => {
        const step = e.shiftKey ? 5 : 1;
        let next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") next = shown + step;
        else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = shown - step;
        else if (e.key === "Home") next = SCORE_MIN;
        else if (e.key === "End") next = SCORE_MAX;
        if (next == null) return;
        e.preventDefault();
        onChange?.(clampScore(next));
        onCommit?.();
    };

    const sweep = reduce || entered ? shown : SCORE_MIN;
    // One transition for every animated part, so the fill, the handle and the
    // number cannot arrive at different times. Instant while dragging: a spring
    // chasing the pointer reads as lag, not as polish.
    const ease = reduce || dragging
        ? { duration: 0 }
        : { duration: 0.7, ease: [0.22, 1, 0.36, 1] };

    return (
        <div className="w-full select-none">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className={`w-full h-auto touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                role="slider"
                tabIndex={0}
                aria-label={label || "Target study score"}
                aria-valuemin={SCORE_MIN}
                aria-valuemax={SCORE_MAX}
                aria-valuenow={shown}
                aria-valuetext={set == null
                    ? "No target set"
                    : `${shown}, ${topPercentLabel(shown)} of the state`}
                onKeyDown={onKeyDown}
            >
                <defs>
                    <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={tone} stopOpacity="0.55" />
                        <stop offset="100%" stopColor={tone} stopOpacity="0.12" />
                    </linearGradient>
                    <clipPath id={`${uid}-l`}>
                        <motion.rect x="0" y="0" height={H} initial={false}
                            animate={{ width: xOf(sweep) }} transition={ease} />
                    </clipPath>
                    <clipPath id={`${uid}-r`}>
                        <motion.rect y="0" height={H} initial={false}
                            animate={{ x: xOf(sweep), width: W - xOf(sweep) }}
                            transition={ease} />
                    </clipPath>
                </defs>

                {/* NOTHING is shaded until a target exists. The regions mean
                    "ahead of you" and "still ahead of you", and with no target
                    there is no you — shading either side of the ghost handle
                    draws a claim that the student is aiming at 30, which is
                    the question the strip is asking them. The fill arriving on
                    the first drag is also the clearest possible signal that
                    the drag did something. */}
                {set != null && (
                    <>
                        {/* Everyone you would finish ahead of. Quiet — it is
                            the big region and not what the number refers to. */}
                        <path d={AREA} fill={tone} fillOpacity={0.13}
                            clipPath={`url(#${uid}-l)`} />
                        {/* The tail the number is about, inked harder despite
                            being the smaller region. Watching it close as you
                            drag from 30 to 45 is the thing "top 2%" is trying
                            to say and cannot. */}
                        <path d={AREA} fill={`url(#${uid}-g)`} clipPath={`url(#${uid}-r)`} />
                    </>
                )}

                <path d={OUTLINE} fill="none" stroke={tone} strokeOpacity="0.85"
                    strokeWidth="2" strokeLinejoin="round" />

                {/* Baseline and the ticks a student reads the scale off. */}
                <line x1="0" y1={H - PAD_B} x2={W} y2={H - PAD_B}
                    stroke="currentColor" strokeOpacity="0.18" strokeWidth="1"
                    className="text-foreground" />
                {TICKS.map((t) => (
                    <g key={t}>
                        <line x1={xOf(t)} y1={H - PAD_B} x2={xOf(t)} y2={H - PAD_B + 3}
                            stroke="currentColor" strokeOpacity="0.25" strokeWidth="1"
                            className="text-foreground" />
                        <text x={xOf(t)} y={H - 1} textAnchor="middle"
                            className="fill-muted-foreground" style={{ fontSize: 8 }}>{t}</text>
                    </g>
                ))}

                {/* The state average, always 30 — the anchor the whole scale is
                    built around, and the thing a target is implicitly measured
                    against. Dotted so it cannot be mistaken for the handle. */}
                <line x1={xOf(STATE_MEAN)} y1={yOf(1) - 2} x2={xOf(STATE_MEAN)} y2={H - PAD_B}
                    stroke="currentColor" strokeOpacity="0.3" strokeWidth="1"
                    strokeDasharray="2 3" className="text-foreground" />

                {/* The handle. It carries no number: the readout under the
                    strip already prints one, larger and in the same ink, and a
                    13px label riding the marker sat straight on the tick
                    numbers at either end of the scale. */}
                <motion.g initial={false} animate={{ x: xOf(sweep) }} transition={ease}>
                    <line x1="0" y1={PAD_T - 5} x2="0" y2={H - PAD_B}
                        stroke={set == null ? "currentColor" : tone}
                        strokeOpacity={set == null ? 0.4 : 1}
                        strokeWidth="2"
                        strokeDasharray={set == null ? "3 3" : undefined}
                        className="text-muted-foreground" />
                    <circle cx="0" cy={PAD_T - 5} r={dragging ? 6 : 5}
                        fill={set == null ? "hsl(var(--surface))" : tone}
                        stroke={set == null ? "currentColor" : tone}
                        strokeOpacity={set == null ? 0.5 : 1}
                        strokeWidth="2" className="text-muted-foreground" />
                </motion.g>
            </svg>

            <div className="flex items-baseline gap-2 mt-1 min-h-[1.25rem]">
                {set == null ? (
                    <p className="text-[11px] text-muted-foreground">
                        Drag the curve to set a target
                    </p>
                ) : (
                    <>
                        <span className="font-display font-extrabold text-lg leading-none
                            tabular-nums" style={{ color: tone }}>{shown}</span>
                        <p className="text-[11px] text-muted-foreground">
                            <span className="font-bold text-foreground">{topPercentLabel(shown)}</span>
                            {" "}of the state
                        </p>
                        {/* "ahead of 87%" used to sit here beside "top 13%".
                            They are the same fact subtracted from 100 — the
                            page saying one number twice and calling it two. */}
                        {scaled != null && (
                            <p className="text-[11px] text-muted-foreground tabular-nums ml-auto"
                                title="Approximate — VTAC scaling, from the single anchor point in our catalogue">
                                ≈ {scaled} scaled
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
