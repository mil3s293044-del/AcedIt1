import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Sparkles, Search, BookOpen, CalendarIcon } from "lucide-react";
import KeyTopicsEditor from "./KeyTopicsEditor";
import { useToast } from "@/components/ui/use-toast";
import { FEATURES, canUseFeature } from "@/lib/tierAccess";
import { createPageUrl } from "@/utils";
import { format, differenceInCalendarDays, startOfToday } from "date-fns";

// Categories that have sub-components
const ASSESSMENT_CATEGORIES = ["SAC", "Exam", "Oral", "Practical"];

const COMPONENTS_FOR = {
    SAC: ["Multiple Choice", "Short Answer", "Extended Response / Essay"],
    Exam: ["Multiple Choice", "Short Answer", "Extended Response / Essay"],
};

const knowledgeLabel = (v) => {
    if (v <= 20) return "I know nothing";
    if (v <= 40) return "I know very little";
    if (v <= 60) return "I know some basics";
    if (v <= 80) return "I know most of it";
    return "I feel confident";
};

// Match a record's subject-like fields against the selected subject name
function matchesSubject(record, subjectLower) {
    const fields = [
        record.subject,
        record.subject_name,
        record.quiz_title,
        record.topic
    ];
    return fields.some(f => f && f.toLowerCase().includes(subjectLower));
}

async function detectWeakAreas(subjectName) {
    try {
        const [quizAttempts, flashcards, studyTechniques, recallSessions, blurtingSessions] = await Promise.all([
            base44.entities.QuizAttempt.list("-created_date", 200),
            base44.entities.Flashcard.list("-created_date", 500),
            base44.entities.StudyTechnique.list("-created_date", 200),
            base44.entities.ActiveRecallSession.list("-created_date", 100),
            base44.entities.BlurtingSession.list("-created_date", 100),
        ]);
        const subjectLower = subjectName.toLowerCase();
        const subjectQuizzes = quizAttempts.filter(a => matchesSubject(a, subjectLower));
        // Use the adjusted score when present (includes self-marked paper work)
        // so a maths student who solves on paper isn't flagged as weak.
        const effectiveScore = (a) => (typeof a.adjusted_score === "number" ? a.adjusted_score : a.score);
        const weakQuizTopics = subjectQuizzes.filter(a => typeof effectiveScore(a) === "number" && effectiveScore(a) < 60).map(a => a.quiz_title).filter(Boolean);
        const subjectFlashcards = flashcards.filter(f => matchesSubject(f, subjectLower));
        const weakFlashcardTopics = subjectFlashcards.filter(f => f.is_weak_spot || (typeof f.easiness_factor === "number" && f.easiness_factor < 2.0)).map(f => f.topic || f.subject_name).filter(Boolean);
        const subjectTechniques = studyTechniques.filter(t => matchesSubject(t, subjectLower));
        const lowConfidenceTechniques = subjectTechniques.filter(t => typeof t.confidence_rating === "number" && t.confidence_rating <= 2).map(t => t.topic || t.subject).filter(Boolean);
        const subjectRecall = recallSessions.filter(r => matchesSubject(r, subjectLower));
        const subjectBlurting = blurtingSessions.filter(b => matchesSubject(b, subjectLower));
        const allWeakAreas = [...new Set([...weakQuizTopics, ...weakFlashcardTopics, ...lowConfidenceTechniques])];
        const hasPriorData = (subjectQuizzes.length > 0 || subjectFlashcards.length > 0 || subjectTechniques.length > 0 || subjectRecall.length > 0 || subjectBlurting.length > 0);
        return { weakAreas: allWeakAreas, hasPriorData, flashcards: subjectFlashcards, quizAttempts: subjectQuizzes };
    } catch (e) {
        console.error("detectWeakAreas error:", e);
        return { weakAreas: [], hasPriorData: false, flashcards: [], quizAttempts: [] };
    }
}

async function suggestTopicsForSubject(subjectName) {
    try {
        const result = await base44.integrations.Core.InvokeLLM({
            // Helper call (topic suggestions) — must NOT consume the roadmap
            // creation credit. Only the actual roadmap generation charges
            // roadmap_ai_gen; this uncapped feature still tracks cost.
            feature: "roadmap_helper",
            prompt: `List the key content topics a VCE student needs to master for "${subjectName}" based on the VCAA study design. Return 6-10 specific, concise topic names only (no descriptions). Focus on the most commonly assessed content areas. Return ONLY JSON with a single key "topics" containing an array of strings.`,
            response_json_schema: { type: "object", properties: { topics: { type: "array", items: { type: "string" } } } }
        });
        return result.topics || [];
    } catch { return []; }
}

function flagTopicsWithData(topicNames, flashcards, quizAttempts) {
    return topicNames.map(name => {
        const nameLower = name.toLowerCase();
        const hasFlashcards = flashcards.some(f => (f.topic || "").toLowerCase().includes(nameLower) || nameLower.includes((f.topic || "").toLowerCase().slice(0, 5)));
        const hasQuizzes = quizAttempts.some(q => (q.quiz_title || "").toLowerCase().includes(nameLower));
        return { name, priority: "Medium", has_prior_data: hasFlashcards || hasQuizzes };
    });
}

function buildPrompt(form, weakAreas, hasPriorData) {
    const { subject, topic, assessment_category, assessment_components, mark_breakdown, days_until, knowledge_level, key_topics } = form;

    const highTopics = (key_topics || []).filter(t => t.priority === "High");
    const medTopics = (key_topics || []).filter(t => t.priority === "Medium");
    const lowTopics = (key_topics || []).filter(t => t.priority === "Low");
    const topicsWithData = (key_topics || []).filter(t => t.has_prior_data);
    const keyTopicsSection = key_topics && key_topics.length > 0
        ? `\n\nKEY TOPICS (use as BACKBONE — every day's topic_label and key_topic_name MUST map to one of these):\n${highTopics.length > 0 ? `HIGH PRIORITY (schedule first, more sessions): ${highTopics.map(t => t.name).join(", ")}\n` : ""}${medTopics.length > 0 ? `MEDIUM PRIORITY: ${medTopics.map(t => t.name).join(", ")}\n` : ""}${lowTopics.length > 0 ? `LOW PRIORITY (last, compress if short on time): ${lowTopics.map(t => t.name).join(", ")}\n` : ""}${topicsWithData.length > 0 ? `TOPICS WITH EXISTING ACEDIT DATA — start with review session (Spaced Repetition or AI Quizzes) not new content: ${topicsWithData.map(t => t.name).join(", ")}\n` : ""}\nKEY TOPIC RULES: Distribute all topics across ${days_until} days. Set key_topic_name on each journey_map entry. On consolidation days, do NOT advance — repeat same key_topic_name.\n`
        : "";
    const isMaths = /math|calculus|algebra|physics|chemistry|stats|methods|specialist/i.test(subject);
    const isEnglish = /english|literature|writing|humanities|language/i.test(subject);
    const hasComponents = assessment_components && assessment_components.length > 0;
    const hasMC = hasComponents && assessment_components.includes("Multiple Choice");
    const hasSA = hasComponents && assessment_components.includes("Short Answer");
    const hasEssay = hasComponents && assessment_components.includes("Extended Response / Essay");

    let weightingText = "";
    if (hasComponents && mark_breakdown) {
        const entries = assessment_components.map(c => mark_breakdown[c] ? `${c}: ${mark_breakdown[c]} marks` : null).filter(Boolean);
        if (entries.length > 0) {
            const total = assessment_components.reduce((sum, c) => sum + (parseInt(mark_breakdown[c]) || 0), 0);
            weightingText = `MARK BREAKDOWN PROVIDED — distribute Pomodoro sessions proportionally:\n${entries.join(", ")}\nTotal: ${total} marks\n`;
            if (total > 0) {
                assessment_components.forEach(c => {
                    const marks = parseInt(mark_breakdown[c]) || 0;
                    const pct = Math.round((marks / total) * 100);
                    weightingText += `  → ${c}: ${pct}% of study time\n`;
                });
            }
        }
    }

    const weakAreaText = weakAreas.length > 0
        ? `PRIOR DATA FOUND across quizzes, flashcards and study sessions. Student has demonstrated weakness in: ${weakAreas.slice(0, 6).join(", ")}. You MUST dedicate the first 30–40% of days to targeted remediation of these weak areas using Concept Explainer, Spaced Repetition Flashcards and Active Recall before progressing to exam-style practice.`
        : hasPriorData
        ? `PRIOR DATA FOUND — student has completed quizzes, flashcards or study sessions for this subject and is performing well overall (no topics below 60%). Build on existing knowledge by pushing straight to retrieval practice and exam simulation.`
        : `NO prior data found for this subject across quizzes, flashcards, study technique sessions, active recall or blurting. On Day 1, MUST include a diagnostic baseline session (Blurting Method or AI Quizzes) so AcedIt can begin tracking performance going forward.`;

    const componentRules = hasComponents ? `
MULTI-COMPONENT ASSESSMENT — interleave ALL components across the available days (do NOT treat each as a separate plan):
${hasMC ? `Multiple Choice component: Use Spaced Repetition Flashcards (terminology/facts), AI Quizzes (timed MCQ practice), Exam Mode (simulated MCQ sets)` : ""}
${hasSA ? `Short Answer component: Use Active Recall (question-answer practice), Blurting Method (free-recall knowledge dumps), Exam Question Generator (SA practice questions)` : ""}
${hasEssay ? `Extended Response/Essay component: Use Essay Planner (structure + argument scaffolding), AI English Mentor (feedback on drafts), Concept Explainer (deepen content knowledge for arguments)` : ""}
${weightingText ? `\nTIME WEIGHTING:\n${weightingText}` : "Distribute time roughly equally across all components unless mark breakdown provided."}
Integration rule: On most days, combine tools from DIFFERENT components in the same day so the student practises variety rather than siloing. Final day: Exam Mode or AI Quizzes (light retrieval only).
` : "";

    return `You are an expert VCE study coach. Generate a personalised study roadmap for Day 1 only, plus a topic label arc for all ${days_until} days.${keyTopicsSection}

STUDENT INPUTS:
- Subject: ${subject}
- Assessment topic: ${topic}
- Assessment category: ${assessment_category}
${hasComponents ? `- Assessment components: ${assessment_components.join(", ")}` : ""}
- Days until assessment: ${days_until}
- Knowledge level: ${knowledge_level}% (${knowledgeLabel(knowledge_level)})
${isMaths ? "- MATHS/SCIENCE subject" : ""}${isEnglish ? "- ENGLISH/WRITING subject" : ""}

PRIOR PERFORMANCE: ${weakAreaText}

${componentRules}

AVAILABLE ACEDIT TOOLS (use ONLY these, assign correct route):
"Pomodoro Timer" → "Study"
"Spaced Repetition Flashcards" → "Study"
"Active Recall" → "Study"
"Blurting Method" → "Study"
"Exam Mode" → "Study"
"Goals Section" → "Goals"
"Study Planner" → "Goals"
"AI Quizzes" → "Quizzes"
"Essay Planner" → "AITools"
"Concept Explainer" → "AITools"
"Exam Question Generator" → "AITools"
"Note Summariser" → "AITools"
"AI Math Tutor" → "AITools"
"AI English Mentor" → "AITools"
"Line Memoriser" → "AITools"
"AI Teaching Assistant" → "AITools"

GENERAL SEQUENCING RULES:
1. Knowledge 0–30%: Concept Explainer + Note Summariser FIRST before retrieval practice
2. Knowledge 31–60%: Blurting to find gaps → Spaced Repetition to fill them
3. Knowledge 61–100%: Active Recall, AI Quizzes, Exam Mode directly — flashcards for weak spots only
4. POMODORO TIMER: Do NOT include as a session/tool item on any day. It is mentioned separately in the UI as a general tip.
5. Day 1 MUST include a special non-Pomodoro setup step: Goals Section + Study Planner listed together as a single item named "Pre-Study Setup" with route "Goals", duration "5–10 mins (no Pomodoro)", reason "Set your goals and study plan for this roadmap — do this before starting your first Pomodoro session. Not counted in today's Pomodoro total.". Do NOT include Goals Section or Study Planner on ANY other day.
6. FINAL day in journey_map MUST be labelled as exam-readiness
7. 2–4 content tools per day (NOT counting Pomodoro Timer or the Day 1 setup step)
${days_until < 3 ? "8. CRUNCH MODE (< 3 days): Active Recall, Blurting, Exam Mode only." : ""}
${assessment_category === "Oral" ? "ORAL: Concept Explainer + AI Teaching Assistant → Blurting as verbal rehearsal → Line Memoriser for scripts" : ""}
${assessment_category === "Practical" ? "PRACTICAL: AI Teaching Assistant + Concept Explainer → Exam Question Generator → note hands-on practice outside app each day" : ""}
${isMaths && !hasEssay ? "MATHS: Must include AI Math Tutor early. Do NOT include Essay Planner." : ""}

⚠️ MANDATORY SPECIFICITY RULE: Every tool reason, focus line, day title, and topic_label MUST directly name "${subject}" and specific concepts from "${topic}". NEVER use generic phrases like "build foundational knowledge", "study your content", or "review the material". Always name the exact concept, mechanism, event, argument, or formula the student is working on. For example: instead of "Build foundational knowledge", write "Master the MAIN causes of WW1: Militarism, Alliance system, Imperialism, Nationalism — focusing on how each factor created conditions for war."

JOURNEY MAP RULES:
- topic_label format: "Day N — [Phase]: [Specific content]" e.g. "Day 3 — Short Answer Mastery: The Alliance System and its role in escalation"
- If multiple components, include component in label: "Day 5 — Essay Structure: Arguing the primacy of Nationalism as a cause"
- Labels must form a logical progression arc: Foundations → Understanding → Retrieval → Component Practice → Exam Readiness
- If a day is a consolidation (after low confidence), label it: "Day N — Revisiting: [same topic as Day N-1]"

Generate the journey_map for ALL ${days_until} days, but ONLY generate full tool details for Day 1.

Return ONLY valid JSON:
{
  "intro": "2–3 sentences specifically naming ${subject}, the ${topic} content, and what the student's performance data reveals",
  "readiness_score": <0–100>,
  "journey_map": [
    {
      "day_number": 1,
      "topic_label": "Day 1 — Foundation: [specific content from ${topic}]",
      "component_focus": "General or specific component name"
    }
    // ... repeat for all ${days_until} days
  ],
  "day_1": {
    "day_number": 1,
    "title": "Short specific title naming the content being studied",
    "focus": "One sentence naming exactly which concepts from ${topic} are being studied today",
    "total_time": "X Pomodoros — Y mins total",
    "tools": [
      {
        "name": "Tool Name",
        "route": "PageName",
        "reason": "Specific instruction naming exact concepts or questions from ${topic} that this tool addresses",
        "duration": "X Pomodoros — Y mins",
        "component": "General or specific component"
      }
    ]
  }
}`;
}

export default function RoadmapForm({ onGenerated, userProfile }) {
    const today = startOfToday();

    const [form, setForm] = useState({
        subject: "",
        topic: "",
        assessment_category: "",
        assessment_components: [],
        mark_breakdown: {},
        assessment_date: null,
        knowledge_level: 50,
        key_topics: []
    });
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [userSubjects, setUserSubjects] = useState([]);
    const [subjectsLoading, setSubjectsLoading] = useState(true);
    const [weakAreaData, setWeakAreaData] = useState({ weakAreas: [], hasPriorData: false });
    const [weakAreaLoading, setWeakAreaLoading] = useState(false);
    const [topicsLoading, setTopicsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatingStep, setGeneratingStep] = useState("");
    const { toast } = useToast();

    // ── Generation progress estimate ────────────────────────────────────────
    // The roadmap is one big non-streaming AI call, so there's no real
    // progress signal. We estimate from how long this user's past generations
    // took (running average in localStorage, default 45s) and show an honest
    // countdown — the bar never claims 100% until the roadmap actually lands.
    const GEN_AVG_KEY = "acedit_roadmap_gen_ms";
    const genStartRef = useRef(null);
    const [genElapsedMs, setGenElapsedMs] = useState(0);
    const [genEstimateMs, setGenEstimateMs] = useState(45000);
    useEffect(() => {
        if (!isGenerating) { setGenElapsedMs(0); return; }
        genStartRef.current = Date.now();
        let est = 45000;
        try {
            const saved = Number(localStorage.getItem(GEN_AVG_KEY));
            if (saved > 5000 && saved < 300000) est = saved;
        } catch { /* private mode — keep default */ }
        setGenEstimateMs(est);
        const id = setInterval(() => setGenElapsedMs(Date.now() - genStartRef.current), 500);
        return () => clearInterval(id);
    }, [isGenerating]);

    // Fraction of the estimate elapsed; bar runs linearly to ~88% over the
    // estimate, then crawls asymptotically toward 96% if it runs long.
    const genFrac = genEstimateMs > 0 ? genElapsedMs / genEstimateMs : 0;
    const genPct = genFrac <= 1
        ? Math.round(genFrac * 88)
        : Math.min(96, Math.round(88 + (1 - Math.exp(-(genFrac - 1) * 1.5)) * 8));
    const genRemainingS = Math.ceil((genEstimateMs - genElapsedMs) / 1000);
    const isSavingStep = generatingStep === "Saving your roadmap...";
    const genRemainingLabel = isSavingStep
        ? "almost done"
        : genRemainingS > 0 ? `~${genRemainingS}s left` : "almost there…";
    const genStageMessage = isSavingStep
        ? "Saving your roadmap…"
        : genFrac < 0.3 ? "Analysing your topics & weak areas…"
        : genFrac < 0.6 ? "Structuring your day-by-day journey…"
        : genFrac < 0.9 ? "Writing your day 1 plan…"
        : "Polishing the details…";

    const availableComponents = COMPONENTS_FOR[form.assessment_category] || [];
    const showComponents = availableComponents.length > 0;

    // Calculate days until from selected date
    const daysUntil = form.assessment_date
        ? Math.max(1, differenceInCalendarDays(form.assessment_date, today))
        : null;

    useEffect(() => {
        const loadSubjects = async () => {
            try {
                const subjects = await base44.entities.UserSubject.filter({});
                setUserSubjects(subjects.filter(s => s.is_active !== false));
            } catch {
                setUserSubjects([]);
            } finally {
                setSubjectsLoading(false);
            }
        };
        loadSubjects();
    }, []);

    const handleSubjectSelect = async (subjectName) => {
        setForm(p => ({ ...p, subject: subjectName, key_topics: [] }));
        setWeakAreaLoading(true);
        setTopicsLoading(true);
        const [data, suggestedTopicNames] = await Promise.all([
            detectWeakAreas(subjectName),
            suggestTopicsForSubject(subjectName)
        ]);
        setWeakAreaData(data);
        const flaggedTopics = flagTopicsWithData(suggestedTopicNames, data.flashcards || [], data.quizAttempts || []);
        setForm(p => ({ ...p, key_topics: flaggedTopics }));
        setWeakAreaLoading(false);
        setTopicsLoading(false);
    };

    const handleCategoryChange = (cat) => {
        setForm(p => ({ ...p, assessment_category: cat, assessment_components: [], mark_breakdown: {} }));
    };

    const toggleComponent = (component) => {
        setForm(p => {
            const already = p.assessment_components.includes(component);
            const components = already
                ? p.assessment_components.filter(c => c !== component)
                : [...p.assessment_components, component];
            const breakdown = { ...p.mark_breakdown };
            if (already) delete breakdown[component];
            return { ...p, assessment_components: components, mark_breakdown: breakdown };
        });
    };

    const setMarkBreakdown = (component, value) => {
        setForm(p => ({ ...p, mark_breakdown: { ...p.mark_breakdown, [component]: value } }));
    };

    const handleGenerate = async () => {
        if (!form.subject.trim() || !form.topic.trim() || !form.assessment_category) {
            toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
            return;
        }
        if (showComponents && form.assessment_components.length === 0) {
            toast({ title: "Select components", description: "Please tick at least one assessment component.", variant: "destructive" });
            return;
        }
        if (!form.assessment_date) {
            toast({ title: "Select a date", description: "Please pick your assessment date.", variant: "destructive" });
            return;
        }

        const access = canUseFeature(userProfile, FEATURES.ROADMAP_AI_GEN);
        if (!access.allowed) {
            toast({
                title: access.upgradeRequired ? "Premium feature" : "Daily limit reached",
                description: access.reason,
                variant: "destructive",
            });
            return;
        }

        setIsGenerating(true);
        try {
            setGeneratingStep("Building your personalised roadmap with AI...");
            const { weakAreas, hasPriorData } = weakAreaData;
            const formWithDays = { ...form, days_until: daysUntil };
            const prompt = buildPrompt(formWithDays, weakAreas, hasPriorData);

const result = await base44.integrations.Core.InvokeLLM({
                feature: "roadmap_ai_gen",
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        intro: { type: "string" },
                        readiness_score: { type: "number" },
                        journey_map: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    day_number: { type: "number" },
                                    topic_label: { type: "string" },
                                    component_focus: { type: "string" },
                                    key_topic_name: { type: "string" }
                                }
                            }
                        },
                        day_1: {
                            type: "object",
                            properties: {
                                day_number: { type: "number" },
                                title: { type: "string" },
                                focus: { type: "string" },
                                total_time: { type: "string" },
                                tools: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            name: { type: "string" },
                                            route: { type: "string" },
                                            reason: { type: "string" },
                                            duration: { type: "string" },
                                            component: { type: "string" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            // Update the running average so future countdowns are accurate
            // (weighted toward history so one slow outlier doesn't skew it).
            try {
                const actual = Date.now() - (genStartRef.current || Date.now());
                if (actual > 5000) {
                    const prev = Number(localStorage.getItem(GEN_AVG_KEY)) || 0;
                    const next = prev > 0 ? Math.round(prev * 0.6 + actual * 0.4) : actual;
                    localStorage.setItem(GEN_AVG_KEY, String(next));
                }
            } catch { /* private mode — skip */ }

            setGeneratingStep("Saving your roadmap...");
            const assessmentTypeLabel = form.assessment_components.length > 0
                ? `${form.assessment_category} (${form.assessment_components.join(", ")})`
                : form.assessment_category;

const roadmap = await base44.entities.StudyRoadmap.create({
                subject: form.subject,
                topic: form.topic,
                assessment_type: assessmentTypeLabel,
                days_until: daysUntil,
                knowledge_level: form.knowledge_level,
                weak_areas: weakAreas,
                has_prior_data: hasPriorData,
                intro: result.intro,
                readiness_score: result.readiness_score,
                key_topics: form.key_topics || [],
                journey_map: result.journey_map || [],
                days: result.day_1 ? [result.day_1] : [],
                confidence_ratings: []
            });

            onGenerated(roadmap);
        } catch (e) {
            toast({ title: "Generation failed", description: e.message, variant: "destructive" });
        } finally {
            setIsGenerating(false);
            setGeneratingStep("");
        }
    };

    if (subjectsLoading) {
        return (
            <Card className="shadow-lg">
                <CardContent className="p-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                </CardContent>
            </Card>
        );
    }

    if (userSubjects.length === 0) {
        return (
            <Card className="shadow-lg">
                <CardContent className="p-8 text-center">
                    <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="font-semibold text-gray-700 mb-1">No subjects added yet</p>
                    <p className="text-sm text-gray-500 mb-4">
                        You haven't added any subjects yet — go to Subjects to add them first.
                    </p>
                    <a href={createPageUrl("Subjects")}>
                        <Button variant="outline">Go to Subjects</Button>
                    </a>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg">
            <CardContent className="p-6 space-y-5">

                {/* Subject */}
                <div>
                    <Label>Subject <span className="text-red-500">*</span></Label>
                    <Select value={form.subject} onValueChange={handleSubjectSelect}>
                        <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Select your subject" />
                        </SelectTrigger>
                        <SelectContent>
                            {userSubjects.map(s => (
                                <SelectItem key={s.id} value={s.subject_name}>
                                    {s.subject_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {form.subject && (
                        <div className="mt-2">
                            {weakAreaLoading ? (
                                <div className="flex items-center gap-2 text-xs text-teal-600 bg-teal-50 rounded-lg px-3 py-2">
                                    <Search className="w-3 h-3 animate-pulse" /> Scanning performance data...
                                </div>
                            ) : weakAreaData.hasPriorData ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                                    {weakAreaData.weakAreas.length > 0
                                        ? <>⚠️ Weak areas found: <strong>{weakAreaData.weakAreas.slice(0, 3).join(", ")}</strong> — roadmap will prioritise these.</>
                                        : <>✅ Prior data found — no weak areas detected. You're tracking well!</>}
                                </div>
                            ) : (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                                    📊 No prior quiz or flashcard data — a baseline session will be added on Day 1.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Topic */}
                <div>
                    <Label htmlFor="topic">What is the assessment on? <span className="text-red-500">*</span></Label>
                    <Input
                        id="topic"
                        placeholder="e.g. Cell Biology Unit 3 AOS 1, Hamlet themes and motifs"
                        value={form.topic}
                        onChange={e => setForm(p => ({ ...p, topic: e.target.value }))}
                        className="mt-1.5"
                    />
                </div>

                {/* Key Topics */}
                <div className="border border-teal-200 rounded-xl p-4 space-y-2 bg-teal-50/40">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Key Topics</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {form.subject
                                    ? "Auto-populated from the VCAA study design — remove, edit, or add your own."
                                    : "Select a subject above to auto-populate topics, or add them manually."}
                            </p>
                        </div>
                        {form.key_topics.length > 0 && (
                            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full font-medium flex-shrink-0">
                                {form.key_topics.length} topics
                            </span>
                        )}
                    </div>
                    <KeyTopicsEditor
                        topics={form.key_topics}
                        onChange={topics => setForm(p => ({ ...p, key_topics: topics }))}
                        loading={topicsLoading}
                    />
                    {form.key_topics.some(t => t.has_prior_data) && (
                        <p className="text-xs text-teal-700 bg-teal-100 rounded-lg px-3 py-2">
                            🧠 Topics marked with <strong>Prior data</strong> already have flashcards or quizzes — those days will start with a review session.
                        </p>
                    )}
                </div>

                {/* STEP 1 — Assessment category */}
                <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
                    <p className="text-sm font-semibold text-gray-800">Step 1 — Assessment type <span className="text-red-500">*</span></p>
                    <Select value={form.assessment_category} onValueChange={handleCategoryChange}>
                        <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select assessment type" />
                        </SelectTrigger>
                        <SelectContent>
                            {ASSESSMENT_CATEGORIES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    {/* STEP 2 — Component checklist (SAC / Exam only) */}
                    {showComponents && (
                        <div className="pt-2 space-y-2 border-t border-gray-200">
                            <p className="text-sm font-semibold text-gray-800 pt-1">
                                Step 2 — Which components does this {form.assessment_category} include? <span className="text-red-500">*</span>
                            </p>
                            <p className="text-xs text-gray-500">Tick all that apply — the roadmap will interleave preparation for every component.</p>

                            {availableComponents.map(comp => {
                                const checked = form.assessment_components.includes(comp);
                                return (
                                    <div key={comp} className="space-y-1.5">
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id={comp}
                                                checked={checked}
                                                onCheckedChange={() => toggleComponent(comp)}
                                            />
                                            <label htmlFor={comp} className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                                                {comp}
                                            </label>
                                        </div>
                                        {checked && (
                                            <div className="ml-7 flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    placeholder="Marks (optional)"
                                                    value={form.mark_breakdown[comp] || ""}
                                                    onChange={e => setMarkBreakdown(comp, e.target.value)}
                                                    className="w-40 h-8 text-sm bg-white"
                                                />
                                                <span className="text-xs text-gray-400">marks allocated</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {form.assessment_components.length > 1 && (
                                <div className="text-xs text-teal-700 bg-teal-50 rounded-lg px-3 py-2 mt-1">
                                    💡 {form.assessment_components.length} components selected — study time will be{" "}
                                    {Object.values(form.mark_breakdown).some(v => v)
                                        ? "distributed proportionally by mark allocation"
                                        : "spread equally. Add marks above for proportional weighting"}.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Assessment date */}
                <div>
                    <Label>Assessment Date <span className="text-red-500">*</span></Label>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className="w-full mt-1.5 justify-start text-left font-normal"
                            >
                                <CalendarIcon className="w-4 h-4 mr-2 text-gray-400" />
                                {form.assessment_date
                                    ? <>
                                        {format(form.assessment_date, "EEEE d MMMM yyyy")}
                                        <span className="ml-auto text-xs text-teal-600 font-medium">
                                            {daysUntil === 1 ? "Tomorrow" : `${daysUntil} days away`}
                                        </span>
                                      </>
                                    : <span className="text-gray-400">Pick your assessment date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={form.assessment_date}
                                onSelect={(date) => {
                                    setForm(p => ({ ...p, assessment_date: date }));
                                    setCalendarOpen(false);
                                }}
                                disabled={(date) => date < today}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Knowledge level */}
                <div>
                    <Label className="block mb-3">
                        Current Knowledge Level — <span className="text-teal-700 font-semibold">{form.knowledge_level}% · {knowledgeLabel(form.knowledge_level)}</span>
                    </Label>
                    <Slider
                        value={[form.knowledge_level]}
                        onValueChange={([v]) => setForm(p => ({ ...p, knowledge_level: v }))}
                        min={0}
                        max={100}
                        step={5}
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                        <span>0% — I know nothing</span>
                        <span>50% — Some basics</span>
                        <span>100% — Confident</span>
                    </div>
                </div>

                {isGenerating && (
                    <div className="bg-teal-50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-sm text-teal-700">
                            <span className="flex items-center gap-2 min-w-0">
                                <Search className="w-4 h-4 animate-pulse flex-shrink-0" />
                                <span className="truncate">{genStageMessage}</span>
                            </span>
                            <span className="text-xs font-semibold tabular-nums flex-shrink-0 text-teal-600">
                                {genRemainingLabel}
                            </span>
                        </div>
                        <div className="h-1.5 bg-teal-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-teal-500 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${isSavingStep ? 98 : genPct}%` }}
                            />
                        </div>
                    </div>
                )}

                <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || weakAreaLoading}
                    className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700"
                    size="lg"
                >
                    {isGenerating ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building your roadmap...</>
                    ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> Generate My Study Roadmap</>
                    )}
                </Button>

                <p className="text-xs text-gray-400 text-center">
                    Weak area data is pre-loaded when you select a subject
                </p>
            </CardContent>
        </Card>
    );
}