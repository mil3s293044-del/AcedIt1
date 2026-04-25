import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Clock, BookOpen, Target, CheckCircle2, Play, Edit, Save, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import GuideQuizPlayer from './GuideQuizPlayer';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const categoryIcons = {
    vce_system: BookOpen,
    study_techniques: Target,
    subject_specific: BookOpen,
    exam_prep: Target,
    wellbeing: BookOpen
};

export default function GuideReader({ guide, onClose }) {
    const [showQuiz, setShowQuiz] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedGuide, setEditedGuide] = useState({ ...guide });
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const CategoryIcon = categoryIcons[guide.category] || BookOpen;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await base44.entities.StudyGuide.update(guide.id, editedGuide);
            toast({ title: 'Guide updated!', description: 'Your changes have been saved.' });
            setIsEditing(false);
            // Update the parent component's guide data
            Object.assign(guide, editedGuide);
        } catch (error) {
            console.error("Error updating guide:", error);
            toast({ title: 'Save failed', description: 'Could not update the guide.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditedGuide({ ...guide });
        setIsEditing(false);
    };

    if (showQuiz && guide.quiz_questions && guide.quiz_questions.length > 0) {
        return (
            <GuideQuizPlayer
                questions={guide.quiz_questions}
                guideTitle={guide.title}
                onClose={() => setShowQuiz(false)}
            />
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto"
        >
            <div className="flex items-center justify-between mb-6">
                <Button
                    variant="outline"
                    onClick={onClose}
                    className="hover:bg-purple-50 border-purple-200"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Guides
                </Button>
                
                {!isEditing ? (
                    <Button
                        variant="outline"
                        onClick={() => setIsEditing(true)}
                        className="hover:bg-blue-50 border-blue-200"
                    >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Guide
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isSaving}
                        >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-gradient-to-r from-green-600 to-emerald-600"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                )}
            </div>

            <Card className="shadow-2xl border-2 border-purple-100">
                {/* Cover Image */}
                {guide.cover_image_url && (
                    <div className="relative h-64 overflow-hidden rounded-t-lg">
                        <img 
                            src={guide.cover_image_url} 
                            alt={guide.title}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}

                <CardHeader className="border-b border-gray-100 pb-6">
                    {isEditing ? (
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Title</label>
                                <Input
                                    value={editedGuide.title}
                                    onChange={(e) => setEditedGuide({ ...editedGuide, title: e.target.value })}
                                    className="text-2xl font-bold"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Category</label>
                                    <Select
                                        value={editedGuide.category}
                                        onValueChange={(value) => setEditedGuide({ ...editedGuide, category: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="vce_system">VCE System</SelectItem>
                                            <SelectItem value="study_techniques">Study Techniques</SelectItem>
                                            <SelectItem value="subject_specific">Subject Specific</SelectItem>
                                            <SelectItem value="exam_prep">Exam Preparation</SelectItem>
                                            <SelectItem value="wellbeing">Wellbeing</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Difficulty</label>
                                    <Select
                                        value={editedGuide.difficulty_level}
                                        onValueChange={(value) => setEditedGuide({ ...editedGuide, difficulty_level: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="beginner">Beginner</SelectItem>
                                            <SelectItem value="intermediate">Intermediate</SelectItem>
                                            <SelectItem value="advanced">Advanced</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Subject (optional)</label>
                                <Input
                                    value={editedGuide.subject || ''}
                                    onChange={(e) => setEditedGuide({ ...editedGuide, subject: e.target.value })}
                                    placeholder="e.g., Biology, Chemistry"
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                                    <CategoryIcon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <CardTitle className="text-3xl font-bold text-gray-900 mb-2">{guide.title}</CardTitle>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="outline" className="border-2 border-purple-200 text-purple-800">
                                            {guide.category.replace('_', ' ')}
                                        </Badge>
                                        <Badge variant="outline" className="border-2 border-blue-200 text-blue-800">
                                            {guide.difficulty_level}
                                        </Badge>
                                        {guide.subject && (
                                            <Badge variant="outline" className="border-2 border-green-200 text-green-800">
                                                {guide.subject}
                                            </Badge>
                                        )}
                                        <Badge variant="outline" className="border-2 border-gray-200 text-gray-600 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {guide.estimated_read_time || 5} min read
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </CardHeader>

                <CardContent className="p-8">
                    {isEditing ? (
                        <div className="space-y-6">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Content (Markdown)</label>
                                <Textarea
                                    value={editedGuide.content || ''}
                                    onChange={(e) => setEditedGuide({ ...editedGuide, content: e.target.value })}
                                    rows={20}
                                    className="font-mono text-sm"
                                    placeholder="Write your guide content in markdown..."
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            {guide.key_points && guide.key_points.length > 0 && (
                                <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border-2 border-purple-100">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-purple-600" />
                                        Key Takeaways
                                    </h3>
                                    <ul className="space-y-2">
                                        {guide.key_points.map((point, idx) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <span className="text-purple-500 text-lg mt-0.5">✓</span>
                                                <span className="text-gray-700 leading-relaxed">{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <Separator className="my-8" />

                            {guide.sections && guide.sections.length > 0 ? (
                                <div className="space-y-8">
                                    {guide.sections.map((section, idx) => (
                                        <div key={idx} className="scroll-mt-20">
                                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                <span className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                                                    {idx + 1}
                                                </span>
                                                {section.heading}
                                            </h2>
                                            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                                                <ReactMarkdown>{section.content}</ReactMarkdown>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : guide.content ? (
                                <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                                    <ReactMarkdown>{guide.content}</ReactMarkdown>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">No content available for this guide.</p>
                            )}

                            {guide.quiz_questions && guide.quiz_questions.length > 0 && (
                                <div className="mt-12 p-8 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900 mb-2">Test Your Knowledge</h3>
                                            <p className="text-gray-600">
                                                Take a quiz with {guide.quiz_questions.length} questions to reinforce what you've learned.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={() => setShowQuiz(true)}
                                            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                                        >
                                            <Play className="w-4 h-4 mr-2" />
                                            Start Quiz
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}