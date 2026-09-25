/**
 * PriceAnchor — the price, next to the thing everyone compares it to.
 *
 * $5 a week means nothing on its own. $5 a week beside $90 an hour means
 * everything, and the comparison was previously one line of small grey text
 * under the pricing card doing none of that work.
 *
 * Two cards face-up on the table, one obviously the better play. The tutor
 * card is not a strawman and is not sneered at: a good tutor is genuinely
 * worth the money, and pretending otherwise would insult anyone who has one.
 * What it cannot do is be there at eleven on a Sunday night, which is the
 * honest difference and the only one worth drawing.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import PlayingCard from "@/components/cards/PlayingCard";

const ROWS = [
    { label: "Marks against VCAA criteria", tutor: true, acedit: true },
    { label: "Covers every subject you take", tutor: false, acedit: true },
    { label: "There at 11pm the night before", tutor: false, acedit: true },
    { label: "Tracks what you are forgetting", tutor: false, acedit: true },
    { label: "Knows you personally", tutor: true, acedit: false },
];

function Mark({ on }) {
    return on
        ? <Check className="w-4 h-4 text-primary flex-shrink-0" strokeWidth={3} />
        : <X className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" strokeWidth={3} />;
}

function Side({ rank, suit, tone, dim, eyebrow, price, unit, note, pick, delay }) {
    const reduce = useReducedMotion();
    return (
        <motion.div
            data-price-side={dim ? "tutor" : "acedit"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26, rotate: dim ? 1.6 : -1.6 }}
            whileInView={{ opacity: 1, y: 0, rotate: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={reduce ? { duration: 0.3 } : {
                type: "spring", stiffness: 195, damping: 22, delay,
            }}
        >
            <PlayingCard rank={rank} suit={suit} tone={tone} watermark={false}
                className={`w-full h-full ${dim ? "opacity-70" : ""}`}>
                <div className="p-6 sm:p-7 pt-11">
                    <p className="stat-label mb-2">{eyebrow}</p>
                    <p className="font-display font-extrabold text-foreground
                        text-4xl sm:text-5xl leading-none tracking-tight">
                        {price}
                        <span className="text-muted-foreground/60 text-base font-bold ml-2">
                            {unit}
                        </span>
                    </p>
                    <p className="text-muted-foreground text-sm mt-2 leading-snug">{note}</p>

                    <div className="mt-5 pt-5 border-t border-border space-y-2.5">
                        {ROWS.map((r) => (
                            <div key={r.label} className="flex items-start gap-2.5">
                                <Mark on={pick(r)} />
                                <span className={`text-[13px] leading-snug ${
                                    pick(r) ? "text-foreground/85" : "text-muted-foreground/60"}`}>
                                    {r.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </PlayingCard>
        </motion.div>
    );
}

export default function PriceAnchor() {
    return (
        <div data-price-anchor className="grid sm:grid-cols-2 gap-5 lg:gap-7 items-stretch">
            <Side
                rank="3" suit="heart" tone="#94A3B8" dim delay={0}
                eyebrow="A private tutor"
                price="$90" unit="an hour"
                note="One hour a week, in term time, if they have a slot."
                pick={(r) => r.tutor}
            />
            <Side
                rank="A" suit="spade" tone="#58CC02" delay={0.12}
                eyebrow="AcedIt"
                price="$5" unit="a week"
                note="A whole month costs less than one session."
                pick={(r) => r.acedit}
            />
        </div>
    );
}
