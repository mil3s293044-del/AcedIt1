import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { invokeLLMStream } from '@/lib/streamingAI';
import {
    Sparkles, Loader2, Save, Trash2, Eye, FolderOpen, ChevronDown, RefreshCw,
    Send, Square, Edit2, FileText, MessageSquare, Wand2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { moderationPresets } from '@/components/shared/contentModeration';
import MarkdownMath from '@/components/shared/MarkdownMath';
import { getExaminerPrompt } from '@/lib/subjectExaminerPrompts';

const ESSAY_TYPES = [
    { value: 'analytical',    label: 'Analytical' },
    { value: 'argumentative', label: 'Argumentative' },
    { value: 'expository',    label: 'Expository' },
    { value: 'comparative',   label: 'Comparative' },
];

const WORD_COUNTS = ['500', '800', '1000', '1200', '1500', '2000'];

// Quick refinement chips — common changes students ask for
const REFINE_PRESETS = [
    "Strengthen the thesis statement",
    "Add more specific evidence",
    "Make the body paragraphs sharper",
    "Tighten the introduction",
    "Add a stronger conclusion",
    "Make the analysis more sophisticated",
];

const TYPE_DESCRIPTIONS = {
    analytical:    'analytical essay that breaks down and examines the topic',
    argumentative: 'argumentative essay that defends a clear position',
    expository:    'expository essay that explains and informs',
    comparative:   'comparative essay that examines similarities and differences',
};

export default function EssayPlanner() {
    // ─── Setup form ──────────────────────────────────────────────────────────
    const [topic, setTopic] = useState('');
    const [subject, setSubject] = useState('');
    const [sourceText, setSourceText] = useState('');
    const [essayType, setEssayType] = useState('analytical');
    const [wordCount, setWordCount] = useState('1000');
    const [requirements, setRequirements] = useState('');

    // ─── Plan state ──────────────────────────────────────────────────────────
    const [currentPlan, setCurrentPlan] = useState('');
    const [refinements, setRefinements] = useState([]); // [{ instruction, ts }]
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatingMode, setGeneratingMode] = useState(null); // 'initial' | 'refine'
    const [setupCollapsed, setSetupCollapsed] = useState(false);
    const [refineInput, setRefineInput] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const abortRef = useRef(null);
    const planRef = useRef(null);

    // ─── Saved plans ─────────────────────────────────────────────────────────
    const [savedResults, setSavedResults] = useState([]);
    const [user, setUser] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [viewingResult, setViewingResult] = useState(null);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        if (currentPlan) setHasUnsavedChanges(true);
    }, [currentPlan]);

    useEffect(() => {
        const handler = () => {
            if (hasUnsavedChanges && currentPlan) {
                window.dispatchEvent(new CustomEvent('navigation-guard-status', { detail: { hasUnsavedWork: true, onSave: () => { setSaveTitle(topic); setIsSaveDialogOpen(true); } } }));
            }
        };
        window.addEventListener('navigation-guard-check', handler);
        return () => window.removeEventListener('navigation-guard-check', handler);
    }, [hasUnsavedChanges, currentPlan, topic]);

    useEffect(() => {
        const init = async () => {
            const currentUser = await base44.auth.me();
            setUser(currentUser);
            const [results, subjects] = await Promise.all([
                base44.entities.AISavedResult.filter({ created_by: currentUser.email, tool_type: 'essay_planner' }, '-date_created').catch(() => []),
                base44.entities.UserSubject.filter({ created_by: currentUser.email, is_active: true }).catch(() => []),
            ]);
            const unique = subjects.reduce((acc, s) => { if (!acc.find(x => x.subject_name === s.subject_name)) acc.push(s); return acc; }, []);
            setSavedResults(results || []);
            setUserSubjects(unique || []);
        };
        init();
    }, []);

    // Auto-scroll the plan into view when streaming starts
    useEffect(() => {
        if (isGenerating && generatingMode === 'initial' && planRef.current) {
            planRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [isGenerating, generatingMode]);

    // ─── Initial generation ──────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!topic || !subject) {
            toast({ title: 'Need a topic and subject first', variant: 'destructive' });
            return;
        }
        try {
            const mod = await moderationPresets.aiPrompt(`${topic} ${requirements}`);
            if (!mod.isAllowed) {
                toast({ title: 'Content policy violation', variant: 'destructive' });
                return;
            }
        } catch {}

        setIsGenerating(true);
        setGeneratingMode('initial');
        setCurrentPlan('');
        setRefinements([]);
        setSetupCollapsed(true);

        const prompt = `${getExaminerPrompt(subject)}

You are an expert ${subject} essay coach. Create a detailed essay plan for a ${TYPE_DESCRIPTIONS[essayType]}.

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

## Body Paragraphs (provide ${parseInt(wordCount, 10) > 800 ? '3-4' : '2-3'} body paragraphs)
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

Format in clear, structured Markdown. Be specific and actionable.`;

        const controller = new AbortController();
        abortRef.current = controller;
        try {
            await invokeLLMStream(
                { prompt },
                (_delta, soFar) => setCurrentPlan(soFar),
                { signal: controller.signal }
            );
        } catch (err) {
            if (err?.name !== 'AbortError') {
                toast({ title: 'Generation failed', description: err?.message, variant: 'destructive' });
            }
        } finally {
            setIsGenerating(false);
            setGeneratingMode(null);
            abortRef.current = null;
        }
    };

    // ─── Refine an existing plan ─────────────────────────────────────────────
    const handleRefine = async (instructionRaw) => {
        const instruction = (instructionRaw || refineInput).trim();
        if (!instruction || isGenerating || !currentPlan) return;
        try {
            const mod = await moderationPresets.aiPrompt(instruction);
            if (!mod.isAllowed) {
                toast({ title: 'That refinement was blocked', variant: 'destructive' });
                return;
            }
        } catch {}

        const previousPlan = currentPlan;
        setRefineInput('');
        setRefinements(prev => [...prev, { instruction, ts: Date.now() }]);
        setIsGenerating(true);
        setGeneratingMode('refine');
        setCurrentPlan(''); // wipe so streaming replaces it cleanly

        const prompt = `${getExaminerPrompt(subject)}

You are an expert ${subject} essay coach refining a draft essay plan based on student feedback.

Topic: "${topic}"
Subject: ${subject}
Target Word Count: ~${wordCount} words
Essay Type: ${essayType}

CURRENT DRAFT PLAN:
${previousPlan}

STUDENT'S REFINEMENT REQUEST:
"${instruction}"

Apply the refinement faithfully and return the COMPLETE updated essay plan from start to finish in the same Markdown structure. Do not return just the changes — rewrite the whole plan with the refinement applied. Keep what was good, change what the student asked. Be specific and actionable.`;

        const controller = new AbortController();
        abortRef.current = controller;
        try {
            await invokeLLMStream(
                { prompt },
                (_delta, soFar) => setCurrentPlan(soFar),
                { signal: controller.signal }
            );
        } catch (err) {
            if (err?.name === 'AbortError') {
                // Restore previous plan if refinement was stopped before any text arrived
                if (!currentPlan) setCurrentPlan(previousPlan);
            } else {
                toast({ title: 'Refinement failed', description: err?.message, variant: 'destructive' });
                setCurrentPlan(previousPlan);
            }
        } finally {
            setIsGenerating(false);
            setGeneratingMode(null);
            abortRef.current = null;
        }
    };

    const handleStop = () => abortRef.current?.abort();

    const handleStartOver = () => {
        if (currentPlan && hasUnsavedChanges) {
            if (!window.confirm('Discard the current plan and start over?')) return;
        }
        setCurrentPlan('');
        setRefinements([]);
        setSetupCollapsed(false);
        setHasUnsavedChanges(false);
    };

    const handleSave = async () => {
        if (!currentPlan || !user || !saveTitle.trim()) return;
        await base44.entities.AISavedResult.create({
            tool_type: 'essay_planner',
            title: saveTitle.trim(),
            subject_name: subject,
            topic,
            content: currentPlan,
            input_data: { topic, subject, essayType, wordCount, requirements, refinements },
            date_created: new Date().toISOString().split('T')[0],
        });
        toast({ title: 'Essay plan saved!' });
        setIsSaveDialogOpen(false);
        setSaveTitle('');
        setHasUnsavedChanges(false);
        const results = await base44.entities.AISavedResult.filter({ created_by: user.email, tool_type: 'essay_planner' }, '-date_created').catch(() => []);
        setSavedResults(results);
    };

    const loadSaved = (r) => {
        setTopic(r.input_data?.topic || r.topic || '');
        setSubject(r.subject_name || '');
        setEssayType(r.input_data?.essayType || 'analytical');
        setWordCount(r.input_data?.wordCount || '1000');
        setRequirements(r.input_data?.requirements || '');
        setSourceText(r.input_data?.sourceText || '');
        setCurrentPlan(r.content || '');
        setRefinements(r.input_data?.refinements || []);
        setSetupCollapsed(true);
        setShowHistory(false);
        setHasUnsavedChanges(false);
    };

    const showSetup = !setupCollapsed || !currentPlan;

    return (
        <div className="space-y-5">
            {/* ── SETUP PANEL ─────────────────────────────────────────── */}
            <AnimatePresence initial={false}>
                {showSetup && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="card-soft p-5 space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-8 h-8 rounded-lg bg-chart-4/15 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-chart-4" />
                                </div>
                                <p className="font-display font-extrabold text-foreground text-sm">Essay setup</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="stat-label">Source Text <span className="text-muted-foreground/70 font-normal normal-case">(optional)</span></label>
                                <Input placeholder="e.g. The Great Gatsby, Hamlet, 1984…"
                                    value={sourceText} onChange={e => setSourceText(e.target.value)} />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="stat-label">Subject</label>
                                    <Select value={subject} onValueChange={setSubject}>
                                        <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                                        <SelectContent>
                                            {userSubjects.map(s => (
                                                <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="stat-label">Essay topic or question</label>
                                    <Input placeholder="e.g. The impact of industrialisation on society…"
                                        value={topic} onChange={e => setTopic(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="stat-label">Essay type</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {ESSAY_TYPES.map(t => (
                                        <button
                                            key={t.value}
                                            onClick={() => setEssayType(t.value)}
                                            className={`px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-all text-center ${
                                                essayType === t.value
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground bg-surface'
                                            }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="stat-label">Target word count</label>
                                    <Select value={wordCount} onValueChange={setWordCount}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {WORD_COUNTS.map(w => <SelectItem key={w} value={w}>{w} words</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="stat-label">Extra requirements <span className="text-muted-foreground/70 font-normal normal-case">(optional)</span></label>
                                    <Input placeholder="e.g. include 3 sources, compare 2 texts…"
                                        value={requirements} onChange={e => setRequirements(e.target.value)} />
                                </div>
                            </div>

                            {!currentPlan && (
                                isGenerating ? (
                                    <Button onClick={handleStop} variant="destructive" size="lg" className="w-full">
                                        <Square className="w-4 h-4" /> Stop generating
                                    </Button>
                                ) : (
                                    <Button onClick={handleGenerate} disabled={!topic || !subject} size="lg" className="w-full">
                                        <Sparkles className="w-4 h-4" /> Generate plan
                                    </Button>
                                )
                            )}
                            {currentPlan && (
                                <Button variant="outline" onClick={() => setSetupCollapsed(true)} className="w-full">
                                    Done editing setup
                                </Button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Setup summary chip — when collapsed */}
            {setupCollapsed && currentPlan && (
                <button
                    onClick={() => setSetupCollapsed(false)}
                    className="w-full card-soft p-3 flex items-center gap-3 text-left hover:bg-secondary/40 transition-colors"
                >
                    <div className="w-8 h-8 rounded-lg bg-chart-4/15 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-chart-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{topic}</p>
                        <p className="text-xs text-muted-foreground">{subject} · {essayType} · {wordCount} words</p>
                    </div>
                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </button>
            )}

            {/* ── THE PLAN ─────────────────────────────────────────────── */}
            {(currentPlan || isGenerating) && (
                <motion.div
                    ref={planRef}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-soft overflow-hidden"
                >
                    <div className="flex items-center gap-3 px-5 py-3 border-b-2 border-border bg-secondary/30">
                        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                            <Wand2 className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-display font-extrabold text-foreground text-sm leading-tight truncate">
                                {topic || 'Essay plan'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {refinements.length === 0 ? 'Initial draft' : `Refined ${refinements.length}×`}
                                {isGenerating && (
                                    <span className="ml-2 inline-flex items-center gap-1 text-primary font-bold">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        {generatingMode === 'initial' ? 'Drafting…' : 'Refining…'}
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            {isGenerating ? (
                                <Button size="sm" variant="destructive" onClick={handleStop}>
                                    <Square className="w-3.5 h-3.5" /> Stop
                                </Button>
                            ) : (
                                <>
                                    <Button size="sm" variant="outline" disabled={!currentPlan} onClick={handleStartOver}>
                                        <RefreshCw className="w-3.5 h-3.5" /> Start over
                                    </Button>
                                    <Button
                                        size="sm"
                                        disabled={!currentPlan}
                                        onClick={() => { setSaveTitle(topic); setIsSaveDialogOpen(true); }}
                                    >
                                        <Save className="w-3.5 h-3.5" /> Save final
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="px-5 py-5 max-h-[600px] overflow-y-auto bg-surface">
                        {currentPlan ? (
                            <MarkdownMath isStreaming={isGenerating}>{currentPlan}</MarkdownMath>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                Drafting your plan…
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* ── REFINEMENT CHAT ─────────────────────────────────────── */}
            {currentPlan && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-soft overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 border-b-2 border-border bg-secondary/30">
                        <div className="w-8 h-8 rounded-lg bg-chart-3/15 flex items-center justify-center flex-shrink-0">
                            <MessageSquare className="w-4 h-4 text-chart-3" />
                        </div>
                        <div>
                            <p className="font-display font-extrabold text-foreground text-sm leading-tight">Refine the plan</p>
                            <p className="text-xs text-muted-foreground">Tell the AI what to change. It'll rewrite the whole plan.</p>
                        </div>
                    </div>

                    {refinements.length > 0 && (
                        <div className="px-5 pt-3 pb-1 space-y-1.5 max-h-32 overflow-y-auto">
                            {refinements.slice(-6).map((r, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs">
                                    <span className="pill bg-chart-3/15 text-chart-3 flex-shrink-0">v{i + 2}</span>
                                    <span className="text-muted-foreground italic leading-snug">"{r.instruction}"</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="px-5 pt-2 pb-3">
                        <p className="stat-label mb-2">Quick refinements</p>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {REFINE_PRESETS.map(p => (
                                <button
                                    key={p}
                                    onClick={() => handleRefine(p)}
                                    disabled={isGenerating}
                                    className="px-3 py-1.5 rounded-full border-2 border-border bg-surface hover:border-chart-3/40 hover:bg-chart-3/5 text-xs font-bold text-muted-foreground hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <Input
                                value={refineInput}
                                onChange={e => setRefineInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                                placeholder="e.g. Make the third body paragraph stronger"
                                disabled={isGenerating}
                                className="flex-1"
                            />
                            {isGenerating ? (
                                <Button onClick={handleStop} variant="destructive" className="flex-shrink-0 h-10 w-10 p-0">
                                    <Square className="w-4 h-4" />
                                </Button>
                            ) : (
                                <Button onClick={() => handleRefine()} disabled={!refineInput.trim()} className="flex-shrink-0 h-10 w-10 p-0">
                                    <Send className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* ── HISTORY ─────────────────────────────────────────────── */}
            {savedResults.length > 0 && (
                <div className="card-soft overflow-hidden">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-muted-foreground" />
                            <span className="font-bold text-foreground text-sm">Saved essay plans</span>
                            <span className="pill bg-secondary text-muted-foreground">{savedResults.length}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                        {showHistory && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-border">
                                <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                                    {savedResults.map(r => (
                                        <div key={r.id} className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{r.title || r.topic}</p>
                                                <p className="text-xs text-muted-foreground">{r.subject_name} · {r.date_created}</p>
                                            </div>
                                            <div className="flex gap-1 ml-2 flex-shrink-0">
                                                <button onClick={() => setViewingResult(r)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => loadSaved(r)} className="px-2 py-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors text-xs font-bold">Load</button>
                                                <button onClick={() => base44.entities.AISavedResult.delete(r.id).then(() => setSavedResults(prev => prev.filter(x => x.id !== r.id)))} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* ── DIALOGS ─────────────────────────────────────────────── */}
            <Dialog open={!!viewingResult} onOpenChange={() => setViewingResult(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{viewingResult?.title || viewingResult?.topic}</DialogTitle></DialogHeader>
                    <div className="text-sm text-foreground"><MarkdownMath>{viewingResult?.content || ''}</MarkdownMath></div>
                </DialogContent>
            </Dialog>

            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Save this plan</DialogTitle></DialogHeader>
                    <Input value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="Give it a title…" />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!saveTitle.trim()}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
