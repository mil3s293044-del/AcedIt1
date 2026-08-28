/**
 * CreateDuelDialog — challenge a rival: pick friend → yardstick → window →
 * ante, with a bet-slip summary before sending. Escrow happens server-side.
 */
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Swords, Zap, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { METRICS, WINDOWS, ANTE_OPTIONS, firstName } from "./arenaMeta";

export default function CreateDuelDialog({ open, onOpenChange, currentUser, balance, onCreated }) {
    const { toast } = useToast();
    const [friends, setFriends] = useState([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [rival, setRival] = useState(null);
    const [metric, setMetric] = useState("xp");
    const [windowHours, setWindowHours] = useState(24);
    const [ante, setAnte] = useState(50);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!open || !currentUser?.email) return;
        setLoadingFriends(true);
        Promise.all([
            base44.entities.Friendship.filter({ requester_email: currentUser.email, status: 'accepted' }).catch(() => []),
            base44.entities.Friendship.filter({ recipient_email: currentUser.email, status: 'accepted' }).catch(() => []),
        ]).then(([asReq, asRec]) => {
            const list = [
                ...(asReq || []).map(f => ({ email: f.recipient_email, name: f.recipient_name || f.recipient_email })),
                ...(asRec || []).map(f => ({ email: f.requester_email, name: f.requester_name || f.requester_email })),
            ];
            const seen = new Set();
            setFriends(list.filter(f => !seen.has(f.email) && seen.add(f.email)));
        }).finally(() => setLoadingFriends(false));
    }, [open, currentUser?.email]);

    const send = async () => {
        if (!rival) return;
        setSending(true);
        try {
            await base44.functions.invoke('createDuel', {
                opponent_email: rival.email,
                opponent_name: rival.name,
                challenger_name: currentUser?.display_name || currentUser?.full_name || currentUser?.email,
                metric,
                window_hours: windowHours,
                ante_xp: ante,
            });
            toast({ title: "Challenge sent!", description: `${firstName(rival.name)} has 48h to accept. Your ${ante} XP ante is in the pot.` });
            onOpenChange(false);
            setRival(null);
            onCreated?.();
        } catch (e) {
            toast({ title: "Challenge not sent", description: e.message, variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    const winLabel = WINDOWS.find(w => w.hours === windowHours)?.label;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-display">
                        <Swords className="w-5 h-5 text-chart-4" /> Challenge a rival
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Rival */}
                    <div>
                        <p className="stat-label mb-2">Who are you calling out?</p>
                        {loadingFriends ? (
                            <div className="h-10 bg-secondary/50 rounded-xl animate-pulse" />
                        ) : friends.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">Add a friend first — duels need a rival.</p>
                        ) : (
                            <div className="flex gap-2 flex-wrap">
                                {friends.map(f => (
                                    <button key={f.email} onClick={() => setRival(f)}
                                        className={`px-3.5 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                                            rival?.email === f.email ? "bg-chart-4 border-chart-4 text-white shadow-soft" : "bg-surface border-border text-foreground hover:border-chart-4/40"
                                        }`}>
                                        {firstName(f.name)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Yardstick */}
                    <div>
                        <p className="stat-label mb-2">Fight over</p>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(METRICS).map(([key, m]) => {
                                const Icon = m.icon;
                                return (
                                    <button key={key} onClick={() => setMetric(key)}
                                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all text-left ${
                                            metric === key ? "bg-foreground border-foreground text-background" : "bg-surface border-border text-foreground hover:border-muted-foreground"
                                        }`}>
                                        <Icon className="w-4 h-4 flex-shrink-0" /> {m.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Window */}
                    <div>
                        <p className="stat-label mb-2">Duel length</p>
                        <div className="grid grid-cols-3 gap-2">
                            {WINDOWS.map(w => (
                                <button key={w.hours} onClick={() => setWindowHours(w.hours)}
                                    className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                        windowHours === w.hours ? "bg-foreground border-foreground text-background" : "bg-surface border-border text-foreground hover:border-muted-foreground"
                                    }`}>{w.label}</button>
                            ))}
                        </div>
                    </div>

                    {/* Ante */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="stat-label">Ante (each)</p>
                            {balance != null && (
                                <p className="text-xs font-bold text-xp flex items-center gap-1">
                                    <Zap className="w-3 h-3" /> {balance.toLocaleString()} XP available
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {ANTE_OPTIONS.map(amt => {
                                const unaffordable = balance != null && amt > balance;
                                return (
                                    <button key={amt} onClick={() => setAnte(amt)} disabled={unaffordable}
                                        className={`px-3.5 py-2 rounded-xl text-sm font-bold border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                            ante === amt ? "bg-chart-3 border-chart-3 text-white shadow-soft" : "bg-surface border-border text-foreground hover:border-chart-3/40"
                                        }`}>{amt} XP</button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Slip */}
                    <div className="bg-chart-4/5 border-2 border-chart-4/20 rounded-2xl p-3.5">
                        <p className="text-sm font-black text-foreground">
 {rival ? firstName(rival.name) : "Your rival"} · {METRICS[metric].label} · {winLabel}
                        </p>
                        <div className="flex justify-between text-xs font-semibold mt-1">
                            <span className="text-primary">Win: take the {ante * 2} XP pot</span>
                            <span className="text-streak">Lose: your {ante} XP ante</span>
                        </div>
                    </div>

                    <Button onClick={send} disabled={!rival || sending || (balance != null && ante > balance)}
                        className="w-full bg-chart-4 hover:bg-chart-4/90 text-white font-bold rounded-xl py-5 btn-3d">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Swords className="w-4 h-4 mr-2" />}
                        Send challenge
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
