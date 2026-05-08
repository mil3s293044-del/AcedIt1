import React, { useState, useEffect } from "react";
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
    CreditCard,
    Infinity,
    Brain,
    Target,
    Sparkles
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { createPageUrl } from "@/utils";

const premiumFeatures = [
    "Unlimited AI Credits",
    "AI Test Marker with Solutions",
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
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 lg:p-8">
            <div className="max-w-5xl mx-auto">
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

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Left Column - Order Summary */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="space-y-6"
                    >
                        <Card className="border-2 border-indigo-200 shadow-xl bg-white">
                            <CardHeader className="border-b">
                                <CardTitle className="flex items-center gap-2 text-2xl">
                                    <Crown className="w-6 h-6 text-indigo-600" />
                                    Premium Subscription
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                {/* Price */}
                                <div className="flex items-baseline justify-between">
                                    <div>
                                        <p className="text-gray-600 text-sm mb-1">Monthly Subscription</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-5xl font-bold text-gray-900">$10</span>
                                            <span className="text-xl text-gray-600">AUD</span>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">per month</p>
                                    </div>
                                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center">
                                        <Crown className="w-8 h-8 text-white" />
                                    </div>
                                </div>

                                {/* Benefits */}
                                <div>
                                    <p className="font-semibold text-gray-900 mb-3">What's Included:</p>
                                    <div className="space-y-2">
                                        {premiumFeatures.map((feature, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                                                <span className="text-gray-700 text-sm">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Billing Info */}
                                <div className="pt-4 border-t space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Subtotal</span>
                                        <span className="font-semibold text-gray-900">$10.00 AUD</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Tax (GST)</span>
                                        <span className="font-semibold text-gray-900">$0.00</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                                        <span className="text-gray-900">Total due today</span>
                                        <span className="text-indigo-600">$10.00 AUD</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Guarantee Card */}
                        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
                            <CardContent className="p-6">
                                <div className="flex items-start gap-3">
                                    <Shield className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <h4 className="font-bold text-green-900 mb-1">Money-Back Guarantee</h4>
                                        <p className="text-sm text-green-800">
                                            Cancel anytime within 7 days for a full refund. No questions asked.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Right Column - Checkout */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                    >
                        <Card className="border-2 border-gray-200 shadow-xl bg-white sticky top-8">
                            <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-purple-50">
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="w-5 h-5 text-indigo-600" />
                                    Secure Checkout
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                {/* User Info */}
                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-600 mb-1">Subscribing as:</p>
                                    <p className="font-semibold text-gray-900">Your Account</p>
                                    <p className="text-sm text-gray-600">Subscription will be linked to your account</p>
                                </div>

                                {/* Payment Provider */}
                                <div className="space-y-3">
                                    <p className="text-sm font-medium text-gray-700">Payment processed by:</p>
                                    <div className="flex items-center gap-3 p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50">
                                        <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                                            <Lock className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-indigo-900">Stripe</p>
                                            <p className="text-xs text-indigo-700">Secure payment processing</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Checkout Button */}
                                <Button
                                    onClick={handleCheckout}
                                    disabled={isProcessing}
                                    size="lg"
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-14 text-lg"
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
                                <div className="space-y-3 pt-4 border-t">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Shield className="w-4 h-4 text-green-600" />
                                        <span>256-bit SSL encrypted payment</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Lock className="w-4 h-4 text-green-600" />
                                        <span>PCI-DSS compliant processing</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Check className="w-4 h-4 text-green-600" />
                                        <span>Cancel anytime, no commitments</span>
                                    </div>
                                </div>

                                <p className="text-xs text-gray-500 text-center">
                                    By continuing, you agree to our Terms of Service and Privacy Policy. 
                                    Your subscription will automatically renew monthly.
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}