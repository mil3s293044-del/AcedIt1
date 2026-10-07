import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { trackPurchase } from "@/lib/analytics";
import AceShuffle from "@/components/ace/AceShuffle";
import PremiumReveal from "@/components/subscription/PremiumReveal";

export default function PaymentSuccess() {
    const [status, setStatus] = useState("verifying"); // verifying | success | error
    const [errorMsg, setErrorMsg] = useState(null);
    // Set when Stripe took the money but the upgrade didn't land. That is a
    // very different message from "your payment failed", and showing the wrong
    // one to someone who has just been charged is the worst version of this
    // screen.
    const [paidButPending, setPaidButPending] = useState(null);

    useEffect(() => {
        const run = async () => {
            try {
                // 1. Get session_id from URL
                const urlParams = new URLSearchParams(window.location.search);
                const sessionId = urlParams.get("session_id");
                if (!sessionId) {
                    setErrorMsg("No session ID found in URL.");
                    setStatus("error");
                    return;
                }

                // 2. Call backend to verify payment and write premium to DB
                const response = await base44.functions.invoke("verifySubscription", { sessionId });
                const result = response?.data || response;

                if (!result?.success) {
                    setErrorMsg(result?.error || "Payment verification failed.");
                    if (result?.paid) setPaidButPending(result.session_id || sessionId);
                    setStatus("error");
                    return;
                }

                // 3. Belt-and-suspenders: also write premium directly from the frontend
                //    This ensures no stale context or caching issue prevents the update.
                const user = await base44.auth.me();
                const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
                const expiresAt = result.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

                const premiumData = {
                    subscription_tier: "premium",
                    user_role: "premium_user",
                    ai_credits: 999999,
                    subscription_expires_at: expiresAt,
                    subscription_active: true,
                    onboarding_completed: true,
                    onboarding_completed_at: new Date().toISOString(),
                };

                if (profiles.length > 0) {
                    await base44.entities.UserProfile.update(profiles[0].id, premiumData);
                } else {
                    await base44.entities.UserProfile.create({ ...premiumData, created_by: user.email });
                }

                // 4. Fire the Purchase conversion to the marketing pixels.
                //    Stripe returns amount_total in cents; fall back to 0 if absent.
                const purchaseValue = result.amount_total ? result.amount_total / 100 : (result.amount || 0);
                trackPurchase(purchaseValue, result.currency ? result.currency.toUpperCase() : "AUD");

                // 5. THE REVEAL IS NOT CUT OFF. This used to hard-redirect at
                //    2,500ms, which is less than the deal takes to play — a
                //    celebration snatched away mid-animation on the one screen
                //    that exists to be a celebration. Leaving is a tap now,
                //    with a long fallback inside PremiumReveal so an abandoned
                //    tab still lands. The navigation stays a full href,
                //    because the whole app has to re-initialise against a
                //    profile that became premium ten seconds ago.
                setStatus("success");
            } catch (err) {
                console.error("[PaymentSuccess] Error:", err);
                setErrorMsg(err.message || "An unexpected error occurred.");
                setStatus("error");
            }
        };

        run();
    }, []);

    if (status === "verifying") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <AceShuffle size="lg" className="mb-4 mx-auto" />
                        <h2 className="text-xl font-bold text-foreground mb-2">Activating Your Subscription</h2>
                        <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (status === "error") {
        const paid = !!paidButPending;
        /* ── ON TOKENS, IN BOTH THEMES ─────────────────────────────────────
           Every ground here was a literal `-50` gradient and every ink a
           literal `-900`, so in the dark this was a bright slab on a near-black
           page — the failure /Paywall records about the one screen that asks
           for money. The tone is carried by `xp` (money taken, nothing
           delivered yet) and `streak` (it failed), which are the two colours
           the student already reads that way. */
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        {/* A STATUS DISC HOLDS A GLYPH, and the deck is not one.
                            The failed case keeps its badge — a warning IS an icon —
                            and the waiting case loses the circle rather than being
                            squeezed into it, because a stack of cards inside a
                            coloured pill reads as a rendering fault. */}
                        {paid ? (
                            <div className="flex justify-center mb-4">
                                <AceShuffle size="lg" label="Activating your subscription" />
                            </div>
                        ) : (
                            <div className="w-16 h-16 rounded-full flex items-center justify-center
                                mx-auto mb-4 bg-streak/15">
                                <AlertCircle className="w-8 h-8 text-streak" />
                            </div>
                        )}
                        <h2 className="text-xl font-bold mb-2 text-foreground">
                            {paid ? "Payment received — activating" : "That payment did not go through"}
                        </h2>
                        <div className={`rounded-xl p-4 mb-4 border-2 ${
                            paid ? "bg-xp/10 border-xp/30" : "bg-streak/10 border-streak/30"}`}>
                            <p className={`text-sm break-words text-foreground ${paid ? "" : "font-mono"}`}>
                                {errorMsg}
                            </p>
                        </div>
                        {paid && (
                            <p className="text-xs text-muted-foreground font-mono break-all mb-4">
                                Reference: {paidButPending}
                            </p>
                        )}
                        <div className="space-y-2">
                            <Button onClick={() => window.location.reload()} className="w-full">
                                {paid ? "Check again" : "Try Again"}
                            </Button>
                            <Button onClick={() => { window.location.href = paid ? "/Support" : "/Subscription"; }}
                                variant="outline" className="w-full">
                                {paid ? "Contact support" : "Back to Subscription"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <PremiumReveal onContinue={() => { window.location.href = "/Dashboard"; }} />
    );
}