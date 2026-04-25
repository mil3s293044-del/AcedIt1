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
import { Sparkles, Loader2, Save, Trash2, Eye, FolderOpen, ChevronDown, RefreshCw, ExternalLink } from 'lucide-react';
import AIFeedbackModal from './AIFeedbackModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { moderationPresets } from '@/components/shared/contentModeration';
import AILoadingProgress from '../shared/AILoadingProgress';

const ESSAY_TYPES = [
    { value: 'analytical', label: '🔍 Analytical' },
    { value: 'argumentative', label: '⚖️ Argumentative' },
    { value: 'expository', label: '📖 Expository' },
    { value: 'comparative', label: '🔄 Comparative' },
];

const WORD_COUNTS = ['500', '800', '1000', '1200', '1500', '2000'];

export default function EssayPlanner() {
    const [topic, setTopic] = useState('');
    const [subject, setSubject] = useState('');
    const [sourceText, setSourceText] = useState('');
    const [essayType, setEssayType] = useState('analytical');
    const [wordCount, setWordCount] = useState('1000');
    const [requirements, setRequirements] = useState('');
    const [result, setResult] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [savedResults, setSavedResults] = useState([]);
    const [user, setUser] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [viewingResult, setViewingResult] = useState(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (result) setHasUnsavedChanges(true);
    }, [result]);

    useEffect(() => {
        const handler = () => {
            if (hasUnsavedChanges && result) {
                window.dispatchEvent(new CustomEvent('navigation-guard-status', { detail: { hasUnsavedWork: true, onSave: () => { setSaveTitle(topic); setIsSaveDialogOpen(true); } } }));
            }
        };
        window.addEventListener('navigation-guard-check', handler);
        return () => window.removeEventListener('navigation-guard-check', handler);
    }, [hasUnsavedChanges, result, topic]);

    useEffect(() => {
        const init = async () => {
            const currentUser = await base44.auth.me();
            setUser(currentUser);
            const [results, subjects] = await Promise.all([
                base44.entities.AISavedResult.filter({ created_by: currentUser.email, tool_type: 'essay_planner' }, '-date_created').catch(() => []),
                base44.entities.UserSubject.filter({ created_by: currentUser.email, is_active: true }).catch(() => [])
            ]);
            const unique = subjects.reduce((acc, s) => { if (!acc.find(x => x.subject_name === s.subject_name)) acc.push(s); return acc; }, []);
            setSavedResults(results || []);
            setUserSubjects(unique || []);
        };
        init();
    }, []);

    const handleGenerate = async () => {
        if (!topic || !subject) { toast({ title: 'Please enter a topic and select a subject', variant: 'destructive' }); return; }
        try {
            const mod = await moderationPresets.aiPrompt(`${topic} ${requirements}`);
            if (!mod.isAllowed) { toast({ title: 'Content policy violation', variant: 'destructive' }); return; }
        } catch {}

        setIsGenerating(true);
        const typeDescriptions = {
            analytical: 'analytical essay that breaks down and examines the topic',
            argumentative: 'argumentative essay that defends a clear position',
            expository: 'expository essay that explains and informs',
            comparative: 'comparative essay that examines similarities and differences'
        };

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: `You are an expert ${subject} essay coach. Create a detailed essay plan for a ${typeDescriptions[essayType]}.

Topic: "${topic}"
Subject: ${subject}
Target Word Count: ~${wordCount} words
${sourceText ? `Source Text: "${sourceText}"` : ''}
${requirements ? `Additional requirements: ${requirements}` : ''}

Provide a comprehensive essay plan with:

## Thesis Statement
A sophisticated, arguable thesis (not just "In this essay I will...")

## Introduction Structure
- Hook/opening gambit
- Context/background  
- Thesis placement

## Body Paragraphs (provide ${wordCount > 800 ? '3-4' : '2-3'} body paragraphs)
For each paragraph:
- **Topic Sentence** (idea-focused, links to thesis)
- **Evidence/Examples** (2-3 specific pieces with explanation)
- **Analysis** (what this shows/proves)
- **Link** back to thesis
- Word count allocation

## Conclusion Structure
- Synthesis (not just repetition)
- Broader significance/implications
- Final insight

## Key Vocabulary & Techniques
Subject-specific terms and literary/analytical devices to use

## Common Pitfalls to Avoid
3-4 specific mistakes for this essay type/subject

Format in clear, structured Markdown. Be specific and actionable.`
        });

        setResult(response);
        setIsGenerating(false);
        setShowResultModal(true);
    };

    const handleSave = async () => {
        if (!result || !user || !saveTitle.trim()) return;
        await base44.entities.AISavedResult.create({
            tool_type: 'essay_planner', title: saveTitle.trim(), subject_name: subject, topic,
            content: result, input_data: { topic, subject, essayType, wordCount, requirements },
            date_created: new Date().toISOString().split('T')[0]
        });
        toast({ title: 'Essay plan saved!' });
        setIsSaveDialogOpen(false); setSaveTitle(''); setHasUnsavedChanges(false);
        const results = await base44.entities.AISavedResult.filter({ created_by: user.email, tool_type: 'essay_planner' }, '-date_created').catch(() => []);
        setSavedResults(results);
    };

    return (
        <div className="space-y-5 max-w-3xl">
            {isGenerating && <AILoadingProgress stage="generating" message="Building your essay plan..." estimatedTime={25} />}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-4">
                    <h2 className="text-white font-bold text-lg">Essay Planner</h2>
                    <p className="text-white/70 text-sm">Get a complete, structured essay plan with thesis, evidence & analysis</p>
                </div>
                <div className="p-5 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Source Text <span className="text-gray-400 font-normal">(optional)</span></label>
                        <Input placeholder="e.g. The Great Gatsby, Hamlet, 1984..."
                            value={sourceText} onChange={e => setSourceText(e.target.value)}
                            className="bg-gray-50 border-gray-200 h-10" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Subject</label>
                            <Select value={subject} onValueChange={setSubject}>
                                <SelectTrigger className="bg-gray-50 border-gray-200 h-10">
                                    <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                    {userSubjects.map(s => (
                                        <SelectItem key={s.id} value={s.subject_name}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || '#6366F1' }} />
                                                {s.subject_name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Essay Topic or Question</label>
                            <Input placeholder="e.g., The impact of industrialisation on society..."
                                value={topic} onChange={e => setTopic(e.target.value)}
                                className="bg-gray-50 border-gray-200 h-10" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Essay Type</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {ESSAY_TYPES.map(t => (
                                <button key={t.value} onClick={() => setEssayType(t.value)}
                                    className={`p-2.5 rounded-xl border-2 text-xs font-semibold transition-all text-center ${
                                        essayType === t.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-gray-50'
                                    }`}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Target Word Count</label>
                            <Select value={wordCount} onValueChange={setWordCount}>
                                <SelectTrigger className="bg-gray-50 border-gray-200 h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {WORD_COUNTS.map(w => <SelectItem key={w} value={w}>{w} words</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Extra Requirements <span className="text-gray-400 font-normal">(optional)</span></label>
                            <Input placeholder="e.g., include 3 sources, compare 2 texts..."
                                value={requirements} onChange={e => setRequirements(e.target.value)}
                                className="bg-gray-50 border-gray-200 h-10" />
                        </div>
                    </div>

                    <Button onClick={handleGenerate} disabled={isGenerating || !topic || !subject}
                        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 h-11 font-semibold shadow-lg">
                        {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Planning...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Essay Plan</>}
                    </Button>
                </div>
            </div>

            <AnimatePresence>
                {result && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4 flex items-center gap-4">
                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <span className="text-xl">📝</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{topic}</p>
                                <p className="text-xs text-gray-500">{subject} · {wordCount} words · Essay plan ready</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <Button size="sm" variant="outline" onClick={handleGenerate} className="h-8 text-xs"><RefreshCw className="w-3 h-3 mr-1" />Redo</Button>
                                <Button size="sm" onClick={() => setShowResultModal(true)} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700">
                                    <ExternalLink className="w-3 h-3 mr-1" />View Plan
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AIFeedbackModal
                open={showResultModal}
                onClose={() => setShowResultModal(false)}
                title={topic}
                subject={subject}
                badge={`${essayType} · ${wordCount}w`}
                content={result}
                accentColor="indigo"
                actions={[
                    { label: 'Redo', icon: RefreshCw, onClick: () => { setShowResultModal(false); handleGenerate(); }, variant: 'outline' },
                    { label: 'Save', icon: Save, onClick: () => { setShowResultModal(false); setSaveTitle(topic); setIsSaveDialogOpen(true); }, className: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
                ]}
            />

            {savedResults.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <button onClick={() => setShowHistory(!showHistory)}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-gray-400" />
                            <span className="font-semibold text-gray-700 text-sm">Saved Essay Plans</span>
                            <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">{savedResults.length}</Badge>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                        {showHistory && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-gray-100">
                                <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                                    {savedResults.map(r => (
                                        <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{r.title || r.topic}</p>
                                                <p className="text-xs text-gray-400">{r.subject_name} • {r.date_created}</p>
                                            </div>
                                            <div className="flex gap-1 ml-2">
                                                <button onClick={() => setViewingResult(r)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => { setTopic(r.input_data?.topic || r.topic); setSubject(r.subject_name); setResult(r.content); setShowHistory(false); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs font-bold px-2">Load</button>
                                                <button onClick={() => base44.entities.AISavedResult.delete(r.id).then(() => setSavedResults(prev => prev.filter(x => x.id !== r.id)))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <Dialog open={!!viewingResult} onOpenChange={() => setViewingResult(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{viewingResult?.title || viewingResult?.topic}</DialogTitle></DialogHeader>
                    <div className="prose prose-sm max-w-none"><ReactMarkdown>{viewingResult?.content || ''}</ReactMarkdown></div>
                </DialogContent>
            </Dialog>

            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Save Essay Plan</DialogTitle></DialogHeader>
                    <Input value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="Title..." />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!saveTitle.trim()} className="bg-indigo-600 hover:bg-indigo-700">Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}