import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Sparkles, Lightbulb, Save, Trash2, Eye, History, FolderOpen, ChevronDown, ExternalLink } from "lucide-react";
import AIFeedbackModal from './AIFeedbackModal';
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import ReactMarkdown from 'react-markdown';
import AILoadingProgress from "../shared/AILoadingProgress";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";

const ENGLISH_MENTOR_PROMPT = `You are the "AI English Mentor," a specialist VCE English tutor for the 2024–2027 Study Design (Units 3 & 4). You are a Lead Examiner helping students achieve A+ results.

CRITICAL SECTIONS:
- Section A (Reading & Responding): authorial intent, TEEL/PETAL, sophisticated metalanguage, no plot summary
- Section B (Creating Texts): Four Frameworks (Country, Protest, Personal Journeys, Play), Reflective Commentary, 2026 mentor texts
- Section C (Analysing Argument): What/How/Why, tone shifts, appeals, rhetorical questions, audience positioning
- Essay Planning: nuanced contentions, IDEA-focused topic sentences, A+ synonyms

MARKING: Evaluate based on VCAA 10-point holistic scale. Be precise, use metalanguage, be a Lead Examiner.`;

const SECTIONS = {
    essay_marker: {
        name: "VCAA Essay Marker", icon: "🎓",
        color: "from-rose-600 to-pink-600", light: "bg-rose-50 border-rose-200",
        isMarker: true
    },
    text_response: {
        name: "Section A: Text Response", icon: "📖",
        color: "from-blue-600 to-indigo-600", light: "bg-blue-50 border-blue-200",
        tasks: [
            { id: "contention_crafting", name: "Contention Crafting", prompt: "Analyse student's contention. Is it nuanced? Does it avoid simple agree/disagree? Suggest improvements with sophisticated language." },
            { id: "quote_analysis", name: "Quote Analysis & Evidence", prompt: "Evaluate quote selection and analysis. Do they explain authorial intent? Use metalanguage (symbolism, syntax, juxtaposition)? Suggest A+ level analysis." },
            { id: "paragraph_feedback", name: "Paragraph Feedback (TEEL)", prompt: "Provide detailed TEEL/PETAL paragraph feedback: Topic sentence (idea-focused), Evidence, Explanation (authorial intent), Link." },
            { id: "views_values", name: "Author's Views & Values", prompt: "Guide identification of author's views/values. How is this conveyed through characterisation, symbolism, narrative choices?" }
        ]
    },
    section_b: {
        name: "Section B: Creating Texts", icon: "✍️",
        color: "from-purple-600 to-pink-600", light: "bg-purple-50 border-purple-200",
        tasks: [
            { id: "framework_ideas", name: "Framework of Ideas", prompt: "Help develop creative piece using Frameworks of Ideas (Country, Protest, Personal Journeys, Play). Deepen thematic exploration." },
            { id: "creative_piece", name: "Creative Piece Feedback", prompt: "Evaluate creative writing: thematic depth, literary devices, Framework of Ideas engagement, language sophistication." },
            { id: "reflective_commentary", name: "Reflective Commentary", prompt: "Help write Reflective Commentary. Justify authorial choices using metalanguage. Why these techniques? What effect?" },
            { id: "mentor_text_links", name: "Mentor Text Links", prompt: "Analyse links to 2026 mentor texts. Are thematic connections strong? Do they demonstrate Framework of Ideas understanding?" }
        ]
    },
    section_c: {
        name: "Section C: Analysing Argument", icon: "⚖️",
        color: "from-green-600 to-emerald-600", light: "bg-green-50 border-green-200",
        tasks: [
            { id: "what_how_why", name: "What, How, Why Analysis", prompt: "Teach What (technique), How (effect), Why (purpose) analysis. Elevate metalanguage to A+ standard." },
            { id: "tone_shifts", name: "Tone Shifts & Positioning", prompt: "Identify tone shifts and audience positioning. What is the strategic purpose of each shift?" },
            { id: "persuasive_techniques", name: "Persuasive Techniques", prompt: "Break down persuasive techniques with A+ metalanguage: appeals to authority, rhetorical questions, emotive language, inclusive language." },
            { id: "metalanguage_upgrade", name: "Metalanguage Upgrade", prompt: "Upgrade student's language analysis. Replace generic terms: 'shows' → 'underscores/epitomises', 'makes reader feel' → 'positions audience to'." }
        ]
    }
};

const PLACEHOLDERS = {
    text_response: { contention_crafting: "Write your contention here...", quote_analysis: "Paste quotes and your current analysis...", paragraph_feedback: "Paste your full TEEL/PETAL paragraph...", views_values: "Describe the author's views and your evidence..." },
    section_b: { framework_ideas: "Which Framework are you using? What themes?", creative_piece: "Paste your creative piece...", reflective_commentary: "Describe your authorial choices and techniques...", mentor_text_links: "How does your piece connect to mentor texts?" },
    section_c: { what_how_why: "Paste the persuasive text to analyse...", tone_shifts: "Paste the article...", persuasive_techniques: "Paste the persuasive text...", metalanguage_upgrade: "Paste your current analysis to upgrade..." }
};

export default function EnglishMentor() {
    const [activeSection, setActiveSection] = useState("essay_marker");
    const [selectedTask, setSelectedTask] = useState({});
    const [sectionMode, setSectionMode] = useState({}); // { [sectionKey]: 'question' | 'review' }
    const [userInput, setUserInput] = useState("");
    const [essayTopic, setEssayTopic] = useState("");
    const [essayPrompt, setEssayPrompt] = useState("");
    const [essaySection, setEssaySection] = useState("A");
    const [aiResponse, setAiResponse] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedResults, setSavedResults] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [viewingResult, setViewingResult] = useState(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const loadHistory = async () => {
            const user = await base44.auth.me();
            const results = await base44.entities.AISavedResult.filter({ created_by: user.email, tool_type: 'english_mentor' }, '-date_created').catch(() => []);
            setSavedResults(results || []);
        };
        loadHistory();
    }, []);

    const handleGenerate = async () => {
        const section = SECTIONS[activeSection];
        if (section.isMarker) {
            if (!userInput.trim()) { toast({ title: 'Please paste your essay', variant: 'destructive' }); return; }
        } else {
            const task = selectedTask[activeSection];
            if (!userInput.trim() || !task) { toast({ title: 'Please select a task and provide your work', variant: 'destructive' }); return; }
        }
        setIsGenerating(true); setAiResponse(null);
        try {
            let prompt;
            if (SECTIONS[activeSection].isMarker) {
                prompt = `${ENGLISH_MENTOR_PROMPT}

You are a VCAA Lead Examiner marking a student's VCE English essay for Section ${essaySection}.
${essayTopic ? `Text/Topic: ${essayTopic}` : ''}
${essayPrompt ? `Prompt: ${essayPrompt}` : ''}

Student Essay:
${userInput}

Provide a COMPREHENSIVE, SPECIFIC examiner's report in the following format:

## 🎓 Examiner's Report — Section ${essaySection}

### Overall Mark: [X/10]

---

### Criterion 1: Understanding & Interpretation (Knowledge of text / argument)
**Mark: X/10**
[Specific feedback on how well the student demonstrates understanding. Quote their essay directly. Reference VCAA criteria.]

### Criterion 2: Analysis of Language & Construction
**Mark: X/10**
[Specific feedback on metalanguage use, authorial intent, technique identification with direct quotes from essay]

### Criterion 3: Argument & Contention
**Mark: X/10**
[Assess contention sophistication, paragraph structure (TEEL), topic sentences, linking]

### Criterion 4: Expression & Vocabulary
**Mark: X/10**
[Assess vocabulary range, sentence variety, metalanguage precision, register]

---

### ✅ Key Strengths
- [Specific strength with direct quote from essay]
- [Specific strength]
- [Specific strength]

### ❌ Areas for Improvement
- [Specific weakness with direct quote and how to fix it]
- [Specific weakness]
- [Specific weakness]

### 💡 Examiner's Comments
[2–3 paragraphs of holistic examiner feedback exactly like a real VCAA examiner report — reference the VCAA marking guide, compare to what a 10/10 essay would look like, give specific actionable advice. Be rigorous but constructive.]

### 📈 To Achieve a Higher Score
[3–5 specific, actionable steps this student should take]

Be extremely specific, quote the student's essay directly, and apply the 2024–2027 VCAA Study Design marking criteria rigorously.`;
            } else {
                const task = SECTIONS[activeSection].tasks.find(t => t.id === selectedTask[activeSection]);
                const mode = sectionMode[activeSection];
                const modeContext = mode === 'question'
                    ? "The student has a QUESTION. Answer it directly and thoroughly with expert VCE guidance."
                    : "The student wants you to REVIEW THEIR WORK. Provide detailed, constructive feedback with specific improvements.";
                prompt = `${ENGLISH_MENTOR_PROMPT}

Task: ${task.prompt}

Mode: ${modeContext}

Student's Input: ${userInput}

Provide expert VCE English guidance following the 2024-2027 Study Design. Use sophisticated metalanguage, be specific and actionable. Format in Markdown.`;
            }
            const response = await base44.integrations.Core.InvokeLLM({ prompt });
            setAiResponse(response);
            setShowResultModal(true);
            recordStudyAndGetStreak().catch(() => {});
        } catch { toast({ title: 'Generation failed', variant: 'destructive' }); }
        finally { setIsGenerating(false); }
    };

    const handleSave = async () => {
        if (!aiResponse) return;
        setIsSaving(true);
        try {
            const section = SECTIONS[activeSection];
            const taskName = section.isMarker ? `Essay Mark: ${essayTopic || 'Section ' + essaySection}` : (section.tasks?.find(t => t.id === selectedTask[activeSection])?.name || section.name);
            await base44.entities.AISavedResult.create({
                tool_type: "english_mentor", title: taskName, subject_name: "VCE English",
                topic: section.name, content: aiResponse,
                input_data: { section: activeSection, task: selectedTask[activeSection], userInput, essayTopic, essayPrompt },
                date_created: new Date().toISOString().split('T')[0]
            });
            toast({ title: 'Saved!' });
            const user = await base44.auth.me();
            const results = await base44.entities.AISavedResult.filter({ created_by: user.email, tool_type: 'english_mentor' }, '-date_created').catch(() => []);
            setSavedResults(results || []);
        } finally { setIsSaving(false); }
    };

    const currentSection = SECTIONS[activeSection];
    const sectionKeys = Object.keys(SECTIONS);
    const handleSectionTabChange = (key) => { setActiveSection(key); setAiResponse(null); setUserInput(''); setEssayTopic(''); setEssayPrompt(''); };
    const currentMode = sectionMode[activeSection] || null;

    return (
        <div className="space-y-5 max-w-3xl">
            {isGenerating && <AILoadingProgress stage="generating" message="AI English Mentor is analysing..." estimatedTime={25} />}

            {/* Section Tabs */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-5 py-4">
                    <h2 className="text-white font-bold text-lg">AI English Mentor</h2>
                    <p className="text-white/70 text-sm">VCE English 2024–2027 Study Design Specialist</p>
                </div>

                <div className="flex overflow-x-auto border-b border-gray-100 scrollbar-hide">
                    {sectionKeys.map(key => {
                        const s = SECTIONS[key];
                        const isActive = activeSection === key;
                        const label = key === 'essay_marker' ? 'Essay Marker' : key === 'text_response' ? 'Section A' : key === 'section_b' ? 'Section B' : 'Section C';
                        return (
                            <button key={key} onClick={() => handleSectionTabChange(key)}
                                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                                    isActive ? 'border-indigo-500 text-indigo-700 bg-indigo-50/60' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}>
                                <span>{s.icon}</span>
                                <span className="hidden sm:inline">{label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="p-5 space-y-4">
                    {currentSection.isMarker ? (
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Section</label>
                                <div className="flex gap-2">
                                    {[['A', 'Reading & Responding'], ['B', 'Creating Texts'], ['C', 'Analysing Argument']].map(([val, lbl]) => (
                                        <button key={val} onClick={() => setEssaySection(val)}
                                            className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${essaySection === val ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
                                            {val}: {lbl}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Text / Topic <span className="font-normal text-gray-400">(optional)</span></label>
                                <Input value={essayTopic} onChange={e => setEssayTopic(e.target.value)} placeholder="e.g., The Crucible, To Kill a Mockingbird" className="bg-gray-50 border-gray-200 h-10" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Essay Prompt <span className="font-normal text-gray-400">(optional)</span></label>
                                <Input value={essayPrompt} onChange={e => setEssayPrompt(e.target.value)} placeholder="Enter the essay prompt or question..." className="bg-gray-50 border-gray-200 h-10" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Your Essay</label>
                                <Textarea value={userInput} onChange={e => setUserInput(e.target.value)}
                                    placeholder="Paste your full essay here for VCAA examiner marking..."
                                    rows={10} className="bg-gray-50 border-gray-200 resize-none text-sm" />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Mode selector */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">What would you like to do?</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'question', icon: '💬', label: 'I have a question', desc: 'Ask anything about this section' },
                                        { id: 'review', icon: '📝', label: 'Review my work', desc: 'Get feedback on your writing' },
                                    ].map(mode => (
                                        <button key={mode.id}
                                            onClick={() => { setSectionMode(prev => ({ ...prev, [activeSection]: mode.id })); setSelectedTask(prev => ({ ...prev, [activeSection]: undefined })); setUserInput(''); }}
                                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                                                sectionMode[activeSection] === mode.id
                                                    ? 'border-indigo-500 bg-indigo-50'
                                                    : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                                            }`}>
                                            <div className="text-lg mb-1">{mode.icon}</div>
                                            <div className="text-xs font-bold text-gray-800">{mode.label}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{mode.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {currentMode && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                            {currentMode === 'question' ? 'Topic area' : 'What type of help?'}
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {currentSection.tasks?.map(task => (
                                                <button key={task.id} onClick={() => setSelectedTask(prev => ({ ...prev, [activeSection]: task.id }))}
                                                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                                                        selectedTask[activeSection] === task.id
                                                            ? 'border-indigo-500 bg-indigo-50'
                                                            : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                                                    }`}>
                                                    <span className="text-xs font-semibold text-gray-800">{task.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                            {currentMode === 'question' ? 'Your Question' : 'Your Work'}
                                        </label>
                                        <Textarea value={userInput} onChange={e => setUserInput(e.target.value)}
                                            placeholder={currentMode === 'question'
                                                ? "Type your question here... e.g., How do I write a strong contention for Section A?"
                                                : (PLACEHOLDERS[activeSection]?.[selectedTask[activeSection]] || "Paste your essay, paragraph, or writing here...")}
                                            rows={8} className="bg-gray-50 border-gray-200 resize-none text-sm" />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <Button onClick={handleGenerate} disabled={isGenerating || (currentSection.isMarker ? !userInput.trim() : (!userInput.trim() || !selectedTask[activeSection] || !currentMode))}
                        className={`w-full h-11 font-semibold shadow-lg bg-gradient-to-r ${currentSection.color} hover:opacity-90`}>
                        {isGenerating
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Marking Essay...</>
                            : currentSection.isMarker
                                ? <><Sparkles className="w-4 h-4 mr-2" />Mark My Essay</>
                                : <><Sparkles className="w-4 h-4 mr-2" />Get Expert Feedback</>
                        }
                    </Button>
                </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">VCE English Success Tips</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {[
                        'Avoid plot summary — focus on authorial intent',
                        'Metalanguage: symbolism, juxtaposition, syntax, subtext',
                        'Contention: move beyond "I agree/disagree"',
                        'Section C: always explain What, How, Why'
                    ].map((tip, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-amber-800">
                            <span className="text-amber-500 font-bold mt-0.5 flex-shrink-0">→</span>
                            <span>{tip}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Response ready card */}
            <AnimatePresence>
                {aiResponse && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-4 flex items-center gap-4">
                            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <span className="text-xl">🎓</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900">Expert VCE Feedback</p>
                                <p className="text-xs text-gray-500">{currentSection.name} · Feedback ready</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <Button size="sm" variant="outline" onClick={() => { setAiResponse(null); setUserInput(''); }} className="h-8 text-xs">New</Button>
                                <Button size="sm" onClick={() => setShowResultModal(true)} className="h-8 text-xs bg-purple-600 hover:bg-purple-700">
                                    <ExternalLink className="w-3 h-3 mr-1" />View Feedback
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AIFeedbackModal
                open={showResultModal}
                onClose={() => setShowResultModal(false)}
                title="Expert VCE Feedback"
                subject={currentSection.name}
                badge="VCE English"
                content={aiResponse}
                accentColor="purple"
                actions={[
                    { label: isSaving ? '...' : 'Save', icon: Save, onClick: () => { handleSave(); setShowResultModal(false); }, className: 'bg-green-600 hover:bg-green-700 text-white' },
                ]}
            />

            {/* History */}
            {savedResults.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-gray-400" />
                            <span className="font-semibold text-gray-700 text-sm">Saved Feedback</span>
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
                                                <p className="text-sm font-semibold text-gray-800 truncate">{r.title}</p>
                                                <p className="text-xs text-gray-400">{r.topic} • {r.date_created}</p>
                                            </div>
                                            <div className="flex gap-1 ml-2">
                                                <button onClick={() => setViewingResult(r)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"><Eye className="w-3.5 h-3.5" /></button>
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
                    <DialogHeader><DialogTitle>{viewingResult?.title}</DialogTitle><Badge className="w-fit">{viewingResult?.topic}</Badge></DialogHeader>
                    <div className="prose prose-sm max-w-none"><ReactMarkdown>{viewingResult?.content || ''}</ReactMarkdown></div>
                </DialogContent>
            </Dialog>
        </div>
    );
}