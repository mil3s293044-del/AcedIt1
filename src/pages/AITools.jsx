import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Search, ChevronRight, Clock, Star, Zap, X } from 'lucide-react';
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
const tools = [
{
  id: 'math_tutor',
  name: 'Math AI Tutor',
  description: 'Step-by-step solutions for VCE Methods, Specialist & General Math with exam-standard working.',
  icon: '📐',
  component: MathTutor,
  gradient: 'from-violet-500 to-indigo-600',
  lightGradient: 'from-violet-50 to-indigo-50',
  category: 'math',
  badge: 'Popular',
  badgeColor: 'bg-violet-100 text-violet-700'
},
{
  id: 'english_mentor',
  name: 'AI English Mentor',
  description: 'VCE English expert for essay planning, TEEL structure, metalanguage & SAC preparation.',
  icon: '✍️',
  component: EnglishMentor,
  gradient: 'from-blue-500 to-cyan-600',
  lightGradient: 'from-blue-50 to-cyan-50',
  category: 'english',
  badge: 'VCE Aligned',
  badgeColor: 'bg-blue-100 text-blue-700'
},
{
  id: 'exam_question_gen',
  name: 'Exam Question Generator',
  description: 'Generate custom VCE-style exam questions with marking criteria for any subject and topic.',
  icon: '🎯',
  component: ExamQuestionGenerator,
  gradient: 'from-rose-500 to-pink-600',
  lightGradient: 'from-rose-50 to-pink-50',
  category: 'study',
  badge: 'New',
  badgeColor: 'bg-rose-100 text-rose-700'
},
{
  id: 'teaching_assistant',
  name: 'Teaching Assistant',
  description: 'Learn deeply by teaching concepts to AI — get questioned, challenged, and guided.',
  icon: '🎓',
  component: TeachingAssistant,
  gradient: 'from-amber-500 to-orange-600',
  lightGradient: 'from-amber-50 to-orange-50',
  category: 'study',
  badge: null,
  badgeColor: ''
},
{
  id: 'concept_explainer',
  name: 'Concept Explainer',
  description: 'Instantly break down complex topics into clear, simple explanations with real examples.',
  icon: '💡',
  component: ConceptExplainer,
  gradient: 'from-yellow-500 to-amber-600',
  lightGradient: 'from-yellow-50 to-amber-50',
  category: 'study',
  badge: null,
  badgeColor: ''
},
{
  id: 'note_summarizer',
  name: 'Note Summarizer',
  description: 'Upload your notes and get a structured, concise summary of all key points.',
  icon: '📋',
  component: NoteSummarizer,
  gradient: 'from-teal-500 to-cyan-600',
  lightGradient: 'from-teal-50 to-cyan-50',
  category: 'study',
  badge: null,
  badgeColor: ''
},
{
  id: 'essay_planner',
  name: 'Essay Planner',
  description: 'Generate structured essay plans with thesis, arguments, evidence and conclusion in seconds.',
  icon: '📝',
  component: EssayPlanner,
  gradient: 'from-indigo-500 to-purple-600',
  lightGradient: 'from-indigo-50 to-purple-50',
  category: 'english',
  badge: null,
  badgeColor: ''
},
{
  id: 'line_memoriser',
  name: 'Line Memoriser',
  description: 'Master essays, scripts and speeches through structured, adaptive memorization training.',
  icon: '🧠',
  component: LineMemoriser,
  gradient: 'from-pink-500 to-rose-600',
  lightGradient: 'from-pink-50 to-rose-50',
  category: 'english',
  badge: null,
  badgeColor: ''
}];


const categories = [
{ id: 'all', label: 'All Tools', icon: '✨' },
{ id: 'math', label: 'Mathematics', icon: '📐' },
{ id: 'english', label: 'English', icon: '✍️' },
{ id: 'study', label: 'Study Skills', icon: '📚' }];


export default function AITools() {
  const [selectedTool, setSelectedTool] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [recentTools, setRecentTools] = useState([]);

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

  const filteredTools = tools.filter((t) => {
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const recentToolObjects = recentTools.map((id) => tools.find((t) => t.id === id)).filter(Boolean);

  if (selectedTool && currentTool) {
    return (
      <div className="min-h-screen">
                {/* Tool Header */}
                <div className={`bg-gradient-to-r ${currentTool.gradient} px-4 sm:px-6 lg:px-8 py-4`}>
                    <div className="max-w-5xl mx-auto flex items-center gap-4">
                        <button
              onClick={() => setSelectedTool(null)}
              className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl">
              
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">All Tools</span>
                        </button>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                                {currentTool.icon}
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-white font-bold text-lg leading-tight truncate">{currentTool.name}</h1>
                                <p className="text-white/70 text-xs truncate hidden sm:block">{currentTool.description}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-4 sm:px-6 lg:px-8 py-6 w-full max-w-[1400px] mx-auto">
                    <CurrentToolComponent />
                </div>
            </div>);

  }

  return (
    <div className="min-h-screen">
            {/* Hero Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 px-4 sm:px-6 lg:px-8 pt-10 pb-14">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(139,92,246,0.3),_transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(59,130,246,0.2),_transparent_60%)]" />
                <div className="relative max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-5 text-sm text-white/80">
                        <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                        AI-Powered Study Suite
                    </div>
                    <div className="flex items-center justify-center gap-3 mb-3">
                    <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight">
                        Your AI Study<br />
                        <span className="bg-gradient-to-r from-violet-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">Command Centre</span>
                    </h1>
                    <HelpButton page="AITools" className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white self-start mt-1" />
                    </div>
                    <p className="text-white/60 text-base max-w-xl mx-auto mb-8">8 AI-powered tools built for VCE students. Study smarter, score higher.

          </p>

                    {/* Search */}
                    <div className="relative max-w-md mx-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
              type="text"
              placeholder="Search tools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/40 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-violet-400 focus:bg-white/15 transition-all" />
            
                        {search &&
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                                <X className="w-4 h-4" />
                            </button>
            }
                    </div>
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 w-full max-w-[1400px] mx-auto">
                {/* Category Pills */}
                <div className="flex gap-2 overflow-x-auto py-5 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                    {categories.map((cat) =>
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeCategory === cat.id ?
            'bg-gray-900 text-white shadow-lg scale-105' :
            'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`
            }>
            
                            <span>{cat.icon}</span>
                            {cat.label}
                        </button>
          )}
                </div>

                {/* Recently Used */}
                {recentToolObjects.length > 0 && !search && activeCategory === 'all' &&
        <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recently Used</span>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            {recentToolObjects.map((tool) =>
            <button
              key={tool.id}
              onClick={() => handleSelectTool(tool.id)}
              className="flex items-center gap-2.5 bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md rounded-xl px-4 py-2.5 transition-all group">
              
                                    <span className="text-lg">{tool.icon}</span>
                                    <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{tool.name}</span>
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
                                </button>
            )}
                        </div>
                    </div>
        }

                {/* Tools Grid */}
                <AnimatePresence mode="wait">
                    {filteredTools.length === 0 ?
          <div className="text-center py-16">
                            <div className="text-4xl mb-3">🔍</div>
                            <p className="text-gray-500 text-sm">No tools found for "{search}"</p>
                        </div> :

          <motion.div
            key={activeCategory + search}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
            
                            {filteredTools.map((tool, index) =>
            <motion.button
              key={tool.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSelectTool(tool.id)}
              className="group text-left bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-gray-300 transition-all duration-300 hover:-translate-y-1">
              
                                    {/* Card gradient top bar */}
                                    <div className={`h-1.5 bg-gradient-to-r ${tool.gradient}`} />
                                    
                                    <div className="p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className={`w-12 h-12 bg-gradient-to-br ${tool.lightGradient} rounded-xl flex items-center justify-center text-2xl border border-gray-100 group-hover:scale-110 transition-transform duration-300`}>
                                                {tool.icon}
                                            </div>
                                            {tool.badge &&
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tool.badgeColor}`}>
                                                    {tool.badge}
                                                </span>
                  }
                                        </div>
                                        <h3 className="font-bold text-gray-900 text-base mb-1.5 group-hover:text-violet-700 transition-colors">
                                            {tool.name}
                                        </h3>
                                        <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">
                                            {tool.description}
                                        </p>
                                        <div className="flex items-center gap-1 mt-4 text-xs font-semibold text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Zap className="w-3 h-3" />
                                            Open tool
                                            <ChevronRight className="w-3 h-3" />
                                        </div>
                                    </div>
                                </motion.button>
            )}
                        </motion.div>
          }
                </AnimatePresence>
            </div>
        </div>);

}