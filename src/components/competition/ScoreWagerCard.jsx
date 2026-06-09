import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
    Zap, Clock, AlertTriangle, Loader2,
    ArrowUpRight, ArrowDownRight, BarChart2, Activity
} from "lucide-react";
import { resolveScoreWager } from "@/api/functionsShim";
import { useToast } from "@/components/ui/use-toast";
import { isPast, parseISO, differenceInDays } from "date-fns";

const ACCURACY_CONFIG = {
    exact: { bg: "bg-primary/10 border-primary/30", badge: "bg-primary/15 text-primary border-primary/30", icon: "🎯", label: "Exact Hit", multiplier: "3×" },
    close: { bg: "bg-chart-3/10 border-chart-3/30", badge: "bg-chart-3/15 text-chart-3 border-chart-3/30", icon: "✅", label: "Close", multiplier: "1.5×" },
    wrong: { bg: "bg-streak/10 border-streak/30", badge: "bg-streak/15 text-streak border-streak/30", icon: "❌", label: "Missed", multiplier: "−1×" },
};

function MiniSparkline({ predicted, actual }) {
    const pts = [predicted * 0.85, predicted * 0.9, predicted, predicted * 1.02, actual].map((v, i) => ({
        x: i * 25, y: 50 - (v / 100) * 40,
    }));
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const isUp = actual >= predicted;
    const color = isUp ? "#58CC02" : "#FF4B4B";
    return (
        <svg width="100" height="30" viewBox="0 0 100 50" className="opacity-80">
            <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={color} />
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
            toast({ title: res.data.message, variant: res.data.xp_outcome > 0 ? "default" : "destructive" });
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

    const maxWin = wager.wagered_xp * 3;

    return (
        <>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={`border-2 bg-surface overflow-hidden ${
                    isResolved
                        ? wager.xp_outcome > 0 ? "border-primary/30" : "border-streak/30"
                        : urgent ? "border-xp/40" : "border-border"
                }`}>
                    {/* Header bar */}
                    <div className={`h-1 ${isResolved
                        ? wager.xp_outcome > 0 ? "bg-primary" : "bg-streak"
                        : urgent ? "bg-xp" : "bg-gradient-to-r from-chart-4 to-chart-3"
                    }`} />
                    <CardContent className="p-4 space-y-3">
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-foreground text-sm truncate">{wager.assessment_title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{wager.subject_name} · {wager.assessment_type}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isResolved && wager.accuracy && (
                                    <Badge className={`text-xs border ${ACCURACY_CONFIG[wager.accuracy].badge}`}>
                                        {ACCURACY_CONFIG[wager.accuracy].icon} {ACCURACY_CONFIG[wager.accuracy].label}
                                    </Badge>
                                )}
                                {!isResolved && isLocked && (
                                    <Badge className="bg-xp/15 text-xp border-xp/30 text-xs">
                                        <Clock className="w-3 h-3 mr-1" />Due
                                    </Badge>
                                )}
                                {!isResolved && !isLocked && daysLeft != null && (
                                    <Badge className="bg-chart-3/15 text-chart-3 border-chart-3/30 text-xs">
                                        <Activity className="w-3 h-3 mr-1" />
                                        {daysLeft}d left
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-secondary rounded-lg p-2.5 text-center">
                                <p className="text-xs text-muted-foreground mb-0.5">Entry</p>
                                <p className="text-xl font-black text-foreground">{wager.predicted_score}%</p>
                            </div>
                            <div className="bg-secondary rounded-lg p-2.5 text-center">
                                <p className="text-xs text-muted-foreground mb-0.5">Stake</p>
                                <p className="text-xl font-black text-xp flex items-center justify-center gap-0.5">
                                    <Zap className="w-3.5 h-3.5" />{wager.wagered_xp}
                                </p>
                            </div>
                            <div className={`rounded-lg p-2.5 text-center ${
                                isResolved ? (wager.xp_outcome > 0 ? "bg-primary/10" : "bg-streak/10") : "bg-secondary"
                            }`}>
                                {isResolved ? (
                                    <>
                                        <p className="text-xs text-muted-foreground mb-0.5">P&L</p>
                                        <p className={`text-xl font-black flex items-center justify-center gap-0.5 ${wager.xp_outcome > 0 ? "text-primary" : "text-streak"}`}>
                                            {wager.xp_outcome > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                            {Math.abs(wager.xp_outcome)}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-xs text-muted-foreground mb-0.5">Max Win</p>
                                        <p className="text-xl font-black text-primary">+{maxWin}</p>
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
                                        <p className="text-xs text-muted-foreground">Actual vs Predicted</p>
                                        <p className="font-black text-foreground">
                                            {wager.actual_score}%
                                            <span className="text-xs text-muted-foreground ml-2">vs {wager.predicted_score}% entry</span>
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xl">{ACCURACY_CONFIG[wager.accuracy || 'wrong'].icon}</span>
                            </div>
                        )}

                        {/* Potential return bar for active */}
                        {!isResolved && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Potential return</span>
                                    <span className="text-primary font-semibold">+{maxWin} XP (3× if exact)</span>
                                </div>
                                <div className="h-1 rounded-full bg-secondary">
                                    <div className="h-full rounded-full bg-primary w-[70%]" />
                                </div>
                            </div>
                        )}

                        {!isResolved && isLocked && (
                            <Button onClick={() => setShowResolve(true)}
                                className="w-full bg-gradient-to-r from-xp to-streak text-white font-bold"
                                size="sm">
                                <BarChart2 className="w-4 h-4 mr-2" /> Settle Position
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* Resolve dialog */}
            <Dialog open={showResolve} onOpenChange={setShowResolve}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BarChart2 className="w-5 h-5 text-xp" />
                            Settle Wager
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5">
                        <div className="bg-secondary border border-border rounded-xl p-4 text-center">
                            <p className="text-xs text-muted-foreground mb-1">{wager.assessment_title}</p>
                            <p className="text-sm text-muted-foreground">Entry: <span className="font-black text-xl text-foreground">{wager.predicted_score}%</span></p>
                            <p className="text-xs text-muted-foreground mt-1">Staked: {wager.wagered_xp} XP</p>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-3">
                                <label className="font-semibold text-foreground">Actual Score</label>
                                <span className="font-black text-foreground text-xl">{actualScore}%</span>
                            </div>
                            <Slider value={[actualScore]} onValueChange={([v]) => setActualScore(v)} min={0} max={100} step={1} className="mb-3" />
                            <div className="flex gap-1.5">
                                {[0, 25, 50, 60, 70, 80, 90, 100].map(v => (
                                    <button key={v} onClick={() => setActualScore(v)}
                                        className={`flex-1 text-xs py-1.5 rounded font-semibold border transition-all ${
                                            actualScore === v ? 'bg-xp text-white border-xp' : 'border-border text-muted-foreground hover:border-foreground/40'
                                        }`}>{v}</button>
                                ))}
                            </div>
                        </div>

                        {/* Live P&L preview */}
                        <div className={`rounded-xl p-4 border-2 text-center transition-all ${
                            previewAccuracy === 'exact' ? 'border-primary/50 bg-primary/10' :
                            previewAccuracy === 'close' ? 'border-chart-3/50 bg-chart-3/10' :
                            'border-streak/50 bg-streak/10'
                        }`}>
                            <p className="text-3xl mb-1">{previewAccuracy === 'exact' ? '🎯' : previewAccuracy === 'close' ? '✅' : '❌'}</p>
                            <p className={`font-black text-2xl ${previewXP > 0 ? 'text-primary' : 'text-streak'}`}>
                                {previewXP > 0 ? `+${previewXP}` : previewXP} XP
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {previewAccuracy === 'exact' ? '🎯 Within 3% — 3× multiplier!' :
                                 previewAccuracy === 'close' ? '✅ Within 10% — 1.5× return' :
                                 '❌ Outside 10% — full stake lost'}
                            </p>
                        </div>

                        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary rounded-lg p-3">
                            <AlertTriangle className="w-4 h-4 text-xp flex-shrink-0 mt-0.5" />
                            <span>Enter your genuine score. This settlement is permanent and cannot be reversed.</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowResolve(false)}>Cancel</Button>
                        <Button onClick={handleResolve} disabled={resolving}
                            className="bg-gradient-to-r from-xp to-streak text-white">
                            {resolving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BarChart2 className="w-4 h-4 mr-2" />}
                            {resolving ? 'Settling…' : 'Confirm Settlement'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
