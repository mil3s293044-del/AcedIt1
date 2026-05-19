import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    Crown, 
    Check, 
    Star,
    CreditCard,
    Loader2,
    Gift
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const pricingPlans = [
    {
        tier: "free",
        name: "Free",
        price: "$0",
        description: "Get a real taste — manual study, full social, 3 free AI generations",
        icon: Gift,
        features: [
            "Pomodoro timer & study sessions",
            "Manual quizzes & flashcards (unlimited)",
            "Subjects, basic goals, competitions, wagers",
            "XP, streaks, friends, leaderboards",
            "3 AI-generated quizzes (lifetime)",
            "3 AI-generated flashcard sets (lifetime)"
        ],
        limitations: [
            "No AI Tools (Essay Planner, Math Tutor, etc.)",
            "No Spaced Repetition",
            "No Blurting or Active Recall AI",
            "No Goal AI generation",
            "No Advanced Analytics"
        ]
    },
    {
        tier: "premium",
        name: "Premium",
        price: "$5",
        priceId: import.meta.env.VITE_STRIPE_PRICE_PREMIUM,
        description: "Everything unlocked — for serious VCE study",
        icon: Crown,
        popular: true,
        features: [
            "Everything in Free, plus:",
            "Daily AI-generated quizzes & flashcard sets",
            "All 10 AI study tools",
            "AI quiz marking with detailed feedback",
            "Goal & Roadmap AI generation",
            "Spaced Repetition (SM-2 algorithm)",
            "Blurting & Active Recall with AI marking",
            "Advanced Analytics & Performance Coach",
            "Priority support"
        ]
    }
];

export default function Subscription() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const currentUser = await base44.auth.me();
            setUser(currentUser);

            const profiles = await base44.entities.UserProfile.filter({ created_by: currentUser.email });
            setUserProfile(profiles[0] || null);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleManageSubscription = async () => {
        setIsProcessing(true);
        try {
            const response = await base44.functions.invoke('stripePortal', {
                returnUrl: `${window.location.origin}${createPageUrl("Subscription")}`
            });
            const portalUrl = response?.data?.portalUrl || response?.portalUrl;
            
            if (portalUrl) {
                window.location.href = portalUrl;
            } else {
                throw new Error("No portal URL returned");
            }
        } catch (error) {
            console.error("Error opening portal:", error);
            toast({ 
                title: "Error", 
                description: "Could not open subscription management. Please try again.",
                variant: "destructive" 
            });
            setIsProcessing(false);
        }
    };

    const currentTier = userProfile?.subscription_tier || 'free';
    const isPremium = currentTier === 'premium';
    const expiresAt = userProfile?.subscription_expires_at;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-8 min-h-screen">
            <div className="max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                            <Crown className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                            Subscription
                        </h1>
                    </div>
                    <p className="text-gray-600 text-lg">
                        {isPremium
                            ? "Manage your Premium subscription"
                            : "Manage your subscription and unlock premium features"}
                    </p>
                </motion.div>

                {/* Current Plan Status */}
                {isPremium && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                                            <Crown className="w-8 h-8 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900">Premium Member</h3>
                                            <p className="text-gray-600 text-sm">
                                                {expiresAt ? `Active until ${format(new Date(expiresAt), 'MMM d, yyyy')}` : 'Active subscription'}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleManageSubscription}
                                        disabled={isProcessing}
                                        variant="outline"
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <CreditCard className="w-4 h-4 mr-2" />
                                        )}
                                        Manage Subscription
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Value Proposition */}
                {!isPremium && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8 text-center"
                    >
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Unlock Your Full Study Potential
                        </h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            Join thousands of students who have upgraded to Premium and achieved their academic goals with unlimited AI-powered tools
                        </p>
                    </motion.div>
                )}

                {/* Pricing Plans */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {pricingPlans.map((plan, index) => {
                        const Icon = plan.icon;
                        const isCurrentPlan = currentTier === plan.tier;

                        return (
                            <motion.div
                                key={plan.tier}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="h-full"
                            >
                                <Card className={`relative overflow-hidden h-full transition-all duration-300 ${
                                    plan.popular ? 'border-2 border-indigo-500 shadow-2xl scale-105' : ''
                                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}>
                                    {plan.popular && (
                                        <div className="absolute top-0 right-0">
                                            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                                                MOST POPULAR
                                            </div>
                                        </div>
                                    )}
                                    {isCurrentPlan && (
                                        <div className="absolute top-0 left-0">
                                            <div className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-br-lg flex items-center gap-1">
                                                <Check className="w-3 h-3" />
                                                ACTIVE
                                            </div>
                                        </div>
                                    )}

                                    <CardContent className="p-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                                plan.tier === 'premium' 
                                                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600' 
                                                    : 'bg-gray-100'
                                            }`}>
                                                <Icon className={`w-6 h-6 ${plan.tier === 'premium' ? 'text-white' : 'text-gray-600'}`} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                                                <p className="text-gray-600 text-sm">{plan.description}</p>
                                            </div>
                                        </div>

                                        <div className="mb-6">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-5xl font-bold text-gray-900">{plan.price}</span>
                                                {plan.tier === 'premium' && (
                                                    <span className="text-gray-600">/week</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-3 mb-6">
                                            {plan.features.map((feature, i) => (
                                                <div key={i} className="flex items-start gap-2">
                                                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                                    <span className="text-gray-700 text-sm">{feature}</span>
                                                </div>
                                            ))}
                                            {plan.limitations?.map((limitation, i) => (
                                                <div key={i} className="flex items-start gap-2 opacity-60">
                                                    <span className="text-gray-500 text-sm">✕ {limitation}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {plan.tier === 'premium' && !isPremium && (
                                            <Button
                                                onClick={() => navigate(createPageUrl("Checkout"))}
                                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                                size="lg"
                                            >
                                                <Crown className="w-4 h-4 mr-2" />
                                                Upgrade to Premium
                                            </Button>
                                        )}

                                        {isCurrentPlan && (
                                            <div className="w-full bg-green-100 text-green-700 py-3 rounded-lg text-center font-semibold">
                                                Current Plan
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Testimonials / Social Proof */}
                {!isPremium && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-indigo-200">
                            <CardContent className="p-8">
                                <div className="text-center">
                                    <Star className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                                        Why Students Love AcedIt Premium
                                    </h3>
                                    <div className="grid md:grid-cols-3 gap-6 mt-6">
                                        <div className="text-center">
                                            <div className="text-3xl font-bold text-indigo-600 mb-2">∞</div>
                                            <p className="text-sm text-gray-700">Unlimited AI Generation</p>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-3xl font-bold text-indigo-600 mb-2">10x</div>
                                            <p className="text-sm text-gray-700">Faster Study Prep</p>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-3xl font-bold text-indigo-600 mb-2">100%</div>
                                            <p className="text-sm text-gray-700">Full Tool Access</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Feature Comparison */}
                <Card className="shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                        <CardTitle className="text-xl">Detailed Feature Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Feature</th>
                                        <th className="text-center py-3 px-4 font-semibold text-gray-900">Free</th>
                                        <th className="text-center py-3 px-4 font-semibold text-gray-900">Premium</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { feature: "Pomodoro Timer", free: true, premium: true },
                                        { feature: "AI Credits", free: "3 lifetime quizzes + 3 lifetime flashcards", premium: "Full access with daily fair-use caps" },
                                        { feature: "AI Flashcards", free: "100 credits each", premium: "Unlimited" },
                                        { feature: "AI Quizzes", free: "100 credits each", premium: "Unlimited" },
                                        { feature: "Goals & Planning", free: false, premium: true },
                                        { feature: "Study Planner", free: false, premium: true },
                                        { feature: "AI Tools", free: false, premium: true },
                                        { feature: "AI Quiz Marking", free: false, premium: true },
                                        { feature: "Advanced Techniques", free: false, premium: true },
                                        { feature: "Share Content", free: false, premium: true },
                                        { feature: "Friends", free: "Add only", premium: "Full access" }
                                    ].map((item, i) => (
                                        <tr key={i} className="border-b hover:bg-gray-50">
                                            <td className="py-3 px-4 text-gray-700">{item.feature}</td>
                                            <td className="py-3 px-4 text-center">
                                                {typeof item.free === 'boolean' ? (
                                                    item.free ? (
                                                        <Check className="w-5 h-5 text-green-600 mx-auto" />
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )
                                                ) : (
                                                    <span className="text-sm text-gray-600">{item.free}</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {typeof item.premium === 'boolean' ? (
                                                    item.premium ? (
                                                        <Check className="w-5 h-5 text-green-600 mx-auto" />
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )
                                                ) : (
                                                    <span className="text-sm font-semibold text-indigo-600">{item.premium}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* FAQ Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8"
                >
                    <Card>
                        <CardHeader>
                            <CardTitle>Frequently Asked Questions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Can I cancel anytime?</h4>
                                <p className="text-gray-600 text-sm">
                                    Yes! You can cancel your Premium subscription at any time through the Manage Subscription portal. Your access will continue until the end of your billing period.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">What happens to my credits if I upgrade?</h4>
                                <p className="text-gray-600 text-sm">
                                    When you upgrade to Premium, you get unlimited AI credits immediately. You'll never have to worry about running out or waiting for credits to reset.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Is there a student discount?</h4>
                                <p className="text-gray-600 text-sm">
                                    The current Premium price is already optimized for students! At just $5/week, you get full access to all AI-powered study tools.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h4>
                                <p className="text-gray-600 text-sm">
                                    We accept all major credit cards, debit cards, and digital wallets through our secure Stripe payment processor.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* CTA Footer */}
                {!isPremium && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 text-center"
                    >
                        <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 border-0">
                            <CardContent className="p-8">
                                <Crown className="w-16 h-16 text-white mx-auto mb-4" />
                                <h3 className="text-2xl font-bold text-white mb-3">
                                    Ready to Excel in Your Studies?
                                </h3>
                                <p className="text-indigo-100 mb-6 max-w-2xl mx-auto">
                                    Upgrade to Premium today and get unlimited access to all AI-powered study tools, advanced techniques, and premium features.
                                </p>
                                <Button
                                    onClick={() => navigate(createPageUrl("Checkout"))}
                                    size="lg"
                                    className="bg-white text-indigo-600 hover:bg-gray-100"
                                >
                                    <Crown className="w-5 h-5 mr-2" />
                                    Upgrade to Premium Now
                                </Button>
                                <p className="text-indigo-200 text-xs mt-4">
                                    Cancel anytime • Secure payment via Stripe • Instant access
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </div>
        </div>
    );
}