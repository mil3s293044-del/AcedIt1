import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Clock,
    Brain,
    BookOpen,
    Target,
    Calendar,
    FileText,
    Settings,
    Eye,
    EyeOff,
    GripVertical
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { UserSubject, Flashcard } from "@/entities/all";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const AVAILABLE_WIDGETS = [
    {
        id: "pomodoro",
        title: "Start Pomodoro",
        icon: Clock,
        color: "from-green-500 to-emerald-600",
        link: createPageUrl("Study"),
        description: "25 min focus session"
    },
    {
        id: "flashcards",
        title: "Review Flashcards",
        icon: Brain,
        color: "from-purple-500 to-indigo-600",
        link: createPageUrl("Study"),
        description: "Spaced repetition"
    },
    {
        id: "guides",
        title: "Study Guides",
        icon: BookOpen,
        color: "from-blue-500 to-cyan-600",
        link: createPageUrl("Guides"),
        description: "Browse guides"
    },
    {
        id: "ai_tools",
        title: "AI Tools",
        icon: FileText,
        color: "from-pink-500 to-rose-600",
        link: createPageUrl("AITools"),
        description: "Essay & notes help"
    },
    {
        id: "goals",
        title: "My Goals",
        icon: Target,
        color: "from-orange-500 to-amber-600",
        link: createPageUrl("Goals"),
        description: "Track progress"
    },
    {
        id: "planner",
        title: "Study Planner",
        icon: Calendar,
        color: "from-indigo-500 to-purple-600",
        link: createPageUrl("Goals"),
        description: "Schedule study time"
    }
];

export default function QuickAccessWidgets({ user }) {
    const [widgets, setWidgets] = useState([]);
    const [hiddenWidgets, setHiddenWidgets] = useState([]);
    const [isCustomizing, setIsCustomizing] = useState(false);
    const [subjectWidgets, setSubjectWidgets] = useState([]);
    const [deckWidgets, setDeckWidgets] = useState([]);

    useEffect(() => {
        loadWidgetPreferences();
        loadDynamicWidgets();
    }, [user]);

    const loadWidgetPreferences = () => {
        const saved = localStorage.getItem(`widgets_${user?.email}`);
        if (saved) {
            const preferences = JSON.parse(saved);
            setWidgets(preferences.visible || AVAILABLE_WIDGETS.slice(0, 4));
            setHiddenWidgets(preferences.hidden || []);
        } else {
            // Default: show first 4 widgets
            setWidgets(AVAILABLE_WIDGETS.slice(0, 4));
            setHiddenWidgets(AVAILABLE_WIDGETS.slice(4));
        }
    };

    const loadDynamicWidgets = async () => {
        if (!user?.email) return;

        try {
            // Load user subjects
            const subjects = await UserSubject.filter({ 
                created_by: user.email, 
                is_active: true,
                priority: 'high'
            });

            const subjectItems = subjects.slice(0, 2).map(subject => ({
                id: `subject_${subject.id}`,
                title: subject.subject_name,
                icon: BookOpen,
                color: subject.color || "from-blue-500 to-cyan-600",
                link: createPageUrl("Subjects"),
                description: `${subject.year_level}`,
                isDynamic: true,
                type: 'subject'
            }));

            setSubjectWidgets(subjectItems);

            // Load flashcard decks with cards due
            const allCards = await Flashcard.filter({ 
                created_by: user.email, 
                is_active: true 
            });
            
            const today = new Date().toISOString().split('T')[0];
            const deckMap = {};
            
            allCards.forEach(card => {
                const deckId = card.deck_id || `${card.subject_name}_${card.topic}`;
                if (!deckMap[deckId]) {
                    deckMap[deckId] = {
                        id: deckId,
                        subject: card.subject_name,
                        topic: card.topic,
                        dueCards: 0
                    };
                }
                if (card.next_review_date && card.next_review_date <= today) {
                    deckMap[deckId].dueCards++;
                }
            });

            const decksWithDue = Object.values(deckMap)
                .filter(d => d.dueCards > 0)
                .sort((a, b) => b.dueCards - a.dueCards)
                .slice(0, 2);

            const deckItems = decksWithDue.map(deck => ({
                id: `deck_${deck.id}`,
                title: deck.topic,
                icon: Brain,
                color: "from-purple-500 to-indigo-600",
                link: createPageUrl("Study"),
                description: `${deck.dueCards} cards due`,
                isDynamic: true,
                type: 'deck',
                deckId: deck.id
            }));

            setDeckWidgets(deckItems);

        } catch (error) {
            console.error("Error loading dynamic widgets:", error);
        }
    };

    const saveWidgetPreferences = (visible, hidden) => {
        localStorage.setItem(`widgets_${user?.email}`, JSON.stringify({
            visible,
            hidden
        }));
    };

    const handleDragEnd = (result) => {
        if (!result.destination) return;

        const items = Array.from(widgets);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setWidgets(items);
        saveWidgetPreferences(items, hiddenWidgets);
    };

    const toggleWidgetVisibility = (widget) => {
        const isVisible = widgets.some(w => w.id === widget.id);
        
        if (isVisible) {
            const newVisible = widgets.filter(w => w.id !== widget.id);
            const newHidden = [...hiddenWidgets, widget];
            setWidgets(newVisible);
            setHiddenWidgets(newHidden);
            saveWidgetPreferences(newVisible, newHidden);
        } else {
            const newHidden = hiddenWidgets.filter(w => w.id !== widget.id);
            const newVisible = [...widgets, widget];
            setWidgets(newVisible);
            setHiddenWidgets(newHidden);
            saveWidgetPreferences(newVisible, newHidden);
        }
    };

    const handleWidgetClick = (widget) => {
        if (widget.type === 'deck' && widget.deckId) {
            // Trigger deck review
            window.dispatchEvent(new CustomEvent('startFlashcardReview', {
                detail: { deckId: widget.deckId }
            }));
        }
    };

    const allWidgets = [...widgets, ...subjectWidgets, ...deckWidgets];
    const displayWidgets = isCustomizing ? [...widgets, ...hiddenWidgets] : allWidgets;

    return (
        <Card className="shadow-lg border-2 border-indigo-100">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <GripVertical className="w-5 h-5 text-white" />
                        </div>
                        Quick Access
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCustomizing(!isCustomizing)}
                    >
                        <Settings className="w-4 h-4 mr-2" />
                        {isCustomizing ? 'Done' : 'Customize'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isCustomizing ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Drag to reorder, click icons to show/hide widgets
                        </p>
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="widgets">
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="space-y-2"
                                    >
                                        {displayWidgets
                                            .filter(w => !w.isDynamic)
                                            .map((widget, index) => {
                                                const Icon = widget.icon;
                                                const isVisible = widgets.some(w => w.id === widget.id);
                                                
                                                return (
                                                    <Draggable
                                                        key={widget.id}
                                                        draggableId={widget.id}
                                                        index={index}
                                                    >
                                                        {(provided) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                className={`flex items-center gap-3 p-3 border-2 rounded-lg ${
                                                                    isVisible 
                                                                        ? 'bg-surface border-indigo-200' 
                                                                        : 'bg-secondary/50 border-border opacity-50'
                                                                }`}
                                                            >
                                                                <GripVertical className="w-4 h-4 text-muted-foreground/60" />
                                                                <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${widget.color} flex items-center justify-center`}>
                                                                    <Icon className="w-5 h-5 text-white" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="font-medium text-foreground">{widget.title}</p>
                                                                    <p className="text-xs text-muted-foreground">{widget.description}</p>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label="Toggle widget visibility"
                                                                    onClick={() => toggleWidgetVisibility(widget)}
                                                                >
                                                                    {isVisible ? (
                                                                        <Eye className="w-4 h-4 text-indigo-600" />
                                                                    ) : (
                                                                        <EyeOff className="w-4 h-4 text-muted-foreground/60" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                );
                                            })}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {allWidgets.map((widget, index) => {
                            const Icon = widget.icon;
                            
                            return (
                                <motion.div
                                    key={widget.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Link 
                                        to={widget.link}
                                        onClick={() => handleWidgetClick(widget)}
                                    >
                                        <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-indigo-300 h-full">
                                            <CardContent className="p-4">
                                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${widget.color} flex items-center justify-center mb-3 shadow-md`}>
                                                    <Icon className="w-6 h-6 text-white" />
                                                </div>
                                                <h3 className="font-semibold text-foreground text-sm mb-1">
                                                    {widget.title}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">
                                                    {widget.description}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}