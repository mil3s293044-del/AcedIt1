/**
 * AchievementUnlock — the moment an achievement is earned, wherever you are.
 *
 * ─── What this replaces: nothing at all ─────────────────────────────────────
 * Unlocks were granted server-side on every XP award, the reward XP landed in
 * the total, and NOTHING SAID SO. A student found out by navigating to Ranked,
 * choosing the profile tab, and noticing a tile had changed colour. An
 * achievement nobody is told about is a database row, not a reward — and the
 * XP arrives folded into a number that moves constantly anyway, so even the
 * payout was invisible.
 *
 * ─── RARITY DRIVES THE CEREMONY ─────────────────────────────────────────────
 * A common unlock takes a corner and leaves; a legendary takes the screen and
 * holds. If everything landed identically the whole ladder would flatten —
 * "Marathon: sixty days running" would arrive exactly as loudly as "add your
 * first subject", and after the second one nobody would look at either.
 * `CEREMONY` in achievements.js owns the numbers so the loudness and the XP
 * cannot drift apart.
 *
 * ─── It fires ONCE, ever ────────────────────────────────────────────────────
 * Keyed in `localStorage` by code, exactly as SettlementReveal is. An unlock
 * replayed on every page load is not a celebration, it is a popup — and the
 * server's self-heal legitimately re-reports codes it granted earlier, so
 * without the guard opening Ranked would fire the whole back catalogue at
 * somebody. Blocked storage counts as already-seen for the same reason.
 *
 * ─── A queue, because they arrive in batches ────────────────────────────────
 * One study session can clear three at once. They play in sequence, rarest
 * LAST — the ladder has to climb, and a legendary followed by two commons
 * reads as an anticlimax.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import confetti from "canvas-confetti";
import * as Icons from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACHIEVEMENT_BY_CODE, CEREMONY, RARITIES } from "@/lib/achievements";

const SEEN_KEY = "acedit.achievements.seen";

/** Rarity palette, on design tokens. Static classes only. */
const LOOK = {
    common: {
        ink: "text-muted-foreground", chip: "bg-secondary text-muted-foreground",
        ring: "border-border", glow: "rgba(148,163,184,0.35)", label: "Unlocked",
    },
    rare: {
        ink: "text-chart-3", chip: "bg-chart-3/15 text-chart-3",
        ring: "border-chart-3/40", glow: "rgba(28,176,246,0.45)", label: "Rare",
    },
    epic: {
        ink: "text-chart-4", chip: "bg-chart-4/15 text-chart-4",
        ring: "border-chart-4/50", glow: "rgba(206,130,255,0.5)", label: "Epic",
    },
    legendary: {
        ink: "text-xp", chip: "bg-xp/15 text-xp",
        ring: "border-xp/60", glow: "rgba(255,200,0,0.55)", label: "Legendary",
    },
};

function seenSet() {
    try {
        const raw = localStorage.getItem(SEEN_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        // Blocked storage counts as already-seen: firing the whole back
        // catalogue at somebody on every page load is far worse than a student
        // missing one animation.
        return null;
    }
}

function markSeen(codes) {
    try {
        const s = seenSet() || new Set();
        codes.forEach((c) => s.add(c));
        localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-200)));
    } catch { /* the guard above already treats this as seen */ }
}

/** Codes not yet celebrated on this device. */
export function unseenUnlocks(codes = []) {
    const s = seenSet();
    if (s === null) return [];
    return codes.filter((c) => c && ACHIEVEMENT_BY_CODE[c] && !s.has(c));
}

/** XP that counts up, because a number that appears has not been won. */
function CountUp({ value }) {
    const reduce = useReducedMotion();
    const mv = useMotionValue(reduce ? value : 0);
    const spring = useSpring(mv, { stiffness: 55, damping: 16 });
    const [shown, setShown] = useState(reduce ? value : 0);
    useEffect(() => {
        mv.set(value);
        return spring.on("change", (v) => setShown(Math.round(v)));
    }, [value, mv, spring]);
    return <>{shown.toLocaleString()}</>;
}

function Card({ item, onDone }) {
    const reduce = useReducedMotion();
    const look = LOOK[item.rarity] || LOOK.common;
    const rite = CEREMONY[item.rarity] || CEREMONY.common;
    const Icon = Icons[item.icon] || Icons.Award;
    const big = rite.takesScreen;
    const fired = useRef(false);

    useEffect(() => {
        if (fired.current) return;
        fired.current = true;
        if (rite.confetti > 0 && !reduce) {
            confetti({
                particleCount: rite.confetti, spread: big ? 75 : 50,
                startVelocity: big ? 45 : 32, origin: { y: big ? 0.65 : 0.2 },
                colors: ["#58CC02", "#FFC800", "#1CB0F6", "#CE82FF"],
                disableForReducedMotion: true,
            });
        }
        const t = setTimeout(onDone, rite.hold);
        return () => clearTimeout(t);
    }, [rite, big, reduce, onDone]);

    const crest = (
        <motion.span
            // The crest STAMPS: overshoots and settles, the way a seal lands.
            // A fade would be the app apologising for the reward.
            initial={{ scale: reduce ? 1 : 2.2, rotate: reduce ? 0 : -14, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 15, delay: reduce ? 0 : 0.08 }}
            className={`inline-flex items-center justify-center rounded-2xl border-2 ${look.ring} ${look.chip}
                ${big ? "w-20 h-20" : "w-11 h-11"}`}
            style={reduce ? undefined : { filter: `drop-shadow(0 0 12px ${look.glow})` }}
        >
            <Icon className={big ? "w-10 h-10" : "w-5 h-5"} />
        </motion.span>
    );

    // ── The quiet one: a strip in the corner ────────────────────────────────
    if (!big) {
        return (
            <motion.div
                initial={{ opacity: 0, y: reduce ? 0 : -14, scale: reduce ? 1 : 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] w-[min(94vw,26rem)]"
            >
                <div className={`flex items-center gap-3 rounded-2xl border-2 ${look.ring}
                    bg-surface shadow-soft px-4 py-3`}>
                    {crest}
                    <div className="min-w-0 flex-1">
                        <p className={`stat-label ${look.ink}`}>{look.label}</p>
                        <p className="font-display font-extrabold text-foreground text-sm leading-tight truncate">
                            {item.name}
                        </p>
                    </div>
                    <span className="font-display font-black text-xp text-sm tabular-nums flex-shrink-0">
                        +<CountUp value={item.reward_xp} />
                    </span>
                </div>
            </motion.div>
        );
    }

    // ── The loud one: it takes the screen ───────────────────────────────────
    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            style={{ background: "rgba(10, 18, 31, 0.74)" }}
            onClick={onDone}
        >
            <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: reduce ? 1 : 0.85, y: reduce ? 0 : 26, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.94, opacity: 0 }}
                transition={{ type: "spring", stiffness: 250, damping: 22 }}
                className={`relative w-full max-w-sm rounded-3xl bg-surface border-2 ${look.ring}
                    shadow-soft p-7 text-center`}
            >
                {/* A slow sheen across the card, only on the loud tiers — the
                    one flourish here carrying no information, and what makes a
                    legendary feel like an object rather than a dialog.
                    WIDE AND FAINT, and both matter: at a third of the width
                    and the crest's full glow alpha it rendered as a solid gold
                    BAR straight through the middle of the card, washing out
                    the achievement's own name behind it. A flourish that hides
                    the thing it is celebrating is not a flourish. */}
                {!reduce && (
                    <motion.span aria-hidden="true"
                        initial={{ x: "-130%" }} animate={{ x: "130%" }}
                        transition={{ duration: 1.5, delay: 0.35, ease: "easeInOut" }}
                        className="absolute inset-y-0 w-2/3 pointer-events-none opacity-25
                            mix-blend-plus-lighter"
                        style={{ background: `linear-gradient(90deg, transparent 0%, ${look.glow} 50%, transparent 100%)` }} />
                )}

                <div className="relative">
                    {crest}
                    <motion.p
                        initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: reduce ? 0 : 0.22 }}
                        className={`stat-label mt-4 ${look.ink}`}>{look.label} unlocked</motion.p>

                    <motion.h2
                        initial={{ opacity: 0, y: reduce ? 0 : 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: reduce ? 0 : 0.3 }}
                        className="font-display font-black text-2xl text-foreground leading-tight mt-1">
                        {item.name}
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: reduce ? 0 : 0.38 }}
                        className="text-sm text-muted-foreground mt-2">{item.desc}</motion.p>

                    <motion.p
                        initial={{ opacity: 0, scale: reduce ? 1 : 0.7 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: reduce ? 0 : 0.5, type: "spring", stiffness: 300, damping: 18 }}
                        className="font-display font-black text-4xl text-xp tabular-nums mt-5">
                        +<CountUp value={item.reward_xp} />
                        <span className="text-base font-bold text-muted-foreground ml-1">XP</span>
                    </motion.p>

                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: reduce ? 0 : 0.62 }}>
                        <Button onClick={onDone}
                            className="mt-6 w-full rounded-2xl py-6 font-display font-extrabold text-base
                                bg-foreground text-background hover:bg-foreground/90 btn-3d">
                            Nice
                        </Button>
                    </motion.div>
                </div>
            </motion.div>
        </motion.div>
    );
}

/**
 * Mount once, high in the tree. Feed it codes; it plays the ones this device
 * has not celebrated, rarest last, and remembers them.
 */
export default function AchievementUnlock({ codes = [] }) {
    const [queue, setQueue] = useState([]);

    const rank = useMemo(() => Object.fromEntries(RARITIES.map((r, i) => [r, i])), []);

    useEffect(() => {
        const fresh = unseenUnlocks(codes);
        if (!fresh.length) return;
        markSeen(fresh);
        setQueue((q) => {
            const have = new Set(q.map((x) => x.code));
            const add = fresh
                .filter((c) => !have.has(c))
                .map((c) => ACHIEVEMENT_BY_CODE[c])
                // Rarest LAST: the ladder has to climb, and a legendary
                // followed by two commons reads as an anticlimax.
                .sort((a, b) => (rank[a.rarity] ?? 0) - (rank[b.rarity] ?? 0));
            return [...q, ...add];
        });
    }, [codes, rank]);

    const done = useCallback(() => setQueue((q) => q.slice(1)), []);
    const current = queue[0];

    return (
        <AnimatePresence mode="wait">
            {current && <Card key={current.code} item={current} onDone={done} />}
        </AnimatePresence>
    );
}
