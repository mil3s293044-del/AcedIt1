import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Activity, Crown, Zap } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import {
    FEATURES,
    PREMIUM_DAILY_CAPS,
    FREE_LIFETIME_CAPS,
    WEEKLY_COST_CAP_MICROS,
    weeklySpendMicros,
    isPremium as checkPremium,
} from "@/lib/tierAccess";
import { TIERS, tierOf, saverNudge } from "@/lib/aiModels";

// Rows the user sees, in display order. Each row resolves its used/cap
// dynamically based on tier + the daily_ai_counters jsonb on the profile.
const PREMIUM_ROWS = [
    { feature: FEATURES.QUIZ_AI_GEN,      counter: "quizzes",       label: "AI quiz generation" },
    { feature: FEATURES.QUIZ_AI_MARK,     counter: "quiz_marks",    label: "Quiz marking" },
    { feature: FEATURES.FLASHCARD_AI_GEN, counter: "flashcards",    label: "Flashcard generation" },
    { feature: FEATURES.AI_TOOL,          counter: "tools",         label: "AI study tools" },
    { feature: FEATURES.AI_CHAT,          counter: "chat",          label: "AI chat (tutors)" },
    { feature: FEATURES.BLURTING,         counter: "blurting",      label: "Blurting" },
    { feature: FEATURES.ACTIVE_RECALL,    counter: "active_recall", label: "Active recall" },
    { feature: FEATURES.GOAL_AI_GEN,      counter: "goal",          label: "Goals & roadmap" },
];

// Free users only see what they can actually access.
const FREE_ROWS = [
    { feature: FEATURES.QUIZ_AI_GEN,      profileKey: "free_ai_quizzes_used",    label: "AI quiz generation" },
    { feature: FEATURES.QUIZ_AI_MARK,     profileKey: "free_ai_quiz_marks_used", label: "AI quiz marking" },
    { feature: FEATURES.FLASHCARD_AI_GEN, profileKey: "free_ai_flashcards_used", label: "Flashcard generation" },
];

function barColor(pct) {
    if (pct >= 100) return "bg-red-500";
    if (pct >= 80)  return "bg-orange-500";
    if (pct >= 50)  return "bg-yellow-500";
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
                <div
                    className={`h-full rounded-full transition-all ${barColor(pct)}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function todayUTC() {
    return new Date().toISOString().slice(0, 10);
}

function midnightCountdown() {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const diff = next - now;
    const hrs = Math.floor(diff / 3_600_000);
    const mins = Math.floor((diff % 3_600_000) / 60_000);
    if (hrs > 0) return `Resets in ${hrs}h ${mins}m`;
    return `Resets in ${mins}m`;
}

export default function UsageMeter() {
    const [open, setOpen] = useState(false);
    const [profile, setProfile] = useState(null);
    const [saving, setSaving] = useState(false);
    const intervalRef = useRef(null);

    // Fetch when popover opens, and refresh every 5s while open so the
    // numbers tick down as the user makes calls.
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
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [open]);

    const premium = checkPremium(profile);
    const counters = profile?.daily_ai_counters ?? {};
    const countersValid = counters.date === todayUTC();
    const spentMicros = weeklySpendMicros(profile);
    const costPct = Math.min(100, (spentMicros / WEEKLY_COST_CAP_MICROS) * 100);
    const tier = tierOf(profile?.ai_model_preference);
    const nudge = saverNudge({
        preference: tier,
        spentMicros,
        capMicros: WEEKLY_COST_CAP_MICROS,
    });

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
                    aria-label="View your AI usage"
                    className="pill bg-muted text-foreground gap-1.5 hover:bg-muted/80 transition-colors"
                >
                    <Activity className="w-3.5 h-3.5" />
                    <span className="font-bold hidden sm:inline">Usage</span>
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[340px] max-w-[calc(100vw-1rem)] p-0 overflow-hidden"
            >
                <div className="px-4 py-3 border-b border-border bg-muted/40">
                    <div className="flex items-baseline justify-between">
                        <div className="font-display font-extrabold text-sm text-foreground">
                            {premium ? "Today's AI usage" : "Your AI usage"}
                        </div>
                        {premium && (
                            <div className="text-[11px] text-muted-foreground font-medium">
                                {midnightCountdown()}
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-4 py-3 space-y-3 max-h-[60vh] overflow-y-auto">
                    {!profile ? (
                        <div className="text-xs text-muted-foreground py-4 text-center">
                            Loading usage…
                        </div>
                    ) : premium ? (
                        PREMIUM_ROWS.map(({ feature, counter, label }) => {
                            const cap = PREMIUM_DAILY_CAPS[feature];
                            const used = countersValid ? (counters[counter] ?? 0) : 0;
                            return (
                                <div key={feature}>
                                    <div className="text-[13px] font-semibold text-foreground mb-1">{label}</div>
                                    <Bar used={used} cap={cap} suffix="today" />
                                </div>
                            );
                        })
                    ) : (
                        <>
                            {FREE_ROWS.map(({ feature, profileKey, label }) => {
                                const cap = FREE_LIFETIME_CAPS[feature];
                                const used = profile?.[profileKey] ?? 0;
                                return (
                                    <div key={feature}>
                                        <div className="text-[13px] font-semibold text-foreground mb-1">{label}</div>
                                        <Bar used={used} cap={cap} suffix="lifetime" />
                                    </div>
                                );
                            })}
                            <div className="pt-1">
                                <Link
                                    to={createPageUrl("Subscription")}
                                    onClick={() => setOpen(false)}
                                    className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:scale-[1.02] transition-transform"
                                >
                                    <Crown className="w-4 h-4" />
                                    Upgrade for daily access
                                </Link>
                            </div>
                        </>
                    )}
                </div>

                {premium && (
                    <div className="px-4 py-3 border-t border-border bg-muted/40">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <Zap className="w-3.5 h-3.5 text-foreground" />
                            <div className="text-[13px] font-semibold text-foreground">This week's AI</div>
                        </div>
                        <div className="space-y-1">
                            {/* A percentage, not a dollar figure. The old meter
                                read "$1.37 of $2.50", which is our cost of
                                goods rather than anything the student bought,
                                and gives them no way to judge whether that is
                                a lot. A proportion they can act on. */}
                            <div className="flex items-baseline justify-between text-xs">
                                <span className="text-muted-foreground">
                                    {Math.round(costPct)}% used
                                </span>
                                <span className="font-medium text-foreground">Resets Monday</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${barColor(costPct)}`}
                                    style={{ width: `${costPct}%` }}
                                />
                            </div>
                        </div>

                        {/* ── The recommendation ──────────────────────────
                            Only appears while it can still pay out. The
                            ceiling counts money already spent, so offering
                            the cheaper model AT the ceiling would be a
                            button that does nothing — saverNudge() returns
                            null there, and at 100% the bar and "Resets
                            Monday" are the whole honest story. */}
                        {nudge && (
                            <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
                                <p className="text-[13px] font-bold text-foreground leading-snug">
                                    {nudge.headline}
                                </p>
                                <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                                    {nudge.body}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setTier("saver")}
                                    disabled={saving}
                                    className="mt-2.5 w-full h-9 rounded-lg bg-primary text-primary-foreground
                                        font-bold text-[13px] hover:brightness-105 disabled:opacity-60
                                        transition-all"
                                >
                                    Switch to Saver
                                </button>
                            </div>
                        )}

                        {/* ── The control ─────────────────────────────────
                            Named for what it does to their week, not for
                            the model behind it. "Haiku" means nothing to a
                            seventeen-year-old; "your allowance goes further"
                            is the thing they're actually choosing. */}
                        <div className="mt-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wider
                                text-muted-foreground mb-1.5">
                                Answer quality
                            </div>
                            <div role="radiogroup" aria-label="AI answer quality"
                                className="grid grid-cols-2 gap-1.5">
                                {[TIERS.standard, TIERS.saver].map(t => {
                                    const active = tier === t.id;
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            disabled={saving}
                                            onClick={() => setTier(t.id)}
                                            className={`rounded-lg border px-2.5 py-2 text-left transition-colors
                                                disabled:opacity-60 ${active
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border bg-surface hover:bg-muted/60"}`}
                                        >
                                            <span className={`block text-[13px] font-bold ${
                                                active ? "text-primary" : "text-foreground"}`}>
                                                {t.label}
                                            </span>
                                            <span className="block text-[11px] text-muted-foreground
                                                leading-snug mt-0.5">
                                                {t.blurb}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
