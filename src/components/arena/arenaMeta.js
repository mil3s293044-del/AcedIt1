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

// Back-yourself multiplier ladder — bigger target, bigger payout. Thresholds
// are 1-week anchors, scaled down for shorter windows. MUST mirror
// STUDY_BET_LADDER / WINDOW_SCALE / studyBetMultiplier in server.mjs.
export const STUDY_BET_LADDER = {
    flashcards:    [[20, 1.1], [50, 1.25], [100, 1.5], [200, 1.8]],
    xp:            [[100, 1.1], [250, 1.25], [500, 1.5], [1000, 1.8]],
    study_minutes: [[30, 1.1], [90, 1.25], [180, 1.5], [360, 1.8]],
    quiz_marks:    [[10, 1.1], [25, 1.25], [50, 1.5], [100, 1.8]],
};
export const WINDOW_SCALE = { 24: 0.4, 72: 0.7, 168: 1.0 };

export function studyBetMultiplier(metric, target, windowHours) {
    const scale = WINDOW_SCALE[windowHours] || 1.0;
    let mult = 1.1;
    for (const [threshold, m] of STUDY_BET_LADDER[metric] || []) {
        if (target >= Math.round(threshold * scale)) mult = m;
    }
    return mult;
}

export function multiplierLabel(mult) {
    if (mult >= 1.8) return "big swing";
    if (mult >= 1.5) return "solid stretch";
    if (mult >= 1.25) return "steady push";
    return "warm-up";
}

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
