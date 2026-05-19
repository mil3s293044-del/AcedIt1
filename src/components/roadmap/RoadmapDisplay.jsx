import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, TrendingUp, BookOpen, Loader2, Lock, CalendarClock } from "lucide-react";
import DayCard from "./DayCard";
import { isPremium } from "@/components/shared/subscriptionHelpers";
import { createPageUrl } from "@/utils";
import { format, isToday, isBefore, startOfToday, addDays } from "date-fns";

const CONFIDENCE_EMOJI = { 1: "😟", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

function getMasteryColor(rating) {
    if (!rating) return null;
    if (rating <= 2) return "red";
    if (rating === 3) return "yellow";
    return "green";
}

function buildDayNPrompt({ roadmap, dayNum, journeyEntry, priorDays, priorRatings }) {
    const { subject, topic, assessment_type, knowledge_level, weak_areas, has_prior_data, key_topics } = roadmap;
    const keyTopicsSection = key_topics && key_topics.length > 0
        ? `\n\nKEY TOPICS:\n${key_topics.map(t => `- ${t.name} [${t.priority}]${t.has_prior_data ? " (has prior AcedIt data)" : ""}`).join("\n")}\n\nFor Day ${dayNum}, the planned key topic is: "${journeyEntry?.key_topic_name || ""}". Do NOT advance to the next topic unless previous day confidence was 3+.`
        : "";

    const daysRemaining = (roadmap?.days_until || 0) - dayNum;
    const priorContext = priorDays.length > 0
        ? priorDays.map(d => {
            const r = priorRatings.find(r => r.day === d.day_number);
            return `Day ${d.day_number}: ${d.title} — confidence: ${r?.rating ?? "not rated"}/5`;
        }).join("\n")
        : "No prior days completed yet.";
    const plannedLabel = journeyEntry?.topic_label || `Day ${dayNum}`;
    const componentFocus = journeyEntry?.component_focus || "General";
    const consecutiveLow = priorRatings.length >= 2 &&
        priorRatings.at(-1)?.rating <= 2 &&
        priorRatings.at(-2)?.rating <= 2;

    return `You are an expert VCE study coach generating Day ${dayNum} of a personalised study roadmap.${keyTopicsSection}

STUDENT CONTEXT:
- Subject: ${subject}
- Assessment topic: ${topic}
- Assessment type: ${assessment_type}
- Starting knowledge level: ${knowledge_level}%
- Days remaining after today: ${daysRemaining}
- Weak areas: ${weak_areas?.length > 0 ? weak_areas.join(", ") : "none identified"}
- Prior data existed: ${has_prior_data ? "yes" : "no"}

PRIOR DAYS COMPLETED:
${priorContext}

PLANNED TOPIC FOR DAY ${dayNum}: "${plannedLabel}"
Primary component focus: ${componentFocus}

${consecutiveLow ? `⚠️ CRITICAL: Student has rated 1–2 for two consecutive days. You MUST switch approach entirely — do NOT repeat Flashcards or Active Recall. Instead use AI Teaching Assistant or Concept Explainer to address the gap from a completely different angle. Explicitly name the specific concepts from "${topic}" that need re-explaining.` : ""}

SPECIFICITY RULE (MANDATORY): Every tool reason and focus description MUST directly name "${subject}" and specific concepts from "${topic}". Never say "build foundational knowledge" — say exactly which concept, mechanism, person, event, or argument the student is working on.

AVAILABLE TOOLS:
"Pomodoro Timer" → "Study", "Spaced Repetition Flashcards" → "Study", "Active Recall" → "Study", "Blurting Method" → "Study", "Exam Mode" → "Study", "Goals Section" → "Goals", "Study Planner" → "Goals", "AI Quizzes" → "Quizzes", "Essay Planner" → "AITools", "Concept Explainer" → "AITools", "Exam Question Generator" → "AITools", "Note Summariser" → "AITools", "AI Math Tutor" → "AITools", "AI English Mentor" → "AITools", "Line Memoriser" → "AITools", "AI Teaching Assistant" → "AITools"

RULES:
- Always include Pomodoro Timer as first tool
- 2–4 tools total
- Final day of the plan: Exam Mode or AI Quizzes only

Return ONLY valid JSON:
{
  "day": {
    "day_number": ${dayNum},
    "title": "Short specific title naming the content",
    "focus": "One sentence naming the exact concepts being studied today",
    "total_time": "X Pomodoros — Y mins total",
    "generated_based_on_day": ${dayNum - 1},
    "tools": [
      {
        "name": "Tool Name",
        "route": "PageName",
        "reason": "Specific instruction naming exact concepts from ${topic}",
        "duration": "X Pomodoros — Y mins",
        "component": "${componentFocus}"
      }
    ]
  }
}`;
}

export default function RoadmapDisplay({ roadmap: initialRoadmap, userProfile, onConfidenceUpdate }) {
    const [roadmap, setRoadmap] = useState(initialRoadmap);
    const [generatingDay, setGeneratingDay] = useState(null);
    const generatingRef = useRef(false);
    const userIsPremium = isPremium(userProfile);
    const today = startOfToday();

    useEffect(() => { setRoadmap(initialRoadmap); }, [initialRoadmap]);

    const days = roadmap?.days || [];
    const ratings = roadmap?.confidence_ratings || [];
    const journeyMap = roadmap?.journey_map || [];
    const isCrunchMode = (roadmap?.days_until || 0) < 3;

    const getRating = (dayNum) => ratings.find(r => r.day === dayNum);

    const isDayUnlocked = (dayNum) => {
        if (dayNum === 1) return true;
        const prevRating = getRating(dayNum - 1);
        if (!prevRating?.rated_at) return false;
        const ratedDay = new Date(prevRating.rated_at);
        ratedDay.setHours(0, 0, 0, 0);
        return ratedDay < today; // must have been rated on a PREVIOUS day
    };

    const isDayGenerated = (dayNum) => days.some(d => d.day_number === dayNum);

    const getDayData = (dayNum) => days.find(d => d.day_number === dayNum);

    const getUnlockDate = (dayNum) => {
        const prevRating = getRating(dayNum - 1);
        if (!prevRating?.rated_at) return null;
        return addDays(new Date(prevRating.rated_at), 1);
    };

    // Auto-generate next unlocked days
    useEffect(() => {
        if (generatingRef.current) return;
        const total = roadmap?.days_until || 0;
        for (let n = 2; n <= total; n++) {
            if (isDayUnlocked(n) && !isDayGenerated(n)) {
                generateDay(n);
                break;
            }
        }
    }, [days.length, ratings.length]);

    const generateDay = async (dayNum) => {
        if (generatingRef.current) return;
        generatingRef.current = true;
        setGeneratingDay(dayNum);
        try {
            const journeyEntry = journeyMap.find(j => j.day_number === dayNum);
            const priorDays = days.filter(d => d.day_number < dayNum);
            const priorRatings = ratings.filter(r => r.day < dayNum);

            const prompt = buildDayNPrompt({ roadmap, dayNum, journeyEntry, priorDays, priorRatings });

            const result = await base44.integrations.Core.InvokeLLM({
                feature: "roadmap_ai_gen",
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        day: {
                            type: "object",
                            properties: {
                                day_number: { type: "number" },
                                title: { type: "string" },
                                focus: { type: "string" },
                                total_time: { type: "string" },
                                generated_based_on_day: { type: "number" },
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

            const newDays = [...days, result.day].sort((a, b) => a.day_number - b.day_number);
            const updated = { ...roadmap, days: newDays };
            await base44.entities.StudyRoadmap.update(roadmap.id, { days: newDays });
            setRoadmap(updated);
            onConfidenceUpdate(updated);
        } catch (e) {
            console.error("Day generation error:", e);
        } finally {
            generatingRef.current = false;
            setGeneratingDay(null);
        }
    };

    const handleRateDay = async (dayNum, rating) => {
        const dayData = getDayData(dayNum);
        const journeyEntry = journeyMap.find(j => j.day_number === dayNum);
        const topicCovered = journeyEntry?.topic_label || dayData?.focus || "";
        const newRatings = [
            ...ratings.filter(r => r.day !== dayNum),
            { day: dayNum, rating, rated_at: new Date().toISOString(), topic_covered: topicCovered }
        ];
        const updated = { ...roadmap, confidence_ratings: newRatings };
        await base44.entities.StudyRoadmap.update(roadmap.id, { confidence_ratings: newRatings });
        setRoadmap(updated);
        onConfidenceUpdate(updated);
    };

    const hasConsecutiveLowRatings = () => {
        const sorted = [...ratings].sort((a, b) => a.day - b.day);
        for (let i = 0; i < sorted.length - 1; i++) {
            if (sorted[i].rating <= 2 && sorted[i + 1].rating <= 2 && sorted[i + 1].day === sorted[i].day + 1) return true;
        }
        return false;
    };

    // Topic coverage tracker
    const keyTopics = roadmap?.key_topics || [];
    const completedDayNums = new Set(ratings.map(r => r.day));
    const coveredTopicNames = new Set(
        journeyMap.filter(j => completedDayNums.has(j.day_number)).map(j => j.key_topic_name).filter(Boolean)
    );
    const coveredCount = keyTopics.filter(t => coveredTopicNames.has(t.name)).length;
    const completedDaysCount = ratings.length;
    const remainingDays = (roadmap?.days_until || 0) - completedDaysCount;
    const remainingTopics = keyTopics.filter(t => !coveredTopicNames.has(t.name)).length;
    const isCriticalCompression = keyTopics.length > 0 && remainingTopics > remainingDays && remainingDays > 0;
    const highPriorityRemaining = keyTopics.filter(t => t.priority === "High" && !coveredTopicNames.has(t.name));

    // Use journey_map if available, otherwise fall back to days array
    const displayEntries = journeyMap.length > 0
        ? journeyMap
        : days.map(d => ({ day_number: d.day_number, topic_label: `Day ${d.day_number} — ${d.title}`, component_focus: "General" }));

    return (
        <div className="space-y-4">
            {/* Summary Bar */}
            <Card className="bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200">
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-3 items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                            <Badge className="bg-teal-100 text-teal-800 border-0">{roadmap.days_until} days</Badge>
                            <Badge className="bg-blue-100 text-blue-800 border-0">{roadmap.knowledge_level}% knowledge</Badge>
                            <Badge className="bg-purple-100 text-purple-800 border-0">{roadmap.assessment_type}</Badge>
                            <Badge className="bg-indigo-100 text-indigo-800 border-0">{roadmap.subject}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Readiness</span>
                            <div className="flex items-center gap-1.5">
                                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all" style={{ width: `${roadmap.readiness_score || 0}%` }} />
                                </div>
                                <span className="text-sm font-bold text-teal-700">{roadmap.readiness_score || 0}/100</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Crunch Mode */}
            {isCrunchMode && (
                <Card className="border-orange-300 bg-orange-50">
                    <CardContent className="p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-orange-800">⚡ Crunch Mode</p>
                            <p className="text-sm text-orange-700">Less than 3 days — plan compressed to essentials: Active Recall, Blurting Method, and Exam Mode only.</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Weak Areas */}
            {roadmap.weak_areas?.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <p className="font-bold text-red-800">Known Weak Areas (scored below 60%)</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {roadmap.weak_areas.map((area, i) => (
                                <Badge key={i} className="bg-red-100 text-red-700 border-red-200">{area}</Badge>
                            ))}
                        </div>
                        <p className="text-xs text-red-600 mt-2">These topics have been prioritised in the first half of your roadmap.</p>
                    </CardContent>
                </Card>
            )}

            {/* No prior data notice */}
            {!roadmap.has_prior_data && (
                <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4 flex items-start gap-3">
                        <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-700">
                            No prior quiz or flashcard data found for <strong>{roadmap.subject}</strong>. A baseline session is included on Day 1 — complete it so AcedIt can personalise future days.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* AI Intro */}
            {roadmap.intro && (
                <Card>
                    <CardContent className="p-4 flex items-start gap-3">
                        <BookOpen className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                        <p className="text-gray-700 text-sm leading-relaxed">{roadmap.intro}</p>
                    </CardContent>
                </Card>
            )}

            {/* Mastery Arc — journey map overview */}
            {displayEntries.length > 0 && (
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Your Mastery Journey</p>
                        <div className="flex flex-wrap gap-2">
                            {displayEntries.map((entry) => {
                                const r = getRating(entry.day_number);
                                const color = getMasteryColor(r?.rating);
                                const isGenerated = isDayGenerated(entry.day_number);
                                return (
                                    <div key={entry.day_number} className="flex items-center gap-1.5">
                                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                            color === "green" ? "bg-green-500" :
                                            color === "yellow" ? "bg-yellow-400" :
                                            color === "red" ? "bg-red-500" :
                                            isGenerated ? "bg-teal-400" : "bg-gray-200"
                                        }`} />
                                        <span className="text-xs text-gray-600 hidden sm:block max-w-[160px] truncate">{entry.topic_label}</span>
                                        <span className="text-xs text-gray-400 sm:hidden">D{entry.day_number}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-3 mt-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Mastered</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> In Progress</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Needs Work</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" /> Not Yet Unlocked</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Topic Coverage Tracker */}
            {keyTopics.length > 0 && (
                <Card className="border-teal-200 bg-teal-50/40">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Topic Coverage</p>
                            <span className="text-sm font-bold text-teal-700">{coveredCount} of {keyTopics.length} topics covered</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                            <div className="h-2 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all" style={{ width: keyTopics.length > 0 ? `${Math.round((coveredCount / keyTopics.length) * 100)}%` : "0%" }} />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {keyTopics.map((t, i) => (
                                <span key={i} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                                    coveredTopicNames.has(t.name) ? "bg-green-100 text-green-700 border-green-200" :
                                    t.priority === "High" ? "bg-red-50 text-red-600 border-red-200" :
                                    "bg-gray-100 text-gray-500 border-gray-200"
                                }`}>
                                    {coveredTopicNames.has(t.name) ? "✓ " : ""}{t.name}
                                </span>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Critical compression warning */}
            {isCriticalCompression && (
                <Card className="border-orange-300 bg-orange-50">
                    <CardContent className="p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-orange-800">⚡ Topic Compression Warning</p>
                            <p className="text-sm text-orange-700">
                                You have <strong>{remainingTopics} topics</strong> left and only <strong>{remainingDays} days</strong> — your plan will prioritise{" "}
                                {highPriorityRemaining.length > 0 ? <>your <strong>High priority</strong> topics first: {highPriorityRemaining.map(t => t.name).join(", ")}.</> : "your highest priority topics first."}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Consecutive low rating warning */}
            {hasConsecutiveLowRatings() && (
                <Card className="border-yellow-300 bg-yellow-50">
                    <CardContent className="p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-yellow-800">Struggling with this content?</p>
                            <p className="text-sm text-yellow-700">
                                You've rated 1–2 on two consecutive days. Your next generated day will switch approach — using AI Teaching Assistant or Concept Explainer instead of repeating the same methods.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Day Cards */}
            <div className="space-y-3">
                {displayEntries.map((entry, index) => {
                    const dayNum = entry.day_number;
                    const dayData = getDayData(dayNum);
                    const rating = getRating(dayNum);
                    const isGenerated = isDayGenerated(dayNum);
                    const isUnlocked = isDayUnlocked(dayNum);
                    const isPremiumLocked = !userIsPremium && index > 0;

                    // Premium lock
                    if (isPremiumLocked) {
                        return (
                            <Card key={dayNum} className="border-gray-200 bg-gray-50 opacity-60">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <Lock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                    <div>
                                        <p className="font-semibold text-gray-500 text-sm">{entry.topic_label}</p>
                                        <p className="text-xs text-gray-400">Unlock with Premium</p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    }

                    // Currently generating
                    if (generatingDay === dayNum) {
                        return (
                            <Card key={dayNum} className="border-teal-200 bg-teal-50">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <Loader2 className="w-5 h-5 text-teal-600 animate-spin flex-shrink-0" />
                                    <div>
                                        <p className="font-semibold text-teal-800 text-sm">{entry.topic_label}</p>
                                        <p className="text-xs text-teal-600">Generating Day {dayNum} based on your Day {dayNum - 1} performance...</p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    }

                    // Date locked (unlocks tomorrow or later)
                    if (!isUnlocked && !isGenerated) {
                        const unlockDate = getUnlockDate(dayNum);
                        const unlockText = unlockDate
                            ? isToday(addDays(unlockDate, -1))
                                ? `Day ${dayNum} unlocks tomorrow — come back after you've completed today's session.`
                                : `Day ${dayNum} unlocks on ${format(unlockDate, "EEEE d MMM")} — complete each day before the next unlocks.`
                            : `Day ${dayNum} unlocks after you complete and rate Day ${dayNum - 1}.`;
                        return (
                            <Card key={dayNum} className="border-gray-200 bg-gray-50">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <CalendarClock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                    <div>
                                        <p className="font-semibold text-gray-600 text-sm">{entry.topic_label}</p>
                                        <p className="text-xs text-gray-400">{unlockText}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    }

                    // Day 1 unlocked but not yet generated (shouldn't happen but fallback)
                    if (!isGenerated) return null;

                    // Generated — show full DayCard
                    const prevRating = getRating(dayNum - 1);
                    const isConsolidation = prevRating && prevRating.rating <= 2;
                    const topicLabel = entry.topic_label || `Day ${dayNum} — ${dayData.title}`;

                    return (
                        <DayCard
                            key={dayNum}
                            day={dayData}
                            topicLabel={topicLabel}
                            isConsolidation={isConsolidation}
                            rating={rating?.rating}
                            masteryColor={getMasteryColor(rating?.rating)}
                            generatedBasedOnDay={dayData.generated_based_on_day || null}
                            onRate={(r) => handleRateDay(dayNum, r)}
                        />
                    );
                })}
            </div>

            {/* Free user upsell */}
            {!userIsPremium && displayEntries.length > 1 && (
                <Card className="border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50">
                    <CardContent className="p-6 text-center">
                        <p className="text-3xl mb-2">🔒</p>
                        <p className="font-bold text-indigo-900 text-lg mb-1">Days 2–{displayEntries.length} are Premium only</p>
                        <p className="text-sm text-indigo-700 mb-4">
                            Upgrade to unlock dynamic daily generation, confidence checkpoints, and your full mastery journey.
                        </p>
                        <a href={createPageUrl("Subscription")}>
                            <button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
                                Upgrade to Premium
                            </button>
                        </a>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}