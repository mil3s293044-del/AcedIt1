/**
 * BackYourself — commitment bets on your own study output, auto-verified from
 * the XP audit log and settled the moment the target is hit. Card list +
 * creation dialog.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target, Zap, Loader2, Plus, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { METRICS, WINDOWS, STUDY_BET_MULT, timeLeft, studyBetMultiplier, multiplierLabel } from "./arenaMeta";

const TARGET_PRESETS = {
    xp:            [150, 300, 500, 1000],
    quiz_marks:    [10, 25, 50, 100],
    flashcards:    [25, 50, 100, 200],
    study_minutes: [60, 120, 300, 600],
};

function BetCard({ bet }) {
    const metric = METRICS[bet.metric] || METRICS.xp;
    const progress = bet.status === "active" ? (bet.progress || 0) : (bet.final_value || 0);
    const pct = Math.min(100, Math.round((progress / bet.target) * 100));
    const payout = Math.floor(bet.stake_xp * (Number(bet.multiplier) || STUDY_BET_MULT));
    const t = bet.status === "active" ? timeLeft(bet.ends_at) : null;
    const Icon = metric.icon;

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`card-soft p-4 border-2 ${
                bet.status === "won" ? "border-primary/40" :
                bet.status === "lost" ? "border-border opacity-75" :
                t?.urgent ? "border-streak/40" : "border-xp/25"
            }`}>
            <div className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Icon className="w-3.5 h-3.5 text-xp" />
                    {progress.toLocaleString()} / {bet.target.toLocaleString()} {metric.unit}
                </span>
                {bet.status === "active" ? (
                    <span className={`text-xs font-bold ${t.urgent ? "text-streak" : "text-muted-foreground"}`}>{t.label}</span>
                ) : bet.status === "won" ? (
                    <span className="pill bg-primary/15 text-primary flex items-center gap-1"><Check className="w-3 h-3" /> +{payout} XP</span>
                ) : (
                    <span className="pill bg-streak/10 text-streak flex items-center gap-1"><X className="w-3 h-3" /> -{bet.stake_xp} XP</span>
                )}
            </div>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: "easeOut" }}
                    className={`h-full rounded-full ${bet.status === "lost" ? "bg-muted-foreground/40" : pct >= 100 ? "bg-primary" : "bg-xp"}`} />
            </div>
            {bet.status === "active" && (
                <p className="text-xs text-muted-foreground mt-2">
                    Hit it → <span className="font-bold text-primary">+{payout} XP</span> · fall short → <span className="font-bold text-streak">-{bet.stake_xp} XP</span>
                </p>
            )}
        </motion.div>
    );
}

export default function BackYourself({ bets, balance, currentUserEmail, onUpdate }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [metric, setMetric] = useState("xp");
    const [target, setTarget] = useState(TARGET_PRESETS.xp[1]);
    const [windowHours, setWindowHours] = useState(72);
    const [stake, setStake] = useState(50);
    const [sending, setSending] = useState(false);

    const activeCount = bets.filter(b => b.status === "active").length;
    // Ladder preview — the server has the final say (it also caps at 1.1×
    // when the target is below the student's recent pace).
    const previewMult = studyBetMultiplier(metric, target, windowHours);
    const payout = Math.floor(stake * previewMult);

    const create = async () => {
        setSending(true);
        try {
            const res = await base44.functions.invoke('createStudyBet', {
                metric, target, window_hours: windowHours, stake_xp: stake,
            });
            const lockedMult = Number((res?.data ?? res)?.bet?.multiplier) || previewMult;
            toast({
                title: `🎯 Locked in at ${lockedMult}×`,
                description: lockedMult < previewMult
                    ? "Capped — that target is under your usual pace. Aim higher for a bigger payout."
                    : `${target} ${METRICS[metric].unit} or bust. It settles itself the second you hit it.`,
            });
            setOpen(false);
            onUpdate?.();
        } catch (e) {
            toast({ title: "Bet not placed", description: e.message, variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-display font-extrabold text-foreground flex items-center gap-2">
                    <Target className="w-5 h-5 text-xp" /> Back yourself
                </h3>
                {activeCount < 3 && (
                    <Button onClick={() => setOpen(true)} size="sm"
                        className="rounded-xl bg-xp hover:bg-xp/90 text-white font-bold gap-1.5 text-xs">
                        <Plus className="w-3.5 h-3.5" /> New bet
                    </Button>
                )}
            </div>

            {bets.length === 0 ? (
                <button onClick={() => setOpen(true)}
                    className="w-full card-soft border-2 border-dashed border-xp/30 p-5 text-center hover:border-xp/60 transition-all">
                    <p className="font-bold text-foreground text-sm">Stake XP on your own study goal</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Auto-tracked from your real study — the bolder the target, the bigger the payout (up to 1.8×), settled the second you hit it.
                    </p>
                </button>
            ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                    {bets.slice(0, 6).map(b => <BetCard key={b.id} bet={b} />)}
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 font-display">
                            <Target className="w-5 h-5 text-xp" /> Back yourself
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <p className="stat-label mb-2">I will hit…</p>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(METRICS).map(([key, m]) => {
                                    const Icon = m.icon;
                                    return (
                                        <button key={key}
                                            onClick={() => { setMetric(key); setTarget(TARGET_PRESETS[key][1]); }}
                                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all text-left ${
                                                metric === key ? "bg-foreground border-foreground text-background" : "bg-surface border-border text-foreground hover:border-muted-foreground"
                                            }`}>
                                            <Icon className="w-4 h-4 flex-shrink-0" /> {m.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <p className="stat-label mb-2">Target ({METRICS[metric].unit})</p>
                            <div className="flex gap-2 flex-wrap">
                                {TARGET_PRESETS[metric].map(v => (
                                    <button key={v} onClick={() => setTarget(v)}
                                        className={`flex flex-col items-center px-3.5 py-1.5 rounded-xl border-2 transition-all ${
                                            target === v ? "bg-xp border-xp text-white shadow-soft" : "bg-surface border-border text-foreground hover:border-xp/40"
                                        }`}>
                                        <span className="text-sm font-bold">{v}</span>
                                        <span className={`text-[10px] font-black ${target === v ? "text-white/80" : "text-xp"}`}>
                                            {studyBetMultiplier(metric, v, windowHours)}×
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">Bigger target, bigger multiplier. Coasting under your usual pace locks it at 1.1×.</p>
                        </div>
                        <div>
                            <p className="stat-label mb-2">By when</p>
                            <div className="grid grid-cols-3 gap-2">
                                {WINDOWS.map(w => (
                                    <button key={w.hours} onClick={() => setWindowHours(w.hours)}
                                        className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                            windowHours === w.hours ? "bg-foreground border-foreground text-background" : "bg-surface border-border text-foreground hover:border-muted-foreground"
                                        }`}>{w.label}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="stat-label">Stake</p>
                                {balance != null && (
                                    <p className="text-xs font-bold text-xp flex items-center gap-1">
                                        <Zap className="w-3 h-3" /> {balance.toLocaleString()} XP available
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {[25, 50, 100, 200].map(amt => {
                                    const unaffordable = balance != null && amt > balance;
                                    return (
                                        <button key={amt} onClick={() => setStake(amt)} disabled={unaffordable}
                                            className={`px-3.5 py-2 rounded-xl text-sm font-bold border-2 transition-all disabled:opacity-40 ${
                                                stake === amt ? "bg-chart-3 border-chart-3 text-white shadow-soft" : "bg-surface border-border text-foreground hover:border-chart-3/40"
                                            }`}>{amt} XP</button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="bg-xp/5 border-2 border-xp/25 rounded-2xl p-3.5">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-black text-foreground">
                                    🎯 {target} {METRICS[metric].unit} in {WINDOWS.find(w => w.hours === windowHours)?.label}
                                </p>
                                <span className="pill bg-xp/15 text-xp">{previewMult}× · {multiplierLabel(previewMult)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-semibold mt-1">
                                <span className="text-primary">Hit it: +{payout} XP</span>
                                <span className="text-streak">Miss: -{stake} XP</span>
                            </div>
                        </div>
                        <Button onClick={create} disabled={sending || (balance != null && stake > balance)}
                            className="w-full bg-xp hover:bg-xp/90 text-white font-bold rounded-xl py-5 btn-3d">
                            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Target className="w-4 h-4 mr-2" />}
                            Lock it in
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
