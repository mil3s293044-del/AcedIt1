import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
    ArrowLeft, ArrowRight, Clock, Award, CheckCircle, 
    XCircle, Loader2, TrendingUp, BarChart3, Users, AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { PastPaperAttempt, User } from "@/entities/all";
import { useToast } from "@/components/ui/use-toast";
import MathText from "@/components/shared/LatexRenderer";

export default function PastPaperPlayer({ paper, onComplete, onBack }) {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [results, setResults] = useState(null);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [allAttempts, setAllAttempts] = useState([]);
    const [user, setUser] = useState(null);
    
    const timerRef = useRef(null);
    const { toast } = useToast();

    useEffect(() => {
        const init = async () => {
            const currentUser = await User.me();
            setUser(currentUser);
            
            // Load all attempts for this paper (for statistics)
            const attempts = await PastPaperAttempt.filter({ paper_id: paper.id });
            setAllAttempts(attempts || []);
        };
        init();

        // Start timer
        timerRef.current = setInterval(() => {
            setTimeElapsed(prev => prev + 1);
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [paper.id]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAnswerChange = (questionNumber, answer) => {
        setAnswers(prev => ({
            ...prev,
            [questionNumber]: answer
        }));
    };

    const getQuestionStats = (questionNumber) => {
        const questionAttempts = allAttempts.flatMap(a => 
            a.answers.filter(ans => ans.question_number === questionNumber)
        );
        
        if (questionAttempts.length === 0) return null;

        const avgScore = questionAttempts.reduce((sum, a) => sum + (a.marks_awarded / a.max_marks) * 100, 0) / questionAttempts.length;
        return {
            attempts: questionAttempts.length,
            avgScore: Math.round(avgScore)
        };
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        clearInterval(timerRef.current);

        try {
            // Prepare answers for AI marking
            const answersForMarking = paper.questions.map(q => ({
                question_number: q.question_number,
                question_text: q.question_text,
                marks: q.marks,
                question_type: q.question_type,
                marking_criteria: q.marking_criteria,
                student_answer: answers[q.question_number] || "",
                correct_mcq_answer: q.correct_mcq_answer,
                mcq_options: q.mcq_options
            }));

            // Get AI marking
            const markingResponse = await base44.integrations.Core.InvokeLLM({
                prompt: `You are an experienced VCAA examiner marking a ${paper.subject} exam. 
                
Mark each answer according to VCAA standards. Be fair but rigorous.

For each question:
1. Award marks based on the marking criteria
2. Provide specific, constructive feedback as a VCAA examiner would
3. Explain what was missing if marks were lost
4. Reference the marking criteria in your feedback

Subject: ${paper.subject}
Paper: ${paper.title}

Questions and Answers to Mark:
${JSON.stringify(answersForMarking, null, 2)}

Remember:
- For MCQ: Award full marks only if the correct option is selected
- For short answers: Award partial marks for partial correct responses
- For extended responses: Mark against each criterion point
- Be encouraging but honest about areas for improvement`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        marked_answers: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    question_number: { type: "string" },
                                    marks_awarded: { type: "number" },
                                    max_marks: { type: "number" },
                                    feedback: { type: "string" }
                                }
                            }
                        },
                        overall_feedback: { type: "string" },
                        strengths: { type: "array", items: { type: "string" } },
                        areas_for_improvement: { type: "array", items: { type: "string" } }
                    }
                }
            });

            // Calculate totals
            const totalAwarded = markingResponse.marked_answers.reduce((sum, a) => sum + a.marks_awarded, 0);
            const totalPossible = paper.total_marks;
            const percentage = Math.round((totalAwarded / totalPossible) * 100);

            // Calculate predicted study score
            // VCAA study scores: 50 is highest, 30 is mean
            // Rough mapping: 90%+ = 45+, 80-90% = 40-45, 70-80% = 35-40, etc.
            let predictedScore;
            if (percentage >= 95) predictedScore = 50;
            else if (percentage >= 90) predictedScore = 47;
            else if (percentage >= 85) predictedScore = 44;
            else if (percentage >= 80) predictedScore = 41;
            else if (percentage >= 75) predictedScore = 38;
            else if (percentage >= 70) predictedScore = 35;
            else if (percentage >= 65) predictedScore = 32;
            else if (percentage >= 60) predictedScore = 30;
            else if (percentage >= 55) predictedScore = 28;
            else if (percentage >= 50) predictedScore = 26;
            else if (percentage >= 45) predictedScore = 24;
            else if (percentage >= 40) predictedScore = 22;
            else predictedScore = 20;

            // Save attempt
            const attemptData = {
                paper_id: paper.id,
                paper_title: paper.title,
                subject: paper.subject,
                answers: markingResponse.marked_answers.map(a => ({
                    ...a,
                    answer: answers[a.question_number] || ""
                })),
                total_marks_awarded: totalAwarded,
                total_marks_possible: totalPossible,
                percentage,
                predicted_study_score: predictedScore,
                time_taken: timeElapsed,
                completed_date: format(new Date(), 'yyyy-MM-dd')
            };

            await PastPaperAttempt.create(attemptData);

            setResults({
                ...markingResponse,
                totalAwarded,
                totalPossible,
                percentage,
                predictedScore
            });
            setIsCompleted(true);

        } catch (error) {
            console.error("Error submitting:", error);
            toast({ title: "Error", description: "Failed to mark your answers.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const question = paper.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / paper.questions.length) * 100;
    const questionStats = question ? getQuestionStats(question.question_number) : null;

    if (isCompleted && results) {
        return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={onComplete} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Past Papers
                </Button>

                {/* Results Header */}
                <Card className="overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-purple-500 to-indigo-500" />
                    <CardContent className="p-8">
                        <div className="text-center space-y-4">
                            <h2 className="text-3xl font-bold text-gray-900">{paper.title}</h2>
                            <div className="flex items-center justify-center gap-8">
                                <div className="text-center">
                                    <div className="text-5xl font-bold text-purple-600">
                                        {results.totalAwarded}/{results.totalPossible}
                                    </div>
                                    <p className="text-gray-600 mt-1">Marks</p>
                                </div>
                                <div className="text-center">
                                    <div className="text-5xl font-bold text-indigo-600">
                                        {results.percentage}%
                                    </div>
                                    <p className="text-gray-600 mt-1">Score</p>
                                </div>
                                <div className="text-center">
                                    <div className="text-5xl font-bold text-green-600">
                                        {results.predictedScore}
                                    </div>
                                    <p className="text-gray-600 mt-1">Predicted Study Score</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-gray-600">
                                <Clock className="w-4 h-4" />
                                Time taken: {formatTime(timeElapsed)}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Overall Feedback */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-purple-600" />
                            Examiner Feedback
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-gray-700"><MathText>{results.overall_feedback}</MathText></p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {results.strengths?.length > 0 && (
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                    <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" />
                                        Strengths
                                    </h4>
                                    <ul className="space-y-1">
                                        {results.strengths.map((s, i) => (
                                            <li key={i} className="text-sm text-green-700">• {s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {results.areas_for_improvement?.length > 0 && (
                                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                                    <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        Areas for Improvement
                                    </h4>
                                    <ul className="space-y-1">
                                        {results.areas_for_improvement.map((a, i) => (
                                            <li key={i} className="text-sm text-amber-700">• {a}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Question by Question */}
                <Card>
                    <CardHeader>
                        <CardTitle>Question Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {results.marked_answers.map((answer, index) => {
                            const q = paper.questions.find(q => q.question_number === answer.question_number);
                            const stats = getQuestionStats(answer.question_number);
                            const isFullMarks = answer.marks_awarded === answer.max_marks;
                            
                            return (
                                <div 
                                    key={answer.question_number}
                                    className={`p-4 rounded-lg border ${
                                        isFullMarks 
                                            ? 'bg-green-50 border-green-200' 
                                            : answer.marks_awarded > 0 
                                                ? 'bg-amber-50 border-amber-200'
                                                : 'bg-red-50 border-red-200'
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="font-mono">
                                                Q{answer.question_number}
                                            </Badge>
                                            {isFullMarks ? (
                                                <CheckCircle className="w-5 h-5 text-green-600" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-amber-600" />
                                            )}
                                        </div>
                                        <Badge className={isFullMarks ? 'bg-green-600' : 'bg-amber-600'}>
                                            {answer.marks_awarded}/{answer.max_marks} marks
                                        </Badge>
                                    </div>
                                    
                                    <p className="text-sm text-gray-700 mb-2">
                                        <strong>Question:</strong> <MathText>{q?.question_text}</MathText>
                                    </p>
                                    <p className="text-sm text-gray-700 mb-2">
                                        <strong>Your answer:</strong> {answers[answer.question_number] || "(No answer)"}
                                    </p>
                                    <p className="text-sm text-gray-800">
                                        <strong>Feedback:</strong> <MathText>{answer.feedback}</MathText>
                                    </p>

                                    {stats && (
                                        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-4 text-xs text-gray-500">
                                            <div className="flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                {stats.attempts} attempts
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <BarChart3 className="w-3 h-3" />
                                                Avg: {stats.avgScore}%
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Exit
                </Button>
                <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-lg px-4 py-2">
                        <Clock className="w-4 h-4 mr-2" />
                        {formatTime(timeElapsed)}
                    </Badge>
                    <Badge className="bg-purple-100 text-purple-700 text-lg px-4 py-2">
                        {currentQuestion + 1} / {paper.questions.length}
                    </Badge>
                </div>
            </div>

            {/* Progress */}
            <Progress value={progress} className="h-2" />

            {/* Question Card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentQuestion}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                >
                    <Card className="overflow-hidden">
                        <div className="h-2 bg-gradient-to-r from-purple-500 to-indigo-500" />
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Badge variant="secondary" className="text-lg font-mono">
                                        Q{question.question_number}
                                    </Badge>
                                    <Badge variant="outline">
                                        <Award className="w-3 h-3 mr-1" />
                                        {question.marks} mark{question.marks !== 1 ? 's' : ''}
                                    </Badge>
                                </div>
                                {questionStats && (
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Users className="w-4 h-4" />
                                        {questionStats.attempts} attempts • Avg: {questionStats.avgScore}%
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <p className="text-lg text-gray-800 leading-relaxed">
                                <MathText>{question.question_text}</MathText>
                            </p>

                            {question.question_type === 'mcq' && question.mcq_options ? (
                                <RadioGroup
                                    value={answers[question.question_number]?.toString() || ""}
                                    onValueChange={(value) => handleAnswerChange(question.question_number, value)}
                                    className="space-y-3"
                                >
                                    {question.mcq_options.map((option, idx) => (
                                        <div key={idx} className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                                            <RadioGroupItem value={idx.toString()} id={`option-${idx}`} />
                                            <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                                                <MathText>{option}</MathText>
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            ) : (
                                <Textarea
                                    value={answers[question.question_number] || ""}
                                    onChange={(e) => handleAnswerChange(question.question_number, e.target.value)}
                                    placeholder="Type your answer here..."
                                    className="min-h-[200px]"
                                />
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between">
                <Button
                    variant="outline"
                    onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestion === 0}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous
                </Button>

                {currentQuestion === paper.questions.length - 1 ? (
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-green-600 to-emerald-600"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Marking...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Submit for Marking
                            </>
                        )}
                    </Button>
                ) : (
                    <Button
                        onClick={() => setCurrentQuestion(prev => Math.min(paper.questions.length - 1, prev + 1))}
                    >
                        Next
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                )}
            </div>

            {/* Question Navigator */}
            <Card>
                <CardContent className="p-4">
                    <p className="text-sm text-gray-500 mb-3">Question Navigator</p>
                    <div className="flex flex-wrap gap-2">
                        {paper.questions.map((q, idx) => {
                            const isAnswered = !!answers[q.question_number];
                            const isCurrent = idx === currentQuestion;
                            
                            return (
                                <button
                                    key={q.question_number}
                                    onClick={() => setCurrentQuestion(idx)}
                                    className={`w-10 h-10 rounded-lg font-medium transition-all ${
                                        isCurrent
                                            ? 'bg-purple-600 text-white'
                                            : isAnswered
                                                ? 'bg-green-100 text-green-700 border border-green-300'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}