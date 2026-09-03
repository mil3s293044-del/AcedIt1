import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { BANK_TOPIC, bankSummary } from "@/lib/mistakeBank";
import { autoBankRows, weakSpots, isRetryAttempt } from "@/lib/quizInsight";
import { isDue, isNew } from "@/lib/due";
import { deleteResult } from "@/lib/saveResult";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    Trophy,
    ArrowRight,
    AlertTriangle,
    Bookmark,
    ChevronDown,
    ChevronUp,
    Trash2,
    Eye
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import AISkeleton from "../components/shared/AISkeleton";
import { isPremium } from "@/components/shared/subscriptionHelpers";
import HelpButton from "@/components/shared/HelpButton";
import TierUsagePill from "@/components/shared/TierUsagePill";
import { FEATURES, canUseFeature } from "@/lib/tierAccess";

import QuizDeck from "@/components/cards/QuizDeck";
import { quizDeckStats } from "@/lib/quizDeck";
import { normaliseQuestions, formatGeneratedParts } from "@/lib/quizSchema";
import QuizPlayer from "../components/quizzes/QuizPlayer";
import QuizInsightRail from "../components/quizzes/QuizInsightRail";
import MarkdownMath from "@/components/shared/MarkdownMath";
import QuizModePicker from "../components/quizzes/QuizModePicker";
import { subjectColor } from "@/components/cards/cardIdentity";

// ─── Coach voice helpers (chill + motivational) ──────────────────────────────
function getCoachLine({ name, hour, totalQuizzes, recentAttempts, avgScore, lowScore }) {
    const period = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Late night";
    if (totalQuizzes === 0) {
        return `${period}, ${name}. No quizzes yet — let's build your first one.`;
    }
    if (recentAttempts === 0) {
        return `${period}, ${name}. ${totalQuizzes} quiz${totalQuizzes === 1 ? '' : 'zes'} ready when you are.`;
    }
    if (avgScore != null && avgScore >= 85) {
        return `${period}, ${name}. ${avgScore}% average — you're nailing this.`;
    }
    if (avgScore != null && avgScore >= 60) {
        return `${period}, ${name}. ${avgScore}% average — keep at it, you're getting there.`;
    }
    if (lowScore && avgScore != null) {
        return `${period}, ${name}. ${avgScore}% average — let's run a few more and watch it climb.`;
    }
    if (avgScore != null) {
        return `${period}, ${name}. Avg score ${avgScore}% across your last 5. Solid.`;
    }
    return `${period}, ${name}. Let's get a quiz in.`;
}

const FOCUS_THEME = {
    primary:   { bg: "bg-primary/10",  border: "border-primary/25",  iconBg: "bg-primary/15",  iconText: "text-primary"  },
    xp:        { bg: "bg-xp/10",       border: "border-xp/25",       iconBg: "bg-xp/15",       iconText: "text-xp"       },
    streak:    { bg: "bg-streak/10",   border: "border-streak/25",   iconBg: "bg-streak/15",   iconText: "text-streak"   },
    "chart-3": { bg: "bg-chart-3/10",  border: "border-chart-3/25",  iconBg: "bg-chart-3/15",  iconText: "text-chart-3"  },
    "chart-4": { bg: "bg-chart-4/10",  border: "border-chart-4/25",  iconBg: "bg-chart-4/15",  iconText: "text-chart-4"  },
};

export default function Quizzes() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [quizzes, setQuizzes] = useState([]);
    const [quizAttempts, setQuizAttempts] = useState([]);
    const [bankCards, setBankCards] = useState([]);
    const [sharedQuizzes, setSharedQuizzes] = useState([]);
    const [userSubjects, setUserSubjects] = useState([]);
    const [selectedQuiz, setSelectedQuiz] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [savedAnswers, setSavedAnswers] = useState([]);
    const [showSaved, setShowSaved] = useState(false);
    const [viewingSaved, setViewingSaved] = useState(null);
    const [pendingQuiz, setPendingQuiz] = useState(null);   // shown in mode picker
    const [quizMode, setQuizMode] = useState("standard");
    const [quizTimeLimitMs, setQuizTimeLimitMs] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAIDialog, setShowAIDialog] = useState(false);
    const [isManualCreate, setIsManualCreate] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");

    const [isLoading, setIsLoading] = useState(true);
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

            // Six independent reads. They were sequential — six round trips
            // one after another before the page could paint — and nothing here
            // waits on anything else. Each keeps its own catch so one failing
            // table still leaves the rest of the page usable.
            const fail = (what) => (e) => { console.error(`Error loading ${what}:`, e); return []; };
            const [quizzesData, attemptsData, sharedQuizzesData, userSubjectsData, saved, bankCards] =
                await Promise.all([
                    base44.entities.Quiz.filter({ created_by: currentUser.email }).catch(fail("quizzes")),
                    base44.entities.QuizAttempt.filter({ created_by: currentUser.email }).catch(fail("quiz attempts")),
                    base44.entities.SharedQuiz.filter({ shared_with_email: currentUser.email }).catch(fail("shared quizzes")),
                    base44.entities.UserSubject.filter({ created_by: currentUser.email, is_active: true }).catch(fail("user subjects")),
                    base44.entities.AISavedResult.filter(
                        { created_by: currentUser.email, tool_type: 'saved_answer' }, '-date_created'
                    ).catch(fail("saved answers")),
                    // The mistake bank, for the panel beside the hero.
                    base44.entities.Flashcard.filter({
                        created_by: currentUser.email, topic: BANK_TOPIC, is_active: true,
                    }).catch(fail("mistake bank")),
                ]);
            setSavedAnswers(saved || []);
            setBankCards(bankCards || []);

            setQuizzes(quizzesData || []);
            setQuizAttempts(attemptsData || []);
            // A question missed twice banks itself. See autoBank.
            autoBank(quizzesData || [], attemptsData || [], bankCards || []);
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

    /**
     * Bank the questions the student keeps getting wrong, without being asked.
     *
     * ─── Why here, and why once ─────────────────────────────────────────────
     * Repeated misses are found by reading the whole attempt history, which is
     * something only a page that has already loaded it can do — and this page
     * loads it anyway, for the panel beside the list. So the reconciliation
     * costs no query. It runs ONCE per mount, behind a ref, and writes nothing
     * when there is nothing new: `autoBankRows` keys each card to its source
     * question, so a mistake already banked is skipped whether the student
     * banked it by hand or the last visit banked it for them.
     *
     * ─── It is deliberately quiet ───────────────────────────────────────────
     * No toast. Banking a mistake is not an achievement to celebrate — the
     * student got something wrong twice — and a popup congratulating them for
     * it every time they open the page would be the app being pleased about
     * bad news. The rail says the questions are in the bank, which is where a
     * student who wants to know looks.
     */
    const autoBankedRef = useRef(false);
    const autoBank = async (quizList, attemptList, existing) => {
        if (autoBankedRef.current) return;
        autoBankedRef.current = true;
        try {
            const rows = autoBankRows(
                weakSpots(attemptList), quizList, existing,
                { topic: BANK_TOPIC, unit: BANK_TOPIC });
            if (!rows.length) return;
            const made = await base44.entities.Flashcard.bulkCreate(rows);
            // Fold them into the panel's count in the same tick, so the number
            // beside "Mistake bank" is not a load behind the bank itself.
            setBankCards(prev => [...prev, ...(Array.isArray(made) ? made : rows)]);
        } catch (e) {
            // A bank that fails to write is not a reason to break the page.
            console.error("Auto-bank failed:", e);
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



    const handleGenerateQuiz = async () => {
        const effectiveSubject = aiSettings.customSubject || aiSettings.subject;

        if (!uploadedFiles.length || !effectiveSubject) {
            toast({
                title: "Missing Information",
                description: "Please upload a file and select/enter a subject.",
                variant: "destructive"
            });
            return;
        }

        if (isGenerating) return;

        // Tier gate — block immediately if the user has hit the cap, so we don't
        // burn the upload + spin a loader for a request that's about to 429.
        const access = canUseFeature(userProfile, FEATURES.QUIZ_AI_GEN);
        if (!access.allowed) {
            toast({
                title: access.upgradeRequired ? "Premium feature" : "Daily limit reached",
                description: access.reason,
                variant: "destructive",
            });
            return;
        }

        // Keep the dialog open — the skeleton renders inside it. We close
        // the dialog on the success path below so the user lands on the new
        // quiz; on error we leave it open so they can adjust and retry.
        setIsGenerating(true);

        try {
            // Upload all files (per-file error isolation — one failure doesn't kill all)
            const uploadResults = await Promise.allSettled(uploadedFiles.map(f => base44.integrations.Core.UploadFile({ file: f }).then(r => ({ file_url: r.file_url, name: f.name, ext: f.name.split('.').pop()?.toLowerCase() }))));
            const uploadedUrls = uploadResults.filter(r => r.status === 'fulfilled').map(r => r.value);
            if (uploadedUrls.length === 0) {
                const errMsg = uploadResults.map(r => r.reason?.message || 'Upload failed').join('; ');
                throw new Error(`All file uploads failed: ${errMsg}`);
            }
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
            } else if (aiSettings.question_types === "multipart") {
                shortTarget = aiSettings.num_questions;
                questionTypeInstruction = `You MUST generate EXACTLY ${shortTarget} EXTENDED RESPONSE questions, VCAA style. Total questions: ${shortTarget}.

Each one is a STEM followed by two to four PARTS:
  - The stem sets up ONE situation — a scenario, a data set, an experiment, a
    passage — and asks nothing by itself.
  - Each part asks a separate thing ABOUT that stem, and every part must be
    answerable from it. A part that could stand alone as its own question means
    the stem is doing no work and you have written two questions instead of one.
  - Parts get progressively harder, the way a real paper builds: recall or a
    single calculation first, then application, then an evaluation or a
    multi-step derivation.
  - Mark allocations differ by part and match the work: 1-2 marks to state or
    identify, 3-6 to explain, justify or derive.
  - Set "type": "multipart", put the stem in "question", and put the parts in
    the "parts" array — each with its own "prompt", "marks" and "model_answer".
    A part may be an MCQ, in which case give it "options" and "correct_answer"
    instead of a model answer.

Do NOT write the parts into the stem as prose. They go in the array.`;
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
            const docFiles = uploadedUrls.filter(f => f.ext === 'docx' || f.ext === 'pptx');
            let documentContentPrompt = '';
            for (const df of docFiles) {
                try {
                    const textResult = await base44.functions.invoke('extractDocumentText', { file_url: df.file_url });
                    if (textResult.data?.error) {
                        toast({ title: "File read issue", description: `Could not read ${df.name}: ${textResult.data.error}. Quiz will use other sources.`, variant: "destructive" });
                    } else if (textResult.data?.text) {
                        documentContentPrompt += `\n\n[${df.name}]:\n${textResult.data.text}`;
                    }
                } catch (e) {
                    toast({ title: "File read failed", description: `Could not read ${df.name}: ${e.message}. Quiz will use other sources.`, variant: "destructive" });
                }
            }

            const marksValue = parseInt(aiSettings.marks_per_short) || 5;

            // Only pass PDF/TXT files directly to Gemini (it can't natively read DOCX/PPTX).
            // DOCX/PPTX content is already extracted as text in documentContentPrompt above.
            const geminiCompatibleUrls = uploadedUrls.filter(f => f.ext !== 'docx' && f.ext !== 'pptx').map(f => f.file_url);

            const response = await base44.integrations.Core.InvokeLLM({
                feature: "quiz_ai_gen",
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

=== MATH FORMATTING RULES (CRITICAL) ===
- ALWAYS use LaTeX notation for every mathematical expression, equation, formula, fraction, integral, derivative, matrix, vector, or symbol — the app renders LaTeX as proper math.
- Inline math: wrap in single dollars — e.g. \`Solve $f(x) = m(x-a)^2(x-b)$ for the y-intercept.\`
- Display/block math: wrap in double dollars — e.g. \`$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$\`
- Exponents: \`x^2\` or \`x^{n+1}\`. Fractions: \`\\frac{a}{b}\`. Square roots: \`\\sqrt{x}\`. Greek: \`\\alpha, \\beta, \\pi\`. Functions: \`\\sin, \\cos, \\ln\`.
- NEVER write math as raw text like \`x^2\` outside dollars — that won't render.

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
                                    explanation: { type: "string" },
                                    parts: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                label: { type: "string" },
                                                type: { type: "string" },
                                                prompt: { type: "string" },
                                                marks: { type: "number" },
                                                model_answer: { type: "string" },
                                                options: { type: "array", items: { type: "string" } },
                                                correct_answer: { type: "number" }
                                            },
                                            required: ["prompt", "marks"]
                                        }
                                    }
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
                    // A question that came back with real parts is left alone.
                    // Forcing it to "mcq" would strand the parts on a shape
                    // that never renders them.
                    if (Array.isArray(q.parts) && q.parts.length > 0) return { ...q, type: "multipart" };
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
                .map(q => q.type === "multipart" ? {
                    type: "multipart",
                    question: q.question,
                    parts: formatGeneratedParts(q, marksValue),
                    explanation: aiSettings.include_explanations ? (q.explanation || "") : "",
                } : ({
                    type: q.type,
                    question: q.question,
                    options: q.type === "mcq" ? (q.options?.slice(0, 4).concat(Array(Math.max(0, 4 - (q.options?.length || 0))).fill("")).slice(0, 4)) : undefined,
                    correct_answer: q.type === "mcq" ? (q.correct_answer ?? 0) : undefined,
                    model_answer: q.type === "short_answer" ? (q.model_answer || "") : undefined,
                    marks: q.type === "short_answer" ? (q.marks || marksValue) : undefined,
                    explanation: aiSettings.include_explanations ? (q.explanation || "") : ""
                }))
                // A multipart question that lost every part to the filter is
                // an empty shell that would render as a stem and nothing else.
                .filter(q => q.type !== "multipart" || q.parts.length > 0)
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
                title: "Quiz created!",
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
            setShowAIDialog(false);
            await loadData();
        } catch (error) {
            console.error("Quiz generation error:", error);

            toast({
                title: "Generation failed",
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

        const reAccess = canUseFeature(userProfile, FEATURES.QUIZ_AI_GEN);
        if (!reAccess.allowed) {
            toast({
                title: reAccess.upgradeRequired ? "Premium feature" : "Daily limit reached",
                description: reAccess.reason,
                variant: "destructive",
            });
            return;
        }

        setIsGenerating(true);

        try {
            const numQuestions = quiz.questions?.length || 10;
            const mcqCount = Math.ceil(numQuestions * 0.6);
            const shortCount = numQuestions - mcqCount;
            // Reshuffle means "same quiz, new questions", so it has to keep the
            // SHAPE it was handed. Reshuffling an extended-response paper into
            // a pile of multiple choice is a different quiz.
            const wasMultipart = normaliseQuestions(quiz).some(q => q.multipart);
            const shapeInstruction = wasMultipart
                ? `Generate UP TO ${numQuestions} EXTENDED RESPONSE questions, VCAA style — the same shape as the quiz being reshuffled.

Each is a STEM followed by two to four PARTS:
  - The stem sets up ONE situation and asks nothing by itself.
  - Each part asks a separate thing about that stem and must be answerable
    from it, getting progressively harder.
  - Mark allocations differ by part and match the work: 1-2 marks to state or
    identify, 3-6 to explain, justify or derive.
  - Set "type": "multipart", put the stem in "question", and put the parts in
    the "parts" array, each with its own "prompt", "marks" and "model_answer".
    A part may be an MCQ, with "options" and "correct_answer" instead.`
                : `Generate UP TO ${numQuestions} questions total (${mcqCount} MCQ first, then ${shortCount} short answer). If the document does not have enough unique content for all ${numQuestions} non-repetitive questions, generate fewer — quality over quantity.

QUESTION ORDER: All MCQ questions MUST come before any short answer questions.`;

            const response = await base44.integrations.Core.InvokeLLM({
                feature: "quiz_ai_gen",
                prompt: `You are a VCE quiz generator. Create a COMPLETELY NEW and DIFFERENT quiz for: ${quiz.subject}. Read ALL content in the document including text, images, diagrams, tables, and figures.

            IMPORTANT: Generate DIFFERENT questions from what might have been asked before. Focus on different aspects of the content. NEVER generate two questions that test the same concept or fact.

            ${shapeInstruction}

            Difficulty: ${quiz.difficulty || 'Medium'}
            Base ALL questions on the uploaded document content, including any images, charts, or figures.

MATH FORMATTING RULES (CRITICAL):
- ALWAYS use LaTeX for every mathematical expression — the app renders LaTeX as proper math via KaTeX.
- Inline math: wrap in single dollars — e.g. \`Find the derivative of $f(x) = e^x \\cos(3x)$\`
- Display/block math: wrap in double dollars — e.g. \`$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$\`
- Exponents: \`x^2\` or \`x^{n+1}\`. Fractions: \`\\frac{a}{b}\`. Square roots: \`\\sqrt{x}\`. Greek: \`\\alpha, \\pi\`. Trig: \`\\sin, \\cos, \\ln\`.
- Examples:
  * CORRECT: "Solve for $x$ when $2x + 5 = 13$"
  * CORRECT: "$$f'(x) = e^x \\cos(3x) - 3e^x \\sin(3x)$$"
  * WRONG: "Solve for x when 2x + 5 = 13" (no LaTeX)
  * WRONG: "f(x) = e^x cos(3x)" (raw text)

MULTIPLE CHOICE:
- MUST have EXACTLY 4 answer options for EVERY multiple choice question
- Options must be distinct and plausible
- One correct answer (provide its index: 0, 1, 2, or 3)
- Brief explanation why the answer is correct
- All math in options must use LaTeX as above

SHORT ANSWER:
- Award 3, 5, or 8 marks based on complexity
- Provide a model answer matching the mark allocation
- 3 marks = 3 key points, 5 marks = 5 points, 8 marks = 8 points
- All math in answers must use LaTeX as above

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
                                    explanation: { type: "string" },
                                    parts: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                label: { type: "string" },
                                                type: { type: "string" },
                                                prompt: { type: "string" },
                                                marks: { type: "number" },
                                                model_answer: { type: "string" },
                                                options: { type: "array", items: { type: "string" } },
                                                correct_answer: { type: "number" }
                                            },
                                            required: ["prompt", "marks"]
                                        }
                                    }
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

            // Sort questions: MCQ first, then short answer. Skipped for an
            // extended-response paper, where there are no loose MCQs to hoist
            // and the running order is the order the paper was written in.
            const sortedQuestions = wasMultipart ? response.questions : response.questions.sort((a, b) => {
                const aIsMcq = a.type === 'mcq' || a.type !== 'short_answer';
                const bIsMcq = b.type === 'mcq' || b.type !== 'short_answer';
                if (aIsMcq && !bIsMcq) return -1;
                if (!aIsMcq && bIsMcq) return 1;
                return 0;
            });

            const formattedQuestions = sortedQuestions
                .filter(q => {
                    // A question with parts is never an MCQ, whatever `type`
                    // says — without this the options check below throws every
                    // extended-response question away, because a stem has none.
                    if (Array.isArray(q.parts) && q.parts.length > 0) return true;
                    if (q.type === 'mcq' || q.type !== 'short_answer') {
                        if (!q.options || q.options.length !== 4) {
                            console.warn("Skipping MCQ without 4 options:", q.question);
                            return false;
                        }
                    }
                    return true;
                })
                .map(q => (Array.isArray(q.parts) && q.parts.length > 0) ? {
                    type: 'multipart',
                    question: q.question,
                    parts: formatGeneratedParts(q, 5),
                    explanation: q.explanation || "",
                } : ({
                    type: q.type === 'short_answer' ? 'short_answer' : 'mcq',
                    question: q.question,
                    options: q.type === 'mcq' || q.type !== 'short_answer' ? q.options : undefined,
                    correct_answer: q.type === 'mcq' || q.type !== 'short_answer' ? (q.correct_answer ?? 0) : undefined,
                    model_answer: q.type === 'short_answer' ? (q.model_answer || "") : undefined,
                    marks: q.type === 'short_answer' ? (q.marks || 5) : undefined,
                    explanation: q.explanation || ""
                }))
                .filter(q => q.type !== 'multipart' || q.parts.length > 0);

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
                title: "New quiz created!",
                description: `${formattedQuestions.length} new questions generated`
            });

            await loadData();
        } catch (error) {
            console.error("Reshuffle error:", error);
            toast({
                title: "Reshuffle failed",
                description: error.message || "Could not generate new questions",
                variant: "destructive"
            });
        } finally {
            setIsGenerating(false);
        }
    };

    /**
     * Build a drill from the questions that keep catching the student out.
     *
     * Copies the original question objects rather than generating new ones: it
     * costs nothing, it's instant, and re-facing the exact question you've now
     * missed twice is the point. Saved as a real quiz so it plays through the
     * normal player and its attempts feed back into the same analysis.
     */
    const handleDrill = async (questions, spots) => {
        if (!questions?.length) return;
        const subjects = [...new Set(spots.map(x => x.quizCategory).filter(Boolean))];
        try {
            const created = await base44.entities.Quiz.create({
                title: `Drill · ${questions.length} question${questions.length === 1 ? "" : "s"} to nail`,
                subject: subjects.length === 1 ? subjects[0] : null,
                questions,
                difficulty: "intermediate",
                category: "subject_content",
                extra: { drill_of: spots.map(x => x.key) },
            });
            if (created?.id) {
                setQuizzes(prev => [created, ...prev]);
                setSelectedQuiz(created);
                toast({
                    variant: "success",
                    title: "Drill ready",
                    description: `${questions.length} question${questions.length === 1 ? "" : "s"} you've missed more than once.`,
                });
            }
        } catch (e) {
            toast({ title: "Couldn't build the drill", description: e.message, variant: "destructive" });
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

    // ─── Derived hero/coach stats ─────────────────────────────────────────────
    // Ready is due OR never reviewed — a mistake banked an hour ago is not
    // unopened material. Same rule the bank page uses; see bankSummary.
    const bank = useMemo(
        () => bankSummary(bankCards, (c) => isDue(c) || isNew(c)),
        [bankCards],
    );

    const quizStats = useMemo(() => {
        const totalQuizzes = quizzes.length;
        const byDate = (a, b) => String(b.date || b.created_date || '')
            .localeCompare(String(a.date || a.created_date || ''));
        const sortedAttempts = [...quizAttempts].sort(byDate);

        // SCORES COME FROM FULL SITS ONLY.
        //
        // A "wrong only" retry is a run at the questions you already missed,
        // so its score is not on the same scale as a score on the whole paper
        // — and it is the one you are most likely to do badly on, because it
        // is made of your hardest questions by construction. Averaging it in
        // punished the student for going back over their mistakes: the panel
        // read "You scored 0% last time — your score will climb" directly
        // above a card printing 60% BEST for the same quiz, and the greeting
        // reported an average nothing on the page agreed with.
        //
        // The ACTIVITY count still includes them, because a retry is real work
        // and the count is a measure of turning up rather than of accuracy.
        const fullSits = sortedAttempts.filter(a => !isRetryAttempt(a));
        const recent5 = fullSits.slice(0, 5);
        const avgScore = recent5.length
            ? Math.round(recent5.reduce((sum, a) => sum + (a.score || 0), 0) / recent5.length)
            : null;
        const bestScore = fullSits.length
            ? Math.max(...fullSits.map(a => a.score || 0))
            : null;

        // The week's activity counts went with the panel that printed them.
        // "3 quizzes taken this week" is a measure of turning up, not of
        // getting better, and the space now shows the mistakes still costing
        // marks — the one number on this page that goes down when you work.

        const lastAttempt = fullSits[0] || null;
        const lowScore = avgScore != null && avgScore < 60;

        return {
            totalQuizzes,
            recentAttempts: sortedAttempts.length,
            avgScore,
            bestScore,
            lastAttempt,
            lowScore,
        };
    }, [quizzes, quizAttempts]);

    const firstName = userProfile?.username || user?.full_name?.split(' ')[0] || 'friend';
    const hour = new Date().getHours();
    const coachLine = getCoachLine({
        name: firstName,
        hour,
        totalQuizzes: quizStats.totalQuizzes,
        recentAttempts: quizStats.recentAttempts,
        avgScore: quizStats.avgScore,
        lowScore: quizStats.lowScore,
    });

    // Featured "Next quiz" — state-aware suggestion
    const nextQuiz = useMemo(() => {
        // Low recent score on a known quiz — suggest replay
        if (quizStats.lastAttempt && (quizStats.lastAttempt.score || 0) < 60) {
            const target = quizzes.find(q => q.id === quizStats.lastAttempt.quiz_id);
            if (target) {
                return {
                    label: "Run it back",
                    title: `Try "${target.title}" again`,
                    sub: `You scored ${Math.round(quizStats.lastAttempt.score || 0)}% last time — your score will climb.`,
                    cta: "Retake quiz",
                    accent: "streak",
                    icon: AlertTriangle,
                    action: () => { setPendingQuiz(target); },
                };
            }
        }
        // Strong streak of scores — challenge
        if (quizStats.avgScore != null && quizStats.avgScore >= 85 && quizzes.length > 0) {
            return {
                label: "Stretch goal",
                title: "Generate a harder AI quiz",
                sub: "You're cruising — let's see how you handle exam-level difficulty.",
                cta: "Make a harder quiz",
                accent: "xp",
                icon: Sparkles,
                action: () => setShowAIDialog(true),
            };
        }
        // Many quizzes available, no recent activity
        if (quizzes.length >= 3 && quizStats.recentAttempts === 0) {
            const random = quizzes[Math.floor(Math.random() * quizzes.length)];
            return {
                label: "Pick something",
                title: `Take "${random.title}"`,
                sub: "Pick one and see what sticks — momentum starts here.",
                cta: "Start quiz",
                accent: "chart-3",
                icon: Brain,
                action: () => { setPendingQuiz(random); },
            };
        }
        // Pending shared quizzes
        if (pendingSharedQuizzes.length > 0) {
            return {
                label: "Shared with you",
                title: `${pendingSharedQuizzes.length} quiz${pendingSharedQuizzes.length === 1 ? '' : 'zes'} waiting from friends`,
                sub: "Accept and add them to your library.",
                cta: "Review now",
                accent: "primary",
                icon: Sparkles,
                // Accept/decline lives on Friends, next to the friend who sent
                // it — this just takes you there rather than duplicating it.
                action: () => navigate("/Friends"),
            };
        }
        // Has quizzes — quick suggestion
        if (quizzes.length > 0) {
            const target = quizzes[0];
            return {
                label: "Quick win",
                title: `Take "${target.title}"`,
                sub: "Active recall locks in what passive reading misses.",
                cta: "Start quiz",
                accent: "chart-3",
                icon: Brain,
                action: () => { setPendingQuiz(target); },
            };
        }
        // Empty state default
        return {
            label: "Get started",
            title: "Generate your first AI quiz",
            sub: "Upload notes and we'll build a quiz tailored to your material.",
            cta: "Make a quiz from my notes",
            accent: "chart-4",
            icon: Wand2,
            action: () => setShowAIDialog(true),
        };
    }, [quizzes, quizStats, pendingSharedQuizzes, navigate]);

    if (isPlaying && selectedQuiz) {
        const isSAC = quizMode === "sac";
        // SAC: cover the entire viewport (side rail + top strip hidden) so the
        // student is locked into the exam. Standard: normal page chrome.
        const wrapperCls = isSAC
            ? "fixed inset-0 z-50 bg-surface overflow-y-auto"
            : "min-h-screen bg-background";
        return (
            <div className={wrapperCls}>
                <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (isSAC && !window.confirm("Leave the SAC? Your progress won't be saved.")) return;
                            setIsPlaying(false);
                            setSelectedQuiz(null);
                            setQuizMode("standard");
                            setQuizTimeLimitMs(null);
                        }}
                        className="mb-6"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {isSAC ? "Exit SAC" : "Back to Quizzes"}
                    </Button>
                    <QuizPlayer
                        quiz={selectedQuiz}
                        mode={quizMode}
                        timeLimitMs={quizTimeLimitMs}
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
            <QuizModePicker
                open={!!pendingQuiz}
                quiz={pendingQuiz}
                onCancel={() => setPendingQuiz(null)}
                onPick={({ mode, timeLimitMs }) => {
                    setQuizMode(mode);
                    setQuizTimeLimitMs(timeLimitMs);
                    setSelectedQuiz(pendingQuiz);
                    setPendingQuiz(null);
                    setIsPlaying(true);
                }}
            />

            <div className="min-h-screen bg-background">
                <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">

                {/* ── COACH STRIP ─────────────────────────────────────── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-muted-foreground uppercase tracking-wider">{format(new Date(), 'EEE · MMM d')}</span>
                            {quizStats.totalQuizzes > 0 && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-chart-3">
                                        <Brain className="w-3.5 h-3.5" /> {quizStats.totalQuizzes} quiz{quizStats.totalQuizzes === 1 ? '' : 'zes'}
                                    </span>
                                </>
                            )}
                            {quizStats.avgScore != null && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className={`inline-flex items-center gap-1 font-extrabold ${quizStats.avgScore >= 85 ? 'text-primary' : quizStats.avgScore >= 60 ? 'text-xp' : 'text-streak'}`}>
                                        <Trophy className="w-3.5 h-3.5" /> {quizStats.avgScore}% avg
                                    </span>
                                </>
                            )}
                        </div>
                        <HelpButton page="Quizzes" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {coachLine}
                    </h1>
                </motion.section>

                {/* ── SAVED ANSWERS LIBRARY ───────────────────────────── */}
                {savedAnswers.length > 0 && (
                    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card-soft overflow-hidden">
                        <button
                            onClick={() => setShowSaved(s => !s)}
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/40 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Bookmark className="w-4 h-4 text-chart-4" />
                                <span className="font-display font-extrabold text-foreground text-sm">Saved answers</span>
                                <span className="pill bg-chart-4/15 text-chart-4">{savedAnswers.length}</span>
                            </div>
                            {showSaved ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </button>
                        {showSaved && (
                            <div className="px-3 pb-3 space-y-2 max-h-80 overflow-y-auto border-t border-border pt-3">
                                {savedAnswers.map(s => (
                                    <div key={s.id} className="flex items-center justify-between gap-2 p-3 bg-background rounded-xl border border-border">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-foreground truncate">{s.title}</p>
                                            <p className="text-xs text-muted-foreground">{s.subject_name || s.topic || 'Quiz'} · {s.date_created}</p>
                                        </div>
                                        <div className="flex gap-1 flex-shrink-0">
                                            <button onClick={() => setViewingSaved(s)} className="p-1.5 text-muted-foreground hover:text-chart-4 hover:bg-chart-4/10 rounded-lg transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => deleteResult('saved_answer', s.id).then(() => setSavedAnswers(prev => prev.filter(x => x.id !== s.id)))} className="p-1.5 text-muted-foreground hover:text-streak hover:bg-streak/10 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.section>
                )}

                {/* ── HERO ROW: Your quizzing (3/5) + This week (2/5) ── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="grid grid-cols-1 md:grid-cols-5 gap-5 lg:gap-6"
                >
                    {/* LEFT: Your quizzing — total + avg score, big numbers */}
                    <div className="md:col-span-3">
                        <div className="relative overflow-hidden rounded-3xl bg-chart-3/10 border-2 border-chart-3/25 p-6 lg:p-8 h-full">
                            <Brain className="absolute -top-6 -right-6 w-32 h-32 text-chart-3/10 pointer-events-none" />
                            <div className="relative grid grid-cols-1 sm:grid-cols-5 gap-5 items-center">
                                <div className="sm:col-span-3">
                                    <p className="stat-label text-chart-3/80 mb-1">Your quizzing</p>
                                    <div className="flex items-baseline gap-3">
                                        <span
                                            className="font-display font-extrabold text-chart-3 leading-none"
                                            style={{ fontSize: 'clamp(3.5rem, 10vw, 6rem)' }}
                                        >
                                            {quizStats.totalQuizzes}
                                        </span>
                                        <span className="font-display font-extrabold text-chart-3/50 text-2xl lg:text-3xl">
                                            {quizStats.totalQuizzes === 1 ? 'quiz' : 'quizzes'}
                                        </span>
                                    </div>
                                    <p className="text-foreground text-sm lg:text-base mt-2 max-w-md font-medium leading-snug">
                                        {quizStats.totalQuizzes === 0
                                            ? "Build your first quiz and start locking knowledge in."
                                            : quizStats.recentAttempts === 0
                                                ? "Take one to see how it sticks."
                                                : `${quizStats.recentAttempts} attempt${quizStats.recentAttempts === 1 ? '' : 's'} logged. Keep building.`}
                                    </p>
                                </div>
                                <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-1 gap-3">
                                    <div className="bg-surface rounded-xl p-3 border-2 border-chart-3/15">
                                        <p className="stat-label">Avg score</p>
                                        <p className={`font-display font-extrabold text-2xl mt-0.5 leading-none ${
                                            quizStats.avgScore == null ? 'text-muted-foreground/60'
                                                : quizStats.avgScore >= 85 ? 'text-primary'
                                                    : quizStats.avgScore >= 60 ? 'text-xp'
                                                        : 'text-streak'
                                        }`}>
                                            {quizStats.avgScore != null ? `${quizStats.avgScore}%` : '—'}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">last 5</p>
                                    </div>
                                    <div className="bg-surface rounded-xl p-3 border-2 border-border">
                                        <p className="stat-label">Best score</p>
                                        <p className="font-display font-extrabold text-foreground text-2xl mt-0.5 leading-none">
                                            {quizStats.bestScore != null ? `${Math.round(quizStats.bestScore)}%` : '—'}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">all time</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: The mistake bank.
                        This was "This week: 3 quizzes taken. Keep stacking." —
                        a count of activity, which is the weakest thing this
                        page knows. How many quizzes you sat is not a fact you
                        can act on; which marks you are still dropping is, and
                        it is the one number on this page that goes DOWN when
                        the student does the work. Making a quiz is not this
                        panel's job — that button lives beside the quiz list,
                        where somebody who wants one is already looking. */}
                    <div className="md:col-span-2">
                        <div className="rounded-3xl bg-streak/10 border-2 border-streak/25 p-6 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-2">
                                <Bookmark className="w-4 h-4 text-streak" />
                                <p className="stat-label text-streak/80">Mistake bank</p>
                            </div>
                            <p className="font-display font-extrabold text-foreground leading-none" style={{ fontSize: 'clamp(2.25rem, 5.5vw, 3rem)' }}>
                                {bank.total === 0 ? '—' : bank.outstanding}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2 leading-snug">
                                {bank.total === 0
                                    ? "Mark a quiz and save the marks you drop — they come back until you have them."
                                    : bank.outstanding === 0
                                        ? `All ${bank.total} fixed. Nothing outstanding.`
                                        : `${bank.outstanding} mistake${bank.outstanding === 1 ? '' : 's'} still costing you marks.`}
                            </p>

                            {bank.total > 0 && (
                                <div className="space-y-2.5 mt-4 pt-4 border-t-2 border-streak/15">
                                    <div className="flex items-baseline justify-between">
                                        <p className="text-xs font-bold text-muted-foreground">Fixed</p>
                                        <p className="text-xs font-bold text-foreground tabular-nums">
                                            {bank.fixed} / {bank.total}
                                        </p>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                        <p className="text-xs font-bold text-muted-foreground">Ready now</p>
                                        <p className="text-xs font-bold text-foreground tabular-nums">{bank.ready}</p>
                                    </div>
                                </div>
                            )}

                            {/* One action, and it is the panel's own. Making a
                                quiz already has a button beside the quiz list —
                                where somebody who wants another quiz is
                                actually looking — and a second copy here only
                                existed because this panel used to be about
                                quizzing. Three buttons on one page for one
                                dialog is how a student stops trusting that any
                                of them do different things. */}
                            {bank.total > 0 && (
                                <div className="mt-auto pt-4">
                                    <Link to={createPageUrl("MistakeBank")} className="block">
                                        <Button size="sm"
                                            className="w-full btn-3d bg-streak hover:bg-streak text-white">
                                            <Bookmark className="w-3.5 h-3.5" />
                                            {bank.ready > 0 ? `Review ${bank.ready} now` : 'Open the bank'}
                                        </Button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.section>

                {/* ── FEATURED "Next quiz" PANEL ──────────────────────── */}
                {nextQuiz && (
                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className={`rounded-2xl ${FOCUS_THEME[nextQuiz.accent].bg} border-2 ${FOCUS_THEME[nextQuiz.accent].border} p-5 lg:p-6`}>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl ${FOCUS_THEME[nextQuiz.accent].iconBg} flex items-center justify-center flex-shrink-0`}>
                                    <nextQuiz.icon className={`w-6 h-6 ${FOCUS_THEME[nextQuiz.accent].iconText}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="stat-label mb-1">Next quiz · {nextQuiz.label}</p>
                                    <h2 className="font-display font-extrabold text-foreground text-base lg:text-lg leading-snug">
                                        {nextQuiz.title}
                                    </h2>
                                    <p className="text-muted-foreground text-sm mt-0.5">{nextQuiz.sub}</p>
                                </div>
                                {nextQuiz.action && (
                                    <Button
                                        onClick={nextQuiz.action}
                                        className="w-full sm:w-auto flex-shrink-0"
                                    >
                                        {nextQuiz.cta} <ArrowRight className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </motion.section>
                )}

                {/* The quiz list sits left and the insight rail fills what used
                    to be dead margin. It only splits at xl — below that the rail
                    would squeeze the list, so it stacks underneath. */}
                <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
                <div className="min-w-0">
                <Tabs defaultValue="my-quizzes" className="space-y-5">
                    <TabsList className="grid w-full grid-cols-1 h-auto p-1.5 rounded-2xl bg-surface border-2 border-border shadow-soft">
                        <TabsTrigger value="my-quizzes" className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-soft transition-all">
                            <Brain className="w-4 h-4" />
                            My Quizzes
                            <span className="pill bg-secondary text-muted-foreground text-[11px] py-0.5 data-[state=active]:bg-background/20">{quizzes.length}</span>
                        </TabsTrigger>

                    </TabsList>

                    <TabsContent value="my-quizzes" className="space-y-4">
                        {/* Toolbar */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative flex-1 min-w-[180px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 w-4 h-4" />
                                <Input placeholder="Search quizzes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 rounded-xl bg-surface border-border text-sm" />
                            </div>
                            {userSubjects.length > 1 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button onClick={() => setFilterCategory("all")}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${filterCategory === "all" ? "bg-chart-3 text-white" : "bg-surface text-muted-foreground border border-border hover:border-chart-3/40"}`}>
                                        All
                                    </button>
                                    {userSubjects.filter(s => s.is_active !== false).map(s => (
                                        <button key={s.id} onClick={() => setFilterCategory(filterCategory === s.subject_name ? "all" : s.subject_name)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${filterCategory === s.subject_name ? "text-white shadow-soft" : "bg-surface text-muted-foreground border border-border hover:border-chart-3/40"}`}
                                            style={filterCategory === s.subject_name ? { backgroundColor: s.color } : {}}>
                                            {s.subject_name}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-2 ml-auto">
                                <Button onClick={() => setIsManualCreate(true)} variant="outline" size="sm" className="rounded-xl border-border gap-1.5 text-xs font-semibold">
                                    <PlusCircle className="w-3.5 h-3.5" /> Create
                                </Button>
                                {/* "AI Generate" said which technology it used
                                    and not what it did. A student who has never
                                    used it cannot tell whether it makes a quiz,
                                    marks one, or generates an answer. */}
                                <Button onClick={() => setShowAIDialog(true)} size="sm" className="bg-chart-3 hover:bg-chart-3/90 text-white rounded-xl gap-1.5 text-xs font-semibold shadow-soft">
                                    <Wand2 className="w-3.5 h-3.5" /> Make a quiz from notes
                                </Button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center animate-pulse">
                                        <Brain className="w-5 h-5 text-chart-3" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">Loading your quizzes...</p>
                                </div>
                            </div>
                        ) : filteredQuizzes.length > 0 ? (
                            <div className="space-y-6">
                                {Object.entries(quizzesBySubject).map(([subjectName, subjectQuizzes]) => {
                                    const userSubject = userSubjects.find(s => s.subject_name === subjectName);
                                    const tone = subjectColor(userSubject);
                                    return (
                                        <div key={subjectName}>
                                            <div className="flex items-center gap-2.5 mb-3">
                                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tone }} />
                                                <h3 className="font-bold text-foreground">{subjectName}</h3>
                                                <span className="text-xs text-muted-foreground/60">{subjectQuizzes.length} quiz{subjectQuizzes.length !== 1 ? 'zes' : ''}</span>
                                            </div>
                                            {/* A shelf, not a grid. Same row of
                                                packs the flashcard decks are
                                                dealt into, so the two lists in
                                                this app that hold decks of
                                                cards look like the same thing. */}
                                            <div className="flex flex-wrap gap-x-3 gap-y-3">
                                                {subjectQuizzes.map((quiz, index) => {
                                                    const stats = quizDeckStats(quiz, quizAttempts);
                                                    return (
                                                        <QuizDeck
                                                            key={quiz.id}
                                                            index={index}
                                                            title={quiz.title}
                                                            subject={subjectName}
                                                            difficulty={quiz.difficulty}
                                                            tone={tone}
                                                            questions={quiz.questions?.length || 0}
                                                            bestScore={stats.bestScore}
                                                            attempts={stats.attempts}
                                                            toFix={stats.wrongIdx.length}
                                                            canReshuffle={!!quiz.source_file_url}
                                                            onSelect={() => setPendingQuiz(quiz)}
                                                            onRetryWrong={() => {
                                                                setQuizMode('standard');
                                                                setQuizTimeLimitMs(null);
                                                                setSelectedQuiz({
                                                                    ...quiz,
                                                                    _isRetry: true,
                                                                    title: `${quiz.title} — wrong only`,
                                                                    // Each question remembers where it sits in the
                                                                    // PARENT quiz. Without this the attempt records
                                                                    // question 5 as index 0 — the position it held in
                                                                    // the subset — and every later read attributes the
                                                                    // miss to whichever question happens to be first.
                                                                    questions: stats.wrongIdx.map(i => ({
                                                                        ...quiz.questions[i], _sourceIndex: i,
                                                                    })),
                                                                });
                                                                setIsPlaying(true);
                                                            }}
                                                            onReshuffle={() => handleReshuffleQuiz(quiz)}
                                                            onDelete={() => handleDeleteQuiz(quiz.id)}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                                <div className="card-soft border-2 border-dashed border-border bg-chart-3/5 px-6 py-14 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-chart-3/10 flex items-center justify-center mx-auto mb-4">
                                        <Brain className="w-8 h-8 text-chart-3" />
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground mb-1">No quizzes yet</h3>
                                    <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">Create your first quiz manually or upload your notes and let AI generate one for you</p>
                                    <div className="flex gap-2.5 justify-center flex-wrap">
                                        <Button onClick={() => setIsManualCreate(true)} variant="outline" className="rounded-xl gap-2">
                                            <PlusCircle className="w-4 h-4" /> Create Quiz
                                        </Button>
                                        <Button onClick={() => setShowAIDialog(true)} className="bg-chart-3 hover:bg-chart-3/90 text-white rounded-xl gap-2 shadow-soft">
                                            <Wand2 className="w-4 h-4" /> Make one from my notes
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-2 mt-6">
                                        {['MCQ + Short answer', 'AI Marking', 'Adaptive Review', 'Reshuffle'].map(f => (
                                            <span key={f} className="pill bg-chart-3/10 text-chart-3">{f}</span>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </TabsContent>



                </Tabs>
                </div>

                <div className="xl:sticky xl:top-6" data-insight-rail>
                    <QuizInsightRail
                        quizzes={quizzes}
                        attempts={quizAttempts}
                        onOpenQuiz={(id) => {
                            const q = quizzes.find(x => x.id === id);
                            if (q) setSelectedQuiz(q);
                        }}
                        onDrill={handleDrill}
                    />
                </div>
                </div>

                {/* Manual Create Dialog */}
                <Dialog open={isManualCreate} onOpenChange={setIsManualCreate}>
                    <DialogContent className="max-w-full sm:max-w-3xl h-[95vh] flex flex-col p-0">
                        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b border-border">
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
                                            <p className="text-xs text-muted-foreground mb-2">Or select from your subjects:</p>
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
                                                                : 'hover:bg-secondary'
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

                                <div className="border-t border-border pt-6">
                                    <h3 className="font-bold text-lg mb-4">Add Questions ({manualQuiz.questions.length})</h3>

                                    <div className="space-y-4 bg-secondary/50 rounded-lg p-4">
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
                                                <p className="text-xs text-muted-foreground mt-2">Check the correct answer</p>
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
                                                <p className="text-xs text-muted-foreground mt-1">How many marks is this question worth?</p>
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
                                                <div key={idx} className="card-soft p-3">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <span className="pill bg-chart-3/10 text-chart-3 mb-2">{q.type === "mcq" ? "Multiple Choice" : "Short Answer"}</span>
                                                            <p className="text-sm font-medium mt-2">{idx + 1}. {q.question}</p>
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
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>

                        <DialogFooter className="flex-shrink-0 border-t border-border p-6">
                            <Button variant="outline" onClick={() => setIsManualCreate(false)}>Cancel</Button>
                            <Button
                                onClick={handleCreateManualQuiz}
                                disabled={!manualQuiz.title || !manualQuiz.subject || manualQuiz.questions.length === 0}
                                className="bg-chart-3 hover:bg-chart-3/90 text-white"
                            >
                                Create Quiz ({manualQuiz.questions.length} questions)
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* AI Generation Dialog - Redesigned */}
                <Dialog open={showAIDialog} onOpenChange={(open) => {
                    if (!open) {
                        // Allow closing at any time — including mid-generation.
                        // The in-flight AI request continues in the background;
                        // when it resolves the new quiz still appears in the list.
                        setShowAIDialog(false);
                        setIsGenerating(false);
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
                        <DialogHeader className="p-6 pb-4 border-b border-border bg-chart-4/5">
                            <DialogTitle className="flex items-center gap-3 text-2xl">
                                <span className="flex-1">AI Quiz Generator</span>
                                <TierUsagePill feature={FEATURES.QUIZ_AI_GEN} userProfile={userProfile} />
                            </DialogTitle>
                            <p className="text-sm text-muted-foreground mt-2">Upload your notes and let AI create a personalized quiz</p>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto px-6">
                            {isGenerating ? (
                                <div className="py-6">
                                    <AISkeleton
                                        type="questions"
                                        count={aiSettings.num_questions || 5}
                                        message={`Creating your ${aiSettings.num_questions || 5}-question quiz…`}
                                    />
                                </div>
                            ) : (
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
                                                       ? 'border-primary/40 bg-primary/5'
                                                       : 'border-border hover:border-chart-4/40 hover:bg-chart-4/5'
                                               }`}
                                           >
                                               {uploadedFiles.length > 0 ? (
                                                   <div className="w-full space-y-2" onClick={e => e.preventDefault()}>
                                                       {uploadedFiles.map((f, i) => (
                                                           <div key={i} className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2 shadow-soft border border-primary/20">
                                                               <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                                                               <span className="flex-1 text-sm font-medium text-foreground truncate">{f.name}</span>
                                                               <span className="text-xs text-muted-foreground/60 shrink-0">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                                                               <button type="button" className="text-muted-foreground/60 hover:text-streak shrink-0"
                                                                   onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}>
                                                                   <X className="w-3.5 h-3.5" />
                                                               </button>
                                                           </div>
                                                       ))}
                                                       <p className="text-xs text-center text-chart-4 font-medium pt-1">+ Click to add more files</p>
                                                   </div>
                                               ) : (
                                                   <>
                                                       <Upload className="w-12 h-12 text-muted-foreground/60 mb-3" />
                                                       <p className="font-medium text-foreground">Click to upload documents</p>
                                                       <p className="text-sm text-muted-foreground mt-1">PDF, TXT, DOCX, PPTX — multiple files supported</p>
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
                                                <p className="text-xs text-muted-foreground mb-2">Or select from your subjects:</p>
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
                                                                    : 'hover:bg-secondary'
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
                                                    <SelectItem value="multipart">Extended response (a, b, c)</SelectItem>
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
                                        <p className="text-xs text-muted-foreground/60">Tell the AI which specific areas of the document to focus on</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Custom Instructions to AI (Optional)</Label>
                                        <Textarea
                                            value={aiSettings.ai_instructions}
                                            onChange={(e) => setAiSettings({...aiSettings, ai_instructions: e.target.value})}
                                            placeholder="e.g., 'Make the MCQ options tricky', 'Include diagram-based questions', 'Focus on definitions and formulas', 'Use the same style as my teacher's tests'"
                                            rows={3}
                                        />
                                        <p className="text-xs text-muted-foreground/60">Any specific requests for how you want the quiz made</p>
                                    </div>
                                </div>

                                {/* Preview */}
                                {uploadedFiles.length > 0 && aiSettings.customSubject && (
                                    <div className="card-soft bg-chart-4/5 border-chart-4/20 p-4">
                                        <div className="flex items-start gap-3">
                                            <Sparkles className="w-5 h-5 text-chart-4 mt-0.5" />
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-foreground mb-2">Ready to Generate</h4>
                                                <div className="text-sm text-muted-foreground space-y-1">
                                                    <p>• {aiSettings.num_questions} questions ({aiSettings.difficulty})</p>
                                                    <p>• {aiSettings.question_types === "mcq_only" ? "Multiple choice only" : aiSettings.question_types === "short_only" ? `Short answer only (${aiSettings.marks_per_short} marks each)` : `Mixed: ${Math.ceil(aiSettings.num_questions * 0.6)} MCQ + ${aiSettings.num_questions - Math.ceil(aiSettings.num_questions * 0.6)} short answer`}</p>
                                                    <p>• Style: {aiSettings.quiz_style.replace('_', ' ')}</p>
                                                    {aiSettings.focus_areas && <p>• Focus: {aiSettings.focus_areas}</p>}
                                                    {aiSettings.ai_instructions && <p>• Custom: {aiSettings.ai_instructions.slice(0, 60)}{aiSettings.ai_instructions.length > 60 ? '…' : ''}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                </div>
                            )}
                                </div>

                        <DialogFooter className="flex-shrink-0 border-t border-border p-6 bg-secondary/50">
                            {(() => {
                                const access = canUseFeature(userProfile, FEATURES.QUIZ_AI_GEN);
                                const blocked = !access.allowed;
                                return (
                                    <Button
                                        onClick={handleGenerateQuiz}
                                        disabled={!uploadedFiles.length || !aiSettings.customSubject || isGenerating || blocked}
                                        title={blocked ? access.reason : undefined}
                                        className="bg-chart-4 hover:bg-chart-4/90 text-white disabled:opacity-50"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Generating...
                                            </>
                                        ) : blocked ? (
                                            <>
                                                <AlertTriangle className="w-4 h-4 mr-2" />
                                                {access.upgradeRequired ? "Upgrade to generate" : "Daily limit reached"}
                                            </>
                                        ) : (
                                            <>
                                                <Wand2 className="w-4 h-4 mr-2" />
                                                Make the quiz
                                            </>
                                        )}
                                    </Button>
                                );
                            })()}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Saved answer viewer */}
                <Dialog open={!!viewingSaved} onOpenChange={() => setViewingSaved(null)}>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>{viewingSaved?.subject_name || 'Saved answer'}</DialogTitle></DialogHeader>
                        <div className="text-sm text-foreground"><MarkdownMath>{viewingSaved?.content || ''}</MarkdownMath></div>
                    </DialogContent>
                </Dialog>

            </div>
        </div>
        </>
    );
}
