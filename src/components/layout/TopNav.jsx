import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Flame, Zap, Crown } from "lucide-react";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import UsageMeter from "@/components/shared/UsageMeter";
import ThemeToggle from "@/components/layout/ThemeToggle";

// Page slug → display title. Anything missing falls back to a humanized slug.
const PAGE_TITLES = {
    "":               "Home",
    "Dashboard":      "Home",
    "Study":          "Study Session",
    "Quizzes":        "Quizzes",
    "AITools":        "AI Tools",
    "Goals":          "Planner",
    "Analytics":      "Analytics",
    "Ranked":         "Ranked",
    "Friends":        "Friends",
    "Competitions":   "Compete",
    "Subjects":       "Subjects",
    "Subscription":   "Subscription",
    "Settings":       "Settings",
    "Support":        "Support",
    "Paywall":        "Upgrade",
    "Premium":        "Premium",
    "Suspended":      "Account Suspended",
    "AdminIPPanel":   "Admin",
};

function humanize(slug) {
    if (!slug) return "";
    return slug.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function deriveTitle(pathname) {
    const slug = pathname.replace(/^\//, "").split("/")[0] || "";
    return PAGE_TITLES[slug] ?? humanize(slug) ?? "AcedIt";
}

export default function TopNav() {
    const location = useLocation();
    const [userProfile, setUserProfile] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const user = await base44.auth.me();
                const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
                if (!cancelled && profiles[0]) setUserProfile(profiles[0]);
            } catch {
                /* not signed in / fetch failed — leave pills hidden */
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const title = deriveTitle(location.pathname);
    const streak = userProfile?.streak_days || 0;
    const xp = userProfile?.total_xp || 0;
    const isPremium = userProfile?.subscription_tier === "premium" || userProfile?.subscription_active === true;

    return (
        <header
            // Sits above content; content has md:pl-16 to clear the SideRail.
            className="sticky top-0 z-30 h-12 bg-surface/95 backdrop-blur-xl border-b border-border md:pl-16"
        >
            <div className="h-full flex items-center justify-between px-4 lg:px-6">
                {/* ── Page title (desktop) / brand (mobile) ───────────── */}
                <div className="flex items-center min-w-0">
                    <h1 className="hidden md:block font-display font-extrabold text-foreground text-base tracking-tight truncate">
                        {title}
                    </h1>
                    {/* Mobile shows the brand here since the SideRail logo is hidden */}
                    <span className="md:hidden font-display font-extrabold text-foreground text-lg tracking-tight">
                        AcedIt
                    </span>
                </div>

                {/* ── Stats pills + premium chip ──────────────────────── */}
                <div className="flex items-center gap-1.5">
                    {/* First, because the moment anybody wants this is the
                        moment the screen is too bright, and that is never
                        while they happen to be on the settings page. All four
                        options live there; this is the one-tap version. */}
                    <ThemeToggle />
                    {/* Click to see all daily AI caps + weekly cost ceiling. */}
                    {userProfile && <UsageMeter />}
                    {streak > 0 && (
                        <Link
                            to={createPageUrl("Ranked")}
                            className="pill bg-streak/15 text-streak gap-1.5 hover:bg-streak/20 transition-colors"
                            aria-label={`${streak} day streak`}
                        >
                            <Flame className="w-3.5 h-3.5" />
                            <span className="font-bold">{streak}d</span>
                        </Link>
                    )}
                    {xp > 0 && (
                        <Link
                            to={createPageUrl("Ranked")}
                            className="pill bg-xp/15 text-xp gap-1.5 hover:bg-xp/20 transition-colors"
                            aria-label={`${xp.toLocaleString()} total XP`}
                        >
                            <Zap className="w-3.5 h-3.5" />
                            <span className="font-bold">{xp.toLocaleString()}</span>
                        </Link>
                    )}
                    {isPremium && (
                        <Link
                            to={createPageUrl("Subscription")}
                            className="pill bg-primary/15 text-primary gap-1.5 hover:bg-primary/20 transition-colors"
                            aria-label="Premium subscriber"
                        >
                            <Crown className="w-3.5 h-3.5" />
                            <span className="font-bold hidden sm:inline">Premium</span>
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
