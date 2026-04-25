import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    FileText, Upload, Clock, Award, Play, BookOpen,
    Loader2, CheckCircle, Brain, Sparkles, Trash2, FolderOpen,
    RotateCcw, TrendingUp, ChevronRight
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PastPaper, PastPaperAttempt, UserSubject, User } from "@/entities/all";
import { useToast } from "@/components/ui/use-toast";
import AITestPlayer from "./AITestPlayer";
import AILoadingProgress from "../shared/AILoadingProgress";

export default function AITestMarkerSection() {
    const [tests, setTests] = useState([]);
    const [attempts, setAttempts] = useState([]);
    const [userSubjects, setUserSubjects] = useState([]);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState("all");
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [activeTest, setActiveTest] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showFileOptions, setShowFileOptions] = useState(false);
    const fileInputRef = useRef(null);

    const [uploadForm, setUploadForm] = useState({ title: "", subject: "", subject_code: "", time_allowed: 60, file: null });
    const { toast } = useToast();

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const currentUser = await User.me();
            setUser(currentUser);
            const [userTests, userAttempts, subjects] = await Promise.all([
                PastPaper.filter({ created_by: currentUser.email }),
                PastPaperAttempt.filter({ created_by: currentUser.email }),
                UserSubject.filter({ created_by: currentUser.email, is_active: true })
            ]);
            setTests(userTests || []);
            setAttempts(userAttempts || []);
            setUserSubjects(subjects || []);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async () => {
        if (!uploadForm.file || !uploadForm.title || !uploadForm.subject) {
            toast({ title: "Missing fields", description: "Please fill all required fields.", variant: "destructive" });
            return;
        }
        setShowUploadDialog(false);
        setIsProcessing(true);
        try {
            const uploadResult = await base44.integrations.Core.UploadFile({ file: uploadForm.file });
            if (!uploadResult?.file_url) throw new Error("File upload failed - no URL returned");
            const file_url = uploadResult.file_url;
            const fileExtension = uploadForm.file.name.split('.').pop()?.toLowerCase();
            
            // File types that need text extraction (can't be sent as file_url to LLM)
            const needsTextExtraction = ['docx', 'txt', 'pptx'];
            // File types that can be sent directly to LLM (images + PDF)
            const canSendToLLM = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
            
            let documentContent = '';
            let llmFileUrls = null;
            
            if (needsTextExtraction.includes(fileExtension)) {
                try {
                    const textResult = await base44.functions.invoke('extractDocumentText', { file_url, file_extension: fileExtension });
                    documentContent = textResult.data?.text || '';
                    if (!documentContent) throw new Error('No text extracted from file');
                } catch (err) {
                    console.error('Text extraction error:', err);
                    toast({ title: "Extraction warning", description: "Could not extract text from file. Trying vision AI...", variant: "destructive" });
                    llmFileUrls = [file_url];
                }
            } else if (canSendToLLM.includes(fileExtension)) {
                llmFileUrls = [file_url];
            } else {
                // Unknown type — try text extraction first, fall back to vision
                try {
                    const textResult = await base44.functions.invoke('extractDocumentText', { file_url, file_extension: fileExtension });
                    documentContent = textResult.data?.text || '';
                } catch {
                    llmFileUrls = [file_url];
                }
            }

            const extractionResult = await base44.integrations.Core.InvokeLLM({
                model: "gemini_3_pro",
                prompt: `You are an expert exam paper parser and ${uploadForm.subject} subject matter expert. Extract EVERY question and sub-part from this assessment with COMPLETE accuracy.

SUBJECT: ${uploadForm.subject}
${documentContent ? `\nDOCUMENT CONTENT:\n${documentContent}\n` : ''}

━━━ EXTRACTION RULES ━━━
1. Extract EVERY question and EVERY sub-part as a SEPARATE entry (Q1a, Q1b, Q1c, Q2, Q3a etc. are all separate).
2. Copy question text EXACTLY word-for-word. NEVER truncate, summarise, or paraphrase.
3. Self-contained sub-parts: if a sub-part references a parent context (e.g. "referring to the diagram above"), include that context in the question_text so it makes sense standalone.
4. Marks: read from [3 marks] or (2m) notation. If absent, estimate from question complexity and type.
5. Question types: short_answer, extended_response, mcq, or calculation.
6. MCQ: extract all answer options exactly; record the correct answer index if shown in the document.
7. marking_criteria: Write detailed, subject-accurate marking criteria — list the specific concepts, facts, steps, or reasoning a student must demonstrate for EACH mark. Be thorough — this directly guides AI marking quality.

━━━ MATH/SCIENCE FORMATTING ━━━
• ALL mathematical expressions MUST use LaTeX. NEVER plain-text math.
• Inline math: $expression$ — for variables, numbers in sentences  
• Display block: $$expression$$ — for equations, formulas, expressions on their own line
• Preserve all chemical formulas, units, subscripts/superscripts exactly

━━━ COMPLETENESS CHECK ━━━
Before returning, verify: have you captured EVERY numbered and lettered question and sub-question? Missing any is a critical error.`,
                ...(llmFileUrls ? { file_urls: llmFileUrls } : {}),
                response_json_schema: {
                    type: "object",
                    properties: {
                        questions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    question_number: { type: "string" },
                                    question_text: { type: "string" },
                                    marks: { type: "number" },
                                    question_type: { type: "string", enum: ["short_answer", "extended_response", "mcq", "calculation"] },
                                    mcq_options: { type: "array", items: { type: "string" } },
                                    correct_mcq_answer: { type: "number" },
                                    marking_criteria: { type: "string" }
                                }
                            }
                        },
                        total_marks: { type: "number" },
                        assessment_type: { type: "string" }
                    }
                }
            });

            const questions = extractionResult?.questions;
            if (!questions?.length) throw new Error("No questions could be extracted. Please check the file is a readable exam/test document.");
            const totalMarks = extractionResult.total_marks || questions.reduce((sum, q) => sum + (q.marks || 1), 0);
            await PastPaper.create({
                title: uploadForm.title, subject: uploadForm.subject, subject_code: uploadForm.subject_code,
                year: new Date().getFullYear(), exam_type: extractionResult.assessment_type || "Test",
                time_allowed: uploadForm.time_allowed, total_marks: totalMarks,
                source_file_url: file_url, questions, is_published: true
            });

            toast({ title: "Test uploaded!", description: `${questions.length} questions extracted.` });
            setUploadForm({ title: "", subject: "", subject_code: "", time_allowed: 60, file: null });
            await loadData();
        } catch (error) {
            console.error("Error processing test:", error);
            const msg = error?.message || (typeof error === 'string' ? error : null) || "Failed to process the document. Please try a PDF or image instead.";
            toast({ title: "Upload Error", description: msg, variant: "destructive" });
        } finally {
            setIsProcessing(false);
            setShowFileOptions(false);
        }
    };

    const handleDeleteTest = async (testId) => {
        try {
            await PastPaper.delete(testId);
            toast({ title: "Test deleted" });
            await loadData();
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete test.", variant: "destructive" });
        }
    };

    const filteredTests = tests.filter(t => selectedSubject === "all" || t.subject === selectedSubject);
    const testsBySubject = useMemo(() => {
        const grouped = {};
        filteredTests.forEach(test => {
            const s = test.subject || 'Other';
            if (!grouped[s]) grouped[s] = [];
            grouped[s].push(test);
        });
        return grouped;
    }, [filteredTests]);

    const getLatestAttempt = (testId) => attempts.filter(a => a.paper_id === testId).sort((a, b) => new Date(b.completed_date) - new Date(a.completed_date))[0];
    const getAllAttempts = (testId) => attempts.filter(a => a.paper_id === testId);
    const subjectNames = [...new Set(tests.map(t => t.subject).filter(Boolean))];

    if (activeTest) {
        return (
            <AITestPlayer paper={activeTest}
                onComplete={async () => { setActiveTest(null); await loadData(); }}
                onBack={() => setActiveTest(null)} />
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg animate-pulse">
                        <Brain className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm text-gray-500">Loading your tests...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {isProcessing && <AILoadingProgress stage="analyzing" message="AI is reading your test and extracting every question..." estimatedTime={45} />}

            <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">AI Test Marker</h2>
                        <p className="text-sm text-gray-500 mt-0.5">Upload any test — get full AI marking with solutions</p>
                    </div>
                    <Button onClick={() => setShowUploadDialog(true)}
                        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-md shadow-violet-200/50 rounded-xl flex-shrink-0">
                        <Upload className="w-4 h-4 mr-2" /> Upload Test
                    </Button>
                </div>

                {/* Subject filter */}
                {subjectNames.length > 1 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setSelectedSubject("all")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedSubject === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                            All ({tests.length})
                        </button>
                        {subjectNames.map(s => {
                            const color = userSubjects.find(us => us.subject_name === s)?.color || '#8B5CF6';
                            return (
                                <button key={s} onClick={() => setSelectedSubject(s)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedSubject === s ? "text-white shadow-sm" : "text-gray-600 bg-gray-100 hover:bg-gray-200"}`}
                                    style={selectedSubject === s ? { backgroundColor: color } : {}}>
                                    {s}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Empty state */}
                {filteredTests.length === 0 ? (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-violet-50/30 px-6 py-14 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-violet-200/50">
                                <Brain className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">No tests yet</h3>
                            <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">Upload your first test and the AI will extract every question, then mark your answers with full solutions.</p>
                            <Button onClick={() => setShowUploadDialog(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow-md">
                                <Upload className="w-4 h-4 mr-2" /> Upload Your First Test
                            </Button>

                            {/* Feature pills */}
                            <div className="flex flex-wrap justify-center gap-2 mt-6">
                                {['Model answers', 'Sample responses', 'Personalised tips', 'Mark adjuster'].map(f => (
                                    <span key={f} className="text-xs text-violet-700 bg-violet-100 px-2.5 py-1 rounded-full font-medium">{f}</span>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(testsBySubject).map(([subjectName, subjectTests]) => {
                            const subjectColor = userSubjects.find(s => s.subject_name === subjectName)?.color || '#8B5CF6';
                            return (
                                <div key={subjectName}>
                                    <div className="flex items-center gap-2.5 mb-3">
                                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: subjectColor }} />
                                        <h3 className="font-bold text-gray-900">{subjectName}</h3>
                                        <span className="text-xs text-gray-400">{subjectTests.length} test{subjectTests.length !== 1 ? 's' : ''}</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <AnimatePresence mode="popLayout">
                                            {subjectTests.map((test, index) => {
                                                const latestAttempt = getLatestAttempt(test.id);
                                                const allAttempts = getAllAttempts(test.id);
                                                const isCompleted = !!latestAttempt;
                                                const bestScore = allAttempts.length > 0 ? Math.max(...allAttempts.map(a => a.percentage)) : null;
                                                const latestPct = latestAttempt ? Math.round((latestAttempt.total_marks_awarded / latestAttempt.total_marks_possible) * 100) : null;

                                                return (
                                                    <motion.div key={test.id}
                                                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: index * 0.04 }} layout>
                                                        <div className="group bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col h-full">
                                                            {/* Color accent bar */}
                                                            <div className="h-1 flex-shrink-0" style={{ background: `linear-gradient(90deg, ${subjectColor}, ${subjectColor}99)` }} />

                                                            <div className="p-4 flex flex-col flex-1">
                                                                {/* Title row */}
                                                                <div className="flex items-start justify-between gap-2 mb-3">
                                                                    <h4 className="font-bold text-gray-900 text-sm leading-snug group-hover:text-violet-700 transition-colors line-clamp-2 flex-1">
                                                                        {test.title}
                                                                    </h4>
                                                                    {isCompleted && (
                                                                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                                                                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Meta */}
                                                                <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{test.time_allowed}m</span>
                                                                    <span className="flex items-center gap-1"><Award className="w-3 h-3" />{test.total_marks} marks</span>
                                                                    <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{test.questions?.length || 0} Qs</span>
                                                                </div>

                                                                {/* Score display */}
                                                                {isCompleted && latestAttempt && (
                                                                    <div className="mb-3">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <span className="text-xs text-gray-500">Latest score</span>
                                                                            <span className={`text-sm font-black ${latestPct >= 80 ? 'text-emerald-600' : latestPct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                                                                                {latestPct}%
                                                                            </span>
                                                                        </div>
                                                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                            <div className={`h-full rounded-full transition-all ${latestPct >= 80 ? 'bg-emerald-400' : latestPct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                                                style={{ width: `${latestPct}%` }} />
                                                                        </div>
                                                                        <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
                                                                            <span>{latestAttempt.total_marks_awarded}/{latestAttempt.total_marks_possible} marks</span>
                                                                            {allAttempts.length > 1 && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />Best: {bestScore}%</span>}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Actions */}
                                                                <div className="flex gap-2 mt-auto pt-1">
                                                                    <button onClick={() => setActiveTest(test)}
                                                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95 shadow-sm"
                                                                        style={{ background: `linear-gradient(135deg, ${subjectColor}, ${subjectColor}cc)` }}>
                                                                        {isCompleted ? <><RotateCcw className="w-3.5 h-3.5" />Retry</> : <><Play className="w-3.5 h-3.5" />Start</>}
                                                                    </button>
                                                                    <button onClick={() => handleDeleteTest(test.id)}
                                                                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Upload Dialog */}
                <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-3 text-lg">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
                                    <Brain className="w-5 h-5 text-white" />
                                </div>
                                Upload Test for AI Marking
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 py-1">
                            <div>
                                <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Test Title *</Label>
                                <Input value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                                    placeholder="e.g., Unit 3 SAC 1, Mid-Year Exam" className="h-10 rounded-xl" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Subject *</Label>
                                    <Select value={uploadForm.subject} onValueChange={(value) => {
                                        const sub = userSubjects.find(s => s.subject_name === value);
                                        setUploadForm({ ...uploadForm, subject: value, subject_code: sub?.subject_code || "" });
                                    }}>
                                        <SelectTrigger className="h-10 rounded-xl">
                                            <SelectValue placeholder="Select subject" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {userSubjects.map(s => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Time (minutes) *</Label>
                                    <Input type="number" min="5" max="300" value={uploadForm.time_allowed}
                                        onChange={(e) => setUploadForm({ ...uploadForm, time_allowed: parseInt(e.target.value) || 60 })}
                                        placeholder="60" className="h-10 rounded-xl" />
                                </div>
                            </div>

                            {/* File upload zone */}
                            <div>
                                <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Test Document *</Label>
                                <input ref={fileInputRef} type="file"
                                    accept=".pdf,.txt,.docx,image/*,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    onChange={(e) => { setUploadForm({ ...uploadForm, file: e.target.files?.[0] }); setShowFileOptions(false); }}
                                    className="hidden" />

                                {!uploadForm.file ? (
                                    <button type="button" onClick={() => fileInputRef.current?.click()}
                                        className="w-full h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 hover:bg-violet-50/50 transition-all flex flex-col items-center justify-center gap-2 group">
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-violet-100 flex items-center justify-center transition-colors">
                                            <Upload className="w-5 h-5 text-gray-400 group-hover:text-violet-600 transition-colors" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-semibold text-gray-600 group-hover:text-violet-700 transition-colors">Click to choose file</p>
                                            <p className="text-xs text-gray-400 mt-0.5">PDF, DOCX, TXT, or image</p>
                                        </div>
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-3 p-3 bg-violet-50 border-2 border-violet-200 rounded-xl">
                                        <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <FileText className="w-4 h-4 text-violet-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-violet-900 truncate">{uploadForm.file.name}</p>
                                            <p className="text-xs text-violet-600">{(uploadForm.file.size / 1024).toFixed(0)} KB</p>
                                        </div>
                                        <button type="button" onClick={() => setUploadForm({ ...uploadForm, file: null })}
                                            className="text-xs text-violet-600 hover:text-violet-800 font-semibold">
                                            Change
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* No-math warning */}
                            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                                <span className="text-base flex-shrink-0">⚠️</span>
                                <div className="text-xs text-amber-800 leading-relaxed">
                                    <span className="font-bold">Best for written subjects only. </span>
                                    This tool works best for English, Humanities, Science (theory), and similar subjects. Avoid uploading maths tests — equations and calculations cannot be reliably extracted or marked by AI.
                                </div>
                            </div>

                            {/* How it works */}
                            <div className="flex items-start gap-3 p-3 bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl border border-violet-100">
                                <Sparkles className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-violet-800 leading-relaxed">
                                    <span className="font-bold">How it works: </span>
                                    AI reads every question, then when you complete the test it provides model answers, sample responses, and personalised tips for every question.
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setShowUploadDialog(false)} className="rounded-xl">Cancel</Button>
                            <Button onClick={handleFileUpload}
                                disabled={isProcessing || !uploadForm.title || !uploadForm.subject || !uploadForm.file}
                                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow-md">
                                {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><Upload className="w-4 h-4 mr-2" />Extract & Save</>}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}