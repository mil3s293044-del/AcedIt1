import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Flame } from "lucide-react";

// Flat placement XP — mirror of server.mjs settleHoursCompetition + HoursLeaderboard.
export const FLAT_XP = [150, 100, 60, 30];

// ── Pot math ────────────────────────────────────────────────────────────────
// "XP on the line" = the sum of placement prizes that will be paid out at settle,
// plus any XP currently escrowed in open over/under wagers. Pure function so it
// can be reused on cards and in the battle view without re-deriving.
export function computePot(competition) {
    const accepted = (competition?.participants || []).filter(
        p => p.status === "accepted" || p.status === "completed"
    );
    const placementPot = accepted.reduce(
        (sum, _p, i) => sum + FLAT_XP[Math.min(i, FLAT_XP.length - 1)],
        0
    );
    const wagerPot = (competition?.progress_bets || [])
        .filter(b => b.status === "open")
        .reduce((sum, b) => sum + (b.wagered_xp || 0), 0);
    return { placementPot, wagerPot, total: placementPot + wagerPot };
}

// ── Live countdown ────────────────────────────────────────────────────────────
// Ticks every second. Returns null when there's no deadline.
export function useCountdown(targetDate) {
    const target = targetDate ? new Date(targetDate).getTime() : null;
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!target) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [target]);

    if (!target) return null;

    const diff = target - now;
    const isPast = diff <= 0;
    const abs = Math.abs(diff);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    const minutes = Math.floor((abs % 3600000) / 60000);
    const seconds = Math.floor((abs % 60000) / 1000);

    // Urgency tiers drive the colour + pulse.
    const urgent = !isPast && diff < 86400000;          // < 24h
    const critical = !isPast && diff < 3600000;          // < 1h

    // Compact label: "2d 4h" far out, "4h 11m" inside a day, "11m 09s" inside an hour.
    let short;
    if (days > 0) short = `${days}d ${hours}h`;
    else if (hours > 0) short = `${hours}h ${minutes}m`;
    else short = `${minutes}m ${String(seconds).padStart(2, "0")}s`;

    return { diff, isPast, days, hours, minutes, seconds, urgent, critical, short };
}

// ── Countdown pill / banner ─────────────────────────────────────────────────
// variant="chip"   → tiny inline pill for cards
// variant="banner" → full-width charged strip for the battle header
export function Countdown({ targetDate, variant = "chip", className = "" }) {
    const c = useCountdown(targetDate);
    if (!c) return null;

    if (c.isPast) {
        if (variant === "banner") {
            return (
                <div className={`flex items-center justify-center gap-2 rounded-xl bg-streak/10 px-3 py-2 text-streak ${className}`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-xs font-extrabold uppercase tracking-wide">Time's up — ready to settle</span>
                </div>
            );
        }
        return (
            <span className={`inline-flex items-center gap-1 text-xs font-extrabold text-streak ${className}`}>
                <Clock className="w-3 h-3" /> Time's up
            </span>
        );
    }

    const tone = c.critical ? "streak" : c.urgent ? "xp" : "muted";

    if (variant === "banner") {
        const bannerCls =
            tone === "streak" ? "bg-streak/15 text-streak"
            : tone === "xp" ? "bg-xp/15 text-xp"
            : "bg-surface/15 text-white";
        return (
            <div className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 ${bannerCls} ${className}`}>
                {c.urgent
                    ? <Flame className={`w-4 h-4 ${c.critical ? "animate-soft-pulse" : ""}`} />
                    : <Clock className="w-4 h-4" />}
                <span className="text-xs font-bold uppercase tracking-wide">
                    {c.urgent ? "Closing soon" : "Ends in"}
                </span>
                <span className="font-display font-black text-base tabular-nums">{c.short}</span>
            </div>
        );
    }

    // chip
    const chipCls =
        tone === "streak" ? "text-streak"
        : tone === "xp" ? "text-xp"
        : "text-muted-foreground";
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-bold ${chipCls} ${className}`}>
            {c.urgent
                ? <Flame className={`w-3 h-3 ${c.critical ? "animate-soft-pulse" : ""}`} />
                : <Clock className="w-3 h-3" />}
            {c.short} left
        </span>
    );
}

// ── Count-up number ───────────────────────────────────────────────────────────
// Animates 0 → value once on mount. Dependency-free (rAF).
export function useCountUp(value, duration = 900) {
    const [display, setDisplay] = useState(0);
    const raf = useRef(null);
    useEffect(() => {
        const start = performance.now();
        const tick = (t) => {
            const p = Math.min(1, (t - start) / duration);
            // easeOutCubic
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(Math.round(value * eased));
            if (p < 1) raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
        return () => raf.current && cancelAnimationFrame(raf.current);
    }, [value, duration]);
    return display;
}

// ── Confetti burst ────────────────────────────────────────────────────────────
// Lightweight framer-motion particle burst — no new dependency. Renders a fixed
// overlay, fires once, and self-clears. On-brand token colours.
const CONFETTI_COLORS = [
    "hsl(var(--primary))", "hsl(var(--xp))", "hsl(var(--streak))",
    "hsl(var(--chart-3))", "hsl(var(--chart-4))",
];

export function Confetti({ active, count = 48, duration = 2600 }) {
    const [show, setShow] = useState(false);
    const piecesRef = useRef([]);

    useEffect(() => {
        if (!active) return;
        piecesRef.current = Array.from({ length: count }).map((_, i) => ({
            id: i,
            x: (Math.random() - 0.5) * 2,                 // -1 .. 1 (horizontal drift)
            delay: Math.random() * 0.25,
            rotate: Math.random() * 720 - 360,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            size: 6 + Math.random() * 8,
            left: Math.random() * 100,
            round: Math.random() > 0.5,
        }));
        setShow(true);
        const id = setTimeout(() => setShow(false), duration);
        return () => clearTimeout(id);
    }, [active, count, duration]);

    return (
        <AnimatePresence>
            {show && (
                <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
                    {piecesRef.current.map(p => (
                        <motion.div
                            key={p.id}
                            initial={{ y: "-10vh", x: 0, opacity: 1, rotate: 0 }}
                            animate={{ y: "110vh", x: `${p.x * 18}vw`, rotate: p.rotate, opacity: [1, 1, 0.9, 0] }}
                            transition={{ duration: duration / 1000, delay: p.delay, ease: "easeIn" }}
                            style={{
                                position: "absolute",
                                left: `${p.left}%`,
                                width: p.size,
                                height: p.size * (p.round ? 1 : 1.6),
                                borderRadius: p.round ? "9999px" : "2px",
                                background: p.color,
                            }}
                        />
                    ))}
                </div>
            )}
        </AnimatePresence>
    );
}
