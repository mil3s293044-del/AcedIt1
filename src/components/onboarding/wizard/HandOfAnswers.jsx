/**
 * HandOfAnswers — the progress bar, replaced by the thing it was measuring.
 *
 * The wizard used to show a row of grey segments filling up. It told you how
 * many screens were left and nothing else, and it was the only visual the flow
 * had, which meant the first thing a student saw after the landing page was a
 * form. Everything the storm and the hero had promised died at the door.
 *
 * So the progress indicator IS the answers. Every question you answer deals a
 * card into a hand held at the bottom of the screen, face up, and the hand
 * grows as you go. You can see how far along you are by looking at it, exactly
 * the way you could with the segments, and you can also see what you said,
 * which the segments could never do. By the last screen you are holding
 * something that is specifically yours rather than watching a bar reach the
 * end.
 *
 * THE RANKS ARE NOT DECORATION. They come from cardIdentity, the same module
 * the review deck uses, so the marks mean here what they mean everywhere else
 * in the app: suit is the subject, rank is mastery. Which is why every subject
 * card in this hand is a two. You have not studied yet. Nobody is handed an
 * Ace for signing up, and the reveal screen says so out loud, because a rank
 * that were given away free would be worth nothing when it was earned later.
 *
 * The year and target cards are the exception and are ranked by what they are,
 * not by mastery: Year 12 is a queen, and the target you are chasing is the
 * Ace. Those two are stated in the tooltip so the difference is never a thing
 * the student has to guess at.
 *
 * WHY THE FAN IS CAPPED. Six subjects plus year plus target plus course is
 * nine cards, and nine cards fanned at a readable overlap is wider than a
 * phone. Past the cap the hand keeps the most recent cards and prints a count
 * of what is behind them, the way you would square up a hand you cannot spread.
 */
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import FanCard from "@/components/onboarding/FanCard";
import { handFrom } from "@/lib/onboardingFlow";
import { useFlight } from "@/components/onboarding/DealFlight";

const CARD_W = 62;
const CARD_H = 88;
const STEP_WIDE = 46;
const STEP_TIGHT = 34;
const MAX_FANNED = 7;

// FanCard — the face of a card as held — lives in its own file, because the
// deal flight draws it too and importing it from here made a cycle.
export { FanCard };

/*
 * `handFrom` lives in @/lib/onboardingFlow now, beside the one year→rank table.
 * The year picker and this hand each kept their own map from year to rank,
 * which is the mirror this codebase keeps deleting; and the table, the reveal
 * and this rail all deal the same cards, so they read the same function.
 */
export { handFrom };

/** One card in the hand. Sized small, so the label is a strip not a paragraph. */
function HeldCard({ card, i, n, step, reduce, last }) {
    // A card in the air is laid out at its final place and kept invisible
    // until the flight lands on it, so the flight has a still target.
    const { isAirborne } = useFlight();
    const airborne = isAirborne(card.key);
    const [arrivedAirborne] = React.useState(airborne);
    // Fanned around the middle. The arc lifts the CENTRE rather than dropping
    // the edges, and that is a bounds fact rather than a taste one: the rail
    // is pinned to the bottom of the viewport, so any downward offset on the
    // outer cards pushes them off the screen. Measured at five pixels below
    // the fold before this was turned the right way up. It also happens to be
    // what a hand held from the bottom actually does, since the cards pivot
    // near the base and the middle of the arc rides highest.
    const mid = (n - 1) / 2;
    const off = i - mid;
    const lean = n > 1 ? off * 3.4 : 0;
    const lift = n > 1 ? -(mid - Math.abs(off)) * 2.4 : 0;

    return (
        <motion.div
            data-held={card.key}
            data-deal-slot={card.key}
            data-rot={lean}
            data-label-size="7px"
            title={card.title}
            // White stock in both themes, as on the table: a flight carries a
            // white card, and it must not land as a different one.
            className="theme-locked-light absolute bottom-0"
            style={{ width: CARD_W, height: CARD_H, left: i * step, zIndex: i }}
            initial={arrivedAirborne
                ? { opacity: 0, y: lift, x: 0, rotate: lean, scale: 1 }
                : reduce
                    ? { opacity: 0 }
                    : { opacity: 0, y: 90, x: 130, rotate: 26, scale: 0.86 }}
            animate={{ opacity: airborne ? 0 : 1, y: lift, x: 0, rotate: lean, scale: 1 }}
            exit={reduce
                ? { opacity: 0 }
                : { opacity: 0, y: 70, rotate: lean + 14, scale: 0.9,
                    transition: { duration: 0.22 } }}
            transition={reduce
                ? { duration: 0.2 }
                : { type: "spring", stiffness: 260, damping: 24, mass: 0.7 }}
        >
            <FanCard card={card} strip={last ? CARD_W : step} labelSize="7px" />
        </motion.div>
    );
}

/**
 * Tighten the fan on a narrow screen.
 *
 * Seven cards at the wide step is 338px before the overflow pill and the
 * gutters, which is over the line on a 390px phone. Measured rather than
 * guessed at a breakpoint, because the thing that actually matters is whether
 * the hand fits the viewport, and a `sm:` class cannot ask that.
 */
function useTightFan() {
    const [tight, setTight] = React.useState(
        () => typeof window !== "undefined" && window.innerWidth < 440);
    React.useEffect(() => {
        const q = window.matchMedia("(max-width: 439px)");
        const on = () => setTight(q.matches);
        on();
        q.addEventListener("change", on);
        return () => q.removeEventListener("change", on);
    }, []);
    return tight;
}

export default function HandOfAnswers({ answers }) {
    const reduce = useReducedMotion();
    const all = handFrom(answers);
    const step = useTightFan() ? STEP_TIGHT : STEP_WIDE;

    // Keep the newest cards visible. The ones behind become a count rather
    // than a squeeze, because a fan tighter than the corner index is unreadable
    // and looks like a rendering fault rather than a full hand.
    const hidden = Math.max(0, all.length - MAX_FANNED);
    const shown = hidden > 0 ? all.slice(hidden) : all;
    const width = shown.length > 0 ? (shown.length - 1) * step + CARD_W : 0;

    return (
        <div
            data-onboarding-hand
            data-hand-count={all.length}
            className="pointer-events-none select-none flex items-end justify-center gap-3"
            // Slack above the cards for the arc and for the corners the lean
            // throws out. The cards themselves are bottom-anchored, so this
            // grows the box upward and never off the bottom of the screen.
            style={{ height: CARD_H + 20 }}
        >
            {hidden > 0 && (
                <span className="mb-3 text-[11px] font-bold text-muted-foreground tabular-nums
                    rounded-full bg-muted px-2 py-0.5">
                    +{hidden}
                </span>
            )}
            <div className="relative" style={{ width, height: CARD_H }}>
                <AnimatePresence initial={false}>
                    {shown.map((c, i) => (
                        <HeldCard key={c.key} card={c} i={i} n={shown.length}
                            step={step} reduce={reduce} last={i === shown.length - 1} />
                    ))}
                </AnimatePresence>
            </div>
            {all.length === 0 && (
                <p className="mb-6 text-xs font-semibold text-muted-foreground">
                    Your hand builds as you answer.
                </p>
            )}
        </div>
    );
}

export { CARD_W, CARD_H };
