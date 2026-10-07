/**
 * PremiumReveal — the moment somebody has just paid.
 *
 * ─── IT WAS A TICK IN A CIRCLE, ON A PAGE NO DARK THEME COULD READ ──────────
 * The screen at the end of checkout painted itself `from-green-50 via-blue-50
 * to-purple-50`, put `text-green-50` on a `green-600` slab and a
 * `from-purple-50 to-blue-50 / border-purple-200` panel underneath. Three
 * literal light palettes, none of them a token the app owns, so in the dark it
 * came out as bright slabs on a near-black page — the exact failure /Paywall
 * already records. It is on tokens now and reads in both themes.
 *
 * And the "animation" was a `CheckCircle` scaling in. This is the single
 * biggest moment the product has, and the app already owns a vocabulary for a
 * moment: Ace, a deal, and a card that turns over.
 *
 * ─── AN ACE IS EARNED, NEVER GIVEN ──────────────────────────────────────────
 * Three backs fly out of his hand and the middle one turns over as the ace of
 * spades — the brand mark, and the one rank `cardIdentity` has always reserved
 * for something that was earned. `AceDeal` makes the same gesture on the
 * Compete floor, which is why there is no new artwork here: the same `CardBack`
 * at the same gauge, the same `pose="toss"`, the same recovery to a settled
 * pose once the hand is down.
 *
 * `perspective` goes on the PARENT and `rotateY` on the child. An element
 * cannot supply its own vanishing point, and a rotateY without one reads as a
 * horizontal squash — the lesson MovePreview and AceDeal both record.
 *
 * ─── WHAT UNLOCKED, ONE LINE AT A TIME ──────────────────────────────────────
 * "Success!" is a word. The reward is the list of things they can now do, so
 * the rows arrive in sequence rather than as a block. Every row names a real
 * surface, because a benefit nobody can go and find is the copy drift this
 * file keeps recording.
 *
 * ─── AND IT IS NOT SNATCHED AWAY ────────────────────────────────────────────
 * The old screen hard-redirected after 2,500ms, which is less than this reveal
 * takes to play — a celebration cut off mid-deal. Leaving is the student's tap
 * now, with a long fallback so an abandoned tab still lands somewhere. The
 * navigation stays a full `location.href` at the call site, because the whole
 * app has to re-initialise against a profile that became premium ten seconds
 * ago.
 */
import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import PlayingCard, { CardBack } from "@/components/cards/PlayingCard";
import AceBody from "@/components/ace/AceBody";
import { Confetti } from "@/components/shared/Confetti";
import { Button } from "@/components/ui/button";

/** Every row names a surface the student can go and open. */
const UNLOCKED = [
    { what: "Every AI tool", where: "the twelve on AI Tools, no longer locked" },
    { what: "A far bigger weekly stack", where: "generate, mark and explain without rationing it" },
    { what: "Textbook chapters", where: "upload a book once, work a chapter at a time" },
    { what: "Marking on every answer", where: "itemised against the VCAA criteria" },
];

const TURN_MS = 0.42;

export default function PremiumReveal({ onContinue, fallbackMs = 20000 }) {
    const reduce = useReducedMotion();
    const [turned, setTurned] = useState(reduce);

    useEffect(() => {
        if (reduce) return undefined;
        const t = setTimeout(() => setTurned(true), 900);
        return () => clearTimeout(t);
    }, [reduce]);

    // A TAB LEFT OPEN STILL LANDS SOMEWHERE, but long after the reveal has
    // finished rather than through the middle of it.
    useEffect(() => {
        const t = setTimeout(() => onContinue?.(), fallbackMs);
        return () => clearTimeout(t);
    }, [onContinue, fallbackMs]);

    const at = (s) => (reduce ? 0 : s);

    return (
        <div className="relative min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden">
            <Confetti reduce={reduce} />

            <motion.div
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 26 }}
                className="relative w-full max-w-md card-soft on-table p-6 sm:p-8 text-center"
            >
                {/* ── THE DEAL ────────────────────────────────────────────────
                    Three cards out of his hand, the middle one turning over. He
                    stands BESIDE them rather than behind them: the card is what
                    the student is here to watch arrive. */}
                {/* THE DEAL NEEDS A TABLE UNDER IT. Card stock is `--surface`
                    and so is the panel, so all three cards were drawn in the
                    same colour as the thing behind them — white on white in
                    the light, a black hole between two bright backs in the
                    dark. One recessed well separates them in both themes,
                    which is the inset-well idiom SourcePanel already uses. */}
                <div className="flex items-end justify-center gap-3 mb-6
                    rounded-2xl bg-secondary/70 px-3 pt-5 pb-4">
                    <AceBody className="w-16 sm:w-20 flex-shrink-0 -mb-2"
                        pose={turned ? "proud" : "toss"} title="Ace" />

                    <div className="flex items-end gap-1.5" style={{ perspective: 900 }}>
                        {[0, 1, 2].map((i) => {
                            const centre = i === 1;
                            return (
                                <motion.div
                                    key={i}
                                    initial={reduce ? false : { opacity: 0, x: -70, y: 26, rotate: -18 }}
                                    animate={{ opacity: 1, x: 0, y: centre ? -10 : 0, rotate: (i - 1) * 7 }}
                                    transition={{
                                        type: "spring", stiffness: 190, damping: 18,
                                        delay: at(0.1 + i * 0.12),
                                    }}
                                    /* A CARD IS A FIXED ASPECT AND NEEDS A BOX.
                                       `PlayingCard` and `CardBack` fill their
                                       parent — every other caller gives them
                                       `w-full h-full` inside a sized slot — so
                                       a width alone collapses them to a
                                       hairline, which is exactly what the
                                       first screenshot showed. */
                                    /* THE ACE PAINTS LAST. It is the middle of
                                       three in DOM order, so without this the
                                       card on its right overlapped the one
                                       thing the whole screen is about. */
                                    className={`aspect-[2.5/3.5] ${centre
                                        ? "w-[96px] relative z-10" : "w-[64px] opacity-70"}`}
                                >
                                    <motion.div
                                        animate={{ rotateY: centre && turned ? 180 : 0 }}
                                        transition={{ duration: TURN_MS, ease: "easeInOut" }}
                                        style={{ transformStyle: "preserve-3d" }}
                                        className="relative w-full h-full"
                                    >
                                        <div className="absolute inset-0"
                                            style={{ backfaceVisibility: "hidden" }}>
                                            <CardBack className="w-full h-full" />
                                        </div>
                                        {centre && (
                                            <div
                                                className="absolute inset-0"
                                                style={{
                                                    backfaceVisibility: "hidden",
                                                    transform: "rotateY(180deg)",
                                                }}
                                            >
                                                {/* `pips` IS WHAT MAKES IT AN
                                                    ACE. Without it the middle
                                                    is `watermark` — one ghost
                                                    suit at 3.5% — so the one
                                                    card the whole screen is
                                                    about printed blank, in
                                                    both themes. The centred
                                                    mark inks `fill-foreground`
                                                    and therefore reads on
                                                    either stock; `tone` only
                                                    ever tinted the frame. */}
                                                <PlayingCard rank="A" suit="spade"
                                                    tone="#58CC02" pips
                                                    className="w-full h-full" />
                                            </div>
                                        )}
                                    </motion.div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                <motion.p
                    initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: at(1.3) }}
                    className="stat-label text-muted-foreground"
                >
                    You are on premium
                </motion.p>
                <motion.h1
                    initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: at(1.4) }}
                    className="font-display font-black text-3xl text-foreground mt-1 mb-6"
                >
                    Dealt you the ace.
                </motion.h1>

                {/* ── WHAT ACTUALLY UNLOCKED, in sequence ─────────────────── */}
                <ul className="text-left space-y-2.5">
                    {UNLOCKED.map((row, i) => (
                        <motion.li
                            key={row.what}
                            initial={reduce ? false : { opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: at(1.6 + i * 0.16), duration: 0.3 }}
                            className="flex items-start gap-2.5"
                        >
                            <span className="mt-0.5 w-5 h-5 rounded-lg bg-primary/15 flex items-center
                                justify-center flex-shrink-0">
                                <Check className="w-3 h-3 text-primary" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-bold text-foreground">{row.what}</span>
                                <span className="block text-[12px] leading-snug text-muted-foreground">
                                    {row.where}
                                </span>
                            </span>
                        </motion.li>
                    ))}
                </ul>

                <motion.div
                    initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: at(2.4) }}
                >
                    <Button className="w-full font-bold mt-7" onClick={() => onContinue?.()}>
                        Start studying
                    </Button>
                </motion.div>
            </motion.div>
        </div>
    );
}
