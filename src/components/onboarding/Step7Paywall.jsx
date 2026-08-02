import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Check, Loader2, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

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

export default function Step7Paywall({ onBack, onSkip }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubscribe = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await base44.functions.invoke('stripeCheckout', {
                priceId: import.meta.env.VITE_STRIPE_PRICE_PREMIUM,
                successUrl: `${window.location.origin}${createPageUrl("PaymentSuccess")}?session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: window.location.href,
            });

            const checkoutUrl = response?.data?.checkoutUrl || response?.checkoutUrl;
            if (!checkoutUrl) throw new Error(response?.data?.error || "No checkout URL returned");

            window.location.href = checkoutUrl;
        } catch (e) {
            console.error("Checkout error:", e);
            setError(e.message || "Could not start checkout. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto px-6 py-10">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground/60 hover:text-muted-foreground mb-6">
                <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="text-2xl font-bold text-foreground mb-1">One last step — subscribe to get started</h2>
            <p className="text-muted-foreground text-sm mb-2">$5/week. Cancel anytime.</p>


            {/* Plan card */}
            <div className="border-2 border-primary rounded-2xl p-6 mb-6">
                <p className="font-bold text-xl text-foreground mb-1">AcedIt Premium</p>
                <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-extrabold text-foreground">$5</span>
                    <span className="text-muted-foreground text-sm">/week</span>
                </div>
                <p className="text-xs text-muted-foreground/60 mb-5">Cancel anytime. No lock-in contract.</p>

                {/* Value anchor */}
                <div className="rounded-xl p-3 mb-5" style={{ backgroundColor: undefined }}>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                        Melbourne private tutors charge <strong>$60–$120 per hour</strong> (Learnmate Australia, 2025). AcedIt gives you AI-powered study support for <strong>$5/week</strong> — available at 2am the night before your SAC.
                    </p>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-6">
                    {FEATURES.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                            <span className="text-xs text-muted-foreground">{f}</span>
                        </div>
                    ))}
                </div>

                {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

                <Button
                    onClick={handleSubscribe}
                    disabled={loading}
                    className="w-full h-12 text-base font-semibold"
                >
                    {loading
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Redirecting to payment...</>
                        : <><Lock className="w-4 h-4 mr-2" />Subscribe now →</>
                    }
                </Button>

                <div className="mt-4 text-center">
                    <button
                        onClick={onSkip}
                        className="text-sm text-muted-foreground hover:text-muted-foreground underline underline-offset-2"
                    >
                        Continue with free plan →
                    </button>
                    <p className="text-xs text-muted-foreground/60 mt-2">Free plan includes 500 AI credits, flashcards, active recall, and blurting method. Upgrade anytime from your profile.</p>
                </div>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-2 gap-2 mb-6 text-xs text-muted-foreground">
                {["Secure Stripe checkout", "Cancel anytime", "No lock-in contract", "Instant access"].map((t, i) => (
                    <div key={i} className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> {t}</div>
                ))}
            </div>

            {/* Research close */}
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="text-sm font-bold text-green-800 mb-2">What the research says about students who don't burn out</p>
                <p className="text-xs text-green-700 leading-relaxed mb-2">They don't study more hours than their peers. They use retrieval practice, spaced review, and immediate feedback loops. They know their weak topics before exams find them. And they maintain consistent daily habits rather than last-minute cramming. These are not natural talents — they are learnable systems. That is what AcedIt is built to give you.</p>
                <p className="text-xs text-green-500">Based on: Roediger & Karpicke (2006), Dunlosky et al. (2013), Ebbinghaus (1885), Gollwitzer (1999), Preprints.org burnout review (2025), Learnmate Australia tutoring data (2025)</p>
            </div>
        </div>
    );
}