/**
 * CalloutBacking — take a position on somebody else's call-out.
 *
 * ─── Why this is the best-shaped question on the page ───────────────────────
 * Every other forecast is a student predicting their OWN behaviour, which
 * means every other forecast is partly under their control. This one is not.
 * The spectator has no lever, only a judgement — so the payout is pure
 * calibration, and it is the first thing on Compete that gives you a stake in
 * a drama that is not yours.
 *
 * It also does the one thing the feed could not do alone: it makes watching
 * somebody else's call-out matter to you. That is what turns a timeline into
 * an event people stay for.
 *
 * ─── The two people who decide it may not back it ───────────────────────────
 * The target decides it by how hard they try, the caller by whom they picked.
 * Either taking a position is the cannot-lose shape the whole wagering layer
 * was torn out for. `placeForecast` refuses both on the server; this component
 * simply is not rendered for them, because an offer the server will refuse is
 * a broken button.
 *
 * ─── The base rate is the TARGET'S record ───────────────────────────────────
 * How often that person has answered a call-out before, from their own
 * history. Under `MIN_OBS` it is a labelled prior and says so — "we haven't
 * seen enough of their record yet" — rather than printing "100%, from their
 * last 1" at somebody about to stake XP on it.
 */
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { Loader2, Check } from "lucide-react";
import OddsDots, { oddsPhrase } from "@/components/competition/OddsDots";
import Odometer from "@/components/competition/Odometer";
import { baseRateFor, payoutFor, MIN_OBS } from "@/lib/forecast";

const STAKES = [10, 25, 50];

export default function CalloutBacking({ callout, ctx = {}, onPlaced }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [p, setP] = useState(0.6);
    const [stake, setStake] = useState(25);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    // Only this target's finished call-outs are evidence. A pending one tells
    // us nothing and must not dilute the rate toward the prior.
    const base = useMemo(() => baseRateFor(
        { kind: "callout" },
        { targetHistory: (ctx.calloutHistory || []).filter((c) => c.target_email === callout?.target_email) },
    ), [ctx.calloutHistory, callout?.target_email]);

    const ifRight = payoutFor(stake, p, base.p, true);
    const ifWrong = payoutFor(stake, p, base.p, false);
    const thin = base.n < MIN_OBS;

    const place = async () => {
        setBusy(true);
        try {
            const res = await base44.functions.invoke("placeForecast", {
                kind: "callout", callout_id: callout.id, p, base: base.p, stake,
            });
            const data = res?.data ?? res;
            if (data?.error) throw new Error(data.error);
            setDone(true);
            setOpen(false);
            toast({ variant: "success", title: "You're on it", description: `${stake} XP held until it settles.` });
            onPlaced?.();
        } catch (e) {
            toast({ title: "Couldn't place that", description: e.message, variant: "destructive" });
        } finally {
            setBusy(false);
        }
    };

    if (done) {
        return (
            <p className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                <Check className="w-3.5 h-3.5" /> You've backed this one at {Math.round(p * 100)}%
            </p>
        );
    }

    if (!open) {
        return (
            <button type="button" onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-chart-3/40 bg-chart-3/10
                    px-3 py-1 text-xs font-extrabold text-chart-3 hover:bg-chart-3/15 transition-colors">
                Call it — do they pass?
            </button>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className="rounded-xl border border-border bg-secondary/40 p-3 space-y-3 overflow-hidden">
            <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-foreground">
                    {callout.target_name?.split(" ")[0] || "They"} pass this?
                </p>
                <span className="text-xs font-black tabular-nums text-chart-3">{Math.round(p * 100)}%</span>
            </div>

            {/* A probability is the most abstract thing on this page, so it is
                drawn as a COUNT — and the dots the base rate would have filled
                are ringed, which makes the disagreement itself countable. Those
                rings are exactly what the scoring rule pays on. */}
            <OddsDots value={p} base={base.p} size="sm" />
            <p className="text-[11px] text-muted-foreground">{oddsPhrase(p)}</p>

            <input type="range" min="5" max="95" step="5" value={Math.round(p * 100)}
                onChange={(e) => setP(Number(e.target.value) / 100)}
                aria-label="How likely are they to pass"
                className="w-full accent-chart-3" />

            <div className="flex items-center gap-1.5">
                {STAKES.map((s) => (
                    <button key={s} type="button" onClick={() => setStake(s)}
                        className={`flex-1 rounded-lg py-1 text-xs font-extrabold border-2 transition-colors
                            ${stake === s ? "border-chart-3 bg-chart-3/10 text-chart-3"
                                : "border-border bg-surface text-muted-foreground"}`}>
                        {s}
                    </button>
                ))}
            </div>

            {/* Rolled, not swapped: on this dial the numbers ARE the feedback,
                and the trade-off is visible as motion rather than reconstructed
                from two remembered states. Coloured by SIGN, never by which
                side of the row it sits on. */}
            <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-muted-foreground">
                    Right{" "}
                    <span className={ifRight >= 0 ? "text-primary" : "text-streak"}>
                        <Odometer value={ifRight} format={(n) => `${n > 0 ? "+" : ""}${n}`} />
                    </span>
                </span>
                <span className="text-muted-foreground">
                    Wrong{" "}
                    <span className={ifWrong >= 0 ? "text-primary" : "text-streak"}>
                        <Odometer value={ifWrong} format={(n) => `${n > 0 ? "+" : ""}${n}`} />
                    </span>
                </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-snug">
                {thin
                    ? "We haven't seen enough of their call-out record yet, so the price starts at a guess."
                    : `They've answered ${Math.round(base.p * 100)}% of their last ${base.n}.`}
                {" "}Agreeing with that pays nothing — you only gain by knowing something it doesn't.
            </p>

            <div className="flex items-center gap-2">
                <Button size="sm" onClick={place} disabled={busy}
                    className="flex-1 bg-chart-3 hover:bg-chart-3/90 text-white font-extrabold rounded-xl">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `Back it — ${stake} XP`}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">
                    Later
                </Button>
            </div>
        </motion.div>
    );
}
