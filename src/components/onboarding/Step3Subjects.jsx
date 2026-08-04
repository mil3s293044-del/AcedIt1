import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, Plus, Search } from "lucide-react";

export default function Step3Subjects({ data, email, onNext, onBack, saving }) {
    const [subjects, setSubjects] = useState([]);
    const [selected, setSelected] = useState(new Set(data.enrolled_subjects || []));
    const [customInput, setCustomInput] = useState("");
    const [customSubjects, setCustomSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [savingSubjects, setSavingSubjects] = useState(false);

    useEffect(() => {
        base44.entities.VCESubject.list("name", 500)
            .then(s => {
                const publicSubjects = s.filter(sub => sub.is_private !== true);
                const seen = new Set();
                const unique = publicSubjects.filter(sub => {
                    if (seen.has(sub.name)) return false;
                    seen.add(sub.name);
                    return true;
                });
                setSubjects(unique);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const toggle = (name) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const addCustom = () => {
        const name = customInput.trim();
        if (!name) return;
        if (!customSubjects.includes(name)) setCustomSubjects(prev => [...prev, name]);
        setSelected(prev => new Set([...prev, name]));
        setCustomInput("");
    };

    // enrolled_subjects on the profile is read by nothing outside this modal —
    // the whole app (Dashboard, Study, Quizzes, every AI tool) reads UserSubject
    // rows. Writing only the profile field meant a student picked their subjects,
    // saw them confirmed on the summary screen, and landed in an app that
    // behaved as though they had none. Create the rows the app actually reads.
    const handleNext = async () => {
        const picked = Array.from(selected);
        setSavingSubjects(true);
        try {
            const existing = email
                ? await base44.entities.UserSubject.filter({ created_by: email }).catch(() => [])
                : [];
            const have = new Set((existing || []).map(s => s.subject_name));
            const catalog = new Map(subjects.map(s => [s.name, s]));

            await Promise.all(
                picked.filter(name => !have.has(name)).map(name => {
                    const match = catalog.get(name);
                    return base44.entities.UserSubject.create({
                        subject_name:   name,
                        subject_code:   match?.code || name.slice(0, 6).toUpperCase(),
                        vce_subject_id: match?.id || null,
                        year_level:     data.year_level || null,
                        is_active:      true,
                    }).catch(e => console.error("Could not create user subject:", name, e));
                })
            );
        } finally {
            setSavingSubjects(false);
        }
        onNext({ enrolled_subjects: picked });
    };

    const allSubjects = [...subjects.map(s => s.name), ...customSubjects.filter(c => !subjects.find(s => s.name === c))];
    const filteredSubjects = search.trim()
        ? allSubjects.filter(name => name.toLowerCase().includes(search.toLowerCase()))
        : allSubjects;

    return (
        <div className="max-w-2xl mx-auto px-6 py-10">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground/60 hover:text-muted-foreground mb-6">
                <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="text-2xl font-bold text-foreground mb-1">What subjects are you studying?</h2>
            <p className="text-muted-foreground text-sm mb-6">We'll use these to personalise your AI tools, quizzes, and weak topic tracking. You can change these later in Settings.</p>

            {/* Search */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                    className="pl-9 text-sm"
                    placeholder="Search subjects..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground/60 text-sm">Loading subjects...</div>
            ) : (
                <div className="flex flex-wrap gap-2 mb-6">
                    {filteredSubjects.map(name => {
                        const isSelected = selected.has(name);
                        return (
                            <button
                                key={name}
                                onClick={() => toggle(name)}
                                className="px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
                                style={isSelected ? { color: "white" } : { backgroundColor: "white", color: "#374151", borderColor: "#D1D5DB" }}
                            >
                                {name}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex gap-2 mb-4">
                <Input
                    placeholder="Add your own subject..."
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCustom()}
                    className="text-sm"
                />
                <Button type="button" variant="outline" size="sm" onClick={addCustom} className="flex-shrink-0">
                    <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
            </div>

            {selected.size === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">Select at least one subject to continue.</p>
            )}

            <Button
                onClick={handleNext}
                disabled={selected.size === 0 || saving || savingSubjects}
                className="w-full h-12 text-base font-semibold mt-4"
            >
                {saving || savingSubjects ? "Saving..." : `Next \u2192 (${selected.size} selected)`}
            </Button>
        </div>
    );
}