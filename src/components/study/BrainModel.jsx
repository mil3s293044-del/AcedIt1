/**
 * BrainModel — a rotating 3D brain with the regions for a technique lit up.
 *
 * Genuinely 3D: a point cloud in real coordinates, rotated by a matrix and
 * projected with perspective each frame. Not a spinning picture. It's drawn to
 * a canvas rather than to SVG because 900 nodes re-rendered through React at
 * 60fps is a slideshow, and hand-rolled rather than with three.js because the
 * whole thing is about 120 lines and a WebGL context on a mid-range phone is a
 * real cost for something decorative.
 *
 * The point cloud is the atmosphere. The INFORMATION lives in the HTML legend
 * beside it, which is where a screen reader, a search engine and anyone with
 * `prefers-reduced-motion` will find it. If the canvas never painted, nothing
 * factual would be lost — that's deliberate.
 */
import React, { useEffect, useRef, useState } from "react";
import { REGIONS } from "@/lib/neuro";

// Tailwind can't be read from a canvas, so the tones are resolved from the CSS
// variables at paint time — which also means they follow light/dark.
const TONE_VAR = {
    primary: "--primary", xp: "--xp", "chart-3": "--chart-3",
    "chart-4": "--chart-4", streak: "--streak", map: "--map",
};

/** Fibonacci sphere — evenly spread points, no clumping at the poles. */
function sphere(n) {
    const pts = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const th = golden * i;
        pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    return pts;
}

/**
 * Bend a sphere into something brain-shaped: longer front-to-back than it is
 * wide, flatter underneath, a cleft down the midline between the hemispheres,
 * a narrower frontal pole and a cerebellum tucked under the back.
 */
function brainCloud(n) {
    const out = [];
    for (const [x, y, z] of sphere(n)) {
        let px = x * 0.82, py = y * 0.74, pz = z * 1.06;
        if (py < 0) py *= 0.72;                       // flat underside
        if (pz > 0.4) { px *= 0.86; py *= 0.92; }     // tapered frontal pole
        const cleft = Math.exp(-(px * px) / 0.004) * Math.max(0, py) * 0.16;
        py -= cleft;                                   // longitudinal fissure
        // Gyri: a little radial noise so it reads as folded, not as a balloon.
        const fold = 1 + 0.045 * Math.sin(px * 17) * Math.cos(pz * 13) + 0.03 * Math.sin(py * 21);
        out.push([px * fold, py * fold, pz * fold]);
    }
    // Cerebellum — a small dense lobe under the back, which is most of what
    // makes a brain silhouette read as a brain.
    for (const [x, y, z] of sphere(Math.round(n * 0.22))) {
        out.push([x * 0.42, y * 0.24 - 0.58, z * 0.34 - 0.62]);
    }
    return out;
}

const CLOUD = brainCloud(760);

const rotate = ([x, y, z], yaw, pitch) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
};

export default function BrainModel({ regions = [], className = "", height = 220 }) {
    const canvasRef = useRef(null);
    const wrapRef = useRef(null);
    const yaw = useRef(0.6);
    const pitch = useRef(-0.12);
    const drag = useRef(null);
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        if (!mq) return;
        const on = () => setReduced(mq.matches);
        on();
        mq.addEventListener?.("change", on);
        return () => mq.removeEventListener?.("change", on);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!canvas || !wrap) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let raf = 0, stop = false;
        const css = getComputedStyle(document.documentElement);
        const tone = (t) => {
            const v = css.getPropertyValue(TONE_VAR[t] || "--map").trim();
            return v ? `hsl(${v}` : "hsl(175 80% 40%";     // caller closes with " / a)"
        };
        // Resolved once per mount; a theme flip remounts via the key upstream.
        const hot = regions.map(r => ({
            xyz: REGIONS[r.id]?.xyz || [0, 0, 0],
            colour: tone(r.tone),
        }));
        const base = css.getPropertyValue("--muted-foreground").trim() || "220 9% 46%";

        const draw = () => {
            const rect = wrap.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.max(1, rect.width), h = Math.max(1, height);
            if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
                canvas.width = Math.round(w * dpr);
                canvas.height = Math.round(h * dpr);
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);

            const scale = Math.min(w * 0.30, h * 0.46);
            const cx = w / 2, cy = h / 2;
            const t = reduced ? 0 : Date.now() / 1000;

            // Depth sort so near points paint over far ones.
            const drawn = CLOUD.map(p => {
                const [x, y, z] = rotate(p, yaw.current, pitch.current);
                const persp = 2.6 / (2.6 + z);
                return { x: cx + x * scale * persp, y: cy - y * scale * persp, z, persp, src: p };
            }).sort((a, b) => a.z - b.z);

            for (const p of drawn) {
                // Nearest highlighted region wins, and only within its radius.
                let best = null, bestD = 1;
                for (const hRegion of hot) {
                    const [hx, hy, hz] = hRegion.xyz;
                    // Mirror across the midline: a region named once lights both
                    // hemispheres, which is what the imaging actually shows.
                    const d = Math.min(
                        Math.hypot(p.src[0] - hx, p.src[1] - hy, p.src[2] - hz),
                        Math.hypot(p.src[0] + hx, p.src[1] - hy, p.src[2] - hz));
                    if (d < 0.42 && d < bestD) { bestD = d; best = hRegion; }
                }
                const depth = (p.z + 1.2) / 2.4;                 // 0 back → 1 front
                if (best) {
                    const falloff = 1 - bestD / 0.42;
                    const pulse = reduced ? 0.85 : 0.72 + 0.28 * Math.sin(t * 2 + bestD * 6);
                    const a = (0.25 + 0.75 * falloff * falloff) * pulse * (0.45 + 0.55 * depth);
                    ctx.fillStyle = `${best.colour} / ${a.toFixed(3)})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, (1.1 + 2.6 * falloff) * p.persp, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillStyle = `hsl(${base} / ${(0.16 + 0.26 * depth).toFixed(3)})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 1.15 * p.persp, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            if (!reduced && !drag.current) yaw.current += 0.0035;
            if (!stop) raf = requestAnimationFrame(draw);
        };
        draw();
        return () => { stop = true; cancelAnimationFrame(raf); };
    }, [regions, height, reduced]);

    const onDown = (e) => {
        drag.current = { x: e.clientX, y: e.clientY, yaw: yaw.current, pitch: pitch.current };
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
        if (!drag.current) return;
        yaw.current = drag.current.yaw + (e.clientX - drag.current.x) * 0.01;
        pitch.current = Math.max(-1.1, Math.min(1.1, drag.current.pitch - (e.clientY - drag.current.y) * 0.01));
    };
    const onUp = () => { drag.current = null; };

    return (
        <div ref={wrapRef} className={`relative mx-auto max-w-[430px] ${className}`} style={{ height }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
            <canvas ref={canvasRef} data-brain
                className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
                style={{ height }}
                role="img"
                aria-label={`Brain diagram with ${regions.length} region${regions.length === 1 ? "" : "s"} highlighted: ${regions.map(r => REGIONS[r.id]?.name).filter(Boolean).join(", ")}`} />
            <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground/60 pointer-events-none">
                drag to rotate
            </span>
        </div>
    );
}
