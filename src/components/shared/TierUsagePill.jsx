import React, { useEffect, useState } from "react";
import { Sparkles, Crown, Lock, Infinity as InfinityIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
    isPremium,
    canUseFeature,
    FEATURES,
    FREE_LIFETIME_CAPS,
} from "@/lib/tierAccess";
import { priceOf, stackOf, spendableFor, PRICE as CHIP_PRICE, DEFAULT_PRICE as DEFAULT_CHIP_PRICE, WEEKLY_CHIPS } from "@/lib/chips";
import { tierOf } from "@/lib/aiModels";
import { createPageUrl } from "@/utils";

// Friendly short label per feature, used in the pill.
const FEATURE_LABEL = {
    [FEATURES.QUIZ_AI_GEN]:      "AI Quizzes",
    [FEATURES.QUIZ_AI_MARK]:     "Quiz Marking",
    [FEATURES.FLASHCARD_AI_GEN]: "AI Flashcards",
    [FEATURES.AI_TOOL]:          "AI Tools",
    [FEATURES.AI_CHAT]:          "AI Chat",
    [FEATURES.GOAL_AI_GEN]:      "Goal AI",
    [FEATURES.ROADMAP_AI_GEN]:   "Roadmap AI",
    [FEATURES.BLURTING]:         "Blurting",
    [FEATURES.ACTIVE_RECALL]:    "Active Recall",
    [FEATURES.SPACED_REP]:       "Spaced Rep",
    [FEATURES.ADVANCED_ANALYTICS]: "Analytics",
};

// Display a compact pill for one feature's remaining quota.
//   <TierUsagePill feature={FEATURES.AI_TOOL} />
//
// Variants:
//   • free user, capped feature      → "2 of 3 lifetime"
//   • free user, premium-only        → "Locked → Upgrade"
//   • premium user, capped feature   → "4 of 6 today"
//   • premium user, uncapped feature → "Unlimited"
//
// Pass `userProfile` to skip the internal fetch when the parent already has it.
// Pass `compact` to render just the count (no label), good for tight headers.
export default function TierUsagePill({ feature, userProfile: profileProp, compact = false, className = "" }) {
    const [profile, setProfile] = useState(profileProp ?? null);

    useEffect(() => {
        if (profileProp !== undefined) {
            setProfile(profileProp);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const user = await base44.auth.me();
                const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
                if (!cancelled) setProfile(profiles[0] ?? null);
            } catch {
                if (!cancelled) setProfile(null);
            }
        })();
        return () => { cancelled = true; };
    }, [profileProp]);

    if (profile === null && profileProp === undefined) return null; // not signed in

    // When the dev tier-bypass flag is on, caps are off — hide the pill so it
    // doesn't display misleading limit text.
    if (import.meta.env.VITE_TIER_BYPASS === "true") return null;

    const access = canUseFeature(profile, feature);
    const premium = isPremium(profile);
    const tier = tierOf(profile?.ai_model_preference);
    const label = FEATURE_LABEL[feature] ?? "AI";

    // Free user, blocked feature
    if (!premium && FREE_LIFETIME_CAPS[feature] === undefined) {
        return (
            <Link
                to={createPageUrl("Subscription")}
                className={`pill bg-secondary text-muted-foreground gap-1.5 hover:bg-primary/10 hover:text-primary transition-colors ${className}`}
                title={`${label} is a Premium feature — click to upgrade`}
            >
                <Lock className="w-3 h-3" />
                <span className="font-bold">{compact ? "Premium" : `${label}: Premium only`}</span>
            </Link>
        );
    }

    // ── PREMIUM: the PRICE, not a countdown ─────────────────────────────
    //
    // This used to say "3 left today" against a per-feature daily cap. It was
    // counting the wrong thing: those caps permitted 4.5x what the weekly
    // dollar ceiling allowed, so the number a student watched here was never
    // what actually stopped them.
    //
    // The useful thing to know, standing in front of a button that is about to
    // spend from one shared pool, is what THIS costs. So that is what it says.
    if (premium) {
        const price = priceOf(feature, tier);
        const stack = stackOf(profile);
        // A feature with no AI cost behind it (spaced repetition, analytics).
        if (CHIP_PRICE[feature] === undefined && price === DEFAULT_CHIP_PRICE) {
            return (
                <span className={`pill bg-primary/10 text-primary gap-1.5 ${className}`}
                    title={`${label}: unlimited on Premium`}>
                    <InfinityIcon className="w-3 h-3" />
                    <span className="font-bold">{compact ? "\u221e" : `${label}: Unlimited`}</span>
                </span>
            );
        }
        const affordable = spendableFor(profile, feature) >= price;
        const colorClasses = affordable
            ? "bg-primary/10 text-primary"
            : "bg-streak/15 text-streak";
        const tooltip = affordable
            ? `${label} costs ${price} chips. You have ${stack.remaining} of ${WEEKLY_CHIPS} left this week.`
            : `${label} costs ${price} chips and you have ${stack.remaining} left. Refills Monday.`;
        return (
            <span className={`pill ${colorClasses} gap-1.5 ${className}`} title={tooltip}>
                {affordable ? <Sparkles className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
                <span className="font-bold tabular-nums">
                    {compact ? price : `${price} chips`}
                </span>
            </span>
        );
    }

    // ── FREE: still lifetime counts. Chips are a premium thing. ─────────
    const used = access.used ?? 0;
    const cap = access.cap ?? FREE_LIFETIME_CAPS[feature];
    const remaining = Math.max(0, cap - used);
    const exhausted = remaining <= 0;
    const colorClasses = exhausted
        ? "bg-streak/15 text-streak"
        : remaining <= 1
            ? "bg-xp/15 text-xp"
            : "bg-primary/10 text-primary";
    const tooltip = exhausted
        ? `${label}: ${cap}/${cap} used — upgrade for a weekly chip stack`
        : `${label}: ${remaining} of ${cap} left lifetime`;

    if (exhausted) {
        return (
            <Link
                to={createPageUrl("Subscription")}
                className={`pill ${colorClasses} gap-1.5 hover:opacity-90 transition-opacity ${className}`}
                title={tooltip}
            >
                <Lock className="w-3 h-3" />
                <span className="font-bold tabular-nums">{compact ? `0/${cap}` : `${label}: 0 left \u2014 upgrade`}</span>
            </Link>
        );
    }

    return (
        <span className={`pill ${colorClasses} gap-1.5 ${className}`} title={tooltip}>
            <Sparkles className="w-3 h-3" />
            <span className="font-bold tabular-nums">
                {compact ? `${remaining}/${cap}` : `${label}: ${remaining}/${cap} left`}
            </span>
        </span>
    );
}
