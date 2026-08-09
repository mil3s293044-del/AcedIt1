/**
 * BrainModel — a rotating 3D brain with regions lit up.
 *
 * Genuinely 3D: a point cloud in real coordinates, rotated by a matrix and
 * projected with perspective each frame. Not a spinning picture. It's drawn to
 * a canvas rather than SVG because 1,100 nodes re-rendered through React at
 * 60fps is a slideshow, and hand-rolled rather than three.js because the whole
 * thing is ~200 lines and a WebGL context on a mid-range phone is a real cost
 * for something decorative.
 *
 * Two modes:
 *   • Study pages pass regions with no intensity — every listed region lights
 *     equally, because the question there is "which systems does this
 *     technique use".
 *   • The Dashboard passes an `activation` per region, weighted by how long
 *     the student actually spent. Brightness, halo size and pulse rate all
 *     scale with it, so a month of nothing but Pomodoro reads as a bright
 *     front and a dark middle at a glance.
 *
 * The point cloud is atmosphere. The INFORMATION lives in the HTML beside it,
 * which is where a screen reader, a search engine and anyone with
 * prefers-reduced-motion will find it. If the canvas never painted, nothing
 * factual would be lost — that's deliberate.
 */
import React, { useEffect, useRef, useState } from "react";
import { REGIONS } from "@/lib/neuro";

// Tailwind can't be read from a canvas, so tones resolve from the CSS
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
 * Bend a sphere into something brain-shaped: longer front-to-back than wide,
 * flatter underneath, a cleft down the midline between the hemispheres, a
 * narrower frontal pole and a cerebellum tucked under the back.
 */
function brainCloud(n) {
    const out = [];
    for (const [x, y, z] of sphere(n)) {
        let px = x * 0.82, py = y * 0.74, pz = z * 1.06;
        if (py < 0) py *= 0.72;                       // flat underside
        if (pz > 0.4) { px *= 0.86; py *= 0.92; }     // tapered frontal pole
        // Occipital pole — the back narrows and tucks upward over the
        // cerebellum instead of ending in a hemisphere.
        if (pz < -0.5) { px *= 0.88; py = py * 0.94 + 0.05; }
        const cleft = Math.exp(-(px * px) / 0.004) * Math.max(0, py) * 0.16;
        py -= cleft;                                   // longitudinal fissure
        // Sylvian fissure — the deep lateral groove above the temporal lobe.
        // It's the single most recognisable line on a brain seen side-on, and
        // without it the profile is one unbroken dome.
        const syl = Math.exp(-Math.pow((py + 0.10 + 0.14 * pz) / 0.075, 2));
        px -= Math.sign(px) * syl * 0.085 * Math.min(1, Math.abs(px) / 0.3);
        // Gyri: radial noise so it reads as folded, not as a balloon.
        const fold = 1 + 0.045 * Math.sin(px * 17) * Math.cos(pz * 13) + 0.03 * Math.sin(py * 21);
        out.push([px * fold, py * fold, pz * fold]);
    }
    // Temporal lobes — the forward-projecting lobes below the fissure. They
    // give the underside its hook; a brain without them reads as an egg.
    for (const [x, y, z] of sphere(Math.round(n * 0.16))) {
        const tx = 0.30 + Math.abs(x) * 0.16, ty = y * 0.16 - 0.34, tz = z * 0.44 + 0.16;
        const fold = 1 + 0.05 * Math.sin(tz * 15);
        out.push([tx * fold, ty * fold, tz * fold]);
        out.push([-tx * fold, ty * fold, tz * fold]);
    }
    // Cerebellum — the small dense lobe under the back that does most of the
    // work of making a silhouette read as a brain.
    for (const [x, y, z] of sphere(Math.round(n * 0.22))) {
        out.push([x * 0.42, y * 0.24 - 0.58, z * 0.34 - 0.62]);
    }
    // Brainstem. Cheap, and without it the underside just stops — which is the
    // single thing that stopped the silhouette reading as a brain.
    for (let i = 0; i < Math.round(n * 0.05); i++) {
        const k = i / Math.round(n * 0.05);
        const a = k * Math.PI * 7.7;
        const rr = 0.10 * (1 - 0.35 * k);
        out.push([Math.cos(a) * rr, -0.52 - k * 0.34, Math.sin(a) * rr - 0.30 + k * 0.06]);
    }
    return out;
}

const CLOUD = brainCloud(1500);
const HOT_R = 0.42;               // how far a region's influence reaches

const rotate = ([x, y, z], yaw, pitch) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
};

// Mirrored across the midline: a region named once lights both hemispheres,
// which is what the imaging actually shows.
const distTo = (p, [hx, hy, hz]) => Math.min(
    Math.hypot(p[0] - hx, p[1] - hy, p[2] - hz),
    Math.hypot(p[0] + hx, p[1] - hy, p[2] - hz));

export default function BrainModel({
    regions = [],
    className = "",
    height = 220,
    glow = false,          // additive bloom + travelling pulses
    plate = glow,          // dark backing panel — see the note below
}) {
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
            return v || "175 80% 40%";
        };
        const hot = regions.map(r => ({
            xyz: REGIONS[r.id]?.xyz || [0, 0, 0],
            hsl: tone(r.tone),
            // No activation supplied → fully lit. That's the Study-page case,
            // where the question is which systems a technique uses, not how
            // hard this particular student has used them.
            a: typeof r.activation === "number" ? Math.max(0.12, r.activation) : 1,
        }));
        // On a plate the unlit cloud is a cool light slate regardless of theme;
        // off it, it has to follow the theme or it vanishes into the card.
        const base = plate
            ? "213 30% 80%"
            : (css.getPropertyValue("--muted-foreground").trim() || "220 9% 46%");

        // Pulses travel between the two busiest regions — the eye reads that as
        // a system doing something rather than a diagram sitting still.
        const ranked = [...hot].sort((x, y) => y.a - x.a).slice(0, 3);

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
            ctx.globalCompositeOperation = "source-over";

            const scale = Math.min(w * 0.30, h * 0.46);
            const cx = w / 2, cy = h / 2;
            const t = reduced ? 0 : Date.now() / 1000;
            const breathe = reduced ? 1 : 1 + 0.012 * Math.sin(t * 0.9);
            const S = scale * breathe;

            const project = (p) => {
                const [x, y, z] = rotate(p, yaw.current, pitch.current);
                const persp = 2.6 / (2.6 + z);
                return { x: cx + x * S * persp, y: cy - y * S * persp, z, persp };
            };

            // ── Halos first, underneath everything, additive so overlapping
            // regions bloom into each other rather than stacking flatly.
            if (glow) {
                ctx.globalCompositeOperation = "lighter";
                for (const r of hot) {
                    const q = project(r.xyz);
                    if (q.z < -0.55) continue;              // behind the brain
                    const pulse = reduced ? 1 : 0.82 + 0.18 * Math.sin(t * 1.6 + r.xyz[0] * 5);
                    // Scaled off the drawing size, not fixed pixels — a fixed
                    // 70px halo is a tasteful glow at 430px wide and a single
                    // wash of colour on a 354px phone.
                    const rad = S * (0.16 + 0.26 * r.a) * q.persp * pulse;
                    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad);
                    // Weighted toward the centre so it reads as a source with a
                    // falloff. A linear ramp is what made this look like fog.
                    g.addColorStop(0,    `hsl(${r.hsl} / ${(0.42 * r.a).toFixed(3)})`);
                    g.addColorStop(0.28, `hsl(${r.hsl} / ${(0.16 * r.a).toFixed(3)})`);
                    g.addColorStop(0.62, `hsl(${r.hsl} / ${(0.04 * r.a).toFixed(3)})`);
                    g.addColorStop(1,    `hsl(${r.hsl} / 0)`);
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(q.x, q.y, rad, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalCompositeOperation = "source-over";
            }

            // ── The cloud, depth sorted so near points paint over far ones.
            const drawn = CLOUD.map(p => ({ ...project(p), src: p })).sort((a, b) => a.z - b.z);

            for (const p of drawn) {
                let best = null, bestD = HOT_R;
                for (const r of hot) {
                    const d = distTo(p.src, r.xyz);
                    if (d < bestD) { bestD = d; best = r; }
                }
                const depth = (p.z + 1.2) / 2.4;               // 0 back → 1 front
                if (best) {
                    const falloff = 1 - bestD / HOT_R;
                    const pulse = reduced ? 0.85 : 0.72 + 0.28 * Math.sin(t * 2 + bestD * 6);
                    const a = (0.22 + 0.78 * falloff * falloff) * pulse * (0.45 + 0.55 * depth) * best.a;
                    ctx.fillStyle = `hsl(${best.hsl} / ${a.toFixed(3)})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, (1.0 + 2.4 * falloff * (0.5 + 0.5 * best.a)) * p.persp, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Held back on the plate, where the unlit cloud competes
                    // with the bloom and the lit regions have to win. Off the
                    // plate there's no bloom to lose to and the same values
                    // just make the whole model faint, so it keeps its weight.
                    const a = plate ? 0.10 + 0.20 * depth : 0.16 + 0.26 * depth;
                    ctx.fillStyle = `hsl(${base} / ${a.toFixed(3)})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, (plate ? 1.0 : 1.1) * p.persp, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // ── A bright core at each region's centre. The halo says roughly
            // where; this says exactly where, which is what makes two adjacent
            // regions distinguishable instead of one shared smear.
            if (glow) {
                ctx.globalCompositeOperation = "lighter";
                for (const r of hot) {
                    const q = project(r.xyz);
                    if (q.z < -0.3) continue;
                    const pulse = reduced ? 1 : 0.86 + 0.14 * Math.sin(t * 2.1 + r.xyz[2] * 4);
                    const rad = S * 0.028 * (0.55 + 0.45 * r.a) * q.persp * pulse;
                    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad * 3);
                    g.addColorStop(0,   `hsl(${r.hsl} / ${(0.95 * r.a).toFixed(3)})`);
                    g.addColorStop(0.4, `hsl(${r.hsl} / ${(0.35 * r.a).toFixed(3)})`);
                    g.addColorStop(1,   `hsl(${r.hsl} / 0)`);
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(q.x, q.y, rad * 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalCompositeOperation = "source-over";
            }

            // ── Signals firing between the busiest regions.
            if (glow && !reduced && ranked.length >= 2) {
                ctx.globalCompositeOperation = "lighter";
                for (let i = 0; i < ranked.length; i++) {
                    const from = ranked[i], to = ranked[(i + 1) % ranked.length];
                    const a = project(from.xyz), bq = project(to.xyz);
                    if (a.z < -0.6 && bq.z < -0.6) continue;
                    const k = (t * 0.55 + i * 0.37) % 1;
                    // Bowed toward the viewer so the signal reads as travelling
                    // over the surface rather than through the middle.
                    const mx = (a.x + bq.x) / 2, my = (a.y + bq.y) / 2 - 18;
                    const px = (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * mx + k * k * bq.x;
                    const py = (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * my + k * k * bq.y;
                    const fade = Math.sin(k * Math.PI);
                    const rad = 3.4 * fade * (0.5 + 0.5 * from.a);
                    const g = ctx.createRadialGradient(px, py, 0, px, py, rad * 3.5);
                    g.addColorStop(0, `hsl(${from.hsl} / ${(0.85 * fade).toFixed(3)})`);
                    g.addColorStop(1, `hsl(${from.hsl} / 0)`);
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(px, py, rad * 3.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalCompositeOperation = "source-over";
            }

            if (!reduced && !drag.current) yaw.current += 0.0035;
            if (!stop) raf = requestAnimationFrame(draw);
        };
        draw();
        return () => { stop = true; cancelAnimationFrame(raf); };
    }, [regions, height, reduced, glow, plate]);

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

    const named = regions.map(r => REGIONS[r.id]?.name).filter(Boolean).join(", ");
    // The plate is deliberately dark in BOTH themes. Additive light only reads
    // as light against something dark — on a white card the bloom bleaches out
    // to a pastel smudge. It also matches how every real scan is ever shown,
    // which is the point of the whole panel.
    return (
        <div ref={wrapRef}
            className={`relative mx-auto overflow-hidden ${plate ? "rounded-2xl" : "max-w-[430px]"} ${className}`}
            /* The plate is painted by absolutely-positioned children, so nothing
               in the ancestor chain carries its colour. Declaring it lets a
               contrast check measure text on the plate correctly instead of
               measuring it against the card behind. */
            data-plate-bg={plate ? "#080c16" : undefined}
            style={{ height }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
            {plate && (
                <>
                    <div className="absolute inset-0 bg-[#080c16]" />
                    <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_18%,rgba(56,89,148,0.35),rgba(8,12,22,0)_70%)]" />
                    <div className="absolute inset-0 shadow-[inset_0_0_60px_20px_rgba(4,6,12,0.85)]" />
                    {/* In dark mode the plate and the card are nearly the same
                        value, so without this edge the panel has no boundary. */}
                    <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none" />
                </>
            )}
            <canvas ref={canvasRef} data-brain
                className="relative w-full h-full cursor-grab active:cursor-grabbing touch-none"
                style={{ height }}
                role="img"
                aria-label={`Brain diagram with ${regions.length} region${regions.length === 1 ? "" : "s"} highlighted: ${named}`} />
            <span className={`absolute bottom-1.5 right-2.5 text-[10px] pointer-events-none ${
                plate ? "text-white/60" : "text-muted-foreground"}`}>
                drag to rotate
            </span>
        </div>
    );
}
