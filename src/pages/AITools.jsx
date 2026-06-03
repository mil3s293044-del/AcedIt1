import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Sparkles, Search, ChevronRight, Clock, Zap, X,
    Sigma, PenTool, Target, GraduationCap, Lightbulb,
    ClipboardList, FileText, Brain, Copy, Check, LayoutGrid, Eye, EyeOff,
    Maximize2, Minimize2
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';

import EssayPlanner from '../components/ai_tools/EssayPlanner';
import ConceptExplainer from '../components/ai_tools/ConceptExplainer';
import NoteSummarizer from '../components/ai_tools/NoteSummarizer';
import LineMemoriser from '../components/ai_tools/LineMemoriser';
import TeachingAssistant from '../components/ai_tools/TeachingAssistant';
import EnglishMentor from '../components/ai_tools/EnglishMentor';
import MathTutor from '../components/ai_tools/MathTutor';
import ExamQuestionGenerator from '../components/ai_tools/ExamQuestionGenerator';
import HelpButton from '@/components/shared/HelpButton';
import RequirePremium from '@/components/shared/RequirePremium';
import TierUsagePill from '@/components/shared/TierUsagePill';
import { FEATURES } from '@/lib/tierAccess';

// Each tool gets a single accent token from the design system. No more
// rainbow gradients — calmer to scan, fits the new visual language. Tones
// rotate through the four "feature" colors (primary green, xp orange,
// chart-3 blue, chart-4 purple) for variety without chaos.
const tools = [
  {
    id: 'math_tutor',
    name: 'Math AI Tutor',
    description: 'Step-by-step solutions for VCE Methods, Specialist & General Math with exam-standard working.',
    icon: Sigma,
    component: MathTutor,
    accent: 'chart-4',
    category: 'math',
    badge: 'Popular',
    feature: 'ai_chat', // conversational — uses the chat message bucket, not the one-shot tools bucket
    tips: [
      'Snap a photo of the question — the AI reads handwriting, diagrams, and printed problems.',
      'Tell it whether you want CAS or tech-free working before asking.',
      'Ask follow-ups like "show me a similar question" or "explain step 3 differently".',
      'Best results come from one question at a time — not a whole problem set at once.',
    ],
    examples: [
      'Differentiate y = (3x² + 2)⁵ using the chain rule',
      'Find the area between y = x² and y = 4 from x = -2 to x = 2',
      'Solve log₂(x + 3) - log₂(x - 1) = 2',
    ],
  },
  {
    id: 'english_mentor',
    name: 'AI English Mentor',
    description: 'VCE English expert for essay planning, TEEL structure, metalanguage & SAC preparation.',
    icon: PenTool,
    component: EnglishMentor,
    accent: 'chart-3',
    category: 'english',
    badge: 'VCE Aligned',
    tips: [
      'Use the Essay Marker tab for an A+/A/B-band style score with a Lead Examiner breakdown.',
      'For Section A, paste a paragraph for TEEL feedback — not the whole essay.',
      'Section C analysis works best when you paste both the article and your draft.',
      'Ask for "metalanguage upgrades" if your vocabulary feels generic.',
    ],
    examples: [
      'How do I write a sophisticated contention for The Crucible?',
      'Upgrade the metalanguage in this paragraph: "The author shows that..."',
      'Mark this Section C analysis using VCAA criteria',
    ],
  },
  {
    id: 'exam_question_gen',
    name: 'Exam Question Generator',
    description: 'Generate custom VCE-style exam questions with marking criteria for any subject and topic.',
    icon: Target,
    component: ExamQuestionGenerator,
    accent: 'streak',
    category: 'study',
    badge: 'New',
    tips: [
      'Difficulty auto-adjusts based on your past quiz ratings — you can override it.',
      'Mix question types (MCQ + short answer) to mirror the real exam paper.',
      'Provide a specific topic (e.g. "Cell Respiration — ATP synthesis") for sharper questions.',
      'Use "Additional Context" to focus on a specific unit, sub-topic, or skill.',
    ],
    examples: [
      'Biology Unit 3: Photosynthesis & cellular respiration — 5 questions',
      'Methods Unit 4: Calculus applications — extended response, hard',
      'Chemistry Unit 4: Acids, bases, and equilibrium',
    ],
  },
  {
    id: 'teaching_assistant',
    name: 'Teaching Assistant',
    description: 'Learn deeply by teaching concepts to AI — get questioned, challenged, and guided.',
    icon: GraduationCap,
    component: TeachingAssistant,
    accent: 'xp',
    category: 'study',
    badge: null,
    feature: 'ai_chat', // conversational — uses the chat message bucket, not the one-shot tools bucket
    tips: [
      'Best for active recall — try teaching what you just studied without notes.',
      'The AI plays "naive student" and asks follow-ups. Defend your reasoning.',
      'Upload notes to have it quiz you on YOUR specific material.',
      "If you're stuck, say so — it'll guide rather than just give the answer.",
    ],
    examples: [
      'Mitosis — the four phases',
      'The causes of WWI',
      'How a binary search algorithm works',
    ],
  },
  {
    id: 'concept_explainer',
    name: 'Concept Explainer',
    description: 'Instantly break down complex topics into clear, simple explanations with real examples.',
    icon: Lightbulb,
    component: ConceptExplainer,
    accent: 'xp',
    category: 'study',
    badge: null,
    tips: [
      'Quick Overview is great for a refresher; Deep Dive for first-time learning.',
      'Exam-Focused mode strips out everything that won\'t score marks.',
      'Click "Quiz Me" after to test yourself on what you just read.',
      'Be specific — "The Krebs Cycle" beats "Cell biology".',
    ],
    examples: [
      'The difference between mitosis and meiosis',
      "Bandura's Social Learning Theory",
      'How buffer solutions resist pH change',
    ],
  },
  {
    id: 'note_summarizer',
    name: 'Note Summarizer',
    description: 'Upload your notes and get a structured, concise summary of all key points.',
    icon: ClipboardList,
    component: NoteSummarizer,
    accent: 'primary',
    category: 'study',
    badge: null,
    tips: [
      'Supports PDF, DOCX, PPTX, and TXT — up to 20 MB per file.',
      'Mind Map style gives you a hierarchical view that\'s great for revision.',
      'Exam-Ready format produces dot points and definitions you can memorise.',
      'Auto-generate flashcards from any summary in one click.',
    ],
    examples: [
      'Past paper PDFs — extract key concepts',
      'Lecture slides DOCX — exam-ready dot points',
      'Textbook chapter — mind-map style',
    ],
    examplesType: 'use-cases',
  },
  {
    id: 'essay_planner',
    name: 'Essay Planner',
    description: 'Generate structured essay plans with thesis, arguments, evidence and conclusion in seconds.',
    icon: FileText,
    component: EssayPlanner,
    accent: 'chart-4',
    category: 'english',
    badge: null,
    tips: [
      'Provide source text (e.g. The Crucible) for richer, text-grounded planning.',
      'Match Word Count to your real SAC — body paragraph allocation scales with it.',
      'The plan includes "Common Pitfalls" — read those *before* writing your draft.',
      'Save plans you like to reuse the structure for different prompts.',
    ],
    examples: [
      'Discuss the role of fear in The Crucible',
      'How does industrialisation shape modern society?',
      'Compare Macbeth and Lady Macbeth\'s descent into guilt',
    ],
  },
  {
    id: 'line_memoriser',
    name: 'Line Memoriser',
    description: 'Master essays, scripts and speeches through structured, adaptive memorization training.',
    icon: Brain,
    component: LineMemoriser,
    accent: 'streak',
    category: 'english',
    badge: null,
    tips: [
      'Best for memorising essays, oral presentations, lit quotes, and scripts.',
      'Text is auto-split into sentences. Master each chunk before moving on.',
      'Successful streaks reduce required attempts — accuracy beats speed.',
      'Save mid-session and resume later from where you left off.',
    ],
    examples: [
      'A SAC essay you\'ve already drafted',
      'A polished oral-presentation introduction',
      'Key Hamlet soliloquy quotes for your text response',
    ],
    examplesType: 'use-cases',
  },
];

const categories = [
  { id: 'all', label: 'All Tools', icon: LayoutGrid },
  { id: 'math', label: 'Mathematics', icon: Sigma },
  { id: 'english', label: 'English', icon: PenTool },
  { id: 'study', label: 'Study Skills', icon: Brain },
];

// Map accent token → Tailwind classes. Centralised so adding a new tool only
// needs an `accent` value, not new color logic in the JSX.
// `orb` is an inline-style background string used behind the icon for a soft
// accent glow; `glow` is the hex used in the box-shadow on card hover.
const ACCENT_CLASSES = {
  primary:   { iconBg: 'bg-primary/10',   iconText: 'text-primary',   ring: 'group-hover:border-primary/40 group-hover:bg-primary/5',   badge: 'bg-primary/15 text-primary',   orb: 'radial-gradient(circle at 30% 20%, hsl(89 97% 40% / 0.35) 0%, transparent 60%)',  glow: '88, 204, 2' },
  xp:        { iconBg: 'bg-xp/10',        iconText: 'text-xp',        ring: 'group-hover:border-xp/40 group-hover:bg-xp/5',             badge: 'bg-xp/15 text-xp',             orb: 'radial-gradient(circle at 30% 20%, hsl(35 100% 50% / 0.32) 0%, transparent 60%)', glow: '255, 165, 0' },
  streak:    { iconBg: 'bg-streak/10',    iconText: 'text-streak',    ring: 'group-hover:border-streak/40 group-hover:bg-streak/5',     badge: 'bg-streak/15 text-streak',     orb: 'radial-gradient(circle at 30% 20%, hsl(0 100% 65% / 0.32) 0%, transparent 60%)',  glow: '255, 75, 75' },
  'chart-3': { iconBg: 'bg-chart-3/10',   iconText: 'text-chart-3',   ring: 'group-hover:border-chart-3/40 group-hover:bg-chart-3/5',   badge: 'bg-chart-3/15 text-chart-3',   orb: 'radial-gradient(circle at 30% 20%, hsl(217 91% 60% / 0.32) 0%, transparent 60%)', glow: '59, 130, 246' },
  'chart-4': { iconBg: 'bg-chart-4/10',   iconText: 'text-chart-4',   ring: 'group-hover:border-chart-4/40 group-hover:bg-chart-4/5',   badge: 'bg-chart-4/15 text-chart-4',   orb: 'radial-gradient(circle at 30% 20%, hsl(280 65% 60% / 0.32) 0%, transparent 60%)', glow: '168, 85, 247' },
};

function AIToolsInner() {
  const [selectedTool, setSelectedTool] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [recentTools, setRecentTools] = useState([]);
  const [copiedExample, setCopiedExample] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { toast } = useToast();

  // Reset fullscreen when leaving the tool view
  useEffect(() => { if (!selectedTool) setIsFullscreen(false); }, [selectedTool]);

  // ESC exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const handleCopyExample = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedExample(text);
      toast({ title: 'Copied — paste it into the form 👇' });
      setTimeout(() => setCopiedExample(null), 1800);
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('recentAITools');
    if (saved) setRecentTools(JSON.parse(saved));
  }, []);

  const handleSelectTool = (toolId) => {
    setSelectedTool(toolId);
    const updated = [toolId, ...recentTools.filter((t) => t !== toolId)].slice(0, 3);
    setRecentTools(updated);
    localStorage.setItem('recentAITools', JSON.stringify(updated));
  };

  const currentTool = selectedTool ? tools.find((t) => t.id === selectedTool) : null;
  const CurrentToolComponent = currentTool?.component;

  // Tips/examples auto-collapse on first interaction so the workspace clears.
  // Per-tool sessionStorage so the choice survives navigation within a session.
  const [tipsCollapsed, setTipsCollapsed] = useState(false);
  const autoHidRef = useRef(false);
  useEffect(() => {
    autoHidRef.current = false;
    if (!selectedTool) { setTipsCollapsed(false); return; }
    const stored = sessionStorage.getItem(`ai-tips-${selectedTool}`);
    setTipsCollapsed(stored === '1');
  }, [selectedTool]);
  const handleToolInteraction = () => {
    if (autoHidRef.current || !selectedTool) return;
    if (sessionStorage.getItem(`ai-tips-${selectedTool}`) === '0') return; // user explicitly chose to keep them visible
    autoHidRef.current = true;
    setTipsCollapsed(true);
    sessionStorage.setItem(`ai-tips-${selectedTool}`, '1');
  };
  const showTips = () => {
    if (!selectedTool) return;
    setTipsCollapsed(false);
    sessionStorage.setItem(`ai-tips-${selectedTool}`, '0');
    autoHidRef.current = true;
  };
  const hideTips = () => {
    if (!selectedTool) return;
    setTipsCollapsed(true);
    sessionStorage.setItem(`ai-tips-${selectedTool}`, '1');
    autoHidRef.current = true;
  };

  // Suggest other tools — same category first, then any others to fill 3 slots.
  const relatedTools = currentTool
    ? (() => {
        const sameCat = tools.filter((t) => t.id !== currentTool.id && t.category === currentTool.category);
        const others = tools.filter((t) => t.id !== currentTool.id && t.category !== currentTool.category);
        return [...sameCat, ...others].slice(0, 3);
      })()
    : [];

  const filteredTools = tools.filter((t) => {
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const recentToolObjects = recentTools.map((id) => tools.find((t) => t.id === id)).filter(Boolean);

  // ─── Tool detail view ────────────────────────────────────────────────────
  if (selectedTool && currentTool) {
    const accent = ACCENT_CLASSES[currentTool.accent] || ACCENT_CLASSES.primary;
    return (
      <div className={isFullscreen
          ? "fixed inset-0 z-50 bg-background overflow-y-auto"
          : "min-h-screen bg-background"
      }>
        {/* Tool header — light, friendly, accent gradient bar + glowing icon */}
        <div className="relative border-b border-border bg-surface">
          {/* Top accent gradient bar — colour signals the tool family */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-[3px] pointer-events-none"
            style={{
              background: `linear-gradient(90deg, transparent 0%, rgba(${accent.glow}, 0.7) 50%, transparent 100%)`,
            }}
          />
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
            <button
              onClick={() => setSelectedTool(null)}
              className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-xl hover:bg-secondary cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">All Tools</span>
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className={`w-11 h-11 ${accent.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}
                style={{ boxShadow: `0 0 24px rgba(${accent.glow}, 0.18)` }}
              >
                <currentTool.icon className={`w-5 h-5 ${accent.iconText}`} />
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-extrabold text-foreground text-lg leading-tight truncate">{currentTool.name}</h1>
                <p className="text-muted-foreground text-xs truncate hidden sm:block">{currentTool.description}</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                <TierUsagePill feature={currentTool.feature || FEATURES.AI_TOOL} />
                <button
                  onClick={() => setIsFullscreen(f => !f)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                  title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen — focus mode"}
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 w-full max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Main column: tool + below-tool discovery row */}
            <div className="space-y-6 min-w-0">
              <div onMouseDownCapture={handleToolInteraction} onKeyDownCapture={handleToolInteraction}>
                <CurrentToolComponent />
              </div>

              {/* Discovery row — examples + related tools (auto-hide once user starts using the tool) */}
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${tipsCollapsed ? 'hidden' : ''}`}>
                {(currentTool.examples || []).length > 0 && (
                  <div className="card-soft p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className={`w-4 h-4 ${accent.iconText}`} />
                      <h3 className="font-display font-extrabold text-foreground text-sm">
                        {currentTool.examplesType === 'use-cases' ? 'What works well' : 'Try one of these'}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {currentTool.examplesType === 'use-cases'
                        ? 'Examples of content this tool handles best.'
                        : 'Tap any example to copy it, then paste into the form.'}
                    </p>
                    <div className="space-y-2">
                      {currentTool.examples.map((ex, i) => {
                        if (currentTool.examplesType === 'use-cases') {
                          return (
                            <div
                              key={i}
                              className="w-full text-left px-3 py-2.5 rounded-xl border-2 border-border bg-background/40 text-sm flex items-start gap-2.5 text-muted-foreground"
                            >
                              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${accent.iconBg.replace('/10', '')}`} />
                              <span className="flex-1 leading-snug">{ex}</span>
                            </div>
                          );
                        }
                        const isCopied = copiedExample === ex;
                        return (
                          <button
                            key={i}
                            onClick={() => handleCopyExample(ex)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm transition-all flex items-start gap-2 group ${
                              isCopied
                                ? 'border-primary bg-primary/5 text-foreground'
                                : 'border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <span className="flex-1 leading-snug">{ex}</span>
                            {isCopied
                              ? <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                              : <Copy className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            }
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {relatedTools.length > 0 && (
                  <div className="card-soft p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <LayoutGrid className={`w-4 h-4 ${accent.iconText}`} />
                      <h3 className="font-display font-extrabold text-foreground text-sm">
                        Other tools you might like
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Switch to a related tool without leaving the page.
                    </p>
                    <div className="space-y-2">
                      {relatedTools.map((rt) => {
                        const ra = ACCENT_CLASSES[rt.accent] || ACCENT_CLASSES.primary;
                        return (
                          <button
                            key={rt.id}
                            onClick={() => handleSelectTool(rt.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 text-left transition-all group"
                          >
                            <div className={`w-9 h-9 ${ra.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                              <rt.icon className={`w-5 h-5 ${ra.iconText}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-foreground truncate leading-tight">{rt.name}</div>
                              <div className="text-[11px] text-muted-foreground truncate mt-0.5">{rt.description.split('.')[0]}</div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar: tips stay sticky alongside the form (auto-hide on use) */}
            <aside className="hidden lg:block">
              <div className="sticky top-6 space-y-4">
                {!tipsCollapsed ? (
                  <div className="card-soft p-5">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Lightbulb className={`w-4 h-4 flex-shrink-0 ${accent.iconText}`} />
                        <h3 className="font-display font-extrabold text-foreground text-sm truncate">
                          Tips for {currentTool.name}
                        </h3>
                      </div>
                      <button
                        onClick={hideTips}
                        className="p-1 -mr-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
                        title="Hide tips"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <ul className="space-y-3">
                      {(currentTool.tips || []).map((tip, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${accent.iconBg.replace('/10', '')}`} />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <button
                    onClick={showTips}
                    className="w-full card-soft p-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors group"
                  >
                    <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-bold">Show tips & examples</span>
                  </button>
                )}

                <div className="card-soft p-4">
                  <p className="stat-label mb-2">Powered by</p>
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Claude Sonnet 4.6
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  // ─── Tool listing view ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background relative">
      {/* Ambient hero glow — primary-green wash bleeding from top centre */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none -z-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 50% 0%, hsl(89 97% 40% / 0.10) 0%, transparent 70%)',
        }}
      />

      {/* Hero */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-12 pb-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3.5 py-1.5 mb-6 text-xs font-bold text-primary shadow-[0_0_24px_rgba(88,204,2,0.15)]">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Study Suite
          </div>

          <div className="flex items-start justify-center gap-2 mb-4">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-[1.05] tracking-tight">
              Your AI Study<br />
              <span
                className="inline-block bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, #B6FF4E 0%, #58CC02 50%, #2FB300 100%)',
                  filter: 'drop-shadow(0 0 24px rgba(88,204,2,0.35))',
                }}
              >
                Command Centre
              </span>
            </h1>
            <HelpButton page="AITools" />
          </div>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto mb-4 leading-relaxed">
            {tools.length} AI-powered tools built for VCE students.
            Study smarter, score higher.
          </p>

          {/* Today's quota at a glance */}
          <div className="flex justify-center mb-8">
            <TierUsagePill feature={FEATURES.AI_TOOL} />
          </div>

          {/* Search — bigger, with focus glow */}
          <div className="relative max-w-xl mx-auto group">
            <div
              aria-hidden
              className="absolute -inset-px rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"
              style={{
                background:
                  'linear-gradient(135deg, hsl(89 97% 40% / 0.45), hsl(217 91% 60% / 0.35))',
                filter: 'blur(12px)',
              }}
            />
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tools — try ‘essay’, ‘math’, ‘memorise’…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface border-2 border-border text-foreground placeholder-muted-foreground rounded-2xl pl-11 pr-4 h-14 text-sm font-medium focus:outline-none focus:border-primary transition-all shadow-soft"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Stats chip strip */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {tools.length} tools
            </span>
            <span className="w-px h-3 bg-border" />
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-chart-3" />
              All 34 VCE subjects
            </span>
            <span className="w-px h-3 bg-border" />
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-primary" />
              Powered by Claude
            </span>
          </div>
        </div>
      </section>

      <div className="relative px-4 sm:px-6 lg:px-8 w-full max-w-6xl mx-auto">
        {/* Category pills — icons + active state with accent */}
        <div className="flex gap-2 overflow-x-auto py-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 h-11 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-foreground text-background shadow-soft'
                    : 'bg-surface border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground hover:shadow-soft'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Recently used */}
        {recentToolObjects.length > 0 && !search && activeCategory === 'all' && (
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="stat-label">Recently used</span>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              {recentToolObjects.map((tool) => {
                const accent = ACCENT_CLASSES[tool.accent] || ACCENT_CLASSES.primary;
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleSelectTool(tool.id)}
                    className="flex items-center gap-2.5 bg-surface border border-border hover:border-primary/40 hover:shadow-soft rounded-xl px-3.5 py-2.5 transition-all group cursor-pointer"
                  >
                    <div className={`w-7 h-7 ${accent.iconBg} rounded-lg flex items-center justify-center`}>
                      <tool.icon className={`w-4 h-4 ${accent.iconText}`} />
                    </div>
                    <span className="text-sm font-bold text-foreground">{tool.name}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tools grid — premium card with accent orb + ambient glow on hover */}
        <AnimatePresence mode="wait">
          {filteredTools.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center">
                <Search className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-display font-extrabold text-foreground text-lg mb-1">No tools found</p>
              <p className="text-muted-foreground text-sm">Try a different search or category.</p>
            </div>
          ) : (
            <motion.div
              key={activeCategory + search}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-12"
            >
              {filteredTools.map((tool, index) => {
                const accent = ACCENT_CLASSES[tool.accent] || ACCENT_CLASSES.primary;
                return (
                  <motion.button
                    key={tool.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    onClick={() => handleSelectTool(tool.id)}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 0 1px rgba(${accent.glow},0.35), 0 12px 28px rgba(${accent.glow},0.18), 0 4px 8px rgba(13,22,38,0.06)`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
                    className="group relative text-left bg-surface rounded-2xl border border-border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-soft"
                  >
                    {/* Accent orb — large blurred radial in the top-right corner */}
                    <div
                      aria-hidden
                      className="absolute -top-16 -right-16 w-48 h-48 opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ background: accent.orb, filter: 'blur(8px)' }}
                    />
                    {/* Subtle inner gradient on hover */}
                    <div
                      aria-hidden
                      className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${accent.iconBg.replace('/10', '/[0.04]')}`}
                    />

                    <div className="relative p-6 h-full flex flex-col">
                      <div className="flex items-start justify-between mb-5">
                        <div className={`w-14 h-14 ${accent.iconBg} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-[0_0_28px_rgba(0,0,0,0)] group-hover:shadow-[0_0_28px_rgba(${'88,204,2'},0)] group-hover:scale-105 transition-all duration-200`}>
                          <tool.icon className={`w-7 h-7 ${accent.iconText}`} />
                        </div>
                        {tool.badge && (
                          <span className={`pill ${accent.badge} flex-shrink-0 backdrop-blur-sm`}>
                            {tool.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display font-extrabold text-foreground text-lg mb-1.5 leading-tight tracking-tight">
                        {tool.name}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 flex-1">
                        {tool.description}
                      </p>

                      {/* Footer row — always visible "Open" indicator with arrow that slides on hover */}
                      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/60">
                        <span className={`flex items-center gap-1.5 text-xs font-bold ${accent.iconText}`}>
                          <Zap className="w-3 h-3" />
                          Open tool
                        </span>
                        <ChevronRight className={`w-4 h-4 ${accent.iconText} group-hover:translate-x-0.5 transition-transform`} />
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Powered-by footer */}
        <div className="flex items-center justify-center gap-2 pb-12 -mt-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
            Every tool is trained on
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-foreground bg-surface border border-border rounded-full px-3 py-1 shadow-soft">
            <Sparkles className="w-3 h-3 text-primary" />
            VCAA examiner reports
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AITools() {
  return (
    <RequirePremium
      featureName="AI Tools"
      description="The 10 AI study tools (essay planner, math tutor, note summariser, more) are part of Premium. $5/week, cancel anytime."
    >
      <AIToolsInner />
    </RequirePremium>
  );
}
