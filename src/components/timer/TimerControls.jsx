import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Square } from "lucide-react";

export default function TimerControls({ isRunning, onToggle, onReset, onStop }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-4"
        >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                    onClick={onToggle}
                    size="lg"
                    className={`px-8 py-4 text-lg font-medium shadow-lg ${
                        isRunning
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                >
                    {isRunning ? (
                        <>
                            <Pause className="w-5 h-5 mr-2" />
                            Pause
                        </>
                    ) : (
                        <>
                            <Play className="w-5 h-5 mr-2" />
                            Start
                        </>
                    )}
                </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                    onClick={onReset}
                    variant="outline"
                    size="lg"
                    className="px-6 py-4 text-lg font-medium shadow-lg hover:bg-gray-50"
                >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Reset
                </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                    onClick={onStop}
                    variant="outline"
                    size="lg"
                    className="px-6 py-4 text-lg font-medium shadow-lg hover:bg-gray-50"
                >
                    <Square className="w-5 h-5 mr-2" />
                    Stop
                </Button>
            </motion.div>
        </motion.div>
    );
}