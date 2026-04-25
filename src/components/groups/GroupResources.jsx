
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    Brain, 
    FileQuestion,
    Sparkles,
    Download,
    Eye,
    Share2,
    Filter,
    Check // Added Check icon
} from "lucide-react";
import { GroupSharedResource, Flashcard, Quiz, AISavedResult, GroupMessage } from "@/entities/all";
import { useToast } from "@/components/ui/use-toast";
import { format, addDays } from "date-fns";

export default function GroupResources({ group, user }) {
    const [resources, setResources] = useState([]);
    const [filteredResources, setFilteredResources] = useState([]);
    const [filterType, setFilterType] = useState("all");
    const [isLoading, setIsLoading] = useState(true);
    const [isSharing, setIsSharing] = useState(false);
    const [shareType, setShareType] = useState("");
    const [userFlashcardDecks, setUserFlashcardDecks] = useState([]);
    const [userQuizzes, setUserQuizzes] = useState([]);
    const [userAIResults, setUserAIResults] = useState([]);
    const [selectedItemToShare, setSelectedItemToShare] = useState(null);
    const { toast } = useToast();

    useEffect(() => {
        loadResources();
        loadUserContent();
    }, [group.id]);

    useEffect(() => {
        if (filterType === "all") {
            setFilteredResources(resources);
        } else {
            setFilteredResources(resources.filter(r => r.resource_type === filterType));
        }
    }, [filterType, resources]);

    const loadResources = async () => {
        try {
            const groupResources = await GroupSharedResource.filter({ group_id: group.id }, "-created_date");
            setResources(groupResources || []);
        } catch (error) {
            console.error("Error loading resources:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadUserContent = async () => {
        try {
            // Load user's flashcard decks
            const flashcards = await Flashcard.filter({ created_by: user.email, is_active: true });
            const deckGroups = {};
            flashcards.forEach(card => {
                const deckKey = card.deck_id || `${card.subject_name}_${card.topic}`;
                if (!deckGroups[deckKey]) {
                    deckGroups[deckKey] = {
                        id: deckKey,
                        subject: card.subject_name,
                        topic: card.topic,
                        cards: []
                    };
                }
                deckGroups[deckKey].cards.push(card);
            });
            setUserFlashcardDecks(Object.values(deckGroups));

            // Load user's quizzes
            const quizzes = await Quiz.filter({ created_by: user.email });
            setUserQuizzes(quizzes || []);

            // Load user's AI results
            const aiResults = await AISavedResult.filter({ created_by: user.email });
            setUserAIResults(aiResults || []);
        } catch (error) {
            console.error("Error loading user content:", error);
        }
    };

    const handleStartShare = (type) => {
        setShareType(type);
        setIsSharing(true);
    };

    const handleShareResource = async () => {
        if (!selectedItemToShare) {
            toast({ title: "No item selected", variant: "destructive" });
            return;
        }

        try {
            let resourceData = {};
            let title = "";
            let description = "";
            let subject = "";
            let topic = "";

            if (shareType === "flashcard_deck") {
                const deck = userFlashcardDecks.find(d => d.id === selectedItemToShare);
                // FIXED: Use 'flashcards' instead of 'cards' for consistency
                resourceData = {
                    flashcards: deck.cards.map(c => ({
                        question: c.question,
                        answer: c.answer,
                        subject_name: c.subject_name,
                        topic: c.topic
                    }))
                };
                title = `${deck.subject} - ${deck.topic}`;
                description = `Flashcard deck with ${deck.cards.length} cards`;
                subject = deck.subject;
                topic = deck.topic;
            } else if (shareType === "quiz") {
                const quiz = userQuizzes.find(q => q.id === selectedItemToShare);
                resourceData = {
                    title: quiz.title,
                    subject: quiz.subject,
                    questions: quiz.questions,
                    difficulty: quiz.difficulty,
                    category: quiz.category
                };
                title = quiz.title;
                description = `Quiz with ${quiz.questions?.length || 0} questions`;
                subject = quiz.subject;
            } else if (shareType === "ai_result") {
                const aiResult = userAIResults.find(r => r.id === selectedItemToShare);
                resourceData = {
                    tool_type: aiResult.tool_type,
                    content: aiResult.content,
                    input_data: aiResult.input_data
                };
                title = aiResult.title || aiResult.topic; // Changed to prefer title
                description = `${aiResult.tool_type.replace(/_/g, ' ')} result`;
                subject = aiResult.subject_name;
                topic = aiResult.topic;
            }

            await GroupSharedResource.create({
                group_id: group.id,
                resource_type: shareType,
                title,
                description,
                shared_by_email: user.email,
                shared_by_name: user.full_name,
                resource_data: resourceData,
                subject_name: subject,
                topic: topic || "",
                imported_by_emails: [] // Added imported_by_emails field
            });

            // Send notification to group
            await GroupMessage.create({
                group_id: group.id,
                sender_email: "system",
                sender_name: "System",
                message: `${user.full_name} shared: ${title}`,
                message_type: "system",
                timestamp: new Date().toISOString()
            });

            toast({ title: "Resource shared! 🎉", description: "Your content is now available to the group" });
            setIsSharing(false);
            setSelectedItemToShare(null);
            await loadResources();
        } catch (error) {
            console.error("Error sharing resource:", error);
            toast({ title: "Failed to share", variant: "destructive" });
        }
    };

    const handleImportResource = async (resource) => {
        // Check if user has already imported this resource
        if (resource.imported_by_emails?.includes(user.email)) {
            toast({ 
                title: "Already imported", 
                description: "You've already added this resource to your library.",
                variant: "destructive" 
            });
            return;
        }

        try {
            if (resource.resource_type === "flashcard_deck") {
                const deckId = `imported_${resource.id}_${Date.now()}`;
                
                // FIXED: Handle both 'flashcards' and 'cards' for backward compatibility
                const cards = resource.resource_data.flashcards || resource.resource_data.cards || [];
                
                if (!Array.isArray(cards) || cards.length === 0) {
                    toast({ 
                        title: "No cards to import", 
                        description: "This deck appears to be empty.",
                        variant: "destructive" 
                    });
                    return;
                }

                for (const card of cards) {
                    await Flashcard.create({
                        subject_name: card.subject_name,
                        topic: card.topic,
                        deck_id: deckId,
                        question: card.question,
                        answer: card.answer,
                        interval: 1,
                        repetitions: 0,
                        easeFactor: 2.5,
                        nextReviewDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
                        totalReviews: 0,
                        successfulReviews: 0,
                        is_active: true, // Added is_active for new flashcards
                        created_by: user.email // Ensure user's email is set for new flashcards
                    });
                }
                toast({ title: "Flashcards imported! 📚", description: `Added ${cards.length} cards to your collection` });
            } else if (resource.resource_type === "quiz") {
                await Quiz.create({
                    title: resource.resource_data.title,
                    subject: resource.resource_data.subject,
                    questions: resource.resource_data.questions,
                    difficulty: resource.resource_data.difficulty,
                    category: resource.resource_data.category,
                    created_by: user.email // Ensure user's email is set for new quizzes
                });
                toast({ title: "Quiz imported! 📝", description: "Added to your quizzes" });
            } else if (resource.resource_type === "ai_result") {
                await AISavedResult.create({
                    tool_type: resource.resource_data.tool_type,
                    subject_name: resource.subject_name,
                    topic: resource.topic,
                    title: resource.title, // Added title
                    content: resource.resource_data.content,
                    input_data: resource.resource_data.input_data,
                    created_by: user.email // Ensure user's email is set for new AI results
                });
                toast({ title: "AI result saved! ✨", description: "Added to your saved results" });
            }

            // Update import count and add user to imported_by_emails
            const updatedImportedBy = [...(resource.imported_by_emails || []), user.email];
            await GroupSharedResource.update(resource.id, {
                imports_count: (resource.imports_count || 0) + 1,
                imported_by_emails: updatedImportedBy
            });

            await loadResources();
        } catch (error) {
            console.error("Error importing resource:", error);
            toast({ title: "Failed to import", description: error.message || "An error occurred", variant: "destructive" });
        }
    };

    const getResourceIcon = (type) => {
        switch (type) {
            case "flashcard_deck": return Brain;
            case "quiz": return FileQuestion;
            case "ai_result": return Sparkles;
            default: return Share2;
        }
    };

    const getResourceColor = (type) => {
        switch (type) {
            case "flashcard_deck": return "bg-purple-100 text-purple-800";
            case "quiz": return "bg-blue-100 text-blue-800";
            case "ai_result": return "bg-pink-100 text-pink-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    if (isLoading) {
        return (
            <Card className="shadow-xl">
                <CardContent className="p-12 text-center">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading resources...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Shared Resources</h2>
                    <p className="text-gray-600 text-sm">Share and access study materials with your group</p>
                </div>
                <div className="flex gap-2">
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-40">
                            <Filter className="w-4 h-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Resources</SelectItem>
                            <SelectItem value="flashcard_deck">Flashcards</SelectItem>
                            <SelectItem value="quiz">Quizzes</SelectItem>
                            <SelectItem value="ai_result">AI Results</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Share Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Button
                    onClick={() => handleStartShare("flashcard_deck")}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                    <Brain className="w-4 h-4 mr-2" />
                    Share Flashcards
                </Button>
                <Button
                    onClick={() => handleStartShare("quiz")}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                >
                    <FileQuestion className="w-4 h-4 mr-2" />
                    Share Quiz
                </Button>
                <Button
                    onClick={() => handleStartShare("ai_result")}
                    className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700"
                >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Share AI Result
                </Button>
            </div>

            {/* Resources Grid */}
            {filteredResources.length === 0 ? (
                <Card className="shadow-lg">
                    <CardContent className="p-12 text-center">
                        <Share2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No resources yet</h3>
                        <p className="text-gray-600 mb-6">Be the first to share study materials with your group!</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredResources.map((resource, index) => {
                        const Icon = getResourceIcon(resource.resource_type);
                        const hasImported = resource.imported_by_emails?.includes(user.email);
                        
                        return (
                            <motion.div
                                key={resource.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className="hover:shadow-xl transition-all duration-300 border-2 hover:border-indigo-300">
                                    <CardHeader>
                                        <div className="flex items-start justify-between mb-2">
                                            <Badge className={getResourceColor(resource.resource_type)}>
                                                <Icon className="w-3 h-3 mr-1" />
                                                {resource.resource_type.replace(/_/g, ' ')}
                                            </Badge>
                                            {hasImported && (
                                                <Badge className="bg-green-100 text-green-800">
                                                    <Check className="w-3 h-3 mr-1" />
                                                    Imported
                                                </Badge>
                                            )}
                                        </div>
                                        <CardTitle className="text-lg line-clamp-2">{resource.title}</CardTitle>
                                        <p className="text-sm text-gray-600 line-clamp-2">{resource.description}</p>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-sm text-gray-600">
                                                <span>By {resource.shared_by_name}</span>
                                                <span>{format(new Date(resource.created_date), 'MMM d')}</span>
                                            </div>
                                            {resource.subject_name && (
                                                <Badge variant="outline" className="text-xs">
                                                    {resource.subject_name}
                                                </Badge>
                                            )}
                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Eye className="w-3 h-3" />
                                                    {resource.views_count || 0}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Download className="w-3 h-3" />
                                                    {resource.imports_count || 0}
                                                </span>
                                            </div>
                                            <Button
                                                onClick={() => handleImportResource(resource)}
                                                disabled={hasImported}
                                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                size="sm"
                                            >
                                                {hasImported ? (
                                                    <>
                                                        <Check className="w-4 h-4 mr-2" />
                                                        Already Imported
                                                    </>
                                                ) : (
                                                    <>
                                                        <Download className="w-4 h-4 mr-2" />
                                                        Import to My Library
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Share Dialog */}
            <Dialog open={isSharing} onOpenChange={setIsSharing}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Share {shareType === "flashcard_deck" ? "Flashcards" : 
                                   shareType === "quiz" ? "Quiz" : "AI Result"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium block mb-2">Select item to share:</label>
                            <Select value={selectedItemToShare} onValueChange={setSelectedItemToShare}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {shareType === "flashcard_deck" && userFlashcardDecks.map(deck => (
                                        <SelectItem key={deck.id} value={deck.id}>
                                            {deck.subject} - {deck.topic} ({deck.cards.length} cards)
                                        </SelectItem>
                                    ))}
                                    {shareType === "quiz" && userQuizzes.map(quiz => (
                                        <SelectItem key={quiz.id} value={quiz.id}>
                                            {quiz.title} ({quiz.questions?.length || 0} questions)
                                        </SelectItem>
                                    ))}
                                    {shareType === "ai_result" && userAIResults.map(result => (
                                        <SelectItem key={result.id} value={result.id}>
                                            {result.title || result.topic} ({result.tool_type.replace(/_/g, ' ')}) {/* Changed to prefer title */}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSharing(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleShareResource} disabled={!selectedItemToShare}>
                            <Share2 className="w-4 h-4 mr-2" />
                            Share with Group
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
