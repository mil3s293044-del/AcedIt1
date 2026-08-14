/**
 * CardStorm — the opening. Hundreds of cards are thrown at the screen, swarm,
 * assemble into a brain, and are then taken in by it.
 *
 * WHAT IT IS SAYING, in three seconds and no words: this is a pile of study
 * material, and the point of the product is what your brain does with it.
 * That is the entire pitch of the app. The cards are the flashcards, quizzes
 * and practice questions; the brain is the thing they are for; and the last
 * beat, where it draws them in and pulses, is the claim being made.
 *
 * THE BRAIN IS THE APP'S OWN BRAIN. The landing positions come from
 * brainCloud() in lib/brainShape, which is the same point cloud the Study page
 * and the Analytics cognition tab render. A second, marketing-only brain that
 * was "roughly the right shape" would have been the tell that the picture was
 * a picture; this way the shape a visitor watches assemble in the first three
 * seconds is exactly the shape they are shown their own study history on
 * later.
 *
 * IT IS A CANVAS, and that is a requirement rather than a preference. Six
 * hundred DOM nodes, each carrying a bordered card with an SVG pip and its own
 * transform, is a slideshow on a mid-range phone. Six hundred rounded rects on
 * a 2D context is nothing. Nobody can read a rank at 9px anyway, so the DOM
 * version was paying full price for detail no one could see.
 *
 * FOUR PHASES, and each one has a job:
 *
 *   THROW (0 to 0.9s). Cards arrive from beyond every edge, tumbling, aimed
 *   past the middle. Chaos with direction, which is what a pile of unsorted
 *   material feels like.
 *
 *   FORM (0.9 to 2.2s). Each card eases to its own point on the rotating
 *   brain and squares up to the surface. They do not arrive together: the
 *   easing is staggered by index so the shape resolves out of the noise
 *   rather than snapping into place.
 *
 *   ABSORB (2.2 to 3.0s). The brain draws them in. Cards accelerate toward
 *   the centre, shrink, and go out; the cloud brightens as they land.
 *
 *   LIFT. The sheet fades and the page is underneath, already rendered.
 *
 * The same four rules as any intro animation, and they are not negotiable: it
 * is short, it is skippable on any input, it runs once a session, and the page
 * beneath it is live the entire time. Under reduced motion it never mounts.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { brainCloud, rotate } from "@/lib/brainShape";
import { FLUSH_SEEN } from "@/components/marketing/flushGate";

/**
 * How many cards. "A thousand" is the feeling; 620 is what actually delivers
 * it, because past roughly this many the silhouette stops getting clearer and
 * the cards start reading as confetti. The phone count is lower for fill rate,
 * not for CPU: the same cards on a 390px screen overlap into a solid mass.
 */
const COUNT_WIDE = 950;
const COUNT_NARROW = 420;

const THROW_MS = 900;
const FORM_MS = 2200;
const ABSORB_MS = 3000;

/** Cheap deterministic noise, so the storm is the same storm every time. */
function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function CardStorm() {
    const reduce = useReducedMotion();
    const [open, setOpen] = useState(false);
    const canvasRef = useRef(null);
    const doneRef = useRef(false);

    useEffect(() => {
        if (reduce || FLUSH_SEEN) return undefined;
        setOpen(true);
        return undefined;
    }, [reduce]);

    const skip = useCallback(() => setOpen(false), []);
    useEffect(() => {
        if (!open) return undefined;
        const opts = { passive: true };
        window.addEventListener("wheel", skip, opts);
        window.addEventListener("touchstart", skip, opts);
        window.addEventListener("keydown", skip);
        return () => {
            window.removeEventListener("wheel", skip);
            window.removeEventListener("touchstart", skip);
            window.removeEventListener("keydown", skip);
        };
    }, [open, skip]);

    useEffect(() => {
        if (!open) return undefined;
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext("2d");
        if (!ctx) return undefined;

        let raf = 0, stopped = false;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let W = 0, H = 0;
        const size = () => {
            W = window.innerWidth; H = window.innerHeight;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            canvas.style.width = `${W}px`;
            canvas.style.height = `${H}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        size();
        window.addEventListener("resize", size);

        const N = W < 700 ? COUNT_NARROW : COUNT_WIDE;
        const cloud = brainCloud(N);
        const r = rng(20260814);

        /**
         * One card. `from` is off-screen, `to` is its point on the brain, and
         * everything else is per-card jitter so no two arrive alike.
         */
        const cards = [];
        for (let i = 0; i < N; i++) {
            // Launch from just beyond a random edge, aimed across the middle.
            const side = Math.floor(r() * 4);
            const along = r();
            const pad = 260;
            const fx = side === 0 ? -pad : side === 1 ? W + pad : along * W;
            const fy = side === 2 ? -pad : side === 3 ? H + pad : along * H;
            cards.push({
                p: cloud[i % cloud.length],
                fx, fy,
                spin: (r() - 0.5) * 14,
                rot0: r() * Math.PI * 2,
                // Staggered so the shape resolves out of the noise instead of
                // snapping into it all at once.
                lag: (i / N) * 0.42 + r() * 0.12,
                // A FEW red cards, not a fifth of them. At 22% the storm read
                // as confetti at a party rather than as a deck: the eye tracks
                // the colour, and colour scattered evenly through a shape is
                // the one thing guaranteed to stop it reading as a surface.
                red: r() < 0.05,
                w: 9 + r() * 5,
                // Small individual jitter around a common resting angle.
                rest: (r() - 0.5) * 0.5,
            });
        }

        const t0 = performance.now();
        const RED = "#FF4B4B";

        const draw = (now) => {
            if (stopped) return;
            const t = now - t0;
            ctx.clearRect(0, 0, W, H);

            const cx = W / 2, cy = H / 2;
            const scale = Math.min(W, H) * 0.33;
            /**
             * HELD IN PROFILE, and this is the single biggest thing that makes
             * it read as a brain at all. At a three-quarter angle the frontal
             * pole, the temporal lobe and the cerebellum all overlap and the
             * silhouette collapses into an oval blob; side-on they separate,
             * and the notch under the temporal lobe plus the cerebellum
             * tucked at the back are what the eye actually recognises. It
             * drifts slowly rather than sitting dead still, so it reads as an
             * object in space rather than as a picture of one.
             */
            const yaw = 1.42 + t / 11000;
            const pitch = -0.10;

            // Overall phase progress.
            const form = Math.min(1, Math.max(0, (t - THROW_MS * 0.45) / (FORM_MS - THROW_MS * 0.45)));
            const absorb = Math.min(1, Math.max(0, (t - FORM_MS) / (ABSORB_MS - FORM_MS)));

            /**
             * PAINTED BACK TO FRONT, which is most of what makes this read as
             * a solid object rather than as confetti. Without the sort, a card
             * on the far side of the brain can paint over one at the front and
             * the whole thing goes flat; with it, the near face occludes the
             * far one and the silhouette gains depth for the cost of one sort
             * per frame on a few hundred items.
             */
            const frame = [];
            for (let i = 0; i < cards.length; i++) {
                const c = cards[i];
                const [x3, y3, z3] = rotate(c.p, yaw, pitch);
                const depth = 1 / (1.9 - z3 * 0.55);
                const tx = cx + x3 * scale * depth * 1.9;
                const ty = cy - y3 * scale * depth * 1.9;

                // Per-card progress along the throw, staggered by lag.
                const k = Math.min(1, Math.max(0, (form - c.lag) / (1 - c.lag || 1)));
                const e = easeInOut(k);
                let px = c.fx + (tx - c.fx) * e;
                let py = c.fy + (ty - c.fy) * e;

                let s = (0.55 + 0.9 * e) * depth * 1.5;
                let alpha = Math.min(1, k * 3);

                if (absorb > 0) {
                    // Taken in: pulled to the middle, shrinking, going out.
                    // Squared so it starts gently and finishes fast, which is
                    // what being drawn INTO something looks like.
                    const a = easeOut(Math.min(1, absorb * 1.25 + c.lag * 0.35));
                    px += (cx - px) * a * a;
                    py += (cy - py) * a * a;
                    s *= 1 - a * 0.92;
                    alpha *= 1 - a;
                }
                if (alpha <= 0.01 || s <= 0.02) continue;

                /**
                 * THE CARDS SQUARE UP TO THE SURFACE AS THEY LAND, and this is
                 * the difference between a brain and a cloud of litter. While
                 * they are still flying they tumble on their own spin; by the
                 * time they arrive they have rotated to lie tangent to the
                 * shape, like scales, so the form reads as something with a
                 * surface instead of as several hundred unrelated rectangles
                 * that happen to be in a brain-shaped region of the screen.
                 */
                // Aligning every card radially made the shape spray outward
                // from the middle. Cards laid on a surface sit roughly
                // PARALLEL, so they settle to a common angle with a little
                // jitter, and the tumble decays into that.
                const rot = c.rest * e
                    + (c.rot0 + c.spin * (1 - e) + t * 0.0004) * (1 - e);

                frame.push({ z: z3, px, py, rot, s, alpha, c, e });
            }

            frame.sort((a, b) => a.z - b.z);

            for (const f of frame) {
                const w = f.c.w * f.s, h = w * 1.4;
                ctx.save();
                ctx.translate(f.px, f.py);
                ctx.rotate(f.rot);
                ctx.globalAlpha = f.alpha;
                // Far side of the brain sits in shadow, near side is lit. A
                // uniform white on every card is what made the formed shape
                // look like a flat sticker rather than a solid.
                const lit = 0.34 + 0.66 * Math.pow((f.z + 1) / 2, 1.25);
                const base = f.c.red ? RED : "#FFFFFF";
                ctx.fillStyle = f.c.red
                    ? base
                    : `rgb(${Math.round(255 * lit)},${Math.round(255 * lit)},${Math.round(255 * lit)})`;
                ctx.globalAlpha = f.alpha * (f.c.red ? 1 : 1);
                ctx.strokeStyle = `rgba(13,22,38,${0.25 + 0.4 * lit})`;
                ctx.lineWidth = 0.7;
                const rr = Math.min(3, w * 0.2);
                ctx.beginPath();
                ctx.roundRect(-w / 2, -h / 2, w, h, rr);
                ctx.fill();
                if (w > 6) ctx.stroke();
                ctx.restore();
            }

            // The brain brightens as it takes them in.
            if (absorb > 0) {
                const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 2.1);
                const peak = Math.sin(Math.min(1, absorb) * Math.PI);
                g.addColorStop(0, `rgba(88,204,2,${0.30 * peak})`);
                g.addColorStop(0.5, `rgba(88,204,2,${0.10 * peak})`);
                g.addColorStop(1, "rgba(88,204,2,0)");
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
            }

            if (t > ABSORB_MS + 120 && !doneRef.current) {
                doneRef.current = true;
                setOpen(false);
            }
            raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);

        return () => {
            stopped = true;
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", size);
        };
    }, [open]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="storm"
                    aria-hidden="true"
                    data-card-storm
                    onClick={skip}
                    className="fixed inset-0 z-[100] overflow-hidden cursor-pointer"
                    style={{ background: "#0D1626" }}
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.45, ease: [0.4, 0, 1, 1] } }}
                >
                    <canvas ref={canvasRef} className="absolute inset-0" />

                    <motion.p
                        className="absolute inset-x-0 bottom-[13%] text-center text-white/50
                            text-[11px] sm:text-xs font-semibold tracking-[0.22em] uppercase px-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: FORM_MS / 1000 - 0.5, duration: 0.5 } }}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    >
                        Study that your brain keeps
                    </motion.p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
