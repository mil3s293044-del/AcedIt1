/**
 * MoveChip — which way a row has gone since the week opened, in a fixed lane.
 *
 * SHAPE CARRIES THE DIRECTION, not just colour. The brand green and the streak
 * red sit at ΔE 7.0 under deuteranopia — the floor's own step-dot lesson — so
 * an up arrow against a down arrow is what makes this readable, with the
 * number as the third channel. A level row draws a dash rather than nothing,
 * because "still there" and "we have no snapshot" are different facts and the
 * second one draws no chip at all.
 *
 * The arrow NUDGES once in its own direction when the chip arrives — a two
 * pixel travel, the smallest motion that says "moved" rather than "is". It
 * never repeats. `felt` inks it for the podium table, which is literal dark
 * in both themes.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { movementLabel } from "@/lib/boardMovement";

export default function MoveChip({ move, compact = false, felt = false }) {
    const reduce = useReducedMotion();
    if (!move) return null;
    const label = movementLabel(move);
    const box = `inline-flex items-center justify-center gap-0.5 tabular-nums font-bold ${
        compact ? "text-[10px]" : "text-[11px]"}`;

    if (move.dir === "new") {
        return (
            <span className={`${box} px-1.5 py-0.5 rounded-md text-[9px] tracking-wide ${
                felt ? "bg-[rgba(240,180,41,0.18)] text-[#F6C454]" : "bg-xp/15 text-xp"}`}
                title={label} aria-label={label}>NEW</span>
        );
    }
    if (move.dir === "level") {
        return (
            <span className={`${box} ${felt ? "text-white/40" : "text-muted-foreground/60"}`}
                title={label} aria-label={label}>
                <Minus className="w-3 h-3" />
            </span>
        );
    }
    const up = move.dir === "up";
    return (
        <span className={`${box} ${up ? (felt ? "text-[#7BE03A]" : "text-primary") : (felt ? "text-[#FF8A7A]" : "text-streak")}`}
            title={label} aria-label={label}>
            <motion.span className="inline-flex"
                initial={reduce ? false : { y: up ? 3 : -3, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.15 }}>
                {up ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </motion.span>
            {move.places}
        </span>
    );
}
