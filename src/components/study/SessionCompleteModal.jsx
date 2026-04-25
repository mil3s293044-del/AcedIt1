import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, X, Star, Zap } from "lucide-react";
import DifficultyRating from "@/components/shared/DifficultyRating";

export default function SessionCompleteModal({ session, onSave, onCancel }) {
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
                <Card className="bg-white shadow-2xl">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl text-green-600 flex items-center justify-center gap-2">
                            <Zap className="w-6 h-6" />
                            Session Complete!
                        </CardTitle>
                        <p className="text-gray-600">
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
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
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
                                                    ? 'text-yellow-500'
                                                    : 'text-gray-300'
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
                                    className="flex-1 bg-green-600 hover:bg-green-700"
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