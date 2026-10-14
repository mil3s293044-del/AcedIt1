/**
 * Table — the dark felt the signup wizard deals onto.
 *
 * The questions sit on the app's own ground; this sits beside them, and every
 * answer puts a card down on it. It is the same hand `HandOfAnswers` holds on
 * a phone, drawn at the size a table allows, so the thing a student is
 * building is the largest object on the screen rather than a strip at the
 * bottom of it.
 *
 * THREE MODES, ONE SET OF CARDS. The cards are keyed by what they are (year,
 * each subject, the target) and never remounted between modes, so every
 * change between them is the same cards MOVING:
 *
 *   spread   face up, fanned, the live hand while questions are answered
 *   deck     gathered face down and riffled — the build
 *   reveal   fanned wide, face down, then turned over one at a time, the
 *            target Ace last and catching the light
 *
 * A FLIP IS A TWEEN AND A DEAL IS A SPRING, and they live on different
 * elements — the lesson MovePreview's card records. The outer element owns
 * position and rotation; the inner owns rotateY alone; `perspective` sits on
 * the outer, because an element cannot supply its own vanishing point.
 *
 * Card stock is WHITE in both themes (`theme-locked-light`). A playing card is
 * a physical object, and on a dark table a dark card is a hole in the felt.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import FanCard from "@/components/onboarding/FanCard";
import AceHost from "@/components/onboarding/AceHost";
import { CardBack } from "@/components/cards/PlayingCard";
import { useFlight } from "@/components/onboarding/DealFlight";
import { handFrom, scalingFor, shortSubject, GOLD } from "@/lib/onboardingFlow";

const BACK_TONE = "#58CC02";

function useWidth() {
    const ref = useRef(null);
    const [w, setW] = useState(0);
    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return [ref, w];
}

/** Where each card sits in each mode. Pure, so the three modes are three layouts of one list. */
function placement(i, n, mode, W, H, stepX) {
    const mid = (n - 1) / 2;
    const off = i - mid;
    if (mode === "deck") {
        return { x: ((i % 3) - 1) * 1.5, y: -i * 1.4, rot: ((i * 37) % 7) - 3 };
    }
    const big = mode === "reveal";
    return {
        x: off * stepX,
        y: off * off * (big ? 3.2 : 2.4),
        rot: n > 1 ? off * (big ? 3 : 4) : 0,
    };
}

function TableCard({ card, i, n, mode, W, H, stepX, reduce, labelSize, revealDelay }) {
    const { isAirborne } = useFlight();
    const airborne = isAirborne(card.key);
    const [arrivedAirborne] = useState(airborne);
    const { x, y, rot } = placement(i, n, mode, W, H, stepX);
    const faceDown = mode === "deck";
    const last = i === n - 1;
    const strip = mode === "deck" || last || stepX >= W ? W : stepX;
    const riffle = mode === "deck" && !reduce;
    const side = i % 2 ? 1 : -1;

    return (
        <motion.div
            data-deal-slot={card.key}
            data-rot={rot}
            data-label-size={labelSize}
            title={card.title}
            className="absolute left-1/2 top-1/2"
            style={{ width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2, zIndex: i + 1, perspective: 900 }}
            initial={arrivedAirborne
                ? { opacity: 0, x, y, rotate: rot, scale: 1 }
                : reduce
                    ? { opacity: 0, x, y, rotate: rot }
                    : { opacity: 0, x: W * 1.8, y: -H * 1.1, rotate: 32, scale: 0.8 }}
            animate={riffle
                ? {
                    opacity: 1,
                    x: [x, x + side * (W * 0.62), x],
                    y: [y, y - 10, y],
                    rotate: [rot, rot + side * 9, rot],
                    scale: 1,
                }
                : { opacity: airborne ? 0 : 1, x, y, rotate: rot, scale: 1 }}
            exit={reduce
                ? { opacity: 0 }
                : { opacity: 0, y: y + 70, rotate: rot + 18, scale: 0.86, transition: { duration: 0.25 } }}
            transition={riffle
                ? { duration: 0.85, delay: i * 0.05, repeat: Infinity, repeatDelay: 0.3, ease: "easeInOut" }
                : reduce
                    ? { duration: 0.2 }
                    : { type: "spring", stiffness: 210, damping: 24, mass: 0.8 }}
        >
            {/* Keyed on the reveal, so ARRIVING at it remounts the flip face
                down and turns it over — from the deck, and equally from a
                spread, which is how a retake reaches it with no build step in
                between. Without the key a face-up card simply stays face up. */}
            <motion.div
                key={mode === "reveal" ? "reveal" : "live"}
                className="relative w-full h-full"
                style={{ transformStyle: "preserve-3d" }}
                initial={mode === "reveal" && !reduce ? { rotateY: 180 } : false}
                animate={{ rotateY: faceDown ? 180 : 0 }}
                transition={mode === "reveal"
                    ? { duration: 0.5, delay: revealDelay, ease: [0.4, 0.1, 0.2, 1] }
                    : { duration: 0.42, ease: [0.4, 0.1, 0.2, 1] }}
            >
                {/* Face. */}
                <div className="theme-locked-light absolute inset-0"
                    style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                        filter: "drop-shadow(0 16px 18px rgba(0,0,0,0.42))" }}>
                    <FanCard card={card} strip={strip} width={W} labelSize={labelSize} />
                    {card.gold && mode === "reveal" && !reduce && (
                        <span className="onb-sheen rounded-[0.9rem]"
                            style={{ animationDelay: `${revealDelay + 0.4}s` }} />
                    )}
                </div>
                {/* Back. */}
                <div className="theme-locked-light absolute inset-0"
                    style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                        transform: "rotateY(180deg)", filter: "drop-shadow(0 14px 16px rgba(0,0,0,0.45))" }}>
                    <CardBack tone={BACK_TONE} skin={null} className="w-full h-full" />
                </div>
            </motion.div>

            {/* The target, once turned over, glows. Only the Ace: it is the one
                card in the hand that is a goal rather than a fact. */}
            {card.gold && mode === "reveal" && (
                <motion.span aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-[0.9rem]"
                    initial={{ opacity: 0 }}
                    animate={reduce ? { opacity: 0.8 } : { opacity: [0, 1, 0.65] }}
                    transition={{ duration: 1.4, delay: revealDelay + 0.3 }}
                    style={{ boxShadow: `0 0 0 2px ${GOLD}, 0 0 46px 6px rgba(240,180,41,0.55)` }} />
            )}
        </motion.div>
    );
}

/** The dealer's deck, face down, where the cards come from. */
function DealerDeck({ W, H }) {
    return (
        <div className="absolute pointer-events-none" aria-hidden="true"
            style={{ width: W * 0.62, height: H * 0.62, right: 18, top: 10 }}>
            {[0, 1, 2].map((k) => (
                <div key={k} className="theme-locked-light absolute inset-0"
                    style={{ transform: `translate(${k * -2}px, ${k * -2}px) rotate(${6 - k * 2}deg)` }}>
                    <CardBack tone={BACK_TONE} skin={null} className="w-full h-full opacity-90" />
                </div>
            ))}
        </div>
    );
}

export function Spread({ answers, mode = "spread", compact = false, previewAtar = null }) {
    const reduce = useReducedMotion();
    const [ref, width] = useWidth();
    const hand = handFrom(previewAtar != null && !answers.goalAtar
        ? { ...answers, goalAtar: previewAtar } : answers);
    const big = mode === "reveal";
    const W = compact ? (big ? 74 : 66) : (big ? 128 : 112);
    const H = Math.round(W * 1.4);
    const n = hand.length;
    const avail = Math.max(W, width - (compact ? 28 : 72));
    const stepX = n > 1 ? Math.min(W * (big ? 0.84 : 0.72), (avail - W) / (n - 1)) : 0;
    const labelSize = compact ? "7.5px" : big ? "11px" : "9.5px";

    return (
        <div ref={ref} className="relative w-full h-full">
            {!compact && mode === "spread" && <DealerDeck W={W} H={H} />}
            {width > 0 && (
                <AnimatePresence>
                    {hand.map((c, i) => (
                        <TableCard key={c.key} card={c} i={i} n={n} mode={mode}
                            W={W} H={H} stepX={stepX} reduce={reduce} labelSize={labelSize}
                            revealDelay={0.45 + i * 0.2} />
                    ))}
                </AnimatePresence>
            )}
            {/* Before the first answer the felt is not empty, it is WAITING:
                one outlined place where the first card will land. An empty
                table beside a question reads as a panel that failed to load. */}
            {n === 0 && !compact && (
                <>
                    <motion.div aria-hidden="true"
                        className="absolute left-1/2 top-1/2 rounded-[0.95rem] border-2 border-dashed border-white/[0.16]"
                        style={{ width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2 }}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={reduce ? { opacity: 1, scale: 1 } : { opacity: [0.5, 1, 0.5], scale: 1 }}
                        transition={reduce ? { duration: 0.3 } : { opacity: { duration: 2.6, repeat: Infinity, ease: "easeInOut" }, scale: { duration: 0.4 } }} />
                    <p className="absolute inset-x-0 bottom-6 text-center text-xs font-semibold text-white/45">
                        Your deck builds here as you answer.
                    </p>
                </>
            )}
        </div>
    );
}

/** VTAC's scaling for the line-up just picked, drawn on the felt. */
export function FeltScaling({ subjects = [] }) {
    const reduce = useReducedMotion();
    const { scaled, unscaled } = scalingFor(subjects);
    if (scaled.length === 0 && unscaled.length === 0) return null;
    // Drawn around zero, because scaling goes both ways and a chart with its
    // baseline at the minimum would make a subject that scales DOWN look like
    // a small positive. The widest bar in either direction sets the scale.
    const reach = Math.max(4, ...scaled.map((s) => Math.abs(s.factor)));
    return (
        <div data-felt-scaling className="rounded-2xl bg-white/[0.05] border border-white/10 p-4">
            <div className="flex items-baseline justify-between gap-3 mb-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#9BE15D]">
                    What VTAC does to your line-up
                </p>
                <span className="text-[10px] font-bold text-white/40 tabular-nums">2025 report</span>
            </div>
            <div className="space-y-2">
                <AnimatePresence initial={false}>
                    {scaled.map((s) => {
                        const pct = (Math.abs(s.factor) / reach) * 50;
                        const up = s.factor >= 0;
                        return (
                            <motion.div key={s.name} layout={!reduce}
                                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                                className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3">
                                <span className="text-xs font-bold text-white/85 truncate" title={s.name}>
                                    {shortSubject(s.name)}
                                </span>
                                <span className="relative h-2 rounded-full bg-white/[0.07]">
                                    <span className="absolute top-[-3px] bottom-[-3px] left-1/2 w-px bg-white/25" />
                                    <motion.span
                                        className={`absolute top-0 bottom-0 rounded-full ${up ? "bg-[#7BDA2E]" : "bg-[#FF8A7A]"}`}
                                        style={up ? { left: "50%" } : { right: "50%" }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ type: "spring", stiffness: 140, damping: 20 }} />
                                </span>
                                <span className={`text-xs font-extrabold tabular-nums text-right ${up ? "text-[#9BE15D]" : "text-[#FFA597]"}`}>
                                    {s.factor > 0 ? `+${s.factor}` : s.factor < 0 ? `−${Math.abs(s.factor)}` : "0"}
                                </span>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
            {unscaled.length > 0 && (
                <p className="text-[11px] text-white/45 mt-3 leading-snug">
                    No VTAC figure for {unscaled.join(", ")}.
                </p>
            )}
            <p className="text-[11px] text-white/40 mt-3 leading-snug">
                Scaling reflects how strong the cohort is, not how hard the subject is.
            </p>
        </div>
    );
}

/**
 * The whole table: Ace and his line at the top, the spread in the middle, and
 * whatever this screen pays out at the bottom.
 */
export default function Table({ answers, mode = "spread", ace = null, footer = null, previewAtar = null, className = "" }) {
    const dealt = handFrom(answers).length;
    return (
        <div className={`onb-felt rounded-[2rem] h-full flex flex-col overflow-hidden ${className}`}>
            {ace && (
                <div className="px-7 pt-7">
                    <AceHost variant="table" lines={ace.lines} beat={ace.beat} pose={ace.pose} dealt={dealt} />
                </div>
            )}
            <div className="relative flex-1 min-h-[17rem] mx-4">
                <Spread answers={answers} mode={mode} previewAtar={previewAtar} />
            </div>
            {footer && <div className="px-7 pb-7">{footer}</div>}
        </div>
    );
}
