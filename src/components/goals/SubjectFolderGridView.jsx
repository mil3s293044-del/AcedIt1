import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronRight, Trophy, ArrowLeft, Sparkles } from "lucide-react";

export default function SubjectFolderGridView({ userSubjects, onSelectSubject, onBack }) {
  // Helper function to darken color for better visibility
  const getDarkerShade = (hexColor) => {
    if (!hexColor || hexColor === '#FFFFFF' || hexColor === '#ffffff') {
      return '#2563EB'; // Default blue if white
    }
    
    // Convert hex to RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Darken by 30%
    const darkerR = Math.floor(r * 0.7);
    const darkerG = Math.floor(g * 0.7);
    const darkerB = Math.floor(b * 0.7);
    
    return `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
  };

  // Debug: Log subject colors
  React.useEffect(() => {
    console.log('Subject colors:', userSubjects?.map(s => ({ name: s.subject_name, color: s.color })));
  }, [userSubjects]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 lg:p-8 space-y-8"
    >
      {/* Header Section */}
      <div className="text-center mb-8 px-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="inline-flex items-center gap-3 mb-4"
        >
          <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-xl flex-shrink-0">
            <BookOpen className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
          </div>
        </motion.div>
        
        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-black mb-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight pb-1"
        >
          My Subjects
        </motion.h2>
        
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-base lg:text-lg text-gray-600 max-w-2xl mx-auto font-medium px-4"
        >
          Select a subject to manage goals and track progress
        </motion.p>
      </div>

      {userSubjects && userSubjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto auto-rows-fr">
          {userSubjects.map((subject, index) => {
            // Ensure we have a valid color, default to blue if not
            const subjectColor = (subject?.color && subject.color !== '#FFFFFF' && subject.color !== '#ffffff') 
              ? subject.color 
              : '#3B82F6';
            const darkerColor = getDarkerShade(subjectColor);

            return (
              <motion.div
                key={subject?.id || index}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  delay: index * 0.1, 
                  type: "spring", 
                  stiffness: 150,
                  damping: 15
                }}
                whileHover={{ y: -15, scale: 1.05 }}
                onClick={() => onSelectSubject(subject)}
                className="cursor-pointer group h-full"
              >
                <Card className="relative h-full border-0 overflow-hidden shadow-2xl flex flex-col min-h-[320px]">
                  {/* Strong gradient background with forced color */}
                  <div
                    className="absolute inset-0 transition-all duration-500"
                    style={{
                      background: `linear-gradient(135deg, ${subjectColor} 0%, ${darkerColor} 100%)`,
                      backgroundColor: subjectColor // Fallback
                    }}
                  />

                  {/* Animated floating orbs - more visible */}
                  <motion.div
                    animate={{
                      scale: [1, 1.4, 1],
                      opacity: [0.2, 0.35, 0.2],
                      x: [0, 30, 0],
                      y: [0, -20, 0]
                    }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl"
                  />
                  <motion.div
                    animate={{
                      scale: [1.2, 1, 1.2],
                      opacity: [0.15, 0.3, 0.15],
                      x: [0, -20, 0],
                      y: [0, 30, 0]
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full blur-3xl"
                  />

                  <CardContent className="relative p-8 flex flex-col flex-1 text-white z-10">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <Badge 
                        className="font-black text-xs px-4 py-1.5 backdrop-blur-sm shadow-lg"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.3)',
                          color: 'white',
                          border: '2px solid rgba(255, 255, 255, 0.5)'
                        }}
                      >
                        {subject?.subject_code || 'N/A'}
                      </Badge>
                      
                      <motion.div
                        animate={{ 
                          rotate: [0, 10, 0, -10, 0],
                          scale: [1, 1.1, 1]
                        }}
                        transition={{ duration: 4, repeat: Infinity }}
                        className="w-16 h-16 rounded-2xl backdrop-blur-md shadow-2xl flex items-center justify-center"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.25)',
                          border: '3px solid rgba(255, 255, 255, 0.5)'
                        }}
                      >
                        <BookOpen className="w-8 h-8 text-white drop-shadow-lg" />
                      </motion.div>
                    </div>

                    {/* Title */}
                    <div className="flex-1 mb-6">
                      <h3 className="text-2xl font-black mb-3 leading-tight text-white drop-shadow-lg line-clamp-2 group-hover:scale-105 transition-transform duration-300">
                        {subject?.subject_name || 'Unnamed Subject'}
                      </h3>

                      <p className="text-white/95 font-bold text-sm drop-shadow">
                        {subject?.year_level || 'Year 12 Units 3&4'}
                      </p>
                    </div>

                    {/* Target Score */}
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="rounded-xl p-3 mb-4 backdrop-blur-md"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.4)'
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-white flex-shrink-0" />
                        <span className="text-xs font-bold text-white/90">Target:</span>
                        <span className="text-lg font-black text-white">
                          {subject?.goal_study_score ? subject.goal_study_score : 'Not set'}
                        </span>
                      </div>
                    </motion.div>

                    {/* Footer CTA */}
                    <motion.div 
                      className="flex items-center justify-between pt-5"
                      style={{ borderTop: '2px solid rgba(255, 255, 255, 0.4)' }}
                      whileHover={{ x: 5 }}
                    >
                      <span className="text-sm font-black text-white uppercase tracking-wide drop-shadow-lg">
                        View Details
                      </span>
                      <motion.div
                        animate={{ x: [0, 8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-10 h-10 rounded-full backdrop-blur-md shadow-lg flex items-center justify-center"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.25)',
                          border: '2px solid rgba(255, 255, 255, 0.5)'
                        }}
                      >
                        <ChevronRight className="w-6 h-6 text-white drop-shadow-lg" />
                      </motion.div>
                    </motion.div>

                    {/* Decorative corner elements */}
                    <div 
                      className="absolute top-0 left-0 w-20 h-20 rounded-tl-2xl"
                      style={{ 
                        borderTop: '4px solid rgba(255, 255, 255, 0.4)',
                        borderLeft: '4px solid rgba(255, 255, 255, 0.4)'
                      }}
                    />
                    <div 
                      className="absolute bottom-0 right-0 w-20 h-20 rounded-br-2xl"
                      style={{ 
                        borderBottom: '4px solid rgba(255, 255, 255, 0.4)',
                        borderRight: '4px solid rgba(255, 255, 255, 0.4)'
                      }}
                    />
                  </CardContent>

                  {/* Shine effect on hover */}
                  <motion.div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)'
                    }}
                  />
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-6"
          >
            <BookOpen className="w-12 h-12 text-gray-400" />
          </motion.div>
          <h3 className="text-2xl font-bold text-gray-700 mb-3">No subjects found</h3>
          <p className="text-gray-600 mb-6">Add subjects to get started with goal tracking!</p>
          <Button 
            onClick={onBack}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Go to Subjects
          </Button>
        </div>
      )}

      {/* Back Button */}
      <div className="text-center pt-8">
        <Button
          variant="outline"
          size="lg"
          onClick={onBack}
          className="gap-2 hover:bg-white/80 text-gray-700 border-2 border-gray-300 font-semibold backdrop-blur-sm"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Goals Overview
        </Button>
      </div>
    </motion.div>
  );
}