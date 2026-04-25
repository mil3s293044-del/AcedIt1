import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, CreditCard } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

export default function PaymentCancel() {
    return (
        <div className="p-4 lg:p-8 min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="max-w-2xl w-full"
            >
                <Card className="border-0 shadow-2xl overflow-hidden">
                    <div className="bg-gradient-to-br from-gray-600 to-slate-700 p-8 text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                            className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl"
                        >
                            <XCircle className="w-16 h-16 text-gray-600" />
                        </motion.div>
                        
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-4xl font-black text-white mb-3"
                        >
                            Payment Cancelled
                        </motion.h1>
                        
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-xl text-gray-100"
                        >
                            No charges were made to your account
                        </motion.p>
                    </div>

                    <CardContent className="p-8 text-center space-y-6">
                        <p className="text-gray-600 text-lg">
                            You cancelled the payment process. Don't worry - you can upgrade anytime when you're ready!
                        </p>

                        <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                                Still want to upgrade?
                            </h3>
                            <p className="text-gray-600 mb-4">
                                Premium features are waiting for you - unlimited AI tools, advanced analytics, and personalized study plans.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Link to={createPageUrl("Pricing")} className="block">
                                <Button className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                                    <CreditCard className="w-5 h-5 mr-2" />
                                    View Plans Again
                                </Button>
                            </Link>
                            
                            <Link to={createPageUrl("Dashboard")} className="block">
                                <Button variant="outline" className="w-full h-12 border-2">
                                    <ArrowLeft className="w-5 h-5 mr-2" />
                                    Back to Dashboard
                                </Button>
                            </Link>
                        </div>

                        <p className="text-sm text-gray-500 mt-6">
                            Questions about pricing? Contact us anytime for help.
                        </p>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}