/**
 * BackYourself — the quest board, inline on the Compete page.
 *
 * Two rules shape this. First, a quest names an act rather than a number:
 * "try a technique you've never used", not "300 XP in 72 hours". A counter is
 * the thing students already game; a promise is a decision.
 *
 * Second, **one new quest a day.** They stack — a three-day promise is still
 * running tomorrow — but you can only take one on at a time, which keeps the
 * commitment a decision instead of a shopping list you pick five of and then
 * ignore. Once today's is chosen the board says come back tomorrow and gets
 * out of the way.
 *
 * It lives on the page rather than behind a dialog because choosing what to
 * promise is the interesting part, and burying the interesting part in a modal
 * is how it ends up never opened.
 */
import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Target, Loader2, Check, X, Flame, Coins, Clock, Sparkles, Sunrise } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { METRICS, STUDY_BET_MULT, timeLeft } from "./arenaMeta";
import { QUESTS, QUEST_BY_ID, QUEST_CATEGORIES, questMultiplier, WINDOW_LABEL } from "@/lib/quests";

const STAKES = [25, 50, 100, 200];

// Static class strings — built from template literals, Tailwind's JIT never
// sees them and the colour silently vanishes.
const ACCENT = {
    primary:   { chip: "bg-primary/15 text-primary",   ring: "border-primary/50",   bar: "bg-primary",   glow: "bg-primary/5" },
    streak:    { chip: "bg-streak/15 text-streak",     ring: "border-streak/50",    bar: "bg-streak",    glow: "bg-streak/5" },
    "chart-3": { chip: "bg-chart-3/15 text-chart-3",   ring: "border-chart-3/50",   bar: "bg-chart-3",   glow: "bg-chart-3/5" },
    "chart-4": { chip: "bg-chart-4/15 text-chart-4",   ring: "border-chart-4/50",   bar: "bg-chart-4",   glow: "bg-chart-4/5" },
};
const accentOf = (q) => ACCENT[QUEST_CATEGORIES[q?.category]?.accent] || ACCENT.primary;
const DIFFICULTY = { 1: "Easy win", 2: "Real effort", 3: "Properly hard" };

/** Countdown to the next local midnight, so "tomorrow" is a real number. */
function useUntilTomorrow() {
    const [left, setLeft] = useState("");
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            const midnight = new Date(now);
            midnight.setHours(24, 0, 0, 0);
            const ms = midnight - now;
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            setLeft(h >= 1 ? `${h}h ${m}m` : `${m}m`);
        };
        tick();
        const t = setInterval(tick, 30000);
        return () => clearInterval(t);
    }, []);
    return left;
}

/** A promise in flight, or one that's resolved. */
function QuestCard({ bet }) {
    const snap = bet.quest_snapshot?.title ? bet.quest_snapshot : null;
    const quest = bet.quest_id ? QUEST_BY_ID[bet.quest_id] : null;
    const title = snap?.title || quest?.title
        || `${Number(bet.target).toLocaleString()} ${METRICS[bet.metric]?.unit || ""}`.trim();
    const emoji = snap?.emoji || quest?.emoji || "🎯";
    const a = accentOf(quest);

    const target = bet.quest_target || bet.target || 1;
    const progress = bet.status === "active" ? (bet.progress || 0) : (bet.final_value || 0);
    const pct = Math.min(100, Math.round((progress / target) * 100));
    const payout = Math.floor(bet.stake_xp * (Number(bet.multiplier) || STUDY_BET_MULT));
    const t = bet.status === "active" ? timeLeft(bet.ends_at) : null;
    const done = bet.status === "won";

    return (
        <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
            className={`relative overflow-hidden rounded-3xl border-2 p-5 transition-all ${
                done ? "border-primary/50 bg-primary/5"
                : bet.status === "lost" ? "border-border bg-secondary/20 opacity-70"
                : t?.urgent ? "border-streak/50 bg-streak/5" : `${a.ring} ${a.glow}`}`}>
            <span aria-hidden className="absolute -top-6 -right-4 text-7xl opacity-[0.07] select-none pointer-events-none">
                {emoji}
            </span>

            <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-display font-extrabold text-foreground leading-snug">
                        <span className="mr-1.5" aria-hidden>{emoji}</span>{title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                        {bet.progress_label || `${progress} / ${target}`}
                    </p>
                </div>
                {bet.status === "active" ? (
                    <span className={`pill inline-flex items-center gap-1 flex-shrink-0 tabular-nums ${
                        t.urgent ? "bg-streak/15 text-streak" : "bg-secondary text-muted-foreground"}`}>
                        <Clock className="w-3 h-3" /> {t.label}
                    </span>
                ) : done ? (
                    <span className="pill bg-primary text-white inline-flex items-center gap-1 flex-shrink-0">
                        <Check className="w-3 h-3" /> +{payout}
                    </span>
                ) : (
                    <span className="pill bg-streak/15 text-streak inline-flex items-center gap-1 flex-shrink-0">
                        <X className="w-3 h-3" /> −{bet.stake_xp}
                    </span>
                )}
            </div>

            <div className="relative h-2 bg-secondary rounded-full overflow-hidden mt-4">
                <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                        bet.status === "lost" ? "bg-muted-foreground/40" : pct >= 100 ? "bg-primary" : a.bar}`} />
            </div>

            {bet.status === "active" && (
                <p className="relative text-[11px] text-muted-foreground mt-2.5">
                    Do it → <span className="font-bold text-primary">+{payout} XP</span>
                    {" · "}don't → <span className="font-bold text-streak">−{bet.stake_xp} XP</span>
                </p>
            )}
        </motion.div>
    );
}

export default function BackYourself({ bets, balance, onUpdate }) {
    const { toast } = useToast();
    const [quest, setQuest] = useState(null);
    const [windowHours, setWindowHours] = useState(72);
    const [stake, setStake] = useState(50);
    const [filter, setFilter] = useState("all");
    const [sending, setSending] = useState(false);
    const untilTomorrow = useUntilTomorrow();

    const active = bets.filter(b => b.status === "active");
    const settled = bets.filter(b => b.status !== "active");
    const runningIds = new Set(active.map(b => b.quest_id).filter(Boolean));

    // One new quest a day, decided locally so the board matches the server.
    const today = new Date().toDateString();
    const takenToday = bets.find(b => b.created_date && new Date(b.created_date).toDateString() === today);

    const shown = useMemo(
        () => QUESTS.filter(q => (filter === "all" || q.category === filter) && !runningIds.has(q.id)),
        [filter, runningIds]);

    const multiplier = quest ? questMultiplier(quest, windowHours) : 1.5;
    const payout = Math.floor(stake * multiplier);
    const canAfford = (balance ?? 0) >= stake;

    const choose = (q) => {
        if (quest?.id === q.id) { setQuest(null); return; }   // tap again to collapse
        setQuest(q);
        setWindowHours(q.defaultWindow);
    };

    const commit = async () => {
        if (!quest) return;
        setSending(true);
        try {
            const res = await base44.functions.invoke("createStudyQuest", {
                quest_id: quest.id, window_hours: windowHours, stake_xp: stake,
                tz_offset: new Date().getTimezoneOffset(),
            });
            const data = res?.data ?? res;
            if (data?.error) throw new Error(data.error);
            toast({
                variant: "success",
                title: `${quest.emoji} You're on the hook`,
                description: `${quest.title} — ${WINDOW_LABEL[windowHours]}. That's today's one; come back tomorrow for the next.`,
            });
            setQuest(null);
            onUpdate?.();
        } catch (e) {
            toast({ title: "Couldn't start that quest", description: e.message, variant: "destructive" });
        } finally { setSending(false); }
    };

    return (
        <section className="space-y-4">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                    <p className="stat-label text-xp flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" /> Back yourself
                    </p>
                    <h2 className="font-display font-extrabold text-foreground text-xl lg:text-2xl mt-1 leading-tight">
                        {takenToday ? "Today's promise is made." : "One promise a day."}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
                        {takenToday
                            ? "The ones you've taken on keep running. Come back tomorrow to add another."
                            : "Pick one thing you keep meaning to do, put XP on it, and let the app hold you to it — checked against your real study, not your word."}
                    </p>
                </div>
                {active.length > 0 && (
                    <div className="flex gap-5">
                        <div>
                            <p className="font-display font-black text-2xl text-foreground tabular-nums leading-none">{active.length}</p>
                            <p className="stat-label">Live</p>
                        </div>
                        <div>
                            <p className="font-display font-black text-2xl text-xp tabular-nums leading-none">
                                {active.reduce((n, b) => n + b.stake_xp, 0)}
                            </p>
                            <p className="stat-label">At stake</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Live promises ──────────────────────────────────────────── */}
            {active.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-3">
                    <AnimatePresence initial={false}>
                        {active.map(b => <QuestCard key={b.id} bet={b} />)}
                    </AnimatePresence>
                </div>
            )}

            {/* ── Today's pick, or the door closed until tomorrow ─────────── */}
            {takenToday ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl border-2 border-border bg-gradient-to-br from-secondary/60 to-secondary/20 p-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-xp/15 flex items-center justify-center mx-auto mb-3">
                        <Sunrise className="w-6 h-6 text-xp" />
                    </div>
                    <p className="font-display font-extrabold text-foreground text-lg">Come back tomorrow</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                        One new quest a day keeps it a decision instead of a list. Everything you've already
                        taken on is still running above.
                    </p>
                    <p className="pill bg-secondary text-muted-foreground inline-flex items-center gap-1.5 mt-3 tabular-nums">
                        <Clock className="w-3 h-3" /> Next one in {untilTomorrow}
                    </p>
                </motion.div>
            ) : (
                <div className="space-y-3">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-1.5">
                        {[["all", "Everything"], ...Object.entries(QUEST_CATEGORIES).map(([k, v]) => [k, v.label])]
                            .map(([k, label]) => (
                                <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                        filter === k ? "border-xp bg-xp/10 text-xp"
                                            : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                                    {label}
                                </button>
                            ))}
                    </div>

                    {/* The board. Selecting expands the terms in place rather
                        than pushing the student into a second screen. */}
                    <div className="grid sm:grid-cols-2 gap-3">
                        {shown.map(q => {
                            const a = accentOf(q);
                            const picked = quest?.id === q.id;
                            return (
                                <motion.div layout key={q.id}
                                    className={picked ? "sm:col-span-2" : ""}>
                                    <button onClick={() => choose(q)} aria-pressed={picked}
                                        className={`group relative w-full text-left overflow-hidden rounded-3xl border-2 p-5 transition-all ${
                                            picked ? `${a.ring} ${a.glow}` : "border-border bg-surface hover:border-muted-foreground/40 hover:shadow-soft"}`}>
                                        <span aria-hidden className="absolute -top-5 -right-3 text-6xl opacity-[0.06] group-hover:opacity-[0.12] transition-opacity select-none pointer-events-none">
                                            {q.emoji}
                                        </span>
                                        <div className="relative">
                                            <span className="text-2xl leading-none" aria-hidden>{q.emoji}</span>
                                            <p className="font-display font-extrabold text-foreground leading-snug mt-2">{q.title}</p>
                                            <p className="text-xs text-muted-foreground leading-snug mt-1">{q.blurb}</p>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-3">
                                                <span className={`pill ${a.chip}`}>{QUEST_CATEGORIES[q.category].label}</span>
                                                <span className="pill bg-secondary text-muted-foreground">{DIFFICULTY[q.difficulty]}</span>
                                                <span className="pill bg-xp/10 text-xp tabular-nums">
                                                    up to {questMultiplier(q, Math.min(...q.windows))}×
                                                </span>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Terms, inline under the card you chose */}
                                    <AnimatePresence>
                                        {picked && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                                <div className="mt-3 rounded-3xl border-2 border-border bg-surface p-5 space-y-4">
                                                    <p className="text-sm text-muted-foreground italic">{q.why}</p>

                                                    <div className="grid sm:grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="stat-label mb-1.5">By when?</p>
                                                            <div className="flex gap-1.5">
                                                                {q.windows.map(w => (
                                                                    <button key={w} onClick={() => setWindowHours(w)} aria-pressed={windowHours === w}
                                                                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                                                                            windowHours === w ? "border-xp bg-xp/10 text-xp"
                                                                                : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                                                                        {WINDOW_LABEL[w]}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="stat-label mb-1.5">Stake</p>
                                                            <div className="flex gap-1.5">
                                                                {STAKES.map(v => (
                                                                    <button key={v} onClick={() => setStake(v)} aria-pressed={stake === v}
                                                                        disabled={(balance ?? 0) < v}
                                                                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all disabled:opacity-30 ${
                                                                            stake === v ? "border-xp bg-xp/10 text-xp"
                                                                                : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                                                                        {v}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="rounded-2xl bg-gradient-to-br from-xp/10 to-transparent border-2 border-xp/25 p-4 flex items-center justify-between gap-4 flex-wrap">
                                                        <div>
                                                            <p className="stat-label text-xp">If you do it</p>
                                                            <p className="font-display font-black text-3xl text-foreground tabular-nums leading-none mt-0.5">
                                                                +{payout}
                                                            </p>
                                                            <p className="text-[11px] text-muted-foreground mt-1">{multiplier}× your stake</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="stat-label text-streak">If you don't</p>
                                                            <p className="font-display font-black text-3xl text-foreground tabular-nums leading-none mt-0.5">
                                                                −{stake}
                                                            </p>
                                                            <p className="text-[11px] text-muted-foreground mt-1">Held from now</p>
                                                        </div>
                                                    </div>

                                                    <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                                        <Flame className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-xp" />
                                                        Settled against your real study — it pays out the moment you've done it,
                                                        and this is your one for today.
                                                    </p>

                                                    <Button onClick={commit} disabled={sending || !canAfford}
                                                        className="w-full gap-1.5 bg-xp hover:bg-xp/90 text-white btn-3d">
                                                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                                                        {canAfford ? `Stake ${stake} XP on it` : `Not enough XP — you have ${balance ?? 0}`}
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>

                    {shown.length === 0 && (
                        <div className="rounded-3xl border-2 border-dashed border-border p-8 text-center">
                            <Sparkles className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                            <p className="text-sm font-bold text-foreground">Nothing left in this category</p>
                            <p className="text-xs text-muted-foreground mt-0.5">You've got them all running. Try another filter.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── History ────────────────────────────────────────────────── */}
            {settled.length > 0 && (
                <details className="group">
                    <summary className="text-xs font-bold text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                        {settled.filter(b => b.status === "won").length} kept · {settled.filter(b => b.status === "lost").length} missed
                    </summary>
                    <div className="grid sm:grid-cols-2 gap-3 mt-3">
                        {settled.slice(0, 6).map(b => <QuestCard key={b.id} bet={b} />)}
                    </div>
                </details>
            )}
        </section>
    );
}
