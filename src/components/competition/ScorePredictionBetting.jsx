import React, { useState } from "react";
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

// ── Compute simple implied odds display ──────────────────────────────────────
function OddsDisplay({ line, direction }) {
    // Simple fixed odds for display: more extreme = longer odds
    const dist = Math.abs(line - 50);
    let overOdds, underOdds;
    if (line < 50) {
        overOdds = 1 + (50 - line) / 50 * 0.8;
        underOdds = 1 - (50 - line) / 100 * 0.3;
    } else {
        overOdds = 1 - (line - 50) / 100 * 0.3;
        underOdds = 1 + (line - 50) / 50 * 0.8;
    }
    const display = direction === 'over'
        ? `${overOdds.toFixed(2)}×`
        : `${underOdds.toFixed(2)}×`;
    return <span className="font-black text-amber-600">{display}</span>;
}

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
        } catch (e) {
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (!editing && hasLine) {
        return (
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">Your Score Prediction</p>
                    <button onClick={() => setEditing(true)} className="text-white/60 hover:text-white text-xs flex items-center gap-1">
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                </div>
                <div className="flex items-end gap-3">
                    <p className="text-5xl font-black">{me.self_line}%</p>
                    <div className="mb-1">
                        {me.self_line_label && <p className="text-white/80 text-xs mb-1">"{me.self_line_label}"</p>}
                        <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-white/60" />
                            <span className="text-white/70 text-xs">{betCount} bet{betCount !== 1 ? 's' : ''} on you</span>
                        </div>
                    </div>
                </div>
                {me?.result_submitted && (
                    <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        <span className="text-emerald-300 text-xs font-semibold">Actual result submitted: {me.actual_result}%</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-purple-600" />
                <p className="font-bold text-purple-900 text-sm">Set Your Score Prediction</p>
            </div>
            <p className="text-xs text-purple-700">Predict your assessment score. Friends will bet over or under. Win big if they're wrong!</p>

            <div>
                <div className="flex justify-between mb-2">
                    <span className="text-xs text-gray-600">I predict I'll score:</span>
                    <span className="text-3xl font-black text-purple-700">{line}%</span>
                </div>
                <Slider value={[line]} onValueChange={([v]) => setLine(v)} min={0} max={100} step={1} />
                <div className="flex gap-2 mt-2">
                    {[40, 50, 60, 70, 80, 90].map(v => (
                        <button key={v} onClick={() => setLine(v)}
                            className={`flex-1 text-xs py-1 rounded font-semibold transition-all ${line === v ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-purple-100'}`}>{v}</button>
                    ))}
                </div>
            </div>

            <Input value={label} onChange={e => setLabel(e.target.value)}
                placeholder="e.g. I'll score 85% on my Chem SAC"
                className="text-sm" maxLength={80} />

            <Button onClick={handleSave} disabled={saving} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl">
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
            const updatedParticipants = (competition.participants || []).map(p =>
                p.email === currentUserEmail
                    ? { ...p, actual_result: result, result_submitted: true, result_submitted_at: new Date().toISOString() }
                    : p
            );

            // Resolve any bets where this user is the target
            const bets = competition.progress_bets || [];
            const updatedBets = bets.map(bet => {
                if (bet.status !== 'open' || bet.target_email !== currentUserEmail) return bet;
                const won = bet.direction === 'over' ? result > bet.line : result < bet.line;
                const xp_outcome = won ? Math.floor(bet.wagered_xp * WIN_MULT) : -bet.wagered_xp;
                return { ...bet, status: won ? 'won' : 'lost', xp_outcome, resolved_at: new Date().toISOString() };
            });

            await base44.entities.GoalCompetition.update(competition.id, {
                participants: updatedParticipants,
                progress_bets: updatedBets
            });

            // Settle XP for resolved bets:
            // XP was already escrowed (deducted) when the bet was placed.
            // On WIN: reward the wagered_xp back PLUS winnings (wagered_xp * WIN_MULT total).
            // On LOSS: nothing to do — XP was already taken at bet time.
            const resolved = updatedBets.filter((b, i) => b.status !== 'open' && bets[i]?.status === 'open');
            for (const bet of resolved) {
                if (bet.status !== 'won') continue; // losers already had XP deducted
                try {
                    const profiles = await base44.entities.UserProfile.filter({ created_by: bet.bettor_email });
                    if (profiles[0]) {
                        const returnAmount = Math.floor(bet.wagered_xp * WIN_MULT); // e.g. stake + winnings
                        const newTotal = (profiles[0].total_xp || 0) + returnAmount;
                        const newSeason = (profiles[0].season_xp || 0) + returnAmount;
                        await base44.entities.UserProfile.update(profiles[0].id, { total_xp: newTotal, season_xp: newSeason });
                        // Also update Leaderboard
                        try {
                            const lbEntries = await base44.entities.Leaderboard.filter({ user_email: bet.bettor_email });
                            if (lbEntries[0]) {
                                await base44.entities.Leaderboard.update(lbEntries[0].id, {
                                    total_xp: newTotal,
                                    season_xp: newSeason,
                                    last_updated: new Date().toISOString()
                                });
                            }
                        } catch (_) {}
                    }
                } catch (_) {}
            }

            toast({ title: "Result submitted! 🎯", description: "Bets involving you have been settled." });
            onUpdate?.();
        } catch (e) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-600" />
                <p className="font-bold text-amber-900 text-sm">Submit Your Actual Score</p>
            </div>
            <p className="text-xs text-amber-700">You predicted <strong>{me.self_line}%</strong>. Enter your actual score to settle bets.</p>

            <div>
                <div className="flex justify-between mb-2">
                    <span className="text-xs text-gray-600">Actual score:</span>
                    <span className="text-3xl font-black text-amber-700">{result}%</span>
                </div>
                <Slider value={[result]} onValueChange={([v]) => setResult(v)} min={0} max={100} step={1} />
                <div className="flex gap-1 mt-2">
                    {[0, 40, 50, 60, 70, 80, 90, 100].map(v => (
                        <button key={v} onClick={() => setResult(v)}
                            className={`flex-1 text-xs py-1 rounded font-semibold transition-all ${result === v ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-amber-100'}`}>{v}</button>
                    ))}
                </div>
            </div>

            <div className={`rounded-xl p-3 border-2 text-center ${accuracy === 'exact' ? 'bg-emerald-50 border-emerald-300' : accuracy === 'close' ? 'bg-blue-50 border-blue-300' : 'bg-red-50 border-red-200'}`}>
                <p className="text-lg mb-0.5">{accuracy === 'exact' ? '🎯' : accuracy === 'close' ? '👍' : '😬'}</p>
                <p className="text-xs font-bold text-gray-700">
                    {accuracy === 'exact' ? 'Perfect prediction!' : accuracy === 'close' ? 'Close call' : `Off by ${diff}%`}
                </p>
            </div>

            <Button onClick={handleSubmit} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Confirm & Settle Bets
            </Button>
        </div>
    );
}

// ── Bet on a participant's prediction ────────────────────────────────────────
function BetPanel({ target, competition, currentUserEmail, onUpdate }) {
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
            const myName = (competition.participants || []).find(p => p.email === currentUserEmail)?.name || '';
            const newBet = {
                id: `bet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                bettor_email: currentUserEmail,
                bettor_name: myName,
                target_email: target.email,
                target_name: target.name,
                line: target.self_line,
                direction,
                wagered_xp: wageredXP,
                status: 'open',
                xp_outcome: null,
                created_at: new Date().toISOString()
            };
            const updatedBets = [...(competition.progress_bets || []), newBet];
            await base44.entities.GoalCompetition.update(competition.id, { progress_bets: updatedBets });

            // Escrow: deduct XP from bettor's profile AND leaderboard
            const bettorProfiles = await base44.entities.UserProfile.filter({ created_by: currentUserEmail });
            if (bettorProfiles[0]) {
                const newTotal = Math.max(0, (bettorProfiles[0].total_xp || 0) - wageredXP);
                const newSeason = Math.max(0, (bettorProfiles[0].season_xp || 0) - wageredXP);
                await base44.entities.UserProfile.update(bettorProfiles[0].id, {
                    total_xp: newTotal,
                    season_xp: newSeason
                });
                // Also deduct from leaderboard
                try {
                    const lbEntries = await base44.entities.Leaderboard.filter({ user_email: currentUserEmail });
                    if (lbEntries[0]) {
                        await base44.entities.Leaderboard.update(lbEntries[0].id, {
                            total_xp: newTotal,
                            season_xp: newSeason,
                            last_updated: new Date().toISOString()
                        });
                    }
                } catch (_) {}
            }

            toast({ title: `${direction === 'over' ? '📈 OVER' : '📉 UNDER'} bet placed!`, description: `${wageredXP} XP wagered on ${target.name.split(' ')[0]}` });
            setOpen(false);
            onUpdate?.();
        } catch (e) {
            toast({ title: "Failed", description: e.message, variant: "destructive" });
        } finally {
            setPlacing(false);
        }
    };

    return (
        <div className="border-2 border-gray-100 rounded-2xl overflow-hidden bg-white">
            <div className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => !existingBet && !target.result_submitted && setOpen(o => !o)}>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm">{target.name}{isMe ? ' (you)' : ''}</p>
                    {target.self_line_label && <p className="text-xs text-gray-400 truncate mt-0.5">"{target.self_line_label}"</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{betCount} bet{betCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                    <p className="text-3xl font-black text-purple-700">{target.self_line}%</p>
                    {target.result_submitted && (
                        <p className="text-xs text-emerald-600 font-semibold">Actual: {target.actual_result}%</p>
                    )}
                </div>
                {existingBet ? (
                    <Badge className={`ml-2 text-xs flex-shrink-0 ${
                        existingBet.status === 'won' ? 'bg-emerald-100 text-emerald-700' :
                        existingBet.status === 'lost' ? 'bg-red-100 text-red-700' :
                        existingBet.direction === 'over' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                        {existingBet.status === 'open'
                            ? `${existingBet.direction.toUpperCase()} · ${existingBet.wagered_xp}XP`
                            : existingBet.status === 'won'
                            ? `+${existingBet.xp_outcome}XP 🎉`
                            : `${existingBet.xp_outcome}XP 💔`}
                    </Badge>
                ) : target.result_submitted ? (
                    <Badge className="ml-2 text-xs bg-gray-100 text-gray-500 flex-shrink-0"><Lock className="w-3 h-3 mr-1" />Settled</Badge>
                ) : (
                    <button className={`ml-2 text-xs font-bold px-3 py-1.5 rounded-xl border-2 transition-all flex-shrink-0 ${
                        open ? 'bg-purple-600 border-purple-600 text-white' : 'border-purple-200 text-purple-600 hover:bg-purple-50'
                    }`}>
                        {open ? '✕ Cancel' : 'Bet →'}
                    </button>
                )}
            </div>

            <AnimatePresence>
                {open && !existingBet && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-gray-100 bg-gradient-to-br from-purple-50 to-indigo-50 px-4 py-4 space-y-4">

                        {/* Over/Under toggle */}
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setDirection('over')}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                                    direction === 'over' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-300'
                                }`}>
                                <TrendingUp className="w-4 h-4" /> OVER
                                <span className="text-xs opacity-70">{target.self_line}%</span>
                            </button>
                            <button onClick={() => setDirection('under')}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                                    direction === 'under' ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200' : 'bg-white border-gray-200 text-gray-700 hover:border-red-300'
                                }`}>
                                <TrendingDown className="w-4 h-4" /> UNDER
                                <span className="text-xs opacity-70">{target.self_line}%</span>
                            </button>
                        </div>

                        {/* XP stake chips */}
                        <div>
                            <p className="text-xs text-gray-500 mb-2 font-semibold">Stake (held in escrow)</p>
                            <div className="flex gap-2 flex-wrap">
                                {XP_OPTS.map(amt => (
                                    <button key={amt} onClick={() => setWageredXP(amt)}
                                        className={`px-3.5 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                                            wageredXP === amt
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'
                                        }`}>{amt} XP</button>
                                ))}
                            </div>
                        </div>

                        {/* Summary */}
                        <div className={`rounded-xl p-3.5 border-2 ${direction === 'over' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <p className="text-sm font-black text-gray-800 mb-1">
                                {direction === 'over' ? '📈' : '📉'} {target.name.split(' ')[0]} goes {direction.toUpperCase()} {target.self_line}%
                            </p>
                            <div className="flex justify-between text-xs font-semibold">
                                <span className="text-emerald-600">Win: +{Math.floor(wageredXP * WIN_MULT)} XP ({WIN_MULT}×)</span>
                                <span className="text-red-600">Lose: -{wageredXP} XP</span>
                            </div>
                        </div>

                        <Button onClick={handleBet} disabled={placing} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl py-5">
                            {placing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                            {placing ? 'Placing...' : `Bet ${wageredXP} XP`}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ScorePredictionBetting({ competition, currentUserEmail, onUpdate }) {
    const isCompleted = competition.status === 'completed';
    const me = (competition.participants || []).find(p => p.email === currentUserEmail);
    const deadline = competition.goal_target_date;
    const isPastDeadline = deadline && new Date() > new Date(deadline);

    const accepted = (competition.participants || []).filter(
        p => (p.status === 'accepted' || p.status === 'completed') && p.self_line != null
    );
    const myBets = (competition.progress_bets || []).filter(b => b.bettor_email === currentUserEmail);

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <h3 className="font-black text-gray-900">Score Predictions & Bets</h3>
                {(competition.progress_bets || []).length > 0 && (
                    <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">
                        {(competition.progress_bets || []).length} bet{(competition.progress_bets || []).length !== 1 ? 's' : ''}
                    </Badge>
                )}
            </div>

            <p className="text-xs text-gray-500">
                Set your predicted score for an upcoming assessment. Your opponents bet <strong>over</strong> or <strong>under</strong>. 
                Correct bets pay <strong>{WIN_MULT}×</strong>. Wrong bets lose the stake.
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
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Bet on your rivals</p>
                    {accepted.filter(p => p.email !== currentUserEmail).map(p => (
                        <BetPanel
                            key={p.email}
                            target={p}
                            competition={competition}
                            currentUserEmail={currentUserEmail}
                            onUpdate={onUpdate}
                        />
                    ))}
                </div>
            )}

            {accepted.filter(p => p.email !== currentUserEmail).length === 0 && accepted.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4 italic">
                    No one has set a prediction yet. Be the first!
                </p>
            )}

            {/* My bets summary */}
            {myBets.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Your active bets</p>
                    {myBets.map(bet => (
                        <div key={bet.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border-2 ${
                            bet.status === 'won' ? 'bg-emerald-50 border-emerald-200' :
                            bet.status === 'lost' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                        }`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${bet.direction === 'over' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                                {bet.direction === 'over'
                                    ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                                    : <TrendingDown className="w-4 h-4 text-red-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-800">
                                    {bet.target_name.split(' ')[0]} — <span className={bet.direction === 'over' ? 'text-emerald-700' : 'text-red-700'}>{bet.direction.toUpperCase()}</span> {bet.line}%
                                </p>
                                <p className="text-xs text-gray-400">
                                    {bet.status === 'open' ? `Waiting for result` : bet.status === 'won' ? '🎉 Won' : '💔 Lost'}
                                </p>
                            </div>
                            <div className="flex-shrink-0">
                                {bet.status === 'open' && <span className="text-xs font-black text-amber-600 flex items-center gap-0.5"><Zap className="w-3 h-3" />{bet.wagered_xp}</span>}
                                {bet.status === 'won' && <span className="text-xs font-black text-emerald-600 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />+{bet.xp_outcome}</span>}
                                {bet.status === 'lost' && <span className="text-xs font-black text-red-600 flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3" />{bet.xp_outcome}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}