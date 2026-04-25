import { useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const IDLE_TIMEOUT_MS = 120_000; // 2 minutes of no activity = idle
const SAVE_INTERVAL_MS = 60_000; // Save accumulated time every 60 seconds
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

/**
 * Universal activity tracker hook.
 * Tracks active time the user spends on ANY page/feature.
 * Pauses automatically when user is idle or tab is hidden.
 * 
 * Saves StudySession records periodically so ALL time (flashcards, quizzes, AI tools, etc.)
 * counts toward analytics and study hours.
 * 
 * Usage: useActivityTracker({ subject: "Biology", technique: "quiz", enabled: true })
 */
export function useActivityTracker({ subject, technique = "focused_study", enabled = true }) {
    const activeSecondsRef = useRef(0);
    const lastSaveRef = useRef(0);
    const isActiveRef = useRef(true);
    const lastActivityRef = useRef(Date.now());
    const idleCheckRef = useRef(null);
    const tickRef = useRef(null);
    const visibleRef = useRef(!document.hidden);

    const saveSession = useCallback(async () => {
        const seconds = activeSecondsRef.current - lastSaveRef.current;
        if (seconds < 30) return; // Don't save tiny fragments

        const minutes = Math.round(seconds / 60);
        if (minutes < 1) return;

        lastSaveRef.current = activeSecondsRef.current;

        try {
            await base44.entities.StudySession.create({
                subject: subject || "General",
                duration_minutes: minutes,
                technique: technique,
                date: new Date().toISOString().split("T")[0],
                productivity_rating: 3,
                notes: `Auto-tracked: ${technique} session`
            });
        } catch (e) {
            console.warn("Activity tracker: failed to save session", e);
        }
    }, [subject, technique]);

    useEffect(() => {
        if (!enabled) return;

        // Track user activity
        const onActivity = () => {
            lastActivityRef.current = Date.now();
            if (!isActiveRef.current) {
                isActiveRef.current = true;
            }
        };

        // Visibility change (tab switch / minimize)
        const onVisibility = () => {
            visibleRef.current = !document.hidden;
            if (document.hidden) {
                // Tab hidden — save immediately
                saveSession();
            }
        };

        // Tick: increment active time only when user is active AND tab is visible
        tickRef.current = setInterval(() => {
            const timeSinceActivity = Date.now() - lastActivityRef.current;
            if (timeSinceActivity > IDLE_TIMEOUT_MS) {
                isActiveRef.current = false;
            }

            if (isActiveRef.current && visibleRef.current) {
                activeSecondsRef.current += 1;
            }
        }, 1000);

        // Periodic save
        const saveInterval = setInterval(() => {
            if (activeSecondsRef.current - lastSaveRef.current >= 60) {
                saveSession();
            }
        }, SAVE_INTERVAL_MS);

        // Register event listeners
        ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
            document.removeEventListener("visibilitychange", onVisibility);
            clearInterval(tickRef.current);
            clearInterval(saveInterval);
            // Final save on unmount
            saveSession();
        };
    }, [enabled, saveSession]);

    return {
        getActiveSeconds: () => activeSecondsRef.current,
    };
}