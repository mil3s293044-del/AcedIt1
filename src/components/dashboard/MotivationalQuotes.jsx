import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Quote, RefreshCw } from "lucide-react";

const quotes = [
    { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
    { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "Education is the most powerful weapon you can use to change the world.", author: "Nelson Mandela" },
    { text: "The beautiful thing about learning is that nobody can take it away from you.", author: "B.B. King" },
    { text: "Study hard what interests you the most in the most undisciplined, irreverent and original manner possible.", author: "Richard Feynman" },
    { text: "It's not about being the best, it's about being better than you were yesterday.", author: "Unknown" },
    { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
    { text: "Success doesn't come from what you do occasionally, it comes from what you do consistently.", author: "Marie Forleo" },
    { text: "Your mind is a powerful thing. When you fill it with positive thoughts, your life will start to change.", author: "Unknown" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
    { text: "Challenges are what make life interesting. Overcoming them is what makes life meaningful.", author: "Joshua Marine" },
    { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
    { text: "Dream big, work hard, stay focused, and surround yourself with good people.", author: "Unknown" },
    { text: "Don't stop when you're tired. Stop when you're done.", author: "Unknown" },
    { text: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson" },
    { text: "Your limitation is only your imagination.", author: "Unknown" }
];

export default function MotivationalQuotes() {
    const [currentQuote, setCurrentQuote] = useState(0);

    useEffect(() => {
        const today = new Date();
        const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        setCurrentQuote(dayOfYear % quotes.length);
    }, []);

    const nextQuote = () => {
        setCurrentQuote((prev) => (prev + 1) % quotes.length);
    };

    const quote = quotes[currentQuote];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            <Card className="relative overflow-hidden border-0 shadow-lg">
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-yellow-500/10" />
                
                {/* Animated circles */}
                <motion.div
                    animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.05, 0.1, 0.05]
                    }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute top-0 right-0 w-32 h-32 bg-amber-400 rounded-full blur-3xl"
                />

                <CardContent className="relative p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                                <Quote className="w-4 h-4 text-white" />
                            </div>
                            <h3 className="font-semibold text-foreground">Daily Motivation</h3>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon"
                            aria-label="Next quote"
                            onClick={nextQuote}
                            className="hover:bg-amber-100/50 text-amber-700"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                    
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentQuote}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <blockquote className="text-base font-medium text-foreground mb-3 italic leading-relaxed">
                                "{quote.text}"
                            </blockquote>
                            <cite className="text-sm text-amber-700 font-semibold not-italic">
                                — {quote.author}
                            </cite>
                        </motion.div>
                    </AnimatePresence>
                </CardContent>
            </Card>
        </motion.div>
    );
}