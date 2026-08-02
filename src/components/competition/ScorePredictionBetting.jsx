import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import {
    TrendingUp, TrendingDown, Zap, Target, Flag, Loader2,
    CheckCircle2, Edit3, Users, ArrowUpRight, ArrowDownRight, Lock
} from "lucide-react";

const XP_OPTS = [25, 50, 100, 200];
const WIN_MULT = 1.8;

// ── My Prediction Panel ──────────────────────────────────────────────────────
function MyPrediction({ competition, currentUserEmail, onUpdate }) {
    const { toast } = useToast();
    const me = (competition.participants || []).find(p => p.email === currentUserEmail);
    const [editing, setEditing] = useState(!me?.self_line);
    const [line, setLine] = useState(me?.self_line ?? 75);
    const [label, setLabel] = useState(me?.self_line_label ?? "");
    const [saving, setSaving] = useState(false);

    const hasLine = me?.self_line != null;
    const betCount = (competition.progress_bets || []).filter(b => b.target_email === currentUserEmail).length;

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = (competition.participants || []).map(p =>
                p.email === currentUserEmail ? { ...p, self_line: line, self_line_label: label } : p
            );
            await base44.entities.GoalCompetition.update(competition.id, { participants: updated });
            toast({ title: `Prediction set: ${line}%`, description: "Friends can now bet on your score!" });
            setEditing(false);
            onUpdate?.();
        } catch {
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (!editing && hasLine) {
        return (
            <div className="bg-chart-4/5 border-2 border-chart-4/20 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                    <p className="stat-label text-chart-4/80">Your Score Prediction</p>
                    <button onClick={() => setEditing(true)} className="text-muted-foreground/60 hover:text-foreground text-xs flex items-center gap-1">
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                </div>
                <div className="flex items-end gap-3">
                    <p className="font-display text-5xl font-black text-chart-4">{me.self_line}%</p>
                    <div className="mb-1">
                        {me.self_line_label && <p className="text-muted-foreground text-xs mb-1">"{me.self_line_label}"</p>}
                        <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-muted-foreground/60" />
                            <span className="text-muted-foreground text-xs">{betCount} bet{betCount !== 1 ? 's' : ''} on you</span>
                        </div>
                    </div>
                </div>
                {me?.result_submitted && (
                    <div className="mt-3 pt-3 border-t border-chart-4/15 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span className="text-foreground text-xs font-semibold">Actual result submitted: {me.actual_result}%</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-chart-4/5 border-2 border-chart-4/20 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-chart-4" />
                <p className="font-bold text-foreground text-sm">Set Your Score Prediction</p>
            </div>
            <p className="text-xs text-muted-foreground">Predict your assessment score. Friends will bet over or under. Win big if they're wrong!</p>

            <div>
                <div className="flex justify-between mb-2">
                    <span className="text-xs text-muted-foreground">I predict I'll score:</span>
                    <span className="text-3xl font-black text-chart-4">{line}%</span>
                </div>
                <Slider value={[line]} onValueChange={([v]) => setLine(v)} min={0} max={100} step={1} />
                <div className="flex gap-2 mt-2">
                    {[40, 50, 60, 70, 80, 90].map(v => (
                        <button key={v} onClick={() => setLine(v)}
                            className={`flex-1 text-xs py-1 rounded font-semibold transition-all ${line === v ? 'bg-chart-4 text-white' : 'bg-secondary text-muted-foreground hover:bg-chart-4/10'}`}>{v}</button>
                    ))}
                </div>
            </div>

            <Input value={label} onChange={e => setLabel(e.target.value)}
                placeholder="e.g. I'll score 85% on my Chem SAC"
                className="text-sm" maxLength={80} />

            <Button onClick={handleSave} disabled={saving} className="w-full bg-chart-4 hover:bg-chart-4 text-white font-bold rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Flag className="w-4 h-4 mr-2" />}
                Publish Prediction
            </Button>
        </div>
    );
}

// ── Submit Actual Result ─────────────────────────────────────────────────────
function SubmitResult({ competition, currentUserEmail, onUpdate }) {
    const { toast } = useToast();
    const me = (competition.participants || []).find(p => p.email === currentUserEmail);
    const [result, setResult] = useState(me?.actual_result ?? me?.self_line ?? 75);
    const [saving, setSaving] = useState(false);

    if (!me?.self_line || me?.result_submitted) return null;

    const diff = Math.abs(result - me.self_line);
    const accuracy = diff <= 3 ? 'exact' : diff <= 10 ? 'close' : 'off';

    const handleSubmit = async () => {
        setSaving(true);
        try {
            // Settlement runs server-side: winners are paid through the XP
            // engine (audit log + caps + leaderboard mirror), not client writes.
            const res = await base44.functions.invoke('submitPredictionResult', {
                competition_id: competition.id,
                actual_result: result,
            });
            const data = res?.data ?? res;
            toast({
                title: "Result submitted! 🎯",
                description: data?.settled_count
                    ? `${data.settled_count} bet${data.settled_count === 1 ? '' : 's'} settled.`
                    : "Locked in.",
            });
            onUpdate?.();
        } catch (e) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-xp/5 border-2 border-xp/30 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-xp" />
                <p className="font-bold text-foreground text-sm">Submit Your Actual Score</p>
            </div>
            <p className="text-xs text-muted-foreground">You predicted <strong className="text-foreground">{me.self_line}%</strong>. Enter your actual score to settle bets.</p>

            <div>
                <div className="flex justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Actual score:</span>
                    <span className="text-3xl font-black text-xp">{result}%</span>
                </div>
                <Slider value={[result]} onValueChange={([v]) => setResult(v)} min={0} max={100} step={1} />
                <div className="flex gap-1 mt-2">
                    {[0, 40, 50, 60, 70, 80, 90, 100].map(v => (
                        <button key={v} onClick={() => setResult(v)}
                            className={`flex-1 text-xs py-1 rounded font-semibold transition-all ${result === v ? 'bg-xp text-white' : 'bg-secondary text-muted-foreground hover:bg-xp/10'}`}>{v}</button>
                    ))}
                </div>
            </div>

            <div className={`rounded-xl p-3 border-2 text-center ${accuracy === 'exact' ? 'bg-primary/10 border-primary/30' : accuracy === 'close' ? 'bg-chart-3/10 border-chart-3/30' : 'bg-streak/10 border-streak/20'}`}>
                <p className="text-lg mb-0.5">{accuracy === 'exact' ? '🎯' : accuracy === 'close' ? '👍' : '😬'}</p>
                <p className="text-xs font-bold text-foreground">
                    {accuracy === 'exact' ? 'Perfect prediction!' : accuracy === 'close' ? 'Close call' : `Off by ${diff}%`}
                </p>
            </div>

            <Button onClick={handleSubmit} disabled={saving} className="w-full bg-xp hover:bg-xp text-white font-bold rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Confirm & Settle Bets
            </Button>
        </div>
    );
}

// ── Bet on a participant's prediction ────────────────────────────────────────
function BetPanel({ target, competition, currentUserEmail, onUpdate, balance }) {
    const { toast } = useToast();
    const [direction, setDirection] = useState("over");
    const [wageredXP, setWageredXP] = useState(50);
    const [placing, setPlacing] = useState(false);
    const [open, setOpen] = useState(false);

    const existingBet = (competition.progress_bets || []).find(
        b => b.bettor_email === currentUserEmail && b.target_email === target.email && b.status === 'open'
    );
    const isMe = target.email === currentUserEmail;
    const betCount = (competition.progress_bets || []).filter(b => b.target_email === target.email).length;

    const handleBet = async () => {
        setPlacing(true);
        try {
            // Escrow + bet creation happen server-side — the stake is checked
            // against the real balance and recorded in the XP audit log.
            await base44.functions.invoke('placeProgressBet', {
                competition_id: competition.id,
                target_email: target.email,
                direction,
                wagered_xp: wageredXP,
            });
            toast({ title: `${direction === 'over' ? '📈 OVER' : '📉 UNDER'} bet placed!`, description: `${wageredXP} XP wagered on ${target.name.split(' ')[0]}` });
            setOpen(false);
            onUpdate?.();
        } catch (e) {
            toast({ title: "Bet not placed", description: e.message, variant: "destructive" });
        } finally {
            setPlacing(false);
        }
    };

    return (
        <div className="border-2 border-border rounded-2xl overflow-hidden bg-surface">
            <div className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => !existingBet && !target.result_submitted && setOpen(o => !o)}>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm">{target.name}{isMe ? ' (you)' : ''}</p>
                    {target.self_line_label && <p className="text-xs text-muted-foreground truncate mt-0.5">"{target.self_line_label}"</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{betCount} bet{betCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                    <p className="text-3xl font-black text-chart-4">{target.self_line}%</p>
                    {target.result_submitted && (
                        <p className="text-xs text-primary font-semibold">Actual: {target.actual_result}%</p>
                    )}
                </div>
                {existingBet ? (
                    <Badge className={`ml-2 text-xs flex-shrink-0 ${
                        existingBet.status === 'won' ? 'bg-primary/15 text-primary' :
                        existingBet.status === 'lost' ? 'bg-streak/15 text-streak' :
                        existingBet.direction === 'over' ? 'bg-primary/15 text-primary' : 'bg-streak/15 text-streak'
                    }`}>
                        {existingBet.status === 'open'
                            ? `${existingBet.direction.toUpperCase()} · ${existingBet.wagered_xp}XP`
                            : existingBet.status === 'won'
                            ? `+${existingBet.xp_outcome}XP 🎉`
                            : `${existingBet.xp_outcome}XP 💔`}
                    </Badge>
                ) : target.result_submitted ? (
                    <Badge className="ml-2 text-xs bg-secondary text-muted-foreground flex-shrink-0"><Lock className="w-3 h-3 mr-1" />Settled</Badge>
                ) : (
                    <button className={`ml-2 text-xs font-bold px-3 py-1.5 rounded-xl border-2 transition-all flex-shrink-0 ${
                        open ? 'bg-chart-4 border-chart-4 text-white' : 'border-chart-4/30 text-chart-4 hover:bg-chart-4/5'
                    }`}>
                        {open ? '✕ Cancel' : 'Bet →'}
                    </button>
                )}
            </div>

            <AnimatePresence>
                {open && !existingBet && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border bg-chart-4/5 px-4 py-4 space-y-4">

                        {/* Over/Under toggle */}
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setDirection('over')}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                                    direction === 'over' ? 'bg-primary border-primary text-white shadow-soft' : 'bg-surface border-border text-foreground hover:border-primary/40'
                                }`}>
                                <TrendingUp className="w-4 h-4" /> OVER
                                <span className="text-xs opacity-70">{target.self_line}%</span>
                            </button>
                            <button onClick={() => setDirection('under')}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                                    direction === 'under' ? 'bg-streak border-streak text-white shadow-soft' : 'bg-surface border-border text-foreground hover:border-streak/40'
                                }`}>
                                <TrendingDown className="w-4 h-4" /> UNDER
                                <span className="text-xs opacity-70">{target.self_line}%</span>
                            </button>
                        </div>

                        {/* XP stake chips */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs text-muted-foreground font-semibold">Stake (held in escrow)</p>
                                {balance != null && (
                                    <p className="text-xs font-bold text-xp flex items-center gap-1">
                                        <Zap className="w-3 h-3" /> {balance.toLocaleString()} XP available
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {XP_OPTS.map(amt => {
                                    const unaffordable = balance != null && amt > balance;
                                    return (
                                        <button key={amt} onClick={() => setWageredXP(amt)}
                                            disabled={unaffordable}
                                            className={`px-3.5 py-2 rounded-xl text-sm font-bold border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                                wageredXP === amt
                                                    ? 'bg-chart-3 border-chart-3 text-white shadow-soft'
                                                    : 'bg-surface border-border text-foreground hover:border-chart-3/40'
                                            }`}>{amt} XP</button>
                                    );
                                })}
                            </div>
                            {balance != null && balance < XP_OPTS[0] && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Earn a little more XP to place a bet — the smallest stake is {XP_OPTS[0]} XP.
                                </p>
                            )}
                        </div>

                        {/* Summary */}
                        <div className={`rounded-xl p-3.5 border-2 ${direction === 'over' ? 'bg-primary/10 border-primary/20' : 'bg-streak/10 border-streak/20'}`}>
                            <p className="text-sm font-black text-foreground mb-1">
                                {direction === 'over' ? '📈' : '📉'} {target.name.split(' ')[0]} goes {direction.toUpperCase()} {target.self_line}%
                            </p>
                            <div className="flex justify-between text-xs font-semibold">
                                <span className="text-primary">Win: +{Math.floor(wageredXP * WIN_MULT)} XP ({WIN_MULT}×)</span>
                                <span className="text-streak">Lose: -{wageredXP} XP</span>
                            </div>
                        </div>

                        <Button onClick={handleBet} disabled={placing || (balance != null && wageredXP > balance)}
                            className="w-full bg-chart-4 hover:bg-chart-4/90 text-white font-bold rounded-xl py-5 btn-3d">
                            {placing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                            {placing ? 'Placing…' : `Bet ${wageredXP} XP`}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ScorePredictionBetting({ competition, currentUserEmail, onUpdate }) {
    const me = (competition.participants || []).find(p => p.email === currentUserEmail);
    const deadline = competition.goal_target_date;
    const isPastDeadline = deadline && new Date() > new Date(deadline);

    // Spendable XP for stake affordability — refreshed when bets change.
    const [balance, setBalance] = useState(null);
    useEffect(() => {
        let cancelled = false;
        base44.entities.UserProfile.filter({ created_by: currentUserEmail })
            .then(rows => { if (!cancelled) setBalance(rows?.[0]?.total_xp ?? null); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [currentUserEmail, competition.progress_bets?.length]);

    const accepted = (competition.participants || []).filter(
        p => (p.status === 'accepted' || p.status === 'completed') && p.self_line != null
    );
    const myBets = (competition.progress_bets || []).filter(b => b.bettor_email === currentUserEmail);

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-chart-4" />
                <h3 className="font-display font-extrabold text-foreground">Score Predictions & Bets</h3>
                {(competition.progress_bets || []).length > 0 && (
                    <Badge className="bg-chart-4/15 text-chart-4 border-0 text-xs">
                        {(competition.progress_bets || []).length} bet{(competition.progress_bets || []).length !== 1 ? 's' : ''}
                    </Badge>
                )}
            </div>

            <p className="text-xs text-muted-foreground">
                Set your predicted score for an upcoming assessment. Your opponents bet <strong className="text-foreground">over</strong> or <strong className="text-foreground">under</strong>.
                Correct bets pay <strong className="text-foreground">{WIN_MULT}×</strong>. Wrong bets lose the stake.
            </p>

            {/* My prediction */}
            <MyPrediction competition={competition} currentUserEmail={currentUserEmail} onUpdate={onUpdate} />

            {/* Submit result (after deadline) */}
            {isPastDeadline && me?.self_line != null && !me?.result_submitted && (
                <SubmitResult competition={competition} currentUserEmail={currentUserEmail} onUpdate={onUpdate} />
            )}

            {/* Others' predictions to bet on */}
            {accepted.filter(p => p.email !== currentUserEmail).length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Bet on your rivals</p>
                    {accepted.filter(p => p.email !== currentUserEmail).map(p => (
                        <BetPanel
                            key={p.email}
                            target={p}
                            competition={competition}
                            currentUserEmail={currentUserEmail}
                            onUpdate={onUpdate}
                            balance={balance}
                        />
                    ))}
                </div>
            )}

            {accepted.filter(p => p.email !== currentUserEmail).length === 0 && accepted.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 italic">
                    No one has set a prediction yet. Be the first!
                </p>
            )}

            {/* My bets summary */}
            {myBets.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Your active bets</p>
                    {myBets.map(bet => (
                        <div key={bet.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border-2 ${
                            bet.status === 'won' ? 'bg-primary/10 border-primary/20' :
                            bet.status === 'lost' ? 'bg-streak/10 border-streak/20' : 'bg-surface border-border'
                        }`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${bet.direction === 'over' ? 'bg-primary/15' : 'bg-streak/15'}`}>
                                {bet.direction === 'over'
                                    ? <TrendingUp className="w-4 h-4 text-primary" />
                                    : <TrendingDown className="w-4 h-4 text-streak" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground">
                                    {bet.target_name.split(' ')[0]} — <span className={bet.direction === 'over' ? 'text-primary' : 'text-streak'}>{bet.direction.toUpperCase()}</span> {bet.line}%
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {bet.status === 'open' ? `Waiting for result` : bet.status === 'won' ? '🎉 Won' : '💔 Lost'}
                                </p>
                            </div>
                            <div className="flex-shrink-0">
                                {bet.status === 'open' && <span className="text-xs font-black text-xp flex items-center gap-0.5"><Zap className="w-3 h-3" />{bet.wagered_xp}</span>}
                                {bet.status === 'won' && <span className="text-xs font-black text-primary flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />+{bet.xp_outcome}</span>}
                                {bet.status === 'lost' && <span className="text-xs font-black text-streak flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3" />{bet.xp_outcome}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
