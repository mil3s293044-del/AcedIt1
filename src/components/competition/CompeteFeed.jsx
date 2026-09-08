/**
 * CompeteFeed — the front page of Compete.
 *
 * ─── Why this replaced the panel it grew out of ─────────────────────────────
 * `MoversPanel` answered the right question ("did something happen without
 * me?") and answered it in a box below two other boxes about you. Everything
 * above it — the coach line, the book, three tabs — was a readout of your own
 * state, which is a thing you can already remember. The feed is the only
 * surface on the page whose subject is OTHER PEOPLE, so it goes first.
 *
 * ─── An event is a row with a face, a verb and a clock ──────────────────────
 * Not a chart, not a stat tile. `competeFeed` produces the sentence; this file
 * decides how loudly it is said. Three volumes:
 *
 *   LIVE   a call-out with a clock running on somebody's behalf. Ringed, with
 *          the countdown ticking, and it is always at the top. Burying one is
 *          a forfeit the student did not choose.
 *   WIN    a pass, a settled battle, a price moving your way. Coloured, with
 *          the number pulled out large.
 *   REST   everything else, quiet, one line.
 *
 * ─── Reactions ─────────────────────────────────────────────────────────────
 * A feed nobody can answer is a broadcast. One tap is the smallest possible
 * answer and the difference between a timeline and a log file. The set is
 * FIXED — no free text — because these are sixteen-year-olds losing in front
 * of their group sometimes, and a text box on that is a moderation problem the
 * app cannot staff.
 *
 * The count is optimistic and reconciles on the server's answer: a reaction
 * that takes 400ms to appear is one nobody presses twice.
 */
import React, { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
    Swords, ShieldCheck, ShieldAlert, Clock, TrendingUp, TrendingDown,
    Activity, Trophy, ChevronRight, Plus,
} from "lucide-react";
import { reactToEvent } from "@/api/functionsShim";
import { agoLabel, leftLabel } from "@/lib/competeFeed";
import CalloutBacking from "./CalloutBacking";

const REACTIONS = ["👀", "🔥", "😮", "👏", "🧊"];

// One icon per KIND of event, which is the case the icon rule allows: it
// differentiates items in a repeated set rather than restating the words next
// to it.
const ICON = {
    callout_live: ShieldAlert,
    callout_passed: ShieldCheck,
    callout_failed: Swords,
    callout_expired: Clock,
    odds_move: TrendingUp,
    rival_activity: Activity,
    battle_settled: Trophy,
};

const TONE = {
    live: { ink: "text-xp", chip: "bg-xp/15 text-xp", ring: "border-xp/40" },
    win: { ink: "text-primary", chip: "bg-primary/15 text-primary", ring: "border-border" },
    loss: { ink: "text-streak", chip: "bg-streak/15 text-streak", ring: "border-border" },
    neutral: { ink: "text-muted-foreground", chip: "bg-secondary text-muted-foreground", ring: "border-border" },
};

/** A live clock. Re-renders itself once a minute rather than on every tick —
 *  a countdown to tomorrow morning does not need a second hand, and a whole
 *  feed of them ticking is a whole feed re-rendering. */
function Countdown({ until }) {
    const [, bump] = useState(0);
    React.useEffect(() => {
        const t = setInterval(() => bump((n) => n + 1), 60000);
        return () => clearInterval(t);
    }, []);
    const left = leftLabel(until);
    if (!left) return null;
    return <span className="font-display font-black tabular-nums">{left}</span>;
}

function ReactionRow({ event, state, onReact, disabled }) {
    const [open, setOpen] = useState(false);
    const counts = state?.counts || {};
    const mine = state?.mine || null;
    const taken = REACTIONS.filter((e) => counts[e] > 0 || e === mine);

    if (disabled) return null;

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {taken.map((emoji) => {
                const isMine = mine === emoji;
                return (
                    <button key={emoji} type="button" onClick={() => onReact(event, emoji)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold
                            border transition-colors ${isMine
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-border bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}>
                        <span aria-hidden="true">{emoji}</span>
                        <span className="tabular-nums">{counts[emoji] || 0}</span>
                    </button>
                );
            })}

            <div className="relative">
                <button type="button" onClick={() => setOpen((v) => !v)}
                    aria-label="React to this"
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-border
                        bg-secondary/60 text-muted-foreground hover:bg-secondary transition-colors">
                    <Plus className="w-3 h-3" />
                </button>
                <AnimatePresence>
                    {open && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 4 }}
                            transition={{ duration: 0.14 }}
                            className="absolute left-0 bottom-full mb-1 z-20 flex items-center gap-0.5
                                rounded-xl border border-border bg-surface shadow-soft px-1.5 py-1">
                            {REACTIONS.map((emoji) => (
                                <button key={emoji} type="button"
                                    onClick={() => { onReact(event, emoji); setOpen(false); }}
                                    className="w-7 h-7 rounded-lg hover:bg-secondary text-base leading-none
                                        transition-transform hover:scale-125">
                                    {emoji}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function FeedRow({ event, index, reactions, onReact, onOpen, reactionsReady, backing }) {
    const reduce = useReducedMotion();
    // A price sliding drew an UP arrow, in red — the glyph and the colour
    // saying opposite things about the same number, which is the bug
    // `ScalingMark` was built to stop happening on the subjects page. The
    // direction comes off the same tone the colour does, so they cannot
    // disagree.
    const Icon = (event.kind === "odds_move" && event.tone === "loss")
        ? TrendingDown
        : (ICON[event.kind] || Activity);
    const tone = TONE[event.tone] || TONE.neutral;
    const live = event.kind === "callout_live";

    return (
        <motion.li
            layout
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : Math.min(index * 0.04, 0.3), duration: 0.3 }}
            className={`rounded-2xl border-2 p-3.5 sm:p-4 transition-colors
                ${live ? `${tone.ring} bg-xp/5` : "border-border bg-surface"}`}
        >
            <div className="flex items-start gap-3">
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
                    ${tone.chip}`}>
                    {/* A live call-out's glyph breathes, because the thing it
                        marks is a clock running down and nothing else on the
                        page moves on its own. */}
                    <motion.span
                        animate={live && !reduce ? { scale: [1, 1.15, 1] } : {}}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
                        <Icon className="w-4 h-4" />
                    </motion.span>
                </span>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                        <p className={`font-bold text-sm leading-snug ${live ? "text-foreground" : "text-foreground"}`}>
                            {event.headline}
                        </p>
                        {event.stat && (
                            <motion.span
                                initial={{ scale: reduce ? 1 : 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.15 }}
                                className={`font-display font-black text-lg tabular-nums flex-shrink-0 ${tone.ink}`}>
                                {event.stat}
                            </motion.span>
                        )}
                    </div>

                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {live && event.deadline
                            ? <span className={tone.ink}><Countdown until={event.deadline} /></span>
                            : <span>{agoLabel(event.at)}</span>}
                        {event.detail && <><span className="text-muted-foreground/40">·</span>{event.detail}</>}
                    </p>

                    {/* Backing somebody else's call-out. Only ever offered to
                        somebody who is neither in it nor already holding a
                        position — the server refuses the other cases, and an
                        offer the server will refuse is a broken button. */}
                    {backing && <div className="mt-3">{backing}</div>}

                    <div className="flex items-center justify-between gap-3 mt-2.5">
                        {event.reactable
                            ? <ReactionRow event={event} state={reactions?.[event.id]}
                                onReact={onReact} disabled={!reactionsReady} />
                            : <span />}
                        {event.battleRef && onOpen && (
                            <button type="button" onClick={() => onOpen(event)}
                                className="inline-flex items-center gap-0.5 text-xs font-bold text-muted-foreground
                                    hover:text-foreground transition-colors flex-shrink-0">
                                Open <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </motion.li>
    );
}

export default function CompeteFeed({
    events = [], reactions = {}, reactionsReady = false,
    onOpen, onReacted, forecastCtx, onBacked,
}) {
    const [optimistic, setOptimistic] = useState({});

    const merged = useMemo(() => {
        const out = { ...reactions };
        Object.entries(optimistic).forEach(([k, v]) => { out[k] = v; });
        return out;
    }, [reactions, optimistic]);

    const react = useCallback(async (event, emoji) => {
        const cur = merged[event.id] || { counts: {}, mine: null };
        const counts = { ...cur.counts };
        // Take the old one back first, then add the new — a student switching
        // from 👀 to 🔥 must not be counted in both.
        if (cur.mine) counts[cur.mine] = Math.max(0, (counts[cur.mine] || 1) - 1);
        const mine = cur.mine === emoji ? null : emoji;
        if (mine) counts[mine] = (counts[mine] || 0) + 1;
        setOptimistic((o) => ({ ...o, [event.id]: { counts, mine } }));

        try {
            await reactToEvent({
                event_key: event.id, emoji: mine,
                duel_id: event.battleRef?.kind === "duel" ? event.battleRef.id : undefined,
                competition_id: event.battleRef?.kind === "competition" ? event.battleRef.id : undefined,
            });
            onReacted?.();
        } catch {
            // Roll the optimistic count back rather than leaving the screen
            // claiming something the server never accepted.
            setOptimistic((o) => { const n = { ...o }; delete n[event.id]; return n; });
        }
    }, [merged, onReacted]);

    if (!events.length) return null;

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-surface border border-border shadow-soft p-4 sm:p-6">
            <div className="flex items-baseline justify-between gap-3 mb-4">
                <h2 className="font-display font-extrabold text-foreground text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-chart-3" /> What's happening
                </h2>
                <span className="stat-label text-muted-foreground">live</span>
            </div>

            <ul className="space-y-2.5">
                <AnimatePresence initial={false}>
                    {events.map((e, i) => (
                        <FeedRow
                            key={e.id} event={e} index={i}
                            reactions={merged} onReact={react} onOpen={onOpen}
                            reactionsReady={reactionsReady}
                            backing={e.kind === "callout_live" && !e.involvesMe && forecastCtx
                                ? <CalloutBacking callout={e.callout} ctx={forecastCtx} onPlaced={onBacked} />
                                : null}
                        />
                    ))}
                </AnimatePresence>
            </ul>
        </motion.section>
    );
}
