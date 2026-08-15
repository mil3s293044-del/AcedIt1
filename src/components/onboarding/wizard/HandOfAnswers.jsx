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
import PlayingCard, { SuitPip } from "@/components/cards/PlayingCard";
import { suitFor, SUIT_IS_RED } from "@/components/cards/cardIdentity";

/** Face cards for the years that count, so seniority reads off the rank. */
const YEAR_RANK = {
    "Year 7": "7", "Year 8": "8", "Year 9": "9", "Year 10": "10",
    "Year 11 Units 1&2": "J", "Year 12 Units 3&4": "Q",
};

const CARD_W = 62;
const CARD_H = 88;
const STEP_WIDE = 46;
const STEP_TIGHT = 34;
const MAX_FANNED = 7;

/**
 * FanCard — a card as seen in a hand, where only its left edge is showing.
 *
 * This exists because the first two attempts at the hand got the same thing
 * wrong twice, once in the rail and once in the spread. A fanned card is
 * overlapped by the card in front of it: the visible part is a strip as wide
 * as the fan's step, not the whole card. Anything centred on the CARD is
 * therefore centred under its neighbour, and every label in the hand came out
 * as "Mathema", "Chen", "Eng", "Phy" — clipped, and clipped differently on
 * every card, which reads as a rendering fault rather than as a full hand.
 *
 * So the label is laid out in the strip. It is left-anchored, `step` wide, and
 * the last card in the fan gets the full width because nothing covers it.
 *
 * AND ONLY ONE CORNER INDEX. PlayingCard prints both, rotated, the way a real
 * card is printed, which is right everywhere it is used at full size and wrong
 * here: the bottom-right index lands exactly on top of the label, and on the
 * one card that is not overlapped you could read both at once. A card held in
 * a fan shows its top-left corner. That is the entire reason the index is
 * printed twice on a real card, so honouring it means printing it once.
 */
export function FanCard({ card, strip, labelSize }) {
    const red = SUIT_IS_RED[card.suit];
    return (
        <PlayingCard
            rank={card.rank}
            suit={card.suit}
            indices={false}
            watermark={false}
            tone={card.gold ? "#F0B429" : undefined}
            className="w-full h-full"
        >
            <span aria-hidden="true"
                className="absolute top-1 left-1.5 flex flex-col items-center leading-none z-10">
                <span className={`font-display font-black tabular-nums text-[11px] ${
                    red ? "text-destructive" : "text-foreground"}`}>
                    {card.rank}
                </span>
                <SuitPip suit={card.suit} className="w-2 h-2 mt-0.5" />
            </span>

            <span className="absolute bottom-1.5 left-0 px-1 text-center"
                style={{ width: strip }}>
                <span className={`block font-bold leading-[1.15] text-muted-foreground
                    line-clamp-2 break-words hyphens-auto`}
                    style={{ fontSize: labelSize }}>
                    {card.label}
                </span>
            </span>
        </PlayingCard>
    );
}

/**
 * The answers so far, in the order they were given, as cards.
 *
 * Kept as a pure function of the wizard's answers rather than as state that
 * the steps push into, because the wizard already persists answers to
 * localStorage on every change: a hand built from state would come back empty
 * on a refresh while the answers behind it survived, and the student would
 * watch their own hand disappear.
 */
export function handFrom(answers) {
    const out = [];
    if (answers.yearLevel) {
        out.push({
            key: "year",
            rank: YEAR_RANK[answers.yearLevel] || "Q",
            suit: "spade",
            label: answers.yearLevel.replace(/ Units.*$/, ""),
            title: `${answers.yearLevel} — your year, not a mastery rank`,
        });
    }
    (answers.subjects || []).forEach((s) => {
        out.push({
            key: `sub-${s.code || s.id}`,
            // Two, and it has to be. Rank is mastery everywhere else in the
            // app and no card has been reviewed yet.
            rank: "2",
            suit: suitFor(s.name),
            label: s.name,
            title: `${s.name} — every subject starts at a two`,
        });
    });
    if (answers.goalAtar) {
        const n = answers.goalAtar;
        out.push({
            key: "atar",
            rank: "A",
            suit: "spade",
            label: `ATAR ${n.toFixed(n % 1 === 0 ? 0 : 2)}`,
            title: "Your target — the card you are playing for",
            gold: true,
        });
    }
    if (answers.goalCourseName) {
        out.push({
            key: "course",
            rank: "K",
            suit: "diamond",
            label: answers.goalCourseName,
            title: `${answers.goalCourseName}${answers.goalUniversity ? ` at ${answers.goalUniversity}` : ""}`,
        });
    }
    return out;
}

/** One card in the hand. Sized small, so the label is a strip not a paragraph. */
function HeldCard({ card, i, n, step, reduce, last }) {
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
            title={card.title}
            className="absolute bottom-0"
            style={{ width: CARD_W, height: CARD_H, left: i * step, zIndex: i }}
            initial={reduce
                ? { opacity: 0 }
                : { opacity: 0, y: 90, x: 130, rotate: 26, scale: 0.86 }}
            animate={{ opacity: 1, y: lift, x: 0, rotate: lean, scale: 1 }}
            exit={reduce
                ? { opacity: 0 }
                : { opacity: 0, y: 70, rotate: lean + 14, scale: 0.9,
                    transition: { duration: 0.22 } }}
            transition={reduce
                ? { duration: 0.2 }
                : { type: "spring", stiffness: 260, damping: 24, mass: 0.7 }}
        >
            <FanCard card={card} strip={last ? CARD_W : step} labelSize="7.5px" />
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
