import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Sparkles, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { isPremium as checkIsPremium } from "@/lib/tierAccess";
import { createPageUrl } from "@/utils";
import { TOOL_COUNT } from "@/components/ai_tools/chatTools";

// Route-level gate. Wrap a page's contents:
//   <RequirePremium featureName="AI Tools">{children}</RequirePremium>
// While the profile loads we render nothing (avoid a flash). Free users see a
// full-page upgrade prompt; premium users see the children.
export default function RequirePremium({ children, featureName = "this feature", description }) {
    const [profile, setProfile] = useState(undefined); // undefined = loading, null = unauth/error

    useEffect(() => {
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
    }, []);

    if (profile === undefined) {
        // Loading — match the app's existing spinner pattern
        return (
            <div className="fixed inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-border border-t-slate-800 rounded-full animate-spin" />
            </div>
        );
    }

    if (checkIsPremium(profile)) return children;

    // Free / signed-out — show the locked screen
    return (
        <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center px-4 py-12">
            <div className="max-w-md w-full bg-surface border-2 border-border rounded-3xl p-8 shadow-soft text-center">
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Lock className="w-8 h-8 text-primary" />
                </div>
                <h1 className="font-display font-extrabold text-2xl text-foreground mb-2">
                    {featureName} is a Premium feature
                </h1>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                    {description ?? `Upgrade to unlock ${featureName} and everything else AcedIt has to offer. $5/week, cancel anytime.`}
                </p>
                <div className="flex flex-col gap-2">
                    <Link
                        to={createPageUrl("Subscription")}
                        className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm btn-3d hover:scale-[1.02] transition-transform"
                    >
                        <Crown className="w-4 h-4" />
                        Upgrade to Premium
                    </Link>
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center h-10 px-6 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary font-semibold text-sm transition-colors"
                    >
                        Back to home
                    </Link>
                </div>
                <div className="mt-6 pt-6 border-t border-border text-left">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" />
                        What you get
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                        <li>• {TOOL_COUNT} AI study tools (essay planner, note summariser, math tutor, more)</li>
                        <li>• AI-generated quizzes & flashcard sets every day</li>
                        <li>• AI test marker and goal generation</li>
                        <li>• Blurting, active recall, spaced repetition</li>
                        <li>• Advanced analytics</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
