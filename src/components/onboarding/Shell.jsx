/**
 * Shell — the frame every wizard screen is drawn in.
 *
 * A STEP DECLARES ITS OWN ACTIONS, AND THE PAGE DECIDES WHERE THEY GO. Only a
 * step knows whether it needs a skip link or a selection count, but the
 * actions have to come out in the bar the page pins to the bottom of the
 * screen — because with the hand pinned and the button in the flow, any scroll
 * position where the button had not yet reached the bottom put it UNDER the
 * cards. A context carries the bar's node and `StepShell` portals into it, so
 * no step knows that is what is happening. It holds the ELEMENT rather than a
 * ref: a ref does not re-render when populated, so the first step would ship
 * with no button.
 *
 * THE HEADING ARRIVES A WORD AT A TIME. Every screen used to open with the
 * same eyebrow, heading and subtitle snapping in together, which is the rhythm
 * of a form. A short stagger is the rhythm of somebody saying it — and it is
 * over in a third of a second, under the threshold where a person waiting to
 * press something starts to resent an animation.
 */
import React, { createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export const ActionsSlot = createContext(null);

const WORDS = {
    hidden: {},
    shown: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
};
const WORD = {
    hidden: { opacity: 0, y: "0.45em", filter: "blur(4px)" },
    shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.42, ease: [0.2, 0.8, 0.2, 1] } },
};

export function RisingTitle({ children, className = "" }) {
    const reduce = useReducedMotion();
    const text = String(children ?? "");
    if (reduce) return <h1 className={className}>{text}</h1>;
    return (
        <motion.h1 className={className} variants={WORDS} initial="hidden" animate="shown" aria-label={text}>
            {text.split(" ").map((w, i) => (
                <motion.span key={`${w}-${i}`} variants={WORD} aria-hidden="true"
                    className="inline-block whitespace-pre">
                    {w}{" "}
                </motion.span>
            ))}
        </motion.h1>
    );
}

export function StepShell({ eyebrow, title, subtitle, children, footer, width = "max-w-xl" }) {
    const slot = useContext(ActionsSlot);
    const reduce = useReducedMotion();
    return (
        <div className={`w-full ${width} mx-auto lg:mx-0 px-5 sm:px-8 lg:px-0 pt-5 sm:pt-8 lg:pt-4 pb-8`}>
            <div className="mb-6 lg:mb-8">
                {eyebrow && (
                    <motion.p className="stat-label text-primary mb-2.5"
                        initial={reduce ? false : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}>
                        {eyebrow}
                    </motion.p>
                )}
                <RisingTitle className="font-display font-extrabold text-foreground text-balance
                    text-[2rem] leading-[1.05] sm:text-4xl lg:text-[2.75rem] tracking-tight">
                    {title}
                </RisingTitle>
                {subtitle && (
                    <motion.p className="text-muted-foreground text-base lg:text-lg mt-3 leading-relaxed"
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.18 }}>
                        {subtitle}
                    </motion.p>
                )}
            </div>
            {children}
            {footer && (slot ? createPortal(footer, slot) : <div className="mt-8">{footer}</div>)}
        </div>
    );
}

/**
 * The one primary button. It springs on press and the arrow leans in on hover,
 * because the most-pressed control in the funnel is worth feeling.
 */
export function PrimaryCTA({ children, disabled, onClick, arrow = true, className = "" }) {
    const reduce = useReducedMotion();
    return (
        <motion.button
            type="button"
            onClick={onClick}
            disabled={disabled}
            whileTap={reduce || disabled ? undefined : { scale: 0.97, y: 2 }}
            className={`group w-full btn-3d bg-primary text-primary-foreground rounded-2xl h-14
                inline-flex items-center justify-center gap-2 font-display font-extrabold text-[17px]
                disabled:opacity-45 disabled:cursor-not-allowed ${className}`}
        >
            {children}
            {arrow && (
                <ArrowRight className="w-[18px] h-[18px] transition-transform duration-200
                    group-hover:translate-x-1 group-disabled:translate-x-0" strokeWidth={2.75} />
            )}
        </motion.button>
    );
}

export function SkipLink({ onClick, children = "Skip for now" }) {
    return (
        <button type="button" onClick={onClick}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mx-auto block py-2">
            {children}
        </button>
    );
}
