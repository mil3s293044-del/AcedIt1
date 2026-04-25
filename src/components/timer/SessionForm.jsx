import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, X, Star } from "lucide-react";

export default function SessionForm({ onSave, onCancel, duration }) {
    const [formData, setFormData] = useState({
        subject: "",
        notes: "",
        productivity_rating: 3
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
                        <CardTitle className="text-2xl text-green-600">
                            🎉 Session Complete!
                        </CardTitle>
                        <p className="text-gray-600">
                            You focused for {duration} minutes. Great job!
                        </p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="subject">What did you study?</Label>
                                <Input
                                    id="subject"
                                    value={formData.subject}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        subject: e.target.value
                                    }))}
                                    placeholder="e.g., Mathematics, English Literature..."
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>How productive did you feel?</Label>
                                <div className="flex items-center gap-2">
                                    {[1, 2, 3, 4, 5].map((rating) => (
                                        <button
                                            key={rating}
                                            type="button"
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                productivity_rating: rating
                                            }))}
                                            className={`p-2 rounded-lg transition-colors ${
                                                rating <= formData.productivity_rating
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
                                    placeholder="What went well? Any insights?"
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
                                    Save Session
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}