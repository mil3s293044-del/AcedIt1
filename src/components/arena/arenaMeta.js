// Shared arena metadata — keep in sync with the server's ARENA_METRICS,
// DUEL_WINDOWS and stake bounds in server.mjs.
import { Zap, FileText, Layers, Clock } from "lucide-react";

export const METRICS = {
    xp:            { label: "Total XP",       unit: "XP",    icon: Zap,      blurb: "Every study action counts" },
    quiz_marks:    { label: "Quiz marks",     unit: "marks", icon: FileText, blurb: "Marks earned across quizzes" },
    flashcards:    { label: "Cards reviewed", unit: "cards", icon: Layers,   blurb: "Flashcards cleared" },
    study_minutes: { label: "Study minutes",  unit: "min",   icon: Clock,    blurb: "Focused minutes logged" },
};

export const WINDOWS = [
    { hours: 24,  label: "24 hours", short: "24h" },
    { hours: 72,  label: "3 days",   short: "3d" },
    { hours: 168, label: "1 week",   short: "1w" },
];

export const ANTE_OPTIONS = [25, 50, 100, 200];
export const SIDE_BET_OPTIONS = [25, 50, 100, 200];
export const STUDY_BET_MULT = 1.5;
export const SIDE_BET_MULT = 1.8;

// Minimum back-yourself targets — mirror STUDY_BET_MIN_TARGET server-side.
export const STUDY_BET_MIN_TARGET = { xp: 100, quiz_marks: 10, flashcards: 20, study_minutes: 30 };

export function timeLeft(endsAt) {
    const ms = new Date(endsAt) - Date.now();
    if (ms <= 0) return { done: true, label: "Time's up", urgent: true };
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h >= 48) return { done: false, label: `${Math.floor(h / 24)}d ${h % 24}h left`, urgent: false };
    if (h >= 1) return { done: false, label: `${h}h ${m}m left`, urgent: h < 6 };
    return { done: false, label: `${m}m left`, urgent: true };
}

export function firstName(name) {
    return (name || "").split(" ")[0] || name || "?";
}
