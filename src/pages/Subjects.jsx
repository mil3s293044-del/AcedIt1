import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, Plus, X, BookOpen, Shield, ChevronRight, Trash2, Eye,
    GraduationCap, Layers, Star, TrendingUp, Palette, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { VCESubject, User, UserSubject, UserProfile } from "@/entities/all";
import { useToast } from "@/components/ui/use-toast";
import { moderationPresets } from "@/components/shared/contentModeration";
import SubjectDetail from "../components/vce/SubjectDetail";

const subjectColors = [
    "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981",
    "#6366F1", "#14B8A6", "#F97316", "#EF4444", "#84CC16"
];

// ─── Mini Subject Card for Browse ─────────────────────────────────────────────

function BrowseSubjectCard({ subject, isSelected, onAdd, onRemove, onViewDetails }) {
    const bg = subject.color || "#3B82F6";
    return (
        <div className="group relative bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all duration-300">
            <div className="h-2 w-full" style={{ backgroundColor: bg }} />
            <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: bg + "18" }}>
                            <BookOpen className="w-5 h-5" style={{ color: bg }} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-slate-800 text-sm truncate">{subject.name}</h3>
                            <p className="text-xs text-slate-400 font-mono">{subject.code}</p>
                        </div>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); isSelected ? onRemove() : onAdd(); }}
                        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all text-xs font-bold ${isSelected
                            ? "bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-600"
                            : "bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600"
                            }`}
                        title={isSelected ? "Remove from my subjects" : "Add to my subjects"}
                    >
                        {isSelected ? "✓" : <Plus className="w-3.5 h-3.5" />}
                    </button>
                </div>
                {subject.overview && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">{subject.overview}</p>
                )}
                <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                        {subject.difficulty_level && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium capitalize">
                                {subject.difficulty_level}
                            </Badge>
                        )}
                        {subject.scaling_info?.scaling_factor && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                                <TrendingUp className="w-2.5 h-2.5 mr-0.5" />{subject.scaling_info.scaling_factor}
                            </Badge>
                        )}
                    </div>
                    <button onClick={onViewDetails}
                        className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold flex items-center gap-0.5 transition-colors">
                        Details <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── My Subject Card (larger, more info) ──────────────────────────────────────

function MySubjectCard({ userSubject, fullSubject, onRemove, onViewDetails }) {
    const bg = userSubject.color || fullSubject?.color || "#3B82F6";
    return (
        <div className="group relative bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="p-5 relative" style={{ background: `linear-gradient(135deg, ${bg}12, ${bg}06)` }}>
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: bg }}>
                        <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 text-base truncate">{userSubject.subject_name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge className="text-[10px] font-mono" style={{ backgroundColor: bg + "20", color: bg, border: "none" }}>
                                {userSubject.subject_code}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {userSubject.year_level || "Year 12"}
                            </Badge>
                        </div>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-all flex-shrink-0"
                        title="Remove subject"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            {fullSubject?.overview && (
                <div className="px-5 pb-2">
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{fullSubject.overview}</p>
                </div>
            )}
            <div className="px-5 pb-4 pt-2 flex items-center justify-between">
                <div className="flex gap-1.5">
                    {fullSubject?.difficulty_level && (
                        <Badge variant="outline" className="text-[10px] capitalize">{fullSubject.difficulty_level}</Badge>
                    )}
                    {fullSubject?.scaling_info?.scaling_factor && (
                        <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            <TrendingUp className="w-2.5 h-2.5 mr-0.5" />{fullSubject.scaling_info.scaling_factor}
                        </Badge>
                    )}
                    {fullSubject?.is_private && (
                        <Badge className="text-[10px] bg-purple-50 text-purple-600 border-purple-200">Custom</Badge>
                    )}
                </div>
                {fullSubject && (
                    <button onClick={onViewDetails}
                        className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold flex items-center gap-0.5 transition-colors">
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
        const [all, mine] = await Promise.all([VCESubject.list("-created_date"), UserSubject.filter({ created_by: email })]);
        setSubjects(all.filter(s => !s.is_private || s.created_by === email));
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
        setSelectedSubjectColor(subject.color || subjectColors[0]);
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
        toast({ title: "Subject created!", description: `${newSubject.name} added to your subjects.` });
        setActiveTab("my");
    };

    // ─── Detail view ──────────────────────────────────────────────────────────

    if (selectedSubject) {
        const canEdit = user && (selectedSubject.created_by === user.email || isAdmin);
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

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-black text-slate-900 flex items-center gap-2">
                            <GraduationCap className="w-7 h-7 text-indigo-600" /> My Subjects
                            {isAdmin && <Badge className="bg-purple-600 text-xs"><Shield className="w-3 h-3 mr-1" />Admin</Badge>}
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Manage your study plan and browse VCE subjects</p>
                    </div>
                    <Button onClick={() => setShowCreateDialog(true)}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/20 rounded-xl gap-2 font-bold">
                        <Plus className="w-4 h-4" /> New Subject
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 mb-6 w-fit">
                {[
                    { key: "my", label: `My Subjects (${mySelectedSubjects.length})`, icon: Star },
                    { key: "all", label: "Browse All", icon: Layers },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.key
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"}`}>
                        <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Search (for browse tab) */}
            {activeTab === "all" && (
                <div className="relative mb-6 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search subjects..." className="pl-10 bg-white border-slate-200 rounded-xl h-10" />
                </div>
            )}

            {/* MY SUBJECTS TAB */}
            {activeTab === "my" && (
                <div>
                    {mySelectedSubjects.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                <BookOpen className="w-10 h-10 text-indigo-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">No subjects yet</h3>
                            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
                                Add VCE subjects from the Browse tab or create your own custom subject
                            </p>
                            <div className="flex gap-3 justify-center">
                                <Button variant="outline" onClick={() => setActiveTab("all")} className="rounded-xl gap-2">
                                    <Layers className="w-4 h-4" /> Browse Subjects
                                </Button>
                                <Button onClick={() => setShowCreateDialog(true)} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl gap-2">
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
                            <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-500 text-sm">No subjects found</p>
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
                            <label className="text-sm font-semibold text-slate-700 mb-2 block">Year Level</label>
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
                            <label className="text-sm font-semibold text-slate-700 mb-2 block">Color</label>
                            <div className="grid grid-cols-5 gap-2">
                                {subjectColors.map(c => (
                                    <button key={c} onClick={() => setSelectedSubjectColor(c)}
                                        className={`h-10 rounded-lg transition-all ${selectedSubjectColor === c ? "ring-4 ring-offset-2 ring-indigo-400 scale-110" : "hover:scale-105"}`}
                                        style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowYearLevelDialog(false); setSelectedSubjectForYear(null); }} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleConfirmYearLevel} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">Add Subject</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Palette className="w-5 h-5 text-purple-600" /> Create Subject
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 py-3">
                        <div>
                            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Subject Name</label>
                            <Input value={newSubjectForm.name} onChange={e => setNewSubjectForm({ ...newSubjectForm, name: e.target.value })}
                                placeholder="e.g. Philosophy" className="rounded-xl" />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Subject Code</label>
                            <Input value={newSubjectForm.code} onChange={e => setNewSubjectForm({ ...newSubjectForm, code: e.target.value.toUpperCase() })}
                                placeholder="e.g. PHIL" className="rounded-xl uppercase" maxLength={10} />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Year Level</label>
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
                            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Color</label>
                            <div className="grid grid-cols-5 gap-2">
                                {subjectColors.map(c => (
                                    <button key={c} onClick={() => setNewSubjectForm({ ...newSubjectForm, color: c })}
                                        className={`h-10 rounded-lg transition-all ${newSubjectForm.color === c ? "ring-4 ring-offset-2 ring-indigo-400 scale-110" : "hover:scale-105"}`}
                                        style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>
                        {/* Preview */}
                        <div className="rounded-xl border-2 border-dashed p-3 flex items-center gap-3" style={{ borderColor: newSubjectForm.color, backgroundColor: newSubjectForm.color + "10" }}>
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: newSubjectForm.color }}>
                                <BookOpen className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">{newSubjectForm.name || "Subject Name"}</p>
                                <Badge variant="secondary" className="text-[10px] mt-0.5">{newSubjectForm.code || "CODE"}</Badge>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleCreateNewSubject} disabled={!newSubjectForm.name.trim() || !newSubjectForm.code.trim()}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl gap-1.5">
                            <Plus className="w-4 h-4" /> Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}