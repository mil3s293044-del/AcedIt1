import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, TrendingUp, Info, Plus, Check } from "lucide-react";

const SubjectCard = React.memo(({ subject, index, onClick, onToggle, isSelected, showActions = false }) => {
    const backgroundColor = subject.color || '#3B82F6';

    const handleCardClick = (e) => {
        // Don't trigger card click if clicking on action buttons
        if (e.target.closest('.action-button')) {
            return;
        }
        if (onClick) {
            onClick();
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.03, y: -5 }}
            whileTap={{ scale: 0.98 }}
            className="relative"
        >
            <Card
                className="cursor-pointer hover:shadow-2xl transition-all duration-300 overflow-hidden group"
                onClick={handleCardClick}
            >
                <div 
                    className="h-32 p-6 relative overflow-hidden"
                    style={{ backgroundColor }}
                >
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-all duration-300" />
                    <div className="relative z-10">
                        <BookOpen className="w-8 h-8 text-white mb-2" />
                        <h3 className="text-2xl font-bold text-white line-clamp-2">
                            {subject.name}
                        </h3>
                    </div>
                    <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full" />
                </div>

                <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono font-semibold">
                            {subject.code}
                        </Badge>
                        {subject.difficulty_level && (
                            <Badge variant="outline">
                                {subject.difficulty_level}
                            </Badge>
                        )}
                    </div>

                    <p className="text-sm text-gray-600 line-clamp-2">
                        {subject.overview}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t">
                        {subject.scaling_info?.scaling_factor ? (
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-semibold text-green-700">
                                    {subject.scaling_info.scaling_factor}
                                </span>
                            </div>
                        ) : (
                            <div />
                        )}
                        
                        {showActions && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onClick) onClick();
                                    }}
                                    className="action-button text-gray-600 hover:text-gray-900"
                                >
                                    <Info className="w-4 h-4 mr-1" />
                                    Details
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggle(!isSelected);
                                    }}
                                    className={`action-button ${
                                        isSelected 
                                            ? 'bg-green-600 hover:bg-green-700 text-white' 
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                                >
                                    {isSelected ? (
                                        <>
                                            <Check className="w-4 h-4 mr-1" />
                                            Added
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4 mr-1" />
                                            Add
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
});

SubjectCard.displayName = 'SubjectCard';

export default SubjectCard;