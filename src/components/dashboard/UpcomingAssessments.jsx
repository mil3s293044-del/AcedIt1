
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertCircle, Clock, Brain } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format, differenceInDays, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function UpcomingAssessments({ user }) {
    const [assessments, setAssessments] = useState([]);
    const [flashcardReminders, setFlashcardReminders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (user?.email) {
            loadReminders();
        }
    }, [user]);

    const loadReminders = async () => {
        try {
            const [allAssessments, allFlashcards] = await Promise.all([
                base44.entities.SubjectAssessment.filter({ 
                    created_by: user.email,
                    is_completed: false 
                }, "due_date", 10),
                base44.entities.Flashcard.filter({
                    created_by: user.email,
                    is_active: true
                }, "next_review_date")
            ]);
            
            const upcoming = allAssessments.filter(assessment => {
                const daysUntil = differenceInDays(parseISO(assessment.due_date), new Date());
                return daysUntil >= 0 && daysUntil <= 30;
            });
            
            const today = format(new Date(), 'yyyy-MM-dd');
            const dueFlashcards = allFlashcards.filter(card => card.next_review_date && card.next_review_date <= today);
            
            const deckMap = {};
            dueFlashcards.forEach(card => {
                if (!deckMap[card.deck_id]) {
                    deckMap[card.deck_id] = {
                        deck_id: card.deck_id,
                        subject: card.subject_name,
                        topic: card.topic || "General",
                        next_review_date: card.next_review_date,
                        cards: []
                    };
                }
                deckMap[card.deck_id].cards.push(card);
            });
            
            setAssessments(upcoming);
            setFlashcardReminders(Object.values(deckMap));
        } catch (error) {
            console.error("Error loading reminders:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getDaysUntil = (dateString) => {
        const days = differenceInDays(parseISO(dateString), new Date());
        if (days === 0) return "Today";
        if (days === 1) return "Tomorrow";
        if (days < 0) return "Overdue";
        return `${days} days`;
    };

    const getUrgencyColor = (dateString) => {
        const days = differenceInDays(parseISO(dateString), new Date());
        if (days < 0) return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", badgeBg: "bg-red-100", badgeText: "text-red-800" };
        if (days === 0) return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", badgeBg: "bg-red-100", badgeText: "text-red-800" };
        if (days <= 3) return { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", badgeBg: "bg-orange-100", badgeText: "text-orange-800" };
        if (days <= 7) return { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", badgeBg: "bg-yellow-100", badgeText: "text-yellow-800" };
        return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", badgeBg: "bg-blue-100", badgeText: "text-blue-800" };
    };

    const handleFlashcardClick = (deckId) => {
        // Navigate to Study page and automatically start review for this deck
        navigate(createPageUrl("Study"));
        
        // Use setTimeout to ensure the page has loaded before triggering the deck review
        setTimeout(() => {
            const event = new CustomEvent('startFlashcardReview', {
                detail: { deckId }
            });
            window.dispatchEvent(event);
        }, 500);
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        Reminders
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse h-24 bg-gray-200 rounded-lg" />
                </CardContent>
            </Card>
        );
    }

    const totalReminders = assessments.length + flashcardReminders.length;

    if (totalReminders === 0) {
        return (
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-800">
                        <AlertCircle className="w-5 h-5" />
                        Reminders
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-6 text-green-700">
                        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="font-medium">All caught up!</p>
                        <p className="text-sm opacity-75">No reminders at the moment.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border-orange-200">
            <CardHeader>
                <CardTitle className="flex items-center justify-between text-orange-900">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Reminders
                    </div>
                    <Badge className="bg-orange-200 text-orange-900 text-sm font-bold">{totalReminders}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {/* Flashcard Review Reminders */}
                {flashcardReminders.map((deck, index) => (
                    <motion.div
                        key={deck.deck_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleFlashcardClick(deck.deck_id)}
                        className="flex items-center gap-3 p-3 bg-white/80 backdrop-blur-sm rounded-lg border border-purple-200 cursor-pointer hover:shadow-md hover:border-purple-300 transition-all group"
                    >
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                            <Brain className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 truncate leading-tight">
                                {deck.subject} • {deck.topic}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5">
                                    {deck.cards.length} card{deck.cards.length !== 1 ? 's' : ''}
                                </Badge>
                                <span className="text-xs text-gray-600">Review now</span>
                            </div>
                        </div>
                    </motion.div>
                ))}

                {/* Assessment Reminders */}
                {assessments.slice(0, 5).map((assessment, index) => {
                    const colors = getUrgencyColor(assessment.due_date);
                    return (
                        <motion.div
                            key={assessment.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: (flashcardReminders.length + index) * 0.05 }}
                            className={`flex items-center gap-3 p-3 ${colors.bg} rounded-lg border ${colors.border} hover:shadow-md transition-all group`}
                        >
                            <div className={`w-10 h-10 ${colors.badgeBg} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                <Clock className={`w-5 h-5 ${colors.badgeText}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-sm ${colors.text} truncate leading-tight`}>
                                    {assessment.title}
                                </p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <Badge className={`${colors.badgeBg} ${colors.badgeText} text-xs px-2 py-0.5 border-0`}>
                                        {assessment.assessment_type}
                                    </Badge>
                                    <span className="text-xs text-gray-600">
                                        {assessment.subject_name} • {getDaysUntil(assessment.due_date)}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
                
                {assessments.length > 5 && (
                    <div className="text-center pt-2">
                        <p className="text-sm text-gray-600 font-medium">
                            +{assessments.length - 5} more assessment{assessments.length - 5 !== 1 ? 's' : ''}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
