/**
 * YourHand — the subjects you are carrying, as the cards they already are.
 *
 * THE APP IS A DECK AND THE DASHBOARD DID NOT SHOW YOUR DECK. Every other
 * surface had committed: the review table deals, the quiz table plays a suit,
 * onboarding builds a hand, the landing page throws several hundred of them at
 * the screen. The one page a student opens every single day showed a
 * leaderboard, a progress bar and a list. The most on-theme thing available
 * was also the most useful thing available, and it was missing.
 *
 * NOTHING HERE IS INVENTED. The rank is the mastery score the review deck
 * already computes, through the same rankFor the deck uses. The suit and the
 * colour come from the subject's name through cardIdentity, so they match the
 * card you were shown during onboarding and the deck you opened yesterday.
 * This panel adds no new fact about a subject; it puts the facts that already
 * existed onto the object the app is made of.
 *
 * WHICH MAKES IT READ IN ONE GLANCE. A row of numbers ("Chemistry 78%,
 * Methods 34%") is four acts of arithmetic. A Queen next to a four is not.
 * You can see which subject is carrying you and which one is going to cost
 * you, from across the room, without reading a word — and the lowest card
 * always sits at the same end, because the hand is sorted.
 *
 * THE HAND IS HONEST ABOUT BEING EMPTY. A student with no flashcards yet gets
 * a face-down pack and an invitation, not a row of grey placeholder cards
 * pretending to be subjects. Fake data on the one panel whose entire job is to
 * tell you the truth about where you stand would poison the rest of the page.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowRight, Layers } from "lucide-react";
import PlayingCard, { CardBack } from "@/components/cards/PlayingCard";
import { rankFor, suitFor, colorFor, rankTitle } from "@/components/cards/cardIdentity";

/** One subject, face up. */
function SubjectCard({ row, i, n, reduce }) {
    const rank = rankFor(row.mastery);
    const suit = suitFor(row.subject);
    const tone = colorFor(row.subject);

    // The fan leans out from the middle, the way a held hand does. Small
    // angles: this one has to stay readable, unlike a decorative fan.
    const mid = (n - 1) / 2;
    const off = n > 1 ? i - mid : 0;

    return (
        <motion.div
            data-subject-card={row.subject}
            className="flex-shrink-0"
            initial={reduce
                ? { opacity: 0 }
                : { opacity: 0, y: 26, rotate: off * 2 + 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, rotate: off * 1.6, scale: 1 }}
            transition={reduce
                ? { duration: 0.25, delay: i * 0.04 }
                : { type: "spring", stiffness: 220, damping: 23, delay: 0.06 + i * 0.07 }}
            whileHover={reduce ? undefined : { y: -10, rotate: 0, scale: 1.04, zIndex: 5 }}
        >
            <Link
                to={createPageUrl("Study")}
                title={`${row.subject} — ${rankTitle(rank, suit, row.mastery)}`}
                className="block focus-visible:outline-none focus-visible:ring-2
                    focus-visible:ring-primary rounded-[0.9rem]"
            >
                <PlayingCard
                    rank={rank}
                    suit={suit}
                    tone={tone}
                    mastery={row.mastery}
                    smallIndices
                    pips="compact"
                    className="w-[92px] sm:w-[104px] aspect-[2.5/3.5]"
                >
                    {/* The name on a band in the subject's own colour, the same
                        arrangement as the hand in onboarding, so a student who
                        built one two minutes ago recognises this one. */}
                    <span className="absolute inset-x-0 bottom-0 px-1.5 pt-1 pb-1.5 text-center"
                        style={{ background: `${tone}22` }}>
                        <span className="block text-[10px] font-extrabold leading-[1.15]
                            text-foreground/80 line-clamp-2 break-words">
                            {row.subject}
                        </span>
                    </span>

                    {/* Due count, printed small under the index rather than as
                        a badge floating over the face. A card with a sticker on
                        it stops being a card. */}
                    {row.due > 0 && (
                        <span className="absolute top-1.5 right-2 text-[10px] font-black
                            tabular-nums text-streak">
                            {row.due}
                        </span>
                    )}
                </PlayingCard>
            </Link>
        </motion.div>
    );
}

export default function YourHand({ hand = [], className = "" }) {
    const reduce = useReducedMotion();
    const shown = hand.slice(0, 8);
    const totalDue = hand.reduce((s, r) => s + r.due, 0);
    // Do the ranks actually differ? Compared on RANK rather than on mastery,
    // because two subjects eight points apart can still both be sevens, and
    // the sentence is about the cards the reader is looking at.
    const spread = shown.length > 1
        && rankFor(shown[0].mastery) !== rankFor(shown[shown.length - 1].mastery);

    return (
        <div data-your-hand className={`rounded-2xl bg-surface border border-border
            shadow-soft p-5 lg:p-6 ${className}`}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
                <p className="stat-label text-muted-foreground">Your hand</p>
                {totalDue > 0 && (
                    <span className="pill bg-streak/10 text-streak text-[10px]">
                        {totalDue} due
                    </span>
                )}
            </div>

            {hand.length > 0 ? (
                <>
                    {/* Only claim a strongest and a weakest when the ranks
                        actually differ. A brand new deck is all twos, and a
                        sentence naming a best and a worst over four identical
                        cards is the page telling you something it cannot see. */}
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                        {spread
                            ? <>Rank is how well you know it. <span className="font-bold text-foreground">{shown[0].subject}</span> is
                                your strongest card, <span className="font-bold text-foreground">{shown[shown.length - 1].subject}</span> your
                                weakest.</>
                            : <>Rank is how well you know it. Everything is still a two,
                                because ranks are earned one review at a time.</>}
                    </p>

                    {/* Overflow rather than shrink: eight subjects at a readable
                        card size is wider than a column on a laptop, and a hand
                        squeezed until the indices are unreadable is worse than
                        a hand you scroll. */}
                    <div className="flex gap-2 sm:gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
                        {shown.map((row, i) => (
                            <SubjectCard key={row.subject} row={row} i={i}
                                n={shown.length} reduce={reduce} />
                        ))}
                    </div>

                    <Link to={createPageUrl("Study")}
                        className="inline-flex items-center gap-1 text-[11px] font-bold
                            text-primary hover:underline mt-2">
                        Play a card <ArrowRight className="w-3 h-3" />
                    </Link>
                </>
            ) : (
                /* Face down, because there is nothing to show yet and drawing
                   grey placeholder subjects here would be a lie on the one
                   panel whose whole job is to be straight with you. */
                <div className="flex items-center gap-4 pt-2">
                    <div className="relative w-[76px] flex-shrink-0">
                        <CardBack className="absolute inset-0 w-full aspect-[2.5/3.5]
                            -rotate-6 opacity-60" flat />
                        <CardBack className="relative w-full aspect-[2.5/3.5] rotate-2" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-display font-extrabold text-foreground text-base leading-snug">
                            Nothing dealt yet.
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                            Make some flashcards and your subjects turn face up here, ranked by
                            how well you actually know them.
                        </p>
                        <Link to={createPageUrl("Study")}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold
                                text-primary hover:underline mt-2">
                            <Layers className="w-3.5 h-3.5" /> Build your first deck
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
