import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Brain,
    Search,
    Wand2,
    Plus,
    FileText,
    Upload,
    Loader2,
    X,
    ArrowLeft,
    Sparkles,
    PlusCircle,
    CheckCircle2,
    GraduationCap
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { moderationPresets } from "@/components/shared/contentModeration";
import AILoadingProgress from "../components/shared/AILoadingProgress";
import { isPremium } from "@/components/shared/subscriptionHelpers";
import UpgradeModal from "@/components/shared/UpgradeModal";
import HelpButton from "@/components/shared/HelpButton";

import QuizCard from "../components/quizzes/QuizCard";
import QuizPlayer from "../components/quizzes/QuizPlayer";

export default function Quizzes() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [quizzes, setQuizzes] = useState([]);
    const [quizAttempts, setQuizAttempts] = useState([]);
    const [sharedQuizzes, setSharedQuizzes] = useState([]);
    const [userSubjects, setUserSubjects] = useState([]);
    const [selectedQuiz, setSelectedQuiz] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAIDialog, setShowAIDialog] = useState(false);
    const [isManualCreate, setIsManualCreate] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");

    const [isLoading, setIsLoading] = useState(true);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const { toast } = useToast();

    const [aiSettings, setAiSettings] = useState({
        subject: "",
        customSubject: "",
        topic: "",
        difficulty: "Medium",
        num_questions: 10,
        question_types: "mixed",
        focus_areas: "",
        quiz_style: "standard",
        ai_instructions: "",
        include_explanations: true,
        marks_per_short: "5"
    });

    const [manualQuiz, setManualQuiz] = useState({
        title: "",
        subject: "",
        difficulty: "intermediate",
        questions: []
    });

    const [currentQuestion, setCurrentQuestion] = useState({
        type: "mcq",
        question: "",
        options: ["", "", "", ""],
        correct_answer: 0,
        marks: 5,
        explanation: ""
    });

    // Helper function for page navigation
    const createPageUrl = (pageName) => {
        switch (pageName) {
            case "Subjects":
                return "/subjects";
            // Add other page mappings if needed
            default:
                return "/";
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const currentUser = await base44.auth.me();
            setUser(currentUser);

            // Load user profile
            const profiles = await base44.entities.UserProfile.filter({ created_by: currentUser.email });
            setUserProfile(profiles[0] || null);

            // Load data with individual error handling
            let quizzesData = [];
            let attemptsData = [];
            let sharedQuizzesData = [];
            let userSubjectsData = [];

            try {
                quizzesData = await base44.entities.Quiz.filter({ created_by: currentUser.email });
            } catch (e) {
                console.error("Error loading quizzes:", e);
            }

            try {
                attemptsData = await base44.entities.QuizAttempt.filter({ created_by: currentUser.email });
            } catch (e) {
                console.error("Error loading quiz attempts:", e);
            }

            try {
                sharedQuizzesData = await base44.entities.SharedQuiz.filter({
                    shared_with_email: currentUser.email
                });
            } catch (e) {
                console.error("Error loading shared quizzes:", e);
            }

            try {
                userSubjectsData = await base44.entities.UserSubject.filter({
                    created_by: currentUser.email,
                    is_active: true
                });
            } catch (e) {
                console.error("Error loading user subjects:", e);
            }

            setQuizzes(quizzesData || []);
            setQuizAttempts(attemptsData || []);
            setSharedQuizzes(sharedQuizzesData || []);
            setUserSubjects(userSubjectsData || []);

        } catch (error) {
            console.error("Error loading data:", error);
            if (error.message && error.message.includes("not logged in")) {
                base44.auth.redirectToLogin(window.location.pathname);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddQuestion = () => {
        if (!currentQuestion.question.trim()) {
            toast({ title: "Missing question", description: "Please enter a question.", variant: "destructive" });
            return;
        }

        if (currentQuestion.type === "mcq") {
            const validOptions = currentQuestion.options.filter(o => o.trim());
            if (validOptions.length < 2) {
                toast({ title: "Need options", description: "Please add at least 2 options.", variant: "destructive" });
                return;
            }
        }

        setManualQuiz({
            ...manualQuiz,
            questions: [...manualQuiz.questions, { ...currentQuestion }]
        });

        setCurrentQuestion({
            type: "mcq",
            question: "",
            options: ["", "", "", ""],
            correct_answer: 0,
            marks: 5,
            explanation: ""
        });

        toast({ title: "Question added!", description: `${manualQuiz.questions.length + 1} question${manualQuiz.questions.length + 1 > 1 ? 's' : ''} in quiz.` });
    };

    const handleCreateManualQuiz = async () => {
        if (!manualQuiz.title || !manualQuiz.subject || manualQuiz.questions.length === 0) {
            toast({ title: "Missing information", description: "Please add title, subject, and at least one question.", variant: "destructive" });
            return;
        }

        try {
            await base44.entities.Quiz.create({
                title: manualQuiz.title,
                subject: manualQuiz.subject,
                questions: manualQuiz.questions,
                difficulty: manualQuiz.difficulty,
                category: "subject_content"
            });

            // If the subject doesn't exist in userSubjects, create it.
            const subjectExists = userSubjects.some(s => s.subject_name === manualQuiz.subject);
            if (!subjectExists) {
                await base44.entities.UserSubject.create({
                    subject_name: manualQuiz.subject,
                    subject_code: manualQuiz.subject.substring(0, 6).toUpperCase(),
                    color: "#6B7280",
                    is_active: true
                });
            }

            toast({ title: "Quiz created!", description: `Created with ${manualQuiz.questions.length} questions.` });

            setManualQuiz({
                title: "",
                subject: "",
                difficulty: "intermediate",
                questions: []
            });
            setCurrentQuestion({
                type: "mcq",
                question: "",
                options: ["", "", "", ""],
                correct_answer: 0,
                marks: 5,
                explanation: ""
            });
            setIsManualCreate(false);
            await loadData();
        } catch (error) {
            console.error("Error creating quiz:", error);
            toast({ title: "Error", description: "Could not create quiz.", variant: "destructive" });
        }
    };



    const handleAcceptSharedQuiz = async (sharedQuiz) => {
        try {
            await base44.entities.Quiz.create({
                title: sharedQuiz.quiz_data.title,
                subject: sharedQuiz.quiz_data.subject,
                questions: sharedQuiz.quiz_data.questions,
                difficulty: sharedQuiz.quiz_data.difficulty,
                category: sharedQuiz.quiz_data.category
            });

            // If the subject doesn't exist in userSubjects, create it.
            const subjectExists = userSubjects.some(s => s.subject_name === sharedQuiz.quiz_data.subject);
            if (!subjectExists) {
                await base44.entities.UserSubject.create({
                    subject_name: sharedQuiz.quiz_data.subject,
                    subject_code: sharedQuiz.quiz_data.subject.substring(0, 6).toUpperCase(),
                    color: "#6B7280",
                    is_active: true
                });
            }

            await base44.entities.SharedQuiz.update(sharedQuiz.id, {
                status: "accepted"
            });

            toast({
                title: "Quiz accepted!",
                description: "The quiz has been added to your collection."
            });

            await loadData();
        } catch (error) {
            console.error("Error accepting shared quiz:", error);
            toast({ title: "Error", description: "Could not accept quiz.", variant: "destructive" });
        }
    };

    const handleDeclineSharedQuiz = async (sharedQuiz) => {
        try {
            await base44.entities.SharedQuiz.update(sharedQuiz.id, {
                status: "declined"
            });

            toast({ title: "Quiz declined" });
            await loadData();
        } catch (error) {
            console.error("Error declining shared quiz:", error);
            toast({ title: "Error", description: "Could not decline quiz.", variant: "destructive" });
        }
    };

    const handleGenerateQuiz = async () => {
        const effectiveSubject = aiSettings.customSubject || aiSettings.subject;
        const uploadedFile = uploadedFiles[0]; // kept for compat checks below
        
        if (!uploadedFiles.length || !effectiveSubject) {
            toast({ 
                title: "Missing Information", 
                description: "Please upload a file and select/enter a subject.", 
                variant: "destructive" 
            });
            return;
        }

        if (isGenerating) return;

        // Check credits (free users only)
        const isPremium = userProfile?.subscription_tier === 'premium';
        if (!isPremium) {
            const currentCredits = userProfile?.ai_credits || 0;
            if (currentCredits < 100) {
                toast({ 
                    title: "Not enough credits", 
                    description: "You need 100 credits to generate a quiz.", 
                    variant: "destructive" 
                });
                return;
            }
        }

        // Close dialog and show loading
        setShowAIDialog(false);
        setIsGenerating(true);

        try {
            // Upload all files
            const uploadedUrls = await Promise.all(uploadedFiles.map(f => base44.integrations.Core.UploadFile({ file: f }).then(r => ({ file_url: r.file_url, name: f.name, ext: f.name.split('.').pop()?.toLowerCase() }))));
            const file_url = uploadedUrls[0].file_url; // primary file for source_file_url

            // Determine question type mix — strict counts
            let questionTypeInstruction = "";
            let mcqTarget = 0;
            let shortTarget = 0;
            if (aiSettings.question_types === "mcq_only") {
                mcqTarget = aiSettings.num_questions;
                questionTypeInstruction = `You MUST generate EXACTLY ${mcqTarget} multiple choice questions and 0 short answer questions. Every single question must be type "mcq". Total questions: ${mcqTarget}.`;
            } else if (aiSettings.question_types === "short_only") {
                shortTarget = aiSettings.num_questions;
                questionTypeInstruction = `You MUST generate EXACTLY ${shortTarget} short answer questions and 0 multiple choice questions. Every single question must be type "short_answer". Total questions: ${shortTarget}.`;
            } else {
                mcqTarget = Math.ceil(aiSettings.num_questions * 0.6);
                shortTarget = aiSettings.num_questions - mcqTarget;
                questionTypeInstruction = `You MUST generate EXACTLY ${mcqTarget} multiple choice questions (type "mcq") followed by EXACTLY ${shortTarget} short answer questions (type "short_answer"). Total questions: ${aiSettings.num_questions}. Do not deviate from these counts.`;
            }

            const difficultyDesc = {
                "Easy": "simple recall and basic comprehension questions. Use straightforward language. Avoid trick questions.",
                "Medium": "application and analysis questions that require understanding of concepts, not just recall.",
                "Hard": "synthesis, evaluation and complex multi-step problems. Exam-level difficulty. Include nuanced distractors for MCQs."
            }[aiSettings.difficulty] || "intermediate level";

            const styleDesc = {
                "standard": "standard VCE-style questions",
                "exam_practice": "strict past-paper exam style, formal tone, timed-exam feel",
                "revision": "quick revision style — clear, concise questions that reinforce key facts",
                "challenge": "challenging stretch questions designed to push beyond the syllabus"
            }[aiSettings.quiz_style] || "standard style";

            // Handle DOCX/PPTX files — extract text; rest go as file_urls
            const directFileUrls = uploadedUrls.filter(f => f.ext !== 'docx' && f.ext !== 'pptx').map(f => f.file_url);
            const docFiles = uploadedUrls.filter(f => f.ext === 'docx' || f.ext === 'pptx');
            let documentContentPrompt = '';
            for (const df of docFiles) {
                const textResult = await base44.functions.invoke('extractDocumentText', { file_url: df.file_url });
                if (textResult.data?.text) documentContentPrompt += `\n\n[${df.name}]:\n${textResult.data.text}`;
            }
            const fileExtension = uploadedFiles[0].name.split('.').pop()?.toLowerCase();

            const marksValue = parseInt(aiSettings.marks_per_short) || 5;

            // Only pass PDF/TXT files directly to Gemini (it can't natively read DOCX/PPTX).
            // DOCX/PPTX content is already extracted as text in documentContentPrompt above.
            const geminiCompatibleUrls = uploadedUrls.filter(f => f.ext !== 'docx' && f.ext !== 'pptx').map(f => f.file_url);

            const response = await base44.integrations.Core.InvokeLLM({
                model: "gemini_3_flash",
                prompt: `You are an expert VCE quiz generator. Generate a quiz from the provided study material — including ALL text, diagrams, tables, graphs, and images.

SUBJECT: ${effectiveSubject}${aiSettings.topic ? ` | TOPIC: ${aiSettings.topic}` : ''}
${aiSettings.focus_areas ? `FOCUS AREAS: ${aiSettings.focus_areas}` : ''}
${aiSettings.ai_instructions ? `SPECIAL INSTRUCTIONS FROM STUDENT: ${aiSettings.ai_instructions}` : ''}
${documentContentPrompt}

=== QUESTION COUNT RULES ===
${questionTypeInstruction}
Generate UP TO ${aiSettings.num_questions} questions. If the material does not contain enough unique, distinct content to fill all ${aiSettings.num_questions} questions without repetition, generate FEWER questions. It is BETTER to generate fewer high-quality, non-repetitive questions than to pad with duplicates or near-duplicates.
NEVER generate two questions that test the same fact, concept, or piece of information.
Every question must test something DIFFERENT from every other question in this quiz.

DIFFICULTY: ${aiSettings.difficulty} — ${difficultyDesc}
STYLE: ${styleDesc}

=== FORMATTING RULES ===
- Use plain text for ALL math: "y = e^x cos(3x)" NOT "$$e^x\\cos(3x)$$"
- Fractions: use "/" e.g. "a/b"
- Exponents: use "^" e.g. "x^2"
- Square roots: write "sqrt(x)"

=== MULTIPLE CHOICE RULES ===
- MUST have EXACTLY 4 answer options per question
- Options must be distinct and plausible (good distractors at ${aiSettings.difficulty} level)
- correct_answer = index (0, 1, 2 or 3) of the correct option
${aiSettings.include_explanations ? '- Include a brief explanation of why the answer is correct' : '- Skip explanations to keep it concise'}

=== SHORT ANSWER RULES ===
- Each short answer question is worth ${marksValue} marks
- Provide a model answer with ${marksValue} key points/dot points
- Model answer should be detailed enough to mark against

Base ALL questions on the provided material. If files are attached, read ALL content including images, charts, tables, and figures carefully.`,
                file_urls: geminiCompatibleUrls.length ? geminiCompatibleUrls : undefined,
                response_json_schema: {
                    type: "object",
                    properties: {
                        questions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: { type: "string" },
                                    question: { type: "string" },
                                    options: { type: "array", items: { type: "string" } },
                                    correct_answer: { type: "number" },
                                    model_answer: { type: "string" },
                                    marks: { type: "number" },
                                    explanation: { type: "string" }
                                },
                                required: ["type", "question"]
                            }
                        }
                    },
                    required: ["questions"]
                }
            });

            if (!response?.questions?.length) {
                throw new Error("AI didn't generate questions. Try a different file or fewer questions.");
            }

            // Format and validate questions — enforce type constraints
            const formattedQuestions = response.questions
                .map(q => {
                    // Force type based on user setting
                    let forcedType = q.type === "short_answer" ? "short_answer" : "mcq";
                    if (aiSettings.question_types === "mcq_only") forcedType = "mcq";
                    if (aiSettings.question_types === "short_only") forcedType = "short_answer";
                    return { ...q, type: forcedType };
                })
                .filter(q => {
                    if (q.type === "mcq") {
                        if (!q.options || q.options.length < 2) {
                            console.warn("Skipping MCQ without options:", q.question);
                            return false;
                        }
                    }
                    return true;
                })
                .map(q => ({
                    type: q.type,
                    question: q.question,
                    options: q.type === "mcq" ? (q.options?.slice(0, 4).concat(Array(Math.max(0, 4 - (q.options?.length || 0))).fill("")).slice(0, 4)) : undefined,
                    correct_answer: q.type === "mcq" ? (q.correct_answer ?? 0) : undefined,
                    model_answer: q.type === "short_answer" ? (q.model_answer || "") : undefined,
                    marks: q.type === "short_answer" ? (q.marks || marksValue) : undefined,
                    explanation: aiSettings.include_explanations ? (q.explanation || "") : ""
                }))
                .slice(0, aiSettings.num_questions); // Hard cap to exact count requested

            if (formattedQuestions.length === 0) {
                throw new Error("No valid questions generated. Please try again.");
            }

            // Save quiz
            await base44.entities.Quiz.create({
                title: effectiveSubject + (aiSettings.topic ? ' - ' + aiSettings.topic : '') + (aiSettings.quiz_style !== 'standard' ? ' (' + aiSettings.quiz_style.replace('_', ' ') + ')' : ''),
                subject: effectiveSubject,
                questions: formattedQuestions,
                difficulty: aiSettings.difficulty,
                category: "subject_content",
                source_file_url: file_url
            });

            // Only create subject if it doesn't already exist
            if (!userSubjects.some(s => s.subject_name === effectiveSubject)) {
                await base44.entities.UserSubject.create({
                    subject_name: effectiveSubject,
                    subject_code: effectiveSubject.substring(0, 6).toUpperCase(),
                    color: "#6B7280",
                    is_active: true
                });
            }

            // Deduct credits (free users only)
            if (!isPremium && userProfile) {
                await base44.entities.UserProfile.update(userProfile.id, {
                    ai_credits: Math.max(0, userProfile.ai_credits - 100)
                });
            }

            toast({ 
                title: "✅ Quiz created!", 
                description: `${formattedQuestions.length} questions generated successfully` 
            });

            // Reset form
            setUploadedFiles([]);
            setAiSettings({
                subject: "",
                customSubject: "",
                topic: "",
                difficulty: "Medium",
                num_questions: 10,
                question_types: "mixed",
                focus_areas: "",
                quiz_style: "standard",
                ai_instructions: "",
                include_explanations: true,
                marks_per_short: "5"
            });
            setIsGenerating(false);
            await loadData();
        } catch (error) {
            console.error("Quiz generation error:", error);

            toast({ 
                title: "❌ Generation failed", 
                description: error.message || "Try a smaller file or fewer questions",
                variant: "destructive" 
            });
            setIsGenerating(false);
        }
    };

    const handleDeleteQuiz = async (quizId) => {
        if (!window.confirm("Are you sure you want to delete this quiz?")) return;

        try {
            // Delete the quiz
            await base44.entities.Quiz.delete(quizId);

            // Remove from shared quizzes
            const existingShares = await base44.entities.SharedQuiz.filter({
                quiz_id: quizId,
                shared_by_email: user.email
            });

            if (existingShares.length > 0) {
                await Promise.all(existingShares.map(share => base44.entities.SharedQuiz.delete(share.id)));
            }

            toast({ title: "Quiz deleted", description: "The quiz has been removed from your library and sharing." });
            await loadData();
        } catch (error) {
            console.error("Error deleting quiz:", error);
            toast({ title: "Error", description: "Could not delete the quiz.", variant: "destructive" });
        }
    };

    const handleReshuffleQuiz = async (quiz) => {
        if (!quiz.source_file_url) {
            toast({ title: "No source file", description: "This quiz was not generated from a file.", variant: "destructive" });
            return;
        }

        if (!window.confirm("Generate new questions from the source material? This will create a new quiz.")) return;

        setIsGenerating(true);

        try {
            const numQuestions = quiz.questions?.length || 10;
            const mcqCount = Math.ceil(numQuestions * 0.6);
            const shortCount = numQuestions - mcqCount;

            const response = await base44.integrations.Core.InvokeLLM({
                model: "gemini_3_flash",
                prompt: `You are a VCE quiz generator. Create a COMPLETELY NEW and DIFFERENT quiz for: ${quiz.subject}. Read ALL content in the document including text, images, diagrams, tables, and figures.

            IMPORTANT: Generate DIFFERENT questions from what might have been asked before. Focus on different aspects of the content. NEVER generate two questions that test the same concept or fact.

            Generate UP TO ${numQuestions} questions total (${mcqCount} MCQ first, then ${shortCount} short answer). If the document does not have enough unique content for all ${numQuestions} non-repetitive questions, generate fewer — quality over quantity.

            Difficulty: ${quiz.difficulty || 'Medium'}
            Base ALL questions on the uploaded document content, including any images, charts, or figures.

QUESTION ORDER: All MCQ questions MUST come before any short answer questions.

CRITICAL FORMATTING RULES:
- Use plain text for ALL mathematical expressions - NO dollar signs, NO LaTeX notation
- Write equations naturally: "y = e^x cos(3x)" not wrapped in any special syntax
- For fractions use "/" (e.g., "a/b" or "(x+1)/(x-1)")
- For exponents use "^" (e.g., "x^2", "e^x")
- For square roots write "sqrt(x)"
- Examples:
  * Correct: "Find the derivative of f(x) = e^x cos(3x)"
  * Correct: "Solve for x when 2x + 5 = 13"
  * Wrong: "Find the derivative of $$f(x) = e^x \\cos(3x)$$"
  * Wrong: "Solve for $x$"

MULTIPLE CHOICE:
- MUST have EXACTLY 4 answer options for EVERY multiple choice question
- Options must be distinct and plausible
- One correct answer (provide its index: 0, 1, 2, or 3)
- Brief explanation why the answer is correct
- All math in options uses plain text (no LaTeX, no dollar signs)

SHORT ANSWER:
- Award 3, 5, or 8 marks based on complexity
- Provide a model answer matching the mark allocation
- 3 marks = 3 key points, 5 marks = 5 points, 8 marks = 8 points
- All math in answers uses plain text (no LaTeX, no dollar signs)

Return valid JSON only.`,
                file_urls: [quiz.source_file_url],
                response_json_schema: {
                    type: "object",
                    properties: {
                        questions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: { type: "string" },
                                    question: { type: "string" },
                                    options: { type: "array", items: { type: "string" } },
                                    correct_answer: { type: "number" },
                                    model_answer: { type: "string" },
                                    marks: { type: "number" },
                                    explanation: { type: "string" }
                                },
                                required: ["type", "question"]
                            }
                        }
                    },
                    required: ["questions"]
                }
            });

            if (!response?.questions?.length) {
                throw new Error("AI didn't generate questions. Try again.");
            }

            // Sort questions: MCQ first, then short answer
            const sortedQuestions = response.questions.sort((a, b) => {
                const aIsMcq = a.type === 'mcq' || a.type !== 'short_answer';
                const bIsMcq = b.type === 'mcq' || b.type !== 'short_answer';
                if (aIsMcq && !bIsMcq) return -1;
                if (!aIsMcq && bIsMcq) return 1;
                return 0;
            });

            const formattedQuestions = sortedQuestions
                .filter(q => {
                    if (q.type === 'mcq' || q.type !== 'short_answer') {
                        if (!q.options || q.options.length !== 4) {
                            console.warn("Skipping MCQ without 4 options:", q.question);
                            return false;
                        }
                    }
                    return true;
                })
                .map(q => ({
                    type: q.type === 'short_answer' ? 'short_answer' : 'mcq',
                    question: q.question,
                    options: q.type === 'mcq' || q.type !== 'short_answer' ? q.options : undefined,
                    correct_answer: q.type === 'mcq' || q.type !== 'short_answer' ? (q.correct_answer ?? 0) : undefined,
                    model_answer: q.type === 'short_answer' ? (q.model_answer || "") : undefined,
                    marks: q.type === 'short_answer' ? (q.marks || 5) : undefined,
                    explanation: q.explanation || ""
                }));

            if (formattedQuestions.length === 0) {
                throw new Error("No valid questions generated. Please try again.");
            }

            await base44.entities.Quiz.create({
                title: `${quiz.subject} (Reshuffled)`,
                subject: quiz.subject,
                questions: formattedQuestions,
                difficulty: quiz.difficulty,
                category: quiz.category || "subject_content",
                source_file_url: quiz.source_file_url
            });

            toast({ 
                title: "✅ New quiz created!", 
                description: `${formattedQuestions.length} new questions generated` 
            });

            await loadData();
        } catch (error) {
            console.error("Reshuffle error:", error);
            toast({ 
                title: "❌ Reshuffle failed", 
                description: error.message || "Could not generate new questions",
                variant: "destructive" 
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const filteredQuizzes = useMemo(() => {
        return quizzes.filter(quiz => {
            const matchesSearch = quiz.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                quiz.subject?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === "all" || quiz.subject === filterCategory;
            return matchesSearch && matchesCategory;
        });
    }, [quizzes, searchTerm, filterCategory]);

    const quizzesBySubject = useMemo(() => {
        const grouped = {};
        filteredQuizzes.forEach(quiz => {
            const subject = quiz.subject || 'Other';
            if (!grouped[subject]) {
                grouped[subject] = [];
            }
            grouped[subject].push(quiz);
        });
        return grouped;
    }, [filteredQuizzes]);

    const pendingSharedQuizzes = sharedQuizzes.filter(sq => sq.status === "pending");

    if (isPlaying && selectedQuiz) {
        return (
            <div className="min-h-screen px-4 lg:px-8 py-6 bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
                <div className="w-full max-w-5xl mx-auto">
                    <Button
                        variant="outline"
                        onClick={() => {
                            setIsPlaying(false);
                            setSelectedQuiz(null);
                        }}
                        className="mb-6"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Quizzes
                    </Button>
                    <QuizPlayer
                        quiz={selectedQuiz}
                        onComplete={async (results) => {
                            try {
                                await base44.entities.QuizAttempt.create({
                                    quiz_id: selectedQuiz.id,
                                    quiz_title: selectedQuiz.title,
                                    quiz_category: selectedQuiz.category || "subject_content",
                                    score: results.score,
                                    questions_total: results.total,
                                    questions_correct: results.correct,
                                    time_taken: results.timeTaken,
                                    user_answers: results.userAnswers,
                                    date: new Date().toISOString().split('T')[0]
                                });

                                // Award XP: 2 XP per mark/correct answer
                                const eventKey = `quiz_${selectedQuiz.id}_${Date.now()}`;
                                await base44.functions.invoke('awardXP', {
                                    source: 'quiz',
                                    event_key: eventKey,
                                    quiz_score: results.score,
                                    questions_total: results.total,
                                    questions_correct: results.correct,
                                    total_marks: results.totalMarks || 0,
                                    time_taken_secs: results.timeTaken,
                                });

                                await loadData();
                            } catch (error) {
                                console.error("Error saving quiz attempt:", error);
                            }
                        }}
                        onExit={async () => {
                            setIsPlaying(false);
                            setSelectedQuiz(null);
                            await loadData();
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <>
            {isGenerating && (
                <AILoadingProgress 
                    stage="generating"
                    message="AI is creating your quiz..."
                    estimatedTime={60}
                />
            )}
            
            <div className="min-h-screen px-4 lg:px-8 py-6 bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
                <div className="w-full max-w-[1800px] mx-auto">
                <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200/50 flex-shrink-0">
                            <Brain className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Study Quizzes</h1>
                            <p className="text-sm text-gray-500">AI-generated, marked and reviewed</p>
                        </div>
                        <HelpButton page="Quizzes" className="ml-1" />
                    </div>
                </motion.div>

                <Tabs defaultValue="my-quizzes" className="space-y-4 lg:space-y-6">
                    <TabsList className="bg-white/70 backdrop-blur-sm border border-white/50 shadow-sm p-1 rounded-xl">
                        <TabsTrigger value="my-quizzes" className="flex items-center gap-2 rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Brain className="w-4 h-4" />
                            My Quizzes
                            <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-md font-bold">{quizzes.length}</span>
                        </TabsTrigger>

                    </TabsList>

                    <TabsContent value="my-quizzes" className="space-y-4">
                        {/* Toolbar */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative flex-1 min-w-[180px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input placeholder="Search quizzes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 rounded-xl bg-white/80 border-gray-200 text-sm" />
                            </div>
                            {userSubjects.length > 1 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button onClick={() => setFilterCategory("all")}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${filterCategory === "all" ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}>
                                        All
                                    </button>
                                    {userSubjects.filter(s => s.is_active !== false).map(s => (
                                        <button key={s.id} onClick={() => setFilterCategory(filterCategory === s.subject_name ? "all" : s.subject_name)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${filterCategory === s.subject_name ? "text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}
                                            style={filterCategory === s.subject_name ? { backgroundColor: s.color } : {}}>
                                            {s.subject_name}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-2 ml-auto">
                                <Button onClick={() => setIsManualCreate(true)} variant="outline" size="sm" className="rounded-xl border-gray-200 gap-1.5 text-xs font-semibold">
                                    <PlusCircle className="w-3.5 h-3.5" /> Create
                                </Button>
                                <Button onClick={() => setShowAIDialog(true)} size="sm" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl gap-1.5 text-xs font-semibold shadow-md shadow-purple-200/50">
                                    <Wand2 className="w-3.5 h-3.5" /> AI Generate
                                </Button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg animate-pulse">
                                        <Brain className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="text-sm text-gray-500">Loading your quizzes...</p>
                                </div>
                            </div>
                        ) : filteredQuizzes.length > 0 ? (
                            <div className="space-y-6">
                                {Object.entries(quizzesBySubject).map(([subjectName, subjectQuizzes]) => {
                                    const userSubject = userSubjects.find(s => s.subject_name === subjectName);
                                    const subjectColor = userSubject?.color || '#3B82F6';
                                    return (
                                        <div key={subjectName}>
                                            <div className="flex items-center gap-2.5 mb-3">
                                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: subjectColor }} />
                                                <h3 className="font-bold text-gray-900">{subjectName}</h3>
                                                <span className="text-xs text-gray-400">{subjectQuizzes.length} quiz{subjectQuizzes.length !== 1 ? 'zes' : ''}</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {subjectQuizzes.map((quiz, index) => (
                                                    <motion.div key={quiz.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="h-full">
                                                        <QuizCard quiz={quiz} pastAttempts={quizAttempts} subjectColor={subjectColor}
                                                            onPlay={() => { setSelectedQuiz(quiz); setIsPlaying(true); }}
                                                            onReshuffle={handleReshuffleQuiz} onDelete={handleDeleteQuiz} />
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                                <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-indigo-50/30 px-6 py-14 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-200/50">
                                        <Brain className="w-8 h-8 text-white" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">No quizzes yet</h3>
                                    <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">Create your first quiz manually or upload your notes and let AI generate one for you</p>
                                    <div className="flex gap-2.5 justify-center flex-wrap">
                                        <Button onClick={() => setIsManualCreate(true)} variant="outline" className="rounded-xl gap-2">
                                            <PlusCircle className="w-4 h-4" /> Create Quiz
                                        </Button>
                                        <Button onClick={() => setShowAIDialog(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl gap-2 shadow-md">
                                            <Wand2 className="w-4 h-4" /> AI Generate
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-2 mt-6">
                                        {['MCQ + Short answer', 'AI Marking', 'Adaptive Review', 'Reshuffle'].map(f => (
                                            <span key={f} className="text-xs text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-full font-medium">{f}</span>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </TabsContent>



                </Tabs>

                {/* Manual Create Dialog */}
                <Dialog open={isManualCreate} onOpenChange={setIsManualCreate}>
                    <DialogContent className="max-w-full sm:max-w-3xl h-[95vh] flex flex-col p-0">
                        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b">
                            <DialogTitle className="text-2xl">Create Quiz</DialogTitle>
                        </DialogHeader>

                        <ScrollArea className="flex-1 px-6 overflow-y-auto">
                            <div className="space-y-6 py-4 pb-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label>Quiz Title *</Label>
                                    <Input
                                        value={manualQuiz.title}
                                        onChange={(e) => setManualQuiz({...manualQuiz, title: e.target.value})}
                                        placeholder="e.g., Biology Chapter 3 Quiz"
                                    />
                                </div>
                                <div>
                                    <Label>Subject *</Label>
                                    <Input
                                        value={manualQuiz.subject}
                                        onChange={(e) => setManualQuiz({...manualQuiz, subject: e.target.value})}
                                        placeholder="Type subject name (e.g., Biology, Chemistry)"
                                        className="h-11"
                                    />
                                    
                                    {userSubjects.filter(s => s.is_active !== false).length > 0 && (
                                        <div className="pt-2">
                                            <p className="text-xs text-gray-500 mb-2">Or select from your subjects:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {userSubjects.filter(s => s.is_active !== false).map(subject => (
                                                    <button
                                                        key={subject.id}
                                                        type="button"
                                                        onClick={() => setManualQuiz({
                                                            ...manualQuiz, 
                                                            subject: subject.subject_name
                                                        })}
                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                                            manualQuiz.subject === subject.subject_name
                                                                ? 'ring-2 ring-offset-1'
                                                                : 'hover:bg-gray-100'
                                                        }`}
                                                        style={{
                                                            backgroundColor: manualQuiz.subject === subject.subject_name 
                                                                ? `${subject.color}20` 
                                                                : `${subject.color}10`,
                                                            color: subject.color,
                                                            borderColor: subject.color,
                                                            ringColor: subject.color
                                                        }}
                                                    >
                                                        <div 
                                                            className="w-2.5 h-2.5 rounded-full"
                                                            style={{ backgroundColor: subject.color }}
                                                        />
                                                        {subject.subject_name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                </div>

                                <div>
                                    <Label>Difficulty</Label>
                                    <Select value={manualQuiz.difficulty} onValueChange={(value) => setManualQuiz({...manualQuiz, difficulty: value})}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="beginner">Beginner</SelectItem>
                                            <SelectItem value="intermediate">Intermediate</SelectItem>
                                            <SelectItem value="advanced">Advanced</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="border-t pt-6">
                                    <h3 className="font-bold text-lg mb-4">Add Questions ({manualQuiz.questions.length})</h3>

                                    <div className="space-y-4 bg-gray-50 rounded-lg p-4">
                                        <div>
                                            <Label>Question Type</Label>
                                            <Select value={currentQuestion.type} onValueChange={(value) => setCurrentQuestion({...currentQuestion, type: value})}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="mcq">Multiple Choice</SelectItem>
                                                    <SelectItem value="short_answer">Short Answer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label>Question *</Label>
                                            <Textarea
                                                value={currentQuestion.question}
                                                onChange={(e) => setCurrentQuestion({...currentQuestion, question: e.target.value})}
                                                placeholder="Enter your question..."
                                                rows={3}
                                            />
                                        </div>

                                        {currentQuestion.type === "mcq" ? (
                                            <div>
                                                <Label>Options</Label>
                                                <div className="space-y-2 mt-2">
                                                    {currentQuestion.options.map((option, idx) => (
                                                        <div key={idx} className="flex gap-2 items-center">
                                                            <Checkbox
                                                                checked={currentQuestion.correct_answer === idx}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) setCurrentQuestion({...currentQuestion, correct_answer: idx});
                                                                }}
                                                            />
                                                            <Input
                                                                value={option}
                                                                onChange={(e) => {
                                                                    const newOptions = [...currentQuestion.options];
                                                                    newOptions[idx] = e.target.value;
                                                                    setCurrentQuestion({...currentQuestion, options: newOptions});
                                                                }}
                                                                placeholder={`Option ${idx + 1}`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">Check the correct answer</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <Label>Mark Allocation</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="20"
                                                    value={currentQuestion.marks}
                                                    onChange={(e) => setCurrentQuestion({...currentQuestion, marks: parseInt(e.target.value) || 5})}
                                                    placeholder="e.g., 3, 5, 8"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">How many marks is this question worth?</p>
                                            </div>
                                        )}

                                        <div>
                                            <Label>Explanation (Optional)</Label>
                                            <Textarea
                                                value={currentQuestion.explanation}
                                                onChange={(e) => setCurrentQuestion({...currentQuestion, explanation: e.target.value})}
                                                placeholder="Explain the answer..."
                                                rows={2}
                                            />
                                        </div>

                                        <Button onClick={handleAddQuestion} className="w-full">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Question
                                        </Button>
                                    </div>

                                    {manualQuiz.questions.length > 0 && (
                                        <div className="mt-4 space-y-2">
                                            <h4 className="font-semibold">Questions Added:</h4>
                                            {manualQuiz.questions.map((q, idx) => (
                                                <Card key={idx} className="p-3">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <Badge className="mb-2">{q.type === "mcq" ? "Multiple Choice" : "Short Answer"}</Badge>
                                                            <p className="text-sm font-medium">{idx + 1}. {q.question}</p>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setManualQuiz({
                                                                    ...manualQuiz,
                                                                    questions: manualQuiz.questions.filter((_, i) => i !== idx)
                                                                });
                                                            }}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>

                        <DialogFooter className="flex-shrink-0 border-t p-6">
                            <Button variant="outline" onClick={() => setIsManualCreate(false)}>Cancel</Button>
                            <Button
                                onClick={handleCreateManualQuiz}
                                disabled={!manualQuiz.title || !manualQuiz.subject || manualQuiz.questions.length === 0}
                                className="bg-gradient-to-r from-purple-600 to-blue-600"
                            >
                                Create Quiz ({manualQuiz.questions.length} questions)
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* AI Generation Dialog - Redesigned */}
                <Dialog open={showAIDialog} onOpenChange={(open) => {
                    if (!open && !isGenerating) {
                        setShowAIDialog(false);
                        setUploadedFiles([]);
                        setAiSettings({
                            subject: "",
                            customSubject: "",
                            topic: "",
                            difficulty: "Medium",
                            num_questions: 10,
                            question_types: "mixed",
                            focus_areas: "",
                            quiz_style: "standard",
                            ai_instructions: "",
                            include_explanations: true,
                            marks_per_short: "5"
                        });
                    }
                }}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                        <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
                            <DialogTitle className="flex items-center gap-3 text-2xl">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                    <Wand2 className="w-5 h-5 text-white" />
                                </div>
                                AI Quiz Generator
                            </DialogTitle>
                            <p className="text-sm text-gray-600 mt-2">Upload your notes and let AI create a personalized quiz</p>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto px-6">
                            <div className="space-y-6 py-6">
                                {/* File Upload Section */}
                                <div className="space-y-3">
                                    <Label className="text-base font-semibold">1. Upload Study Material</Label>
                                    <div className="relative">
                                        <input
                                               type="file"
                                               id="pdf-upload"
                                               className="hidden"
                                               multiple
                                               onChange={(e) => {
                                                   const files = Array.from(e.target.files || []);
                                                   setUploadedFiles(prev => {
                                                       const names = new Set(prev.map(f => f.name));
                                                       return [...prev, ...files.filter(f => !names.has(f.name))];
                                                   });
                                               }}
                                               accept=".pdf,.txt,.docx,.pptx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                           />
                                            <label
                                               htmlFor="pdf-upload"
                                               className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all ${
                                                   uploadedFiles.length 
                                                       ? 'border-green-300 bg-green-50' 
                                                       : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50'
                                               }`}
                                           >
                                               {uploadedFiles.length > 0 ? (
                                                   <div className="w-full space-y-2" onClick={e => e.preventDefault()}>
                                                       {uploadedFiles.map((f, i) => (
                                                           <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-green-100">
                                                               <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                               <span className="flex-1 text-sm font-medium text-gray-800 truncate">{f.name}</span>
                                                               <span className="text-xs text-gray-400 shrink-0">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                                                               <button type="button" className="text-gray-400 hover:text-red-500 shrink-0"
                                                                   onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}>
                                                                   <X className="w-3.5 h-3.5" />
                                                               </button>
                                                           </div>
                                                       ))}
                                                       <p className="text-xs text-center text-purple-600 font-medium pt-1">+ Click to add more files</p>
                                                   </div>
                                               ) : (
                                                   <>
                                                       <Upload className="w-12 h-12 text-gray-400 mb-3" />
                                                       <p className="font-medium text-gray-900">Click to upload documents</p>
                                                       <p className="text-sm text-gray-500 mt-1">PDF, TXT, DOCX, PPTX — multiple files supported</p>
                                                   </>
                                               )}
                                           </label>
                                    </div>
                                </div>

                                {/* Quiz Configuration */}
                                <div className="space-y-4">
                                    <Label className="text-base font-semibold">2. Configure Quiz</Label>

                                    <div className="space-y-2">
                                        <Label>Subject *</Label>
                                        <Input
                                            value={aiSettings.customSubject || ""}
                                            onChange={(e) => setAiSettings({...aiSettings, customSubject: e.target.value, subject: "__custom__"})}
                                            placeholder="Type subject name (e.g., Biology, Chemistry)"
                                            className="h-11"
                                        />
                                        
                                        {userSubjects.filter(s => s.is_active !== false).length > 0 && (
                                            <div className="pt-2">
                                                <p className="text-xs text-gray-500 mb-2">Or select from your subjects:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {userSubjects.filter(s => s.is_active !== false).map(subject => (
                                                        <button
                                                            key={subject.id}
                                                            type="button"
                                                            onClick={() => setAiSettings({
                                                                ...aiSettings, 
                                                                subject: subject.subject_name,
                                                                customSubject: subject.subject_name
                                                            })}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                                                aiSettings.customSubject === subject.subject_name
                                                                    ? 'ring-2 ring-offset-1'
                                                                    : 'hover:bg-gray-100'
                                                            }`}
                                                            style={{
                                                                backgroundColor: aiSettings.customSubject === subject.subject_name 
                                                                    ? `${subject.color}20` 
                                                                    : `${subject.color}10`,
                                                                color: subject.color,
                                                                borderColor: subject.color,
                                                                ringColor: subject.color
                                                            }}
                                                        >
                                                            <div 
                                                                className="w-2.5 h-2.5 rounded-full"
                                                                style={{ backgroundColor: subject.color }}
                                                            />
                                                            {subject.subject_name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Topic (Optional)</Label>
                                        <Input
                                            value={aiSettings.topic}
                                            onChange={(e) => setAiSettings({...aiSettings, topic: e.target.value})}
                                            placeholder="e.g., Cell Biology, Organic Chemistry"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Number of Questions</Label>
                                            <Select 
                                                value={aiSettings.num_questions.toString()} 
                                                onValueChange={(val) => setAiSettings({...aiSettings, num_questions: parseInt(val)})}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[5, 8, 10, 12, 15, 20, 25, 30].map(n => (
                                                        <SelectItem key={n} value={n.toString()}>{n} questions</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Question Types</Label>
                                            <Select 
                                                value={aiSettings.question_types} 
                                                onValueChange={(val) => setAiSettings({...aiSettings, question_types: val})}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="mixed">Mixed (MCQ + Short Answer)</SelectItem>
                                                    <SelectItem value="mcq_only">MCQ Only</SelectItem>
                                                    <SelectItem value="short_only">Short Answer Only</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Difficulty</Label>
                                            <Select 
                                                value={aiSettings.difficulty} 
                                                onValueChange={(val) => setAiSettings({...aiSettings, difficulty: val})}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Easy">Easy — Basic recall</SelectItem>
                                                    <SelectItem value="Medium">Medium — Application</SelectItem>
                                                    <SelectItem value="Hard">Hard — Exam level</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Quiz Style</Label>
                                            <Select 
                                                value={aiSettings.quiz_style} 
                                                onValueChange={(val) => setAiSettings({...aiSettings, quiz_style: val})}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="standard">Standard VCE Style</SelectItem>
                                                    <SelectItem value="exam_practice">Past Paper Exam Practice</SelectItem>
                                                    <SelectItem value="revision">Quick Revision</SelectItem>
                                                    <SelectItem value="challenge">Challenge / Stretch</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {(aiSettings.question_types === "short_only" || aiSettings.question_types === "mixed") && (
                                            <div className="space-y-2">
                                                <Label>Marks per Short Answer</Label>
                                                <Select 
                                                    value={aiSettings.marks_per_short} 
                                                    onValueChange={(val) => setAiSettings({...aiSettings, marks_per_short: val})}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="3">3 marks</SelectItem>
                                                        <SelectItem value="5">5 marks</SelectItem>
                                                        <SelectItem value="8">8 marks</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        <div className="space-y-2 flex items-center gap-3 pt-6">
                                            <Checkbox 
                                                id="include_exp"
                                                checked={aiSettings.include_explanations}
                                                onCheckedChange={(v) => setAiSettings({...aiSettings, include_explanations: !!v})}
                                            />
                                            <label htmlFor="include_exp" className="text-sm font-medium cursor-pointer">Include answer explanations</label>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Focus Areas (Optional)</Label>
                                        <Input
                                            value={aiSettings.focus_areas}
                                            onChange={(e) => setAiSettings({...aiSettings, focus_areas: e.target.value})}
                                            placeholder="e.g., mitosis, genetics, cell division — separate with commas"
                                        />
                                        <p className="text-xs text-gray-400">Tell the AI which specific areas of the document to focus on</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Custom Instructions to AI (Optional)</Label>
                                        <Textarea
                                            value={aiSettings.ai_instructions}
                                            onChange={(e) => setAiSettings({...aiSettings, ai_instructions: e.target.value})}
                                            placeholder="e.g., 'Make the MCQ options tricky', 'Include diagram-based questions', 'Focus on definitions and formulas', 'Use the same style as my teacher's tests'"
                                            rows={3}
                                        />
                                        <p className="text-xs text-gray-400">Any specific requests for how you want the quiz made</p>
                                    </div>
                                </div>

                                {/* Preview */}
                                {uploadedFiles.length > 0 && aiSettings.customSubject && (
                                    <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-3">
                                                <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-purple-900 mb-2">Ready to Generate</h4>
                                                    <div className="text-sm text-purple-800 space-y-1">
                                                        <p>• {aiSettings.num_questions} questions ({aiSettings.difficulty})</p>
                                                        <p>• {aiSettings.question_types === "mcq_only" ? "Multiple choice only" : aiSettings.question_types === "short_only" ? `Short answer only (${aiSettings.marks_per_short} marks each)` : `Mixed: ${Math.ceil(aiSettings.num_questions * 0.6)} MCQ + ${aiSettings.num_questions - Math.ceil(aiSettings.num_questions * 0.6)} short answer`}</p>
                                                        <p>• Style: {aiSettings.quiz_style.replace('_', ' ')}</p>
                                                        {aiSettings.focus_areas && <p>• Focus: {aiSettings.focus_areas}</p>}
                                                        {aiSettings.ai_instructions && <p>• Custom: {aiSettings.ai_instructions.slice(0, 60)}{aiSettings.ai_instructions.length > 60 ? '…' : ''}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                                </div>
                                </div>

                        <DialogFooter className="flex-shrink-0 border-t p-6 bg-gray-50">
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    if (!isGenerating) {
                                        setShowAIDialog(false);
                                        setUploadedFiles([]);
                                    }
                                }}
                                disabled={isGenerating}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleGenerateQuiz}
                                disabled={!uploadedFiles.length || !aiSettings.customSubject || isGenerating}
                                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="w-4 h-4 mr-2" />
                                        Generate Quiz
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>



                {/* Premium Feature Upgrade Modal */}
                <UpgradeModal
                    isOpen={showUpgradeModal}
                    onClose={() => setShowUpgradeModal(false)}
                    feature="AITestMarker"
                    requiredTier="premium"
                    userProfile={userProfile}
                    isBlocking={false}
                />
            </div>
        </div>
        </>
    );
}