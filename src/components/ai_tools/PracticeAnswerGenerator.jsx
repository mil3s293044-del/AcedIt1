import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Copy, Check, BookOpen } from 'lucide-react';
import LoadingQuiz from '@/components/shared/LoadingQuiz';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import MathText from '@/components/shared/LatexRenderer';
import { recordStudyAndGetStreak } from '@/components/shared/streakHelpers';

const MATH_SCIENCE_SUBJECTS = ['Mathematical Methods', 'Specialist Mathematics', 'General Mathematics', 'Further Mathematics', 'Physics', 'Chemistry', 'Biology', 'Psychology'];

const SYSTEM_PROMPT = `You are a VCE exam expert. The student will give you a VCE exam question, its subject, and its mark allocation. Write a complete sample answer that would receive full marks in an official VCE exam. Match the depth, length, and structure to the mark allocation exactly. Then provide a short breakdown explaining the key criteria your answer addresses. Never give a vague or partial answer — always model the best possible exam response. Return your response as a JSON object with exactly two fields. The field 'answer' must contain the complete full-marks sample answer written as a student would write it in a VCE exam. The field 'breakdown' must contain a brief explanation of why the answer would receive full marks. Do not include any text outside the JSON object.`;

export default function PracticeAnswerGenerator() {
    const [userSubjects, setUserSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState('');
    const [question, setQuestion] = useState('');
    const [marks, setMarks] = useState('3');
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState(null);
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const loadSubjects = async () => {
            try {
                const user = await base44.auth.me();
                const subjects = await base44.entities.UserSubject.filter({ created_by: user.email, is_active: true });
                const unique = subjects.reduce((acc, cur) => {
                    if (!acc.find(i => i.subject_name === cur.subject_name)) acc.push(cur);
                    return acc;
                }, []);
                setUserSubjects(unique);
            } catch (e) { console.error(e); }
        };
        loadSubjects();
    }, []);

    const isMathScience = MATH_SCIENCE_SUBJECTS.some(s => selectedSubject?.toLowerCase().includes(s.toLowerCase().split(' ')[0]));

    const handleGenerate = async () => {
        if (!selectedSubject || !question.trim()) {
            toast({ title: 'Missing info', description: 'Select a subject and enter a question.', variant: 'destructive' });
            return;
        }
        setIsGenerating(true);
        setResult(null);
        try {
            const marksNum = parseInt(marks);
            const [answerText, breakdownText] = await Promise.all([
                base44.integrations.Core.InvokeLLM({
                    prompt: `You are a VCE exam expert. Write a complete, full-marks sample answer for the following VCE exam question. The answer must match the exact depth, length, and structure expected for ${marksNum} mark${marksNum > 1 ? 's' : ''} in a ${selectedSubject} exam. Write the answer exactly as a student should write it — no preamble, no commentary, just the answer itself.

Subject: ${selectedSubject}
Marks: ${marksNum}
Question: ${question.trim()}`
                }),
                base44.integrations.Core.InvokeLLM({
                    prompt: `You are a VCE exam expert. A student answered the following VCE exam question worth ${marksNum} mark${marksNum > 1 ? 's' : ''} in ${selectedSubject}. Write a short, clear marking criteria breakdown explaining what a full-marks answer must include and why. Use bullet points. Be specific to the question.

Question: ${question.trim()}`
                })
            ]);
            setResult({ answer: answerText, breakdown: breakdownText });
            await recordStudyAndGetStreak();
        } catch (e) {
            toast({ title: 'Generation failed', description: e.message || 'Something went wrong.', variant: 'destructive' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        if (!result) return;
        navigator.clipboard.writeText(result.answer || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: 'Copied!', description: 'Sample answer copied to clipboard.' });
    };

    const stripMarkdown = (text) => {
        if (!text) return '';
        return text
            .replace(/#{1,6}\s*/g, '')        // remove headings
            .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
            .replace(/\*([^*]+)\*/g, '$1')     // italic
            .replace(/^\s*[-•]\s/gm, '• ')    // normalise bullets
            .trim();
    };

    const renderText = (text) => {
        if (!text) return null;
        if (isMathScience) {
            return (
                <div className="text-slate-700 text-sm leading-relaxed space-y-2">
                    {text.split('\n').filter(Boolean).map((line, i) => (
                        <p key={i}><MathText text={line} /></p>
                    ))}
                </div>
            );
        }
        return (
            <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                {text}
            </div>
        );
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4 px-1">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                    <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Practice Answer Generator</h2>
                    <p className="text-sm text-slate-500">Get a full-marks model answer for any VCE exam question</p>
                </div>
            </div>

            {/* Input Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Subject */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-slate-600">Subject</Label>
                        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                            <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-emerald-400 rounded-xl">
                                <SelectValue placeholder="Choose your subject..." />
                            </SelectTrigger>
                            <SelectContent>
                                {userSubjects.map(s => (
                                    <SelectItem key={s.id} value={s.subject_name}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color || '#10B981' }} />
                                            {s.subject_name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Marks */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-slate-600">Mark Allocation</Label>
                        <Select value={marks} onValueChange={setMarks}>
                            <SelectTrigger className="h-11 border-2 border-slate-200 focus:border-emerald-400 rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 10 }, (_, i) => i + 1).map(m => (
                                    <SelectItem key={m} value={String(m)}>
                                        {m} mark{m > 1 ? 's' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Question */}
                <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-600">Exam Question</Label>
                    <Textarea
                        placeholder="Paste or type your VCE exam question here..."
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        className="min-h-[120px] resize-none border-2 border-slate-200 focus:border-emerald-400 rounded-xl text-base placeholder:text-slate-400 transition-colors"
                    />
                </div>

                <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !selectedSubject || !question.trim()}
                    className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200 gap-2"
                >
                    {isGenerating ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Generating Sample Answer...</>
                    ) : (
                        <><Sparkles className="w-4 h-4" /> Generate Sample Answer</>
                    )}
                </Button>
            </div>

            {/* Loading mini-quiz while the sample answer generates */}
            {isGenerating && <LoadingQuiz />}

            {/* Result Card */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border border-emerald-100 overflow-hidden shadow-sm"
                    >
                        {/* Result header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-white/60 border-b border-emerald-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
                                    <Sparkles className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className="font-semibold text-slate-800 text-sm">Sample Answer — {marks} mark{parseInt(marks) > 1 ? 's' : ''}</span>
                                <span className="text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">{selectedSubject}</span>
                            </div>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 px-3 py-1.5 rounded-lg transition-all"
                            >
                                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>

                        {/* Sample answer */}
                        <div className="px-6 py-5">
                            {result.answer
                                ? renderText(result.answer)
                                : <p className="text-sm text-red-500">Answer could not be generated — please try again.</p>
                            }
                        </div>

                        {/* Divider + Why It Works */}
                        <div className="mx-6 border-t border-emerald-200" />
                        <div className="px-6 py-5">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Why This Answer Works</span>
                            </div>
                            <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                                {stripMarkdown(result.breakdown)}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}