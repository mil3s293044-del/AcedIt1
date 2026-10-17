import React from "react";

// Static class strings — the JIT cannot see an assembled class name.
const INK = ["bg-chart-3", "bg-chart-4", "bg-primary", "bg-xp", "bg-streak"];
const SIZE = {
    xs: "w-7 h-7 text-[11px] rounded-xl",
    sm: "w-9 h-9 text-sm rounded-2xl",
    md: "w-11 h-11 text-base rounded-2xl",
};

/**
 * A person, by their initials. The ink is picked off the name, so the same
 * student is the same colour on Friends and in every group they are in.
 */
export default function InitialAvatar({ name, size = "md" }) {
    const initials = String(name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const ink = INK[(String(name || "").charCodeAt(0) || 0) % INK.length];
    return (
        <span className={`${SIZE[size] || SIZE.md} ${ink} text-white flex items-center justify-center font-display font-extrabold flex-shrink-0`} aria-hidden>
            {initials}
        </span>
    );
}
