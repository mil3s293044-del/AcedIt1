/**
 * BoardAvatar — a person's initials on their own hue, the same on every board.
 *
 * `layoutId` is what lets a person FLY between the podium and the ledger when
 * a board changes under them: the medallion on a card and the avatar on a row
 * share one id, so framer draws one moving from the other. The radius is an
 * inline style rather than a class because a layout animation scales the box,
 * and framer only corrects a radius it can read off the style — a class
 * radius would bulge into an oval mid-flight.
 */
import React from "react";
import { motion } from "framer-motion";
import { avatarHue, initialsOf } from "@/lib/ranked";

export default function BoardAvatar({ name, size = 38, ring = "", layoutId, className = "" }) {
    const hue = avatarHue(name);
    const Tag = layoutId ? motion.div : "div";
    return (
        <Tag {...(layoutId ? { layoutId } : {})}
            className={`flex items-center justify-center font-display font-black flex-shrink-0 ${ring} ${className}`}
            style={{
                width: size, height: size,
                borderRadius: Math.round(size * 0.32),
                backgroundColor: `hsl(${hue} 70% 92%)`,
                color: `hsl(${hue} 70% 28%)`,
                fontSize: size * 0.36,
            }}
            aria-hidden="true">
            {initialsOf(name)}
        </Tag>
    );
}
