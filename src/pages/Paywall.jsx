import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import BrandMark from "@/components/shared/BrandMark";
import { base44 } from "@/api/base44Client";
import { stripeCheckout } from "@/api/functionsShim";
import { TOOL_COUNT } from "@/components/ai_tools/chatTools";
import AceShuffle from "@/components/ace/AceShuffle";

const FEATURES = [
    "Unlimited AI practice questions generated from your own notes",
    "AI marks your SAC answers with a full-marks model answer",
    "Ace, your study companion, awake whenever you are",
    `All ${TOOL_COUNT} AI study tools: essay planner, concept explainer, maths tutor, blurting method, teaching assistant, note summariser, question generator, practice answer generator`,
    "AI marking for blurting and active recall, against the study design",
    "Goal and strategy plans written for your own SAC dates",
    "A fresh stack of AI credits every Monday, spent however you like",
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
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 py-12">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-10">
                <BrandMark size="lg" />
            </div>

            <h1 className="text-3xl font-extrabold text-foreground text-center mb-2">{heading}</h1>
            <p className="text-muted-foreground text-sm text-center mb-8">7 days completely free. Then $5/week. Cancel anytime before the trial ends and you won't be charged.</p>

            {/* Plan card */}
            <div className="w-full max-w-md bg-surface border-2 border-chart-4 rounded-2xl p-6 mb-6">
                <div className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 bg-chart-4 text-white">
                    7-day free trial
                </div>
                <p className="font-bold text-xl text-foreground mb-1">AcedIt Premium</p>
                <p className="text-3xl font-extrabold text-foreground mb-0.5">Free for 7 days</p>
                <p className="text-sm text-muted-foreground mb-1">then $5/week</p>
                <p className="text-xs text-muted-foreground/60 mb-4">Cancel before day 7 and pay nothing.</p>

                <div className="rounded-xl p-3 mb-5 bg-chart-4/10 border border-chart-4/20">
                    <p className="text-xs text-foreground/80 leading-relaxed">
                        Melbourne private tutors charge <strong>$60–$120 per hour</strong> (Learnmate Australia, 2025). AcedIt gives you AI-powered study support for <strong>$5/week</strong> — available at 2am the night before your SAC.
                    </p>
                </div>

                <div className="space-y-2 mb-6">
                    {FEATURES.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-chart-4" />
                            <span className="text-xs text-muted-foreground">{f}</span>
                        </div>
                    ))}
                </div>

                <Button
                    onClick={handleCheckout}
                    disabled={loading}
                    className="w-full h-12 text-base font-semibold bg-chart-4 hover:bg-chart-4/90 text-white"
                >
                    {loading ? <><AceShuffle size="sm" className="mr-2" />Redirecting...</> : "Start my free 7-day trial →"}
                </Button>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-2 gap-2 mb-6 text-xs text-muted-foreground w-full max-w-md">
                {["No charge for 7 days", "Cancel anytime", "No lock-in contract", "Secure checkout"].map((t, i) => (
                    <div key={i} className="flex items-center gap-1"><Check className="w-3 h-3 text-primary" /> {t}</div>
                ))}
            </div>

            {/* Research close */}
            <div className="w-full max-w-md bg-primary/10 border border-primary/20 rounded-xl p-4">
                <p className="text-sm font-bold text-foreground mb-2">What the research says about students who stay the distance</p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">They study about the same hours as their peers. What differs is how: retrieval practice, spaced review, and immediate feedback loops. They know their weak topics before exams find them, and they keep a steady daily habit rather than cramming at the end. These are learnable systems rather than natural talents, and they are what AcedIt is built to give you.</p>
                <p className="text-xs text-muted-foreground/70">Based on: Roediger & Karpicke (2006), Dunlosky et al. (2013), Ebbinghaus (1885), Gollwitzer (1999), Preprints.org burnout review (2025), Learnmate Australia tutoring data (2025)</p>
            </div>
        </div>
    );
}