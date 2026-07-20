import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { Loader2, Save, FolderOpen, Trash2, Eye, RefreshCw, Brain, Zap, ChevronDown, ExternalLink, CheckCircle2, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import AIFeedbackModal from './AIFeedbackModal';
import { moderationPresets } from '@/components/shared/contentModeration';
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { getExaminerPrompt, getLatexRules } from "@/lib/subjectExaminerPrompts";
import { invokeLLMStream } from "@/lib/streamingAI";

const DEPTH_OPTIONS = [
    { value: 'quick', label: '⚡ Quick Overview', desc: '~2 min read' },
    { value: 'standard', label: '📘 Standard Explanation', desc: '~5 min read' },
    { value: 'deep', label: '🔬 Deep Dive', desc: '~10 min read' },
    { value: 'exam', label: '🎯 Exam-Focused', desc: 'Key points only' },
];

const STYLE_OPTIONS = [
    { value: 'simple', label: 'Simple & Clear' },
    { value: 'examples', label: 'Example-Heavy' },
    { value: 'visual', label: 'Step-by-Step' },
    { value: 'academic', label: 'Academic/Technical' },
];

export default function ConceptExplainer() {
    const [concept, setConcept] = useState('');
    const [subject, setSubject] = useState('');
    const [depth, setDepth] = useState('standard');
    const [style, setStyle] = useState('simple');
    const [result, setResult] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [savedResults, setSavedResults] = useState([]);
    const [user, setUser] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [viewingResult, setViewingResult] = useState(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const abortRef = useRef(null);
    const { toast } = useToast();

    useEffect(() => {
        const init = async () => {
            const currentUser = await base44.auth.me();
            setUser(currentUser);
            const [results, subjects] = await Promise.all([
                base44.entities.AISavedResult.filter({ created_by: currentUser.email, tool_type: 'concept_explainer' }, '-date_created').catch(() => []),
                base44.entities.UserSubject.filter({ created_by: currentUser.email, is_active: true }).catch(() => [])
            ]);
            const unique = subjects.reduce((acc, s) => {
                if (!acc.find(x => x.subject_name === s.subject_name)) acc.push(s);
                return acc;
            }, []);
            setSavedResults(results || []);
            setUserSubjects(unique || []);
            if (unique.length > 0) setSubject(unique[0].subject_name);
        };
        init();
    }, []);

    const handleGenerate = async () => {
        if (!concept.trim() || !subject) {
            toast({ title: 'Please enter a concept and select a subject', variant: 'destructive' });
            return;
        }
        try {
            const mod = await moderationPresets.aiPrompt(concept);
            if (!mod.isAllowed) { toast({ title: 'Content policy violation', variant: 'destructive' }); return; }
        } catch {}

        setIsGenerating(true);
        setResult('');
        setShowResultModal(true); // open modal up front so streamed text is visible immediately

        const depthMap = {
            quick: 'Give a brief 2-3 paragraph overview covering the core idea only.',
            standard: 'Give a thorough explanation with definitions, key principles, examples, and common misconceptions.',
            deep: 'Give an in-depth, comprehensive explanation covering theory, mechanisms, edge cases, real-world applications, and connections to related concepts.',
            exam: 'Focus ONLY on what a VCE student needs to know for exams. Use dot points. Include key definitions, formulas if applicable, typical exam question types, and common traps.'
        };
        const styleMap = {
            simple: 'Use plain, accessible language. Avoid jargon.',
            examples: 'Include at least 3-4 concrete examples and analogies.',
            visual: 'Structure as numbered steps. Use sub-headings for each stage.',
            academic: 'Use precise technical language appropriate for Year 12 level.'
        };

        const prompt = `${getExaminerPrompt(subject)}

You are an expert ${subject} tutor. Explain the concept: "${concept}".

${depthMap[depth]}
${styleMap[style]}

Structure your response in Markdown with:
- A clear opening definition
- Main explanation broken into logical sections with ## headings
- Key takeaways at the end (use a "## Key Takeaways" section with bullet points)
- If relevant: a "## Common Exam Mistakes" section

Make it genuinely educational and accurate for VCE Year 12 level.`;

        const controller = new AbortController();
        abortRef.current = controller;
        try {
            await invokeLLMStream(
                { prompt },
                (_delta, soFar) => setResult(soFar),
                { signal: controller.signal }
            );
            recordStudyAndGetStreak().catch(() => {});
        } catch (err) {
            if (err?.name !== 'AbortError') {
                toast({ title: 'Generation failed', description: err?.message || 'Unknown error', variant: 'destructive' });
            }
        } finally {
            setIsGenerating(false);
            abortRef.current = null;
        }
    };

    const handleStop = () => {
        abortRef.current?.abort();
    };

    const handleSave = async () => {
        if (!result || !user || !saveTitle.trim()) return;
        await base44.entities.AISavedResult.create({
            tool_type: 'concept_explainer',
            title: saveTitle.trim(),
            subject_name: subject,
            topic: concept,
            content: result,
            input_data: { concept, subject, depth, style },
            date_created: new Date().toISOString().split('T')[0]
        });
        toast({ title: 'Explanation saved!' });
        setIsSaveDialogOpen(false);
        setSaveTitle('');
        const results = await base44.entities.AISavedResult.filter({ created_by: user.email, tool_type: 'concept_explainer' }, '-date_created').catch(() => []);
        setSavedResults(results);
    };

    const handleDelete = async (id) => {
        await base44.entities.AISavedResult.delete(id);
        setSavedResults(prev => prev.filter(r => r.id !== id));
    };

    const handleGenerateQuiz = async () => {
        if (!result) return;
        toast({ title: 'Creating quiz...', description: 'This may take a moment.' });
        const response = await base44.integrations.Core.InvokeLLM({
            prompt: `${getExaminerPrompt(subject)}\n\nBased on this explanation of "${concept}" in ${subject}, create 5 multiple choice questions to test understanding.\n\n${result}`,
            response_json_schema: {
                type: 'object',
                properties: {
                    questions: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                type: { type: 'string' },
                                question: { type: 'string' },
                                options: { type: 'array', items: { type: 'string' } },
                                correct_answer: { type: 'number' },
                                explanation: { type: 'string' }
                            }
                        }
                    }
                }
            }
        });
        await base44.entities.Quiz.create({
            title: `${concept} — Quick Quiz`,
            subject,
            questions: response.questions?.map(q => ({ ...q, type: 'mcq' })) || [],
            difficulty: 'intermediate',
            category: 'subject_content'
        });
        toast({ title: '🎉 Quiz created!', description: 'Find it in your Quizzes page.' });
    };

    return (
        <div className="space-y-5">
            {/* Input Panel */}
            <div className="card-soft overflow-hidden">
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="stat-label">Subject</label>
                            <Select value={subject} onValueChange={setSubject}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                    {userSubjects.map(s => (
                                        <SelectItem key={s.id} value={s.subject_name}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || '#10B981' }} />
                                                {s.subject_name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="stat-label">Concept or Topic</label>
                            <Input
                                placeholder="e.g., The Krebs Cycle, Existentialism..."
                                value={concept}
                                onChange={e => setConcept(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                            />
                        </div>
                    </div>

                    {/* Depth selector */}
                    <div className="space-y-1.5">
                        <label className="stat-label">Explanation Depth</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {DEPTH_OPTIONS.map(d => (
                                <button
                                    key={d.value}
                                    onClick={() => setDepth(d.value)}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                                        depth === d.value
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:border-primary/40 bg-surface'
                                    }`}
                                >
                                    <div className={`text-sm font-bold ${depth === d.value ? 'text-primary' : 'text-foreground'}`}>{d.label}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{d.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Style selector */}
                    <div className="space-y-1.5">
                        <label className="stat-label">Explanation Style</label>
                        <div className="flex gap-2 flex-wrap">
                            {STYLE_OPTIONS.map(s => (
                                <button
                                    key={s.value}
                                    onClick={() => setStyle(s.value)}
                                    className={`px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                                        style === s.value
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                    }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {isGenerating ? (
                        <Button onClick={handleStop} variant="destructive" size="lg" className="w-full">
                            <Square className="w-4 h-4" /> Stop generating
                        </Button>
                    ) : (
                        <Button
                            onClick={handleGenerate}
                            disabled={!concept.trim() || !subject}
                            size="lg"
                            className="w-full"
                        >
                            <Brain className="w-4 h-4" /> Explain This Concept
                        </Button>
                    )}
                </div>
            </div>

            {/* Result ready card */}
            <AnimatePresence>
                {result && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="card-soft border-primary/20 bg-primary/5 p-4 flex items-center gap-4">
                            <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">{concept}</p>
                                <p className="text-xs text-muted-foreground">{subject} · Explanation ready</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <Button size="sm" variant="outline" onClick={handleGenerate}>
                                    <RefreshCw className="w-3.5 h-3.5" /> Redo
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleGenerateQuiz}>
                                    <Zap className="w-3.5 h-3.5" /> Quiz Me
                                </Button>
                                <Button size="sm" onClick={() => setShowResultModal(true)}>
                                    <ExternalLink className="w-3.5 h-3.5" /> View
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AIFeedbackModal
                open={showResultModal}
                onClose={() => setShowResultModal(false)}
                title={concept}
                subject={subject}
                badge={DEPTH_OPTIONS.find(d => d.value === depth)?.label}
                content={result}
                accentColor="emerald"
                actions={[
                    { label: 'Quiz Me', icon: Zap, onClick: () => { setShowResultModal(false); handleGenerateQuiz(); }, variant: 'outline', disabled: isGenerating },
                    { label: 'Save', icon: Save, onClick: () => { setShowResultModal(false); setSaveTitle(concept); setIsSaveDialogOpen(true); }, disabled: isGenerating },
                ]}
            />

            {/* History */}
            {savedResults.length > 0 && (
                <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-muted-foreground/60" />
                            <span className="font-semibold text-muted-foreground text-sm">Saved Explanations</span>
                            <Badge className="bg-secondary text-muted-foreground border-0 text-xs">{savedResults.length}</Badge>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground/60 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                        {showHistory && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-border">
                                <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                                    {savedResults.map(r => (
                                        <div key={r.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{r.title || r.topic}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-muted-foreground/60">{r.subject_name}</span>
                                                    <span className="text-xs text-muted-foreground/40">•</span>
                                                    <span className="text-xs text-muted-foreground/60">{r.date_created}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 ml-2">
                                                <button onClick={() => setViewingResult(r)} className="p-1.5 text-muted-foreground/60 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDelete(r.id)} className="p-1.5 text-muted-foreground/60 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* View Dialog */}
            <Dialog open={!!viewingResult} onOpenChange={() => setViewingResult(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{viewingResult?.title || viewingResult?.topic}</DialogTitle>
                        <Badge className="w-fit">{viewingResult?.subject_name}</Badge>
                    </DialogHeader>
                    <div className="prose prose-sm max-w-none"><MarkdownMath>{viewingResult?.content || ''}</MarkdownMath></div>
                </DialogContent>
            </Dialog>

            {/* Save Dialog */}
            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Save Explanation</DialogTitle></DialogHeader>
                    <Input value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="Title..." />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!saveTitle.trim()} className="bg-emerald-600 hover:bg-emerald-700">Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}