import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import { Upload, Wand2, Loader2, Save, Trash2, Eye, FolderOpen, ChevronDown, FileText, X, Zap, RefreshCw, ExternalLink } from 'lucide-react';
import AIFeedbackModal from './AIFeedbackModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import AILoadingProgress from '../shared/AILoadingProgress';
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";

const SUMMARY_TYPES = [
    { value: 'concise', label: '⚡ Concise', desc: 'Key points only' },
    { value: 'detailed', label: '📘 Detailed', desc: 'Comprehensive coverage' },
    { value: 'exam', label: '🎯 Exam-Ready', desc: 'Dot points & definitions' },
    { value: 'mindmap', label: '🗺️ Mind Map Style', desc: 'Hierarchical structure' },
];

export default function NoteSummarizer() {
    const [subject, setSubject] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [summaryType, setSummaryType] = useState('detailed');
    const [result, setResult] = useState('');
    const [topic, setTopic] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [savedResults, setSavedResults] = useState([]);
    const [user, setUser] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [viewingResult, setViewingResult] = useState(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);
    const { toast } = useToast();

    useEffect(() => {
        const init = async () => {
            const currentUser = await base44.auth.me();
            setUser(currentUser);
            const [results, subjects] = await Promise.all([
                base44.entities.AISavedResult.filter({ created_by: currentUser.email, tool_type: 'note_summarizer' }, '-date_created').catch(() => []),
                base44.entities.UserSubject.filter({ created_by: currentUser.email, is_active: true }).catch(() => [])
            ]);
            const unique = subjects.reduce((acc, s) => {
                if (!acc.find(x => x.subject_name === s.subject_name)) acc.push(s);
                return acc;
            }, []);
            setSavedResults(results || []);
            setUserSubjects(unique || []);
        };
        init();
    }, []);

    const allowed = ['application/pdf', 'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'];

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

    const handleSummarize = async () => {
        if (!uploadedFiles.length || !subject) {
            toast({ title: 'Please select a subject and upload at least one file', variant: 'destructive' });
            return;
        }
        setIsGenerating(true);
        setResult('');

        const promptMap = {
            concise: 'Create a CONCISE summary with only the most essential points. Use bullet points. Maximum 1 page.',
            detailed: 'Create a COMPREHENSIVE summary covering all major concepts, definitions, examples, and key arguments. Use clear headings and subheadings.',
            exam: 'Create an EXAM-FOCUSED summary with: Key Definitions, Core Concepts, Important Facts/Formulas, Common Exam Topics, and Quick Reference Points. Format for easy last-minute revision.',
            mindmap: 'Structure as a HIERARCHICAL MIND MAP using markdown. Main topics as ## headings, subtopics as ### headings, details as bullet points. Show relationships between concepts clearly.'
        };

        // Upload all files
        const uploadedUrls = await Promise.all(uploadedFiles.map(f => base44.integrations.Core.UploadFile({ file: f }).then(r => ({ url: r.file_url, name: f.name, ext: f.name.split('.').pop()?.toLowerCase() }))));

        // Extract text from docx/pptx files
        const docxPptxFiles = uploadedUrls.filter(f => f.ext === 'docx' || f.ext === 'pptx');
        const directFiles = uploadedUrls.filter(f => f.ext !== 'docx' && f.ext !== 'pptx');

        let extractedTexts = '';
        for (const f of docxPptxFiles) {
            const textResult = await base44.functions.invoke('extractDocumentText', { file_url: f.url });
            extractedTexts += `\n\n[${f.name}]:\n${textResult.data?.text || ''}`;
        }

        let generatedResult;
        if (directFiles.length > 0 && extractedTexts) {
            // Mixed: some direct files + some extracted
            generatedResult = await base44.integrations.Core.InvokeLLM({
                prompt: `These are ${subject} study materials. Also included is extracted text below.\n${promptMap[summaryType]}\n\nExtracted content:${extractedTexts}`,
                file_urls: directFiles.map(f => f.url)
            });
        } else if (directFiles.length > 0) {
            generatedResult = await base44.integrations.Core.InvokeLLM({
                prompt: `These are ${subject} study materials (${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}). ${promptMap[summaryType]}`,
                file_urls: directFiles.map(f => f.url)
            });
        } else {
            generatedResult = await base44.integrations.Core.InvokeLLM({
                prompt: `Here is content from ${uploadedFiles.length} ${subject} document${uploadedFiles.length > 1 ? 's' : ''}:\n\n${extractedTexts}\n\n${promptMap[summaryType]}`
            });
        }

        setResult(generatedResult);
        setIsGenerating(false);
        setShowResultModal(true);
        recordStudyAndGetStreak().catch(() => {});
    };

    const handleSave = async () => {
        if (!result || !user || !saveTitle.trim()) return;
        await base44.entities.AISavedResult.create({
            tool_type: 'note_summarizer',
            title: saveTitle.trim(),
            subject_name: subject,
            topic,
            content: result,
            input_data: { subject, topic, summaryType },
            date_created: new Date().toISOString().split('T')[0]
        });
        toast({ title: 'Summary saved!' });
        setIsSaveDialogOpen(false);
        setSaveTitle('');
        const results = await base44.entities.AISavedResult.filter({ created_by: user.email, tool_type: 'note_summarizer' }, '-date_created').catch(() => []);
        setSavedResults(results);
    };

    const handleCreateFlashcards = async () => {
        if (!result) return;
        toast({ title: 'Creating flashcards...', description: 'This may take a moment.' });
        const response = await base44.integrations.Core.InvokeLLM({
            prompt: `Based on this ${subject} summary, create 10 flashcards (question/answer pairs):\n\n${result}`,
            response_json_schema: {
                type: 'object',
                properties: {
                    flashcards: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { question: { type: 'string' }, answer: { type: 'string' } }
                        }
                    }
                }
            }
        });
        await Promise.all((response.flashcards || []).map(fc =>
            base44.entities.Flashcard.create({
                subject_name: subject,
                topic: topic || 'From Notes',
                question: fc.question,
                answer: fc.answer,
                unit: 'General'
            })
        ));
        toast({ title: '🎉 Flashcards created!', description: 'Find them in Spaced Repetition.' });
    };

    return (
        <div className="space-y-5 max-w-3xl">
            {isGenerating && <AILoadingProgress stage="generating" message="Summarising your notes..." estimatedTime={30} />}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-5 py-4">
                    <h2 className="text-white font-bold text-lg">Note Summarizer</h2>
                    <p className="text-white/70 text-sm">Upload notes → Get a structured, exam-ready summary instantly</p>
                </div>
                <div className="p-5 space-y-4">
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
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || '#14B8A6' }} />
                                            {s.subject_name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* File Drop Zone */}
                    <div
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                            isDragging ? 'border-teal-400 bg-teal-50' :
                            uploadedFiles.length ? 'border-teal-300 bg-teal-50/30' :
                            'border-gray-200 hover:border-teal-300 hover:bg-teal-50/30'
                        }`}
                    >
                        <input ref={fileInputRef} type="file" className="hidden"
                            accept=".pdf,.txt,.docx,.pptx" multiple
                            onChange={e => handleFiles(e.target.files)} />
                        {uploadedFiles.length === 0 ? (
                            <div>
                                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm font-semibold text-gray-600">Drop files here, or click to browse</p>
                                <p className="text-xs text-gray-400 mt-1">PDF, TXT, DOCX, PPTX — multiple files supported</p>
                            </div>
                        ) : (
                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                {uploadedFiles.map((f, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 shadow-sm border border-teal-100">
                                        <FileText className="w-4 h-4 text-teal-600 flex-shrink-0" />
                                        <div className="flex-1 text-left min-w-0">
                                            <p className="text-xs font-semibold text-gray-800 truncate">{f.name}</p>
                                            <p className="text-xs text-gray-400">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                        <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}
                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                <button onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                    className="text-xs text-teal-600 hover:text-teal-700 font-medium mt-1">+ Add more files</button>
                            </div>
                        )}
                    </div>

                    {/* Summary Type */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Summary Format</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {SUMMARY_TYPES.map(t => (
                                <button key={t.value} onClick={() => setSummaryType(t.value)}
                                    className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                                        summaryType === t.value
                                            ? 'border-teal-500 bg-teal-50'
                                            : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                                    }`}>
                                    <div className="text-xs font-bold text-gray-800">{t.label}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">{t.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button onClick={handleSummarize} disabled={isGenerating || !uploadedFiles.length || !subject}
                        className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 h-11 font-semibold shadow-lg">
                        {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Summarising...</> : <><Wand2 className="w-4 h-4 mr-2" />Generate Summary</>}
                    </Button>
                </div>
            </div>

            {/* Result ready card */}
            <AnimatePresence>
                {result && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl p-4 flex items-center gap-4">
                            <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <span className="text-xl">📄</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{topic}</p>
                                <p className="text-xs text-gray-500">{subject} · Summary ready</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <Button size="sm" variant="outline" onClick={handleCreateFlashcards} className="h-8 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"><Zap className="w-3 h-3 mr-1" />Flashcards</Button>
                                <Button size="sm" onClick={() => setShowResultModal(true)} className="h-8 text-xs bg-teal-600 hover:bg-teal-700">
                                    <ExternalLink className="w-3 h-3 mr-1" />View Summary
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
                badge={SUMMARY_TYPES.find(t => t.value === summaryType)?.label}
                content={result}
                accentColor="teal"
                actions={[
                    { label: 'Flashcards', icon: Zap, onClick: () => { setShowResultModal(false); handleCreateFlashcards(); }, variant: 'outline', className: 'border-purple-200 text-purple-700' },
                    { label: 'Save', icon: Save, onClick: () => { setShowResultModal(false); setSaveTitle(topic); setIsSaveDialogOpen(true); }, className: 'bg-teal-600 hover:bg-teal-700 text-white' },
                ]}
            />

            {/* History */}
            {savedResults.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <button onClick={() => setShowHistory(!showHistory)}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-gray-400" />
                            <span className="font-semibold text-gray-700 text-sm">Saved Summaries</span>
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
                                                <button onClick={() => setViewingResult(r)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"><Eye className="w-3.5 h-3.5" /></button>
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
                    <DialogHeader><DialogTitle>Save Summary</DialogTitle></DialogHeader>
                    <Input value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="Title..." />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!saveTitle.trim()} className="bg-teal-600 hover:bg-teal-700">Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}