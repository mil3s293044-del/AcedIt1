import React, { useEffect, useState } from "react";
import { Sparkles, Crown, Lock, Infinity as InfinityIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
    isPremium,
    canUseFeature,
    FEATURES,
    PREMIUM_DAILY_CAPS,
    FREE_LIFETIME_CAPS,
} from "@/lib/tierAccess";
import { createPageUrl } from "@/utils";

// Friendly short label per feature, used in the pill.
const FEATURE_LABEL = {
    [FEATURES.QUIZ_AI_GEN]:      "AI Quizzes",
    [FEATURES.QUIZ_AI_MARK]:     "Quiz Marking",
    [FEATURES.FLASHCARD_AI_GEN]: "AI Flashcards",
    [FEATURES.AI_TOOL]:          "AI Tools",
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

    // Premium user, uncapped feature (spaced rep, advanced analytics)
    if (premium && PREMIUM_DAILY_CAPS[feature] === undefined) {
        return (
            <span className={`pill bg-primary/10 text-primary gap-1.5 ${className}`} title={`${label}: unlimited on Premium`}>
                <InfinityIcon className="w-3 h-3" />
                <span className="font-bold">{compact ? "∞" : `${label}: Unlimited`}</span>
            </span>
        );
    }

    // Capped premium or capped free → show "X left" so the meaning is obvious
    const used = access.used ?? 0;
    const cap = access.cap ?? (premium ? PREMIUM_DAILY_CAPS[feature] : FREE_LIFETIME_CAPS[feature]);
    const remaining = Math.max(0, cap - used);
    const period = premium ? "today" : "lifetime";
    const exhausted = remaining <= 0;
    const colorClasses = exhausted
        ? "bg-streak/15 text-streak"
        : remaining <= 1
            ? "bg-xp/15 text-xp"
            : "bg-primary/10 text-primary";
    const tooltip = exhausted
        ? `${label}: ${cap}/${cap} used ${period} — ${premium ? "resets at midnight" : "upgrade for daily access"}`
        : `${label}: ${remaining} of ${cap} left ${period}`;

    const text = compact
        ? `${remaining}/${cap}`
        : `${label}: ${remaining}/${cap} left ${period}`;

    if (exhausted) {
        return (
            <Link
                to={createPageUrl("Subscription")}
                className={`pill ${colorClasses} gap-1.5 hover:opacity-90 transition-opacity ${className}`}
                title={tooltip}
            >
                {premium ? <Crown className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                <span className="font-bold tabular-nums">{compact ? `0/${cap}` : `${label}: 0 left — upgrade`}</span>
            </Link>
        );
    }

    return (
        <span className={`pill ${colorClasses} gap-1.5 ${className}`} title={tooltip}>
            <Sparkles className="w-3 h-3" />
            <span className="font-bold tabular-nums">{text}</span>
        </span>
    );
}
