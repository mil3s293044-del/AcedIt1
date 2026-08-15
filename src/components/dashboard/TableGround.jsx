/**
 * TableGround — the surface everything on the dashboard is lying on.
 *
 * The panels were white rounded rectangles on flat cream. That is the ground
 * every dashboard has, and it is why a page can be full of playing cards and
 * still read as a SaaS report: the cards were objects, but they were floating
 * in a document rather than sitting on anything.
 *
 * So the page gets a table. Three things make it read as one, and none of them
 * is a picture of a table:
 *
 *   THE CLOTH. A very fine two-way weave, drawn once into a 16px repeating
 *   gradient. Card tables are baize, baize has a nap, and the eye reads even a
 *   nearly invisible texture as "surface" rather than "background". It is
 *   deliberately below the threshold where you would call it a pattern.
 *
 *   THE FALL OF LIGHT. Warm from one corner, cool from the other, and the
 *   edges falling away into shadow, so the middle of the table is lit and the
 *   corners are not. A flat field is a wall; a field with a gradient across it
 *   is a plane you are standing over.
 *
 *   THE HOUR. The greeting already says "Morning, Miles" — the table now agrees
 *   with it. Warm and pale early, neutral through the day, and deeper and
 *   cooler after dark. It is the same room at a different time, which is what
 *   a page you open every day for a year should feel like, rather than the
 *   same flat white at 6am and 11pm.
 *
 * ALL OF IT IS STATIC PAINT. No animation, no filter, no canvas: two gradients
 * and a repeating-linear-gradient on one absolutely positioned div. An earlier
 * version of the aurora on the landing page cost that hero 37fps because a
 * large animated blur is re-rasterised every frame, and a dashboard is a page
 * people scroll. This one costs nothing to scroll past.
 *
 * IT NEVER TOUCHES THE TEXT. Everything sits behind the content at low alpha
 * over the theme's own `--background`, so contrast ratios on every panel are
 * exactly what they were, in both themes.
 */
import React from "react";

/**
 * Which table you are sitting at, by the clock.
 *
 * Exported so the greeting and the ground can be tested against the same hour
 * rather than drifting: if one of them thinks it is morning, both do.
 */
export function tableHour(now = new Date()) {
    const h = now.getHours();
    if (h < 5) return "night";
    if (h < 11) return "morning";
    if (h < 17) return "day";
    if (h < 21) return "evening";
    return "night";
}

/**
 * Light on the cloth. Two washes per time of day: a warm one and a cool one,
 * placed at opposite corners so the table has a direction to it.
 *
 * The alphas are low on purpose. Anything stronger and the white panels start
 * to look like they have been tinted, which is the failure mode — the surface
 * has to sit UNDER the objects, not stain them.
 */
const LIGHT = {
    morning: { warm: "rgba(255,186,105,0.20)", cool: "rgba(120,180,255,0.07)" },
    day:     { warm: "rgba(255,206,140,0.13)", cool: "rgba(140,190,255,0.07)" },
    evening: { warm: "rgba(255,132,72,0.17)",  cool: "rgba(122,132,235,0.11)" },
    night:   { warm: "rgba(150,120,255,0.13)", cool: "rgba(60,120,220,0.13)" },
};

export default function TableGround({ hour }) {
    const when = hour || tableHour();
    const L = LIGHT[when] || LIGHT.day;

    return (
        <div data-table-ground data-table-hour={when}
            aria-hidden="true"
            /* z-0, NOT -z-10. A negative z-index child paints behind its
               nearest ancestor that establishes a stacking context, and the
               page root carries bg-background — so at -z-10 the whole table
               was being painted underneath the opaque colour it was meant to
               replace, and rendered perfectly invisible. The content above it
               is lifted to z-10 instead. */
            className="fixed inset-0 z-0 pointer-events-none">
            {/* The two washes. */}
            <div className="absolute inset-0"
                style={{
                    background:
                        `radial-gradient(120% 95% at 6% -6%, ${L.warm} 0%, transparent 66%),`
                        + `radial-gradient(105% 75% at 92% 8%, ${L.cool} 0%, transparent 58%)`,
                }} />

            {/* The fall-off into the corners.
                A vignette ONLY, with no white pool over it. The first version
                laid a white wash on top of the warm one and the two cancelled:
                the top of the page came out a flat grey smudge rather than a
                lit table, which is worse than no ground at all. Warmth is the
                colour's job; this is only the edges getting darker. */}
            <div className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(135% 115% at 50% 26%, transparent 58%, rgba(13,22,38,0.04) 100%)",
                }} />

            {/* The nap of the cloth. Two 45-degree passes at right angles make
                a weave rather than corduroy; at 16px and 1.6% it is texture
                you feel rather than a pattern you see. */}
            <div className="absolute inset-0 opacity-[0.55]"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(45deg, rgba(13,22,38,0.016) 0 1px, transparent 1px 8px),"
                        + "repeating-linear-gradient(-45deg, rgba(13,22,38,0.016) 0 1px, transparent 1px 8px)",
                }} />
        </div>
    );
}
