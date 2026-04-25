import React from "react";
import { motion } from "framer-motion";

export default function FocusWrapper({ technique, children }) {
    // In focus mode, hide all settings and show only essential study content
    if (technique === "pomodoro") {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-4xl mx-auto"
            >
                {/* Only show the timer, no settings or side panels */}
                {children}
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
        >
            {children}
        </motion.div>
    );
}