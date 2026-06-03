import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import {
    Upload, Wand2, Loader2, Save, Trash2, Eye, FolderOpen, ChevronDown,
    FileText, X, Zap, Send, Square, Edit2, MessageSquare
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { getExaminerPrompt } from "@/lib/subjectExaminerPrompts";
import { invokeLLMStream } from "@/lib/streamingAI";
import CheatSheetMaker from "./CheatSheetMaker";

const SUMMARY_TYPES = [
    { value: 'concise',  label: 'Concise',         desc: 'Key points only' },
    { value: 'detailed', label: 'Detailed',        desc: 'Comprehensive coverage' },
    { value: 'exam',     label: 'Exam-ready',      desc: 'Dot points + definitions' },
    { value: 'mindmap',  label: 'Mind-map style',  desc: 'Hierarchical structure' },
];

const PROMPT_MAP = {
    concise:  'Create a CONCISE summary with only the most essential points. Use bullet points. Maximum 1 page.',
    detailed: 'Create a COMPREHENSIVE summary covering all major concepts, definitions, examples, and key arguments. Use clear headings and subheadings.',
    exam:     'Create an EXAM-FOCUSED summary with: Key Definitions, Core Concepts, Important Facts/Formulas, Common Exam Topics, and Quick Reference Points. Format for easy last-minute revision.',
    mindmap:  'Structure as a HIERARCHICAL MIND MAP using markdown. Main topics as ## headings, subtopics as ### headings, details as bullet points. Show relationships between concepts clearly.',
};

const REFINE_PRESETS = [
    "Make it shorter",
    "Add more detail",
    "Add definitions for the key terms",
    "Add common exam mistakes",
    "Convert to dot-point format",
    "Highlight the most testable concepts",
];

export default function NoteSummarizer() {
    // ─── Mode ────────────────────────────────────────────────────────────────
    const [mode, setMode] = useState('summary'); // 'summary' | 'cheatsheet'

    // ─── Setup ───────────────────────────────────────────────────────────────
    const [subject, setSubject] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [summaryType, setSummaryType] = useState('detailed');
    const [topic, setTopic] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    // Cache so refinements don't re-extract / re-upload
    const [cachedSourceText, setCachedSourceText] = useState('');
    const [cachedFileUrls, setCachedFileUrls] = useState([]);

    // ─── Summary state ───────────────────────────────────────────────────────
    const [currentSummary, setCurrentSummary] = useState('');
    const [refinements, setRefinements] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatingMode, setGeneratingMode] = useState(null); // 'initial' | 'refine'
    const [setupCollapsed, setSetupCollapsed] = useState(false);
    const [refineInput, setRefineInput] = useState('');
    const abortRef = useRef(null);
    const summaryRef = useRef(null);

    // ─── History ─────────────────────────────────────────────────────────────
    const [savedResults, setSavedResults] = useState([]);
    const [user, setUser] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [viewingResult, setViewingResult] = useState(null);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        const init = async () => {
            const currentUser = await base44.auth.me();
            setUser(currentUser);
            const [results, subjects] = await Promise.all([
                base44.entities.AISavedResult.filter({ created_by: currentUser.email, tool_type: 'note_summarizer' }, '-date_created').catch(() => []),
                base44.entities.UserSubject.filter({ created_by: currentUser.email, is_active: true }).catch(() => []),
            ]);
            const unique = subjects.reduce((acc, s) => { if (!acc.find(x => x.subject_name === s.subject_name)) acc.push(s); return acc; }, []);
            setSavedResults(results || []);
            setUserSubjects(unique || []);
        };
        init();
    }, []);

    useEffect(() => {
        if (isGenerating && generatingMode === 'initial' && summaryRef.current) {
            summaryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [isGenerating, generatingMode]);

    // ─── File handling ───────────────────────────────────────────────────────
    const allowed = [
        'application/pdf',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    const handleFiles = (newFiles) => {
        const valid = Array.from(newFiles).filter(f => {
            if (!allowed.includes(f.type)) {
                toast({ title: `Unsupported: ${f.name}`, description: 'Only PDF, TXT, DOCX, PPTX', variant: 'destructive' });
                return false;
            }
            return true;
        });
        if (valid.length) {
            setUploadedFiles(prev => {
                const names = new Set(prev.map(f => f.name));
                const deduped = valid.filter(f => !names.has(f.name));
                const merged = [...prev, ...deduped];
                if (!topic && merged.length > 0) setTopic(merged[0].name.replace(/\.[^/.]+$/, ''));
                return merged;
            });
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    // ─── Initial summary generation ──────────────────────────────────────────
    const handleSummarize = async () => {
        if (!uploadedFiles.length || !subject) {
            toast({ title: 'Need a subject and at least one file', variant: 'destructive' });
            return;
        }
        setIsGenerating(true);
        setGeneratingMode('initial');
        setCurrentSummary('');
        setRefinements([]);
        setSetupCollapsed(true);

        // Upload all files (gets URLs back)
        const uploadedUrls = await Promise.all(uploadedFiles.map(f =>
            base44.integrations.Core.UploadFile({ file: f }).then(r => ({ url: r.file_url, name: f.name, ext: f.name.split('.').pop()?.toLowerCase() }))
        ));

        // Extract text from docx/pptx (text-pathway only)
        const docxPptxFiles = uploadedUrls.filter(f => f.ext === 'docx' || f.ext === 'pptx');
        const directFiles = uploadedUrls.filter(f => f.ext !== 'docx' && f.ext !== 'pptx');

        let extractedTexts = '';
        for (const f of docxPptxFiles) {
            const textResult = await base44.functions.invoke('extractDocumentText', { file_url: f.url });
            extractedTexts += `\n\n[${f.name}]:\n${textResult.data?.text || ''}`;
        }

        // Cache for refinements
        setCachedSourceText(extractedTexts);
        setCachedFileUrls(directFiles.map(f => f.url));

        const directives = PROMPT_MAP[summaryType];
        let prompt;
        let fileUrls;
        if (directFiles.length > 0 && extractedTexts) {
            prompt = `${getExaminerPrompt(subject)}\n\nThese are ${subject} study materials. Extracted text from some files is included below.\n${directives}\n\nExtracted content:${extractedTexts}`;
            fileUrls = directFiles.map(f => f.url);
        } else if (directFiles.length > 0) {
            prompt = `${getExaminerPrompt(subject)}\n\nThese are ${subject} study materials (${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}). ${directives}`;
            fileUrls = directFiles.map(f => f.url);
        } else {
            prompt = `${getExaminerPrompt(subject)}\n\nHere is content from ${uploadedFiles.length} ${subject} document${uploadedFiles.length > 1 ? 's' : ''}:\n\n${extractedTexts}\n\n${directives}`;
            fileUrls = undefined;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        try {
            await invokeLLMStream(
                { prompt, file_urls: fileUrls },
                (_delta, soFar) => setCurrentSummary(soFar),
                { signal: controller.signal }
            );
            recordStudyAndGetStreak().catch(() => {});
        } catch (err) {
            if (err?.name !== 'AbortError') {
                toast({ title: 'Summarising failed', description: err?.message, variant: 'destructive' });
            }
        } finally {
            setIsGenerating(false);
            setGeneratingMode(null);
            abortRef.current = null;
        }
    };

    // ─── Refine current summary ──────────────────────────────────────────────
    const handleRefine = async (instructionRaw) => {
        const instruction = (instructionRaw || refineInput).trim();
        if (!instruction || isGenerating || !currentSummary) return;

        const previousSummary = currentSummary;
        setRefineInput('');
        setRefinements(prev => [...prev, { instruction, ts: Date.now() }]);
        setIsGenerating(true);
        setGeneratingMode('refine');
        setCurrentSummary(''); // wipe so streaming replaces

        const prompt = `${getExaminerPrompt(subject)}

You are refining an existing study summary based on student feedback.

Subject: ${subject}
Topic: ${topic}
Format: ${summaryType}

CURRENT SUMMARY:
${previousSummary}

${cachedSourceText ? `ORIGINAL SOURCE MATERIAL:\n${cachedSourceText}\n\n` : ''}STUDENT'S REFINEMENT REQUEST:
"${instruction}"

Apply the refinement and return the COMPLETE updated summary from start to finish in the same Markdown format. Do not return just the changes — rewrite the whole summary with the refinement applied. Stay faithful to the original source material${cachedSourceText ? ' (provided above)' : ''}. Keep what worked, change what the student asked.`;

        const controller = new AbortController();
        abortRef.current = controller;
        try {
            await invokeLLMStream(
                { prompt, file_urls: cachedFileUrls?.length ? cachedFileUrls : undefined },
                (_delta, soFar) => setCurrentSummary(soFar),
                { signal: controller.signal }
            );
        } catch (err) {
            if (err?.name === 'AbortError') {
                if (!currentSummary) setCurrentSummary(previousSummary);
            } else {
                toast({ title: 'Refinement failed', description: err?.message, variant: 'destructive' });
                setCurrentSummary(previousSummary);
            }
        } finally {
            setIsGenerating(false);
            setGeneratingMode(null);
            abortRef.current = null;
        }
    };

    const handleStop = () => abortRef.current?.abort();

    const handleStartOver = () => {
        if (currentSummary && !window.confirm('Discard the current summary and start over?')) return;
        setCurrentSummary('');
        setRefinements([]);
        setSetupCollapsed(false);
        setUploadedFiles([]);
        setCachedSourceText('');
        setCachedFileUrls([]);
    };

    const handleSave = async () => {
        if (!currentSummary || !user || !saveTitle.trim()) return;
        await base44.entities.AISavedResult.create({
            tool_type: 'note_summarizer',
            title: saveTitle.trim(),
            subject_name: subject,
            topic,
            content: currentSummary,
            input_data: { subject, topic, summaryType, refinements },
            date_created: new Date().toISOString().split('T')[0],
        });
        toast({ title: 'Summary saved!' });
        setIsSaveDialogOpen(false);
        setSaveTitle('');
        const results = await base44.entities.AISavedResult.filter({ created_by: user.email, tool_type: 'note_summarizer' }, '-date_created').catch(() => []);
        setSavedResults(results);
    };

    const handleCreateFlashcards = async () => {
        if (!currentSummary) return;
        toast({ title: 'Creating flashcards…', description: 'This may take a moment.' });
        const response = await base44.integrations.Core.InvokeLLM({
            prompt: `${getExaminerPrompt(subject)}\n\nBased on this ${subject} summary, create 10 flashcards (question/answer pairs):\n\n${currentSummary}`,
            response_json_schema: {
                type: 'object',
                properties: {
                    flashcards: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { question: { type: 'string' }, answer: { type: 'string' } },
                        },
                    },
                },
            },
        });
        await Promise.all((response.flashcards || []).map(fc =>
            base44.entities.Flashcard.create({
                subject_name: subject,
                topic: topic || 'From Notes',
                question: fc.question,
                answer: fc.answer,
                unit: 'General',
            })
        ));
        toast({ title: 'Flashcards created!', description: 'Find them in Spaced Repetition.' });
    };

    const showSetup = !setupCollapsed || !currentSummary;

    return (
        <div className="space-y-5">
            {/* ── MODE TOGGLE ─────────────────────────────────────────── */}
            <div className="inline-flex p-1 rounded-xl bg-secondary gap-1">
                <button
                    onClick={() => setMode('summary')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'summary' ? 'bg-surface text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    Summary
                </button>
                <button
                    onClick={() => setMode('cheatsheet')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'cheatsheet' ? 'bg-surface text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    Cheat Sheet
                </button>
            </div>

            {mode === 'cheatsheet' && <CheatSheetMaker />}

            {mode === 'summary' && (
            <>
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
                                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-primary" />
                                </div>
                                <p className="font-display font-extrabold text-foreground text-sm">Note summary setup</p>
                            </div>

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

                            {/* Drop zone */}
                            <div
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                                    isDragging ? 'border-primary bg-primary/5' :
                                    uploadedFiles.length ? 'border-primary/40 bg-primary/5' :
                                    'border-border hover:border-primary/40 hover:bg-primary/5'
                                }`}
                            >
                                <input ref={fileInputRef} type="file" className="hidden"
                                    accept=".pdf,.txt,.docx,.pptx" multiple
                                    onChange={e => handleFiles(e.target.files)} />
                                {uploadedFiles.length === 0 ? (
                                    <div>
                                        <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                                        <p className="text-sm font-bold text-foreground">Drop files here, or click to browse</p>
                                        <p className="text-xs text-muted-foreground mt-1">PDF, TXT, DOCX, PPTX — multiple files supported</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                        {uploadedFiles.map((f, i) => (
                                            <div key={i} className="flex items-center gap-3 bg-surface rounded-xl px-3 py-2 border border-primary/20">
                                                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                                                <div className="flex-1 text-left min-w-0">
                                                    <p className="text-xs font-bold text-foreground truncate">{f.name}</p>
                                                    <p className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                                </div>
                                                <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}
                                                    className="p-1 text-muted-foreground hover:text-streak hover:bg-streak/10 rounded-lg transition-colors flex-shrink-0">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                            className="text-xs text-primary hover:underline font-bold mt-1"
                                        >
                                            + Add more files
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Format */}
                            <div className="space-y-1.5">
                                <label className="stat-label">Summary format</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {SUMMARY_TYPES.map(t => (
                                        <button
                                            key={t.value}
                                            onClick={() => setSummaryType(t.value)}
                                            className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                                                summaryType === t.value
                                                    ? 'border-primary bg-primary/10'
                                                    : 'border-border hover:border-primary/40 bg-surface'
                                            }`}
                                        >
                                            <div className={`text-xs font-bold ${summaryType === t.value ? 'text-primary' : 'text-foreground'}`}>{t.label}</div>
                                            <div className="text-xs text-muted-foreground/70 mt-0.5">{t.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {!currentSummary && (
                                isGenerating ? (
                                    <Button onClick={handleStop} variant="destructive" size="lg" className="w-full">
                                        <Square className="w-4 h-4" /> Stop generating
                                    </Button>
                                ) : (
                                    <Button onClick={handleSummarize} disabled={!uploadedFiles.length || !subject} size="lg" className="w-full">
                                        <Wand2 className="w-4 h-4" /> Generate summary
                                    </Button>
                                )
                            )}
                            {currentSummary && (
                                <Button variant="outline" onClick={() => setSetupCollapsed(true)} className="w-full">
                                    Done editing setup
                                </Button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Setup chip when collapsed */}
            {setupCollapsed && currentSummary && (
                <button
                    onClick={() => setSetupCollapsed(false)}
                    className="w-full card-soft p-3 flex items-center gap-3 text-left hover:bg-secondary/40 transition-colors"
                >
                    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{topic || 'Notes'}</p>
                        <p className="text-xs text-muted-foreground">{subject} · {SUMMARY_TYPES.find(t => t.value === summaryType)?.label} · {uploadedFiles.length} file{uploadedFiles.length === 1 ? '' : 's'}</p>
                    </div>
                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </button>
            )}

            {/* ── THE SUMMARY ─────────────────────────────────────────── */}
            {(currentSummary || isGenerating) && (
                <motion.div
                    ref={summaryRef}
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
                                {topic || 'Summary'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {refinements.length === 0 ? 'Initial summary' : `Refined ${refinements.length}×`}
                                {isGenerating && (
                                    <span className="ml-2 inline-flex items-center gap-1 text-primary font-bold">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        {generatingMode === 'initial' ? 'Summarising…' : 'Refining…'}
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
                                    <Button size="sm" variant="outline" disabled={!currentSummary} onClick={handleCreateFlashcards}>
                                        <Zap className="w-3.5 h-3.5" /> Flashcards
                                    </Button>
                                    <Button size="sm" variant="outline" disabled={!currentSummary} onClick={handleStartOver}>
                                        Start over
                                    </Button>
                                    <Button
                                        size="sm"
                                        disabled={!currentSummary}
                                        onClick={() => { setSaveTitle(topic); setIsSaveDialogOpen(true); }}
                                    >
                                        <Save className="w-3.5 h-3.5" /> Save
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="px-5 py-5 max-h-[600px] overflow-y-auto bg-surface">
                        {currentSummary ? (
                            <MarkdownMath isStreaming={isGenerating}>{currentSummary}</MarkdownMath>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                Reading your notes…
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* ── REFINEMENT CHAT ─────────────────────────────────────── */}
            {currentSummary && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-soft overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 border-b-2 border-border bg-secondary/30">
                        <div className="w-8 h-8 rounded-lg bg-chart-3/15 flex items-center justify-center flex-shrink-0">
                            <MessageSquare className="w-4 h-4 text-chart-3" />
                        </div>
                        <div>
                            <p className="font-display font-extrabold text-foreground text-sm leading-tight">Refine the summary</p>
                            <p className="text-xs text-muted-foreground">Ask the AI to add, remove, or change anything.</p>
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
                                placeholder="e.g. Expand the section on photosynthesis"
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
                            <span className="font-bold text-foreground text-sm">Saved summaries</span>
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
                                                <p className="text-sm font-bold text-foreground truncate">{r.title || r.topic}</p>
                                                <p className="text-xs text-muted-foreground">{r.subject_name} · {r.date_created}</p>
                                            </div>
                                            <div className="flex gap-1 ml-2 flex-shrink-0">
                                                <button onClick={() => setViewingResult(r)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => base44.entities.AISavedResult.delete(r.id).then(() => setSavedResults(prev => prev.filter(x => x.id !== r.id)))} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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
                    <div className="text-sm text-foreground"><MarkdownMath>{viewingResult?.content || ''}</MarkdownMath></div>
                </DialogContent>
            </Dialog>

            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Save this summary</DialogTitle></DialogHeader>
                    <Input value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="Title…" />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!saveTitle.trim()}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            </>
            )}
        </div>
    );
}
