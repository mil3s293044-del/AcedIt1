import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
    Target, Zap, Clock, AlertTriangle, Loader2,
    TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight,
    BarChart2, Activity
} from "lucide-react";
import { resolveScoreWager } from "@/api/functionsShim";
import { useToast } from "@/components/ui/use-toast";
import { isPast, parseISO, format, differenceInDays } from "date-fns";

const ACCURACY_CONFIG = {
    exact: {
        bg: "bg-emerald-500/10 border-emerald-500/40",
        badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        icon: "🎯", label: "Exact Hit", multiplier: "3×"
    },
    close: {
        bg: "bg-blue-500/10 border-blue-500/40",
        badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        icon: "✅", label: "Close", multiplier: "1.5×"
    },
    wrong: {
        bg: "bg-red-500/10 border-red-500/40",
        badge: "bg-red-500/20 text-red-400 border-red-500/30",
        icon: "❌", label: "Missed", multiplier: "−1×"
    }
};

function MiniSparkline({ predicted, actual }) {
    // Simple visual chart: predicted vs actual
    const pts = [predicted * 0.85, predicted * 0.9, predicted, predicted * 1.02, actual].map((v, i) => ({
        x: i * 25, y: 50 - (v / 100) * 40
    }));
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const isUp = actual >= predicted;
    return (
        <svg width="100" height="30" viewBox="0 0 100 50" className="opacity-60">
            <path d={path} fill="none" stroke={isUp ? "#34d399" : "#f87171"} strokeWidth="2" strokeLinecap="round" />
            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={isUp ? "#34d399" : "#f87171"} />
        </svg>
    );
}

export default function ScoreWagerCard({ wager, onResolved }) {
    const [showResolve, setShowResolve] = useState(false);
    const [actualScore, setActualScore] = useState(wager.predicted_score);
    const [resolving, setResolving] = useState(false);
    const { toast } = useToast();

    const isLocked = wager.wager_locked || (wager.due_date && isPast(parseISO(wager.due_date)));
    const isResolved = wager.status === 'resolved';
    const daysLeft = wager.due_date ? differenceInDays(parseISO(wager.due_date), new Date()) : null;
    const urgent = daysLeft != null && daysLeft <= 3 && !isResolved;

    const handleResolve = async () => {
        setResolving(true);
        try {
            const res = await resolveScoreWager({ wager_id: wager.id, actual_score: actualScore });
            toast({
                title: res.data.message,
                variant: res.data.xp_outcome > 0 ? "default" : "destructive"
            });
            setShowResolve(false);
            onResolved?.();
        } catch (e) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setResolving(false);
        }
    };

    const diff = Math.abs(actualScore - wager.predicted_score);
    const previewAccuracy = diff <= 3 ? 'exact' : diff <= 10 ? 'close' : 'wrong';
    const previewXP = previewAccuracy === 'exact'
        ? wager.wagered_xp * 3
        : previewAccuracy === 'close'
        ? Math.round(wager.wagered_xp * 1.5)
        : -wager.wagered_xp;

    const resolvedAccuracy = wager.accuracy ? ACCURACY_CONFIG[wager.accuracy] : null;
    const maxWin = wager.wagered_xp * 3;
    const potentialPercent = Math.round((maxWin / Math.max(wager.wagered_xp, 1)) * 100);

    return (
        <>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={`border bg-gray-900/80 backdrop-blur-sm overflow-hidden ${
                    isResolved
                        ? wager.xp_outcome > 0 ? "border-emerald-500/30" : "border-red-500/30"
                        : urgent ? "border-amber-500/40" : "border-gray-700/60"
                }`}>
                    {/* Header bar */}
                    <div className={`h-1 ${isResolved
                        ? wager.xp_outcome > 0 ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-red-500 to-rose-500"
                        : urgent ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-indigo-500 to-purple-500"
                    }`} />
                    <CardContent className="p-4 space-y-3">
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-white text-sm truncate">{wager.assessment_title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{wager.subject_name} · {wager.assessment_type}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isResolved && wager.accuracy && (
                                    <Badge className={`text-xs border ${ACCURACY_CONFIG[wager.accuracy].badge}`}>
                                        {ACCURACY_CONFIG[wager.accuracy].icon} {ACCURACY_CONFIG[wager.accuracy].label}
                                    </Badge>
                                )}
                                {!isResolved && isLocked && (
                                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                                        <Clock className="w-3 h-3 mr-1" />Due
                                    </Badge>
                                )}
                                {!isResolved && !isLocked && daysLeft != null && (
                                    <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">
                                        <Activity className="w-3 h-3 mr-1" />
                                        {daysLeft}d left
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Stock-market style metrics */}
                        <div className="grid grid-cols-3 gap-2">
                            {/* Predicted (like "entry price") */}
                            <div className="bg-gray-800/60 rounded-lg p-2.5 text-center">
                                <p className="text-xs text-gray-500 mb-0.5">Entry</p>
                                <p className="text-xl font-black text-white">{wager.predicted_score}%</p>
                            </div>
                            {/* Stake */}
                            <div className="bg-gray-800/60 rounded-lg p-2.5 text-center">
                                <p className="text-xs text-gray-500 mb-0.5">Stake</p>
                                <p className="text-xl font-black text-amber-400 flex items-center justify-center gap-0.5">
                                    <Zap className="w-3.5 h-3.5" />{wager.wagered_xp}
                                </p>
                            </div>
                            {/* P&L or max win */}
                            <div className={`rounded-lg p-2.5 text-center ${
                                isResolved
                                    ? wager.xp_outcome > 0 ? "bg-emerald-500/10" : "bg-red-500/10"
                                    : "bg-gray-800/60"
                            }`}>
                                {isResolved ? (
                                    <>
                                        <p className="text-xs text-gray-500 mb-0.5">P&L</p>
                                        <p className={`text-xl font-black flex items-center justify-center gap-0.5 ${wager.xp_outcome > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                            {wager.xp_outcome > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                            {Math.abs(wager.xp_outcome)}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-xs text-gray-500 mb-0.5">Max Win</p>
                                        <p className="text-xl font-black text-emerald-400">+{maxWin}</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Resolved: actual vs predicted with sparkline */}
                        {isResolved && wager.actual_score !== undefined && (
                            <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${ACCURACY_CONFIG[wager.accuracy || 'wrong'].bg}`}>
                                <div className="flex items-center gap-3">
                                    <MiniSparkline predicted={wager.predicted_score} actual={wager.actual_score} />
                                    <div>
                                        <p className="text-xs text-gray-400">Actual vs Predicted</p>
                                        <p className="font-black text-white">
                                            {wager.actual_score}%
                                            <span className="text-xs text-gray-500 ml-2">vs {wager.predicted_score}% entry</span>
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xl">{ACCURACY_CONFIG[wager.accuracy || 'wrong'].icon}</span>
                            </div>
                        )}

                        {/* Potential return bar for active */}
                        {!isResolved && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Potential return</span>
                                    <span className="text-emerald-400 font-semibold">+{maxWin} XP (3× if exact)</span>
                                </div>
                                <div className="h-1 rounded-full bg-gray-700">
                                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 w-[70%]" />
                                </div>
                            </div>
                        )}

                        {!isResolved && isLocked && (
                            <Button onClick={() => setShowResolve(true)}
                                className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold"
                                size="sm">
                                <BarChart2 className="w-4 h-4 mr-2" /> Settle Position
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* Resolve dialog — stock settle UI */}
            <Dialog open={showResolve} onOpenChange={setShowResolve}>
                <DialogContent className="max-w-sm bg-gray-900 border border-gray-700 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <BarChart2 className="w-5 h-5 text-amber-400" />
                            Settle Wager
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5">
                        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-center">
                            <p className="text-xs text-gray-400 mb-1">{wager.assessment_title}</p>
                            <p className="text-sm text-gray-300">Entry: <span className="font-black text-xl text-white">{wager.predicted_score}%</span></p>
                            <p className="text-xs text-gray-500 mt-1">Staked: {wager.wagered_xp} XP</p>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-3">
                                <label className="font-semibold text-gray-300">Actual Score</label>
                                <span className="font-black text-white text-xl">{actualScore}%</span>
                            </div>
                            <Slider
                                value={[actualScore]}
                                onValueChange={([v]) => setActualScore(v)}
                                min={0} max={100} step={1}
                                className="mb-3"
                            />
                            <div className="flex gap-1.5">
                                {[0, 25, 50, 60, 70, 80, 90, 100].map(v => (
                                    <button key={v} onClick={() => setActualScore(v)}
                                        className={`flex-1 text-xs py-1.5 rounded font-semibold border transition-all ${
                                            actualScore === v ? 'bg-amber-600 text-white border-amber-600' : 'border-gray-600 text-gray-400 hover:border-gray-400'
                                        }`}>{v}</button>
                                ))}
                            </div>
                        </div>

                        {/* Live P&L preview */}
                        <div className={`rounded-xl p-4 border-2 text-center transition-all ${
                            previewAccuracy === 'exact' ? 'border-emerald-500/50 bg-emerald-500/10' :
                            previewAccuracy === 'close' ? 'border-blue-500/50 bg-blue-500/10' :
                            'border-red-500/50 bg-red-500/10'
                        }`}>
                            <p className="text-3xl mb-1">{previewAccuracy === 'exact' ? '🎯' : previewAccuracy === 'close' ? '✅' : '❌'}</p>
                            <p className={`font-black text-2xl ${previewXP > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {previewXP > 0 ? `+${previewXP}` : previewXP} XP
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {previewAccuracy === 'exact' ? '🎯 Within 3% — 3× multiplier!' :
                                 previewAccuracy === 'close' ? '✅ Within 10% — 1.5× return' :
                                 '❌ Outside 10% — full stake lost'}
                            </p>
                        </div>

                        <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-800/40 rounded-lg p-3">
                            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <span>Enter your genuine score. This settlement is permanent and cannot be reversed.</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowResolve(false)} className="border-gray-600 text-gray-300">Cancel</Button>
                        <Button onClick={handleResolve} disabled={resolving}
                            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500">
                            {resolving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BarChart2 className="w-4 h-4 mr-2" />}
                            {resolving ? 'Settling...' : 'Confirm Settlement'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}