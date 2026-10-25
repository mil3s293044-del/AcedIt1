/**
 * ReadinessBar — how much of a folder is ready, in two layers.
 *
 * PROVED is solid: a marked check scored it in full, a mistake was earned back
 * on its own question, an answer was written from memory a week apart. SAID is
 * hatched: rated "got it", or rehearsed to the end and not yet proven. Open is
 * the track. Drawing them apart rather than summing them is the point — "you
 * said nine, four held up" is the sentence a student needs the week before.
 *
 * An empty folder draws a dashed track and no figure: 0% ready would be a
 * verdict on a folder nobody has put anything in.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

const H = { sm: "h-1.5", md: "h-2.5", lg: "h-3.5" };

export default function ReadinessBar({ r, size = "md", legend = false, className = "" }) {
    const reduce = useReducedMotion();
    const h = H[size] || H.md;
    if (!r?.total) {
        return (
            <div className={className}>
                <div className={`${h} rounded-full border-2 border-dashed border-border`} aria-label="Nothing tracked yet" role="img" />
            </div>
        );
    }
    const pct = (n) => (n / r.total) * 100;
    const proved = pct(r.proved);
    const said = pct(r.said);
    const label = `${r.ready} of ${r.total} ready, ${r.proved} proved`;
    const grow = (delay) => (reduce ? { duration: 0 } : { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] });

    return (
        <div className={className}>
            <div role="img" aria-label={label} data-readiness={`${r.proved}/${r.said}/${r.total}`}
                className={`${h} rounded-full bg-foreground/10 overflow-hidden flex`}>
                <motion.span className="h-full bg-primary" initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${proved}%` }} transition={grow(0.1)} />
                <motion.span className="h-full ready-said" initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${said}%` }} transition={grow(0.35)} />
            </div>
            {legend && (
                <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" data-readiness-legend>
                    <li className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-primary" aria-hidden="true" />
                        <span className="font-bold text-foreground tabular-nums">{r.proved}</span> proved
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm ready-said" aria-hidden="true" />
                        <span className="font-bold text-foreground tabular-nums">{r.said}</span> said
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-foreground/10" aria-hidden="true" />
                        <span className="font-bold text-foreground tabular-nums">{r.open}</span> open
                    </li>
                </ul>
            )}
        </div>
    );
}
