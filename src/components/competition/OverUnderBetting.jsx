import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import {
    TrendingUp, TrendingDown, Zap, ChevronDown, ChevronUp,
    CheckCircle2, XCircle, Plus, Target, Flag, Edit3, Loader2,
    ArrowUpRight, ArrowDownRight, Users
} from "lucide-react";

function BetChip({ amount, selected, onClick }) {
    return (
        <button onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition-all ${
                selected
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md scale-105"
                    : "bg-white border-gray-200 text-gray-700 hover:border-indigo-300"
            }`}>{amount} XP</button>
    );
}

// Panel for a participant to set their own line
function SetMyLine({ competition, currentUserEmail, onUpdate }) {
    const { toast } = useToast();
    const me = (competition.participants || []).find(p => p.email === currentUserEmail);
    const [editing, setEditing] = useState(false);
    const [line, setLine] = useState(me?.self_line ?? 75);
    const [label, setLabel] = useState(me?.self_line_label ?? "");
    const [saving, setSaving] = useState(false);

    const hasLine = me?.self_line != null;

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = (competition.participants || []).map(p =>
                p.email === currentUserEmail
                    ? { ...p, self_line: line, self_line_label: label }
                    : p
            );
            await base44.entities.GoalCompetition.update(competition.id, { participants: updated });
            toast({ title: `Line set to ${line}%`, description: "Others can now bet on you!" });
            setEditing(false);
            onUpdate?.();
        } catch (e) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (!editing && hasLine) {
        return (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                <div>
                    <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">Your Line</p>
                    <p className="text-2xl font-black text-indigo-700">{me.self_line}%</p>
                    {me.self_line_label && <p className="text-xs text-gray-500 mt-0.5">{me.self_line_label}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                    <Badge className="bg-indigo-100 text-indigo-700 text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        {(competition.progress_bets || []).filter(b => b.target_email === currentUserEmail).length} bets on you
                    </Badge>
                    <button onClick={() => setEditing(true)} className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> Edit
                    </button>
                </div>
            </div>
        );
    }

    if (editing || !hasLine) {
        return (
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 space-y-4">
                <p className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                    <Flag className="w-4 h-4" /> {hasLine ? "Edit your line" : "Set your line"}
                </p>
                <p className="text-xs text-indigo-600">
                    Set a number (score %, progress %, etc.) that others will bet over or under on.
                </p>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-600">Your line:</span>
                        <span className="text-2xl font-black text-indigo-700">{line}%</span>
                    </div>
                    <Slider value={[line]} onValueChange={([v]) => setLine(v)} min={0} max={100} step={1} />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0%</span><span>50%</span><span>100%</span>
                    </div>
                </div>

                <div>
                    <p className="text-xs text-gray-500 mb-1">Optional label (e.g. "I'll score 85% on my SAC")</p>
                    <Input value={label} onChange={e => setLabel(e.target.value)}
                        placeholder="I'll score 85% on my Biology exam..." maxLength={80}
                        className="text-sm" />
                </div>

                <div className="flex gap-2">
                    {hasLine && <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>}
                    <Button size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Flag className="w-4 h-4 mr-1" />}
                        {hasLine ? "Save" : "Publish Line"}
                    </Button>
                </div>
            </div>
        );
    }

    return null;
}

// Panel to enter actual result and trigger resolution
function SubmitResult({ competition, currentUserEmail, onUpdate }) {
    const { toast } = useToast();
    const me = (competition.participants || []).find(p => p.email === currentUserEmail);
    const [result, setResult] = useState(me?.actual_result ?? me?.self_line ?? 50);
    const [saving, setSaving] = useState(false);

    if (!me?.self_line) return null;
    if (me?.result_submitted) {
        return (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-green-700 font-semibold">Actual result submitted: <strong>{me.actual_result}%</strong></span>
            </div>
        );
    }

    const handleSubmit = async () => {
        setSaving(true);
        try {
            // Update participant record
            const updatedParticipants = (competition.participants || []).map(p =>
                p.email === currentUserEmail
                    ? { ...p, actual_result: result, result_submitted: true, result_submitted_at: new Date().toISOString() }
                    : p
            );
            await base44.entities.GoalCompetition.update(competition.id, { participants: updatedParticipants });

            // Check if everyone who has a line has submitted — if so, resolve bets
            const withLines = updatedParticipants.filter(p => p.self_line != null);
            const allSubmitted = withLines.length > 0 && withLines.every(p => p.result_submitted);

            if (allSubmitted) {
                // Resolve all open bets
                await resolveBets(competition, updatedParticipants);
                toast({ title: "All results in! Bets resolved 🎯", description: "XP has been awarded/deducted." });
            } else {
                const remaining = withLines.filter(p => !p.result_submitted).length;
                toast({ title: `Result submitted!`, description: `Waiting on ${remaining} other participant${remaining !== 1 ? 's' : ''} to submit.` });
            }
            onUpdate?.();
        } catch (e) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const resolveBets = async (comp, participants) => {
        const bets = comp.progress_bets || [];
        const updatedBets = bets.map(bet => {
            if (bet.status !== 'open') return bet;
            const targetParticipant = participants.find(p => p.email === bet.target_email);
            if (!targetParticipant?.result_submitted && targetParticipant?.email !== currentUserEmail) return bet;
            const actual = targetParticipant?.email === currentUserEmail ? result : targetParticipant?.actual_result;
            if (actual == null) return bet;
            const won = bet.direction === 'over' ? actual > bet.line : actual < bet.line;
            const xp_outcome = won ? Math.floor(bet.wagered_xp * 1.8) : -bet.wagered_xp;
            return { ...bet, status: won ? 'won' : 'lost', xp_outcome, resolved_at: new Date().toISOString() };
        });

        // Award/deduct XP for all resolved bets
        const newlyResolved = updatedBets.filter((b, i) => b.status !== 'open' && (bets[i]?.status === 'open'));
        for (const bet of newlyResolved) {
            const eventKey = `competition_bet_${bet.id}_${comp.id}`;
            const xpToAward = bet.xp_outcome;
            if (xpToAward !== 0) {
                const profiles = await base44.entities.UserProfile.filter({ created_by: bet.bettor_email });
                if (profiles[0]) {
                    const newTotal = Math.max(0, (profiles[0].total_xp || 0) + xpToAward);
                    const newSeason = Math.max(0, (profiles[0].season_xp || 0) + xpToAward);
                    await base44.entities.UserProfile.update(profiles[0].id, {
                        total_xp: newTotal,
                        season_xp: newSeason,
                    });
                    await base44.entities.XPEvent.create({
                        event_key: eventKey,
                        user_email: bet.bettor_email,
                        source: 'wager',
                        xp_awarded: xpToAward,
                        raw_xp: xpToAward,
                        capped: false,
                        integrity_flags: [],
                        total_xp_after: newTotal,
                        season_xp_after: newSeason,
                        leveled_up: false,
                        metadata: { competition_id: comp.id, bet_id: bet.id, target: bet.target_name, direction: bet.direction, line: bet.line, actual: bet.direction === 'over' ? result : (participants.find(p => p.email === bet.target_email)?.actual_result) }
                    });
                }
            }
        }

        await base44.entities.GoalCompetition.update(comp.id, { progress_bets: updatedBets });
    };

    return (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-4">
            <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                <Target className="w-4 h-4" /> Submit Your Actual Result
            </p>
            <p className="text-xs text-amber-700">
                Your line was <strong>{me.self_line}%</strong>. Enter your actual score/result to settle all bets.
            </p>
            <div>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-600">Actual result:</span>
                    <span className="text-2xl font-black text-amber-700">{result}%</span>
                </div>
                <Slider value={[result]} onValueChange={([v]) => setResult(v)} min={0} max={100} step={1} />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0%</span><span>Line: {me.self_line}%</span><span>100%</span>
                </div>
            </div>
            <Button className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500" onClick={handleSubmit} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Confirm & Settle Bets
            </Button>
        </div>
    );
}

// Cards showing all participants' published lines for anyone to bet on (including yourself)
function LinesToBetOn({ competition, currentUserEmail, onUpdate }) {
    const { toast } = useToast();
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [direction, setDirection] = useState("over");
    const [wageredXP, setWageredXP] = useState(50);
    const [placing, setPlacing] = useState(false);
    const XP_OPTIONS = [25, 50, 100, 200, 500];

    // All participants with a line (including yourself)
    const othersWithLines = (competition.participants || []).filter(
        p => p.self_line != null && (p.status === 'accepted' || p.status === 'completed')
    );

    if (othersWithLines.length === 0) {
        return (
            <p className="text-xs text-gray-400 text-center py-4 italic">
                No other participants have set their lines yet.
            </p>
        );
    }

    const handlePlaceBet = async () => {
        if (!selectedTarget || !wageredXP) return;
        setPlacing(true);
        try {
            const target = othersWithLines.find(p => p.email === selectedTarget);
            const myName = (competition.participants || []).find(p => p.email === currentUserEmail)?.name || '';
            const existingBet = (competition.progress_bets || []).find(
                b => b.bettor_email === currentUserEmail && b.target_email === selectedTarget && b.status === 'open'
            );
            if (existingBet) {
                toast({ title: "You already have an open bet on this person.", variant: "destructive" });
                setPlacing(false);
                return;
            }
            const newBet = {
                id: `bet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                bettor_email: currentUserEmail,
                bettor_name: myName,
                target_email: selectedTarget,
                target_name: target?.name || '',
                line: target.self_line,
                direction,
                wagered_xp: wageredXP,
                status: 'open',
                xp_outcome: null,
                created_at: new Date().toISOString(),
            };
            const updatedBets = [...(competition.progress_bets || []), newBet];
            await base44.entities.GoalCompetition.update(competition.id, { progress_bets: updatedBets });

            // Deduct wagered XP from bettor immediately (held in escrow)
            const bettorProfiles = await base44.entities.UserProfile.filter({ created_by: currentUserEmail });
            if (bettorProfiles[0]) {
                const newTotal = Math.max(0, (bettorProfiles[0].total_xp || 0) - wageredXP);
                const newSeason = Math.max(0, (bettorProfiles[0].season_xp || 0) - wageredXP);
                await base44.entities.UserProfile.update(bettorProfiles[0].id, { total_xp: newTotal, season_xp: newSeason });
            }

            toast({ title: `Bet placed! ${direction === 'over' ? '📈 OVER' : '📉 UNDER'} ${target.self_line}%`, description: `Wagered ${wageredXP} XP on ${target?.name}` });
            setSelectedTarget(null);
            onUpdate?.();
        } catch (e) {
            toast({ title: "Failed", description: e.message, variant: "destructive" });
        } finally {
            setPlacing(false);
        }
    };

    return (
        <div className="space-y-3">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Open Lines — Bet On Your Rivals</p>
            {othersWithLines.map(p => {
                const myBetOnThem = (competition.progress_bets || []).find(
                    b => b.bettor_email === currentUserEmail && b.target_email === p.email
                );
                const betCount = (competition.progress_bets || []).filter(b => b.target_email === p.email).length;
                const isSelecting = selectedTarget === p.email;

                return (
                    <div key={p.email} className="border-2 border-gray-200 rounded-2xl overflow-hidden bg-white">
                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => !myBetOnThem && setSelectedTarget(isSelecting ? null : p.email)}>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-800 text-sm">
                                    {p.name}{p.email === currentUserEmail ? ' (you)' : ''}
                                </p>
                                {p.self_line_label && <p className="text-xs text-gray-400 truncate">{p.self_line_label}</p>}
                            </div>
                            <div className="text-center flex-shrink-0">
                                <p className="text-2xl font-black text-indigo-700">{p.self_line}%</p>
                                <p className="text-xs text-gray-400">{betCount} bet{betCount !== 1 ? 's' : ''}</p>
                            </div>
                            {myBetOnThem ? (
                                <Badge className={`text-xs ${myBetOnThem.status === 'won' ? 'bg-green-100 text-green-700' : myBetOnThem.status === 'lost' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                    {myBetOnThem.status === 'open'
                                        ? `${myBetOnThem.direction.toUpperCase()} ${myBetOnThem.wagered_xp}XP`
                                        : myBetOnThem.status === 'won'
                                        ? `+${myBetOnThem.xp_outcome}XP`
                                        : `${myBetOnThem.xp_outcome}XP`
                                    }
                                </Badge>
                            ) : (
                                <button className={`text-xs font-bold px-3 py-1.5 rounded-lg border-2 transition-all ${
                                    isSelecting ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                                }`}>
                                    {isSelecting ? 'Cancel' : 'Bet'}
                                </button>
                            )}
                        </div>

                        <AnimatePresence>
                            {isSelecting && !myBetOnThem && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-4">
                                    {/* Direction */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setDirection('over')}
                                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                                                direction === 'over' ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-green-300'
                                            }`}>
                                            <TrendingUp className="w-4 h-4" /> OVER
                                        </button>
                                        <button onClick={() => setDirection('under')}
                                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                                                direction === 'under' ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-red-300'
                                            }`}>
                                            <TrendingDown className="w-4 h-4" /> UNDER
                                        </button>
                                    </div>

                                    {/* Stake */}
                                    <div>
                                        <p className="text-xs text-gray-500 mb-2">Wager (XP held in escrow):</p>
                                        <div className="flex flex-wrap gap-2">
                                            {XP_OPTIONS.map(amt => (
                                                <BetChip key={amt} amount={amt} selected={wageredXP === amt} onClick={() => setWageredXP(amt)} />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div className={`rounded-xl p-3 border-2 text-center ${direction === 'over' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                        <p className="text-sm font-bold text-gray-800">
                                            {direction === 'over' ? '📈' : '📉'} {p.name.split(' ')[0]} will go{' '}
                                            <span className={direction === 'over' ? 'text-green-700' : 'text-red-700'}>{direction.toUpperCase()} {p.self_line}%</span>
                                        </p>
                                        <p className="text-xs text-gray-600 mt-0.5">
                                            Win: <strong className="text-green-700">+{Math.floor(wageredXP * 1.8)} XP</strong> | Lose: <strong className="text-red-600">-{wageredXP} XP</strong>
                                        </p>
                                    </div>

                                    <Button size="sm" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                        disabled={placing} onClick={handlePlaceBet}>
                                        {placing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                                        {placing ? 'Placing...' : `Bet ${wageredXP} XP 🎯`}
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
}

export default function OverUnderBetting({ competition, currentUserEmail, onUpdate }) {
    const [expanded, setExpanded] = useState(false);
    const bets = competition.progress_bets || [];
    const myBets = bets.filter(b => b.bettor_email === currentUserEmail);
    const isCompleted = competition.status === 'completed';
    const me = (competition.participants || []).find(p => p.email === currentUserEmail);
    const deadline = competition.goal_target_date;
    const isPastDeadline = deadline && new Date() > new Date(deadline);

    return (
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <CardTitle className="text-base flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                        <span>Over/Under Bets</span>
                        {bets.length > 0 && (
                            <Badge className="bg-purple-100 text-purple-700 text-xs">{bets.length} bet{bets.length !== 1 ? 's' : ''}</Badge>
                        )}
                    </div>
                    {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </CardTitle>
            </CardHeader>

            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <CardContent className="pt-0 space-y-5">
                            <p className="text-xs text-purple-700">
                                Each participant sets their own line (e.g. "I'll score 85%"). Others bet XP on whether they go over or under.
                                Win <strong>1.8×</strong> your stake. Lose your stake.
                            </p>

                            {/* 1. Set / show your own line */}
                            <SetMyLine competition={competition} currentUserEmail={currentUserEmail} onUpdate={onUpdate} />

                            {/* 2. Submit actual result if past deadline and you have a line */}
                            {(isPastDeadline || isCompleted) && me?.self_line != null && (
                                <SubmitResult competition={competition} currentUserEmail={currentUserEmail} onUpdate={onUpdate} />
                            )}

                            {/* 3. Bet on others' lines */}
                            <LinesToBetOn competition={competition} currentUserEmail={currentUserEmail} onUpdate={onUpdate} />

                            {/* 4. My active bets summary */}
                            {myBets.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Your Bets</p>
                                    <div className="space-y-2">
                                        {myBets.map(bet => (
                                            <div key={bet.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border-2 ${
                                                bet.status === 'won' ? 'bg-green-50 border-green-200' :
                                                bet.status === 'lost' ? 'bg-red-50 border-red-200' :
                                                'bg-white border-gray-200'
                                            }`}>
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                    bet.direction === 'over' ? 'bg-green-100' : 'bg-red-100'
                                                }`}>
                                                    {bet.direction === 'over'
                                                        ? <TrendingUp className="w-4 h-4 text-green-600" />
                                                        : <TrendingDown className="w-4 h-4 text-red-600" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-gray-800">
                                                        {bet.target_name} — <span className={bet.direction === 'over' ? 'text-green-700' : 'text-red-700'}>{bet.direction.toUpperCase()}</span> {bet.line}%
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {bet.status === 'open' ? `Waiting for ${bet.target_name.split(' ')[0]} to submit result` : `Settled: ${bet.status}`}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    {bet.status === 'open' && (
                                                        <span className="text-xs font-bold text-amber-700 flex items-center gap-0.5">
                                                            <Zap className="w-3 h-3" />{bet.wagered_xp}
                                                        </span>
                                                    )}
                                                    {bet.status === 'won' && (
                                                        <span className="text-xs font-bold text-green-600 flex items-center gap-0.5">
                                                            <ArrowUpRight className="w-3 h-3" />+{bet.xp_outcome} XP
                                                        </span>
                                                    )}
                                                    {bet.status === 'lost' && (
                                                        <span className="text-xs font-bold text-red-600 flex items-center gap-0.5">
                                                            <ArrowDownRight className="w-3 h-3" />{bet.xp_outcome} XP
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}