/**
 * ForecastPanel — call your own study, and find out how good your calls are.
 *
 * ─── What this replaces ─────────────────────────────────────────────────────
 * `ScorePredictionBetting`: you set a line on yourself, friends "bet" on it at
 * a flat 1.8×, and you settled it by typing your own result into a form
 * pre-filled with your own prediction. Nothing in it could be wrong, and no
 * price in it carried any information.
 *
 * ─── The three things on this screen ────────────────────────────────────────
 *   THE HOUSE'S NUMBER.  Every question opens with a base rate measured from
 *                        this student's own history, and the panel says how
 *                        many observations it is built on. A rate off two days
 *                        is a prior and is labelled one.
 *   YOUR NUMBER.         Drag to disagree. The payout preview updates live and
 *                        reads ZERO while you sit on the base rate, which is
 *                        the honest thing to show: repeating the app's own
 *                        number back at it is not a forecast.
 *   YOUR RECORD.         Calibration — of the calls you made at 70%, how many
 *                        happened. This is the part worth coming back for, and
 *                        the part a payout number can never tell you.
 */
import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { Loader2, TrendingUp, Check, X, Clock } from "lucide-react";
import OddsDots, { oddsPhrase } from "@/components/competition/OddsDots";
import Odometer from "@/components/competition/Odometer";
import {
    KINDS, PAYING_KINDS, baseRateFor, forecastBoard, payoutFor, clampP,
    CALIBRATION_MIN,
} from "@/lib/forecast";

const STAKES = [25, 50, 100, 200];

/** Inside a day of settling. Used only to draw attention, never to decide. */
const closingSoon = (r) => {
    const t = new Date(r?.forecast?.deadline || 0).getTime();
    return Number.isFinite(t) && t - Date.now() < 24 * 3600 * 1000;
};
const pct = (p) => `${Math.round(clampP(p) * 100)}%`;

/** Deadline options per kind, in days. Kept short: a call you cannot remember
 *  making is not one you learn anything from settling. */
const HORIZON = { streak: 7, minutes: 7, quiz: 14, sac: 21 };

const inDays = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
};

// ─── The probability dial ───────────────────────────────────────────────────

/**
 * A track from 0 to 100 with the house's number marked on it.
 *
 * The base-rate mark is the whole point of the control: without it a student
 * has no idea what they are disagreeing with, and a forecast that is not a
 * disagreement is worth nothing. Same pointer-capture and keyboard handling as
 * ScoreCurve, for the same reasons written up there.
 */
function ProbDial({ value, base, tone = "hsl(var(--primary))", onChange }) {
    const ref = useRef(null);
    const [dragging, setDragging] = useState(false);

    const at = (clientX) => {
        const box = ref.current?.getBoundingClientRect();
        if (!box?.width) return null;
        return clampP((clientX - box.left) / box.width);
    };

    return (
        <div
            ref={ref}
            role="slider"
            tabIndex={0}
            aria-label="How likely do you think this is"
            aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(value * 100)}
            aria-valuetext={`${pct(value)}, against a base rate of ${pct(base)}`}
            className={`relative h-9 rounded-xl bg-secondary select-none touch-none
                ${dragging ? "cursor-grabbing" : "cursor-grab"}
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-ring`}
            onPointerDown={(e) => {
                e.preventDefault();
                const n = at(e.clientX);
                if (n == null) return;
                setDragging(true);
                try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* gone */ }
                onChange(n);
            }}
            onPointerMove={(e) => { if (dragging) { const n = at(e.clientX); if (n != null) onChange(n); } }}
            onPointerUp={(e) => {
                setDragging(false);
                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* gone */ }
            }}
            onKeyDown={(e) => {
                const step = e.shiftKey ? 0.1 : 0.01;
                if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(clampP(value + step)); }
                if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(clampP(value - step)); }
            }}
        >
            <motion.span className="absolute inset-y-0 left-0 rounded-xl"
                style={{ background: tone, opacity: 0.25 }}
                initial={false} animate={{ width: `${clampP(value) * 100}%` }}
                transition={dragging ? { duration: 0 } : { duration: 0.25 }} />

            {/* The house. Dotted so it cannot be mistaken for the handle. */}
            <span aria-hidden="true"
                className="absolute inset-y-1 w-px border-l-2 border-dashed border-foreground/40"
                style={{ left: `${clampP(base) * 100}%` }} />

            <motion.span aria-hidden="true"
                className="absolute top-1/2 w-4 h-4 -mt-2 -ml-2 rounded-full border-2 border-surface shadow"
                style={{ background: tone }}
                initial={false} animate={{ left: `${clampP(value) * 100}%` }}
                transition={dragging ? { duration: 0 } : { duration: 0.25 }} />

            {/* Right-aligned rather than centred: the handle passes through the
                middle of the track, and a number under it is unreadable at
                exactly the value people park on most. */}
            <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none
                font-display font-extrabold text-sm text-foreground tabular-nums">
                {pct(value)}
            </span>
        </div>
    );
}

// ─── Making a call ──────────────────────────────────────────────────────────

function Composer({ ctx, onPlaced }) {
    const { toast } = useToast();
    const [kindKey, setKindKey] = useState("streak");
    const [threshold, setThreshold] = useState(150);
    const [stake, setStake] = useState(50);
    const [p, setP] = useState(0.5);
    const [saving, setSaving] = useState(false);
    const kind = KINDS[kindKey];

    const draft = useMemo(() => ({
        kind: kindKey,
        threshold: kindKey === "minutes" ? threshold : 70,
        deadline: inDays(HORIZON[kindKey] || 7),
        created_at: new Date().toISOString(),
        quiz_id: ctx.quiz?.id || null,
        subject: ctx.quiz?.subject || null,
    }), [kindKey, threshold, ctx.quiz]);

    const base = useMemo(() => baseRateFor(draft, ctx), [draft, ctx]);

    // What it pays if you are right, and what it costs if you are not. Both
    // shown, always: a screen that leads with the upside and hides the
    // downside is the thing this rework exists to stop being.
    const ifRight = payoutFor(stake, p, base.p, true);
    const ifWrong = payoutFor(stake, p, base.p, false);
    const agreeing = Math.abs(p - base.p) < 0.005;

    const place = async () => {
        setSaving(true);
        try {
            await base44.functions.invoke("placeForecast", {
                kind: kindKey, p, base: base.p, stake,
                deadline: draft.deadline, threshold: draft.threshold,
                quiz_id: draft.quiz_id, subject: draft.subject,
            });
            toast({ title: "Call placed", description: `${pct(p)} on ${kind.question(draft)}` });
            onPlaced?.();
        } catch (err) {
            toast({ variant: "destructive", title: "Could not place that",
                description: err?.message || "Try again in a moment." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="card-soft on-table p-5">
            <p className="stat-label mb-3">Make a call</p>

            <div className="flex flex-wrap gap-1.5 mb-4">
                {PAYING_KINDS.map((k) => (
                    <button key={k.key} onClick={() => setKindKey(k.key)}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                            kindKey === k.key
                                ? "bg-foreground text-background"
                                : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                        {k.label}
                    </button>
                ))}
            </div>

            <p className="font-display font-extrabold text-foreground text-lg leading-tight mb-1">
                {kind.question(draft)}
            </p>

            {kindKey === "minutes" && (
                <div className="flex items-center gap-2 mb-3">
                    {[90, 150, 240, 360].map((m) => (
                        <button key={m} onClick={() => setThreshold(m)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tabular-nums ${
                                threshold === m ? "bg-primary/15 text-primary"
                                    : "bg-secondary text-muted-foreground"}`}>
                            {m}m
                        </button>
                    ))}
                </div>
            )}

            {/* The house's number, with the evidence behind it. A rate off two
                observations and one off forty are different claims. */}
            <p className="text-[12px] text-muted-foreground mb-2">
                Usually <span className="font-bold text-foreground">{pct(base.p)}</span>
                {base.source === "you"
                    ? ` — from your last ${base.n}`
                    : " — we haven't seen enough of your history yet, so that's a starting guess"}
            </p>

            <ProbDial value={p} base={base.p} onChange={setP} />

            {/* The dots are the point of this screen. A percentage is abstract;
                "7 times in 10" is a count, and the ringed dots are exactly the
                disagreement with the house that is being scored. */}
            <div className="flex items-center gap-3 mt-3">
                <OddsDots value={p} base={base.p} />
                <span className="text-[12px] text-muted-foreground">
                    you're saying <span className="font-bold text-foreground">{oddsPhrase(p)}</span>
                </span>
            </div>

            <div className="flex items-center gap-2 mt-4">
                <span className="text-[11px] text-muted-foreground">Stake</span>
                {STAKES.map((s) => (
                    <button key={s} onClick={() => setStake(s)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tabular-nums ${
                            stake === s ? "bg-xp/15 text-xp" : "bg-secondary text-muted-foreground"}`}>
                        {s}
                    </button>
                ))}
            </div>

            {/* Coloured by the SIGN of each number, never by which side of the
                row it sits on. Below the base rate the two swap over — you are
                betting against a likely thing — and hard-coding green on the
                left printed a loss of 5 XP in the colour of a win. */}
            <div className="flex items-baseline gap-4 mt-3 text-[12px] tabular-nums">
                <span className={`font-bold ${ifRight >= 0 ? "text-primary" : "text-streak"}`}>
                    <Odometer value={ifRight} format={(n) => `${n > 0 ? "+" : ""}${n}`} />
                    {" "}if it happens
                </span>
                <span className={`font-bold ${ifWrong >= 0 ? "text-primary" : "text-streak"}`}>
                    <Odometer value={ifWrong} format={(n) => `${n > 0 ? "+" : ""}${n}`} />
                    {" "}if it doesn't
                </span>
            </div>

            {/* Said plainly rather than hidden behind a disabled button: sitting
                on the base rate is a legitimate thing to think, it just isn't
                a forecast and must not pay. */}
            {agreeing && (
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    That's exactly what we'd have guessed, so there's nothing riding on it.
                    Move the dial if you think you know better.
                </p>
            )}

            <Button onClick={place} disabled={saving || agreeing} className="w-full mt-4 gap-1.5">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Placing…</>
                    : <>Place {stake} XP</>}
            </Button>
        </div>
    );
}

// ─── Your record ────────────────────────────────────────────────────────────

/**
 * The reliability curve: what you SAID against what HAPPENED.
 *
 * A band you have never made a call in is drawn as absent rather than as a
 * zero — see `calibration` for why a 0% hit rate and no data are different
 * claims, and why drawing them the same puts a hole in the curve.
 */
function Reliability({ cal, tone = "hsl(var(--primary))" }) {
    if (!cal.enough) {
        return (
            <p className="text-[12px] text-muted-foreground leading-relaxed">
                {cal.n === 0
                    ? "No settled calls yet. Make a few and this becomes a read on how well you know yourself."
                    : `${CALIBRATION_MIN - cal.n} more settled call${CALIBRATION_MIN - cal.n === 1 ? "" : "s"} and we can score how calibrated you are.`}
            </p>
        );
    }
    return (
        <div>
            {/* `items-stretch`, NOT `items-end`. On a row, `items-end` sizes
                the columns to their content in the cross axis, so the track
                each bar is measured against had no height and every percentage
                resolved against zero — the chart rendered completely blank. */}
            <div className="flex items-stretch gap-1.5 h-20">
                {cal.buckets.map((b) => (
                    <div key={b.lo} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex-1 flex items-end">
                            {b.happened == null ? (
                                <div className="w-full h-px bg-border" title="no calls in this band" />
                            ) : (
                                /* `initial` is "0%", not 0: framer cannot walk
                                   from a unitless number to a percentage, so
                                   the bars sat at zero height and the whole
                                   chart rendered blank. */
                                <motion.div className="w-full rounded-t"
                                    style={{ background: tone }}
                                    initial={{ height: "0%" }}
                                    animate={{ height: `${Math.max(3, b.happened * 100)}%` }}
                                    transition={{ duration: 0.5 }} />
                            )}
                        </div>
                        <span className="text-[9px] text-muted-foreground tabular-nums">
                            {Math.round(b.lo * 100)}
                        </span>
                    </div>
                ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                What you said, against what happened. Bars matching their label means
                you know your own odds.
            </p>
        </div>
    );
}

// ─── The panel ──────────────────────────────────────────────────────────────

export default function ForecastPanel({ forecasts = [], ctx = {}, onChanged }) {
    const board = useMemo(() => forecastBoard(forecasts, ctx), [forecasts, ctx]);
    const { toast } = useToast();
    const [settling, setSettling] = useState(null);

    const settle = async (row) => {
        setSettling(row.forecast.id);
        try {
            const out = await base44.functions.invoke("settleForecast",
                { forecast_id: row.forecast.id });
            if (out?.data?.open || out?.open) {
                toast({ title: "Not decided yet", description: "Give it until the deadline." });
            } else {
                onChanged?.();
            }
        } catch (err) {
            toast({ variant: "destructive", title: "Could not settle that",
                description: err?.message || "Try again in a moment." });
        } finally {
            setSettling(null);
        }
    };

    return (
        <div className="space-y-4">
            <Composer ctx={ctx} onPlaced={onChanged} />

            {/* Open calls. Settlement is a server call that recomputes the
                outcome from study rows — the button asks, it does not tell. */}
            {board.open.length > 0 && (
                <div className="card-soft on-table p-5">
                    <p className="stat-label mb-3">Open calls</p>
                    <ul className="space-y-2.5">
                        {board.open.map((r) => (
                            <li key={r.forecast.id} className="flex items-center gap-3">
                                {/* A call inside a day of its deadline pulses.
                                    It is the one thing on the page about to be
                                    decided, and it is otherwise indistinguishable
                                    from a call with a fortnight left. */}
                                <span className="relative flex-shrink-0">
                                    {closingSoon(r) && (
                                        <motion.span
                                            className="absolute inset-0 rounded-full bg-xp/40"
                                            animate={{ scale: [1, 1.9], opacity: [0.6, 0] }}
                                            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }} />
                                    )}
                                    <Clock className={`relative w-4 h-4 ${
                                        closingSoon(r) ? "text-xp" : "text-muted-foreground"}`} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-bold text-foreground leading-snug">
                                        {r.question}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <OddsDots value={r.p} base={r.base.p} size="sm" animate={false} />
                                        <span className="text-[11px] text-muted-foreground tabular-nums">
                                            {pct(r.p)} vs {pct(r.base.p)} · {r.forecast.stake || r.forecast.wagered_xp || 0} XP in
                                            {closingSoon(r) ? " · closing" : ""}
                                        </span>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" className="flex-shrink-0"
                                    disabled={settling === r.forecast.id}
                                    onClick={() => settle(r)}>
                                    {settling === r.forecast.id
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Check"}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="card-soft on-table p-5">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                    <p className="stat-label">Your calls</p>
                    {board.calibration.enough && (
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                            {board.calibration.n} settled ·{" "}
                            <span className={board.calibration.skillScore >= 0
                                ? "font-bold text-primary" : "font-bold text-streak"}>
                                {board.calibration.skillScore >= 0 ? "+" : ""}
                                {board.calibration.skillScore}
                            </span>{" "}
                            on the house
                        </p>
                    )}
                </div>
                <Reliability cal={board.calibration} />

                {board.settled.length > 0 && (
                    <ul className="mt-4 pt-4 border-t border-border/70 space-y-2">
                        {board.settled.slice(0, 6).map((r, i) => (
                            /* The settlement reveal. A call resolving is the
                               payoff of the whole loop and it used to just
                               appear — the verdict stamps in with a spring,
                               the XP counts up from zero, and the rows land in
                               sequence so a batch reads as results coming in
                               rather than a list rendering. */
                            <motion.li key={r.forecast.id}
                                className="flex items-center gap-2.5 text-[12px]"
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.05 + i * 0.06, duration: 0.3 }}>
                                <motion.span className="flex-shrink-0"
                                    initial={{ scale: 0.4, rotate: -20 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ delay: 0.12 + i * 0.06,
                                        type: "spring", stiffness: 500, damping: 18 }}>
                                    {r.outcome
                                        ? <Check className="w-3.5 h-3.5 text-primary" />
                                        : <X className="w-3.5 h-3.5 text-streak" />}
                                </motion.span>
                                <span className="min-w-0 flex-1 truncate text-foreground">{r.question}</span>
                                <span className="text-muted-foreground tabular-nums flex-shrink-0">
                                    said {pct(r.p)}
                                </span>
                                {r.kind.pays && (
                                    <span className={`font-bold flex-shrink-0 ${
                                        r.xp >= 0 ? "text-primary" : "text-streak"}`}>
                                        <Odometer value={r.xp}
                                            format={(n) => `${n >= 0 ? "+" : ""}${n}`} />
                                    </span>
                                )}
                            </motion.li>
                        ))}
                    </ul>
                )}

                {board.settled.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {board.netXp >= 0 ? "+" : ""}{board.netXp} XP from forecasting so far
                    </p>
                )}
            </div>
        </div>
    );
}
