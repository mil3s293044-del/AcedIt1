/**
 * TopNav — the page's name, and the student's own two numbers.
 *
 * ─── FOUR HUES AT EQUAL WEIGHT IS A TOOLBAR, NOT A HEADER ───────────────────
 * The right-hand group was five separately-filled chips on one line: a theme
 * toggle, a grey AI pill, a RED streak pill, an ORANGE XP pill and a GREEN
 * "Premium" pill. Nothing led, because everything was tinted at the same
 * strength — the exact "six bordered chips on one line is a toolbar" shape the
 * Ranked header was rebuilt to lose, in the one strip that is on every screen.
 *
 * Three decisions, and they are all about weight:
 *
 * ─── ONE STAT GROUP, AND THE HUES SURVIVE ONLY ON THE GLYPHS ────────────────
 * Streak and XP are two readings of the same thing — how the term is going —
 * and they already pointed at the SAME destination, so two pills were one
 * control drawn twice. They are one quiet pill now with a hairline between the
 * halves. The flame stays streak-red and the bolt stays XP-amber, because those
 * two colours are what a student reads them BY; what goes is the tinted ground
 * behind each, which is what made them shout.
 *
 * A half with nothing in it is not drawn, and the divider only exists BETWEEN
 * two present halves — a leading rule with nothing to its left reads as a
 * clipped element. With neither there is no pill at all, which is a first-week
 * account and is the honest answer rather than "0d · 0".
 *
 * ─── THE CHROME IS CHROME ───────────────────────────────────────────────────
 * The theme toggle and the AI meter are plain icon buttons with no fill, which
 * is what they always were underneath. The toggle MOVED but is not demoted: its
 * old comment argued it sits here because the moment anybody wants it is the
 * moment the screen is too bright, and that is about being one tap from
 * anywhere, not about being first in the row.
 *
 * ─── PREMIUM IS STATUS, SO IT IS NOT DRAWN AS A COUNTER ─────────────────────
 * It was a filled green pill reading "Premium" beside two numbers that move
 * every session — a figure's worth of weight on the one fact that never
 * changes. A bare crown says it, and it still opens /Subscription for somebody
 * checking what they pay for.
 */
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Flame, Zap, Crown } from "lucide-react";
import { createPageUrl } from "@/utils";
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
    "Review":         "Progress",
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

/**
 * THE PROFILE IS HANDED DOWN, NOT FETCHED AGAIN.
 *
 * This read its own `auth.me()` + `UserProfile.filter()` on mount while Layout,
 * which renders it, already held that same row and already passed it to five
 * other components. One row, two queries, two pieces of state — the mirror this
 * codebase keeps deleting, deduped only inside `readCache`'s 8s window.
 *
 * It is also strictly MORE correct. Layout downgrades an expired premium and a
 * lapsed trial BEFORE it publishes the profile; this read the raw row, so a
 * subscription that ran out last week still drew the crown until the next
 * reload. Given nothing, every pill is simply absent — which is what an
 * unauthenticated visitor and a failed fetch both looked like before.
 */
export default function TopNav({ profile: userProfile = null }) {
    const location = useLocation();

    const title = deriveTitle(location.pathname);
    const streak = userProfile?.streak_days || 0;
    const xp = userProfile?.total_xp || 0;
    const isPremium = userProfile?.subscription_tier === "premium" || userProfile?.subscription_active === true;

    // ONE CONTROL, SO ONE LABEL. A screen reader met two adjacent links to the
    // same page reading "8 day streak" and "20,722 total XP"; merged, the pill
    // has to announce both halves at once or one of them is unreadable.
    const statLabel = [
        streak > 0 ? `${streak} day streak` : null,
        xp > 0 ? `${xp.toLocaleString()} total XP` : null,
    ].filter(Boolean).join(", ");

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

                {/* ── The student's two numbers, then the chrome ───────── */}
                <div className="flex items-center gap-0.5">
                    {(streak > 0 || xp > 0) && (
                        <Link
                            to={createPageUrl("Ranked")}
                            className="mr-1 inline-flex items-center gap-2 h-7 px-2.5 rounded-full
                                bg-muted text-foreground hover:bg-muted/70 transition-colors"
                            aria-label={statLabel}
                        >
                            {streak > 0 && (
                                <span className="inline-flex items-center gap-1">
                                    <Flame className="w-3.5 h-3.5 text-streak" aria-hidden="true" />
                                    <span className="text-xs font-bold tabular-nums">{streak}d</span>
                                </span>
                            )}
                            {/* ONLY BETWEEN TWO HALVES. Drawn unconditionally it is a
                                hairline against the pill's own left edge, which reads
                                as something clipped rather than as a divider. */}
                            {streak > 0 && xp > 0 && (
                                <span className="w-px h-3 bg-border" aria-hidden="true" />
                            )}
                            {xp > 0 && (
                                <span className="inline-flex items-center gap-1">
                                    <Zap className="w-3.5 h-3.5 text-xp" aria-hidden="true" />
                                    <span className="text-xs font-bold tabular-nums">{xp.toLocaleString()}</span>
                                </span>
                            )}
                        </Link>
                    )}

                    {/* Click to see all daily AI caps + weekly cost ceiling. */}
                    {userProfile && <UsageMeter />}
                    <ThemeToggle />

                    {isPremium && (
                        <Link
                            to={createPageUrl("Subscription")}
                            // MUTED, and the screenshot is what settled it. Drawn in
                            // the brand green it was the brightest element in a group
                            // whose whole point is that the two numbers lead — a
                            // vivid glyph on the one fact that never changes. Its
                            // PRESENCE is the signal; the hover is where the colour
                            // lives, which is also what says it opens something.
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full
                                text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                            aria-label="Premium subscriber"
                            title="Premium"
                        >
                            <Crown className="w-4 h-4" aria-hidden="true" />
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
