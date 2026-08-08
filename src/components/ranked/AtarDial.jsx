/**
 * AtarDial — the AcedIt ATAR as an arc, not a number in a box.
 *
 * The score is the thing the whole ladder is standardised around, and it was
 * rendered as plain text with five progress bars under it. A dial does two
 * things text can't: it shows where you sit on the range at a glance, and it
 * shows the bands as territory you're moving through, which is what makes a
 * number competitive rather than merely informative.
 *
 * The ticks are the band floors, so the next band is visible as a place on the
 * arc rather than as a sentence. That's the whole point — you can see how far
 * away it is.
 */
import React, { useEffect, useState } from "react";
import { BANDS } from "@/lib/ranked";

const TONE_STROKE = {
    muted: "stroke-muted-foreground", xp: "stroke-xp", "chart-3": "stroke-chart-3",
    "chart-4": "stroke-chart-4", primary: "stroke-primary", streak: "stroke-streak",
};
const TONE_FILL = {
    muted: "fill-muted-foreground", xp: "fill-xp", "chart-3": "fill-chart-3",
    "chart-4": "fill-chart-4", primary: "fill-primary", streak: "fill-streak",
};

// A 240° arc opening downwards — enough sweep to read as a gauge, with the gap
// at the bottom where the band label sits.
const START = 150, SWEEP = 240, MAX = 99.95;
const R = 84, CX = 100, CY = 100;

const polar = (angleDeg, radius = R) => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: CX + Math.cos(a) * radius, y: CY + Math.sin(a) * radius };
};
const arcPath = (fromDeg, toDeg, radius = R) => {
    const a = polar(fromDeg, radius), b = polar(toDeg, radius);
    const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${large} 1 ${b.x} ${b.y}`;
};
const angleFor = (v) => START + (Math.min(Math.max(v, 0), MAX) / MAX) * SWEEP;

export default function AtarDial({ atar, band, size = 220 }) {
    const [shown, setShown] = useState(0);

    // Counts up on mount. A score that lands instantly reads as a label; one
    // that climbs reads as a result.
    useEffect(() => {
        if (atar == null) { setShown(0); return; }
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        if (reduced) { setShown(atar); return; }
        const t0 = performance.now(), dur = 900;
        let raf = 0;
        const step = (t) => {
            const p = Math.min(1, (t - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            setShown(atar * eased);
            if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [atar]);

    const tone = BANDS.find(b => b.name === band)?.tone || "primary";
    const end = angleFor(shown);

    return (
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg viewBox="0 0 200 200" className="w-full h-full" role="img"
                aria-label={atar == null ? "AcedIt ATAR not available yet" : `AcedIt ATAR ${atar.toFixed(2)}, band ${band}`}>
                {/* Track */}
                <path d={arcPath(START, START + SWEEP)} fill="none" strokeWidth="14" strokeLinecap="round"
                    className="stroke-secondary" />

                {/* Band floors, so the next band is somewhere you can see. */}
                {BANDS.filter(b => b.min > 0).map(b => {
                    const a = angleFor(b.min);
                    const p1 = polar(a, R - 9), p2 = polar(a, R + 9);
                    return <line key={b.name} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                        strokeWidth="1.5" className="stroke-background" />;
                })}

                {/* Your score */}
                {atar != null && (
                    <path d={arcPath(START, Math.max(START + 0.01, end))} fill="none" strokeWidth="14"
                        strokeLinecap="round" className={TONE_STROKE[tone]} />
                )}

                {/* The head of the arc — where you are right now. */}
                {atar != null && shown > 0.5 && (
                    <circle cx={polar(end).x} cy={polar(end).y} r="7"
                        className={`${TONE_FILL[tone]} stroke-background`} strokeWidth="3" />
                )}

                <text x={CX} y={CY + 4} textAnchor="middle"
                    className="fill-foreground font-display" style={{ fontSize: 40, fontWeight: 900 }}>
                    {atar == null ? "—" : shown.toFixed(2)}
                </text>
                <text x={CX} y={CY + 26} textAnchor="middle"
                    className="fill-muted-foreground" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2 }}>
                    ACEDIT ATAR
                </text>
            </svg>
        </div>
    );
}
