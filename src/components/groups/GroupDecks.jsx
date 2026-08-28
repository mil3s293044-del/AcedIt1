import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
    Brain, 
    Plus, 
    Trash2, 
    Users, 
    Crown,
    Download,
    Lock,
    Unlock
} from "lucide-react";
import { GroupFlashcardDeck, Flashcard, GroupMessage } from "@/entities/all";
import { useToast } from "@/components/ui/use-toast";
import { format, addDays } from "date-fns";
import AceShuffle from "@/components/ace/AceShuffle";

export default function GroupDecks({ group, user }) {
    const [decks, setDecks] = useState([]);
    const [selectedDeck, setSelectedDeck] = useState(null);
    const [isCreatingDeck, setIsCreatingDeck] = useState(false);
    const [isAddingCard, setIsAddingCard] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const [newDeck, setNewDeck] = useState({
        deck_name: "",
        subject_name: group.subject,
        topic: ""
    });

    const [newCard, setNewCard] = useState({
        question: "",
        answer: ""
    });

    useEffect(() => {
        loadDecks();
    }, [group.id]);

    const loadDecks = async () => {
        try {
            const groupDecks = await GroupFlashcardDeck.filter({ group_id: group.id });
            setDecks(groupDecks || []);
        } catch (error) {
            console.error("Error loading decks:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateDeck = async () => {
        if (!newDeck.deck_name || !newDeck.topic) {
            toast({ title: "Missing fields", description: "Deck name and topic are required.", variant: "destructive" });
            return;
        }

        try {
            await GroupFlashcardDeck.create({
                ...newDeck,
                group_id: group.id,
                created_by_email: user.email,
                created_by_name: user.full_name,
                cards: [],
                contributors: [{
                    email: user.email,
                    name: user.full_name,
                    cards_added: 0
                }]
            });

            // Send notification to group
            await GroupMessage.create({
                group_id: group.id,
                sender_email: "system",
                sender_name: "System",
                message: `${user.full_name} created a new deck: ${newDeck.deck_name}`,
                message_type: "deck_share",
                timestamp: new Date().toISOString()
            });

            toast({ title: "Deck created!" });
            setIsCreatingDeck(false);
            setNewDeck({ deck_name: "", subject_name: group.subject, topic: "" });
            await loadDecks();
        } catch (error) {
            console.error("Error creating deck:", error);
            toast({ title: "Failed to create deck", variant: "destructive" });
        }
    };

    const handleAddCard = async () => {
        if (!newCard.question || !newCard.answer) {
            toast({ title: "Missing fields", description: "Question and answer are required.", variant: "destructive" });
            return;
        }

        try {
            const updatedCards = [
                ...(selectedDeck.cards || []),
                {
                    question: newCard.question,
                    answer: newCard.answer,
                    added_by_email: user.email,
                    added_by_name: user.full_name
                }
            ];

            // Update contributors
            const contributors = selectedDeck.contributors || [];
            const existingContributor = contributors.find(c => c.email === user.email);
            
            const updatedContributors = existingContributor
                ? contributors.map(c => 
                    c.email === user.email 
                        ? { ...c, cards_added: (c.cards_added || 0) + 1 }
                        : c
                  )
                : [...contributors, { email: user.email, name: user.full_name, cards_added: 1 }];

            await GroupFlashcardDeck.update(selectedDeck.id, {
                cards: updatedCards,
                contributors: updatedContributors
            });

            toast({ title: "Card added!" });
            setIsAddingCard(false);
            setNewCard({ question: "", answer: "" });
            setSelectedDeck({ ...selectedDeck, cards: updatedCards, contributors: updatedContributors });
            await loadDecks();
        } catch (error) {
            console.error("Error adding card:", error);
            toast({ title: "Failed to add card", variant: "destructive" });
        }
    };

    const handleImportToPersonalDecks = async (deck) => {
        try {
            const deckId = `imported_${deck.id}_${Date.now()}`;
            
            for (const card of deck.cards) {
                await Flashcard.create({
                    subject_name: deck.subject_name,
                    topic: deck.topic,
                    deck_id: deckId,
                    question: card.question,
                    answer: card.answer,
                    interval_days: 1,
                    repetitions: 0,
                    easiness_factor: 2.5,
                    next_review_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
                    total_reviews: 0
                });
            }

            toast({ 
                title: "Imported to your decks!", 
                description: `${deck.cards.length} cards added to your personal flashcards` 
            });
        } catch (error) {
            console.error("Error importing deck:", error);
            toast({ title: "Failed to import deck", variant: "destructive" });
        }
    };

    const handleDeleteCard = async (cardIndex) => {
        if (!confirm("Delete this card?")) return;

        try {
            const updatedCards = selectedDeck.cards.filter((_, i) => i !== cardIndex);
            await GroupFlashcardDeck.update(selectedDeck.id, { cards: updatedCards });
            
            setSelectedDeck({ ...selectedDeck, cards: updatedCards });
            toast({ title: "Card deleted" });
            await loadDecks();
        } catch (error) {
            console.error("Error deleting card:", error);
            toast({ title: "Failed to delete card", variant: "destructive" });
        }
    };

    if (isLoading) {
        return (
            <Card className="shadow-xl">
                <CardContent className="p-12 text-center">
                    <AceShuffle size="lg" className="mb-4 mx-auto" />
                    <p className="text-muted-foreground">Loading decks...</p>
                </CardContent>
            </Card>
        );
    }

    // Deck Detail View
    if (selectedDeck) {
        const isCreator = selectedDeck.created_by_email === user.email;
        const canEdit = !selectedDeck.is_locked || isCreator;

        return (
            <div className="space-y-6">
                <Button
                    variant="outline"
                    onClick={() => setSelectedDeck(null)}
                >
                    ← Back to Decks
                </Button>

                <Card className="shadow-xl border-2 border-purple-100">
                    <CardHeader className="border-b border-border">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <CardTitle className="text-2xl mb-2 flex items-center gap-2">
                                    {selectedDeck.deck_name}
                                    {isCreator && <Crown className="w-5 h-5 text-yellow-500" />}
                                    {selectedDeck.is_locked ? (
                                        <Lock className="w-4 h-4 text-muted-foreground/60" />
                                    ) : (
                                        <Unlock className="w-4 h-4 text-green-500" />
                                    )}
                                </CardTitle>
                                <p className="text-muted-foreground mb-3">{selectedDeck.topic}</p>
                                <div className="flex flex-wrap gap-2">
                                    <Badge className="bg-purple-100 text-purple-800">
                                        {selectedDeck.cards?.length || 0} cards
                                    </Badge>
                                    <Badge variant="outline">
                                        <Users className="w-3 h-3 mr-1" />
                                        {selectedDeck.contributors?.length || 0} contributors
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => handleImportToPersonalDecks(selectedDeck)}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Import
                                </Button>
                                {canEdit && (
                                    <Button
                                        onClick={() => setIsAddingCard(true)}
                                        className="bg-gradient-to-r from-green-600 to-emerald-600"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Card
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-6">
                        <div className="space-y-3">
                            {selectedDeck.cards?.length === 0 ? (
                                <div className="text-center py-12">
                                    <Brain className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                                    <p className="text-muted-foreground">No cards yet</p>
                                    {canEdit && (
                                        <Button
                                            onClick={() => setIsAddingCard(true)}
                                            variant="outline"
                                            className="mt-4"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add First Card
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                selectedDeck.cards?.map((card, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <Card className="hover:shadow-md transition-all">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="mb-2">
                                                            <p className="text-sm text-muted-foreground mb-1">Question:</p>
                                                            <p className="font-medium text-foreground">{card.question}</p>
                                                        </div>
                                                        <div className="mb-2">
                                                            <p className="text-sm text-muted-foreground mb-1">Answer:</p>
                                                            <p className="text-muted-foreground">{card.answer}</p>
                                                        </div>
                                                        <Badge variant="outline" className="text-xs">
                                                            Added by {card.added_by_name}
                                                        </Badge>
                                                    </div>
                                                    {canEdit && card.added_by_email === user.email && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label="Delete card"
                                                            onClick={() => handleDeleteCard(index)}
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Add Card Dialog */}
                <Dialog open={isAddingCard} onOpenChange={setIsAddingCard}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Card to Deck</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <label className="text-sm font-medium block mb-2">Question</label>
                                <Textarea
                                    value={newCard.question}
                                    onChange={(e) => setNewCard({ ...newCard, question: e.target.value })}
                                    placeholder="Enter the question..."
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-2">Answer</label>
                                <Textarea
                                    value={newCard.answer}
                                    onChange={(e) => setNewCard({ ...newCard, answer: e.target.value })}
                                    placeholder="Enter the answer..."
                                    rows={4}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddingCard(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddCard} className="bg-gradient-to-r from-green-600 to-emerald-600">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Card
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // Decks List View
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Collaborative Flashcard Decks</h2>
                <Button
                    onClick={() => setIsCreatingDeck(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Deck
                </Button>
            </div>

            {decks.length === 0 ? (
                <Card className="shadow-xl">
                    <CardContent className="p-12 text-center">
                        <Brain className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-foreground mb-2">No decks yet</h3>
                        <p className="text-muted-foreground mb-6">Create a collaborative deck to study together</p>
                        <Button onClick={() => setIsCreatingDeck(true)} className="bg-gradient-to-r from-purple-600 to-pink-600">
                            <Plus className="w-4 h-4 mr-2" />
                            Create First Deck
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {decks.map((deck, index) => (
                        <motion.div
                            key={deck.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Card
                                className="cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-purple-300"
                                onClick={() => setSelectedDeck(deck)}
                            >
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        {deck.deck_name}
                                        {deck.created_by_email === user.email && (
                                            <Crown className="w-4 h-4 text-yellow-500" />
                                        )}
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground">{deck.topic}</p>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Cards</span>
                                            <Badge variant="outline">
                                                {deck.cards?.length || 0}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Contributors</span>
                                            <Badge variant="outline">
                                                <Users className="w-3 h-3 mr-1" />
                                                {deck.contributors?.length || 0}
                                            </Badge>
                                        </div>
                                        <div className="pt-2">
                                            <Badge className="bg-purple-100 text-purple-800">
                                                {deck.subject_name}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Create Deck Dialog */}
            <Dialog open={isCreatingDeck} onOpenChange={setIsCreatingDeck}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Collaborative Deck</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium block mb-2">Deck Name</label>
                            <Input
                                value={newDeck.deck_name}
                                onChange={(e) => setNewDeck({ ...newDeck, deck_name: e.target.value })}
                                placeholder="e.g., Unit 3 Key Concepts"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-2">Topic</label>
                            <Input
                                value={newDeck.topic}
                                onChange={(e) => setNewDeck({ ...newDeck, topic: e.target.value })}
                                placeholder="e.g., Calculus, World War 2"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-2">Subject</label>
                            <Input
                                value={newDeck.subject_name}
                                disabled
                                className="bg-secondary/50"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreatingDeck(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateDeck} className="bg-gradient-to-r from-purple-600 to-pink-600">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Deck
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}