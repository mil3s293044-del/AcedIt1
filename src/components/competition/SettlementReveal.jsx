/**
 * SettlementReveal — the moment the app never had.
 *
 * ─── What it replaces ───────────────────────────────────────────────────────
 * A battle ending was a TOAST. Weeks of work between four people resolved into
 * a grey rectangle in the corner that faded after four seconds. A call-out —
 * the highest-stakes thing a student can do here, where somebody's whole run in
 * the contest is on one quiz — resolved the same way.
 *
 * Everything else in this app pays out immediately and visibly: XP flies, the
 * streak lights, cards flip. The one place with a real result had no payoff at
 * all, which is why Compete reads as work rather than as a game.
 *
 * ─── The rules it keeps ─────────────────────────────────────────────────────
 *
 * IT FIRES ONCE. Keyed on the event id in localStorage, so a refresh, a
 * navigation back, or two tabs cannot replay somebody's defeat at them. A
 * celebration you cannot escape is a punishment.
 *
 * IT NEVER INVENTS A RESULT. Every figure comes off the settled row. With no
 * number to show, the panel shows the verdict alone rather than a zero — the
 * rule the dashboard's rail already keeps.
 *
 * A LOSS IS SHORT. The win gets the confetti, the count-up and the stagger; a
 * loss gets the verdict, the number, and a button. Drawing a defeat with the
 * same ceremony is the app enjoying it.
 *
 * `prefers-reduced-motion` collapses all of it to a static panel, confetti
 * included — this is the loudest thing on the site.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useSpring } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Trophy, ShieldCheck, Swords, X } from "lucide-react";

const SEEN_KEY = "acedit.settlement.seen";

/** Which reveals this browser has already played. */
function seenSet() {
    try {
        const raw = localStorage.getItem(SEEN_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        // Blocked storage counts as "already seen": replaying a result at
        // somebody on every page load is far worse than never showing it.
        return null;
    }
}

function markSeen(id) {
    try {
        const s = seenSet() || new Set();
        s.add(id);
        // Bounded — this is a log of ceremonies, not a record worth keeping.
        localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-60)));
    } catch { /* nothing to do; the guard already treats this as seen */ }
}

/** Has this reveal already played on this device? */
export function alreadyRevealed(id) {
    const s = seenSet();
    return s === null ? true : s.has(id);
}

/**
 * The first settled event involving this student that has not been shown.
 *
 * Only events they are IN. Watching somebody else's call-out resolve is a feed
 * row; taking over their screen for it is not.
 */
export function pendingReveal(events = []) {
    return events.find((e) =>
        e?.involvesMe
        && ["callout_passed", "callout_failed", "callout_expired", "battle_settled"].includes(e.kind)
        && !alreadyRevealed(e.id)) || null;
}

/** A number that counts up to itself. XP landing is the payoff; a static
 *  figure is a receipt. */
function CountUp({ value, className }) {
    const reduce = useReducedMotion();
    const mv = useMotionValue(reduce ? value : 0);
    const spring = useSpring(mv, { stiffness: 60, damping: 18 });
    const [shown, setShown] = useState(reduce ? value : 0);

    useEffect(() => {
        mv.set(value);
        return spring.on("change", (v) => setShown(Math.round(v)));
    }, [value, mv, spring]);

    return <span className={className}>{shown.toLocaleString()}</span>;
}

export default function SettlementReveal({ event, onClose }) {
    const reduce = useReducedMotion();
    const fired = useRef(false);
    const [show, setShow] = useState(false);

    const win = event?.tone === "win"
        || (event?.kind === "battle_settled" && event?.actor?.isMe);

    useEffect(() => {
        if (!event || fired.current) return;
        fired.current = true;
        setShow(true);
        markSeen(event.id);

        if (win && !reduce) {
            // Two bursts from the lower corners: one from the middle reads as a
            // popup, two reads as a room.
            const shots = [{ x: 0.15 }, { x: 0.85 }];
            shots.forEach((s, i) => setTimeout(() => confetti({
                particleCount: 70, spread: 62, startVelocity: 42,
                origin: { x: s.x, y: 0.75 },
                colors: ["#58CC02", "#FFC800", "#1CB0F6", "#CE82FF"],
                disableForReducedMotion: true,
            }), 180 + i * 130));
        }
    }, [event, win, reduce]);

    const close = () => { setShow(false); onClose?.(); };

    if (!event) return null;

    const Icon = event.kind === "battle_settled" ? Trophy
        : event.kind === "callout_passed" ? ShieldCheck : Swords;

    // Every figure comes off the settled row. With nothing real, the verdict
    // stands alone rather than a zero standing in for it.
    const xp = Number(event.callout?.xp_moved) || 0;
    const pct = typeof event.callout?.score === "number"
        ? Math.round(event.callout.score * 100) : null;

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    style={{ background: "rgba(10, 18, 31, 0.72)" }}
                    onClick={close}
                >
                    <motion.div
                        onClick={(e) => e.stopPropagation()}
                        initial={{ scale: reduce ? 1 : 0.86, y: reduce ? 0 : 24, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.94, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 22 }}
                        className="relative w-full max-w-sm rounded-3xl bg-surface border-2 border-border
                            shadow-soft p-6 text-center"
                    >
                        <button type="button" onClick={close} aria-label="Close"
                            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center
                                text-muted-foreground hover:bg-secondary transition-colors">
                            <X className="w-4 h-4" />
                        </button>

                        {/* The verdict STAMPS in — overshooting and settling,
                            the way a rubber stamp lands. A fade would be the
                            app apologising for the result. */}
                        <motion.span
                            initial={{ scale: reduce ? 1 : 2.4, rotate: reduce ? 0 : -18, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 14, delay: reduce ? 0 : 0.1 }}
                            className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4
                                ${win ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}
                        >
                            <Icon className="w-8 h-8" />
                        </motion.span>

                        <motion.h2
                            initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: reduce ? 0 : 0.24 }}
                            className="font-display font-black text-2xl text-foreground leading-tight">
                            {event.headline}
                        </motion.h2>

                        {(pct != null || xp > 0 || event.detail) && (
                            <motion.div
                                initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: reduce ? 0 : 0.36 }}
                                className="mt-4 flex items-center justify-center gap-6">
                                {pct != null && (
                                    <div>
                                        <p className="stat-label mb-0.5">Scored</p>
                                        <p className={`font-display font-black text-3xl tabular-nums
                                            ${win ? "text-primary" : "text-foreground"}`}>{pct}%</p>
                                    </div>
                                )}
                                {xp > 0 && (
                                    <div>
                                        <p className="stat-label mb-0.5">XP moved</p>
                                        <CountUp value={xp}
                                            className="font-display font-black text-3xl tabular-nums text-xp" />
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {!pct && !xp && event.detail && (
                            <p className="text-sm text-muted-foreground mt-3">{event.detail}</p>
                        )}

                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ delay: reduce ? 0 : 0.5 }}>
                            <Button onClick={close}
                                className="mt-6 w-full rounded-2xl py-6 font-display font-extrabold text-base
                                    bg-foreground text-background hover:bg-foreground/90 btn-3d">
                                {win ? "Nice" : "Onwards"}
                            </Button>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
