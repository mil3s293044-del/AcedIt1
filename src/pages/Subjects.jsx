import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, Plus, X, BookOpen, Shield, ChevronRight,
    GraduationCap, Layers, Star, TrendingUp, Palette, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { VCESubject, User, UserSubject, UserProfile } from "@/entities/all";
import { useToast } from "@/components/ui/use-toast";
import { moderationPresets } from "@/components/shared/contentModeration";
import HelpButton from "@/components/shared/HelpButton";
import SubjectDetail from "../components/vce/SubjectDetail";
import { VCE_SUBJECTS } from "@/data/vceSubjects";

// ─── Static color palette mapped to design tokens ────────────────────────────
// Pre-computed static class strings (Tailwind JIT can't see dynamic strings).
const SUBJECT_COLORS = [
    { key: "primary", tile: "bg-primary/10",  text: "text-primary",  border: "border-primary/30",  solid: "bg-primary",  ring: "ring-primary/40"  },
    { key: "xp",      tile: "bg-xp/10",       text: "text-xp",       border: "border-xp/30",       solid: "bg-xp",       ring: "ring-xp/40"       },
    { key: "streak",  tile: "bg-streak/10",   text: "text-streak",   border: "border-streak/30",   solid: "bg-streak",   ring: "ring-streak/40"   },
    { key: "chart-3", tile: "bg-chart-3/10",  text: "text-chart-3",  border: "border-chart-3/30",  solid: "bg-chart-3",  ring: "ring-chart-3/40"  },
    { key: "chart-4", tile: "bg-chart-4/10",  text: "text-chart-4",  border: "border-chart-4/30",  solid: "bg-chart-4",  ring: "ring-chart-4/40"  },
];

// Stable hash from a string id/name → palette index. Keeps deterministic per-subject color.
const hashToIndex = (str) => {
    if (!str) return 0;
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h % SUBJECT_COLORS.length;
};

const colorForSubject = (subject) =>
    SUBJECT_COLORS[hashToIndex(subject?.id || subject?.code || subject?.name || "")];

const colorByKey = (key) =>
    SUBJECT_COLORS.find(c => c.key === key) || SUBJECT_COLORS[0];

// Keep keyed values in user-facing color picker (5 token-driven swatches).
const subjectColors = SUBJECT_COLORS.map(c => c.key);

// ─── Mini Subject Card for Browse ─────────────────────────────────────────────

function BrowseSubjectCard({ subject, isSelected, onAdd, onRemove, onViewDetails }) {
    const palette = colorForSubject(subject);
    return (
        <div className="group relative card-soft overflow-hidden hover:shadow-soft transition-all duration-300">
            <div className={`h-2 w-full ${palette.solid}`} />
            <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${palette.tile}`}>
                            <BookOpen className={`w-5 h-5 ${palette.text}`} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-foreground text-sm truncate">{subject.name}</h3>
                            <p className="text-xs text-muted-foreground/60 font-mono">{subject.code}</p>
                        </div>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); isSelected ? onRemove() : onAdd(); }}
                        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all text-xs font-bold ${isSelected
                            ? "bg-primary/15 text-primary hover:bg-streak/15 hover:text-streak"
                            : "bg-secondary text-muted-foreground hover:bg-chart-4/15 hover:text-chart-4"
                            }`}
                        title={isSelected ? "Remove from my subjects" : "Add to my subjects"}
                    >
                        {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                </div>
                {subject.overview && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{subject.overview}</p>
                )}
                <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                        {subject.difficulty_level && (
                            <span className="pill bg-secondary text-muted-foreground text-[10px] py-0.5 capitalize">
                                {subject.difficulty_level}
                            </span>
                        )}
                        {subject.scaling_info?.scaling_factor && (
                            <span className="pill bg-primary/10 text-primary text-[10px] py-0.5">
                                <TrendingUp className="w-2.5 h-2.5 mr-0.5" />{subject.scaling_info.scaling_factor}
                            </span>
                        )}
                    </div>
                    <button onClick={onViewDetails}
                        className="text-xs text-chart-4 hover:text-chart-4/80 font-semibold flex items-center gap-0.5 transition-colors">
                        Details <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── My Subject Card (larger, more info) ──────────────────────────────────────

function MySubjectCard({ userSubject, fullSubject, onRemove, onViewDetails }) {
    const palette = userSubject.color
        ? colorByKey(userSubject.color)
        : colorForSubject(fullSubject || { id: userSubject.vce_subject_id, name: userSubject.subject_name, code: userSubject.subject_code });
    return (
        <div className="group relative card-soft overflow-hidden hover:shadow-soft transition-all duration-300">
            <div className={`p-5 relative ${palette.tile}`}>
                <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-soft ${palette.solid}`}>
                        <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground text-base truncate">{userSubject.subject_name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`pill text-[10px] py-0.5 font-mono ${palette.tile} ${palette.text}`}>
                                {userSubject.subject_code}
                            </span>
                            <span className="pill bg-xp/10 text-xp text-[10px] py-0.5">
                                {userSubject.year_level || "Year 12"}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-streak/10 text-streak hover:bg-streak/20 flex items-center justify-center transition-all flex-shrink-0"
                        title="Remove subject"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            {fullSubject?.overview && (
                <div className="px-5 pb-2">
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{fullSubject.overview}</p>
                </div>
            )}
            <div className="px-5 pb-4 pt-2 flex items-center justify-between">
                <div className="flex gap-1.5">
                    {fullSubject?.difficulty_level && (
                        <span className="pill bg-secondary text-muted-foreground text-[10px] py-0.5 capitalize">{fullSubject.difficulty_level}</span>
                    )}
                    {fullSubject?.scaling_info?.scaling_factor && (
                        <span className="pill bg-primary/10 text-primary text-[10px] py-0.5">
                            <TrendingUp className="w-2.5 h-2.5 mr-0.5" />{fullSubject.scaling_info.scaling_factor}
                        </span>
                    )}
                    {fullSubject?.is_private && (
                        <span className="pill bg-chart-4/10 text-chart-4 text-[10px] py-0.5">Custom</span>
                    )}
                </div>
                {fullSubject && (
                    <button onClick={onViewDetails}
                        className="text-xs text-chart-4 hover:text-chart-4/80 font-semibold flex items-center gap-0.5 transition-colors">
                        Details <ChevronRight className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Subjects() {
    const [subjects, setSubjects] = useState([]);
    const [mySubjects, setMySubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState("my");
    const [showYearLevelDialog, setShowYearLevelDialog] = useState(false);
    const [selectedSubjectForYear, setSelectedSubjectForYear] = useState(null);
    const [selectedYearLevel, setSelectedYearLevel] = useState("Year 12 Units 3&4");
    const [selectedSubjectColor, setSelectedSubjectColor] = useState("");
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newSubjectForm, setNewSubjectForm] = useState({ name: "", code: "", year_level: "Year 12 Units 3&4", color: subjectColors[0] });
    const { toast } = useToast();

    const isAdmin = user?.role === "admin";

    useEffect(() => {
        const init = async () => {
            const currentUser = await User.me();
            setUser(currentUser);
            await loadData(currentUser.email);
        };
        init();
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const loadData = useCallback(async (email) => {
        const [all, mine] = await Promise.all([
            VCESubject.list("-created_date").catch(() => []),
            UserSubject.filter({ created_by: email }).catch(() => []),
        ]);
        // Static catalog is canonical for official VCE subjects. Backend entity
        // is only consulted for the user's own private custom subjects — this
        // prevents stale/glitched legacy entries (VET Hebrew, random duplicates,
        // outdated official subjects) from appearing in the browse list.
        const customSubjects = (all || []).filter(s => s.is_private && s.created_by === email);
        setSubjects([...VCE_SUBJECTS, ...customSubjects]);
        setMySubjects(mine);
    }, []);

    const isSubjectInMyList = useCallback((id) => mySubjects.some(us => us.vce_subject_id === id), [mySubjects]);

    const filteredSubjects = useMemo(() => subjects.filter(s =>
        s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || s.code.toLowerCase().includes(debouncedSearch.toLowerCase())
    ), [subjects, debouncedSearch]);

    const mySelectedSubjects = useMemo(() => mySubjects.map(us => ({
        ...us, fullSubject: subjects.find(s => s.id === us.vce_subject_id)
    })), [mySubjects, subjects]);

    // ─── Handlers ──────────────────────────────────────────────────────────────

    const handleAddSubject = (subject) => {
        setSelectedSubjectForYear(subject);
        setSelectedSubjectColor(subject.color || colorForSubject(subject).key);
        setShowYearLevelDialog(true);
    };

    const handleConfirmYearLevel = async () => {
        if (!selectedSubjectForYear) return;
        await UserSubject.create({
            subject_name: selectedSubjectForYear.name,
            subject_code: selectedSubjectForYear.code,
            vce_subject_id: selectedSubjectForYear.id,
            color: selectedSubjectColor,
            year_level: selectedYearLevel
        });
        if (user?.email) {
            const profiles = await UserProfile.filter({ created_by: user.email });
            if (profiles[0]) await UserProfile.update(profiles[0].id, { onboarding_tasks: { ...profiles[0].onboarding_tasks, subjects_selected: true } });
        }
        toast({ title: "Added!", description: `${selectedSubjectForYear.name} added to your subjects.` });
        setShowYearLevelDialog(false);
        setSelectedSubjectForYear(null);
        setSelectedYearLevel("Year 12 Units 3&4");
        if (user?.email) await loadData(user.email);
    };

    const handleRemoveSubject = async (userSubjectId) => {
        await UserSubject.delete(userSubjectId);
        toast({ title: "Removed", description: "Subject removed from your list." });
        if (user?.email) await loadData(user.email);
    };

    const handleRemoveByVCEId = async (vceId) => {
        const us = mySubjects.find(x => x.vce_subject_id === vceId);
        if (us) await handleRemoveSubject(us.id);
    };

    const handleCreateNewSubject = async () => {
        if (!newSubjectForm.name.trim() || !newSubjectForm.code.trim()) {
            toast({ title: "Missing fields", description: "Please fill in subject name and code.", variant: "destructive" });
            return;
        }
        try {
            const mod = await moderationPresets.note(`Subject Name: ${newSubjectForm.name}\nCode: ${newSubjectForm.code}`);
            if (!mod.isAllowed) {
                toast({ title: "Content Policy Violation", description: "Please use appropriate content.", variant: "destructive" });
                return;
            }
        } catch {}

        try {
            const newSubject = await VCESubject.create({
                name: newSubjectForm.name.trim(), code: newSubjectForm.code.trim(),
                color: newSubjectForm.color, overview: newSubjectForm.name.trim(), is_private: true
            });
            await UserSubject.create({
                subject_name: newSubject.name, subject_code: newSubject.code,
                vce_subject_id: newSubject.id, color: newSubjectForm.color,
                year_level: newSubjectForm.year_level, is_active: true
            });
            if (user?.email) {
                const profiles = await UserProfile.filter({ created_by: user.email });
                if (profiles[0]) await UserProfile.update(profiles[0].id, { onboarding_tasks: { ...profiles[0].onboarding_tasks, subjects_selected: true } });
            }
            setNewSubjectForm({ name: "", code: "", year_level: "Year 12 Units 3&4", color: subjectColors[0] });
            setShowCreateDialog(false);
            if (user?.email) await loadData(user.email);
            toast({ title: "Subject created", description: `${newSubject.name} added to your subjects.` });
            setActiveTab("my");
        } catch (err) {
            console.error("[Subjects] custom subject create failed:", err);
            toast({
                title: "Couldn't create subject",
                description: err?.message || "Something went wrong. Try again in a moment.",
                variant: "destructive",
            });
        }
    };

    // ─── Detail view ──────────────────────────────────────────────────────────

    if (selectedSubject) {
        // Static catalog entries can't be edited or deleted via the UI.
        const canEdit = !selectedSubject.is_static && user && (selectedSubject.created_by === user.email || isAdmin);
        return (
            <SubjectDetail
                subject={selectedSubject}
                onBack={() => setSelectedSubject(null)}
                onEdit={canEdit ? () => setSelectedSubject(null) : null}
                onDelete={canEdit ? async () => { await VCESubject.delete(selectedSubject.id); setSelectedSubject(null); if (user?.email) await loadData(user.email); } : null}
            />
        );
    }

    // ─── Main view ────────────────────────────────────────────────────────────

    const newFormPalette = colorByKey(newSubjectForm.color);

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">

                {/* ── HERO ──────────────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                >
                    <div className="flex items-start justify-between mb-1">
                        <p className="text-sm text-muted-foreground font-medium">Curriculum</p>
                        <HelpButton page="Subjects" />
                    </div>
                    <h1 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
                        Subjects
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm lg:text-base">
                        Browse VCE subjects and pick what you're studying this year.
                    </p>
                </motion.section>

                {/* Header actions */}
                <div>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                                <GraduationCap className="w-5 h-5 text-chart-4" />
                            </div>
                            <div>
                                <h2 className="font-display font-extrabold text-foreground text-base flex items-center gap-2">
                                    My Subjects
                                    {isAdmin && (
                                        <span className="pill bg-chart-4/15 text-chart-4 text-[10px] py-0.5">
                                            <Shield className="w-3 h-3 mr-1" />Admin
                                        </span>
                                    )}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Manage your study plan and browse VCE subjects</p>
                            </div>
                        </div>
                        <Button onClick={() => setShowCreateDialog(true)}
                            className="bg-chart-4 hover:bg-chart-4/90 text-white shadow-soft rounded-xl gap-2 font-bold">
                            <Plus className="w-4 h-4" /> New Subject
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-secondary rounded-2xl p-1 w-fit shadow-soft">
                    {[
                        { key: "my", label: `My Subjects (${mySelectedSubjects.length})`, icon: Star },
                        { key: "all", label: "Browse All", icon: Layers },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.key
                                ? "bg-foreground text-background shadow-soft"
                                : "text-muted-foreground hover:text-foreground"}`}>
                            <tab.icon className="w-4 h-4" /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Search (for browse tab) */}
                {activeTab === "all" && (
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                        <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search subjects..." className="pl-10 bg-surface border-border rounded-xl h-10" />
                    </div>
                )}

                {/* MY SUBJECTS TAB */}
                {activeTab === "my" && (
                    <div>
                        {mySelectedSubjects.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="w-20 h-20 bg-chart-4/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                    <BookOpen className="w-10 h-10 text-chart-4" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground mb-1">No subjects yet</h3>
                                <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                                    Add VCE subjects from the Browse tab or create your own custom subject
                                </p>
                                <div className="flex gap-3 justify-center">
                                    <Button variant="outline" onClick={() => setActiveTab("all")} className="rounded-xl gap-2">
                                        <Layers className="w-4 h-4" /> Browse Subjects
                                    </Button>
                                    <Button onClick={() => setShowCreateDialog(true)} className="bg-chart-4 hover:bg-chart-4/90 text-white rounded-xl gap-2">
                                        <Plus className="w-4 h-4" /> Create Subject
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <AnimatePresence mode="popLayout">
                                    {mySelectedSubjects.map(us => (
                                        <motion.div key={us.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
                                            <MySubjectCard
                                                userSubject={us}
                                                fullSubject={us.fullSubject}
                                                onRemove={() => handleRemoveSubject(us.id)}
                                                onViewDetails={() => us.fullSubject && setSelectedSubject(us.fullSubject)}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                )}

                {/* BROWSE TAB */}
                {activeTab === "all" && (
                    <div>
                        {filteredSubjects.length === 0 ? (
                            <div className="text-center py-16">
                                <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
                                <p className="text-muted-foreground text-sm">No subjects found</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                <AnimatePresence mode="popLayout">
                                    {filteredSubjects.map((subject, i) => (
                                        <motion.div key={subject.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                                            <BrowseSubjectCard
                                                subject={subject}
                                                isSelected={isSubjectInMyList(subject.id)}
                                                onAdd={() => handleAddSubject(subject)}
                                                onRemove={() => handleRemoveByVCEId(subject.id)}
                                                onViewDetails={() => setSelectedSubject(subject)}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                )}

                {/* Year Level Dialog */}
                <Dialog open={showYearLevelDialog} onOpenChange={setShowYearLevelDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold">Add {selectedSubjectForYear?.name}</DialogTitle>
                        </DialogHeader>
                        <div className="py-4 space-y-5">
                            <div>
                                <label className="text-sm font-semibold text-foreground mb-2 block">Year Level</label>
                                <Select value={selectedYearLevel} onValueChange={setSelectedYearLevel}>
                                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Year 9">Year 9</SelectItem>
                                        <SelectItem value="Year 10">Year 10</SelectItem>
                                        <SelectItem value="Year 11 Units 1&2">Year 11 Units 1&2</SelectItem>
                                        <SelectItem value="Year 12 Units 3&4">Year 12 Units 3&4</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-foreground mb-2 block">Color</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {SUBJECT_COLORS.map(c => (
                                        <button key={c.key} onClick={() => setSelectedSubjectColor(c.key)}
                                            className={`h-10 rounded-lg transition-all ${c.solid} ${selectedSubjectColor === c.key ? `ring-4 ring-offset-2 ${c.ring} scale-110` : "hover:scale-105"}`} />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setShowYearLevelDialog(false); setSelectedSubjectForYear(null); }} className="rounded-xl">Cancel</Button>
                            <Button onClick={handleConfirmYearLevel} className="bg-chart-4 hover:bg-chart-4/90 text-white rounded-xl">Add Subject</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Create Dialog */}
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <Palette className="w-5 h-5 text-chart-4" /> Create Subject
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-5 py-3">
                            <div>
                                <label className="text-sm font-semibold text-foreground mb-1.5 block">Subject Name</label>
                                <Input value={newSubjectForm.name} onChange={e => setNewSubjectForm({ ...newSubjectForm, name: e.target.value })}
                                    placeholder="e.g. Philosophy" className="rounded-xl" />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-foreground mb-1.5 block">Subject Code</label>
                                <Input value={newSubjectForm.code} onChange={e => setNewSubjectForm({ ...newSubjectForm, code: e.target.value.toUpperCase() })}
                                    placeholder="e.g. PHIL" className="rounded-xl uppercase" maxLength={10} />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-foreground mb-1.5 block">Year Level</label>
                                <Select value={newSubjectForm.year_level} onValueChange={v => setNewSubjectForm({ ...newSubjectForm, year_level: v })}>
                                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Year 9">Year 9</SelectItem>
                                        <SelectItem value="Year 10">Year 10</SelectItem>
                                        <SelectItem value="Year 11 Units 1&2">Year 11 Units 1&2</SelectItem>
                                        <SelectItem value="Year 12 Units 3&4">Year 12 Units 3&4</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-foreground mb-1.5 block">Color</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {SUBJECT_COLORS.map(c => (
                                        <button key={c.key} onClick={() => setNewSubjectForm({ ...newSubjectForm, color: c.key })}
                                            className={`h-10 rounded-lg transition-all ${c.solid} ${newSubjectForm.color === c.key ? `ring-4 ring-offset-2 ${c.ring} scale-110` : "hover:scale-105"}`} />
                                    ))}
                                </div>
                            </div>
                            {/* Preview */}
                            <div className={`rounded-xl border-2 border-dashed p-3 flex items-center gap-3 ${newFormPalette.border} ${newFormPalette.tile}`}>
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${newFormPalette.solid}`}>
                                    <BookOpen className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="font-bold text-foreground text-sm">{newSubjectForm.name || "Subject Name"}</p>
                                    <span className="pill bg-secondary text-muted-foreground text-[10px] py-0.5 mt-0.5 inline-flex">{newSubjectForm.code || "CODE"}</span>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="rounded-xl">Cancel</Button>
                            <Button onClick={handleCreateNewSubject} disabled={!newSubjectForm.name.trim() || !newSubjectForm.code.trim()}
                                className="bg-chart-4 hover:bg-chart-4/90 text-white rounded-xl gap-1.5">
                                <Plus className="w-4 h-4" /> Create
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
