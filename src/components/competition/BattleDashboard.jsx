/**
 * BattleDashboard — one battle, read like a live market.
 *
 * The old detail view was a leaderboard and a progress bar: it told you the
 * standing and nothing about the race. This is built the way a prediction
 * market is read, because that's the shape of the question a student actually
 * has — not "who is ahead" but "am I going to win this, and is it moving my
 * way?"
 *
 * Top line is the price (your win probability). Under it the market chart:
 * probability replayed over the life of the battle, so a swing is a shape you
 * can point at. Then the book — every player, their score, their share — and
 * the components behind the score.
 *
 * Works for duels and group battles alike; both arrive as the normalised shape
 * from normaliseBattle.js.
 */
import React from "react";
import { motion } from "framer-motion";
import {
    ArrowLeft, Clock, Coins, Crown, TrendingUp, TrendingDown, Minus, Users, Info, Trophy,
    Swords, Gauge, Flag, Zap, Activity,
} from "lucide-react";
import { Countdown } from "./arenaHelpers";

const pct = (n) => `${Math.round(n)}%`;

function timeLeftLabel(endsAt) {
    if (!endsAt) return null;
    const ms = new Date(endsAt).getTime() - Date.now();
    if (ms <= 0) return "Time's up";
    const h = Math.floor(ms / 3600000);
    if (h < 1) return `${Math.max(1, Math.round(ms / 60000))}m left`;
    if (h < 48) return `${h}h left`;
    return `${Math.floor(h / 24)}d left`;
}

/** The market chart: win probability over the life of the battle. */
function MarketChart({ series }) {
    if (!series || series.length < 2) {
        return (
            <div className="h-40 rounded-2xl bg-secondary/40 border border-border flex items-center justify-center px-6">
                <p className="text-sm text-muted-foreground flex items-start gap-2 text-center">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    The line starts drawing once there are a couple of hours of scores behind it.
                </p>
            </div>
        );
    }
    const pts = series.map((d, i) => {
        const x = (i / (series.length - 1)) * 100;
        const y = 100 - d.p;           // 0% at the bottom, 100% at the top
        return `${x},${y}`;
    });
    const last = series[series.length - 1];
    const above = last.p >= 50;
    const line = above ? "text-primary" : "text-streak";
    const fillId = `mkt-${above ? "up" : "down"}`;

    return (
        <div className="relative">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-40" role="img"
                aria-label="Win probability over the life of this battle">
                <defs>
                    <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" className={line} />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0" className={line} />
                    </linearGradient>
                </defs>
                {/* 50% reference — the line between winning and losing. */}
                <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="1"
                    vectorEffect="non-scaling-stroke" strokeDasharray="4 4" className="text-border" />
                <polygon points={`0,100 ${pts.join(" ")} 100,100`} fill={`url(#${fillId})`} className={line} />
                <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className={line} />
            </svg>
            <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground/70">
                <span>start</span>
                <span className="text-border">— 50% —</span>
                <span>now</span>
            </div>
        </div>
    );
}

/** Momentum: gap against the leader over time. Positive is ahead. */
function SwingChart({ swing }) {
    if (!swing || swing.length < 2) return null;
    const lo = Math.min(...swing, 0), hi = Math.max(...swing, 0);
    const span = Math.max(1, hi - lo);
    const pts = swing.map((v, i) => {
        const x = (i / (swing.length - 1)) * 100;
        return `${x},${Math.max(2, Math.min(38, 40 - ((v - lo) / span) * 40))}`;
    }).join(" ");
    const zeroY = Math.max(2, Math.min(38, 40 - ((0 - lo) / span) * 40));
    const ahead = swing[swing.length - 1] >= 0;
    return (
        <div>
            <p className="stat-label mb-2">Momentum · points gap</p>
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-14" role="img"
                aria-label="Your points gap against the leader over time">
                <line x1="0" y1={zeroY} x2="100" y2={zeroY} stroke="currentColor" strokeWidth="1"
                    vectorEffect="non-scaling-stroke" strokeDasharray="3 3" className="text-border" />
                <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"
                    className={ahead ? "text-primary" : "text-streak"} />
            </svg>
        </div>
    );
}

export default function BattleDashboard({ battle, onBack, footer, activity = [] }) {
    if (!battle) return null;
    const { odds, market, swing, momentum, narrative, sides, potXP, endsAt, status, unit, kind, projection } = battle;
    // Duels and group battles are different games; they read as different
    // colours everywhere so you always know which one you're looking at.
    const accent = kind === "duel"
        ? { chip: "bg-chart-4/15 text-chart-4", text: "text-chart-4", ring: "border-chart-4/25", label: "Duel" }
        : { chip: "bg-chart-3/15 text-chart-3", text: "text-chart-3", ring: "border-chart-3/25", label: "Group battle" };
    const ranked = [...sides].sort((a, b) => b.score - a.score);
    const total = Math.max(1, ranked.reduce((s, p) => s + Math.max(0, p.score), 0));
    const settled = status === "settled";

    const oddsTone = odds == null ? "text-muted-foreground"
        : odds >= 60 ? "text-primary" : odds >= 40 ? "text-xp" : "text-streak";
    const oddsMove = market.length > 1 ? market[market.length - 1].p - market[0].p : null;

    return (
        <div className="space-y-5">
            <button onClick={onBack}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> All battles
            </button>

            {/* ── The price ─────────────────────────────────────────────── */}
            <div className="card-soft p-6 lg:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <span className={`pill ${accent.chip} mb-2`}>
                            {kind === "duel" ? <Swords className="w-3 h-3" /> : <Trophy className="w-3 h-3" />} {accent.label}
                        </span>
                        <h1 className="font-display font-extrabold text-foreground text-xl lg:text-2xl leading-tight">
                            {battle.title}
                        </h1>
                        <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            {battle.subtitle && <span>{battle.subtitle}</span>}
                            <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {sides.length}</span>
                            {potXP > 0 && (
                                <span className="inline-flex items-center gap-1 font-bold text-xp">
                                    <Coins className="w-3 h-3" /> {potXP.toLocaleString()} XP pot
                                </span>
                            )}
                            {endsAt && !settled && (
                                <span className="inline-flex items-center gap-1 font-bold text-foreground">
                                    <Clock className="w-3 h-3" /> {timeLeftLabel(endsAt)}
                                </span>
                            )}
                        </p>
                    </div>

                    {!settled && odds != null && (
                        <div className="text-right flex-shrink-0">
                            <p className="stat-label mb-1">Your chance</p>
                            <p className={`font-display font-black leading-none tabular-nums ${oddsTone}`}
                                style={{ fontSize: "clamp(2.5rem, 8vw, 3.5rem)" }}>
                                {pct(odds)}
                            </p>
                            {oddsMove != null && Math.abs(oddsMove) >= 1 && (
                                <p className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${
                                    oddsMove > 0 ? "text-primary" : "text-streak"}`}>
                                    {oddsMove > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {oddsMove > 0 ? "+" : ""}{oddsMove} since it opened
                                </p>
                            )}
                        </div>
                    )}
                    {settled && (
                        <div className="pill bg-chart-4/15 text-chart-4 flex-shrink-0">
                            <Trophy className="w-3 h-3" /> Settled
                        </div>
                    )}
                </div>

                {narrative && (
                    <div className={`mt-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold ${
                        narrative.tone === "good" ? "bg-primary/10 text-primary"
                            : narrative.tone === "bad" ? "bg-streak/10 text-streak"
                            : "bg-xp/10 text-xp"}`}>
                        {narrative.tone === "good"
                            ? <Crown className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            : <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                        <span>{narrative.text}</span>
                    </div>
                )}
            </div>

            {/* ── The market ────────────────────────────────────────────── */}
            {!settled && (
                <div className="card-soft p-6">
                    <div className="flex items-baseline justify-between mb-3">
                        <p className="stat-label">Win probability</p>
                        <p className="text-[11px] text-muted-foreground/70">over the life of this battle</p>
                    </div>
                    <MarketChart series={market} />
                </div>
            )}

            {/* ── Momentum + today ──────────────────────────────────────── */}
            {(swing.length > 1 || momentum != null) && (
                <div className="card-soft p-6 space-y-4">
                    <SwingChart swing={swing} />
                    {momentum != null && (
                        <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
                            <span className="text-sm font-bold text-foreground">Points you've put on today</span>
                            <span className={`font-display font-black text-xl tabular-nums inline-flex items-center gap-1 ${
                                momentum > 0 ? "text-primary" : "text-muted-foreground"}`}>
                                {momentum > 0 ? <TrendingUp className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                                {momentum > 0 ? `+${momentum}` : momentum}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* ── Key numbers ───────────────────────────────────────────── */}
            {projection && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: "Your pace", value: `${projection.myPace}`, suffix: `${unit}/h`,
                          icon: Gauge, tone: projection.myPace >= projection.theirPace ? "text-primary" : "text-foreground" },
                        { label: `${projection.rivalName}'s pace`, value: `${projection.theirPace}`, suffix: `${unit}/h`,
                          icon: Gauge, tone: "text-muted-foreground" },
                        { label: "Projected finish", value: projection.myFinal != null ? `${projection.myFinal}` : "—",
                          suffix: projection.theirFinal != null ? `vs ${projection.theirFinal}` : "",
                          icon: Flag, tone: (projection.myFinal ?? 0) >= (projection.theirFinal ?? 0) ? "text-primary" : "text-streak" },
                        { label: projection.needed > 0 ? "Need to close" : "Current lead",
                          value: projection.needed > 0 ? `${projection.needed}` : `${Math.abs(projection.lead)}`,
                          suffix: unit, icon: projection.needed > 0 ? Zap : Crown,
                          tone: projection.needed > 0 ? "text-streak" : "text-xp" },
                    ].map(({ label, value, suffix, icon: Icon, tone }) => (
                        <div key={label} className="card-soft p-4">
                            <div className={`w-8 h-8 rounded-lg ${accent.chip} flex items-center justify-center mb-2`}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <p className={`font-display font-black text-xl leading-none tabular-nums ${tone}`}>{value}</p>
                            {suffix && <p className="text-[11px] text-muted-foreground mt-0.5">{suffix}</p>}
                            <p className="stat-label mt-1.5">{label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Activity ──────────────────────────────────────────────── */}
            {/* The momentum feed used to sit loose on the Compete page showing
                every event across every battle, which is noise there and the
                whole story here. Scoped to the people in this battle. */}
            {activity.length > 0 && (
                <div className="card-soft p-6">
                    <p className="stat-label mb-3 flex items-center gap-1.5">
                        <Activity className={`w-3.5 h-3.5 ${accent.text}`} /> Live activity
                    </p>
                    <div className="space-y-2">
                        {activity.slice(0, 6).map((e, i) => (
                            <motion.div key={`${e.email}-${e.at}-${i}`}
                                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="flex items-center gap-2 text-xs">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    e.isMe ? "bg-primary" : "bg-chart-3"}`} />
                                <span className="font-bold text-foreground">{e.isMe ? "You" : (e.name || "").split(" ")[0]}</span>
                                <span className="font-bold text-xp">+{e.xp}</span>
                                <span className="text-muted-foreground">from {e.label}</span>
                                <span className="text-muted-foreground/60 ml-auto flex-shrink-0">{e.ago}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── The book ──────────────────────────────────────────────── */}
            <div className="card-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex items-baseline justify-between">
                    <p className="stat-label">Standings</p>
                    <p className="text-[11px] text-muted-foreground/70">share of all points scored</p>
                </div>
                <div className="divide-y divide-border">
                    {ranked.map((p, i) => {
                        const share = Math.round((Math.max(0, p.score) / total) * 100);
                        const won = settled && battle.winnerEmail === p.email;
                        return (
                            <div key={p.email} className={`px-6 py-3.5 ${p.isMe ? "bg-primary/[0.06]" : ""}`}>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${
                                        i === 0 ? "bg-xp text-background" : "bg-secondary text-muted-foreground"}`}>
                                        {i + 1}
                                    </span>
                                    <span className="flex-1 min-w-0 truncate font-bold text-foreground text-sm">
                                        {(p.name || "").split(" ")[0]}
                                        {p.isMe && <span className="text-muted-foreground font-semibold"> (you)</span>}
                                        {won && <Trophy className="w-3.5 h-3.5 inline ml-1.5 text-xp" />}
                                    </span>
                                    <span className="font-display font-black text-base tabular-nums text-foreground">
                                        {p.score.toLocaleString()}
                                        <span className="text-xs font-bold text-muted-foreground ml-1">{unit}</span>
                                    </span>
                                </div>
                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${share}%` }}
                                        transition={{ duration: 0.8, delay: 0.1 + i * 0.05 }}
                                        className={`h-full rounded-full ${i === 0 ? "bg-xp" : p.isMe ? "bg-primary" : "bg-chart-3"}`} />
                                </div>
                                {/* What's behind the score, where the battle records it. */}
                                {p.participant?.score_breakdown && (
                                    <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                                        {Object.entries(p.participant.score_breakdown)
                                            .filter(([, v]) => typeof v === "number")
                                            .map(([k, v]) => `${k} ${Math.round(v)}`)
                                            .join(" · ")}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {endsAt && !settled && (
                <div className="flex justify-center">
                    <Countdown targetDate={endsAt} variant="chip" />
                </div>
            )}

            {footer}
        </div>
    );
}
