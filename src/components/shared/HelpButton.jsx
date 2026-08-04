import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X } from "lucide-react";

// ── Help content per page ────────────────────────────────────────────────────
export const HELP_CONTENT = {
    Dashboard: {
        title: "Dashboard",
        intro: "Your home base — a live snapshot of your study progress, upcoming events, and quick actions.",
        sections: [
            { heading: "📊 Stats Bar", body: "Shows today's study time, weekly total, number of sessions, and your average quiz score. Updates automatically as you study." },
            { heading: "⚡ Quick Actions", body: "Tap any tile to jump straight to that feature — Pomodoro timer, Flashcards, Quizzes, AI Tools, Goals, or Competitions." },
            { heading: "🏆 Rank & Progress", body: "Shows your current XP level and streak. XP is earned by studying, completing quizzes, and daily streaks." },
            { heading: "📚 Recent Sessions", body: "Lists your last four study sessions with subject, duration, and your self-rated productivity." },
            { heading: "🎯 Your Goal", body: "Displays your ATAR target and dream course. Set these in the Goals page." },
            { heading: "🔔 Reminders", body: "Shows flashcard decks due for review, upcoming planner events (SACs, exams), and assessments due within 30 days." },
            { heading: "📅 Weekly Goal", body: "Tracks your progress against your weekly study hour target. Change the target in Settings." },
            { heading: "🔥 Study Streak", body: "Counts consecutive days you've studied. Complete at least one study session per day to keep it going." },
        ]
    },
    Study: {
        title: "Study",
        intro: "Five powerful study techniques to help you learn smarter. Pick a tab to get started.",
        sections: [
            { heading: "⏱ Pomodoro Timer", body: "Work in focused 25-minute sessions followed by 5-minute breaks. Start the timer, study without distractions, then log the session to earn XP." },
            { heading: "🔁 Spaced Repetition (Flashcards)", body: "Review flashcard decks using the SM-2 algorithm. Rate each card (Again / Hard / Good / Easy) and the system schedules the next review automatically. Cards due today appear first." },
            { heading: "🧠 Active Recall", body: "AI generates questions on your chosen topic. Answer them in your own words — the AI then gives feedback and a score. Great for exam prep." },
            { heading: "✍️ Blurting Method", body: "Write everything you know about a topic from memory (no notes!). Upload your notes and the AI compares what you wrote vs. the source material." },
            { heading: "📖 Revision Mode", body: "Builds a timed mock exam from your own flashcards, quizzes and active recall sets. Use this to simulate real exam conditions." },
        ]
    },
    Quizzes: {
        title: "Quizzes",
        intro: "Create, take, and review quizzes. AI can generate them from your notes in seconds.",
        sections: [
            { heading: "🤖 AI Generate", body: "Upload a PDF, DOCX, PPTX, or TXT file. Choose subject, number of questions, difficulty and style. The AI reads your material and builds a quiz. Takes ~30–60 seconds." },
            { heading: "✏️ Create Manually", body: "Build a quiz yourself — add MCQ or short answer questions, mark the correct answer, and set mark allocations for short answers." },
            { heading: "▶ Play a Quiz", body: "MCQ questions are self-marked instantly. Short answer questions are submitted and AI marks them with written feedback." },
            { heading: "🔀 Reshuffle", body: "Generates a brand-new quiz from the same uploaded document — different questions each time." },
            { heading: "🔍 Search & Filter", body: "Use the search bar or subject filter pills to find quizzes quickly across your library." },
        ]
    },
    AITools: {
        title: "AI Tools",
        intro: "A collection of AI-powered study assistants tailored for VCE students.",
        sections: [
            { heading: "📝 Essay Planner", body: "Enter your essay prompt and the AI creates a structured plan with thesis, arguments, and evidence suggestions." },
            { heading: "💡 Concept Explainer", body: "Type any concept and the AI explains it at your level with examples, analogies, and key takeaways." },
            { heading: "❓ Question Generator", body: "Upload notes or type a topic — AI produces practice exam questions including SAC-style and short answer." },
            { heading: "📋 Note Summariser", body: "Paste or upload messy notes and the AI produces a clean, structured summary with dot points and headings." },
            { heading: "📐 Math Tutor", body: "Solve maths problems step-by-step. Type the equation and get a full worked solution with explanations." },
            { heading: "🌏 English Mentor", body: "Get feedback on writing style, structure, grammar, and vocabulary. Paste a passage to get annotated feedback." },
            { heading: "🎭 Line Memoriser", body: "Paste lines for Drama or another performance subject — the AI drills you and checks your accuracy." },
            { heading: "🧑‍🏫 Teaching Assistant", body: "Explain a concept back to the AI as if you're teaching it. The AI identifies gaps in your understanding." },
            { heading: "✅ Practice Answer Generator", body: "Enter any VCE exam question, select your subject and mark allocation, and the AI writes a full-marks model answer with a breakdown of why it works." },
        ]
    },
    Goals: {
        title: "Goals & Planning",
        intro: "Set your ATAR target, break it into milestones, and plan your path to your dream course.",
        sections: [
            { heading: "🎯 ATAR Goal", body: "Enter your target ATAR, dream course, and university. This appears on your Dashboard and is used to personalise AI advice." },
            { heading: "📋 Goal List", body: "View all your goals — academic, personal, and AI-generated. Tap a goal to see sub-goals and action items." },
            { heading: "➕ Create Goal", body: "Add a new goal manually — set a title, description, target date, priority, and category." },
            { heading: "🤖 AI Goal Creator", body: "Tell the AI what you want to achieve and it builds a full goal plan with milestones, sub-goals, and suggested steps." },
            { heading: "📅 Study Planner", body: "Schedule SACs, exams, study sessions, and assignments on the calendar. Events appear in Dashboard Reminders when due soon." },
            { heading: "⚔️ Compete", body: "From a goal's detail page, tap 'Compete with Friends' to create a competition. Friends join using your invite code." },
        ]
    },
    Ranked: {
        title: "Ranked & XP",
        intro: "Track your XP, level up, maintain streaks, and see how you stack up on leaderboards.",
        sections: [
            { heading: "⭐ XP & Levels", body: "Earn XP by studying (1 XP/min), completing quizzes (based on score), and maintaining daily streaks. Each level requires more XP than the last." },
            { heading: "🔥 Streak Multiplier", body: "Longer streaks multiply XP earned. A 7-day streak gives a 1.5× bonus; 30+ days gives 2×." },
            { heading: "🏅 Daily Missions", body: "Complete today's missions (e.g., 'Study 30 minutes', 'Take a quiz') for bonus XP rewards." },
            { heading: "🏆 Leaderboard", body: "See the global ranking by XP. Toggle between All-Time and Season (monthly reset). You can appear anonymously in Settings." },
            { heading: "🏫 School Leaderboard", body: "If you join a school, you appear in that school's private leaderboard. Join via the school code in Settings." },
            { heading: "🎖 Achievements", body: "Unlock badges for milestones like first quiz, 7-day streak, 100 flashcard reviews, and more." },
        ]
    },
    Subjects: {
        title: "Subjects",
        intro: "Manage which subjects you're studying. All features (flashcards, quizzes, goals) are organised by subject.",
        sections: [
            { heading: "📚 My Subjects", body: "The subjects you've added to your personal list. These appear throughout the app for filtering and tracking." },
            { heading: "🔍 Browse Catalogue", body: "Search the full VCE subject catalogue. Click a subject card to see its overview, scaling info, and study tips." },
            { heading: "➕ Add a Subject", body: "Click 'Add to My Subjects' on any catalogue card, or create a custom subject if yours isn't listed." },
            { heading: "🎨 Colour & Settings", body: "Each subject gets a colour — used throughout the app to visually identify it. Change it by tapping the subject." },
            { heading: "📈 Scaling Info", body: "Each VCE subject card shows how it scales (e.g., +3 for Maths Methods). Higher-scaling subjects can boost your ATAR." },
        ]
    },
    Friends: {
        title: "Friends",
        intro: "Connect with other students, see their progress, and compare study stats.",
        sections: [
            { heading: "🔍 Find Friends", body: "Search by username to find other AcedIt users and send friend requests." },
            { heading: "✅ Accept Requests", body: "Incoming friend requests appear at the top. Accept or decline them." },
            { heading: "📊 Friend Stats", body: "Once connected, you can see a friend's XP, level, streak, and recent activity (if they haven't set it to private)." },
            { heading: "🔒 Privacy", body: "Toggle 'Anonymous on Leaderboard' in Settings to hide your identity from the global leaderboard." },
        ]
    },
    Competitions: {
        title: "Compete",
        intro: "Challenge friends to goal-based competitions. Race to complete your goals and win XP bonuses.",
        sections: [
            { heading: "⚔️ How Competitions Work", body: "Start a competition from a Goal's detail page. Share the 6-character invite code with friends. Everyone races to complete their goal's sub-goals first." },
            { heading: "🔗 Join by Code", body: "Paste a friend's invite code into the 'Join with invite code' bar and press Join. Choose whether to mirror their sub-goal structure or use your own." },
            { heading: "📊 Hours Battle", body: "Inside a competition, the Hours Battle tab shows a leaderboard ranked by goal progress percentage and XP earned." },
            { heading: "💰 Score Bets", body: "Place predictions on each other's SAC/assessment scores. If your prediction is closest, you win bonus XP." },
            { heading: "🏆 Winning", body: "The first person to reach 100% goal progress wins. The winner receives a bonus XP reward automatically." },
        ]
    },
    Analytics: {
        title: "Analytics",
        intro: "Deep insights into your study patterns, quiz performance, and weak topics.",
        sections: [
            { heading: "📈 Study Trends", body: "Line and bar charts showing daily/weekly study time across subjects over the past 30 days." },
            { heading: "🎯 Subject Performance", body: "Compare quiz scores and study time per subject. Quickly see which subjects need more attention." },
            { heading: "⚠️ Weak Topics", body: "AI analyses your quiz attempts and flashcard performance to identify specific topics you're struggling with." },
            { heading: "🧪 Technique Analysis", body: "See which study techniques (Pomodoro, Blurting, Active Recall) you use most and how they correlate with quiz scores." },
            { heading: "🤖 AI Performance Analyser", body: "Ask the AI questions about your own data — e.g., 'What subject should I focus on this week?'" },
        ]
    },
    Settings: {
        title: "Settings",
        intro: "Personalise your account, privacy, and study preferences.",
        sections: [
            { heading: "👤 Profile", body: "Set or change your username, school, year level, and profile picture." },
            { heading: "🔔 Study Goals", body: "Set your weekly study hour goal (used on the Dashboard weekly progress bar)." },
            { heading: "🔒 Privacy", body: "Toggle 'Anonymous on Leaderboard' so your name doesn't appear in public rankings." },
            { heading: "🎨 Appearance", body: "Switch between light and dark mode." },
            { heading: "📤 Data Export", body: "Download all your study data as a CSV for personal records or analysis." },
        ]
    },
    Subscription: {
        title: "Subscription",
        intro: "Manage your AcedIt plan and credits.",
        sections: [
            { heading: "🆓 Free Plan", body: "Includes 500 AI credits per month, access to basic flashcards, quizzes, and 3 AI tool uses per day." },
            { heading: "👑 Premium Plan", body: "Unlimited AI credits, all AI tools, advanced analytics, AI goal creator, and priority support." },
            { heading: "💳 Credits", body: "Credits are consumed when you use AI features (quiz generation, active recall, blurting, etc.). They reset monthly." },
            { heading: "🔄 Manage Plan", body: "Upgrade, downgrade, or cancel your subscription through the Stripe portal — no data is lost on downgrade." },
        ]
    },
    Support: {
        title: "Support",
        intro: "Get help, report bugs, or send feedback to the AcedIt team.",
        sections: [
            { heading: "🐛 Report a Bug", body: "Describe what went wrong and what you were doing. Include any error messages you saw." },
            { heading: "💡 Feature Request", body: "Have an idea for something that would improve AcedIt? Let us know!" },
            { heading: "📧 Response Time", body: "We aim to respond within 24–48 hours on weekdays." },
        ]
    },
};

// ── Component ────────────────────────────────────────────────────────────────
export default function HelpButton({ page, className = "" }) {
    const [open, setOpen] = useState(false);
    const content = HELP_CONTENT[page];
    if (!content) return null;

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                aria-label="Help"
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface/80 border border-border text-muted-foreground hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 shadow-sm transition-all duration-200 hover:scale-110 ${className}`}
            >
                <HelpCircle className="w-4 h-4" />
            </button>

            <AnimatePresence>
                {open && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ opacity: 0, x: 60 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 60 }}
                            transition={{ type: "spring", damping: 28, stiffness: 280 }}
                            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-surface shadow-2xl flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                                        <HelpCircle className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">How to use</p>
                                        <h2 className="text-lg font-black text-foreground">{content.title}</h2>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setOpen(false)}
                                    className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Intro */}
                            <div className="px-5 py-4 bg-indigo-50/50 border-b">
                                <p className="text-sm text-indigo-800">{content.intro}</p>
                            </div>

                            {/* Sections */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                {content.sections.map((section, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <p className="font-bold text-foreground text-sm mb-0.5">{section.heading}</p>
                                            <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t text-center">
                                <p className="text-xs text-muted-foreground/60">Still stuck? Go to <strong className="text-muted-foreground">Support</strong> to contact us.</p>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}