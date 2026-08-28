import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Star, BookOpen, GraduationCap, Brain, Target, Heart , Check} from 'lucide-react';

const categoryIcons = {
    vce_system: GraduationCap,
    study_techniques: Brain,
    subject_specific: BookOpen,
    exam_prep: Target,
    wellbeing: Heart
};

const categoryColors = {
    vce_system: 'from-blue-500 to-indigo-600',
    study_techniques: 'from-green-500 to-emerald-600',
    subject_specific: 'from-orange-500 to-amber-600',
    exam_prep: 'from-red-500 to-rose-600',
    wellbeing: 'from-pink-500 to-purple-600'
};

const difficultyColors = {
    beginner: 'bg-green-100 text-green-800 border-green-200',
    intermediate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    advanced: 'bg-red-100 text-red-800 border-red-200'
};

export default function GuideCard({ guide, onSelect, isFeatured = false }) {
    const CategoryIcon = categoryIcons[guide.category] || BookOpen;
    const gradientColor = categoryColors[guide.category] || 'from-purple-500 to-indigo-600';

    return (
        <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="h-full cursor-pointer"
            onClick={() => onSelect(guide)}
        >
            <Card className={`h-full bg-surface hover:shadow-2xl transition-all duration-500 border-2 overflow-hidden ${isFeatured ? 'border-yellow-300 shadow-lg' : 'border-purple-100'}`}>
                {/* Cover Image */}
                {guide.cover_image_url && (
                    <div className="relative h-48 overflow-hidden">
                        <img 
                            src={guide.cover_image_url} 
                            alt={guide.title}
                            className="w-full h-full object-cover"
                        />
                        {isFeatured && (
                            <div className="absolute top-3 right-3">
                                <Badge className="bg-yellow-500 text-white border-yellow-400 shadow-lg">
                                    <Star className="w-3 h-3 mr-1 fill-current" />
                                    Featured
                                </Badge>
                            </div>
                        )}
                    </div>
                )}

                {/* No Image Fallback */}
                {!guide.cover_image_url && (
                    <div className={`relative h-48 bg-gradient-to-br ${gradientColor} flex items-center justify-center`}>
                        <CategoryIcon className="w-20 h-20 text-white opacity-80" />
                        {isFeatured && (
                            <div className="absolute top-3 right-3">
                                <Badge className="bg-yellow-500 text-white border-yellow-400 shadow-lg">
                                    <Star className="w-3 h-3 mr-1 fill-current" />
                                    Featured
                                </Badge>
                            </div>
                        )}
                    </div>
                )}

                <CardHeader className="pb-3">
                    <div className="flex items-start gap-3 mb-2">
                        <div className={`w-10 h-10 bg-gradient-to-br ${gradientColor} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
                            <CategoryIcon className="w-5 h-5 text-white" />
                        </div>
                        <CardTitle className="text-lg leading-tight">{guide.title}</CardTitle>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={`border-2 ${difficultyColors[guide.difficulty_level]}`}>
                            {guide.difficulty_level}
                        </Badge>
                        {guide.subject && (
                            <Badge variant="outline" className="border-2 border-purple-200 text-purple-800">
                                {guide.subject}
                            </Badge>
                        )}
                        <Badge variant="outline" className="border-2 border-border text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {guide.estimated_read_time || 5} min
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    {guide.key_points && guide.key_points.length > 0 && (
                        <div className="space-y-1 mb-3">
                            {guide.key_points.slice(0, 3).map((point, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <Check className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-1">{point}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {guide.tags && guide.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                            {guide.tags.slice(0, 3).map((tag, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs bg-purple-50 text-purple-700">
                                    {tag}
                                </Badge>
                            ))}
                            {guide.tags.length > 3 && (
                                <Badge variant="secondary" className="text-xs bg-secondary/50 text-muted-foreground">
                                    +{guide.tags.length - 3}
                                </Badge>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}