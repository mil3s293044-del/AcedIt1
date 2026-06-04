import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { Loader, Brain, Upload, FileText, Save, FolderOpen, ExternalLink, Eye, Download, Trash2, Calendar, Sparkles, HelpCircle, X } from 'lucide-react';
import LoadingQuiz from '@/components/shared/LoadingQuiz';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ReactMarkdown from 'react-markdown';
import { moderationPresets } from '@/components/shared/contentModeration';

// Helper to count questions in markdown
const countQuestionsInMarkdown = (markdown) => {
    if (!markdown) return 0;
    const matches = markdown.match(/##\sQuestion/g); // Assuming questions are marked with ## Question
    return matches ? matches.length : 0;
};

// Helper to get a short preview of markdown
const getMarkdownPreview = (markdown, numLines = 5) => {
    if (!markdown) return '';
    const lines = markdown.split('\n');
    return lines.slice(0, numLines).join('\n') + (lines.length > numLines ? '\n...' : '');
};

export default function QuestionGenerator() {
    // Existing states
    const [sourceType, setSourceType] = useState('text');
    const [sourceText, setSourceText] = useState('');
    const [sourceFiles, setSourceFiles] = useState([]);
    const [fileNames, setFileNames] = useState([]);
    const [subject, setSubject] = useState('');
    const [topic, setTopic] = useState(''); // Keep topic state for potential future use or loading from input_data
    const [difficulty, setDifficulty] = useState('medium'); // Changed initial state from 'intermediate' to 'medium' as per outline
    const [numQuestions, setNumQuestions] = useState(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState(null); // Will hold markdown string
    const [userSubjects, setUserSubjects] = useState([]);
    const [user, setUser] = useState(null);
    const [savedResults, setSavedResults] = useState([]);
    const [viewingResult, setViewingResult] = useState(null);
    const { toast } = useToast();

    // New states from outline
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                await loadData(currentUser.email);
            } catch (error) {
                console.error("Error initializing:", error);
                toast({
                    title: "Initialization Error",
                    description: "Could not load user data. Please refresh.",
                    variant: "destructive"
                });
            }
        };
        init();
    }, []);

    const loadData = async (userEmail) => {
        try {
            const [results, subjects] = await Promise.all([
                base44.entities.AISavedResult.filter({ created_by: userEmail, tool_type: 'question_generator' }, '-date_created').catch((err) => {
                    console.error("Error loading saved results:", err);
                    return [];
                }),
                base44.entities.UserSubject.filter({ created_by: userEmail, is_active: true }).catch((err) => {
                    console.error("Error loading user subjects:", err);
                    return [];
                })
            ]);
            
            const uniqueSubjects = subjects.reduce((acc, current) => {
                const exists = acc.find(item => item.subject_name === current.subject_name);
                if (!exists) acc.push(current);
                return acc;
            }, []);
            
            setSavedResults(results || []);
            setUserSubjects(uniqueSubjects || []);
        } catch (error) {
            console.error("Error loading data:", error);
            setUserSubjects([]);
            setSavedResults([]);
            toast({
                title: "Data Load Error",
                description: "Could not load your saved questions or subjects. Please try again.",
                variant: "destructive"
            });
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const maxSize = 50 * 1024 * 1024;
        const allowedTypes = ['application/pdf', 'text/plain', 
                             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                             'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
        
        const validFiles = [];
        const validNames = [];

        for (const file of files) {
            if (file.size > maxSize) {
                toast({
                    title: `${file.name} too large`,
                    description: "Please upload files smaller than 50MB.",
                    variant: "destructive"
                });
                continue;
            }

            if (!allowedTypes.includes(file.type)) {
                toast({
                    title: `${file.name} not supported`,
                    description: "Please upload PDF, TXT, DOCX, or PPTX files.",
                    variant: "destructive"
                });
                continue;
            }

            validFiles.push(file);
            validNames.push(file.name);
        }

        if (validFiles.length > 0) {
            setSourceFiles(prev => [...prev, ...validFiles]);
            setFileNames(prev => [...prev, ...validNames]);
        }
    };

    const removeFile = (index) => {
        setSourceFiles(prev => prev.filter((_, i) => i !== index));
        setFileNames(prev => prev.filter((_, i) => i !== index));
    };

    const handleGenerate = async () => {
        if (sourceType === 'text' && !sourceText.trim()) {
            toast({ title: 'Please enter some text.', variant: 'destructive' });
            return;
        }
        if (sourceType === 'file' && sourceFiles.length === 0) {
            toast({ title: 'Please upload at least one file.', variant: 'destructive' });
            return;
        }
        if (!subject) {
            toast({ title: 'Please select a subject.', variant: 'destructive' });
            return;
        }

        if (sourceType === 'text') {
            try {
                const moderationResult = await moderationPresets.aiPrompt(sourceText);
                
                if (!moderationResult.isAllowed) {
                    toast({ 
                        title: "Content Policy Violation", 
                        description: "This action cannot be completed due to a violation of our community guidelines. Please ensure your input is appropriate for an educational environment.",
                        variant: "destructive" 
                    });
                    return;
                }
            } catch (error) {
                console.error("Moderation error:", error);
                toast({ 
                    title: "Security Check Failed", 
                    description: "A security check failed. Please try again or rephrase your input.",
                    variant: "destructive" 
                });
                return;
            }
        }

        setIsGenerating(true);
        setResult(null);

        try {
            let promptContent;
            let file_urls = [];

            if (sourceType === 'file') {
                toast({ title: "Uploading your documents...", description: "This may take a moment." });
                
                let documentTexts = [];
                for (const file of sourceFiles) {
                    const uploadResult = await base44.integrations.Core.UploadFile({ file });
                    const fileExtension = file.name.split('.').pop()?.toLowerCase();
                    
                    if (fileExtension === 'docx' || fileExtension === 'pptx') {
                        const textResult = await base44.functions.invoke('extractDocumentText', { file_url: uploadResult.file_url });
                        documentTexts.push(textResult.data?.text || '');
                    } else {
                        file_urls.push(uploadResult.file_url);
                    }
                }
                
                if (documentTexts.length > 0) {
                    promptContent = `Based on the following ${subject} document content, generate ${numQuestions} practice questions:\n\n${documentTexts.join('\n\n---\n\n')}`;
                } else {
                    promptContent = `Based on the ${sourceFiles.length} provided document${sourceFiles.length > 1 ? 's' : ''} for ${subject}, generate ${numQuestions} practice questions.`;
                }
            } else {
                promptContent = `Based on the following ${subject} text, generate ${numQuestions} practice questions:\n\n---\n${sourceText}\n---`;
            }

            toast({ title: "AI is creating your questions...", description: "This can take up to a minute. Please wait." });
            const response = await base44.integrations.Core.InvokeLLM({
                prompt: `${promptContent}
                
                For each question, provide a detailed answer.
                Format the response as a markdown string. Each question should be a level 2 heading (e.g., "## Question 1: What is...?"), followed by its answer in a new paragraph.`,
                file_urls: file_urls.length > 0 ? file_urls : undefined,
            });

            setResult(response);
        } catch (error) {
            console.error("Error generating questions:", error);
            toast({ title: 'Failed to generate questions.', description: 'The AI could not generate questions. Please try again.', variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleOpenSaveDialog = () => {
        const defaultTitle = sourceType === 'file' && fileNames.length > 0 
            ? fileNames[0].replace(/\.[^/.]+$/, "") 
            : `${subject} Questions`;
        setSaveTitle(defaultTitle);
        setIsSaveDialogOpen(true);
    };

    const handleSave = async () => {
        if (!result || !user || !saveTitle.trim()) {
            toast({ title: 'Missing title or questions.', description: 'Please enter a title and ensure questions are generated.', variant: 'destructive' });
            return;
        }
        
        try {
            const savedResultTopic = sourceType === 'file' && fileNames.length > 0
                ? fileNames.join(', ').replace(/\.[^/.]+$/g, "")
                : "Text Input";

            await base44.entities.AISavedResult.create({
                tool_type: 'question_generator',
                title: saveTitle.trim(),
                subject_name: subject,
                topic: topic || savedResultTopic,
                content: result,
                input_data: { 
                    sourceType, 
                    sourceText, 
                    fileNames, 
                    numQuestions, 
                    subject,
                    topic,
                    difficulty
                },
                date_created: new Date().toISOString().split('T')[0]
            });
            
            toast({ title: 'Practice questions saved!', description: 'You can find them in your saved results below.' });
            setIsSaveDialogOpen(false);
            setSaveTitle('');
            if (user?.email) {
                await loadData(user.email);
            }
        } catch (error) {
            console.error("Error saving result:", error);
            toast({ title: 'Failed to save', description: 'Could not save your questions. Please try again.', variant: "destructive" });
        }
    };

    const handleLoadSaved = (savedResult) => {
        setSourceType(savedResult.input_data?.sourceType || 'text');
        setSourceText(savedResult.input_data?.sourceText || '');
        setFileNames(savedResult.input_data?.fileNames || []);
        setSourceFiles([]);
        setSubject(savedResult.input_data?.subject || savedResult.subject_name);
        setNumQuestions(savedResult.input_data?.numQuestions || 5);
        setTopic(savedResult.input_data?.topic || '');
        setDifficulty(savedResult.input_data?.difficulty || 'medium');
        setResult(savedResult.content);
        setViewingResult(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast({ title: "Loaded!", description: "Question set loaded." });
    };

    const handleDelete = async (resultId) => {
        try {
            await base44.entities.AISavedResult.delete(resultId);
            toast({ title: "Deleted", description: "Question set removed." });
            if (user?.email) {
                await loadData(user.email);
            }
        } catch (error) {
            console.error("Error deleting result:", error);
            toast({ title: "Delete failed", description: "Could not delete the question set. Please try again.", variant: "destructive" });
        }
    };

    const organizedResults = savedResults.reduce((acc, result) => {
        if (!acc[result.subject_name]) {
            acc[result.subject_name] = [];
        }
        acc[result.subject_name].push(result);
        return acc;
    }, {});

    if (userSubjects.length === 0 && !user) {
        return (
            <Card className="max-w-2xl mx-auto shadow-xl">
                <CardContent className="p-8 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Brain className="w-10 h-10 text-orange-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">
                        Loading Subjects...
                    </h2>
                    <Loader className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
                    <p className="text-gray-600 mb-6 leading-relaxed mt-4">
                        Please wait while we load your subjects.
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (userSubjects.length === 0 && user) {
        return (
            <Card className="max-w-2xl mx-auto shadow-xl">
                <CardContent className="p-8 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Brain className="w-10 h-10 text-orange-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">
                        No Subjects Selected
                    </h2>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                        To use the Practice Question Generator, you need to select your subjects first. Head to the Subjects page and add your subjects to "My Subjects".
                    </p>
                    <Button 
                        onClick={() => window.location.href = '/Subjects'}
                        className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg"
                    >
                        Go to Subjects
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-xl border-2 border-orange-100">
                <CardHeader className="bg-gradient-to-br from-orange-50 to-amber-50 border-b">
                    <CardTitle className="flex items-center gap-3 text-2xl"> {/* Updated CardTitle as per outline */}
                        <HelpCircle className="w-8 h-8 p-1.5 rounded-full bg-orange-200 text-orange-700" />
                        <span>Practice Question Generator</span>
                    </CardTitle>
                    <p className="text-gray-600 mt-2">Turn your notes or any text into a set of practice questions to test your knowledge.</p>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Subject</label>
                            <Select value={subject} onValueChange={setSubject}>
                                <SelectTrigger className="border-2">
                                    <SelectValue placeholder="Select your subject" />
                                </SelectTrigger>
                                <SelectContent>
                                    {userSubjects.map((sub) => (
                                        <SelectItem key={sub.id} value={sub.subject_name}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sub.color || '#F97316' }} />
                                                {sub.subject_name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Source Material</label>
                            <Select value={sourceType} onValueChange={setSourceType}>
                                <SelectTrigger className="border-2"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="text">Paste Text</SelectItem>
                                    <SelectItem value="file">Upload Documents</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {sourceType === 'text' ? (
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Your Notes</label>
                            <Textarea
                                placeholder="Paste your notes or any text here..."
                                value={sourceText}
                                onChange={(e) => setSourceText(e.target.value)}
                                className="min-h-36 border-2"
                            />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-gray-700">Upload Documents</label>
                            <div className="flex items-center gap-4">
                                <Button asChild variant="outline" className="border-2">
                                    <label className="cursor-pointer flex items-center gap-2">
                                        <Upload className="w-4 h-4" />
                                        <span>Choose Files</span>
                                        <input 
                                            type="file" 
                                            multiple 
                                            className="hidden" 
                                            onChange={handleFileChange} 
                                            accept=".pdf,.txt,.docx,.pptx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation" 
                                        />
                                    </label>
                                </Button>
                            </div>
                            {fileNames.length > 0 && (
                                <div className="space-y-2">
                                    {fileNames.map((name, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg border border-orange-200">
                                            <span className="text-sm text-gray-700 flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-orange-500" />
                                                {name}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeFile(idx)}
                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-gray-500">Supports: PDF, TXT, DOCX, PPTX (multiple files)</p>
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Number of Questions</label>
                        <Input
                            type="number"
                            value={numQuestions}
                            onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-32 border-2"
                            min="1"
                            max="20"
                        />
                    </div>

                    <Button 
                        onClick={handleGenerate} 
                        disabled={isGenerating}
                        className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg h-12 text-base"
                    >
                        {isGenerating ? (
                            <>
                                <Loader className="w-5 h-5 mr-2 animate-spin" />
                                Generating Questions...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5 mr-2" />
                                Generate Questions
                            </>
                        )}
                    </Button>

                    {isGenerating && <div className="pt-4"><LoadingQuiz /></div>}

                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="pt-6 border-t-2 space-y-4"
                        >
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-900">Your Generated Questions</h3>
                                <Button onClick={handleOpenSaveDialog} variant="outline" size="sm" className="border-2 border-orange-200">
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Questions
                                </Button>
                            </div>
                            <div className="prose prose-gray max-w-none rounded-lg border bg-gray-50/50 p-6">
                                <ReactMarkdown>{result}</ReactMarkdown>
                            </div>
                        </motion.div>
                    )}
                </CardContent>
            </Card>

            {savedResults.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="shadow-xl border-2 border-orange-100 bg-gradient-to-br from-orange-50/30 to-amber-50/30">
                        <CardHeader className="border-b bg-white/50">
                            <CardTitle className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <FolderOpen className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <span className="text-2xl">Saved</span>
                                    <p className="text-sm font-normal text-gray-600 mt-1">
                                        {savedResults.length} question set{savedResults.length !== 1 ? 's' : ''} saved
                                    </p>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <Accordion type="single" collapsible className="space-y-3">
                                {Object.entries(organizedResults).map(([subjectName, results]) => {
                                    const subjectObj = userSubjects.find(s => s.subject_name === subjectName);
                                    return (
                                        <AccordionItem 
                                            key={subjectName} 
                                            value={subjectName}
                                            className="bg-white border-2 border-orange-200 rounded-2xl overflow-hidden shadow-sm"
                                        >
                                            <AccordionTrigger className="hover:no-underline px-6 py-4 hover:bg-orange-50/50">
                                                <div className="flex items-center gap-3 w-full">
                                                    <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: subjectObj?.color || '#F97316' }} />
                                                    <span className="font-bold text-gray-900">{subjectName}</span>
                                                    <Badge variant="secondary" className="ml-auto mr-2 bg-orange-100 text-orange-800">{results.length}</Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="px-6 pb-4">
                                                <div className="space-y-3 pt-3">
                                                    {results.map((result) => {
                                                        const questionCount = countQuestionsInMarkdown(result.content);
                                                        return (
                                                            <motion.div 
                                                                key={result.id}
                                                                initial={{ opacity: 0, x: -20 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-5 border-2 border-orange-100 hover:shadow-md transition-all"
                                                            >
                                                                <div className="flex items-start justify-between mb-4">
                                                                    <div className="flex-1">
                                                                        <h4 className="font-bold text-gray-900 mb-2 text-lg">{result.title || result.topic}</h4> {/* Display user-defined title, fallback to derived topic */}
                                                                        <div className="flex items-center gap-3 text-xs text-gray-600">
                                                                            <span className="flex items-center gap-1">
                                                                                <Calendar className="w-3 h-3" />
                                                                                {result.date_created}
                                                                            </span>
                                                                            <span>•</span>
                                                                            <span className="font-medium">{questionCount} questions</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => setViewingResult(result)}
                                                                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                                                                        >
                                                                            <Eye className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleLoadSaved(result)}
                                                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                                                        >
                                                                            <Download className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleDelete(result.id)}
                                                                            className="text-red-600 hover:text-red-700 hover:bg-red-100"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                {/* Preview */}
                                                                <div className="space-y-2 border-t-2 border-orange-100 pt-3 text-sm">
                                                                    <ReactMarkdown className="prose prose-sm prose-gray max-w-none text-gray-700">
                                                                        {getMarkdownPreview(result.content, 5)}
                                                                    </ReactMarkdown>
                                                                    {countQuestionsInMarkdown(result.content) > 0 && (
                                                                        <p className="text-xs text-gray-500 text-center font-medium pt-2">
                                                                            ... {questionCount} questions total
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    })}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    );
                                })}
                            </Accordion>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* View Dialog */}
            <Dialog open={!!viewingResult} onOpenChange={() => setViewingResult(null)}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">{viewingResult?.title || viewingResult?.topic}</DialogTitle> {/* Display title, fallback to topic */}
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                            <Badge className="bg-orange-100 text-orange-800">{viewingResult?.subject_name}</Badge>
                            <span>•</span>
                            <span>{viewingResult?.date_created}</span>
                            {viewingResult && (
                                <>
                                    <span>•</span>
                                    <span>{countQuestionsInMarkdown(viewingResult.content)} questions</span>
                                </>
                            )}
                        </div>
                    </DialogHeader>
                    <div className="space-y-4 py-4 prose prose-gray max-w-none">
                        {viewingResult && <ReactMarkdown>{viewingResult.content}</ReactMarkdown>}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => handleLoadSaved(viewingResult)} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                            <Download className="w-4 h-4 mr-2" />
                            Load into Editor
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Save Dialog */}
            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save Practice Questions</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium block mb-2">Title</label>
                            <Input
                                value={saveTitle}
                                onChange={(e) => setSaveTitle(e.target.value)}
                                placeholder="Enter a title for these questions"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!saveTitle.trim()}>
                            <Save className="w-4 h-4 mr-2" />
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}