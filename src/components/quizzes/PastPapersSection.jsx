import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    FileText, Upload, Clock, Award, Play, 
    BookOpen, Shield, Loader2, CheckCircle
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PastPaper, PastPaperAttempt, UserSubject, User } from "@/entities/all";
import { useToast } from "@/components/ui/use-toast";
import PastPaperPlayer from "./PastPaperPlayer";

export default function PastPapersSection() {
    const [papers, setPapers] = useState([]);
    const [attempts, setAttempts] = useState([]);
    const [userSubjects, setUserSubjects] = useState([]);
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState("all");
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [activePaper, setActivePaper] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [uploadForm, setUploadForm] = useState({
        title: "",
        subject: "",
        subject_code: "",
        year: new Date().getFullYear(),
        exam_type: "Exam 1",
        time_allowed: 90,
        file: null
    });
    
    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const currentUser = await User.me();
            setUser(currentUser);
            setIsAdmin(currentUser?.role === 'admin');

            const [allPapers, userAttempts, subjects] = await Promise.all([
                PastPaper.filter({ is_published: true }),
                PastPaperAttempt.filter({ created_by: currentUser.email }),
                UserSubject.filter({ created_by: currentUser.email, is_active: true })
            ]);

            // If admin, also get unpublished papers
            if (currentUser?.role === 'admin') {
                const unpublished = await PastPaper.filter({ is_published: false });
                setPapers([...allPapers, ...unpublished]);
            } else {
                setPapers(allPapers || []);
            }

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

        setIsProcessing(true);
        try {
            // Upload the PDF
            const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadForm.file });

            // Extract questions using AI
            const extractionResult = await base44.integrations.Core.InvokeLLM({
                prompt: `You are a VCAA exam parser. Extract all questions from this past paper PDF.

For each question, identify:
1. Question number (e.g., "1a", "2b", "3")
2. The full question text
3. Marks allocated
4. Question type (short_answer, extended_response, mcq, or calculation)
5. For MCQ questions, extract the options (A, B, C, D) and identify the correct answer
6. The marking criteria or expected answer based on VCAA standards

Be thorough and extract EVERY question, including sub-parts.
Maintain the exact wording from the exam.`,
                file_urls: [file_url],
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
                        total_marks: { type: "number" }
                    }
                }
            });

            // Create the past paper
            await PastPaper.create({
                title: uploadForm.title,
                subject: uploadForm.subject,
                subject_code: uploadForm.subject_code,
                year: uploadForm.year,
                exam_type: uploadForm.exam_type,
                time_allowed: uploadForm.time_allowed,
                total_marks: extractionResult.total_marks || extractionResult.questions.reduce((sum, q) => sum + (q.marks || 0), 0),
                source_file_url: file_url,
                questions: extractionResult.questions,
                is_published: false
            });

            toast({ title: "Past paper uploaded!", description: "Review and publish when ready." });
            setShowUploadDialog(false);
            setUploadForm({
                title: "",
                subject: "",
                subject_code: "",
                year: new Date().getFullYear(),
                exam_type: "Exam 1",
                time_allowed: 90,
                file: null
            });
            await loadData();
        } catch (error) {
            console.error("Error processing paper:", error);
            toast({ title: "Error", description: "Failed to process the PDF.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePublishPaper = async (paperId, publish) => {
        try {
            await PastPaper.update(paperId, { is_published: publish });
            toast({ title: publish ? "Paper published!" : "Paper unpublished" });
            await loadData();
        } catch (error) {
            console.error("Error updating paper:", error);
            toast({ title: "Error", description: "Failed to update paper.", variant: "destructive" });
        }
    };

    const filteredPapers = papers.filter(paper => 
        selectedSubject === "all" || paper.subject === selectedSubject
    );

    const getAttemptForPaper = (paperId) => {
        return attempts.find(a => a.paper_id === paperId);
    };

    const subjectNames = [...new Set(papers.map(p => p.subject))];

    if (activePaper) {
        return (
            <PastPaperPlayer 
                paper={activePaper} 
                onComplete={async () => {
                    setActivePaper(null);
                    await loadData();
                }}
                onBack={() => setActivePaper(null)}
            />
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-purple-600" />
                        VCAA Past Papers
                    </h2>
                    <p className="text-gray-600 mt-1">Practice with real exam questions and get AI feedback</p>
                </div>
                {isAdmin && (
                    <Button 
                        onClick={() => setShowUploadDialog(true)}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Past Paper
                    </Button>
                )}
            </div>

            {/* Filter */}
            <div className="flex items-center gap-4">
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by subject" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {subjectNames.map(subject => (
                            <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Badge variant="outline" className="text-gray-600">
                    {filteredPapers.length} paper{filteredPapers.length !== 1 ? 's' : ''} available
                </Badge>
            </div>

            {/* Papers Grid */}
            {filteredPapers.length === 0 ? (
                <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-dashed border-2 border-purple-200">
                    <CardContent className="text-center py-12">
                        <FileText className="w-16 h-16 mx-auto text-purple-300 mb-4" />
                        <h3 className="text-xl font-semibold text-purple-900 mb-2">No Past Papers Yet</h3>
                        <p className="text-purple-700">
                            {isAdmin ? "Upload your first VCAA past paper to get started." : "Check back later for past papers."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence mode="popLayout">
                        {filteredPapers.map((paper, index) => {
                            const attempt = getAttemptForPaper(paper.id);
                            const isCompleted = !!attempt;

                            return (
                                <motion.div
                                    key={paper.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Card className={`overflow-hidden hover:shadow-lg transition-all ${!paper.is_published ? 'border-amber-300 bg-amber-50/50' : ''}`}>
                                        <div className="h-2 bg-gradient-to-r from-purple-500 to-indigo-500" />
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <CardTitle className="text-lg">{paper.title}</CardTitle>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="secondary">{paper.subject}</Badge>
                                                        <Badge variant="outline">{paper.year}</Badge>
                                                    </div>
                                                </div>
                                                {!paper.is_published && (
                                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">Draft</Badge>
                                                )}
                                                {isCompleted && (
                                                    <Badge className="bg-green-100 text-green-700 border-green-200">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Completed
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex items-center gap-4 text-sm text-gray-600">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    {paper.time_allowed} min
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Award className="w-4 h-4" />
                                                    {paper.total_marks} marks
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <BookOpen className="w-4 h-4" />
                                                    {paper.questions?.length || 0} Q
                                                </div>
                                            </div>

                                            {isCompleted && attempt && (
                                                <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-green-700 font-medium">Your Score</span>
                                                        <span className="font-bold text-green-800">
                                                            {attempt.total_marks_awarded}/{attempt.total_marks_possible} ({attempt.percentage}%)
                                                        </span>
                                                    </div>
                                                    {attempt.predicted_study_score && (
                                                        <div className="flex items-center justify-between text-sm mt-1">
                                                            <span className="text-green-700">Predicted Study Score</span>
                                                            <span className="font-bold text-green-800">{attempt.predicted_study_score}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                <Button 
                                                    onClick={() => setActivePaper(paper)}
                                                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600"
                                                >
                                                    <Play className="w-4 h-4 mr-2" />
                                                    {isCompleted ? "Retry" : "Start"}
                                                </Button>
                                                {isAdmin && (
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => handlePublishPaper(paper.id, !paper.is_published)}
                                                    >
                                                        {paper.is_published ? "Unpublish" : "Publish"}
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* Upload Dialog */}
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-purple-600" />
                            Upload VCAA Past Paper
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Paper Title *</Label>
                            <Input
                                value={uploadForm.title}
                                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                                placeholder="e.g., 2023 Biology Exam 1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Subject *</Label>
                                <Select
                                    value={uploadForm.subject}
                                    onValueChange={(value) => {
                                        const subject = userSubjects.find(s => s.subject_name === value);
                                        setUploadForm({
                                            ...uploadForm,
                                            subject: value,
                                            subject_code: subject?.subject_code || ""
                                        });
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {userSubjects.map(subject => (
                                            <SelectItem key={subject.id} value={subject.subject_name}>
                                                {subject.subject_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Year *</Label>
                                <Input
                                    type="number"
                                    value={uploadForm.year}
                                    onChange={(e) => setUploadForm({ ...uploadForm, year: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Exam Type</Label>
                                <Select
                                    value={uploadForm.exam_type}
                                    onValueChange={(value) => setUploadForm({ ...uploadForm, exam_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Exam 1">Exam 1</SelectItem>
                                        <SelectItem value="Exam 2">Exam 2</SelectItem>
                                        <SelectItem value="Exam 3">Exam 3</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Time Allowed (minutes)</Label>
                                <Input
                                    type="number"
                                    value={uploadForm.time_allowed}
                                    onChange={(e) => setUploadForm({ ...uploadForm, time_allowed: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>PDF File *</Label>
                            <Input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] })}
                                className="cursor-pointer"
                            />
                            <p className="text-xs text-gray-500 mt-1">Upload the VCAA past paper PDF</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
                        <Button 
                            onClick={handleFileUpload}
                            disabled={isProcessing}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload & Process
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}