import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { stripeCheckout } from "@/api/functionsShim";
import {
    Check,
    Crown,
    Zap,
    ArrowRight,
    Loader2,
    Shield
} from "lucide-react";

const pricingPlans = [
    {
        tier: "free",
        name: "Free",
        price: "$0",
        period: "forever",
        description: "Manual study, full social — feel the product before paying",
        icon: Zap,
        color: "from-gray-600 to-gray-700",
        features: [
            "Pomodoro timer & study sessions",
            "Manual quizzes & flashcards (unlimited)",
            "XP, streaks, friends, leaderboards",
            "Subjects, basic goals, competitions, wagers",
            "3 AI-generated quizzes (lifetime)",
            "3 AI-generated flashcard sets (lifetime)"
        ],
        limitations: [
            "No AI Tools (Essay Planner, Math Tutor, etc.)",
            "No AI Test Marker",
            "No Spaced Repetition",
            "No Blurting / Active Recall AI",
            "No Goal & Roadmap AI",
            "No Advanced Analytics"
        ]
    },
    {
        tier: "premium",
        name: "Premium",
        price: "$5",
        period: "per week",
        priceId: import.meta.env.VITE_STRIPE_PRICE_PREMIUM,
        description: "Everything unlocked, with fair-use daily limits",
        icon: Crown,
        color: "from-purple-600 to-pink-600",
        popular: true,
        features: [
            "All free features, plus:",
            "Daily AI-generated quizzes & flashcard sets",
            "All 10 AI study tools",
            "AI Test Marker with detailed feedback",
            "Goal & Roadmap AI generation",
            "Spaced Repetition (SM-2)",
            "Blurting & Active Recall with AI marking",
            "Advanced Analytics & Performance Coach",
            "Priority support"
        ],
        limitations: []
    }
];

export default function Pricing() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [processingTier, setProcessingTier] = useState(null);
    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const currentUser = await base44.auth.me();
            setUser(currentUser);

            const profiles = await base44.entities.UserProfile.filter({ 
                created_by: currentUser.email 
            });
            setUserProfile(profiles[0] || null);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubscribe = async (plan) => {
        if (!user) {
            toast({ 
                title: "Login required", 
                description: "Please log in to subscribe.",
                variant: "destructive" 
            });
            return;
        }

        if (plan.tier === "free") {
            toast({ 
                title: "Already on Free tier", 
                description: "You're currently using the free plan." 
            });
            return;
        }

        setProcessingTier(plan.tier);

        try {
            const response = await stripeCheckout({
                priceId: plan.priceId,
                tier: plan.tier,
                successUrl: `${window.location.origin}/PaymentSuccess?session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${window.location.origin}/Pricing`,
            });

            const url = response?.data?.checkoutUrl || response?.data?.url || response?.checkoutUrl;
            if (url) {
                window.location.href = url;
            } else {
                throw new Error("No checkout URL received");
            }
        } catch (error) {
            console.error("Checkout error:", error);
            toast({ 
                title: "Checkout failed", 
                description: "Could not start checkout. Please try again.",
                variant: "destructive" 
            });
            setProcessingTier(null);
        }
    };

    const currentTier = userProfile?.subscription_tier || "free";

    if (isLoading) {
        return (
            <div className="p-4 lg:p-8 min-h-screen flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-8 min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <h1 className="text-4xl lg:text-5xl font-black mb-4 bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 bg-clip-text text-transparent">
                        Upgrade Your Study Game
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Choose the perfect plan to ace your VCE and reach your goals
                    </p>
                    {currentTier !== "free" && (
                        <Badge className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                            Current Plan: {currentTier.toUpperCase()}
                        </Badge>
                    )}
                </motion.div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
                    {pricingPlans.map((plan, index) => {
                        const Icon = plan.icon;
                        const isCurrentPlan = currentTier === plan.tier;
                        
                        return (
                            <motion.div
                                key={plan.tier}
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`relative ${plan.popular ? 'md:-mt-4 md:mb-4' : ''}`}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-5 left-0 right-0 flex justify-center">
                                        <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1">
                                            Most Popular
                                        </Badge>
                                    </div>
                                )}

                                <Card className={`h-full border-2 transition-all ${
                                    plan.popular 
                                        ? 'border-blue-500 shadow-2xl scale-105' 
                                        : isCurrentPlan
                                        ? 'border-green-500 shadow-xl'
                                        : 'border-gray-200 hover:border-gray-300 shadow-lg hover:shadow-xl'
                                }`}>
                                    <CardHeader className={`bg-gradient-to-br ${plan.color} text-white rounded-t-lg pb-8`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <Icon className="w-8 h-8" />
                                            {isCurrentPlan && (
                                                <Badge className="bg-white/20 text-white">
                                                    <Check className="w-3 h-3 mr-1" />
                                                    Active
                                                </Badge>
                                            )}
                                        </div>
                                        <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                                        <p className="text-white/90 text-sm mt-2">{plan.description}</p>
                                        <div className="mt-6">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-4xl font-black">{plan.price}</span>
                                                <span className="text-white/80">/{plan.period}</span>
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="p-6 space-y-6">
                                        <div className="space-y-3">
                                            {plan.features.map((feature, idx) => (
                                                <div key={idx} className="flex items-start gap-3">
                                                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                                    <span className="text-gray-700">{feature}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            onClick={() => handleSubscribe(plan)}
                                            disabled={isCurrentPlan || processingTier === plan.tier}
                                            className={`w-full h-12 text-base font-semibold ${
                                                plan.popular
                                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                                                    : plan.tier === "premium"
                                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                                                    : ''
                                            }`}
                                        >
                                            {processingTier === plan.tier ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                    Processing...
                                                </>
                                            ) : isCurrentPlan ? (
                                                <>
                                                    <Check className="w-5 h-5 mr-2" />
                                                    Current Plan
                                                </>
                                            ) : (
                                                <>
                                                    {plan.tier === "free" ? "Current Plan" : "Upgrade Now"}
                                                    <ArrowRight className="w-5 h-5 ml-2" />
                                                </>
                                            )}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>

                {/* FAQ Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="max-w-3xl mx-auto"
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-center">Frequently Asked Questions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Can I cancel anytime?</h4>
                                <p className="text-gray-600">
                                    Yes! You can cancel your subscription at any time from your Settings page. You'll continue to have access until the end of your billing period.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h4>
                                <p className="text-gray-600">
                                    We accept all major credit and debit cards through our secure Stripe payment processor.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Can I upgrade or downgrade later?</h4>
                                <p className="text-gray-600">
                                    Absolutely! You can change your plan at any time. Upgrades take effect immediately, and downgrades apply at the end of your current billing period.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Is my payment information secure?</h4>
                                <p className="text-gray-600 flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-green-600" />
                                    Yes! We use Stripe, a PCI-compliant payment processor trusted by millions. We never store your card details.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}