/**
 * UsageMeter — your stack, and what things cost.
 *
 * ─── What this replaced ─────────────────────────────────────────────────────
 * Eight bars, one per feature, each counting down a separate daily cap, above
 * a ninth bar counting a weekly dollar ceiling nobody could see the connection
 * to. It was an honest picture of a dishonest system: the daily caps permitted
 * 4.5x what the dollar ceiling allowed, so the eight bars a student watched
 * were never the thing that actually stopped them.
 *
 * Now there is one number, because there is one limit. A thousand chips a
 * week, spent on whatever they like, and a price list so they can decide.
 *
 * ─── Why the price list is here ─────────────────────────────────────────────
 * A budget you cannot price against is not a budget, it is a countdown. The
 * moment somebody wonders whether they can afford another quiz, this panel is
 * where they already are, so the prices live in it rather than in a help page.
 * They are also stated in "what your stack buys" terms — 33 quizzes, 40 decks
 * — because that is the question being asked, not the unit price.
 */
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Crown, Layers } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import {
    FEATURES,
    FREE_LIFETIME_CAPS,
    isPremium as checkPremium,
} from "@/lib/tierAccess";
import { TIERS, tierOf } from "@/lib/aiModels";
import { stackOf, priceOf, affordable, stackWarning, saverDivisor, spendableFor, WEEKLY_CHIPS } from "@/lib/chips";

/** The price list, in the order a student is likely to care about. */
const PRICED_ROWS = [
    { feature: FEATURES.QUIZ_AI_GEN,      label: "Quiz from your notes" },
    { feature: FEATURES.FLASHCARD_AI_GEN, label: "Flashcard deck" },
    { feature: FEATURES.AI_TOOL,          label: "AI study tool" },
    { feature: FEATURES.QUIZ_AI_MARK,     label: "Quiz marking" },
    { feature: FEATURES.AI_CHAT,          label: "Tutor message" },
    { feature: FEATURES.BLURTING,         label: "Blurting mark" },
    { feature: FEATURES.ACTIVE_RECALL,    label: "Active recall check" },
    { feature: FEATURES.STUDY_COACH,      label: "Message to Ace" },
];

/** Free users only see what they can actually reach. */
const FREE_ROWS = [
    { feature: FEATURES.QUIZ_AI_GEN,      profileKey: "free_ai_quizzes_used",    label: "AI quiz generation" },
    { feature: FEATURES.QUIZ_AI_MARK,     profileKey: "free_ai_quiz_marks_used", label: "AI quiz marking" },
    { feature: FEATURES.FLASHCARD_AI_GEN, profileKey: "free_ai_flashcards_used", label: "Flashcard generation" },
];

function barColor(pct) {
    if (pct >= 100) return "bg-streak";
    if (pct >= 90)  return "bg-streak";
    if (pct >= 70)  return "bg-xp";
    return "bg-primary";
}

function Bar({ used, cap, suffix }) {
    const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
    const remaining = Math.max(0, cap - used);
    return (
        <div className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">{used} of {cap} {suffix}</span>
                <span className="font-medium text-foreground">{remaining} left</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor(pct)}`}
                    style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

/** Days and hours until the stack refills, which is Monday UTC. */
function refillCountdown() {
    const now = new Date();
    const day = now.getUTCDay();                  // Sun=0
    const daysToMonday = (8 - day) % 7 || 7;
    const next = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToMonday, 0, 0, 0));
    const diff = next - now;
    const days = Math.floor(diff / 86_400_000);
    const hrs = Math.floor((diff % 86_400_000) / 3_600_000);
    if (days > 0) return `Refills in ${days}d ${hrs}h`;
    const mins = Math.floor((diff % 3_600_000) / 60_000);
    return hrs > 0 ? `Refills in ${hrs}h ${mins}m` : `Refills in ${mins}m`;
}

export default function UsageMeter() {
    const [open, setOpen] = useState(false);
    const [profile, setProfile] = useState(null);
    const [saving, setSaving] = useState(false);
    const intervalRef = useRef(null);

    // Fetch when the popover opens, and refresh while open so the stack ticks
    // down as calls are made.
    useEffect(() => {
        if (!open) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            return;
        }
        const fetchProfile = async () => {
            try {
                const user = await base44.auth.me();
                const rows = await base44.entities.UserProfile.filter({ created_by: user.email });
                if (rows[0]) setProfile(rows[0]);
            } catch { /* ignore */ }
        };
        fetchProfile();
        intervalRef.current = setInterval(fetchProfile, 5000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [open]);

    const premium = checkPremium(profile);
    const tier = tierOf(profile?.ai_model_preference);
    const stack = stackOf(profile);
    const warning = stackWarning(profile, tier);

    // Optimistic: the switch is reversible and instant, and waiting on a round
    // trip to move a toggle reads as a broken toggle.
    const setTier = async (next) => {
        if (!profile || saving || next === tier) return;
        setSaving(true);
        setProfile(p => ({ ...p, ai_model_preference: next }));
        try {
            await base44.entities.UserProfile.update(profile.id, { ai_model_preference: next });
        } catch {
            setProfile(p => ({ ...p, ai_model_preference: tier }));   // put it back
        } finally {
            setSaving(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={premium ? `${stack.remaining} chips left this week` : "View your AI usage"}
                    className="pill bg-muted text-foreground gap-1.5 hover:bg-muted/80 transition-colors"
                >
                    <Layers className="w-3.5 h-3.5" />
                    {/* The number IS the label. A pill reading "Usage" told
                        nobody anything they could act on; a pill reading 640
                        is the whole state of their week at a glance. */}
                    <span className="font-bold">{premium ? stack.remaining : "AI"}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8}
                className="w-[340px] max-w-[calc(100vw-1rem)] p-0 overflow-hidden">

                {!profile ? (
                    <div className="px-4 py-8 text-xs text-muted-foreground text-center">Loading…</div>
                ) : premium ? (
                    <>
                        {/* ── THE STACK ──────────────────────────────────── */}
                        <div className="px-4 py-3.5 border-b border-border bg-muted/40">
                            <div className="flex items-baseline justify-between mb-2">
                                <div className="font-display font-extrabold text-foreground">
                                    <span className="text-2xl">{stack.remaining}</span>
                                    <span className="text-sm text-muted-foreground font-bold"> / {WEEKLY_CHIPS} chips</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground font-medium">
                                    {refillCountdown()}
                                </div>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${barColor(stack.pct)}`}
                                    style={{ width: `${100 - stack.pct}%` }} />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                                One pool for everything. Spend it however you like.
                            </p>
                        </div>

                        {/* ── WHAT THINGS COST ───────────────────────────── */}
                        <div className="px-4 py-3 max-h-[46vh] overflow-y-auto">
                            <div className="text-[11px] font-semibold uppercase tracking-wider
                                text-muted-foreground mb-2">
                                What things cost{tier === "saver" ? " on Saver" : ""}
                            </div>
                            <ul className="space-y-1.5">
                                {PRICED_ROWS.map(({ feature, label }) => {
                                    const price = priceOf(feature, tier);
                                    const n = affordable(feature, tier);
                                    // spendableFor, not the raw remainder: the bottom of
                                    // the stack is kept for Ace, so the generators grey out
                                    // slightly before it reads zero. The list has to agree
                                    // with the gate or it is lying about what will work.
                                    const canBuy = spendableFor(profile, feature) >= price;
                                    return (
                                        <li key={feature} className="flex items-baseline justify-between gap-3 text-[13px]">
                                            <span className={canBuy ? "text-foreground" : "text-muted-foreground line-through"}>
                                                {label}
                                            </span>
                                            <span className="flex items-baseline gap-2 flex-shrink-0">
                                                {/* What a full stack buys, which is the
                                                    question people actually ask. */}
                                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                                    {n}/wk
                                                </span>
                                                <span className="font-bold text-foreground tabular-nums w-7 text-right">
                                                    {price}
                                                </span>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        <div className="px-4 py-3 border-t border-border bg-muted/40">
                            {/* ── The warning, when there is one ──────────
                                Silent for most of the week on purpose: a meter
                                that talks constantly is a meter people stop
                                reading. */}
                            {warning && (
                                <div className={`rounded-xl border p-3 mb-3 ${
                                    warning.level === "empty"
                                        ? "border-streak/25 bg-streak/5"
                                        : "border-primary/25 bg-primary/5"}`}>
                                    <p className="text-[13px] font-bold text-foreground leading-snug">
                                        {warning.title}
                                    </p>
                                    <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                                        {warning.body}
                                    </p>
                                    {/* Only while the offer can still pay out.
                                        Inside the reserve there is nothing
                                        spendable left for a generator at any
                                        price, so a Switch to Saver button
                                        there is a button that does nothing —
                                        the same dead offer the old dollar
                                        meter used to show at its ceiling. */}
                                    {(warning.level === "nudge" || warning.level === "low") && tier !== "saver" && (
                                        <button type="button" onClick={() => setTier("saver")} disabled={saving}
                                            className="mt-2.5 w-full h-9 rounded-lg bg-primary text-primary-foreground
                                                font-bold text-[13px] hover:brightness-105 disabled:opacity-60
                                                transition-all">
                                            Switch to Saver
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* ── The control ─────────────────────────────
                                Named for what it does to their week, not for
                                the model behind it. "Haiku" means nothing to a
                                seventeen-year-old; "goes three times further"
                                is the thing they're actually choosing. */}
                            <div className="text-[11px] font-semibold uppercase tracking-wider
                                text-muted-foreground mb-1.5">
                                Answer quality
                            </div>
                            <div role="radiogroup" aria-label="AI answer quality"
                                className="grid grid-cols-2 gap-1.5">
                                {[TIERS.standard, TIERS.saver].map(t => {
                                    const active = tier === t.id;
                                    return (
                                        <button key={t.id} type="button" role="radio" aria-checked={active}
                                            disabled={saving} onClick={() => setTier(t.id)}
                                            className={`rounded-lg border px-2.5 py-2 text-left transition-colors
                                                disabled:opacity-60 ${active
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border bg-surface hover:bg-muted/60"}`}>
                                            <span className={`block text-[13px] font-bold ${
                                                active ? "text-primary" : "text-foreground"}`}>
                                                {t.label}
                                            </span>
                                            <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">
                                                {t.id === "saver"
                                                    ? `Every chip goes ${saverDivisor()}x further.`
                                                    : "Full-strength answers."}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="px-4 py-3 border-b border-border bg-muted/40">
                            <div className="font-display font-extrabold text-sm text-foreground">Your AI usage</div>
                        </div>
                        <div className="px-4 py-3 space-y-3">
                            {FREE_ROWS.map(({ feature, profileKey, label }) => (
                                <div key={feature}>
                                    <div className="text-[13px] font-semibold text-foreground mb-1">{label}</div>
                                    <Bar used={profile?.[profileKey] ?? 0}
                                        cap={FREE_LIFETIME_CAPS[feature]} suffix="lifetime" />
                                </div>
                            ))}
                            <div className="pt-1">
                                <Link to={createPageUrl("Subscription")} onClick={() => setOpen(false)}
                                    className="flex items-center justify-center gap-2 w-full h-10 rounded-xl
                                        bg-primary text-primary-foreground font-bold text-sm
                                        hover:scale-[1.02] transition-transform">
                                    <Crown className="w-4 h-4" />
                                    Get {WEEKLY_CHIPS} chips a week
                                </Link>
                            </div>
                        </div>
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}
