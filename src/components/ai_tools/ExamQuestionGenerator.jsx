import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import { Wand2, Loader2, Plus, Trash2, ChevronDown, ChevronUp, Copy, Check, Download, RefreshCw, Target } from 'lucide-react';
import AILoadingProgress from '../shared/AILoadingProgress';
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";

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

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: `You are a VCE examiner for ${subject}. Generate ${numQuestions} high-quality exam questions on the topic: "${topic}".

Difficulty: ${difficulty}
Question Type: ${questionType}
${additionalContext ? `Additional context/constraints: ${additionalContext}` : ''}

For EACH question, provide:
1. The question text (formatted clearly, VCE exam style)
2. Mark allocation (e.g., 1, 2, 3, 4, 6, 8 marks)
3. Marking criteria / model answer (detailed)
4. Common mistakes students make
5. A study tip for this type of question

Make questions genuinely challenging and exam-realistic. For MCQ, include 4 options and mark the correct answer clearly.

Return as a JSON array.`,
            response_json_schema: {
                type: 'object',
                properties: {
                    questions: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'number' },
                                question: { type: 'string' },
                                type: { type: 'string' },
                                marks: { type: 'number' },
                                options: { type: 'array', items: { type: 'string' } },
                                model_answer: { type: 'string' },
                                marking_criteria: { type: 'string' },
                                common_mistakes: { type: 'string' },
                                study_tip: { type: 'string' }
                            }
                        }
                    }
                }
            }
        });

        setQuestions((response.questions || []).map((q, i) => ({ ...q, id: i })));
        setIsGenerating(false);
        recordStudyAndGetStreak().catch(() => {});
    };

    const handleCopy = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleSaveAsQuiz = async () => {
        if (!questions.length) return;
        const quizQuestions = questions.map(q => ({
            type: q.type?.toLowerCase().includes('multiple') ? 'mcq' : 'short_answer',
            question: q.question,
            options: q.options || [],
            correct_answer: q.options ? 0 : undefined,
            model_answer: q.model_answer,
            marks: q.marks,
            explanation: q.marking_criteria
        }));
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
        <div className="space-y-6 max-w-3xl">
            {isGenerating && <AILoadingProgress stage="generating" message="Creating your exam questions..." estimatedTime={30} />}

            {/* Input Panel */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-4">
                    <h2 className="text-white font-bold text-lg">Generate Exam Questions</h2>
                    <p className="text-white/70 text-sm mt-0.5">Create VCE-style practice questions instantly</p>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700">Subject</label>
                            <Select value={subject} onValueChange={handleSubjectChange}>
                                <SelectTrigger className="bg-gray-50 border-gray-200">
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
                            <label className="text-sm font-semibold text-gray-700">Topic / Unit</label>
                            <Input
                                placeholder="e.g., Cell Respiration, Quadratic Functions"
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                className="bg-gray-50 border-gray-200"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700">Difficulty</label>
                            <Select value={difficulty} onValueChange={setDifficulty}>
                                <SelectTrigger className="bg-gray-50 border-gray-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DIFFICULTY_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700">Question Type</label>
                            <Select value={questionType} onValueChange={setQuestionType}>
                                <SelectTrigger className="bg-gray-50 border-gray-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {QUESTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700">Number of Questions</label>
                            <Select value={numQuestions.toString()} onValueChange={v => setNumQuestions(parseInt(v))}>
                                <SelectTrigger className="bg-gray-50 border-gray-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[3, 5, 8, 10, 15].map(n => <SelectItem key={n} value={n.toString()}>{n} questions</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-700">Additional Context <span className="text-gray-400 font-normal">(optional)</span></label>
                            <Input
                                placeholder="e.g., focus on Unit 3, include graphs"
                                value={additionalContext}
                                onChange={e => setAdditionalContext(e.target.value)}
                                className="bg-gray-50 border-gray-200"
                            />
                        </div>
                    </div>

                    {currentSubjectData?.avg_difficulty_rating && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${
                            currentSubjectData.suggested_quiz_difficulty === 'beginner' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                            currentSubjectData.suggested_quiz_difficulty === 'advanced' ? 'bg-red-50 border-red-200 text-red-700' :
                            'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}>
                            <span>🎯</span>
                            <span>Based on your ratings, difficulty set to <strong>{difficulty}</strong> for {subject}</span>
                        </div>
                    )}

                    <Button
                        onClick={handleGenerate}
                        disabled={isGenerating || !subject || !topic.trim()}
                        className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-lg h-11 text-sm font-semibold"
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
                        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <Target className="w-4 h-4 text-rose-500" />
                                    <span className="text-sm font-semibold text-gray-700">{questions.length} questions</span>
                                </div>
                                <div className="h-4 w-px bg-gray-200" />
                                <span className="text-sm text-gray-500">{totalMarks} total marks</span>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={handleGenerate} className="text-xs h-8">
                                    <RefreshCw className="w-3 h-3 mr-1.5" />Regenerate
                                </Button>
                                <Button size="sm" onClick={handleSaveAsQuiz} className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700">
                                    <Download className="w-3 h-3 mr-1.5" />Save as Quiz
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
                                className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
                            >
                                <button
                                    onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex-shrink-0 w-7 h-7 bg-rose-100 text-rose-700 rounded-lg flex items-center justify-center text-xs font-black mt-0.5">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            {q.marks && (
                                                <Badge className="bg-rose-100 text-rose-700 text-xs font-bold border-0 px-2">
                                                    {q.marks} mark{q.marks !== 1 ? 's' : ''}
                                                </Badge>
                                            )}
                                            {q.type && (
                                                <span className="text-xs text-gray-400">{q.type}</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-800 font-medium leading-relaxed line-clamp-2">{q.question}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={e => { e.stopPropagation(); handleCopy(q.question, q.id); }}
                                            className="p-1.5 text-gray-300 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            {copiedId === q.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                        {expandedQ === q.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {expandedQ === q.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden border-t border-gray-100"
                                        >
                                            <div className="p-4 space-y-3">
                                                {/* Full question */}
                                                <div className="bg-gray-50 rounded-xl p-3">
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Full Question</p>
                                                    <p className="text-sm text-gray-800 leading-relaxed">{q.question}</p>
                                                    {q.options?.length > 0 && (
                                                        <ul className="mt-2 space-y-1">
                                                            {q.options.map((opt, i) => (
                                                                <li key={i} className="text-sm text-gray-700 flex gap-2">
                                                                    <span className="font-bold text-gray-400">{String.fromCharCode(65 + i)}.</span>
                                                                    {opt}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>

                                                {q.model_answer && (
                                                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1.5">Model Answer</p>
                                                        <div className="text-sm text-emerald-900 leading-relaxed prose prose-sm max-w-none prose-emerald">
                                                            <ReactMarkdown>{q.model_answer}</ReactMarkdown>
                                                        </div>
                                                    </div>
                                                )}

                                                {q.marking_criteria && (
                                                    <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                                                        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1.5">Marking Criteria</p>
                                                        <div className="text-sm text-blue-900 leading-relaxed prose prose-sm max-w-none">
                                                            <ReactMarkdown>{q.marking_criteria}</ReactMarkdown>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {q.common_mistakes && (
                                                        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                                                            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Common Mistakes</p>
                                                            <p className="text-xs text-amber-800 leading-relaxed">{q.common_mistakes}</p>
                                                        </div>
                                                    )}
                                                    {q.study_tip && (
                                                        <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                                                            <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">💡 Study Tip</p>
                                                            <p className="text-xs text-purple-800 leading-relaxed">{q.study_tip}</p>
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