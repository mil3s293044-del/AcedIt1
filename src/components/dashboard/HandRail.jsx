/**
 * HandRail — everywhere else in the app, as a hand you're holding.
 *
 * What it replaces was nine rounded pills in a wrapping flex row: icon, label,
 * hover tint. Perfectly usable, and the single most generic object on the
 * page — the thing every dashboard puts at the bottom when it runs out of
 * ideas. It was also the LAST thing on the screen, which is the position with
 * the least competition for attention and therefore the cheapest place in the
 * whole product to put something people enjoy.
 *
 * SO IT IS A HAND. Nine cards fanned along the bottom, overlapping the way
 * cards you are holding overlap, and hovering one pulls it out and squares it
 * up so you can read where it goes. The landing hero already teaches this
 * gesture to visitors before they sign up; this is where they get to use it.
 *
 * TWO THINGS LEARNED THE HARD WAY, both from the landing hero:
 *
 *   THE HIT AREA IS NOT THE CARD. Each card sits inside a static slot that
 *   never moves and owns the pointer. When the thing that scales is also the
 *   thing being hovered, lifting it moves it out from under the cursor and
 *   enter/leave fire against each other several times a second.
 *
 *   THE FAN IS MEASURED IN CARD WIDTHS, not in percent of the row. A
 *   percentage inside a transform resolves against the element being moved,
 *   so `x: "62%"` shifts each card by 62% of ITS OWN width and the hand
 *   collapses into a pile.
 *
 * Under reduced motion, and on a phone where nine overlapping cards would be
 * unusable, it falls back to the pills. The fan is the treat, not the only
 * way in.
 */
import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import {
    Brain, FileQuestion, Sparkles, Trophy, BookOpen, Users, Map, Swords, BarChart3,
} from "lucide-react";
import { createPageUrl } from "@/utils";
import PlayingCard from "@/components/cards/PlayingCard";

/**
 * Nine destinations, nine cards. The suits are dealt round the four in order
 * so no two neighbours share one — a fan where three reds sit together reads
 * as a mistake — and the ranks run down from the Ace so the hand has the shape
 * of a real one rather than nine identical faces.
 */
const DESTINATIONS = [
    { label: "Study",     icon: Brain,        link: "Study",        rank: "A",  suit: "spade",   tone: "#0D1626" },
    { label: "Quizzes",   icon: FileQuestion, link: "Quizzes",      rank: "K",  suit: "heart",   tone: "#FF4B4B" },
    { label: "AI Tools",  icon: Sparkles,     link: "AITools",      rank: "Q",  suit: "club",    tone: "#8B5CF6" },
    { label: "Ranked",    icon: Trophy,       link: "Ranked",       rank: "J",  suit: "diamond", tone: "#F59E0B" },
    { label: "Subjects",  icon: BookOpen,     link: "Subjects",     rank: "10", suit: "spade",   tone: "#3B82F6" },
    { label: "Friends",   icon: Users,        link: "Friends",      rank: "9",  suit: "heart",   tone: "#EC4899" },
    { label: "Planner",   icon: Map,          link: "Goals",        rank: "8",  suit: "club",    tone: "#10B981" },
    { label: "Compete",   icon: Swords,       link: "Competitions", rank: "7",  suit: "diamond", tone: "#F97316" },
    { label: "Analytics", icon: BarChart3,    link: "Analytics",    rank: "6",  suit: "spade",   tone: "#0EA5E9" },
];

/**
 * Gap between neighbours, in card widths.
 *
 * A real hand overlaps far more than this, and at 62% it looked exactly right
 * and was unusable: each card hid 35px of its neighbour, which is most of a
 * word, so five of the nine labels read "Stud", "Quizze", "Rank", "riend",
 * "Compe". A navigation rail that you cannot read is a decoration. At 86% the
 * whole face clears its neighbour and it still fans — the overlap that
 * survives is the part doing the work.
 */
const STEP = 86;
/** How far the ends of the arc drop, and how far they lean. */
const DROP = 13;
const LEAN = 7;

function Pills() {
    return (
        <div className="flex flex-wrap gap-2">
            {DESTINATIONS.map((d) => (
                <Link key={d.link} to={createPageUrl(d.link)}>
                    <div className="group flex items-center gap-2 px-3.5 py-2 rounded-xl
                        bg-surface border border-border/60 shadow-soft
                        hover:border-primary/40 hover:bg-primary/5 transition-all">
                        <d.icon className="w-4 h-4 text-muted-foreground
                            group-hover:text-primary transition-colors" />
                        <span className="text-sm font-bold text-foreground">{d.label}</span>
                    </div>
                </Link>
            ))}
        </div>
    );
}

export default function HandRail() {
    const reduce = useReducedMotion();
    const [hover, setHover] = useState(-1);

    if (reduce) return <Pills />;

    return (
        <>
            {/* The fan needs room to overlap; below that the pills are simply
                the better object, so both ship and CSS picks. */}
            <div className="md:hidden"><Pills /></div>

            <div data-hand-rail
                className="hidden md:block relative h-[188px] select-none">
                {DESTINATIONS.map((d, i) => {
                    const t = i / (DESTINATIONS.length - 1) - 0.5;
                    const off = (i - (DESTINATIONS.length - 1) / 2) * STEP;
                    const rest = t * t * DROP * 4;
                    const lean = t * LEAN * 2;
                    const lifted = hover === i;
                    return (
                        <div
                            key={d.link}
                            data-rail-slot={i}
                            onPointerEnter={() => setHover(i)}
                            onPointerLeave={() => setHover(-1)}
                            className="absolute left-1/2 top-3 w-[92px]"
                            style={{
                                zIndex: lifted ? 40 : 10 + i,
                                transform: `translateX(calc(-50% + ${off}%)) `
                                    + `translateY(${rest}px) rotate(${lean}deg)`,
                            }}
                        >
                            <Link to={createPageUrl(d.link)} aria-label={d.label}>
                                <motion.div
                                    data-rail-card={i}
                                    data-lifted={lifted ? "1" : "0"}
                                    className="w-full pointer-events-none"
                                    initial={false}
                                    animate={{
                                        y: lifted ? -14 : 0,
                                        rotate: lifted ? -lean : 0,
                                        scale: lifted ? 1.08 : 1,
                                    }}
                                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                                >
                                    <div style={{
                                        filter: lifted
                                            ? "drop-shadow(0 14px 18px rgba(13,22,38,0.22))"
                                            : "drop-shadow(0 4px 6px rgba(13,22,38,0.12))",
                                    }}>
                                        <PlayingCard rank={d.rank} suit={d.suit} tone={d.tone}
                                            smallIndices watermark={false}
                                            className="w-full aspect-[2.5/3.5]">
                                            <span className="absolute inset-0 flex flex-col
                                                items-center justify-center gap-1.5 px-1">
                                                <d.icon className={`w-5 h-5 transition-colors ${
                                                    lifted ? "text-primary" : "text-muted-foreground"}`} />
                                                <span className="text-[10px] font-extrabold
                                                    text-foreground leading-tight text-center">
                                                    {d.label}
                                                </span>
                                            </span>
                                        </PlayingCard>
                                    </div>
                                </motion.div>
                            </Link>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
