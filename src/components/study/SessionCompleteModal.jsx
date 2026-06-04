import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, X, Star, Zap } from "lucide-react";
import DifficultyRating from "@/components/shared/DifficultyRating";

// Per-technique accent (matches the Study page tiles). Static class strings
// (literals here) so Tailwind JIT keeps them.
const ACCENT = {
    pomodoro:      { text: "text-primary", btn: "bg-primary hover:bg-primary", ring: "bg-primary/15", icon: "text-primary" },
    active_recall: { text: "text-chart-4", btn: "bg-chart-4 hover:bg-chart-4", ring: "bg-chart-4/15", icon: "text-chart-4" },
    blurting:      { text: "text-xp",      btn: "bg-xp hover:bg-xp",           ring: "bg-xp/15",      icon: "text-xp" },
    spaced_repetition: { text: "text-chart-3", btn: "bg-chart-3 hover:bg-chart-3", ring: "bg-chart-3/15", icon: "text-chart-3" },
    exam:          { text: "text-streak",  btn: "bg-streak hover:bg-streak",   ring: "bg-streak/15",  icon: "text-streak" },
};

export default function SessionCompleteModal({ session, onSave, onCancel }) {
    const a = ACCENT[session.technique_name] || ACCENT.pomodoro;
    const [formData, setFormData] = useState({
        subject: "",
        topic: "",
        confidence_rating: 3,
        notes: ""
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md"
            >
                <Card className="bg-surface border-border shadow-2xl">
                    <CardHeader className="text-center">
                        <div className={`w-12 h-12 rounded-2xl ${a.ring} flex items-center justify-center mx-auto mb-1`}>
                            <Zap className={`w-6 h-6 ${a.icon}`} />
                        </div>
                        <CardTitle className={`text-2xl ${a.text}`}>
                            Session Complete!
                        </CardTitle>
                        <p className="text-muted-foreground">
                            You studied for {session.session_duration} minutes using {session.technique_name.replace('_', ' ')}!
                        </p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="subject">Subject *</Label>
                                <Input
                                    id="subject"
                                    value={formData.subject}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        subject: e.target.value
                                    }))}
                                    placeholder="e.g., Mathematics, Biology..."
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="topic">Topic</Label>
                                <Input
                                    id="topic"
                                    value={formData.topic}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        topic: e.target.value
                                    }))}
                                    placeholder="e.g., Quadratic equations"
                                />
                            </div>

                            {formData.subject && (
                                <div className="p-3 bg-secondary rounded-xl border border-border">
                                    <DifficultyRating subjectName={formData.subject} />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>How confident do you feel?</Label>
                                <div className="flex items-center gap-2 justify-center">
                                    {[1, 2, 3, 4, 5].map((rating) => (
                                        <button
                                            key={rating}
                                            type="button"
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                confidence_rating: rating
                                            }))}
                                            className={`p-2 rounded-lg transition-colors ${
                                                rating <= formData.confidence_rating
                                                    ? 'text-xp'
                                                    : 'text-muted-foreground/30'
                                            }`}
                                        >
                                            <Star className="w-6 h-6 fill-current" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Session notes (optional)</Label>
                                <Textarea
                                    id="notes"
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        notes: e.target.value
                                    }))}
                                    placeholder="What went well? What did you learn?"
                                    rows={3}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onCancel}
                                    className="flex-1"
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Skip
                                </Button>
                                <Button
                                    type="submit"
                                    className={`flex-1 text-white ${a.btn}`}
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    Save & Earn XP
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}