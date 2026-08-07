/**
 * CalloutPanel — the accusation side of a call-out, inside a battle.
 *
 * Every metric a battle can be fought over measures effort, and effort is
 * farmable: flip a hundred cards without reading them and you outscore someone
 * who actually learned the topic. This is the lever a rival can pull when they
 * think that's what's happening.
 *
 * It deliberately reads as a serious move rather than a poke — the caller is
 * staking everything they earned in the contest on being right, and the copy
 * says so before the button does anything.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Swords, Loader2, ShieldAlert, Clock, Check, X } from "lucide-react";
import { fmtDate } from "@/lib/safeDate";

const STATUS = {
    pending: { label: "Awaiting answer", cls: "bg-xp/15 text-xp", icon: Clock },
    active:  { label: "Sitting it now", cls: "bg-chart-3/15 text-chart-3", icon: Clock },
    passed:  { label: "They passed", cls: "bg-primary/15 text-primary", icon: Check },
    failed:  { label: "They failed", cls: "bg-streak/15 text-streak", icon: X },
    expired: { label: "Ignored — forfeited", cls: "bg-streak/15 text-streak", icon: X },
    voided:  { label: "Voided", cls: "bg-secondary text-muted-foreground", icon: X },
};

export default function CalloutPanel({ battle, me, rivals, callouts = [], onChanged }) {
    const { toast } = useToast();
    const [target, setTarget] = useState(null);
    const [busy, setBusy] = useState(false);

    const mine = callouts.filter(c =>
        (battle.kind === "duel" ? c.duel_id === battle.id : c.competition_id === battle.id));
    const openAgainst = (email) => mine.find(c => c.target_email === email && ["pending", "active"].includes(c.status));
    const iHaveOneOpen = mine.some(c => c.caller_email === me?.email && ["pending", "active"].includes(c.status));

    const call = async () => {
        if (!target) return;
        setBusy(true);
        try {
            const res = await base44.functions.invoke("createCallout", {
                [battle.kind === "duel" ? "duel_id" : "competition_id"]: battle.id,
                target_email: target.email,
                target_name: target.name,
                caller_name: me?.name,
            });
            const data = res?.data ?? res;
            if (data?.error) throw new Error(data.error);
            toast({
                variant: "success",
                title: `${target.name || "They"} have 24 hours`,
                description: `${data.at_stake?.yours ?? 0} XP of yours is on it. If they pass, it's theirs.`,
            });
            setTarget(null);
            onChanged?.();
        } catch (e) {
            toast({ title: "Couldn't call them out", description: e.message, variant: "destructive" });
        } finally { setBusy(false); }
    };

    return (
        <div className="card-soft p-6">
            <div className="flex items-start gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-streak/15 flex items-center justify-center flex-shrink-0">
                    <ShieldAlert className="w-4.5 h-4.5 text-streak" />
                </div>
                <div className="min-w-0">
                    <h3 className="font-display font-extrabold text-foreground">Call it out</h3>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                        Think someone's farming the metric rather than learning? Make them prove it —
                        a timed quiz from their own study in this contest. Pass and they take everything
                        you earned here. Fail and they lose everything they earned.
                    </p>
                </div>
            </div>

            {/* Live and settled call-outs in this contest */}
            {mine.length > 0 && (
                <div className="space-y-2 mb-4">
                    {mine.map(c => {
                        const s = STATUS[c.status] || STATUS.voided;
                        const iAmCaller = c.caller_email === me?.email;
                        return (
                            <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">
                                        {iAmCaller ? `You called out ${c.target_name}` : `${c.caller_name} called you out`}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {c.settle_note || `Answer by ${fmtDate(c.respond_by, "EEE h:mmaaa", "soon")}`}
                                        {c.xp_moved > 0 && ` · ${c.xp_moved} XP moved`}
                                    </p>
                                </div>
                                <span className={`pill inline-flex items-center gap-1 flex-shrink-0 ${s.cls}`}>
                                    <s.icon className="w-3 h-3" /> {s.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {iHaveOneOpen ? (
                <p className="text-xs text-muted-foreground">
                    You've got one running here. One at a time — see it through first.
                </p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {(rivals || []).map(r => {
                        const open = openAgainst(r.email);
                        return (
                            <Button key={r.email} size="sm" variant="outline" disabled={!!open}
                                onClick={() => setTarget(r)}
                                className="border-2 gap-1.5 rounded-xl disabled:opacity-40">
                                <Swords className="w-3.5 h-3.5" />
                                {open ? `${r.name} — called` : `Call out ${r.name}`}
                            </Button>
                        );
                    })}
                    {!rivals?.length && (
                        <p className="text-xs text-muted-foreground">Nobody to call out yet.</p>
                    )}
                </div>
            )}

            {/* Confirmation — this stakes real XP, so it doesn't fire on one tap */}
            <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
                <DialogContent className="max-w-sm rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="font-display flex items-center gap-2">
                            <Swords className="w-5 h-5 text-streak" /> Call out {target?.name}?
                        </DialogTitle>
                    </DialogHeader>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                        <p className="text-sm text-foreground leading-relaxed">
                            They get 24 hours to sit a timed quiz built from their own study in this contest.
                        </p>
                        <ul className="space-y-1.5 text-sm">
                            <li className="flex gap-2">
                                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">
                                    <span className="font-bold text-foreground">They fail or ignore it</span> — they
                                    lose every XP they earned in this contest.
                                </span>
                            </li>
                            <li className="flex gap-2">
                                <X className="w-4 h-4 text-streak flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">
                                    <span className="font-bold text-foreground">They pass</span> — they take every XP
                                    <em> you</em> earned in it. All of it.
                                </span>
                            </li>
                        </ul>
                        <p className="text-xs text-muted-foreground">
                            Only do this if you think they haven't actually learned it.
                        </p>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setTarget(null)} className="rounded-xl">Back off</Button>
                            <Button onClick={call} disabled={busy}
                                className="flex-1 gap-1.5 bg-streak hover:bg-streak/90 text-white btn-3d">
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                                Call them out
                            </Button>
                        </div>
                    </motion.div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
