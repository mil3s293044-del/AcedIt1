import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music, Play, RefreshCw } from "lucide-react";

const musicRecommendations = [
    { title: "Lo-fi Hip Hop Study", description: "Relaxing beats for deep focus", genre: "Lo-fi", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk", duration: "Live", color: "blue" },
    { title: "Classical Focus Music", description: "Mozart and Bach for concentration", genre: "Classical", url: "https://www.youtube.com/watch?v=VF7pqGCUW5Y", duration: "3h", color: "purple" },
    { title: "Nature Sounds Study", description: "Rain and forest sounds", genre: "Ambient", url: "https://www.youtube.com/watch?v=nDq6TstdEi8", duration: "2h", color: "green" },
    { title: "Piano Study Music", description: "Peaceful piano melodies", genre: "Instrumental", url: "https://www.youtube.com/watch?v=6udVHCi-4jw", duration: "4h", color: "orange" },
    { title: "Binaural Beats Focus", description: "40Hz focus frequency", genre: "Binaural", url: "https://www.youtube.com/watch?v=iJL-0Le57zk", duration: "1h", color: "pink" },
    { title: "Cafe Ambience", description: "Coffee shop background sounds", genre: "Ambient", url: "https://www.youtube.com/watch?v=h2zkV-l_TbY", duration: "8h", color: "indigo" },
    { title: "Epic Study Orchestra", description: "Motivating orchestral music", genre: "Classical", url: "https://www.youtube.com/watch?v=tCYWymG9fSs", duration: "2h", color: "red" },
    { title: "Deep Focus Flow", description: "Electronic ambient soundscapes", genre: "Electronic", url: "https://www.youtube.com/watch?v=5qap5aO4i9A", duration: "3h", color: "cyan" },
    { title: "Study with Me - Pomodoro", description: "Pomodoro timer with music", genre: "Lo-fi", url: "https://www.youtube.com/watch?v=AbHj16N23fY", duration: "Live", color: "teal" },
    { title: "White Noise Study", description: "Pure white noise for blocking distractions", genre: "Noise", url: "https://www.youtube.com/watch?v=nMfPqeZjc2c", duration: "10h", color: "gray" },
    { title: "Jazz Study Session", description: "Smooth jazz for relaxed studying", genre: "Jazz", url: "https://www.youtube.com/watch?v=Dx5qFachd3A", duration: "Live", color: "amber" },
    { title: "Anime Study Beats", description: "Chill anime OST compilation", genre: "Lo-fi", url: "https://www.youtube.com/watch?v=wrB_LnLhV2c", duration: "2h", color: "fuchsia" }
];

export default function StudyMusicRecommendations() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [displayCount] = useState(3);

    const shuffle = () => {
        setCurrentIndex((prev) => (prev + displayCount) % musicRecommendations.length);
    };

    const currentRecommendations = [
        musicRecommendations[currentIndex % musicRecommendations.length],
        musicRecommendations[(currentIndex + 1) % musicRecommendations.length],
        musicRecommendations[(currentIndex + 2) % musicRecommendations.length]
    ];

    const genreColors = {
        blue: "bg-blue-100 text-blue-800",
        purple: "bg-purple-100 text-purple-800",
        green: "bg-green-100 text-green-800",
        orange: "bg-orange-100 text-orange-800",
        pink: "bg-pink-100 text-pink-800",
        indigo: "bg-indigo-100 text-indigo-800",
        red: "bg-red-100 text-red-800",
        cyan: "bg-cyan-100 text-cyan-800",
        teal: "bg-teal-100 text-teal-800",
        gray: "bg-gray-100 text-gray-800",
        amber: "bg-amber-100 text-amber-800",
        fuchsia: "bg-fuchsia-100 text-fuchsia-800"
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
        >
            <Card className="relative overflow-hidden border-0 shadow-lg">
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-indigo-500/10" />
                
                {/* Animated circles */}
                <motion.div
                    animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.05, 0.1, 0.05]
                    }}
                    transition={{ duration: 5, repeat: Infinity }}
                    className="absolute bottom-0 left-0 w-32 h-32 bg-purple-400 rounded-full blur-3xl"
                />

                <CardContent className="relative p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <Music className="w-4 h-4 text-white" />
                            </div>
                            <h3 className="font-semibold text-gray-900">Study Music</h3>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={shuffle}
                            className="hover:bg-purple-100/50 text-purple-700"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                    
                    <div className="space-y-2">
                        <AnimatePresence mode="wait">
                            {currentRecommendations.map((music, index) => (
                                <motion.div
                                    key={`${currentIndex}-${index}`}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <button
                                        onClick={() => window.open(music.url, '_blank')}
                                        className="w-full flex items-center gap-3 p-3 bg-white/70 hover:bg-white border border-gray-200/50 hover:border-purple-300 rounded-lg transition-all group"
                                    >
                                        <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Play className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <p className="font-semibold text-sm text-gray-900 truncate">{music.title}</p>
                                            <p className="text-xs text-gray-600 truncate">{music.description}</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Badge className={`text-xs ${genreColors[music.color]}`}>
                                                {music.genre}
                                            </Badge>
                                            <span className="text-xs text-gray-500">{music.duration}</span>
                                        </div>
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                    
                    <p className="text-xs text-center text-gray-500 mt-3">
                        Click any track to open in YouTube
                    </p>
                </CardContent>
            </Card>
        </motion.div>
    );
}