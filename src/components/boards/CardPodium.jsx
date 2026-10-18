/**
 * CardPodium — the top three, dealt onto a table and turned over.
 *
 * ─── WHY CARDS ──────────────────────────────────────────────────────────────
 * Cards are the app's visual language: rank is how strong a thing is, and an
 * Ace is always earned, never given. So first place holds the Ace of spades,
 * second the King and third the Queen — the one place in the app a student
 * can see somebody else holding the Ace, and the thing they are racing for.
 * The cards are real `PlayingCard`s with their real faces (one big pip, a
 * court figure), because the whole theme collapses the moment one card is
 * obviously invented.
 *
 * ─── THE TABLE IS AN OBJECT ─────────────────────────────────────────────────
 * The felt is the signup deal's own table, held still (`felt-still`), in
 * literal ink in both themes — a dark table on a cream page reads as a thing
 * set down on it, which is what a podium is. Card stock is white in both
 * themes for the same reason (`theme-locked-light`): a dark card on dark felt
 * is a hole. Anything printed on the felt is literal light ink.
 *
 * ─── THE REVEAL, ONCE ───────────────────────────────────────────────────────
 * On arrival the plinths come up out of the table, each card is dealt face
 * down onto its plinth — the student's OWN card back if they bought one,
 * because owned has to be worn where a person can see it — and they turn over
 * third, second, first, so the Ace lands last. The medallion and the figure
 * arrive as each card finishes turning, and the figure counts up. Then the
 * table holds still except for one pass of light across the Ace every nine
 * seconds. Timings are `DEAL` in boardKit.js.
 *
 * ON A CHANGE the cards do NOT re-deal. A board switch that puts somebody new
 * in second is not a new table; their medallion flies up from the row it was
 * on (a shared `layoutId`) onto the King, which is the change, drawn.
 *
 * A seat nobody holds keeps its plinth and a face-down card, rather than the
 * staircase collapsing into two steps.
 *
 * ─── WHERE THE AVATAR LIVES ─────────────────────────────────────────────────
 * The medallion sits ACROSS the card's bottom edge, not on its face, for two
 * reasons that are both about the flight: a card face is `overflow-hidden`, so
 * a medallion flying in from the ledger would be clipped by the card it was
 * landing on; and a face is hidden while it turns, so a medallion on it would
 * fly invisibly. Nothing here clips — the felt has no `overflow-hidden`
 * either, and the plinths stand on a rail INSIDE its padding rather than
 * being cut off by its rounded corners.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import PlayingCard, { CardBack } from "@/components/cards/PlayingCard";
import BoardAvatar from "@/components/boards/BoardAvatar";
import MoveChip from "@/components/boards/MoveChip";
import LiveFigure from "@/components/boards/LiveFigure";
import useArrival from "@/components/boards/useArrival";
import {
    PODIUM_RANKS, podiumSeats, DEAL, dealAt, turnAt, seatAt, SHEEN_AT, REVEAL_MS,
} from "@/lib/boardKit";

// Static classes only — JIT cannot see an assembled one.
const CARD_W = {
    md: { 1: "w-[5.25rem] sm:w-[7rem]", 2: "w-[4.25rem] sm:w-[5.5rem]", 3: "w-[4.25rem] sm:w-[5.5rem]" },
    sm: { 1: "w-[4.25rem] sm:w-[5rem]", 2: "w-[3.5rem] sm:w-[4.25rem]", 3: "w-[3.5rem] sm:w-[4.25rem]" },
};
const MEDAL = { md: { 1: 50, 2: 42, 3: 42 }, sm: { 1: 40, 2: 34, 3: 34 } };
// A plinth carrying a reward needs room for two more lines; the steps keep
// their order either way, which is what makes it a staircase.
const PLINTH_H = {
    plain: { 1: "h-[4.25rem] sm:h-20", 2: "h-[3.25rem] sm:h-[3.75rem]", 3: "h-10 sm:h-12" },
    reward: { 1: "h-[5.75rem] sm:h-24", 2: "h-[4.75rem] sm:h-20", 3: "h-[4.25rem] sm:h-[4.5rem]" },
};
const PLINTH_FACE = { 1: "felt-plinth felt-plinth-1", 2: "felt-plinth", 3: "felt-plinth felt-plinth-3" };
const RING = {
    1: "ring-2 ring-[#F0B429]",
    2: "ring-2 ring-[#C9D2E0]",
    3: "ring-2 ring-[#C98A3A]",
};
// The cards lie as dealt — first straight, the other two turned a few degrees
// out — so the three read as cards on a table rather than as icons in a row.
const LIE = { 1: 0, 2: -4, 3: 4 };

const INK = "text-[#F4F1EA]";

function Seat({ place, entry, size, deal, layoutScope, rewards, reduce }) {
    const first = place === 1;
    return (
        <div className="flex flex-col items-center min-w-0" data-podium={place}
            data-seat={entry ? "held" : "open"}>
            {/* ── The card ─────────────────────────────────────────────────
                `perspective` on the PARENT, `rotateY` on the child: an element
                cannot supply its own vanishing point, and without one a turn
                reads as a horizontal squash. */}
            <motion.div
                className={`${CARD_W[size][place]} aspect-[2.5/3.5] relative rounded-[0.9rem] ${
                    entry?.isMe ? "ring-2 ring-primary ring-offset-2 ring-offset-[#0D1626]" : ""}`}
                style={{ perspective: 900 }}
                initial={deal ? { opacity: 0, y: -48, rotate: LIE[place] * 3, scale: 0.9 } : false}
                animate={{ opacity: 1, y: 0, rotate: LIE[place], scale: 1 }}
                transition={{ type: "spring", stiffness: 210, damping: 20, delay: deal ? dealAt(place) : 0 }}>
                <motion.div className="relative w-full h-full" style={{ transformStyle: "preserve-3d" }}
                    initial={deal ? { rotateY: 180 } : false}
                    animate={{ rotateY: entry ? 0 : 180 }}
                    transition={{ duration: DEAL.turn, ease: "easeInOut", delay: deal ? turnAt(place) : 0 }}>
                    <div className="absolute inset-0 theme-locked-light" style={{ backfaceVisibility: "hidden" }}>
                        <PlayingCard rank={PODIUM_RANKS[place]} suit="spade" pips smallIndices={size === "sm"}
                            tone={first ? "#F0B429" : undefined} className="w-full h-full">
                            {/* One pass of light across the Ace, then nothing for
                                nine seconds. Its first pass is the reveal's
                                finish, so the delay is when the Ace is up. */}
                            {first && entry && !reduce && (
                                <span className="board-sheen" aria-hidden="true"
                                    style={{ "--sheen-delay": `${deal ? SHEEN_AT : 0.4}s` }} />
                            )}
                        </PlayingCard>
                    </div>
                    <div className="absolute inset-0"
                        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                        <CardBack className="w-full h-full" />
                    </div>
                </motion.div>
            </motion.div>

            {/* ── The person ───────────────────────────────────────────────
                Keyed by who it is, so a change of occupant mounts a fresh
                medallion and framer flies it in from wherever that person was
                drawn a moment ago. */}
            <div className="relative z-10 -mt-5 sm:-mt-6 flex justify-center"
                style={{ minHeight: MEDAL[size][place] }}>
                {entry && (
                    <motion.div key={entry.key}
                        initial={deal ? { scale: 0.4, opacity: 0 } : false}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 380, damping: 18, delay: deal ? seatAt(place) : 0 }}>
                        <BoardAvatar name={entry.name} size={MEDAL[size][place]}
                            layoutId={reduce ? undefined : `${layoutScope}-av-${entry.key}`}
                            ring={`${RING[place]} ring-offset-2 ring-offset-[#0D1626]`} />
                    </motion.div>
                )}
            </div>

            <div className="w-full min-w-0 text-center px-0.5 mt-1.5 min-h-[2.6rem] sm:min-h-[3rem]">
                {entry && (
                    <motion.div key={entry.key}
                        initial={deal ? { opacity: 0, y: 6 } : { opacity: 0 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: deal ? seatAt(place) + 0.05 : 0.1 }}>
                        <p className={`text-[11px] sm:text-xs font-bold truncate ${
                            entry.isMe ? "text-[#7BE03A]" : INK}`}>
                            {entry.name}
                        </p>
                        <p className={`font-display font-black leading-none mt-0.5 ${
                            first ? "text-lg sm:text-2xl" : "text-[15px] sm:text-lg"}`}>
                            <LiveFigure value={entry.figure.value} format={entry.figure.format}
                                quantity={entry.figure.quantity} countIn={deal} delay={seatAt(place)}
                                tone={first ? "text-[#F6C454]" : INK} flashTone="text-[#7BE03A]" />
                        </p>
                        {(entry.move || entry.badge) && (
                            <div className="flex justify-center items-center gap-1 mt-1 min-w-0">
                                <MoveChip move={entry.move} compact felt />
                                {entry.badge && (
                                    <span className="hidden sm:inline-flex min-w-0">{entry.badge}</span>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </div>

            {/* ── The plinth ───────────────────────────────────────────────
                Revealed from the table edge up with a clip rather than scaled,
                because a scaled step squashes the numeral printed on it. */}
            <motion.div
                className={`mt-1.5 w-full rounded-t-xl ${PLINTH_FACE[place]} ${
                    PLINTH_H[rewards ? "reward" : "plain"][place]}
                    flex flex-col items-center justify-start pt-1.5 sm:pt-2 px-1`}
                initial={deal ? { clipPath: "inset(100% 0% 0% 0%)" } : false}
                animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
                transition={{ duration: DEAL.rise, ease: [0.16, 1, 0.3, 1] }}>
                <span className={`font-display font-black leading-none ${first
                    ? "text-xl sm:text-2xl text-[#F6C454]" : "text-base sm:text-lg text-white/70"}`}>
                    {place}
                </span>
                {entry?.reward && (
                    <span className="mt-1 text-[10px] sm:text-[11px] font-bold leading-tight text-center text-white/70">
                        {entry.reward}
                    </span>
                )}
            </motion.div>
        </div>
    );
}

/**
 * `entries` are in PLACE order, first to third:
 *   { key, name, isMe, figure: { value, format, quantity }, move, badge, reward }
 * `badge` and `reward` are nodes the board supplies (a title, the credits a
 * finish pays); both are optional and absent ones draw nothing.
 */
export default function CardPodium({ entries = [], size = "md", layoutScope = "board", label = "The top three" }) {
    const reduce = useReducedMotion();
    const arriving = useArrival(REVEAL_MS);
    const deal = arriving && !reduce;
    const rewards = entries.some((e) => e?.reward);
    return (
        <section aria-label={label} data-podium-table
            className={`onb-felt felt-still rounded-3xl px-3 sm:px-8 pb-3 sm:pb-4 ${
                size === "sm" ? "pt-4" : "pt-5 sm:pt-7"}`}>
            <div className={`grid grid-cols-3 items-end gap-2 sm:gap-5 mx-auto ${
                size === "sm" ? "max-w-sm" : "max-w-xl"}`}>
                {podiumSeats(entries).map(({ place, entry }) => (
                    <Seat key={place} place={place} entry={entry} size={size} deal={deal}
                        layoutScope={layoutScope} rewards={rewards} reduce={reduce} />
                ))}
            </div>
            {/* The rail the plinths stand on: the table's edge, inside the
                felt, so a rounded corner never cuts a step off. */}
            <div className={`h-px bg-white/15 mx-auto ${size === "sm" ? "max-w-sm" : "max-w-xl"}`} aria-hidden="true" />
        </section>
    );
}
