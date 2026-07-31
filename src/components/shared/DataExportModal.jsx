import React, { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Download, FileText, Table, Loader2, BookOpen, Zap, Target, Brain, Calendar } from "lucide-react";
import jsPDF from "jspdf";

const EXPORTS = [
    { id: "study_sessions", label: "Study Sessions", icon: BookOpen, color: "bg-blue-100 text-blue-700", desc: "All recorded study technique sessions" },
    { id: "quiz_attempts",  label: "Quiz Attempts",  icon: Brain,    color: "bg-purple-100 text-purple-700", desc: "Quiz history with scores & XP earned" },
    { id: "flashcards",     label: "Flashcards",     icon: Zap,      color: "bg-amber-100 text-amber-700",  desc: "All your flashcard decks & review stats" },
    { id: "goals",          label: "Goals",          icon: Target,   color: "bg-green-100 text-green-700",  desc: "Goals with progress & sub-goals" },
    { id: "study_plan",     label: "Study Schedule", icon: Calendar, color: "bg-pink-100 text-pink-700",    desc: "Your planned study sessions" },
    { id: "full_report",    label: "Full Report",    icon: FileText, color: "bg-indigo-100 text-indigo-700", desc: "Complete PDF summary of all your data" },
];

function toCSV(headers, rows) {
    const escape = (v) => {
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
    };
    return [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
}

function downloadCSV(filename, csv) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function downloadPDF(filename, title, sections) {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageW, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("StudyMate VCE", 10, 9);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString("en-AU")}`, pageW - 10, 9, { align: "right" });

    y = 25;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(title, 10, y); y += 10;

    for (const section of sections) {
        if (y > 260) { doc.addPage(); y = 20; }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(79, 70, 229);
        doc.text(section.heading, 10, y); y += 6;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);

        for (const line of section.lines) {
            if (y > 275) { doc.addPage(); y = 20; }
            const wrapped = doc.splitTextToSize(line, pageW - 20);
            doc.text(wrapped, 10, y);
            y += wrapped.length * 5;
        }
        y += 4;
    }

    doc.save(filename);
}

export default function DataExportModal({ open, onClose }) {
    const [loading, setLoading] = useState({});
    const { toast } = useToast();

    const setLoad = (id, val) => setLoading(p => ({ ...p, [id]: val }));

    const exportData = async (id, format) => {
        setLoad(id, format);
        try {
            const user = await base44.auth.me();

            if (id === "study_sessions") {
                const data = await base44.entities.StudyTechnique.filter({ created_by: user.email });
                if (format === "csv") {
                    const csv = toCSV(
                        ["Date", "Technique", "Subject", "Topic", "Duration (min)", "Difficulty", "Confidence", "XP Earned", "Notes"],
                        data.map(r => [r.date, r.technique_name, r.subject, r.topic || "", r.session_duration, r.difficulty_rating || "", r.confidence_rating || "", r.xp_earned || 0, r.notes || ""])
                    );
                    downloadCSV("study_sessions.csv", csv);
                } else {
                    downloadPDF("study_sessions.pdf", "Study Sessions Report", [{
                        heading: `${data.length} Sessions Recorded`,
                        lines: data.slice(0, 100).map(r => `${r.date} | ${r.technique_name} | ${r.subject}${r.topic ? ` — ${r.topic}` : ""} | ${r.session_duration}min | XP: ${r.xp_earned || 0}`)
                    }]);
                }
            }

            else if (id === "quiz_attempts") {
                const data = await base44.entities.QuizAttempt.filter({ created_by: user.email });
                if (format === "csv") {
                    const csv = toCSV(
                        ["Date", "Quiz Title", "Category", "Score (%)", "Correct", "Total", "XP Earned", "Time (s)"],
                        data.map(r => [r.date, r.quiz_title, r.quiz_category, r.score, r.questions_correct, r.questions_total, r.xp_earned || 0, r.time_taken || ""])
                    );
                    downloadCSV("quiz_attempts.csv", csv);
                } else {
                    const avg = data.length ? Math.round(data.reduce((s, r) => s + r.score, 0) / data.length) : 0;
                    downloadPDF("quiz_attempts.pdf", "Quiz Attempts Report", [
                        { heading: "Summary", lines: [`Total Quizzes: ${data.length}`, `Average Score: ${avg}%`, `Total XP Earned: ${data.reduce((s, r) => s + (r.xp_earned || 0), 0)}`] },
                        { heading: "All Attempts", lines: data.slice(0, 100).map(r => `${r.date} | ${r.quiz_title} | ${r.score}% (${r.questions_correct}/${r.questions_total}) | XP: ${r.xp_earned || 0}`) }
                    ]);
                }
            }

            else if (id === "flashcards") {
                const data = await base44.entities.Flashcard.filter({ created_by: user.email });
                if (format === "csv") {
                    const csv = toCSV(
                        ["Subject", "Unit", "Topic", "Question", "Answer", "Total Reviews", "Successful Reviews", "Ease Factor", "Next Review", "Is Weak Spot"],
                        data.map(r => [r.subject_name, r.unit || "", r.topic || "", r.question, r.answer, r.total_reviews || 0, (r.review_count_good || 0) + (r.review_count_easy || 0), r.easiness_factor || 2.5, r.next_review_date || "", r.is_weak_spot ? "Yes" : "No"])
                    );
                    downloadCSV("flashcards.csv", csv);
                } else {
                    downloadPDF("flashcards.pdf", "Flashcards Export", [{
                        heading: `${data.length} Flashcards`,
                        lines: data.slice(0, 100).map(r => `[${r.subject_name}] Q: ${r.question.slice(0, 60)}${r.question.length > 60 ? "…" : ""} | Reviews: ${r.total_reviews || 0}`)
                    }]);
                }
            }

            else if (id === "goals") {
                const data = await base44.entities.Goal.filter({ created_by: user.email });
                if (format === "csv") {
                    const csv = toCSV(
                        ["Title", "Category", "Priority", "Progress (%)", "Completed", "Target Date", "Difficulty", "Total XP Reward"],
                        data.map(r => [r.title, r.category, r.priority, r.progress || 0, r.is_completed ? "Yes" : "No", r.target_date || "", r.difficulty_level || "", r.total_xp_reward || 0])
                    );
                    downloadCSV("goals.csv", csv);
                } else {
                    downloadPDF("goals.pdf", "Goals Report", [
                        { heading: "Summary", lines: [`Total Goals: ${data.length}`, `Completed: ${data.filter(g => g.is_completed).length}`, `In Progress: ${data.filter(g => !g.is_completed).length}`] },
                        { heading: "Goal Details", lines: data.slice(0, 80).map(r => `${r.is_completed ? "✓" : "○"} ${r.title} | ${r.category} | ${r.progress || 0}% | Due: ${r.target_date || "N/A"}`) }
                    ]);
                }
            }

            else if (id === "study_plan") {
                const data = await base44.entities.StudyPlan.filter({ created_by: user.email });
                if (format === "csv") {
                    const csv = toCSV(
                        ["Date", "Title", "Subject", "Study Type", "Start Time", "End Time", "Completed"],
                        data.map(r => [r.date, r.title, r.subject_name || "", r.study_type, r.start_time, r.end_time, r.is_completed ? "Yes" : "No"])
                    );
                    downloadCSV("study_schedule.csv", csv);
                } else {
                    downloadPDF("study_schedule.pdf", "Study Schedule Export", [{
                        heading: `${data.length} Scheduled Sessions`,
                        lines: data.slice(0, 100).map(r => `${r.date} ${r.start_time}-${r.end_time} | ${r.title}${r.subject_name ? ` (${r.subject_name})` : ""} | ${r.is_completed ? "Done" : "Pending"}`)
                    }]);
                }
            }

            else if (id === "full_report") {
                const [sessions, quizzes, flashcards, goals, profile] = await Promise.all([
                    base44.entities.StudyTechnique.filter({ created_by: user.email }),
                    base44.entities.QuizAttempt.filter({ created_by: user.email }),
                    base44.entities.Flashcard.filter({ created_by: user.email }),
                    base44.entities.Goal.filter({ created_by: user.email }),
                    base44.entities.UserProfile.filter({ created_by: user.email }).then(d => d[0] || {}),
                ]);
                const totalStudyHrs = Math.round(sessions.reduce((s, r) => s + (r.session_duration || 0), 0) / 60);
                const avgScore = quizzes.length ? Math.round(quizzes.reduce((s, r) => s + r.score, 0) / quizzes.length) : 0;
                downloadPDF("full_report.pdf", `StudyMate Full Report — ${user.full_name}`, [
                    { heading: "Profile Overview", lines: [
                        `Name: ${user.full_name}`, `Email: ${user.email}`,
                        `Level: ${profile.current_level || 1}`, `Total XP: ${(profile.total_xp || 0).toLocaleString()}`,
                        `Study Streak: ${profile.streak_days || 0} days`, `School: ${profile.school_name || "Not set"}`,
                    ]},
                    { heading: "Study Sessions", lines: [
                        `Total Sessions: ${sessions.length}`, `Total Study Time: ${totalStudyHrs} hours`,
                        `Most Used Technique: ${sessions.length ? sessions.sort((a, b) => sessions.filter(s => s.technique_name === b.technique_name).length - sessions.filter(s => s.technique_name === a.technique_name).length)[0].technique_name : "N/A"}`,
                    ]},
                    { heading: "Quiz Performance", lines: [
                        `Quizzes Taken: ${quizzes.length}`, `Average Score: ${avgScore}%`,
                        `Best Score: ${quizzes.length ? Math.max(...quizzes.map(q => q.score)) : 0}%`,
                        `Total XP from Quizzes: ${quizzes.reduce((s, q) => s + (q.xp_earned || 0), 0).toLocaleString()}`,
                    ]},
                    { heading: "Flashcards", lines: [
                        `Total Flashcards: ${flashcards.length}`, `Active: ${flashcards.filter(f => f.is_active).length}`,
                        `Weak Spots: ${flashcards.filter(f => f.is_weak_spot).length}`,
                        `Total Reviews Completed: ${flashcards.reduce((s, f) => s + (f.total_reviews || 0), 0)}`,
                    ]},
                    { heading: "Goals", lines: [
                        `Total Goals: ${goals.length}`, `Completed: ${goals.filter(g => g.is_completed).length}`,
                        `Completion Rate: ${goals.length ? Math.round((goals.filter(g => g.is_completed).length / goals.length) * 100) : 0}%`,
                    ]},
                ]);
            }

            toast({ title: `${id.replace(/_/g, " ")} exported successfully!` });
        } catch (e) {
            toast({ title: "Export failed", description: e.message, variant: "destructive" });
        } finally {
            setLoad(id, null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Download className="w-5 h-5 text-indigo-600" />
                        Export Your Data
                    </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground -mt-2">Download your study data as CSV (spreadsheet) or PDF (report).</p>
                <div className="space-y-2 mt-2 max-h-[60vh] overflow-y-auto pr-1">
                    {EXPORTS.map(({ id, label, icon: Icon, color, desc }) => (
                        <motion.div key={id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/50/60 hover:bg-surface hover:shadow-sm transition-all">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center`}>
                                    <Icon className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm text-foreground">{label}</p>
                                    <p className="text-xs text-muted-foreground/60">{desc}</p>
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                {id !== "full_report" && (
                                    <Button size="sm" variant="outline" disabled={!!loading[id]} onClick={() => exportData(id, "csv")}
                                        className="h-8 text-xs gap-1 border-border">
                                        {loading[id] === "csv" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Table className="w-3 h-3" />}
                                        CSV
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" disabled={!!loading[id]} onClick={() => exportData(id, "pdf")}
                                    className="h-8 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                                    {loading[id] === "pdf" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                                    PDF
                                </Button>
                            </div>
                        </motion.div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground/60 text-center mt-1">Data is exported directly from your account — no server needed.</p>
            </DialogContent>
        </Dialog>
    );
}