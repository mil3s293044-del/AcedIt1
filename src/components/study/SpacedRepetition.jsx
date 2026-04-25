import React, { useState, useEffect, useCallback } from "react";
import { Flashcard, UserSubject } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import AILoadingProgress from "../shared/AILoadingProgress";
import {
    Plus, Play, Edit, Trash2, Share2, Check, X, Sparkles, Upload,
    Loader2, Brain, Target, AlertCircle, Search, Clock, BarChart3,
    Users, UserPlus, ChevronLeft, FileText, Zap, RotateCcw, Eye
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { moderationPresets } from "@/components/shared/contentModeration";
import { fireXPFeedback } from "@/components/ranked/XPFeedback";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";

// ─── SM-2 based mastery algorithm ───────────────────────────────────────────
// Mastery score (0–100) is a weighted composite:
//   40% success rate (good+easy / total reviews)
//   30% interval length (longer interval = more confident)
//   20% ease factor (higher EF = easier to recall)
//   10% recency (reviewed recently = relevant)
// A card is "mastered" when mastery >= 80 and not a weak spot.
// A card becomes weak spot if difficulty rate >= 50% over 3+ reviews,
// and exits weak spot after 3 consecutive good/easy ratings.

const computeMasteryScore = (card) => {
    const again = card.review_count_again || 0;
    const hard = card.review_count_hard || 0;
    const good = card.review_count_good || 0;
    const easy = card.review_count_easy || 0;
    const total = again + hard + good + easy;
    if (total === 0) return 0;

    // 1. Success rate (0–1)
    const successRate = (good + easy) / total;

    // 2. Interval factor: cap at 30 days → score 0–1
    const interval = card.interval || 1;
    const intervalScore = Math.min(interval / 30, 1);

    // 3. Ease factor: range 1.3–3.0 → normalise to 0–1
    const ef = card.easeFactor || 2.5;
    const efScore = Math.max(0, Math.min((ef - 1.3) / (3.0 - 1.3), 1));

    // 4. Recency: if reviewed in last 7 days = 1, else decay over 30 days
    let recencyScore = 0;
    if (card.lastReviewedDate) {
        const daysSince = Math.floor((Date.now() - new Date(card.lastReviewedDate).getTime()) / 86400000);
        recencyScore = Math.max(0, 1 - daysSince / 30);
    }

    const raw = successRate * 0.40 + intervalScore * 0.30 + efScore * 0.20 + recencyScore * 0.10;
    return Math.round(raw * 100);
};

const calculateNextReview = (quality, card) => {
    let sessionSkipCount = 0;
    const updatedCounts = {
        review_count_again: card.review_count_again || 0,
        review_count_hard: card.review_count_hard || 0,
        review_count_good: card.review_count_good || 0,
        review_count_easy: card.review_count_easy || 0,
        consecutive_good: card.consecutive_good || 0,
        consecutive_easy: card.consecutive_easy || 0
    };

    // SM-2 ease factor and interval
    let ef = card.easeFactor || 2.5;
    let interval = card.interval || 1;
    let repetitions = card.repetitions || 0;

    if (quality === 1) {
        updatedCounts.review_count_again++;
        updatedCounts.consecutive_good = 0;
        updatedCounts.consecutive_easy = 0;
        sessionSkipCount = 0;
        ef = Math.max(1.3, ef - 0.2);
        interval = 1;
        repetitions = 0;
    } else if (quality === 2) {
        updatedCounts.review_count_hard++;
        updatedCounts.consecutive_good = 0;
        updatedCounts.consecutive_easy = 0;
        sessionSkipCount = 0;
        ef = Math.max(1.3, ef - 0.15);
        interval = Math.max(1, Math.floor(interval * 1.2));
        // don't increment repetitions — needs another good rating
    } else if (quality === 3) {
        updatedCounts.review_count_good++;
        updatedCounts.consecutive_good++;
        updatedCounts.consecutive_easy = 0;
        sessionSkipCount = 1;
        ef = Math.max(1.3, ef - 0.05); // slight decay for "just good"
        repetitions++;
        if (repetitions === 1) interval = 1;
        else if (repetitions === 2) interval = 3;
        else interval = Math.round(interval * ef);
    } else if (quality === 4) {
        updatedCounts.review_count_easy++;
        updatedCounts.consecutive_easy++;
        updatedCounts.consecutive_good = 0;
        sessionSkipCount = 1;
        ef = Math.min(3.0, ef + 0.1);
        repetitions++;
        if (repetitions === 1) interval = 2;
        else if (repetitions === 2) interval = 5;
        else interval = Math.round(interval * ef);
    }

    // Cap interval at 180 days
    interval = Math.min(interval, 180);

    // Next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);
    const nextReviewDate = nextReview.toISOString().split('T')[0];

    // Weak spot logic
    const totalDifficult = updatedCounts.review_count_again + updatedCounts.review_count_hard;
    const totalReviews = totalDifficult + updatedCounts.review_count_good + updatedCounts.review_count_easy;
    let isWeakSpot = totalReviews >= 3 && (totalDifficult / totalReviews) >= 0.5;
    if (card.is_weak_spot) {
        if (updatedCounts.consecutive_good >= 3 || updatedCounts.consecutive_easy >= 2) isWeakSpot = false;
        else isWeakSpot = true;
    }

    // Compute mastery score for updated card state
    const updatedCardForMastery = {
        ...card, ...updatedCounts, easeFactor: ef, interval, lastReviewedDate: new Date().toISOString().split('T')[0]
    };
    const masteryScore = computeMasteryScore(updatedCardForMastery);

    return {
        ...updatedCounts,
        session_skip_count: sessionSkipCount,
        is_weak_spot: isWeakSpot,
        easeFactor: ef,
        interval,
        repetitions,
        nextReviewDate,
        mastery_score: masteryScore,
    };
};

// ─── Rating button config ────────────────────────────────────────────────────
const ratingConfig = [
    { quality: 1, label: "Again", sublabel: "Didn't recall", color: "bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-400" },
    { quality: 2, label: "Hard", sublabel: "Almost", color: "bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 hover:border-orange-400" },
    { quality: 3, label: "Good", sublabel: "Recalled", color: "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-400" },
    { quality: 4, label: "Easy", sublabel: "Perfect", color: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 hover:border-emerald-400" },
];

// ─── Deck card component ─────────────────────────────────────────────────────
function DeckCard({ deck, subjectColor, onSelect, onDelete, onStats }) {
    const total = deck.cards.length;
    const due = deck.cards.filter(c => c.session_skip_count === 0).length;
    const weak = deck.cards.filter(c => c.is_weak_spot).length;
    const mastered = deck.cards.filter(c => (c.mastery_score || 0) >= 80 && !c.is_weak_spot).length;
    const avgMastery = total > 0 ? Math.round(deck.cards.reduce((s, c) => s + (c.mastery_score || 0), 0) / total) : 0;
    const masteryPct = avgMastery;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            className="group relative bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer"
            onClick={() => onSelect(deck)}
        >
            {/* Colour accent top bar */}
            <div className="h-1.5 w-full" style={{ backgroundColor: subjectColor }} />

            <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 text-base leading-tight truncate">{deck.topic}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: subjectColor }} />
                            <span className="text-xs text-slate-500">{deck.unit}</span>
                        </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); onStats(deck); }}
                            className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500">
                            <BarChart3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); onDelete(deck.id); }}
                            className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-red-50 text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center bg-slate-50 rounded-xl p-2">
                        <p className="text-lg font-bold text-slate-800">{total}</p>
                        <p className="text-xs text-slate-500">Total</p>
                    </div>
                    <div className="text-center bg-blue-50 rounded-xl p-2">
                        <p className="text-lg font-bold text-blue-600">{due}</p>
                        <p className="text-xs text-blue-600">Due</p>
                    </div>
                    <div className={`text-center rounded-xl p-2 ${weak > 0 ? 'bg-orange-50' : 'bg-emerald-50'}`}>
                        <p className={`text-lg font-bold ${weak > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{weak > 0 ? weak : mastered}</p>
                        <p className={`text-xs ${weak > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{weak > 0 ? 'Weak' : 'Done'}</p>
                    </div>
                </div>

                {/* Mastery bar */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-500">Mastery</span>
                        <span className="text-xs font-semibold text-slate-700">{masteryPct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: subjectColor }}
                            initial={{ width: 0 }}
                            animate={{ width: `${masteryPct}%` }}
                            transition={{ duration: 0.8, delay: 0.1 }}
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function SpacedRepetition() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [decks, setDecks] = useState([]);
    const [selectedDeck, setSelectedDeck] = useState(null);
    const [reviewMode, setReviewMode] = useState(false);
    const [reviewCards, setReviewCards] = useState([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [isCreatingDeck, setIsCreatingDeck] = useState(false);
    const [isAddingCard, setIsAddingCard] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [friends, setFriends] = useState([]);
    const [groups, setGroups] = useState([]);
    const [sharingDeck, setSharingDeck] = useState(null);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [selectedGroups, setSelectedGroups] = useState([]);
    const [isShowingGenerated, setIsShowingGenerated] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedFlashcards, setGeneratedFlashcards] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSubject, setFilterSubject] = useState('all');
    const [userSubjects, setUserSubjects] = useState([]);
    const [viewingStats, setViewingStats] = useState(null);
    const [reviewFilter, setReviewFilter] = useState('all');
    const [reviewStartTime, setReviewStartTime] = useState(null);
    const [sessionStats, setSessionStats] = useState({ totalReviews: 0, againCount: 0, hardCount: 0, goodCount: 0, easyCount: 0 });
    const [isRating, setIsRating] = useState(false);
    const [isSavingDeck, setIsSavingDeck] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);

    const [newDeck, setNewDeck] = useState({ subject_name: '', subject_code: '', topic: '', unit: 'General' });
    const [newCard, setNewCard] = useState({ question: '', answer: '' });
    const [aiSettings, setAiSettings] = useState({
        cardCount: 15, difficulty: 'mixed', cardStyle: 'standard', focusArea: 'key_concepts', includeExamples: true, language: 'simple'
    });

    const { toast } = useToast();

    useEffect(() => {
        const loadUser = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                const profiles = await base44.entities.UserProfile.filter({ created_by: currentUser.email });
                setUserProfile(profiles[0] || null);
            } catch (error) { console.error(error); }
        };
        loadUser();
    }, []);

    useEffect(() => {
        if (user?.email) { loadDecks(user.email); loadUserSubjects(); loadFriends(); loadGroups(); }
    }, [user]);

    // Keyboard shortcut for review
    useEffect(() => {
        if (!reviewMode) return;
        const handleKey = (e) => {
            if (!showAnswer) {
                if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); setShowAnswer(true); setIsFlipped(true); }
            } else {
                if (e.key === '1') handleRateCard(1);
                else if (e.key === '2') handleRateCard(2);
                else if (e.key === '3') handleRateCard(3);
                else if (e.key === '4') handleRateCard(4);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [reviewMode, showAnswer, currentCardIndex, isRating]);

    const loadDecks = async (userEmail) => {
        setIsLoading(true);
        try {
            const cards = await Flashcard.filter({ created_by: userEmail, is_active: true });
            const deckMap = {};
            cards.forEach(card => {
                const deckKey = `${card.subject_name || 'Other'}_${card.topic || 'General'}`;
                if (!deckMap[deckKey]) {
                    deckMap[deckKey] = { id: card.deck_id || deckKey, subject_name: card.subject_name || 'Other', subject_code: card.subject_code || '', topic: card.topic || 'General', unit: card.unit || 'General', cards: [] };
                }
                deckMap[deckKey].cards.push(card);
            });
            setDecks(Object.values(deckMap));
        } catch (error) { console.error(error); }
        finally { setIsLoading(false); }
    };

    const loadUserSubjects = async () => {
        try {
            const subjects = await UserSubject.filter({ created_by: user.email, is_active: true });
            setUserSubjects(subjects || []);
        } catch (error) { console.error(error); }
    };

    const loadFriends = async () => {
        try {
            const [asReq, asRec] = await Promise.all([
                base44.entities.Friendship.filter({ requester_email: user.email, status: 'accepted' }),
                base44.entities.Friendship.filter({ recipient_email: user.email, status: 'accepted' })
            ]);
            const friendEmails = [...(asReq || []), ...(asRec || [])].map(f =>
                f.requester_email === user.email ? f.recipient_email : f.requester_email
            );
            const users = await base44.entities.User.list();
            setFriends(users.filter(u => friendEmails.includes(u.email)));
        } catch (error) { console.error(error); }
    };

    const loadGroups = async () => {
        try {
            const groupsData = await base44.entities.StudyGroup.filter({ member_emails: user.email, is_active: true });
            setGroups(groupsData || []);
        } catch (error) { console.error(error); }
    };

    const handleGenerateFlashcardsFromFile = async () => {
        if (!uploadedFiles.length) {
            toast({ title: "No file selected", description: "Please upload at least one file.", variant: "destructive" });
            return;
        }
        const isPremium = userProfile?.subscription_tier === 'premium';
        if (!isPremium && (userProfile?.ai_credits || 0) < 100) {
            toast({ title: "Not enough credits", description: "You need 100 credits.", variant: "destructive" });
            return;
        }

        setIsShowingGenerated(false);
        setIsGenerating(true);
        try {
            const uploaded = await Promise.all(uploadedFiles.map(f => base44.integrations.Core.UploadFile({ file: f }).then(r => ({ url: r.file_url, name: f.name, ext: f.name.split('.').pop().toLowerCase() }))));
            const docxPptx = uploaded.filter(f => f.ext === 'docx' || f.ext === 'pptx');
            const directFiles = uploaded.filter(f => f.ext !== 'docx' && f.ext !== 'pptx');
            let documentContext = '';
            for (const f of docxPptx) {
                const textResult = await base44.functions.invoke('extractDocumentText', { file_url: f.url });
                documentContext += `\n\n[${f.name}]:\n${textResult.data?.text || ''}`;
            }

            const difficultyInstructions = { easy: "Use simple, straightforward questions focusing on basic recall and definitions.", mixed: "Include a mix of easy recall questions and moderately challenging application questions.", challenging: "Focus on deeper understanding, analysis, and application of concepts." };
            const styleInstructions = { standard: "Create traditional Q&A flashcards with direct questions and answers.", fill_blank: "Create fill-in-the-blank style questions where key terms are missing from statements.", true_false: "Create true/false statements that test understanding of concepts.", scenario: "Create scenario-based questions that apply concepts to real situations." };
            const focusInstructions = { key_concepts: "Focus on the most important concepts, theories, and principles.", definitions: "Focus on vocabulary, terminology, and definitions.", processes: "Focus on processes, steps, and procedures.", relationships: "Focus on cause-effect relationships and connections between ideas.", exam_prep: "Focus on content likely to appear in VCE exams, including common question types." };
            const languageInstructions = { simple: "Use clear, simple language suitable for quick recall.", detailed: "Provide more detailed answers with explanations.", technical: "Use proper technical terminology and academic language." };

            const basePrompt = `You are a comprehensive VCE flashcard generator. Your job is to extract EVERY single learnable piece of information from the provided study material and turn it into a flashcard. You must be exhaustive and thorough — leave nothing behind.

${documentContext ? `EXTRACTED TEXT FROM UPLOADED DOCUMENTS:\n${documentContext}` : ''}

GENERATION SETTINGS:
- Difficulty: ${aiSettings.difficulty} - ${difficultyInstructions[aiSettings.difficulty]}
- Style: ${aiSettings.cardStyle} - ${styleInstructions[aiSettings.cardStyle]}
- Focus: ${aiSettings.focusArea} - ${focusInstructions[aiSettings.focusArea]}
- Language: ${aiSettings.language} - ${languageInstructions[aiSettings.language]}
${aiSettings.includeExamples ? '- Include practical examples where relevant.' : '- Keep answers concise without extra examples.'}

CRITICAL REQUIREMENTS — READ CAREFULLY:
- You MUST generate a flashcard for EVERY distinct piece of learnable information in the material.
- This means: every definition, every concept, every term, every formula, every process step, every date/name/event, every cause-effect relationship, every comparison, every exception, every example, every diagram label, every key point, every heading and sub-heading topic.
- If the document has 200 distinct facts, create 200 cards. If it has 50, create 50. Do NOT stop early.
- NEVER cap yourself at a round number. Extract everything.
- Do NOT repeat or paraphrase the same concept twice.
- Each card must test exactly ONE idea — keep them atomic and focused.
- Questions must be clear, specific, and unambiguous.
- Answers must be complete and correct.

The documents provided may be PowerPoint slides, Word documents, or text files. Read every slide, every bullet point, every heading, every body text, every table cell, every numbered list item — and create a card for each learnable fact.`;

            // Only pass PDF/TXT files to Gemini — it cannot natively read DOCX/PPTX.
            // DOCX/PPTX content is already injected as text in documentContext above.
            const geminiCompatibleUrls = directFiles.map(f => f.url);

            const response = await base44.integrations.Core.InvokeLLM({
                model: "gemini_3_flash",
                prompt: basePrompt,
                file_urls: geminiCompatibleUrls.length ? geminiCompatibleUrls : undefined,
                response_json_schema: {
                    type: "object",
                    properties: {
                        flashcards: {
                            type: "array",
                            items: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" } }, required: ["question", "answer"] }
                        }
                    },
                    required: ["flashcards"]
                }
            });

            if (!isPremium && userProfile) {
                await base44.entities.UserProfile.update(userProfile.id, { ai_credits: Math.max(0, userProfile.ai_credits - 100) });
            }

            setGeneratedFlashcards(response.flashcards);
            setIsGenerating(false);
            setIsShowingGenerated(true);
            toast({ title: `${response.flashcards.length} flashcards generated!` });
        } catch (error) {
            console.error(error);
            toast({ title: "Generation failed", description: error.message, variant: "destructive" });
        } finally { setIsGenerating(false); }
    };

    const handleSaveGeneratedFlashcards = async (deckInfo) => {
        if (isSavingDeck || !generatedFlashcards?.length) return;
        setIsSavingDeck(true);
        try {
            const deckId = `deck_${Date.now()}`;
            const createPromises = generatedFlashcards.map(async (card) => {
                try {
                    const mod = await moderationPresets.flashcard(card.question, card.answer);
                    if (!mod.isAllowed) return null;
                } catch { }
                return Flashcard.create({ ...card, subject_name: deckInfo.subject_name, subject_code: deckInfo.subject_code, topic: deckInfo.topic, unit: deckInfo.unit, deck_id: deckId, is_active: true, session_skip_count: 0, review_count_again: 0, review_count_hard: 0, review_count_good: 0, review_count_easy: 0, consecutive_good: 0, consecutive_easy: 0, is_weak_spot: false });
            });
            const results = await Promise.all(createPromises);
            toast({ title: "Deck saved!", description: `${results.filter(Boolean).length} cards added.` });
            setIsShowingGenerated(false); setGeneratedFlashcards(null); setUploadedFiles([]);
            await loadDecks(user.email);
        } catch (error) {
            toast({ title: "Error", description: "Could not save flashcards.", variant: "destructive" });
        } finally { setIsSavingDeck(false); }
    };

    const handleDeleteDeck = async (deckId) => {
        if (!confirm("Delete this entire deck? This cannot be undone.")) return;
        try {
            const deck = decks.find(d => d.id === deckId);
            if (deck) { await Promise.all(deck.cards.map(c => Flashcard.delete(c.id))); toast({ title: "Deck deleted" }); await loadDecks(user.email); }
        } catch (error) { toast({ title: "Error", variant: "destructive" }); }
    };

    const handleShareDeck = async () => {
        if (!selectedFriends.length && !selectedGroups.length) { toast({ title: "No recipients", variant: "destructive" }); return; }
        try {
            const deckData = sharingDeck.cards.map(card => ({ subject_name: sharingDeck.subject_name, subject_code: sharingDeck.subject_code, unit: sharingDeck.unit, topic: sharingDeck.topic, question: card.question, answer: card.answer }));
            const promises = [];
            if (selectedFriends.length > 0) promises.push(...selectedFriends.map(friendEmail => base44.entities.SharedFlashcard.create({ deck_id: sharingDeck.id, deck_name: `${sharingDeck.subject_name} - ${sharingDeck.topic}`, shared_by_email: user.email, shared_by_name: user.full_name, shared_with_email: friendEmail, shared_with_name: friends.find(f => f.email === friendEmail)?.full_name || "", flashcard_data: deckData, status: 'pending' })));
            if (selectedGroups.length > 0) promises.push(...selectedGroups.map(groupId => base44.entities.GroupSharedResource.create({ group_id: groupId, resource_type: "flashcard_deck", title: `${sharingDeck.subject_name} - ${sharingDeck.topic}`, description: `Flashcard deck with ${deckData.length} cards`, shared_by_email: user.email, shared_by_name: user.full_name, resource_data: { flashcards: deckData }, subject_name: sharingDeck.subject_name, topic: sharingDeck.topic, tags: [sharingDeck.subject_name, sharingDeck.unit] })));
            await Promise.all(promises);
            toast({ title: "Deck shared!" });
            setSharingDeck(null); setSelectedFriends([]); setSelectedGroups([]);
        } catch (error) { toast({ title: "Error", description: "Could not share deck.", variant: "destructive" }); }
    };

    const handleCreateDeck = () => {
        if (!newDeck.subject_name || !newDeck.topic) { toast({ title: "Fill in subject and topic.", variant: "destructive" }); return; }
        const deckId = `deck_${Date.now()}`;
        setNewDeck({ ...newDeck, deck_id: deckId });
        setIsCreatingDeck(false);
        setIsAddingCard(true);
    };

    const handleAddCard = async () => {
        if (!newCard.question || !newCard.answer) { toast({ title: "Fill in question and answer.", variant: "destructive" }); return; }
        try {
            const mod = await moderationPresets.flashcard(newCard.question, newCard.answer);
            if (!mod.isAllowed) { toast({ title: "Content Policy Violation", variant: "destructive" }); return; }
        } catch { }
        try {
            await Flashcard.create({ ...newCard, subject_name: newDeck.subject_name, subject_code: newDeck.subject_code, topic: newDeck.topic, unit: newDeck.unit, deck_id: newDeck.deck_id, is_active: true, created_by: user.email, session_skip_count: 0, review_count_again: 0, review_count_hard: 0, review_count_good: 0, review_count_easy: 0, consecutive_good: 0, consecutive_easy: 0, is_weak_spot: false });
            toast({ title: "Card added!" });
            setNewCard({ question: '', answer: '' });
            await loadDecks(user.email);
        } catch (error) { toast({ title: "Error", description: "Could not add card.", variant: "destructive" }); }
    };

    const handleStartReview = (deck, filter = 'all') => {
        let cards = filter === 'due' ? deck.cards.filter(c => c.session_skip_count === 0) :
            filter === 'weak' ? deck.cards.filter(c => c.is_weak_spot) : deck.cards;
        if (!cards.length) { toast({ title: "No cards available", description: "No cards match that filter." }); return; }
        setReviewCards(cards); setCurrentCardIndex(0); setShowAnswer(false); setIsFlipped(false);
        setReviewMode(true); setReviewFilter(filter); setReviewStartTime(Date.now());
        setSessionStats({ totalReviews: 0, againCount: 0, hardCount: 0, goodCount: 0, easyCount: 0 });
        recordStudyAndGetStreak().catch(() => {});
    };

    const handleCompleteReview = async () => {
        if (!reviewStartTime) return;
        const durationMinutes = Math.round((Date.now() - reviewStartTime) / 60000);
        const cardsReviewed = sessionStats.totalReviews || reviewCards.length;
        try {
            if (user?.email && selectedDeck) {
                await base44.entities.StudyTechnique.create({ technique_name: "spaced_repetition", session_duration: durationMinutes, subject: selectedDeck.subject_name, topic: selectedDeck.topic, date: format(new Date(), 'yyyy-MM-dd'), notes: `Reviewed ${cardsReviewed} flashcards`, created_by: user.email });
                if (cardsReviewed > 0) await base44.functions.invoke('awardXP', { source: 'flashcard', event_key: `flashcard_review_${user.email}_${Date.now()}`, cards_reviewed: cardsReviewed, cards_correct: sessionStats.goodCount + sessionStats.easyCount, hard_cards: sessionStats.hardCount });
            }
        } catch (error) { console.error(error); }
        setReviewStartTime(null);
    };

    const handleExitReview = async () => {
        if (reviewStartTime && currentCardIndex > 0) await handleCompleteReview();
        setReviewMode(false); setReviewStartTime(null); setSelectedDeck(null);
    };

    const handleRateCard = async (quality) => {
        if (isRating) return;
        setIsRating(true);
        const card = reviewCards[currentCardIndex];
        const updates = calculateNextReview(quality, card);
        const newTotalReviews = (card.totalReviews || 0) + 1;

        setSessionStats(prev => ({
            totalReviews: prev.totalReviews + 1,
            againCount: prev.againCount + (quality === 1 ? 1 : 0),
            hardCount: prev.hardCount + (quality === 2 ? 1 : 0),
            goodCount: prev.goodCount + (quality === 3 ? 1 : 0),
            easyCount: prev.easyCount + (quality === 4 ? 1 : 0)
        }));

        setReviewCards(prev => prev.map((c, i) => i === currentCardIndex ? { ...c, ...updates, totalReviews: newTotalReviews, lastQuality: quality } : c));

        try {
            await Flashcard.update(card.id, { ...updates, lastReviewedDate: format(new Date(), 'yyyy-MM-dd'), totalReviews: newTotalReviews, lastQuality: quality });
            // Fire instant XP animation for this card (good/easy = reward, again/hard = smaller)
            const cardXP = quality >= 3 ? 1 : 0;
            if (cardXP > 0) {
                window.dispatchEvent(new CustomEvent('xp_awarded', { detail: { xp: cardXP, source: 'flashcard' } }));
            }
            if (currentCardIndex < reviewCards.length - 1) {
                setCurrentCardIndex(currentCardIndex + 1);
                setShowAnswer(false); setIsFlipped(false);
                setIsRating(false);
            } else {
                await handleCompleteReview();
                toast({ title: "Session complete! 🎉", description: `You reviewed ${reviewCards.length} cards.` });
                setReviewMode(false); await loadDecks(user.email); setSelectedDeck(null); setIsRating(false);
            }
        } catch (error) { toast({ title: "Error", variant: "destructive" }); setIsRating(false); }
    };

    const handleDeleteCard = async (cardId) => {
        if (!confirm("Delete this card?")) return;
        try {
            await Flashcard.delete(cardId); toast({ title: "Card deleted" }); await loadDecks(user.email);
            if (selectedDeck) { const updated = decks.find(d => d.id === selectedDeck.id); setSelectedDeck(updated); }
        } catch { }
    };

    const handleSaveCard = async () => {
        try {
            const mod = await moderationPresets.flashcard(editingCard.question, editingCard.answer);
            if (!mod.isAllowed) { toast({ title: "Content Policy Violation", variant: "destructive" }); return; }
        } catch { }
        try {
            await Flashcard.update(editingCard.id, { question: editingCard.question, answer: editingCard.answer });
            toast({ title: "Card updated!" }); setEditingCard(null); await loadDecks(user.email);
            if (selectedDeck) { const updated = decks.find(d => d.id === selectedDeck.id); setSelectedDeck(updated); }
        } catch { toast({ title: "Error", variant: "destructive" }); }
    };

    const filteredDecks = decks.filter(d => {
        const s = searchTerm.toLowerCase();
        return (d.subject_name?.toLowerCase().includes(s) || d.topic?.toLowerCase().includes(s)) &&
            (filterSubject === 'all' || d.subject_name === filterSubject);
    });

    const decksBySubject = {};
    filteredDecks.forEach(deck => {
        const sub = deck.subject_name || 'Other';
        if (!decksBySubject[sub]) decksBySubject[sub] = [];
        decksBySubject[sub].push(deck);
    });

    // ─── LOADING ─────────────────────────────────────────────────────────────
    if (isLoading) return (
        <div className="flex items-center justify-center min-h-64">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm text-slate-500">Loading your decks...</p>
            </div>
        </div>
    );

    // ─── REVIEW MODE ─────────────────────────────────────────────────────────
    if (reviewMode) {
        const currentCard = reviewCards[currentCardIndex];
        const progress = ((currentCardIndex + 1) / reviewCards.length) * 100;
        const total = sessionStats.totalReviews;
        const accuracy = total > 0 ? Math.round(((sessionStats.goodCount + sessionStats.easyCount) / total) * 100) : 0;

        return (
            <div className="max-w-2xl mx-auto space-y-5">
                {/* Top bar */}
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={handleExitReview} className="gap-2 text-slate-600 hover:text-slate-900">
                        <ChevronLeft className="w-4 h-4" /> Exit
                    </Button>
                    <div className="flex items-center gap-3">
                        {currentCard.is_weak_spot && (
                            <span className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
                                <AlertCircle className="w-3 h-3" /> Weak Spot
                            </span>
                        )}
                        <span className="text-sm font-semibold text-slate-600">{currentCardIndex + 1} / {reviewCards.length}</span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                </div>

                {/* Session mini stats */}
                {total > 0 && (
                    <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 px-4 py-2.5">
                        <span className="text-xs text-slate-500">{total} reviewed</span>
                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs text-red-500">{sessionStats.againCount} again</span>
                            <span className="text-xs text-orange-500">{sessionStats.hardCount} hard</span>
                            <span className="text-xs text-blue-500">{sessionStats.goodCount} good</span>
                            <span className="text-xs text-emerald-500">{sessionStats.easyCount} easy</span>
                            <span className="text-xs font-semibold text-slate-700 border-l border-slate-200 pl-2">{accuracy}% accurate</span>
                        </div>
                    </div>
                )}

                {/* Card */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentCardIndex}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
                            {/* Accent */}
                            <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

                            <div className="p-8 min-h-72 flex flex-col">
                                <AnimatePresence mode="wait">
                                    {!showAnswer ? (
                                        <motion.div key="question" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center text-center gap-6">
                                            <span className="text-xs font-semibold uppercase tracking-widest text-blue-500 bg-blue-50 px-3 py-1 rounded-full">Question</span>
                                            <p className="text-2xl font-semibold text-slate-900 leading-relaxed max-w-lg">
                                                {currentCard.question}
                                            </p>
                                            {currentCard.question_image && (
                                                <img src={currentCard.question_image} alt="Question" className="max-w-sm rounded-2xl shadow-md border border-slate-200" />
                                            )}
                                            <Button
                                                onClick={() => { setShowAnswer(true); setIsFlipped(true); }}
                                                className="mt-4 h-12 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-medium gap-2 shadow-lg shadow-blue-200"
                                            >
                                                <Eye className="w-4 h-4" /> Reveal Answer
                                            </Button>
                                            <p className="text-xs text-slate-400">Press Space or Enter to reveal</p>
                                        </motion.div>
                                    ) : (
                                        <motion.div key="answer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col gap-5">
                                            {/* Q above */}
                                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                <p className="text-xs font-semibold text-slate-400 mb-1.5">Question</p>
                                                <p className="text-sm text-slate-700 font-medium">{currentCard.question}</p>
                                            </div>
                                            {/* Answer */}
                                            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex-1">
                                                <p className="text-xs font-semibold text-emerald-600 mb-1.5">Answer</p>
                                                <p className="text-base text-slate-800 leading-relaxed">{currentCard.answer}</p>
                                                {currentCard.answer_image && (
                                                    <img src={currentCard.answer_image} alt="Answer" className="max-w-sm rounded-xl mt-3 border border-emerald-200" />
                                                )}
                                            </div>
                                            {/* Rating */}
                                            <div>
                                                <p className="text-xs text-center text-slate-400 mb-3">How well did you recall this? (1–4)</p>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {ratingConfig.map(r => (
                                                        <button
                                                            key={r.quality}
                                                            onClick={() => handleRateCard(r.quality)}
                                                            disabled={isRating}
                                                            className={`flex flex-col items-center gap-0.5 py-3 px-2 rounded-2xl border-2 font-semibold text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${r.color}`}
                                                        >
                                                            <span>{r.label}</span>
                                                            <span className="text-xs font-normal opacity-70">{r.sublabel}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        );
    }

    // ─── DECK DETAIL VIEW ────────────────────────────────────────────────────
    if (selectedDeck) {
        const stats = { total: selectedDeck.cards.length, due: selectedDeck.cards.filter(c => c.session_skip_count === 0).length, weak: selectedDeck.cards.filter(c => c.is_weak_spot).length };
        const subjectColor = userSubjects.find(s => s.subject_name === selectedDeck.subject_name)?.color || '#3B82F6';

        return (
            <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <button onClick={() => setSelectedDeck(null)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-medium">
                        <ChevronLeft className="w-4 h-4" /> All Decks
                    </button>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSharingDeck(selectedDeck)} className="gap-1.5 border-slate-200 text-xs">
                            <Share2 className="w-3.5 h-3.5" /> Share
                        </Button>
                        <Button size="sm" onClick={() => setIsAddingCard(true)} className="gap-1.5 bg-slate-800 hover:bg-slate-900 text-xs">
                            <Plus className="w-3.5 h-3.5" /> Add Card
                        </Button>
                    </div>
                </div>

                {/* Deck info + review buttons */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="h-1.5" style={{ backgroundColor: subjectColor }} />
                    <div className="p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">{selectedDeck.topic}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: subjectColor }} />
                                    <span className="text-sm text-slate-500">{selectedDeck.subject_name} · {selectedDeck.unit}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="text-center px-4 py-2 bg-slate-50 rounded-2xl">
                                    <p className="text-xl font-bold text-slate-800">{stats.total}</p>
                                    <p className="text-xs text-slate-500">Total</p>
                                </div>
                                <div className="text-center px-4 py-2 bg-blue-50 rounded-2xl">
                                    <p className="text-xl font-bold text-blue-600">{stats.due}</p>
                                    <p className="text-xs text-blue-600">Due</p>
                                </div>
                                <div className="text-center px-4 py-2 bg-orange-50 rounded-2xl">
                                    <p className="text-xl font-bold text-orange-600">{stats.weak}</p>
                                    <p className="text-xs text-orange-600">Weak</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-5">
                            <Button onClick={() => handleStartReview(selectedDeck, 'all')} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl gap-2">
                                <Play className="w-4 h-4" /> Review All
                            </Button>
                            <Button onClick={() => handleStartReview(selectedDeck, 'due')} variant="outline" className="flex-1 border-2 border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl gap-2">
                                <Clock className="w-4 h-4" /> Due Only ({stats.due})
                            </Button>
                            {stats.weak > 0 && (
                                <Button onClick={() => handleStartReview(selectedDeck, 'weak')} variant="outline" className="flex-1 border-2 border-orange-200 text-orange-700 hover:bg-orange-50 rounded-xl gap-2">
                                    <AlertCircle className="w-4 h-4" /> Weak ({stats.weak})
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Cards list */}
                <div className="space-y-2">
                    {selectedDeck.cards.map((card, index) => (
                        <motion.div key={card.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                            className="group bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm p-4 transition-all"
                        >
                            {editingCard?.id === card.id ? (
                                <div className="space-y-3">
                                    <Textarea value={editingCard.question} onChange={e => setEditingCard({ ...editingCard, question: e.target.value })} placeholder="Question" rows={2} className="border-2 border-blue-200 focus:border-blue-400 rounded-xl" />
                                    <Textarea value={editingCard.answer} onChange={e => setEditingCard({ ...editingCard, answer: e.target.value })} placeholder="Answer" rows={2} className="border-2 border-emerald-200 focus:border-emerald-400 rounded-xl" />
                                    <div className="flex gap-2">
                                        <Button onClick={handleSaveCard} size="sm" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl gap-1.5"><Check className="w-3.5 h-3.5" /> Save</Button>
                                        <Button onClick={() => setEditingCard(null)} variant="outline" size="sm" className="rounded-xl"><X className="w-3.5 h-3.5" /></Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-900 text-sm">{card.question}</p>
                                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{card.answer}</p>
                                        <div className="flex gap-1.5 mt-2 flex-wrap">
                                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{card.totalReviews || 0} reviews</span>
                                            {card.is_weak_spot && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Weak Spot</span>}
                                            {card.session_skip_count === 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Due</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <button onClick={() => setEditingCard({ ...card })} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500">
                                            <Edit className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDeleteCard(card.id)} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-red-50 text-red-400">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>
        );
    }

    // ─── DECK GRID VIEW ──────────────────────────────────────────────────────
    return (
        <>
            {isGenerating && <AILoadingProgress stage="generating" message="AI is creating your flashcards..." estimatedTime={45} />}

            <div className="space-y-5">
                {/* Search + filters + actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input placeholder="Search decks..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 border-2 border-slate-200 focus:border-blue-400 rounded-xl h-11" />
                    </div>
                    <Select value={filterSubject} onValueChange={setFilterSubject}>
                        <SelectTrigger className="w-full sm:w-44 border-2 border-slate-200 rounded-xl h-11">
                            <SelectValue placeholder="All Subjects" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Subjects</SelectItem>
                            {userSubjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                        <Button onClick={() => setIsCreatingDeck(true)} variant="outline" className="gap-2 border-2 border-slate-200 rounded-xl h-11 text-slate-700">
                            <Plus className="w-4 h-4" /> New Deck
                        </Button>
                        <Button onClick={() => setIsShowingGenerated(true)} className="gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 rounded-xl h-11">
                            <Sparkles className="w-4 h-4" /> AI Generate
                        </Button>
                    </div>
                </div>

                {Object.keys(decksBySubject).length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
                        <Brain className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-700 mb-2">No decks yet</h3>
                        <p className="text-sm text-slate-500 mb-6">Create your first deck manually or let AI generate one from your notes.</p>
                        <div className="flex gap-3 justify-center">
                            <Button onClick={() => setIsCreatingDeck(true)} variant="outline" className="gap-2 rounded-xl border-2"><Plus className="w-4 h-4" /> Create Deck</Button>
                            <Button onClick={() => setIsShowingGenerated(true)} className="gap-2 bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl"><Sparkles className="w-4 h-4" /> AI Generate</Button>
                        </div>
                    </div>
                ) : (
                    Object.entries(decksBySubject).map(([subjectName, subjectDecks]) => {
                        const subjectColor = userSubjects.find(s => s.subject_name === subjectName)?.color || '#3B82F6';
                        const totalDue = subjectDecks.reduce((sum, d) => sum + d.cards.filter(c => c.session_skip_count === 0).length, 0);
                        return (
                            <div key={subjectName} className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subjectColor }} />
                                    <h3 className="font-bold text-slate-800">{subjectName}</h3>
                                    <span className="text-xs text-slate-400">{subjectDecks.length} decks</span>
                                    {totalDue > 0 && <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{totalDue} due</span>}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {subjectDecks.map(deck => (
                                        <DeckCard key={deck.id} deck={deck} subjectColor={subjectColor}
                                            onSelect={setSelectedDeck}
                                            onDelete={handleDeleteDeck}
                                            onStats={setViewingStats}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── Create Deck Dialog ── */}
            <Dialog open={isCreatingDeck} onOpenChange={setIsCreatingDeck}>
                <DialogContent className="rounded-3xl max-w-sm">
                    <DialogHeader><DialogTitle>Create New Deck</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Subject</Label>
                            <Select value={newDeck.subject_name} onValueChange={v => setNewDeck({ ...newDeck, subject_name: v })}>
                                <SelectTrigger className="border-2 rounded-xl"><SelectValue placeholder="Choose subject..." /></SelectTrigger>
                                <SelectContent>
                                    {userSubjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Topic</Label>
                            <Input value={newDeck.topic} onChange={e => setNewDeck({ ...newDeck, topic: e.target.value })} placeholder="e.g. Cell Structure" className="border-2 rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Unit</Label>
                            <Select value={newDeck.unit} onValueChange={v => setNewDeck({ ...newDeck, unit: v })}>
                                <SelectTrigger className="border-2 rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {['General', 'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreatingDeck(false)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleCreateDeck} className="bg-blue-600 hover:bg-blue-700 rounded-xl">Next: Add Cards</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Add Card Dialog ── */}
            <Dialog open={isAddingCard} onOpenChange={setIsAddingCard}>
                <DialogContent className="rounded-3xl">
                    <DialogHeader><DialogTitle>Add Flashcard to {newDeck.topic || 'Deck'}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Question / Front</Label>
                            <Textarea value={newCard.question} onChange={e => setNewCard({ ...newCard, question: e.target.value })} placeholder="What is...?" rows={3} className="border-2 border-slate-200 focus:border-blue-400 rounded-xl resize-none" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Answer / Back</Label>
                            <Textarea value={newCard.answer} onChange={e => setNewCard({ ...newCard, answer: e.target.value })} placeholder="The answer is..." rows={3} className="border-2 border-slate-200 focus:border-emerald-400 rounded-xl resize-none" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingCard(false)} className="rounded-xl">Done</Button>
                        <Button onClick={handleAddCard} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl gap-2"><Plus className="w-4 h-4" /> Add Card</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Share Dialog ── */}
            <Dialog open={!!sharingDeck} onOpenChange={() => { setSharingDeck(null); setSelectedFriends([]); setSelectedGroups([]); }}>
                <DialogContent className="max-w-md rounded-3xl max-h-[80vh] flex flex-col">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Share2 className="w-4 h-4" /> Share Deck</DialogTitle></DialogHeader>
                    <Tabs defaultValue="friends" className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="friends" className="gap-2"><UserPlus className="w-3.5 h-3.5" /> Friends</TabsTrigger>
                            <TabsTrigger value="groups" className="gap-2"><Users className="w-3.5 h-3.5" /> Groups</TabsTrigger>
                        </TabsList>
                        <TabsContent value="friends" className="flex-1 overflow-hidden">
                            <ScrollArea className="h-56">
                                {friends.length === 0 ? <p className="text-center text-slate-500 text-sm py-8">No friends yet.</p> :
                                    friends.map(f => (
                                        <div key={f.email} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl">
                                            <Checkbox checked={selectedFriends.includes(f.email)} onCheckedChange={c => setSelectedFriends(c ? [...selectedFriends, f.email] : selectedFriends.filter(e => e !== f.email))} />
                                            <div><p className="font-medium text-sm">{f.full_name}</p><p className="text-xs text-slate-500">{f.email}</p></div>
                                        </div>
                                    ))}
                            </ScrollArea>
                        </TabsContent>
                        <TabsContent value="groups" className="flex-1 overflow-hidden">
                            <ScrollArea className="h-56">
                                {groups.length === 0 ? <p className="text-center text-slate-500 text-sm py-8">No groups yet.</p> :
                                    groups.map(g => (
                                        <div key={g.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl border border-slate-100 mb-2">
                                            <Checkbox checked={selectedGroups.includes(g.id)} onCheckedChange={c => setSelectedGroups(c ? [...selectedGroups, g.id] : selectedGroups.filter(id => id !== g.id))} />
                                            <div><p className="font-medium text-sm">{g.name}</p><p className="text-xs text-slate-500">{g.subject} · {g.member_emails?.length || 0} members</p></div>
                                        </div>
                                    ))}
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setSharingDeck(null); setSelectedFriends([]); setSelectedGroups([]); }} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleShareDeck} disabled={!selectedFriends.length && !selectedGroups.length} className="rounded-xl gap-2">
                            <Share2 className="w-4 h-4" /> Share ({selectedFriends.length + selectedGroups.length})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── AI Generate Dialog ── */}
            <Dialog open={isShowingGenerated} onOpenChange={setIsShowingGenerated}>
                <DialogContent className="max-w-2xl rounded-3xl max-h-[90vh] flex flex-col overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-violet-600" /> AI Flashcard Generator
                        </DialogTitle>
                    </DialogHeader>

                    {!generatedFlashcards ? (
                        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                            {/* Upload */}
                            <div className={`rounded-2xl border-2 border-dashed transition-all ${uploadedFiles.length ? 'border-violet-400 bg-violet-50' : 'border-slate-300 bg-slate-50'}`}>
                                <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-violet-50/50 transition-colors rounded-2xl">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${uploadedFiles.length ? 'bg-violet-100' : 'bg-white'}`}>
                                        <FileText className={`w-5 h-5 ${uploadedFiles.length ? 'text-violet-600' : 'text-slate-400'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-semibold ${uploadedFiles.length ? 'text-violet-700' : 'text-slate-700'}`}>
                                            {uploadedFiles.length ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} selected` : 'Upload Study Material'}
                                        </p>
                                        <p className="text-xs text-slate-500">PDF, DOCX, PPTX, or TXT — multiple files supported</p>
                                    </div>
                                    <input type="file" className="hidden" accept=".pdf,.txt,.docx,.pptx" multiple onChange={e => {
                                        const files = Array.from(e.target.files || []);
                                        setUploadedFiles(prev => { const names = new Set(prev.map(f => f.name)); return [...prev, ...files.filter(f => !names.has(f.name))]; });
                                    }} />
                                </label>
                                {uploadedFiles.length > 0 && (
                                    <div className="px-4 pb-3 space-y-1.5" onClick={e => e.stopPropagation()}>
                                        {uploadedFiles.map((f, i) => (
                                            <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-violet-100">
                                                <FileText className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                                                <span className="flex-1 text-xs font-medium text-slate-700 truncate">{f.name}</span>
                                                <span className="text-xs text-slate-400">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                                                <button type="button" onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Settings */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-600">Difficulty</Label>
                                        <Select value={aiSettings.difficulty} onValueChange={v => setAiSettings({ ...aiSettings, difficulty: v })}>
                                            <SelectTrigger className="border-2 rounded-xl h-10"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="easy">Easy</SelectItem>
                                                <SelectItem value="mixed">Mixed ⭐</SelectItem>
                                                <SelectItem value="challenging">Challenging</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-600">Question Style</Label>
                                        <Select value={aiSettings.cardStyle} onValueChange={v => setAiSettings({ ...aiSettings, cardStyle: v })}>
                                            <SelectTrigger className="border-2 rounded-xl h-10"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="standard">Standard Q&A</SelectItem>
                                                <SelectItem value="fill_blank">Fill in Blank</SelectItem>
                                                <SelectItem value="true_false">True / False</SelectItem>
                                                <SelectItem value="scenario">Scenario</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-600">Focus Area</Label>
                                        <Select value={aiSettings.focusArea} onValueChange={v => setAiSettings({ ...aiSettings, focusArea: v })}>
                                            <SelectTrigger className="border-2 rounded-xl h-10"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="key_concepts">Key Concepts</SelectItem>
                                                <SelectItem value="definitions">Definitions</SelectItem>
                                                <SelectItem value="processes">Processes</SelectItem>
                                                <SelectItem value="relationships">Cause & Effect</SelectItem>
                                                <SelectItem value="exam_prep">Exam Prep</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-600">Answer Detail</Label>
                                        <Select value={aiSettings.language} onValueChange={v => setAiSettings({ ...aiSettings, language: v })}>
                                            <SelectTrigger className="border-2 rounded-xl h-10"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="simple">Concise</SelectItem>
                                                <SelectItem value="detailed">Detailed</SelectItem>
                                                <SelectItem value="technical">Technical</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3.5 border border-slate-200">
                                    <Checkbox id="includeExamples" checked={aiSettings.includeExamples} onCheckedChange={c => setAiSettings({ ...aiSettings, includeExamples: c })} />
                                    <label htmlFor="includeExamples" className="text-sm font-medium text-slate-700 cursor-pointer">Include examples in answers</label>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-hidden flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Subject</Label>
                                    <Select value={newDeck.subject_name} onValueChange={v => setNewDeck({ ...newDeck, subject_name: v })}>
                                        <SelectTrigger className="border-2 rounded-xl"><SelectValue placeholder="Choose subject..." /></SelectTrigger>
                                        <SelectContent>
                                            {userSubjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Topic</Label>
                                    <Input value={newDeck.topic} onChange={e => setNewDeck({ ...newDeck, topic: e.target.value })} placeholder="e.g. Cell Structure" className="border-2 rounded-xl" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Unit</Label>
                                    <Select value={newDeck.unit} onValueChange={v => setNewDeck({ ...newDeck, unit: v })}>
                                        <SelectTrigger className="border-2 rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent>{['General', 'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto bg-slate-50 rounded-2xl border border-slate-200 p-3 space-y-2">
                                <p className="text-sm font-semibold text-slate-600 mb-1">{generatedFlashcards.length} generated cards</p>
                                {generatedFlashcards.map((card, i) => (
                                    <div key={i} className="bg-white rounded-xl p-3.5 border border-slate-200">
                                        <p className="font-medium text-sm text-slate-900 mb-1">{card.question}</p>
                                        <p className="text-xs text-slate-500">{card.answer}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={() => { setIsShowingGenerated(false); setGeneratedFlashcards(null); setUploadedFiles([]); }} className="rounded-xl">Cancel</Button>
                        {!generatedFlashcards ? (
                            <Button onClick={handleGenerateFlashcardsFromFile} disabled={!uploadedFiles.length || isGenerating} className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 rounded-xl gap-2">
                                {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate All Cards</>}
                            </Button>
                        ) : (
                            <Button onClick={() => handleSaveGeneratedFlashcards(newDeck)} disabled={!newDeck.subject_name || !newDeck.topic || isSavingDeck} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl gap-2">
                                {isSavingDeck ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save Deck</>}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Stats Dialog ── */}
            <Dialog open={!!viewingStats} onOpenChange={() => setViewingStats(null)}>
                <DialogContent className="max-w-lg rounded-3xl">
                    <DialogHeader><DialogTitle>Deck Statistics</DialogTitle></DialogHeader>
                    {viewingStats && (
                        <ScrollArea className="max-h-[60vh]">
                            <div className="space-y-4 pr-2">
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { label: "Total", val: viewingStats.cards.length, color: "text-slate-800", bg: "bg-slate-50" },
                                        { label: "Due", val: viewingStats.cards.filter(c => c.session_skip_count === 0).length, color: "text-blue-600", bg: "bg-blue-50" },
                                        { label: "Weak", val: viewingStats.cards.filter(c => c.is_weak_spot).length, color: "text-orange-600", bg: "bg-orange-50" },
                                        { label: "Mastered", val: viewingStats.cards.filter(c => (c.mastery_score || 0) >= 80 && !c.is_weak_spot).length, color: "text-emerald-600", bg: "bg-emerald-50" },
                                    ].map(s => (
                                        <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
                                            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                                    <p className="text-sm font-semibold text-slate-700">Rating Distribution</p>
                                    {['again', 'hard', 'good', 'easy'].map(rating => {
                                        const count = viewingStats.cards.reduce((s, c) => s + (c[`review_count_${rating}`] || 0), 0);
                                        const allCount = viewingStats.cards.reduce((s, c) => s + (c.review_count_again || 0) + (c.review_count_hard || 0) + (c.review_count_good || 0) + (c.review_count_easy || 0), 0);
                                        const pct = allCount > 0 ? Math.round((count / allCount) * 100) : 0;
                                        const colors = { again: { bar: 'bg-red-400', text: 'text-red-600' }, hard: { bar: 'bg-orange-400', text: 'text-orange-600' }, good: { bar: 'bg-blue-400', text: 'text-blue-600' }, easy: { bar: 'bg-emerald-400', text: 'text-emerald-600' } };
                                        return (
                                            <div key={rating}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className={`text-xs font-semibold capitalize ${colors[rating].text}`}>{rating}</span>
                                                    <span className="text-xs text-slate-500">{count} ({pct}%)</span>
                                                </div>
                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`${colors[rating].bar} h-full rounded-full`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 rounded-2xl p-4">
                                        <p className="text-xl font-bold text-slate-800">{viewingStats.cards.reduce((s, c) => s + (c.totalReviews || 0), 0)}</p>
                                        <p className="text-xs text-slate-500">Total Reviews</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl p-4">
                                        <p className="text-xl font-bold text-slate-800">{Math.round(viewingStats.cards.reduce((s, c) => s + (c.totalReviews || 0), 0) / (viewingStats.cards.length || 1))}</p>
                                        <p className="text-xs text-slate-500">Avg per Card</p>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    )}
                    <DialogFooter><Button onClick={() => setViewingStats(null)} className="rounded-xl">Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}