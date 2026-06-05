import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Crown, Check, Star, CreditCard, Loader2, Gift, Sparkles, X } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const pricingPlans = [
    {
        tier: "free",
        name: "Free",
        price: "$0",
        description: "A real taste — manual study, full social, a few AI generations.",
        icon: Gift,
        features: [
            "Pomodoro timer & study sessions",
            "Manual quizzes & flashcards (unlimited)",
            "Subjects, basic goals, competitions, wagers",
            "XP, streaks, friends, leaderboards",
            "5 AI-generated quizzes (lifetime)",
            "5 AI quiz markings (lifetime)",
            "5 AI-generated flashcard sets (lifetime)",
        ],
        limitations: [
            "No AI study tools (Essay Planner, Math Tutor, etc.)",
            "No Spaced Repetition",
            "No Blurting or Active Recall AI",
            "No Goal AI generation",
            "No Advanced Analytics",
        ],
    },
    {
        tier: "premium",
        name: "Premium",
        price: "$5",
        priceId: import.meta.env.VITE_STRIPE_PRICE_PREMIUM,
        description: "Everything unlocked — for serious VCE study.",
        icon: Crown,
        popular: true,
        features: [
            "Everything in Free, plus:",
            "Daily AI quizzes & flashcard sets",
            "All AI study tools",
            "AI quiz marking with detailed feedback",
            "Goal & Roadmap AI generation",
            "Spaced Repetition (SM-2 algorithm)",
            "Blurting & Active Recall with AI marking",
            "Advanced Analytics & Performance Coach",
            "Priority support",
        ],
    },
];

const COMPARISON = [
    { feature: "Pomodoro timer & sessions", free: true, premium: true },
    { feature: "Manual quizzes & flashcards", free: true, premium: true },
    { feature: "XP, streaks & leaderboards", free: true, premium: true },
    { feature: "AI quizzes", free: "5 lifetime", premium: "Daily" },
    { feature: "AI flashcards", free: "5 lifetime", premium: "Daily" },
    { feature: "AI quiz marking", free: "5 lifetime", premium: "Daily" },
    { feature: "AI study tools", free: false, premium: true },
    { feature: "Spaced Repetition", free: false, premium: true },
    { feature: "Blurting & Active Recall AI", free: false, premium: true },
    { feature: "Goal & Roadmap AI", free: false, premium: true },
    { feature: "Advanced Analytics", free: false, premium: true },
    { feature: "Priority support", free: false, premium: true },
];

const FAQS = [
    { q: "Can I cancel anytime?", a: "Yes — cancel any time from the Manage Subscription portal. Your access stays active until the end of your billing period." },
    { q: "What happens to my credits if I upgrade?", a: "You get daily AI access immediately, so you never have to wait for credits to reset." },
    { q: "Is there a student discount?", a: "The price is already set for students — $5/week for full access to every AI study tool." },
    { q: "What payment methods do you accept?", a: "All major credit and debit cards, plus digital wallets, through our secure Stripe checkout." },
];

export default function Subscription() {
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const currentUser = await base44.auth.me();
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
            const response = await base44.functions.invoke("stripePortal", {
                returnUrl: `${window.location.origin}${createPageUrl("Subscription")}`,
            });
            const portalUrl = response?.data?.portalUrl || response?.portalUrl;
            if (portalUrl) {
                window.location.href = portalUrl;
            } else {
                throw new Error("No portal URL returned");
            }
        } catch (error) {
            console.error("Error opening portal:", error);
            toast({ title: "Couldn't open the portal", description: "Please try again in a moment.", variant: "destructive" });
            setIsProcessing(false);
        }
    };

    const currentTier = userProfile?.subscription_tier || "free";
    const isPremium = currentTier === "premium";
    const expiresAt = userProfile?.subscription_expires_at;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-8">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                    <p className="text-sm text-muted-foreground font-medium mb-1">Membership</p>
                    <h1 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
                        {isPremium ? "Your Premium plan" : "Unlock your full study potential"}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm lg:text-base max-w-2xl">
                        {isPremium
                            ? "Manage your subscription and keep every AI tool at your fingertips."
                            : "Go Premium for daily AI quizzes, every study tool, and analytics that actually move your marks."}
                    </p>
                </motion.div>

                {/* Premium status */}
                {isPremium && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        className="card-soft p-6 border-2 border-primary/30 bg-primary/5">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                                    <Crown className="w-7 h-7 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-display font-extrabold text-foreground text-lg">Premium member</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {expiresAt ? `Active until ${format(new Date(expiresAt), "MMM d, yyyy")}` : "Active subscription"}
                                    </p>
                                </div>
                            </div>
                            <Button onClick={handleManageSubscription} disabled={isProcessing} variant="outline" className="rounded-xl">
                                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                                Manage subscription
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* Pricing plans */}
                <div className="grid md:grid-cols-2 gap-5">
                    {pricingPlans.map((plan, index) => {
                        const Icon = plan.icon;
                        const isCurrentPlan = currentTier === plan.tier;
                        const isPrem = plan.tier === "premium";
                        return (
                            <motion.div
                                key={plan.tier}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.08 }}
                                className={`relative card-soft p-6 lg:p-7 flex flex-col ${isPrem ? "border-2 border-primary" : ""}`}
                            >
                                {plan.popular && (
                                    <span className="absolute -top-3 left-6 pill bg-primary text-primary-foreground shadow-soft">
                                        <Sparkles className="w-3 h-3" /> Most popular
                                    </span>
                                )}
                                {isCurrentPlan && (
                                    <span className="absolute -top-3 right-6 pill bg-secondary text-foreground border border-border">
                                        <Check className="w-3 h-3" /> Current plan
                                    </span>
                                )}

                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isPrem ? "bg-primary/15" : "bg-secondary"}`}>
                                        <Icon className={`w-6 h-6 ${isPrem ? "text-primary" : "text-muted-foreground"}`} />
                                    </div>
                                    <div>
                                        <h3 className="font-display font-extrabold text-foreground text-xl">{plan.name}</h3>
                                    </div>
                                </div>

                                <p className="text-sm text-muted-foreground mb-4 leading-snug">{plan.description}</p>

                                <div className="flex items-baseline gap-1 mb-5">
                                    <span className="font-display font-extrabold text-foreground text-5xl">{plan.price}</span>
                                    {isPrem && <span className="text-muted-foreground text-sm font-medium">/week</span>}
                                </div>

                                <div className="space-y-2.5 mb-6 flex-1">
                                    {plan.features.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-2.5">
                                            <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-foreground leading-snug">{feature}</span>
                                        </div>
                                    ))}
                                    {plan.limitations?.map((limitation, i) => (
                                        <div key={i} className="flex items-start gap-2.5">
                                            <X className="w-4 h-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-muted-foreground/70 leading-snug">{limitation}</span>
                                        </div>
                                    ))}
                                </div>

                                {isPrem && !isPremium && (
                                    <Button onClick={() => navigate(createPageUrl("Checkout"))} size="lg" className="w-full btn-3d rounded-xl font-display font-extrabold">
                                        <Crown className="w-4 h-4 mr-2" /> Upgrade to Premium
                                    </Button>
                                )}
                                {isCurrentPlan && (
                                    <div className="w-full bg-secondary text-muted-foreground py-3 rounded-xl text-center font-bold text-sm">
                                        Your current plan
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* Social proof */}
                {!isPremium && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-soft p-6 lg:p-8 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-xp/15 flex items-center justify-center mx-auto mb-4">
                            <Star className="w-6 h-6 text-xp" fill="currentColor" />
                        </div>
                        <h3 className="font-display font-extrabold text-foreground text-xl mb-6">Why students go Premium</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {[
                                { num: "Daily", label: "AI quizzes & flashcards", color: "text-primary" },
                                { num: "10×", label: "Faster study prep", color: "text-chart-3" },
                                { num: "100%", label: "Full tool access", color: "text-chart-4" },
                            ].map((s) => (
                                <div key={s.label}>
                                    <p className={`font-display font-extrabold text-3xl ${s.color}`}>{s.num}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Feature comparison */}
                <div className="card-soft overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-secondary/40">
                        <h3 className="font-display font-extrabold text-foreground text-base">Full comparison</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-3 px-6 stat-label">Feature</th>
                                    <th className="text-center py-3 px-4 stat-label">Free</th>
                                    <th className="text-center py-3 px-4 stat-label text-primary">Premium</th>
                                </tr>
                            </thead>
                            <tbody>
                                {COMPARISON.map((item, i) => (
                                    <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                                        <td className="py-3 px-6 text-sm text-foreground">{item.feature}</td>
                                        <td className="py-3 px-4 text-center">
                                            {typeof item.free === "boolean"
                                                ? (item.free ? <Check className="w-4 h-4 text-primary mx-auto" /> : <span className="text-muted-foreground/40">—</span>)
                                                : <span className="text-xs font-medium text-muted-foreground">{item.free}</span>}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {typeof item.premium === "boolean"
                                                ? (item.premium ? <Check className="w-4 h-4 text-primary mx-auto" /> : <span className="text-muted-foreground/40">—</span>)
                                                : <span className="text-xs font-bold text-primary">{item.premium}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FAQ */}
                <div className="card-soft p-6 lg:p-8">
                    <h3 className="font-display font-extrabold text-foreground text-lg mb-5">Frequently asked questions</h3>
                    <div className="space-y-5">
                        {FAQS.map((f) => (
                            <div key={f.q}>
                                <h4 className="font-bold text-foreground text-sm mb-1">{f.q}</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CTA footer */}
                {!isPremium && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        className="rounded-3xl bg-primary text-primary-foreground p-8 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
                            <Crown className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="font-display font-extrabold text-2xl mb-2">Ready to ace it?</h3>
                        <p className="text-primary-foreground/90 text-sm mb-6 max-w-xl mx-auto">
                            Upgrade today for unlimited access to every AI study tool, advanced techniques and analytics.
                        </p>
                        <Button onClick={() => navigate(createPageUrl("Checkout"))} size="lg"
                            className="bg-white text-primary hover:bg-white/90 rounded-xl font-display font-extrabold btn-3d">
                            <Crown className="w-5 h-5 mr-2" /> Upgrade to Premium
                        </Button>
                        <p className="text-primary-foreground/80 text-xs mt-4">Cancel anytime · Secure payment via Stripe · Instant access</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
