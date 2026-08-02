import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { Wand2, Loader2, ChevronDown, ChevronUp, Copy, Check, Lightbulb, AlertTriangle, Target, RefreshCw, Download } from 'lucide-react';
import AISkeleton from '../shared/AISkeleton';
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import MathText from '@/components/shared/LatexRenderer';
import { getExaminerPrompt } from '@/lib/subjectExaminerPrompts';

const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard', 'VCE Exam Standard']; // exam question generator
const QUESTION_TYPES = ['Multiple Choice', 'Short Answer (2-3 marks)', 'Extended Response (4-6 marks)', 'Analysis', 'Mixed'];

export default function ExamQuestionGenerator() {
    const [subject, setSubject] = useState('');
    const [topic, setTopic] = useState('');
    const [difficulty, setDifficulty] = useState('VCE Exam Standard');
    const [questionType, setQuestionType] = useState('Mixed');
    const [numQuestions, setNumQuestions] = useState(5);
    const [additionalContext, setAdditionalContext] = useState('');
    const [questions, setQuestions] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [expandedQ, setExpandedQ] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const { toast } = useToast();

    useEffect(() => {
        const init = async () => {
            const user = await base44.auth.me();
            const subjects = await base44.entities.UserSubject.filter({ created_by: user.email, is_active: true }).catch(() => []);
            const unique = subjects.reduce((acc, s) => {
                if (!acc.find(x => x.subject_name === s.subject_name)) acc.push(s);
                return acc;
            }, []);
            setUserSubjects(unique);
            if (unique.length > 0) {
                setSubject(unique[0].subject_name);
                // Auto-apply suggested difficulty from ratings
                const suggested = unique[0].suggested_quiz_difficulty;
                if (suggested === 'beginner') setDifficulty('Easy');
                else if (suggested === 'advanced') setDifficulty('Hard');
            }
        };
        init();
    }, []);

    // When subject changes, update difficulty suggestion
    const handleSubjectChange = (val) => {
        setSubject(val);
        const subData = userSubjects.find(s => s.subject_name === val);
        if (subData?.suggested_quiz_difficulty) {
            if (subData.suggested_quiz_difficulty === 'beginner') setDifficulty('Easy');
            else if (subData.suggested_quiz_difficulty === 'advanced') setDifficulty('Hard');
            else setDifficulty('VCE Exam Standard');
        }
    };

    const currentSubjectData = userSubjects.find(s => s.subject_name === subject);

    const handleGenerate = async () => {
        if (!subject || !topic.trim()) {
            toast({ title: 'Please fill in subject and topic', variant: 'destructive' });
            return;
        }
        setIsGenerating(true);
        setQuestions([]);

        const examinerPrompt = getExaminerPrompt(subject);
        try {
            const response = await base44.integrations.Core.InvokeLLM({
                prompt: `${examinerPrompt}

TASK: Generate ${numQuestions} high-quality exam questions on the topic: "${topic}".

Difficulty: ${difficulty}
Question Type: ${questionType}
${additionalContext ? `Additional context/constraints: ${additionalContext}` : ''}

For EACH question, provide:
1. "question" — the question text, phrased exactly as it would appear on a real VCAA exam paper. NEVER leave this empty.
2. "type" — set to "mcq" for multiple choice, or "short_answer" for everything else.
3. "marks" — mark allocation matching VCAA conventions (1-10).
4. "options" — for MCQ, an array of EXACTLY 4 plausible distinct answer strings. For non-MCQ, an empty array [].
5. "correct_answer_index" — for MCQ, the 0-based index (0, 1, 2, or 3) of the correct option. For non-MCQ, set to 0.
6. "model_answer" — full-marks model response with all working and precise terminology.
7. "marking_criteria" — mark-by-mark breakdown (e.g. "1 mark: correct equation. 1 mark: substitution. 1 mark: final answer with units.").
8. "common_mistakes" — typical student errors on this question type.
9. "study_tip" — a specific tip targeting this question pattern.

DO NOT use markdown formatting (no ** for bold, no # headers). Write in clean prose with line breaks. Math notation rules above MUST be followed exactly.

Return as a JSON object with a "questions" array.`,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        questions: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    question: { type: 'string' },
                                    type: { type: 'string' },
                                    marks: { type: 'number' },
                                    options: { type: 'array', items: { type: 'string' } },
                                    correct_answer_index: { type: 'number' },
                                    model_answer: { type: 'string' },
                                    marking_criteria: { type: 'string' },
                                    common_mistakes: { type: 'string' },
                                    study_tip: { type: 'string' }
                                },
                                required: ['question', 'type', 'marks', 'options', 'correct_answer_index', 'model_answer', 'marking_criteria', 'common_mistakes', 'study_tip']
                            }
                        }
                    },
                    required: ['questions']
                }
            });

            const generated = (response?.questions || []).map((q, i) => ({ ...q, id: i }));
            if (generated.length === 0) {
                toast({
                    title: 'No questions returned',
                    description: 'Try a smaller count (5–8) or a more specific topic.',
                    variant: 'destructive',
                });
            } else {
                setQuestions(generated);
                if (generated.length < numQuestions) {
                    toast({
                        title: `Got ${generated.length} of ${numQuestions} requested`,
                        description: 'AI returned fewer than asked. For larger sets, generate in batches of 5–8.',
                    });
                }
                recordStudyAndGetStreak().catch(() => {});
            }
        } catch (err) {
            console.error('ExamQuestionGenerator failed:', err);
            const msg = err?.message || err?.response?.data?.message || '';
            const friendly = msg.includes('incomplete') || msg.includes('truncated')
                ? 'AI ran out of room — try generating 5–8 questions at a time instead of 15+.'
                : msg.includes('Premium') || msg.includes('limit') || msg.includes('cap')
                    ? msg
                    : 'Generation failed. Try again, or reduce the number of questions.';
            toast({ title: 'Could not generate questions', description: friendly, variant: 'destructive' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleSaveAsQuiz = async () => {
        if (!questions.length) return;
        const quizQuestions = questions.map(q => {
            const isMcq = q.type === 'mcq' || q.type?.toLowerCase().includes('multiple');
            return {
                type: isMcq ? 'mcq' : 'short_answer',
                question: q.question,
                options: isMcq ? (q.options || []) : [],
                correct_answer: isMcq ? (q.correct_answer_index ?? 0) : undefined,
                model_answer: q.model_answer,
                marks: q.marks,
                explanation: q.marking_criteria,
            };
        });
        await base44.entities.Quiz.create({
            title: `${subject} - ${topic}`,
            subject,
            questions: quizQuestions,
            difficulty: difficulty.toLowerCase().replace(' ', '_'),
            category: 'subject_content'
        });
        toast({ title: 'Saved as Quiz! 🎉', description: 'Find it in your Quizzes page.' });
    };

    const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);

    return (
        <div className="space-y-6">
            {isGenerating && <AISkeleton type="questions" count={numQuestions} message={`Generating ${numQuestions} ${subject || 'exam'} question${numQuestions === 1 ? '' : 's'}…`} />}

            {/* Input Panel */}
            <div className="card-soft overflow-hidden">
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-foreground">Subject</label>
                            <Select value={subject} onValueChange={handleSubjectChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                    {userSubjects.map(s => (
                                        <SelectItem key={s.id} value={s.subject_name}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color || '#3B82F6' }} />
                                                {s.subject_name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-foreground">Topic / Unit</label>
                            <Input
                                placeholder="e.g., Cell Respiration, Quadratic Functions"
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                               
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-foreground">Difficulty</label>
                            <Select value={difficulty} onValueChange={setDifficulty}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DIFFICULTY_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-foreground">Question Type</label>
                            <Select value={questionType} onValueChange={setQuestionType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {QUESTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-foreground">Number of Questions</label>
                            <Select value={numQuestions.toString()} onValueChange={v => setNumQuestions(parseInt(v))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[3, 5, 8, 10, 15].map(n => <SelectItem key={n} value={n.toString()}>{n} questions</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-foreground">Additional Context <span className="text-muted-foreground/70 font-normal normal-case">(optional)</span></label>
                            <Input
                                placeholder="e.g., focus on Unit 3, include graphs"
                                value={additionalContext}
                                onChange={e => setAdditionalContext(e.target.value)}
                               
                            />
                        </div>
                    </div>

                    {currentSubjectData?.avg_difficulty_rating && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border-2 ${
                            currentSubjectData.suggested_quiz_difficulty === 'beginner' ? 'bg-chart-3/10 border-chart-3/25 text-chart-3' :
                            currentSubjectData.suggested_quiz_difficulty === 'advanced' ? 'bg-streak/10 border-streak/25 text-streak' :
                            'bg-primary/10 border-primary/25 text-primary'
                        }`}>
                            <Target className="w-3.5 h-3.5" />
                            <span>Difficulty set to <strong>{difficulty}</strong> for {subject} based on your ratings</span>
                        </div>
                    )}

                    <Button
                        onClick={handleGenerate}
                        disabled={isGenerating || !subject || !topic.trim()}
                        className="w-full shadow-lg h-11 text-sm font-semibold"
                    >
                        {isGenerating ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating Questions...</>
                        ) : (
                            <><Wand2 className="w-4 h-4 mr-2" />Generate {numQuestions} Questions</>
                        )}
                    </Button>
                </div>
            </div>

            {/* Results */}
            <AnimatePresence>
                {questions.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        {/* Stats bar */}
                        <div className="flex items-center justify-between card-soft px-4 py-3">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <Target className="w-4 h-4 text-streak" />
                                    <span className="text-sm font-bold text-foreground">{questions.length} questions</span>
                                </div>
                                <div className="h-4 w-px bg-border" />
                                <span className="text-sm text-muted-foreground">{totalMarks} total marks</span>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={handleGenerate}>
                                    <RefreshCw className="w-3.5 h-3.5" />Regenerate
                                </Button>
                                <Button size="sm" onClick={handleSaveAsQuiz}>
                                    <Download className="w-3.5 h-3.5" />Save as Quiz
                                </Button>
                            </div>
                        </div>

                        {/* Question cards */}
                        {questions.map((q, idx) => (
                            <motion.div
                                key={q.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="card-soft overflow-hidden"
                            >
                                <button
                                    onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-secondary/40 transition-colors"
                                >
                                    <div className="flex-shrink-0 w-7 h-7 bg-streak/15 text-streak rounded-lg flex items-center justify-center text-xs font-extrabold mt-0.5">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            {q.marks && (
                                                <span className="pill bg-streak/15 text-streak">
                                                    {q.marks} mark{q.marks !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                            {q.type && (
                                                <span className="text-xs text-muted-foreground/70">{q.type}</span>
                                            )}
                                        </div>
                                        <div className="text-sm text-foreground font-medium leading-relaxed line-clamp-2">
                                            <MathText>{q.question}</MathText>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={e => { e.stopPropagation(); handleCopy(q.question, q.id); }}
                                            className="p-1.5 text-muted-foreground/40 hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
                                        >
                                            {copiedId === q.id ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                        {expandedQ === q.id ? <ChevronUp className="w-4 h-4 text-muted-foreground/70" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/70" />}
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {expandedQ === q.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden border-t-2 border-border"
                                        >
                                            <div className="p-4 space-y-3">
                                                {/* Full question */}
                                                <div className="bg-secondary/50 rounded-xl p-3">
                                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Full Question</p>
                                                    <div className="text-sm text-foreground leading-relaxed">
                                                        <MathText>{q.question}</MathText>
                                                    </div>
                                                    {q.options?.length > 0 && (
                                                        <ul className="mt-2 space-y-1">
                                                            {q.options.map((opt, i) => (
                                                                <li key={i} className="text-sm text-foreground flex gap-2">
                                                                    <span className="font-bold text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
                                                                    <MathText>{opt}</MathText>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>

                                                {q.model_answer && (
                                                    <div className="bg-primary/5 rounded-xl p-3 border-2 border-primary/20">
                                                        <p className="text-xs font-extrabold text-primary uppercase tracking-wide mb-1.5">Model Answer</p>
                                                        <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                                            <MathText>{q.model_answer}</MathText>
                                                        </div>
                                                    </div>
                                                )}

                                                {q.marking_criteria && (
                                                    <div className="bg-chart-3/5 rounded-xl p-3 border-2 border-chart-3/20">
                                                        <p className="text-xs font-extrabold text-chart-3 uppercase tracking-wide mb-1.5">Marking Criteria</p>
                                                        <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                                            <MathText>{q.marking_criteria}</MathText>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {q.common_mistakes && (
                                                        <div className="bg-xp/5 rounded-xl p-3 border-2 border-xp/20">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <AlertTriangle className="w-3.5 h-3.5 text-xp" />
                                                                <p className="text-xs font-extrabold text-xp uppercase tracking-wide">Common Mistakes</p>
                                                            </div>
                                                            <div className="text-xs text-foreground leading-relaxed">
                                                                <MathText>{q.common_mistakes}</MathText>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {q.study_tip && (
                                                        <div className="bg-chart-4/5 rounded-xl p-3 border-2 border-chart-4/20">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <Lightbulb className="w-3.5 h-3.5 text-chart-4" />
                                                                <p className="text-xs font-extrabold text-chart-4 uppercase tracking-wide">Study Tip</p>
                                                            </div>
                                                            <div className="text-xs text-foreground leading-relaxed">
                                                                <MathText>{q.study_tip}</MathText>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}