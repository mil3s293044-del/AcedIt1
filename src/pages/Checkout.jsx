import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Crown,
    Check,
    Loader2,
    ArrowLeft,
    Shield,
    Lock,
    CreditCard
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { createPageUrl } from "@/utils";

const premiumFeatures = [
    "Unlimited AI Credits",
    "AI Quiz Marking with Solutions",
    "Goals & Study Planner",
    "All AI Tools Access",
    "Advanced Study Techniques",
    "Content Sharing with Friends",
    "Priority Support"
];

export default function Checkout() {
    const [isProcessing, setIsProcessing] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleCheckout = async () => {
        setIsProcessing(true);
        try {
            const response = await base44.functions.invoke('stripeCheckout', {
                priceId: import.meta.env.VITE_STRIPE_PRICE_PREMIUM,
                successUrl: `${window.location.origin}${createPageUrl("PaymentSuccess")}?session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${window.location.origin}${createPageUrl("Checkout")}`
            });

            const checkoutUrl = response?.data?.checkoutUrl || response?.checkoutUrl;

            if (!checkoutUrl) {
                throw new Error(response?.data?.error || response?.error || "No checkout URL returned");
            }

            window.location.href = checkoutUrl;
        } catch (error) {
            console.error("Error creating checkout:", error);
            toast({
                title: "Checkout Error",
                description: error.message || "Could not start checkout. Please try again.",
                variant: "destructive"
            });
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-10">
                {/* Back Button */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <Button
                        variant="ghost"
                        onClick={() => navigate(createPageUrl("Subscription"))}
                        className="mb-6"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Subscription
                    </Button>
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left Column - Order Summary */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="space-y-6"
                    >
                        <Card>
                            <CardHeader className="border-b border-border">
                                <CardTitle className="flex items-center gap-2 text-2xl">
                                    <Crown className="w-6 h-6 text-primary" />
                                    Premium Subscription
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                {/* Price */}
                                <div className="flex items-baseline justify-between">
                                    <div>
                                        <p className="text-muted-foreground text-sm mb-1">Weekly Subscription</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-5xl font-display font-extrabold text-foreground">$5</span>
                                            <span className="text-xl text-muted-foreground">AUD</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">per week</p>
                                    </div>
                                    <div className="w-16 h-16 bg-primary/15 rounded-2xl flex items-center justify-center">
                                        <Crown className="w-8 h-8 text-primary" />
                                    </div>
                                </div>

                                {/* Benefits */}
                                <div>
                                    <p className="font-semibold text-foreground mb-3">What's Included:</p>
                                    <div className="space-y-2">
                                        {premiumFeatures.map((feature, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <Check className="w-5 h-5 text-primary flex-shrink-0" />
                                                <span className="text-muted-foreground text-sm">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Billing Info */}
                                <div className="pt-4 border-t border-border space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span className="font-semibold text-foreground">$5.00 AUD</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Tax (GST)</span>
                                        <span className="font-semibold text-foreground">$0.00</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                                        <span className="text-foreground">Total due today</span>
                                        <span className="text-primary">$5.00 AUD</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Guarantee Card */}
                        <div className="card-soft p-6 border-2 border-primary/20 bg-primary/5">
                            <div className="flex items-start gap-3">
                                <Shield className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                                <div>
                                    <h4 className="font-bold text-foreground mb-1">Money-Back Guarantee</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Cancel anytime within 7 days for a full refund. No questions asked.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Column - Checkout */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                    >
                        <Card className="sticky top-8">
                            <CardHeader className="border-b border-border">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <CreditCard className="w-5 h-5 text-primary" />
                                    Secure Checkout
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                {/* User Info */}
                                <div className="p-4 bg-secondary/50 rounded-xl">
                                    <p className="text-sm text-muted-foreground mb-1">Subscribing as:</p>
                                    <p className="font-semibold text-foreground">Your Account</p>
                                    <p className="text-sm text-muted-foreground">Subscription will be linked to your account</p>
                                </div>

                                {/* Checkout Button */}
                                <Button
                                    onClick={handleCheckout}
                                    disabled={isProcessing}
                                    size="lg"
                                    className="w-full font-display"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Redirecting to Stripe...
                                        </>
                                    ) : (
                                        <>
                                            <Lock className="w-5 h-5 mr-2" />
                                            Proceed to Payment
                                        </>
                                    )}
                                </Button>

                                {/* Security Info */}
                                <div className="space-y-3 pt-4 border-t border-border">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Shield className="w-4 h-4 text-primary" />
                                        <span>256-bit SSL encrypted payment via Stripe</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Lock className="w-4 h-4 text-primary" />
                                        <span>PCI-DSS compliant processing</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Check className="w-4 h-4 text-primary" />
                                        <span>Cancel anytime, no commitments</span>
                                    </div>
                                </div>

                                <p className="text-xs text-muted-foreground text-center">
                                    By continuing, you agree to our{" "}
                                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Terms of Service</a>{" "}
                                    and{" "}
                                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Privacy Policy</a>.
                                    Your subscription will automatically renew weekly.
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
