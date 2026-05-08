import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2, GraduationCap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { stripeCheckout } from "@/api/functionsShim";

const FEATURES = [
    "Unlimited AI practice questions generated from your own notes",
    "AI marks your SAC answers with a full-marks model answer",
    "Weak topic detection — know exactly what to fix before exams",
    "All 8 AI study tools: essay planner, concept explainer, maths tutor, blurting method, teaching assistant, note summariser, question generator, practice answer generator",
    "Spaced repetition flashcards with SM-2 algorithm",
    "Friend competitions, score bets and XP leaderboards",
    "Full analytics dashboard with AI performance coach",
    "Pomodoro timer, study planner and SAC calendar",
];

export default function Paywall() {
    const [loading, setLoading] = useState(false);
    const [userProfile, setUserProfile] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const user = await base44.auth.me();
                const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
                setUserProfile(profiles[0] || null);
            } catch {}
        };
        load();
    }, []);

    const isExpired = userProfile?.trial_ends_at && new Date(userProfile.trial_ends_at) < new Date();
    const heading = isExpired ? "Your trial has ended" : "Subscribe to continue";

    const handleCheckout = async () => {
        setLoading(true);
        try {
            const res = await stripeCheckout({
                priceId: import.meta.env.VITE_STRIPE_PRICE_PREMIUM,
                successUrl: `${window.location.origin}/PaymentSuccess?session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${window.location.origin}/Paywall`,
                trial_days: 7,
            });
            const url = res?.data?.checkoutUrl || res?.data?.url || res?.checkoutUrl;
            if (url) window.location.href = url;
            else throw new Error("No checkout URL returned");
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#534AB7" }}>
                    <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold" style={{ color: "#534AB7" }}>Acedit</span>
            </div>

            <h1 className="text-3xl font-extrabold text-gray-900 text-center mb-2">{heading}</h1>
            <p className="text-gray-500 text-sm text-center mb-8">7 days completely free. Then $5/week. Cancel anytime before the trial ends and you won't be charged.</p>

            {/* Plan card */}
            <div className="w-full max-w-md border-2 rounded-2xl p-6 mb-6" style={{ borderColor: "#534AB7" }}>
                <div className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-3" style={{ backgroundColor: "#534AB7", color: "white" }}>
                    7-day free trial
                </div>
                <p className="font-bold text-xl text-gray-900 mb-1">Acedit Premium</p>
                <p className="text-3xl font-extrabold text-gray-900 mb-0.5">Free for 7 days</p>
                <p className="text-sm text-gray-500 mb-1">then $5/week</p>
                <p className="text-xs text-gray-400 mb-4">Cancel before day 7 and pay nothing.</p>

                <div className="rounded-xl p-3 mb-5" style={{ backgroundColor: "#F0EEFF" }}>
                    <p className="text-xs text-purple-800 leading-relaxed">
                        Melbourne private tutors charge <strong>$60–$120 per hour</strong> (Learnmate Australia, 2025). Acedit gives you AI-powered study support for <strong>$5/week</strong> — available at 2am the night before your SAC.
                    </p>
                </div>

                <div className="space-y-2 mb-6">
                    {FEATURES.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#534AB7" }} />
                            <span className="text-xs text-gray-700">{f}</span>
                        </div>
                    ))}
                </div>

                <Button
                    onClick={handleCheckout}
                    disabled={loading}
                    className="w-full h-12 text-base font-semibold"
                    style={{ backgroundColor: "#534AB7" }}
                >
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Redirecting...</> : "Start my free 7-day trial →"}
                </Button>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-2 gap-2 mb-6 text-xs text-gray-500 w-full max-w-md">
                {["No charge for 7 days", "Cancel anytime", "No lock-in contract", "Secure checkout"].map((t, i) => (
                    <div key={i} className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> {t}</div>
                ))}
            </div>

            {/* Research close */}
            <div className="w-full max-w-md bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="text-sm font-bold text-green-800 mb-2">What the research says about students who don't burn out</p>
                <p className="text-xs text-green-700 leading-relaxed mb-2">They don't study more hours than their peers. They use retrieval practice, spaced review, and immediate feedback loops. They know their weak topics before exams find them. And they maintain consistent daily habits rather than last-minute cramming. These are not natural talents — they are learnable systems. That is what Acedit is built to give you.</p>
                <p className="text-xs text-green-500">Based on: Roediger & Karpicke (2006), Dunlosky et al. (2013), Ebbinghaus (1885), Gollwitzer (1999), Preprints.org burnout review (2025), Learnmate Australia tutoring data (2025)</p>
            </div>
        </div>
    );
}