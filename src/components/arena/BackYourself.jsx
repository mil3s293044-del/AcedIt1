/**
 * BackYourself — quests you wager on, and hold yourself to.
 *
 * This used to ask for a metric and a number: "300 XP in 72 hours". That's a
 * bet on a counter, and a counter is what students already game — it pays for
 * grinding whatever is cheapest, which is the opposite of what the rest of the
 * app is trying to encourage.
 *
 * A quest names an act. "Try a technique you've never used." "Plan your
 * weekend before it starts." "Don't miss a day." You pick one, pick a
 * deadline, stake XP on yourself, and the server checks it against records you
 * were generating anyway — see src/lib/quests.js for the catalogue and
 * verifyQuest in server.mjs for the checks.
 *
 * The three numeric quests survive for the days when volume genuinely is the
 * gap, and every bet placed under the old system keeps rendering here.
 */
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target, Loader2, Plus, Check, X, Flame, ArrowLeft, Coins, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { METRICS, STUDY_BET_MULT, timeLeft } from "./arenaMeta";
import { QUESTS, QUEST_BY_ID, QUEST_CATEGORIES, questMultiplier, WINDOW_LABEL } from "@/lib/quests";

const STAKES = [25, 50, 100, 200];

// Static class strings — never built from template literals, or Tailwind's JIT
// never sees them and the colour silently disappears.
const ACCENT = {
    primary: { chip: "bg-primary/15 text-primary", ring: "border-primary/40", text: "text-primary", bar: "bg-primary" },
    streak:  { chip: "bg-streak/15 text-streak",   ring: "border-streak/40",  text: "text-streak",  bar: "bg-streak" },
    "chart-3": { chip: "bg-chart-3/15 text-chart-3", ring: "border-chart-3/40", text: "text-chart-3", bar: "bg-chart-3" },
    "chart-4": { chip: "bg-chart-4/15 text-chart-4", ring: "border-chart-4/40", text: "text-chart-4", bar: "bg-chart-4" },
};
const accentOf = (quest) => ACCENT[QUEST_CATEGORIES[quest?.category]?.accent] || ACCENT.primary;

const DIFFICULTY = { 1: "Easy win", 2: "Real effort", 3: "Properly hard" };

/** A wager in flight, or one that's already resolved. */
function QuestCard({ bet }) {
    // Prefer the snapshot — it's the promise as the student saw it, which is
    // what they should be judged against if the catalogue changed since.
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
    const label = bet.progress_label || `${progress} / ${target}`;

    return (
        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`card-soft p-4 border-2 ${
                bet.status === "won" ? "border-primary/40"
                : bet.status === "lost" ? "border-border opacity-70"
                : t?.urgent ? "border-streak/40" : a.ring}`}>
            <div className="flex items-start gap-2.5">
                <span className="text-xl leading-none mt-0.5" aria-hidden>{emoji}</span>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground leading-snug">{title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{label}</p>
                </div>
                {bet.status === "active" ? (
                    <span className={`pill inline-flex items-center gap-1 flex-shrink-0 tabular-nums ${
                        t.urgent ? "bg-streak/15 text-streak" : "bg-secondary text-muted-foreground"}`}>
                        <Clock className="w-3 h-3" /> {t.label}
                    </span>
                ) : bet.status === "won" ? (
                    <span className="pill bg-primary/15 text-primary inline-flex items-center gap-1 flex-shrink-0">
                        <Check className="w-3 h-3" /> +{payout}
                    </span>
                ) : (
                    <span className="pill bg-streak/10 text-streak inline-flex items-center gap-1 flex-shrink-0">
                        <X className="w-3 h-3" /> −{bet.stake_xp}
                    </span>
                )}
            </div>

            <div className="h-2 bg-secondary rounded-full overflow-hidden mt-3">
                <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                        bet.status === "lost" ? "bg-muted-foreground/40" : pct >= 100 ? "bg-primary" : a.bar}`} />
            </div>

            {bet.status === "active" && (
                <p className="text-[11px] text-muted-foreground mt-2">
                    Do it → <span className="font-bold text-primary">+{payout} XP</span>
                    {" · "}don't → <span className="font-bold text-streak">−{bet.stake_xp} XP</span>
                </p>
            )}
        </motion.div>
    );
}

/** One row in the picker. */
function QuestOption({ quest, selected, onSelect }) {
    const a = accentOf(quest);
    return (
        <button onClick={() => onSelect(quest)} aria-pressed={selected}
            className={`w-full text-left rounded-2xl border-2 p-3.5 transition-all ${
                selected ? `${a.ring} bg-secondary/50` : "border-border hover:border-muted-foreground/40"}`}>
            <div className="flex items-start gap-3">
                <span className="text-2xl leading-none" aria-hidden>{quest.emoji}</span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground leading-snug">{quest.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{quest.blurb}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className={`pill ${a.chip}`}>{QUEST_CATEGORIES[quest.category].label}</span>
                        <span className="pill bg-secondary text-muted-foreground">{DIFFICULTY[quest.difficulty]}</span>
                    </div>
                </div>
            </div>
        </button>
    );
}

export default function BackYourself({ bets, balance, onUpdate }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState("pick");     // pick → terms
    const [quest, setQuest] = useState(null);
    const [windowHours, setWindowHours] = useState(72);
    const [stake, setStake] = useState(50);
    const [filter, setFilter] = useState("all");
    const [sending, setSending] = useState(false);

    const active = bets.filter(b => b.status === "active");
    const settled = bets.filter(b => b.status !== "active");
    const runningIds = new Set(active.map(b => b.quest_id).filter(Boolean));

    const shown = useMemo(
        () => QUESTS.filter(q => filter === "all" || q.category === filter),
        [filter]);

    const multiplier = quest ? questMultiplier(quest, windowHours) : 1.5;
    const payout = Math.floor(stake * multiplier);
    const canAfford = (balance ?? 0) >= stake;

    const reset = () => { setStep("pick"); setQuest(null); setWindowHours(72); setStake(50); };

    const choose = (q) => {
        setQuest(q);
        setWindowHours(q.defaultWindow);
        setStep("terms");
    };

    const commit = async () => {
        if (!quest) return;
        setSending(true);
        try {
            const res = await base44.functions.invoke("createStudyQuest", {
                quest_id: quest.id, window_hours: windowHours, stake_xp: stake,
            });
            const data = res?.data ?? res;
            if (data?.error) throw new Error(data.error);
            toast({
                variant: "success",
                title: `${quest.emoji} You're on the hook`,
                description: `${quest.title} — ${WINDOW_LABEL[windowHours]}. ${stake} XP staked, ${data.payout ?? payout} back if you do it.`,
            });
            setOpen(false);
            reset();
            onUpdate?.();
        } catch (e) {
            toast({ title: "Couldn't start that quest", description: e.message, variant: "destructive" });
        } finally { setSending(false); }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="font-display font-extrabold text-foreground flex items-center gap-2">
                        <Target className="w-5 h-5 text-xp" /> Back yourself
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Promise one specific thing, put XP on it, and let the app hold you to it.
                    </p>
                </div>
                {active.length < 3 && (
                    <Button onClick={() => { reset(); setOpen(true); }} size="sm"
                        className="rounded-xl bg-xp hover:bg-xp/90 text-white font-bold gap-1.5 text-xs flex-shrink-0">
                        <Plus className="w-3.5 h-3.5" /> New quest
                    </Button>
                )}
            </div>

            {bets.length === 0 ? (
                <button onClick={() => { reset(); setOpen(true); }}
                    className="w-full card-soft border-2 border-dashed border-xp/30 p-5 text-left hover:border-xp/60 transition-all">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl" aria-hidden>🧪</span>
                        <div>
                            <p className="font-bold text-foreground text-sm">Pick something you keep meaning to do</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Try a technique you've never used. Plan your weekend. Don't miss a day.
                                Stake XP on it and it settles itself — no honour system, it's checked against your real study.
                            </p>
                        </div>
                    </div>
                </button>
            ) : (
                <>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <AnimatePresence initial={false}>
                            {active.map(b => <QuestCard key={b.id} bet={b} />)}
                        </AnimatePresence>
                    </div>
                    {settled.length > 0 && (
                        <details className="group">
                            <summary className="text-xs font-bold text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                                {settled.length} finished
                            </summary>
                            <div className="grid sm:grid-cols-2 gap-3 mt-3">
                                {settled.slice(0, 6).map(b => <QuestCard key={b.id} bet={b} />)}
                            </div>
                        </details>
                    )}
                </>
            )}

            {/* ── Picker ─────────────────────────────────────────────────── */}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
                <DialogContent className="max-w-lg rounded-3xl max-h-[88vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-display flex items-center gap-2">
                            {step === "terms" && (
                                <button onClick={() => setStep("pick")} aria-label="Back to the list"
                                    className="text-muted-foreground hover:text-foreground transition-colors">
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                            )}
                            {step === "pick" ? "What are you promising?" : quest?.title}
                        </DialogTitle>
                    </DialogHeader>

                    {step === "pick" && (
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-1.5">
                                {[["all", "Everything"], ...Object.entries(QUEST_CATEGORIES).map(([k, v]) => [k, v.label])]
                                    .map(([k, label]) => (
                                        <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                                                filter === k ? "border-xp bg-xp/10 text-xp"
                                                    : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                                            {label}
                                        </button>
                                    ))}
                            </div>
                            <div className="space-y-2">
                                {shown.map(q => (
                                    <div key={q.id} className={runningIds.has(q.id) ? "opacity-40 pointer-events-none" : ""}>
                                        <QuestOption quest={q} selected={quest?.id === q.id} onSelect={choose} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === "terms" && quest && (
                        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                            <div className="rounded-2xl bg-secondary/50 p-3.5">
                                <p className="text-sm text-foreground leading-snug">{quest.blurb}</p>
                                <p className="text-xs text-muted-foreground italic mt-2">{quest.why}</p>
                            </div>

                            <div>
                                <p className="stat-label mb-1.5">By when?</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {quest.windows.map(w => (
                                        <button key={w} onClick={() => setWindowHours(w)} aria-pressed={windowHours === w}
                                            className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                                                windowHours === w ? "border-xp bg-xp/10 text-xp"
                                                    : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                                            {WINDOW_LABEL[w]}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1.5">
                                    A tighter deadline on the same quest pays more — it's a harder promise to keep.
                                </p>
                            </div>

                            <div>
                                <p className="stat-label mb-1.5">How much are you putting on it?</p>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {STAKES.map(v => (
                                        <button key={v} onClick={() => setStake(v)} aria-pressed={stake === v}
                                            disabled={(balance ?? 0) < v}
                                            className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all disabled:opacity-30 ${
                                                stake === v ? "border-xp bg-xp/10 text-xp"
                                                    : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border-2 border-xp/25 bg-xp/5 p-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="stat-label text-xp">If you do it</p>
                                    <p className="font-display font-black text-2xl text-foreground tabular-nums">
                                        +{payout} XP
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">{multiplier}× your stake</p>
                                </div>
                                <div className="text-right">
                                    <p className="stat-label text-streak">If you don't</p>
                                    <p className="font-display font-black text-2xl text-foreground tabular-nums">
                                        −{stake} XP
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">Staked now, held until it settles</p>
                                </div>
                            </div>

                            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                <Flame className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-xp" />
                                Checked against your real study — nothing to mark yourself on, and it pays out the
                                moment you've done it rather than waiting for the deadline.
                            </p>

                            <Button onClick={commit} disabled={sending || !canAfford}
                                className="w-full gap-1.5 bg-xp hover:bg-xp/90 text-white btn-3d">
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                                {canAfford ? `Stake ${stake} XP on it` : `Not enough XP — you have ${balance ?? 0}`}
                            </Button>
                        </motion.div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
