/**
 * EvidenceSplit — the two columns that are the entire argument for the app.
 *
 * In 2013 Dunlosky and colleagues reviewed ten common study techniques and
 * rated each for practical utility. Two came out high. Two came out low. The
 * two rated low are the two every student does, and the two rated high are the
 * two almost nobody does, and that gap is the whole reason this product has a
 * point of view.
 *
 * It is laid out as cards on two sides of a table because that is what it is:
 * a hand you should be playing against a hand you are playing. The left column
 * is face-up and lit; the right is greyed and leaning, the way a folded hand
 * sits. Nobody needs the metaphor explained, which is the test of whether it
 * was worth using.
 *
 * EVERY CLAIM CARRIES ITS SOURCE, right there in the column, because
 * "studies show" is what people write when there is no study. A reader who
 * wants to check any line of this can, in about a minute, and a page that
 * survives being checked is worth more than one that is never tested.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import PlayingCard from "@/components/cards/PlayingCard";

const WORKS = [
    {
        rank: "A", suit: "spade", tone: "#58CC02",
        title: "Practice testing",
        body: "Pulling an answer out of your head, cold. Rated high utility, and the effect is one of the largest and most replicated in the whole literature.",
        cite: "Dunlosky et al. (2013) · Roediger & Karpicke (2006)",
    },
    {
        rank: "K", suit: "club", tone: "#58CC02",
        title: "Distributed practice",
        body: "The same total hours, spread out instead of crammed. Rated high utility. Leaving a gap long enough to start forgetting is what makes the review do anything.",
        cite: "Dunlosky et al. (2013) · Cepeda et al. (2006)",
    },
];

const DOESNT = [
    {
        rank: "3", suit: "heart", tone: "#94A3B8",
        title: "Rereading",
        body: "Rated low utility. Students who reread felt more confident than students who tested themselves, and remembered substantially less a week later.",
        cite: "Dunlosky et al. (2013) · Roediger & Karpicke (2006)",
    },
    {
        rank: "2", suit: "diamond", tone: "#94A3B8",
        title: "Highlighting",
        body: "Rated low utility. It feels like work, it produces a decorated page, and on its own it does close to nothing for what you can recall later.",
        cite: "Dunlosky et al. (2013)",
    },
];

function Column({ items, heading, sub, dim, side }) {
    const reduce = useReducedMotion();
    return (
        <div>
            <p className={`stat-label mb-1 ${dim ? "text-white/40" : "text-primary"}`}>{heading}</p>
            <p className={`text-sm mb-6 ${dim ? "text-white/40" : "text-white/70"}`}>{sub}</p>
            <div className="space-y-4">
                {items.map((it, i) => (
                    <motion.div
                        key={it.title}
                        data-evidence={dim ? "low" : "high"}
                        className="flex gap-4"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, x: side * 30, rotate: side * 1.5 }}
                        whileInView={{ opacity: dim ? 0.72 : 1, x: 0, rotate: 0 }}
                        viewport={{ once: true, margin: "-70px" }}
                        transition={reduce ? { duration: 0.3 } : {
                            type: "spring", stiffness: 190, damping: 22, delay: i * 0.12,
                        }}
                    >
                        <PlayingCard rank={it.rank} suit={it.suit} tone={it.tone}
                            smallIndices watermark={false}
                            className={`w-[62px] flex-shrink-0 aspect-[2.5/3.5] self-start
                                ${dim ? "grayscale" : ""}`}>
                            <span className="absolute inset-0 grid place-items-center">
                                <span className="font-display font-black text-lg text-foreground">
                                    {it.rank}
                                </span>
                            </span>
                        </PlayingCard>
                        <div className="min-w-0">
                            <h3 className={`font-display font-extrabold text-lg leading-tight
                                ${dim ? "text-white/70" : "text-white"}`}>
                                {it.title}
                            </h3>
                            <p className={`text-sm leading-relaxed mt-1.5
                                ${dim ? "text-white/45" : "text-white/65"}`}>
                                {it.body}
                            </p>
                            <p className="text-[11px] text-white/30 mt-2 leading-snug">{it.cite}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

export default function EvidenceSplit() {
    return (
        <div data-evidence-split className="grid md:grid-cols-2 gap-10 lg:gap-16">
            <Column
                items={WORKS} side={-1}
                heading="Rated high utility"
                sub="The two techniques AcedIt is built around."
            />
            <Column
                items={DOESNT} side={1} dim
                heading="Rated low utility"
                sub="The two techniques almost every student actually does."
            />
        </div>
    );
}
