import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Flashcard, UserSubject } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FEATURES, canUseFeature } from "@/lib/tierAccess";
import AISkeleton from "../shared/AISkeleton";
import {
    Plus, Play, Edit, Trash2, Share2, Check, X, Sparkles,
    Loader2, Brain, AlertTriangle, Search, Clock,
    Users, UserPlus, ChevronLeft, FileText, ListChecks
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { moderationPresets } from "@/components/shared/contentModeration";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import AceTip from "@/components/ace/AceTip";
import AceBody from "@/components/ace/AceBody";
import { aceDone } from "@/components/ace/AceReacts";
import AceShuffle from "@/components/ace/AceShuffle";
import ReviewTable from "@/components/cards/ReviewTable";
import DeckStack from "@/components/cards/DeckStack";
import { rankFor, suitFor, subjectColor } from "@/components/cards/cardIdentity";
import { cardMastery, isCardDue } from "@/lib/mastery";
import { BANK_TOPIC, fixState } from "@/lib/mistakeBank";
import { calculateNextReview as sm2Next, formatIntervalShort as sm2Interval, reviewPatch, RATINGS } from "@/lib/sm2";

// Lucide alias — design system maps "alert" semantics to AlertTriangle.
const AlertCircle = AlertTriangle;

// ─── AI generation: how much, and how deep ──────────────────────────────────
// The generator used to be exhaustive-only — the prompt literally said "if the
// document has 200 distinct facts, create 200 cards", which is right before an
// exam on one chapter and useless when you want the ten things that matter.
// Coverage decides what qualifies as card-worthy; count decides how many of
// those you get. Count is the binding constraint when the two disagree.

const COVERAGE_OPTIONS = [
    {
        id: "key_ideas", label: "Key ideas", blurb: "The big concepts only",
        scope: "the key ideas only",
        instruction: "Only the material's most important ideas — the ones a student cannot understand this topic without. Skip minor detail, incidental examples and anything peripheral. Every card has to earn its place."
    },
    {
        id: "balanced", label: "Balanced", blurb: "Core plus the detail that gets tested",
        scope: "core concepts plus the detail that gets tested",
        instruction: "The core concepts, plus the supporting detail that makes them usable: key definitions, the formulas and process steps that go with them, and the distinctions examiners test. Leave out incidental detail and asides."
    },
    {
        id: "everything", label: "Everything", blurb: "Every learnable fact",
        scope: "every learnable fact in it",
        instruction: "Every distinct learnable fact in the material — every definition, term, formula, process step, date, name, event, cause-effect relationship, comparison, exception, diagram label and key point. Read every slide, bullet, heading, body paragraph, table cell and list item. Leave nothing behind."
    },
];

const COUNT_OPTIONS = [10, 20, 30, 50];

const coverageOf = (id) => COVERAGE_OPTIONS.find((c) => c.id === id) || COVERAGE_OPTIONS[2];

const countInstruction = (cardCount) =>
    cardCount === "max"
        ? "Generate as many cards as the material genuinely supports at the coverage above. Do not stop at a round number — if it yields 200, generate 200; if it yields 40, generate 40. Never pad to reach a total."
        : `Generate ${cardCount} cards. This is a hard ceiling and it overrides the coverage scope: if the material offers more than ${cardCount} card-worthy ideas, pick the ${cardCount} most valuable — the ones most likely to be tested and most costly to forget. If it genuinely offers fewer, return fewer rather than padding with filler or restating a concept twice.`;

// What the two dials will actually produce, in one line, so the setting isn't
// a guess. Reads under the controls.
const generationSummary = (cardCount, coverage) => {
    const scope = coverageOf(coverage).scope;
    return cardCount === "max"
        ? `As many cards as the material supports — ${scope}.`
        : `Up to ${cardCount} cards — ${scope}.`;
};

// ─── SM-2 based mastery algorithm ───────────────────────────────────────────
// Moved to src/lib/mastery.js so the dashboard can rank a subject without
// importing this file. The formula is unchanged; see the note there for the
// weights and for why a never-reviewed card scores zero.
//
// A card is "mastered" when mastery >= 80 and not a weak spot. A card becomes
// a weak spot at a difficulty rate >= 50% over 3+ reviews, and leaves after
// three consecutive good/easy ratings.
const computeMasteryScore = cardMastery;
const isDue = isCardDue;

// The scheduler and the rating scale now live in src/lib/sm2.js, so the
// mistake bank can grade the same rows through the same arithmetic. The math
// is unchanged; see that file for why it moved.
const calculateNextReview = sm2Next;
const formatIntervalShort = sm2Interval;

// ─── Rating button config ────────────────────────────────────────────────────
// Static class strings (Tailwind JIT-safe) — overdue/hard → streak,
// hard/energy → xp, good (default recall) → chart-3 (blue), easy (mastered) → primary.
const ratingConfig = RATINGS;

/**
 * The same four colours as raw CSS, for the flash the discard pile gives when
 * a card lands on it. Deliberately not built from the class names above: a
 * Tailwind class assembled at runtime is invisible to the scanner and compiles
 * to nothing, which is a bug that only shows up in the production build.
 */
const GRADE_TONE = {
    1: "hsl(var(--streak))",
    2: "hsl(var(--xp))",
    3: "hsl(var(--chart-3))",
    4: "hsl(var(--primary))",
};

// ─── Deck card component ─────────────────────────────────────────────────────
// The presentation is DeckStack — an actual pack of cards. This is the thin
// layer that works out what the numbers are; everything about how a deck looks
// belongs with the rest of the card system, not in a 1,500-line screen.
function DeckCard({ deck, subjectColor, onSelect, onDelete, onStats, index }) {
    const total = deck.cards.length;
    return (
        <DeckStack
            index={index}
            topic={deck.topic}
            unit={deck.unit}
            subject={deck.subject_name}
            tone={subjectColor}
            total={total}
            due={deck.cards.filter(isDue).length}
            weak={deck.cards.filter(c => c.is_weak_spot).length}
            mastery={total > 0
                ? Math.round(deck.cards.reduce((s, c) => s + computeMasteryScore(c), 0) / total)
                : 0}
            onSelect={() => onSelect(deck)}
            onDelete={() => onDelete(deck.id)}
            onStats={() => onStats(deck)}
        />
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
    /**
     * Seeded from ?subject= so a card on the dashboard is a real action.
     *
     * Read once, at mount, into the filter this page already had rather than
     * added as a second parallel filtering path — which means the student can
     * see what was applied in the same Select they would have used themselves,
     * and clear it there. A deep link that filters invisibly is a page that
     * looks like it has lost half your decks.
     */
    const [filterSubject, setFilterSubject] = useState(() => {
        if (typeof window === "undefined") return "all";
        return new URLSearchParams(window.location.search).get("subject") || "all";
    });
    const [userSubjects, setUserSubjects] = useState([]);
    const [viewingStats, setViewingStats] = useState(null);
    const [reviewStartTime, setReviewStartTime] = useState(null);
    // How the card that just left was graded — the table throws it accordingly.
    const [lastGrade, setLastGrade] = useState(3);
    const [sessionStats, setSessionStats] = useState({ totalReviews: 0, againCount: 0, hardCount: 0, goodCount: 0, easyCount: 0 });

    /**
     * Ace's read on the session so far.
     *
     * Deliberately NOT a reaction per card. Rating happens dozens of times a
     * sitting, and something that pops up on every one of them is the single
     * fastest way to make a student turn the mascot off. He just stands there
     * and his face changes — continuous presence, zero interruption.
     *
     * "Again" heavy gets `think`, not disappointment: a card you failed is a
     * card the algorithm now knows to show you, which is the system working.
     */
    const acePose = useMemo(() => {
        const n = sessionStats.totalReviews;
        if (n < 3) return "stand";
        const strong = (sessionStats.goodCount + sessionStats.easyCount) / n;
        if (strong >= 0.8) return "proud";
        if (strong >= 0.5) return "happy";
        return "think";
    }, [sessionStats]);
    // Real XP banked this session from per-card incremental awards.
    const sessionXPRef = React.useRef(0);
    const [isRating, setIsRating] = useState(false);
    const [isSavingDeck, setIsSavingDeck] = useState(false);

    const [newDeck, setNewDeck] = useState({ subject_name: '', subject_code: '', topic: '', unit: 'General' });
    const [newCard, setNewCard] = useState({ question: '', answer: '' });
    const [aiSettings, setAiSettings] = useState({
        // 'max' = as many as the material supports. `everything` + `max` is what
        // the generator did before these two dials existed, so it stays the
        // default — dialling down is the new thing, not the new normal.
        cardCount: 'max', coverage: 'everything',
        difficulty: 'mixed', cardStyle: 'standard', focusArea: 'key_concepts', includeExamples: true, language: 'simple'
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
                if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); setShowAnswer(true); }
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

    // ── Generated-deck draft ─────────────────────────────────────────────────
    // Generation runs for a while and students navigate away mid-way. The
    // request finishes regardless, the "N flashcards generated!" toast fires
    // globally — but setGeneratedFlashcards lands on an unmounted component, so
    // the cards existed only in state that no longer exists and were silently
    // lost. Stash them so coming back to the page picks up where they left off.
    const draftKey = user?.email ? `flashcardDraft_${user.email}` : null;

    const saveDraft = useCallback((cards, deck) => {
        if (!draftKey || !cards?.length) return;
        try {
            sessionStorage.setItem(draftKey, JSON.stringify({ cards, deck, at: Date.now() }));
        } catch { /* quota or private mode — the in-memory path still works */ }
    }, [draftKey]);

    const clearDraft = useCallback(() => {
        if (!draftKey) return;
        try { sessionStorage.removeItem(draftKey); } catch { /* nothing to clean up */ }
    }, [draftKey]);

    useEffect(() => {
        if (!draftKey || generatedFlashcards?.length) return;
        try {
            const raw = sessionStorage.getItem(draftKey);
            if (!raw) return;
            const draft = JSON.parse(raw);
            if (!draft?.cards?.length) return;
            setGeneratedFlashcards(draft.cards);
            if (draft.deck) setNewDeck(prev => ({ ...prev, ...draft.deck }));
            setIsShowingGenerated(true);
            toast({
                title: "Picked up where you left off",
                description: `${draft.cards.length} generated cards are still waiting to be saved.`,
            });
        } catch { clearDraft(); }
        // Restores once, when the user lands on the page.
    }, [draftKey]);

    // Subject and topic are usually typed after generating, so keep the stashed
    // draft current — otherwise coming back restores the cards but loses them.
    useEffect(() => {
        if (isShowingGenerated && generatedFlashcards?.length) saveDraft(generatedFlashcards, newDeck);
    }, [isShowingGenerated, generatedFlashcards, newDeck, saveDraft]);

    const handleGenerateFlashcardsFromFile = async () => {
        if (!uploadedFiles.length) {
            toast({ title: "No file selected", description: "Please upload at least one file.", variant: "destructive" });
            return;
        }
        const access = canUseFeature(userProfile, FEATURES.FLASHCARD_AI_GEN);
        if (!access.allowed) {
            toast({
                title: access.upgradeRequired ? "Premium feature" : "Daily limit reached",
                description: access.reason,
                variant: "destructive",
            });
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
                try {
                    const textResult = await base44.functions.invoke('extractDocumentText', { file_url: f.url });
                    if (textResult.data?.error) {
                        toast({ title: "File read issue", description: "Could not read " + f.name + ": " + textResult.data.error, variant: "destructive" });
                    } else {
                        documentContext += `\n\n[${f.name}]:\n${textResult.data?.text || ''}`;
                    }
                } catch (e) {
                    toast({ title: "File read failed", description: "Could not read " + f.name + ": " + e.message, variant: "destructive" });
                }
            }

            const difficultyInstructions = { easy: "Use simple, straightforward questions focusing on basic recall and definitions.", mixed: "Include a mix of easy recall questions and moderately challenging application questions.", challenging: "Focus on deeper understanding, analysis, and application of concepts." };
            const styleInstructions = { standard: "Create traditional Q&A flashcards with direct questions and answers.", fill_blank: "Create fill-in-the-blank style questions where key terms are missing from statements.", true_false: "Create true/false statements that test understanding of concepts.", scenario: "Create scenario-based questions that apply concepts to real situations." };
            const focusInstructions = { key_concepts: "Focus on the most important concepts, theories, and principles.", definitions: "Focus on vocabulary, terminology, and definitions.", processes: "Focus on processes, steps, and procedures.", relationships: "Focus on cause-effect relationships and connections between ideas.", exam_prep: "Focus on content likely to appear in VCE exams, including common question types." };
            const languageInstructions = { simple: "Use clear, simple language suitable for quick recall.", detailed: "Provide more detailed answers with explanations.", technical: "Use proper technical terminology and academic language." };

            const coverage = coverageOf(aiSettings.coverage);

            const basePrompt = `You are a VCE flashcard generator. Turn the provided study material into flashcards at the scope and volume specified below.

${documentContext ? `EXTRACTED TEXT FROM UPLOADED DOCUMENTS:\n${documentContext}` : ''}

COVERAGE — what qualifies as card-worthy (${coverage.label}):
${coverage.instruction}

HOW MANY:
${countInstruction(aiSettings.cardCount)}

GENERATION SETTINGS:
- Difficulty: ${aiSettings.difficulty} - ${difficultyInstructions[aiSettings.difficulty]}
- Style: ${aiSettings.cardStyle} - ${styleInstructions[aiSettings.cardStyle]}
- Focus: ${aiSettings.focusArea} - ${focusInstructions[aiSettings.focusArea]}
- Language: ${aiSettings.language} - ${languageInstructions[aiSettings.language]}
${aiSettings.includeExamples ? '- Include practical examples where relevant.' : '- Keep answers concise without extra examples.'}

RULES THAT APPLY WHATEVER THE SCOPE:
- Each card must test exactly ONE idea — keep them atomic and focused.
- Do NOT repeat or paraphrase the same concept twice.
- Questions must be clear, specific, and unambiguous. Never "explain X" where X is a whole topic.
- Answers must be complete and correct, and short enough to check yourself against in a couple of seconds.

The documents provided may be PowerPoint slides, Word documents, PDFs or text files. Read the body text, headings, bullet points, table cells and numbered list items — not just the slide titles.`;

            // Only pass PDF/TXT files to Gemini — it cannot natively read DOCX/PPTX.
            // DOCX/PPTX content is already injected as text in documentContext above.
            const geminiCompatibleUrls = directFiles.map(f => f.url);

            const response = await base44.integrations.Core.InvokeLLM({
                feature: "flashcard_ai_gen",
                model: "gemini_3_flash",
                prompt: basePrompt,
                file_urls: geminiCompatibleUrls.length ? geminiCompatibleUrls : undefined,
                response_json_schema: {
                    type: "object",
                    properties: {
                        flashcards: {
                            type: "array",
                            ...(aiSettings.cardCount === "max" ? {} : { maxItems: aiSettings.cardCount }),
                            items: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" } }, required: ["question", "answer"] }
                        }
                    },
                    required: ["flashcards"]
                }
            });

            if (userProfile?.subscription_tier !== 'premium' && userProfile) {
                await base44.entities.UserProfile.update(userProfile.id, { ai_credits: Math.max(0, userProfile.ai_credits - 100) });
            }

            // The count has to be a guarantee, not a request. maxItems above is
            // advisory — providers routinely overshoot it — so the number they
            // picked is enforced here.
            const cards = aiSettings.cardCount === "max"
                ? (response.flashcards || [])
                : (response.flashcards || []).slice(0, aiSettings.cardCount);

            // Stash before touching state — if they navigated away mid-generation
            // these setters are no-ops, and the draft is the only thing that
            // survives to be saved later.
            saveDraft(cards, newDeck);
            setGeneratedFlashcards(cards);
            setIsGenerating(false);
            setIsShowingGenerated(true);
            toast({
                title: `${cards.length} flashcards generated!`,
                // Asking for 30 and getting 12 looks like a failure unless you
                // say the material was the limit, not the generator.
                description: aiSettings.cardCount !== "max" && cards.length < aiSettings.cardCount
                    ? `That's everything the material supported at this coverage. Not saved yet — hit Save to keep them.`
                    : "Not saved yet — open Spaced Repetition and hit Save to keep them.",
            });
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
                // Note: schema has no subject_code column on flashcards —
                // subject_name is enough. Keeping the field would 400 the insert.
                return Flashcard.create({
                    ...card,
                    subject_name:        deckInfo.subject_name,
                    topic:               deckInfo.topic,
                    unit:                deckInfo.unit,
                    deck_id:             deckId,
                    is_active:           true,
                    session_skip_count:  0,
                    review_count_again:  0,
                    review_count_hard:   0,
                    review_count_good:   0,
                    review_count_easy:   0,
                    consecutive_good:    0,
                    consecutive_easy:    0,
                    is_weak_spot:        false,
                    // First review = today so the card shows up in due lists right away.
                    next_review_date:    new Date().toISOString().split('T')[0],
                });
            });
            // allSettled, not all: one rejected insert used to reject the whole
            // batch, so a deck that mostly saved reported as a total failure.
            const results = await Promise.allSettled(createPromises);
            const saved = results.filter(r => r.status === "fulfilled" && r.value).length;
            const failed = results.filter(r => r.status === "rejected").length;
            const blocked = results.filter(r => r.status === "fulfilled" && !r.value).length;

            if (saved === 0) {
                toast({
                    title: "Could not save flashcards",
                    description: blocked ? "The cards were blocked by the content filter." : "Nothing was saved — try again.",
                    variant: "destructive",
                });
                return;
            }

            toast({
                title: "Deck saved!",
                description: failed
                    ? `${saved} cards added — ${failed} could not be saved.`
                    : `${saved} cards added.`,
            });
            clearDraft();
            setIsShowingGenerated(false); setGeneratedFlashcards(null); setUploadedFiles([]);
        } catch (error) {
            console.error("Flashcard save failed:", error);
            toast({ title: "Error", description: "Could not save flashcards.", variant: "destructive" });
        } finally { setIsSavingDeck(false); }

        // Refreshing the list is not part of saving. It used to sit inside the
        // try, so a failure here fired "Could not save flashcards" straight
        // after the success toast, for cards that were already in the database.
        try {
            await loadDecks(user.email);
        } catch (e) {
            console.error("Deck refresh after save failed:", e);
        }
    };

    const handleDeleteDeck = async (deckId) => {
        if (!confirm("Delete this entire deck? This cannot be undone.")) return;
        try {
            const deck = decks.find(d => d.id === deckId);
            if (deck) { await Promise.all(deck.cards.map(c => Flashcard.delete(c.id))); toast({ title: "Deck deleted" }); await loadDecks(user.email); }
        } catch { toast({ title: "Error", variant: "destructive" }); }
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
        } catch { toast({ title: "Error", description: "Could not share deck.", variant: "destructive" }); }
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
            const today = new Date().toISOString().split('T')[0];
            await Flashcard.create({ ...newCard, subject_name: newDeck.subject_name, topic: newDeck.topic, unit: newDeck.unit, deck_id: newDeck.deck_id, is_active: true, created_by: user.email, session_skip_count: 0, repetitions: 0, easiness_factor: 2.5, interval_days: 1, next_review_date: today, total_reviews: 0, review_count_again: 0, review_count_hard: 0, review_count_good: 0, review_count_easy: 0, consecutive_good: 0, consecutive_easy: 0, is_weak_spot: false });
            toast({ title: "Card added!" });
            setNewCard({ question: '', answer: '' });
            await loadDecks(user.email);
        } catch { toast({ title: "Error", description: "Could not add card.", variant: "destructive" }); }
    };

    const handleStartReview = (deck, filter = 'all') => {
        let cards = filter === 'due' ? deck.cards.filter(isDue) :
            filter === 'weak' ? deck.cards.filter(c => c.is_weak_spot) : deck.cards;
        if (!cards.length) { toast({ title: "No cards available", description: "No cards match that filter." }); return; }
        setReviewCards(cards); setCurrentCardIndex(0); setShowAnswer(false);
        setReviewMode(true); setReviewStartTime(Date.now());
        setSessionStats({ totalReviews: 0, againCount: 0, hardCount: 0, goodCount: 0, easyCount: 0 });
        recordStudyAndGetStreak().catch(() => {});
    };

    const handleCompleteReview = async () => {
        if (!reviewStartTime) return;
        const durationMinutes = Math.round((Date.now() - reviewStartTime) / 60000);
        const cardsReviewed = sessionStats.totalReviews || reviewCards.length;
        try {
            if (user?.email && selectedDeck) {
                // XP is paid per card as it happens (awardXPIncremental in
                // handleRateCard) — no batch award here, or cards would pay twice.
                await base44.entities.StudyTechnique.create({ technique_name: "spaced_repetition", session_duration: durationMinutes, subject: selectedDeck.subject_name, topic: selectedDeck.topic, date: format(new Date(), 'yyyy-MM-dd'), notes: `Reviewed ${cardsReviewed} flashcards`, created_by: user.email });
            }
        } catch (error) { console.error(error); }
        // Scored on recall, not on effort — "you got 9 of 12 back" is the
        // thing worth reacting to at the end of a deck.
        const n = sessionStats.totalReviews;
        aceDone("revision", n ? Math.round(
            ((sessionStats.goodCount + sessionStats.easyCount) / n) * 100) : null);
        setReviewStartTime(null);
    };

    const handleExitReview = useCallback(() => {
        // Leaving is instant. This used to await the session write *and* a full
        // deck reload before the screen changed, so tapping Exit sat there for
        // a beat doing nothing — every card is already saved as it's rated, so
        // there was never anything worth waiting on.
        const reviewed = sessionStats.totalReviews;
        const xp = sessionXPRef.current;
        const startedAt = reviewStartTime;
        const deck = selectedDeck;
        const cardsSoFar = currentCardIndex;

        setReviewMode(false); setReviewStartTime(null); setSelectedDeck(null);
        sessionXPRef.current = 0;

        if (reviewed > 0) {
            toast({
                variant: "success",
                title: `${reviewed} card${reviewed === 1 ? '' : 's'} reviewed`,
                description: `${xp > 0 ? `+${xp} XP banked · ` : ''}They're off today's due list.`,
            });
        }

        // Log the session and refresh the due counts behind the transition.
        (async () => {
            try {
                if (startedAt && cardsSoFar > 0 && user?.email && deck) {
                    const durationMinutes = Math.round((Date.now() - startedAt) / 60000);
                    // XP is paid per card as it happens (awardXPIncremental in
                    // handleRateCard) — no batch award here, or cards pay twice.
                    await base44.entities.StudyTechnique.create({
                        technique_name: "spaced_repetition",
                        session_duration: durationMinutes,
                        subject: deck.subject_name, topic: deck.topic,
                        date: format(new Date(), 'yyyy-MM-dd'),
                        notes: `Reviewed ${reviewed || 0} flashcards`,
                        created_by: user.email,
                    });
                }
            } catch (error) { console.error(error); }
            if (user?.email) loadDecks(user.email).catch(() => {});
        })();
    }, [sessionStats.totalReviews, reviewStartTime, selectedDeck, currentCardIndex, user, loadDecks, toast]);

    // Esc leaves the deck, the same as it closes every dialog on the site.
    useEffect(() => {
        if (!reviewMode) return;
        const onKey = (e) => { if (e.key === "Escape") handleExitReview(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [reviewMode, handleExitReview]);

    const handleRateCard = async (quality) => {
        if (isRating) return;
        setIsRating(true);
        setLastGrade(quality);
        const card = reviewCards[currentCardIndex];
        const updates = calculateNextReview(quality, card);
        const newTotalReviews = (card.total_reviews || 0) + 1;

        setSessionStats(prev => ({
            totalReviews: prev.totalReviews + 1,
            againCount: prev.againCount + (quality === 1 ? 1 : 0),
            hardCount: prev.hardCount + (quality === 2 ? 1 : 0),
            goodCount: prev.goodCount + (quality === 3 ? 1 : 0),
            easyCount: prev.easyCount + (quality === 4 ? 1 : 0)
        }));

        setReviewCards(prev => prev.map((c, i) => i === currentCardIndex ? { ...c, ...updates, total_reviews: newTotalReviews, last_quality: quality } : c));

        try {
            // reviewPatch names the columns explicitly, so the derived
            // _mastery_score cannot reach a table that has no column for it.
            await Flashcard.update(card.id, {
                ...reviewPatch(updates, quality),
                total_reviews: newTotalReviews,
            });
            // Real per-card XP through the incremental engine (idempotent per
            // card+review-count, 80/day cap). Every card is a recorded event,
            // so bets/duels/goals move card-by-card and nothing is lost if the
            // student bails mid-session. Fire-and-forget — the card flow
            // never waits on the network.
            base44.functions.invoke('awardXPIncremental', {
                type: 'flashcard_card',
                event_key: `fc_${card.id}_r${newTotalReviews}`,
                metadata: { correct: quality >= 3, card_id: card.id },
            }).then(res => {
                const xp = (res?.data ?? res)?.xp_awarded || 0;
                if (xp > 0) {
                    sessionXPRef.current += xp;
                    window.dispatchEvent(new CustomEvent('xp_awarded', { detail: { xp, source: 'flashcard' } }));
                }
            }).catch(() => {});
            if (currentCardIndex < reviewCards.length - 1) {
                setCurrentCardIndex(currentCardIndex + 1);
                setShowAnswer(false);
                setIsRating(false);
            } else {
                await handleCompleteReview();
                toast({ title: "Session complete!", description: `You reviewed ${reviewCards.length} cards${sessionXPRef.current > 0 ? ` and banked +${sessionXPRef.current} XP` : ''}.` });
                sessionXPRef.current = 0;
                setReviewMode(false); await loadDecks(user.email); setSelectedDeck(null); setIsRating(false);
            }
        } catch { toast({ title: "Error", variant: "destructive" }); setIsRating(false); }
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

    // Mistakes banked from quiz marking. They review here like any other deck,
    // but the bank screen is where you see whether you are actually fixing
    // them — so this points at it rather than duplicating the answer.
    const bankOutstanding = decks
        .filter(d => d.topic === BANK_TOPIC)
        .flatMap(d => d.cards)
        .filter(c => fixState(c) !== "fixed").length;

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
                <AceShuffle size="lg" />
                <p className="text-sm text-muted-foreground">Loading your decks...</p>
            </div>
        </div>
    );

    // ─── REVIEW MODE ─────────────────────────────────────────────────────────
    if (reviewMode) {
        const currentCard = reviewCards[currentCardIndex];
        const total = sessionStats.totalReviews;
        const accuracy = total > 0 ? Math.round(((sessionStats.goodCount + sessionStats.easyCount) / total) * 100) : 0;
        // The two marks in the card's corner. Mastery is computed from the
        // card as it stands right now, so a card you've just pulled up from
        // "again" territory is visibly a better card next time it comes round.
        const mastery = computeMasteryScore(currentCard);
        const suit = suitFor(currentCard.subject_name);
        const tone = subjectColor(
            userSubjects.find(s => s.subject_name === currentCard.subject_name),
            currentCard.subject_name);

        return (
            <div className="max-w-4xl mx-auto space-y-4">
                {/* Top bar. The card counter that used to live here is gone —
                    the two piles say the same thing, and saying it twice is
                    how a screen ends up looking like a dashboard. */}
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={handleExitReview} className="gap-2 text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="w-4 h-4" /> Exit
                    </Button>
                    {currentCard.subject_name && (
                        <span className="text-xs font-semibold text-muted-foreground truncate max-w-[50%]">
                            {currentCard.subject_name}{currentCard.topic ? ` · ${currentCard.topic}` : ""}
                        </span>
                    )}
                </div>

                <ReviewTable
                    cardKey={currentCardIndex}
                    rank={rankFor(mastery)} suit={suit} mastery={mastery} tone={tone}
                    remaining={reviewCards.length - currentCardIndex}
                    // Only what you actually recalled is FINISHED. A card you
                    // graded Again is due again — the pile it lands on should
                    // agree with the scheduler, not just with the card counter.
                    done={sessionStats.goodCount + sessionStats.easyCount}
                    returning={sessionStats.againCount + sessionStats.hardCount}
                    flipped={showAnswer}
                    onFlip={() => setShowAnswer(true)}
                    grade={lastGrade} gradeTone={GRADE_TONE[lastGrade]}
                    badge={currentCard.is_weak_spot ? (
                        <span className="pill bg-streak/10 text-streak border border-streak/20">
                            <AlertCircle className="w-3 h-3" /> Weak Spot
                        </span>
                    ) : null}
                    front={(
                        <>
                            <p className="text-lg sm:text-xl font-semibold text-foreground leading-snug">
                                {currentCard.question}
                            </p>
                            {currentCard.question_image && (
                                <img src={currentCard.question_image} alt="Question"
                                    className="max-w-full rounded-xl border border-border" />
                            )}
                        </>
                    )}
                    back={(
                        <span className="absolute inset-0 flex flex-col gap-3 px-5 pt-11 pb-11">
                            <span className="block text-xs text-muted-foreground leading-snug flex-shrink-0
                                border-b border-border pb-2.5">
                                {currentCard.question}
                            </span>
                            <span className="block relative flex-1 min-h-0">
                                <span tabIndex={0} className="block h-full overflow-y-auto">
                                    <span className="block text-base sm:text-lg text-foreground leading-relaxed">
                                        {currentCard.answer}
                                    </span>
                                    {currentCard.answer_image && (
                                        <img src={currentCard.answer_image} alt="Answer"
                                            className="max-w-full rounded-xl mt-3 border border-border" />
                                    )}
                                </span>
                                {/* A long answer runs out at the bottom edge of
                                    the card, and a line cut in half reads as
                                    broken rather than as "there's more". */}
                                <span aria-hidden="true"
                                    className="absolute inset-x-0 bottom-0 h-6 pointer-events-none
                                        bg-gradient-to-t from-surface to-transparent" />
                            </span>
                        </span>
                    )}
                />

                {/* Grading. Off the card on purpose — a card is a thing you
                    read, and the buttons are what you do about it. */}
                <div className="min-h-[8.5rem]">
                    {showAnswer && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="flex items-center justify-center gap-2 mb-3">
                                {/* He watches the deck go by. His face is the
                                    only thing that changes — see acePose. */}
                                <span data-ace-review={acePose} className="hidden sm:block flex-shrink-0">
                                    <AceBody className="w-11" pose={acePose} title="Ace" />
                                </span>
                                <p className="text-xs text-center text-muted-foreground/60 inline-flex items-center justify-center gap-1">
                                    How well did you recall this? <AceTip term="sm2_rating" align="center" />
                                </p>
                            </div>
                            {/* Capped, so the four grades read as belonging to
                                the card rather than to the page. */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-xl mx-auto">
                                {ratingConfig.map(r => (
                                    <button
                                        key={r.quality}
                                        data-grade={r.quality}
                                        onClick={() => handleRateCard(r.quality)}
                                        disabled={isRating}
                                        className={`relative flex flex-col items-center gap-0.5 py-4 px-2 rounded-2xl border-2 font-bold text-sm transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-50 ${r.color}`}
                                    >
                                        <span className="absolute top-1.5 right-2 text-[10px] font-black opacity-40">{r.quality}</span>
                                        <span>{r.label}</span>
                                        <span className="text-xs font-normal opacity-70">{r.sublabel}</span>
                                        <span className="text-[10px] font-semibold opacity-50 tabular-nums">
                                            {formatIntervalShort(calculateNextReview(r.quality, currentCard).interval_days)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Session mini stats — quiet, below the card */}
                {total > 0 && (
                    <div className="flex items-center gap-3 px-1 text-xs text-muted-foreground">
                        <span>{total} reviewed</span>
                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-streak">{sessionStats.againCount} again</span>
                            <span className="text-xp">{sessionStats.hardCount} hard</span>
                            <span className="text-chart-3">{sessionStats.goodCount} good</span>
                            <span className="text-primary">{sessionStats.easyCount} easy</span>
                            <span className="font-semibold text-foreground border-l border-border pl-2">{accuracy}% accurate</span>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ─── DECK DETAIL VIEW ────────────────────────────────────────────────────
    if (selectedDeck) {
        const stats = { total: selectedDeck.cards.length, due: selectedDeck.cards.filter(isDue).length, weak: selectedDeck.cards.filter(c => c.is_weak_spot).length };
        const deckColor = subjectColor(
            userSubjects.find(s => s.subject_name === selectedDeck.subject_name),
            selectedDeck.subject_name);

        return (
            <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <button onClick={() => setSelectedDeck(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium">
                        <ChevronLeft className="w-4 h-4" /> All Decks
                    </button>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSharingDeck(selectedDeck)} className="gap-1.5 border-border text-xs">
                            <Share2 className="w-3.5 h-3.5" /> Share
                        </Button>
                        <Button size="sm" onClick={() => setIsAddingCard(true)} className="btn-3d gap-1.5 bg-chart-3 hover:bg-chart-3 text-white text-xs">
                            <Plus className="w-3.5 h-3.5" /> Add Card
                        </Button>
                    </div>
                </div>

                {/* Deck info + review buttons */}
                <div className="card-soft overflow-hidden">
                    <div className="h-1.5" style={{ backgroundColor: deckColor }} />
                    <div className="p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">{selectedDeck.topic}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: deckColor }} />
                                    <span className="text-sm text-muted-foreground">{selectedDeck.subject_name} · {selectedDeck.unit}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="text-center px-4 py-2 bg-secondary/50 rounded-2xl">
                                    <p className="text-xl font-bold text-foreground">{stats.total}</p>
                                    <p className="text-xs text-muted-foreground">Total</p>
                                </div>
                                <div className="text-center px-4 py-2 bg-chart-3/10 rounded-2xl">
                                    <p className="text-xl font-bold text-chart-3">{stats.due}</p>
                                    <p className="text-xs text-chart-3 inline-flex items-center gap-1">Due <AceTip term="due" /></p>
                                </div>
                                <div className="text-center px-4 py-2 bg-streak/10 rounded-2xl">
                                    <p className="text-xl font-bold text-streak">{stats.weak}</p>
                                    <p className="text-xs text-streak inline-flex items-center gap-1">Weak <AceTip term="weak_spot" /></p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-5">
                            <Button onClick={() => handleStartReview(selectedDeck, 'all')} className="btn-3d flex-1 bg-chart-3 hover:bg-chart-3 text-white rounded-xl gap-2">
                                <Play className="w-4 h-4" /> Review All
                            </Button>
                            <Button onClick={() => handleStartReview(selectedDeck, 'due')} variant="outline" className="flex-1 border-2 border-chart-3/30 text-chart-3 hover:bg-chart-3/10 rounded-xl gap-2">
                                <Clock className="w-4 h-4" /> Due Only ({stats.due})
                            </Button>
                            {stats.weak > 0 && (
                                <Button onClick={() => handleStartReview(selectedDeck, 'weak')} variant="outline" className="flex-1 border-2 border-streak/30 text-streak hover:bg-streak/10 rounded-xl gap-2">
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
                            className="group card-soft p-4 transition-all"
                        >
                            {editingCard?.id === card.id ? (
                                <div className="space-y-3">
                                    <Textarea value={editingCard.question} onChange={e => setEditingCard({ ...editingCard, question: e.target.value })} placeholder="Question" rows={2} className="border-2 border-chart-3/30 focus:border-chart-3 rounded-xl" />
                                    <Textarea value={editingCard.answer} onChange={e => setEditingCard({ ...editingCard, answer: e.target.value })} placeholder="Answer" rows={2} className="border-2 border-primary/30 focus:border-primary rounded-xl" />
                                    <div className="flex gap-2">
                                        <Button onClick={handleSaveCard} size="sm" className="btn-3d bg-chart-3 hover:bg-chart-3 text-white rounded-xl gap-1.5"><Check className="w-3.5 h-3.5" /> Save</Button>
                                        <Button onClick={() => setEditingCard(null)} variant="outline" size="sm" className="rounded-xl"><X className="w-3.5 h-3.5" /></Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-foreground text-sm">{card.question}</p>
                                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{card.answer}</p>
                                        <div className="flex gap-1.5 mt-2 flex-wrap">
                                            <span className="pill bg-secondary text-muted-foreground">{card.total_reviews || 0} reviews</span>
                                            {card.is_weak_spot && <span className="pill bg-streak/15 text-streak">Weak Spot</span>}
                                            {isDue(card) && <span className="pill bg-chart-3/15 text-chart-3">Due</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <button onClick={() => setEditingCard({ ...card })} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-secondary text-muted-foreground">
                                            <Edit className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDeleteCard(card.id)} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-streak/10 text-streak">
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
            {isGenerating && <AISkeleton type="flashcards" count={6} message="Creating your flashcards…" />}

            <div className="space-y-5">
                {/* Search + filters + actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                        <Input placeholder="Search decks..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 border-2 border-border focus:border-chart-3 rounded-xl h-11" />
                    </div>
                    <Select value={filterSubject} onValueChange={setFilterSubject}>
                        <SelectTrigger className="w-full sm:w-44 border-2 border-border rounded-xl h-11">
                            <SelectValue placeholder="All Subjects" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Subjects</SelectItem>
                            {userSubjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                        {/* The way out of a pile that has got away from you.
                            Every other control here makes MORE cards; this is
                            the only one that lets you tell the app it is wrong
                            about the ones you already have. */}
                        <Link to={createPageUrl("Review")}>
                            <Button variant="outline" className="gap-2 border-2 border-border rounded-xl h-11 text-foreground">
                                <ListChecks className="w-4 h-4" /> Check the pile
                            </Button>
                        </Link>
                        <Button onClick={() => setIsCreatingDeck(true)} variant="outline" className="gap-2 border-2 border-border rounded-xl h-11 text-foreground">
                            <Plus className="w-4 h-4" /> New Deck
                        </Button>
                        <Button onClick={() => setIsShowingGenerated(true)} className="btn-3d gap-2 bg-chart-4 hover:bg-chart-4 text-white rounded-xl h-11">
                            <Sparkles className="w-4 h-4" /> Make cards from notes
                        </Button>
                    </div>
                </div>

                {/* Only when there is something in it. A permanent banner for
                    an empty bank is an advert; this is a status line. */}
                {bankOutstanding > 0 && (
                    <Link to={createPageUrl("MistakeBank")}
                        className="flex items-center justify-between gap-3 rounded-2xl border-2 border-streak/30
                            bg-streak/5 px-4 py-3 hover:border-streak/50 transition-colors group">
                        <span className="text-sm text-foreground leading-snug">
                            <span className="font-bold tabular-nums">{bankOutstanding}</span> mistake{bankOutstanding === 1 ? "" : "s"} from
                            your marked quizzes {bankOutstanding === 1 ? "is" : "are"} still costing you marks.
                        </span>
                        <span className="text-xs font-bold text-streak flex-shrink-0 group-hover:translate-x-0.5 transition-transform">
                            Mistake bank →
                        </span>
                    </Link>
                )}

                {Object.keys(decksBySubject).length === 0 ? (
                    <div className="text-center py-20 card-soft">
                        <Brain className="w-14 h-14 text-muted-foreground/60 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-foreground mb-2">No decks yet</h3>
                        <p className="text-sm text-muted-foreground mb-6">Create your first deck manually or let AI generate one from your notes.</p>
                        <div className="flex gap-3 justify-center">
                            <Button onClick={() => setIsCreatingDeck(true)} variant="outline" className="gap-2 rounded-xl border-2"><Plus className="w-4 h-4" /> Create Deck</Button>
                            <Button onClick={() => setIsShowingGenerated(true)} className="btn-3d gap-2 bg-chart-4 hover:bg-chart-4 text-white rounded-xl"><Sparkles className="w-4 h-4" /> Make cards from notes</Button>
                        </div>
                    </div>
                ) : (
                    Object.entries(decksBySubject).map(([subjectName, subjectDecks]) => {
                        const groupColor = subjectColor(
                            userSubjects.find(s => s.subject_name === subjectName), subjectName);
                        const totalDue = subjectDecks.reduce((sum, d) => sum + d.cards.filter(isDue).length, 0);
                        return (
                            <div key={subjectName} className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: groupColor }} />
                                    <h3 className="font-bold text-foreground">{subjectName}</h3>
                                    <span className="text-xs text-muted-foreground/60">
                                        {subjectDecks.length} deck{subjectDecks.length === 1 ? "" : "s"}
                                    </span>
                                    {totalDue > 0 && <span className="pill bg-chart-3/10 text-chart-3">{totalDue} due</span>}
                                </div>
                                {/* Wrapped rather than gridded. A four-column
                                    grid leaves a subject with one deck sitting
                                    in an acre of nothing; decks laid out left
                                    to right fill the space they need. */}
                                <div className="flex flex-wrap gap-x-3 gap-y-3">
                                    {subjectDecks.map((deck, i) => (
                                        <DeckCard key={deck.id} deck={deck} subjectColor={groupColor}
                                            index={i}
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
                        <Button onClick={handleCreateDeck} className="btn-3d bg-chart-3 hover:bg-chart-3 text-white rounded-xl">Next: Add Cards</Button>
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
                            <Textarea value={newCard.question} onChange={e => setNewCard({ ...newCard, question: e.target.value })} placeholder="What is...?" rows={3} className="border-2 border-border focus:border-chart-3 rounded-xl resize-none" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Answer / Back</Label>
                            <Textarea value={newCard.answer} onChange={e => setNewCard({ ...newCard, answer: e.target.value })} placeholder="The answer is..." rows={3} className="border-2 border-border focus:border-primary rounded-xl resize-none" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingCard(false)} className="rounded-xl">Done</Button>
                        <Button onClick={handleAddCard} className="btn-3d bg-chart-3 hover:bg-chart-3 text-white rounded-xl gap-2"><Plus className="w-4 h-4" /> Add Card</Button>
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
                                {friends.length === 0 ? (
                                    <div className="flex flex-col items-center text-center gap-2 py-8">
                                        <UserPlus className="w-8 h-8 text-muted-foreground/60" />
                                        <p className="text-sm text-muted-foreground">No friends yet to share with.</p>
                                        <Link to={createPageUrl("Friends")} className="text-xs font-bold text-primary hover:underline">
                                            Add friends →
                                        </Link>
                                    </div>
                                ) :
                                    friends.map(f => (
                                        <div key={f.email} className="flex items-center gap-3 p-3 hover:bg-secondary/50 rounded-xl">
                                            <Checkbox checked={selectedFriends.includes(f.email)} onCheckedChange={c => setSelectedFriends(c ? [...selectedFriends, f.email] : selectedFriends.filter(e => e !== f.email))} />
                                            <div><p className="font-medium text-sm">{f.full_name}</p><p className="text-xs text-muted-foreground">{f.email}</p></div>
                                        </div>
                                    ))}
                            </ScrollArea>
                        </TabsContent>
                        <TabsContent value="groups" className="flex-1 overflow-hidden">
                            <ScrollArea className="h-56">
                                {groups.length === 0 ? (
                                    <div className="flex flex-col items-center text-center gap-2 py-8">
                                        <Users className="w-8 h-8 text-muted-foreground/60" />
                                        <p className="text-sm text-muted-foreground">Not in any study groups yet.</p>
                                        <Link to={createPageUrl("StudyGroups")} className="text-xs font-bold text-primary hover:underline">
                                            Find a group →
                                        </Link>
                                    </div>
                                ) :
                                    groups.map(g => (
                                        <div key={g.id} className="flex items-center gap-3 p-3 hover:bg-secondary/50 rounded-xl border border-border mb-2">
                                            <Checkbox checked={selectedGroups.includes(g.id)} onCheckedChange={c => setSelectedGroups(c ? [...selectedGroups, g.id] : selectedGroups.filter(id => id !== g.id))} />
                                            <div><p className="font-medium text-sm">{g.name}</p><p className="text-xs text-muted-foreground">{g.subject} · {g.member_emails?.length || 0} members</p></div>
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
                            <Sparkles className="w-5 h-5 text-chart-4" /> Make flashcards from your notes
                        </DialogTitle>
                    </DialogHeader>

                    {!generatedFlashcards ? (
                        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                            {/* Upload */}
                            <div className={`rounded-2xl border-2 border-dashed transition-all ${uploadedFiles.length ? 'border-chart-4 bg-chart-4/10' : 'border-border bg-secondary/50'}`}>
                                <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-chart-4/5 transition-colors rounded-2xl">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${uploadedFiles.length ? 'bg-chart-4/20' : 'bg-surface'}`}>
                                        <FileText className={`w-5 h-5 ${uploadedFiles.length ? 'text-chart-4' : 'text-muted-foreground/60'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-semibold ${uploadedFiles.length ? 'text-chart-4' : 'text-foreground'}`}>
                                            {uploadedFiles.length ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} selected` : 'Upload Study Material'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">PDF, DOCX, PPTX, or TXT — multiple files supported</p>
                                    </div>
                                    <input type="file" className="hidden" accept=".pdf,.txt,.docx,.pptx" multiple onChange={e => {
                                        const files = Array.from(e.target.files || []);
                                        setUploadedFiles(prev => { const names = new Set(prev.map(f => f.name)); return [...prev, ...files.filter(f => !names.has(f.name))]; });
                                    }} />
                                </label>
                                {uploadedFiles.length > 0 && (
                                    <div className="px-4 pb-3 space-y-1.5" onClick={e => e.stopPropagation()}>
                                        {uploadedFiles.map((f, i) => (
                                            <div key={i} className="flex items-center gap-2 bg-surface rounded-lg px-3 py-1.5 border border-chart-4/20">
                                                <FileText className="w-3.5 h-3.5 text-chart-4 flex-shrink-0" />
                                                <span className="flex-1 text-xs font-medium text-foreground truncate">{f.name}</span>
                                                <span className="text-xs text-muted-foreground/60">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                                                <button type="button" onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground/60 hover:text-streak">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Settings */}
                            <div className="space-y-4">
                                {/* How many + how deep. These two decide whether you get a
                                    usable deck or 200 cards, so they lead. */}
                                <div className="space-y-3 bg-secondary/40 rounded-2xl p-3.5 border border-border">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-muted-foreground">How many cards</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {COUNT_OPTIONS.map(n => (
                                                <button key={n} type="button" onClick={() => setAiSettings({ ...aiSettings, cardCount: n })}
                                                    className={`px-3.5 py-1.5 rounded-xl text-sm font-bold border-2 transition-all ${aiSettings.cardCount === n ? "bg-foreground border-foreground text-background" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
                                                    {n}
                                                </button>
                                            ))}
                                            <button type="button" onClick={() => setAiSettings({ ...aiSettings, cardCount: 'max' })}
                                                className={`px-3.5 py-1.5 rounded-xl text-sm font-bold border-2 transition-all ${aiSettings.cardCount === 'max' ? "bg-foreground border-foreground text-background" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
                                                As many as possible
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-muted-foreground">Coverage</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            {COVERAGE_OPTIONS.map(c => (
                                                <button key={c.id} type="button" onClick={() => setAiSettings({ ...aiSettings, coverage: c.id })}
                                                    className={`text-left px-3 py-2 rounded-xl border-2 transition-all ${aiSettings.coverage === c.id ? "bg-chart-4/10 border-chart-4" : "border-border hover:border-muted-foreground"}`}>
                                                    <span className={`block text-sm font-bold ${aiSettings.coverage === c.id ? "text-chart-4" : "text-foreground"}`}>{c.label}</span>
                                                    <span className="block text-xs text-muted-foreground leading-snug mt-0.5">{c.blurb}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted-foreground/80">{generationSummary(aiSettings.cardCount, aiSettings.coverage)}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-muted-foreground">Difficulty</Label>
                                        <Select value={aiSettings.difficulty} onValueChange={v => setAiSettings({ ...aiSettings, difficulty: v })}>
                                            <SelectTrigger className="border-2 rounded-xl h-10"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="easy">Easy</SelectItem>
                                                <SelectItem value="mixed">Mixed</SelectItem>
                                                <SelectItem value="challenging">Challenging</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-muted-foreground">Question Style</Label>
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
                                        {/* "Emphasis", not "Focus Area" — Coverage above already
                                            answers how much, and two controls both offering
                                            "key concepts" read as the same dial twice. This one
                                            picks what kind of content, not how much of it. */}
                                        <Label className="text-xs font-medium text-muted-foreground">Emphasis</Label>
                                        <Select value={aiSettings.focusArea} onValueChange={v => setAiSettings({ ...aiSettings, focusArea: v })}>
                                            <SelectTrigger className="border-2 rounded-xl h-10"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="key_concepts">Concepts &amp; Theories</SelectItem>
                                                <SelectItem value="definitions">Definitions</SelectItem>
                                                <SelectItem value="processes">Processes</SelectItem>
                                                <SelectItem value="relationships">Cause & Effect</SelectItem>
                                                <SelectItem value="exam_prep">Exam Prep</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-muted-foreground">Answer Detail</Label>
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

                                <div className="flex items-center gap-3 bg-secondary/50 rounded-2xl p-3.5 border border-border">
                                    <Checkbox id="includeExamples" checked={aiSettings.includeExamples} onCheckedChange={c => setAiSettings({ ...aiSettings, includeExamples: c })} />
                                    <label htmlFor="includeExamples" className="text-sm font-medium text-foreground cursor-pointer">Include examples in answers</label>
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
                            <div className="flex-1 overflow-y-auto bg-secondary/50 rounded-2xl border border-border p-3 space-y-2">
                                <p className="text-sm font-semibold text-muted-foreground mb-1">{generatedFlashcards.length} generated cards</p>
                                {generatedFlashcards.map((card, i) => (
                                    <div key={i} className="bg-surface rounded-xl p-3.5 border border-border">
                                        <p className="font-medium text-sm text-foreground mb-1">{card.question}</p>
                                        <p className="text-xs text-muted-foreground">{card.answer}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={() => { clearDraft(); setIsShowingGenerated(false); setGeneratedFlashcards(null); setUploadedFiles([]); }} className="rounded-xl">Cancel</Button>
                        {!generatedFlashcards ? (
                            <Button onClick={handleGenerateFlashcardsFromFile} disabled={!uploadedFiles.length || isGenerating} className="btn-3d bg-chart-4 hover:bg-chart-4 text-white rounded-xl gap-2">
                                {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> {aiSettings.cardCount === 'max' ? 'Make every card it supports' : `Make ${aiSettings.cardCount} cards`}</>}
                            </Button>
                        ) : (
                            <Button onClick={() => handleSaveGeneratedFlashcards(newDeck)} disabled={!newDeck.subject_name || !newDeck.topic || isSavingDeck} className="btn-3d bg-chart-3 hover:bg-chart-3 text-white rounded-xl gap-2">
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
                                        { label: "Total", val: viewingStats.cards.length, color: "text-foreground", bg: "bg-secondary/50" },
                                        { label: "Due", val: viewingStats.cards.filter(isDue).length, color: "text-chart-3", bg: "bg-chart-3/10" },
                                        { label: "Weak", val: viewingStats.cards.filter(c => c.is_weak_spot).length, color: "text-streak", bg: "bg-streak/10" },
                                        { label: "Mastered", val: viewingStats.cards.filter(c => computeMasteryScore(c) >= 80 && !c.is_weak_spot).length, color: "text-primary", bg: "bg-primary/10" },
                                    ].map(s => (
                                        <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
                                            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="card-soft p-4 space-y-3">
                                    <p className="text-sm font-semibold text-foreground">Rating Distribution</p>
                                    {['again', 'hard', 'good', 'easy'].map(rating => {
                                        const count = viewingStats.cards.reduce((s, c) => s + (c[`review_count_${rating}`] || 0), 0);
                                        const allCount = viewingStats.cards.reduce((s, c) => s + (c.review_count_again || 0) + (c.review_count_hard || 0) + (c.review_count_good || 0) + (c.review_count_easy || 0), 0);
                                        const pct = allCount > 0 ? Math.round((count / allCount) * 100) : 0;
                                        // Static class strings — JIT-safe lookup table.
                                        const colors = {
                                            again: { bar: 'bg-streak', text: 'text-streak' },
                                            hard:  { bar: 'bg-xp',     text: 'text-xp' },
                                            good:  { bar: 'bg-chart-3', text: 'text-chart-3' },
                                            easy:  { bar: 'bg-primary', text: 'text-primary' },
                                        };
                                        return (
                                            <div key={rating}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className={`text-xs font-semibold capitalize ${colors[rating].text}`}>{rating}</span>
                                                    <span className="text-xs text-muted-foreground">{count} ({pct}%)</span>
                                                </div>
                                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                                    <div className={`${colors[rating].bar} h-full rounded-full`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-secondary/50 rounded-2xl p-4">
                                        <p className="text-xl font-bold text-foreground">{viewingStats.cards.reduce((s, c) => s + (c.total_reviews || 0), 0)}</p>
                                        <p className="text-xs text-muted-foreground">Total Reviews</p>
                                    </div>
                                    <div className="bg-secondary/50 rounded-2xl p-4">
                                        <p className="text-xl font-bold text-foreground">{Math.round(viewingStats.cards.reduce((s, c) => s + (c.total_reviews || 0), 0) / (viewingStats.cards.length || 1))}</p>
                                        <p className="text-xs text-muted-foreground">Avg per Card</p>
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