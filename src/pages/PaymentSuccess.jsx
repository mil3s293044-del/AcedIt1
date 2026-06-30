import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { trackPurchase } from "@/lib/analytics";

export default function PaymentSuccess() {
    const [status, setStatus] = useState("verifying"); // verifying | success | error
    const [errorMsg, setErrorMsg] = useState(null);

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

                // 5. Show success briefly, then hard-redirect so entire app re-initialises fresh
                setStatus("success");
                setTimeout(() => {
                    window.location.href = "/Dashboard";
                }, 2500);
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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Activating Your Subscription</h2>
                        <p className="text-gray-600">Please wait while we confirm your payment...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">❌</span>
                        </div>
                        <h2 className="text-xl font-bold text-red-900 mb-4">Payment Verification Failed</h2>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <p className="text-sm font-mono text-red-800 break-words">{errorMsg}</p>
                        </div>
                        <div className="space-y-2">
                            <Button onClick={() => window.location.reload()} className="w-full">
                                Try Again
                            </Button>
                            <Button onClick={() => { window.location.href = "/Subscription"; }} variant="outline" className="w-full">
                                Back to Subscription
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="max-w-lg w-full"
            >
                <Card className="border-0 shadow-2xl overflow-hidden">
                    <div className="bg-gradient-to-br from-green-600 to-emerald-600 p-8 text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                            className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl"
                        >
                            <CheckCircle className="w-16 h-16 text-green-600" />
                        </motion.div>
                        <h1 className="text-4xl font-black text-white mb-3">Success! 🎉</h1>
                        <p className="text-xl text-green-50">Welcome to Premium!</p>
                    </div>
                    <CardContent className="p-8 text-center space-y-4">
                        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border-2 border-purple-200">
                            <Sparkles className="w-10 h-10 text-purple-600 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-gray-900 mb-1">You now have full premium access!</h3>
                            <p className="text-gray-600 text-sm">Redirecting you to your subscription page...</p>
                        </div>
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}