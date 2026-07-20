import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    Crown, 
    Check, 
    Star,
    Sparkles,
    Brain,
    Target,
    Users,
    Loader2,
    ArrowRight,
    Lock,
    Unlock,
    BookOpen,
    Award,
    Infinity
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { createPageUrl } from "@/utils";
import { Link, useNavigate } from "react-router-dom";

const features = [
    {
        icon: Infinity,
        title: "Unlimited AI Credits",
        description: "Generate unlimited flashcards, quizzes, and study materials without worrying about credits",
        color: "from-yellow-500 to-orange-500"
    },
    {
        icon: Brain,
        title: "AI Quiz Marking",
        description: "Get instant AI-powered feedback on every quiz you take, with explanations for each answer",
        color: "from-purple-500 to-indigo-500"
    },
    {
        icon: Target,
        title: "Goals & Planning",
        description: "Set ATAR goals, plan your study path, and track your progress with intelligent insights",
        color: "from-green-500 to-emerald-500"
    },
    {
        icon: Sparkles,
        title: "All AI Tools",
        description: "Essay Planner, Concept Explainer, Question Generator, Note Summarizer, and more",
        color: "from-pink-500 to-rose-500"
    },
    {
        icon: BookOpen,
        title: "Advanced Techniques",
        description: "Active Recall, Blurting Method, and other proven study techniques to ace your exams",
        color: "from-blue-500 to-cyan-500"
    },
    {
        icon: Users,
        title: "Content Sharing",
        description: "Share flashcards, quizzes, and study materials with friends and study groups",
        color: "from-indigo-500 to-purple-500"
    }
];

const comparisonFeatures = [
    { name: "AI Credits", free: "500 (resets every 2 weeks)", premium: "Unlimited" },
    { name: "AI Flashcard Generation", free: "100 credits per deck", premium: "Unlimited" },
    { name: "AI Quiz Generation", free: "100 credits per quiz", premium: "Unlimited" },
    { name: "AI Quiz Marking", free: false, premium: true },
    { name: "Goals & Study Planner", free: false, premium: true },
    { name: "AI Tools Access", free: false, premium: true },
    { name: "Advanced Study Techniques", free: false, premium: true },
    { name: "Share Content with Friends", free: false, premium: true },
    { name: "Priority Support", free: false, premium: true }
];

export default function Premium() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
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

    const handleUpgrade = () => {
        window.location.href = createPageUrl("Checkout");
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const isPremium = userProfile?.subscription_tier === 'premium';

    if (isPremium) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="max-w-md border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                    <CardContent className="p-8 text-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Crown className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">You're Already Premium!</h2>
                        <p className="text-muted-foreground mb-6">You have access to all premium features.</p>
                        <Link to={createPageUrl("Dashboard")}>
                            <Button className="w-full">
                                Go to Dashboard
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 lg:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-full mb-4">
                        <Star className="w-4 h-4" />
                        <span className="text-sm font-semibold">Limited Time Offer</span>
                    </div>
                    <h1 className="text-5xl lg:text-6xl font-bold text-foreground mb-4">
                        Upgrade to{" "}
                        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            Premium
                        </span>
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                        Unlock unlimited AI-powered study tools and achieve your academic goals faster
                    </p>

                    {/* Pricing Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="inline-block"
                    >
                        <Card className="border-4 border-indigo-500 shadow-2xl bg-surface">
                            <CardContent className="p-8">
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center">
                                        <Crown className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-3xl font-bold text-foreground">$5 AUD</h3>
                                        <p className="text-muted-foreground">per week</p>
                                    </div>
                                </div>
                                <p className="text-muted-foreground mb-6">Cancel anytime • Instant access</p>
                                <Button
                                    onClick={handleUpgrade}
                                    size="lg"
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-lg h-14"
                                >
                                    <Crown className="w-5 h-5 mr-2" />
                                    Upgrade Now
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                                <p className="text-xs text-muted-foreground mt-3">
                                    Secure payment via Stripe
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                </motion.div>

                {/* Features Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-12"
                >
                    <h2 className="text-3xl font-bold text-center text-foreground mb-8">
                        Everything You Need to Excel
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 + index * 0.1 }}
                                >
                                    <Card className="h-full hover:shadow-xl transition-all duration-300 border-2 border-border hover:border-indigo-200 bg-surface">
                                        <CardContent className="p-6">
                                            <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4`}>
                                                <Icon className="w-6 h-6 text-white" />
                                            </div>
                                            <h3 className="text-xl font-bold text-foreground mb-2">
                                                {feature.title}
                                            </h3>
                                            <p className="text-muted-foreground text-sm">
                                                {feature.description}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Comparison Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mb-12"
                >
                    <h2 className="text-3xl font-bold text-center text-foreground mb-8">
                        Free vs Premium
                    </h2>
                    <Card className="max-w-4xl mx-auto shadow-xl bg-surface">
                        <CardContent className="p-8">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b-2">
                                            <th className="text-left py-4 px-4 font-bold text-foreground text-lg">Feature</th>
                                            <th className="text-center py-4 px-4">
                                                <div className="flex flex-col items-center">
                                                    <Lock className="w-5 h-5 text-muted-foreground/60 mb-2" />
                                                    <span className="font-bold text-foreground">Free</span>
                                                </div>
                                            </th>
                                            <th className="text-center py-4 px-4">
                                                <div className="flex flex-col items-center">
                                                    <Unlock className="w-5 h-5 text-indigo-600 mb-2" />
                                                    <span className="font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                                        Premium
                                                    </span>
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comparisonFeatures.map((feature, i) => (
                                            <tr key={i} className="border-b hover:bg-secondary/50 transition-colors">
                                                <td className="py-4 px-4 font-medium text-foreground">{feature.name}</td>
                                                <td className="py-4 px-4 text-center">
                                                    {typeof feature.free === 'boolean' ? (
                                                        feature.free ? (
                                                            <Check className="w-5 h-5 text-green-600 mx-auto" />
                                                        ) : (
                                                            <span className="text-2xl text-muted-foreground/40">—</span>
                                                        )
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">{feature.free}</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-center">
                                                    {typeof feature.premium === 'boolean' ? (
                                                        feature.premium ? (
                                                            <Check className="w-6 h-6 text-green-600 mx-auto" />
                                                        ) : (
                                                            <span className="text-2xl text-muted-foreground/40">—</span>
                                                        )
                                                    ) : (
                                                        <span className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                                            {feature.premium}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Social Proof */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="mb-12"
                >
                    <Card className="bg-gradient-to-br from-indigo-600 to-purple-600 border-0 text-white shadow-2xl">
                        <CardContent className="p-8 lg:p-12 text-center">
                            <Award className="w-16 h-16 mx-auto mb-6 opacity-90" />
                            <h2 className="text-3xl font-bold mb-4">Join Thousands of Successful Students</h2>
                            <div className="grid md:grid-cols-3 gap-8 mt-8">
                                <div>
                                    <div className="text-5xl font-bold mb-2">95%</div>
                                    <p className="text-indigo-100">Report Better Grades</p>
                                </div>
                                <div>
                                    <div className="text-5xl font-bold mb-2">10x</div>
                                    <p className="text-indigo-100">Faster Study Prep</p>
                                </div>
                                <div>
                                    <div className="text-5xl font-bold mb-2">100%</div>
                                    <p className="text-indigo-100">Money-Back Guarantee</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>


            </div>
        </div>
    );
}