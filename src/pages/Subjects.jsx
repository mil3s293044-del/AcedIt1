import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, Plus, X, BookOpen, Shield, ChevronRight,
    GraduationCap, Layers, Star, Palette, Check
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
import { colorFor, subjectColor, SUBJECT_PALETTE } from "@/components/cards/cardIdentity";
import { alpha } from "@/components/cards/PlayingCard";
import ScoreCurve from "@/components/subjects/ScoreCurve";
import { hueOf, scaledScore, clampScore } from "@/lib/studyScore";
import ScalingMark from "@/components/subjects/ScalingMark";
import LoadStrip from "@/components/subjects/LoadStrip";
import {
    LEARNING_AREAS, SORTS, areaOf, sortSubjects, groupByArea, loadSummary,
    prerequisiteOf,
} from "@/lib/subjectBrowse";
import { deckCards, BANK_TOPIC } from "@/lib/mistakeBank";
import { studyEvents } from "@/lib/studyLog";
import { subjectStats, subjectLead } from "@/lib/subjectHub";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

/**
 * Subject colour comes from cardIdentity, and only from there.
 *
 * This page used to own a second, incompatible colour scheme: five entries
 * keyed to design tokens ("primary", "xp", "chart-3"), hashed with h*31 over
 * id-or-code-or-name, and written into `user_subjects.color` as the KEY. Every
 * card elsewhere in the app read that same column expecting hex and handed it
 * to PlayingCard's `tone`, where the hex regex rejected "primary" and the
 * colour silently vanished. So a subject was one colour here, a different
 * colour in the card deck's hash, and no colour at all on the card itself.
 *
 * One palette, one hash, one format: hex, from `colorFor`. The tiles that used
 * pre-computed Tailwind classes are inline styles now, which is what let the
 * palette grow from five to ten — a token class has to be a static string for
 * the JIT to see it, and a hex does not.
 */
const swatch = (hex) => ({
    solid:  { backgroundColor: hex },
    tile:   { backgroundColor: alpha(hex, 0.10) },
    text:   { color: hex },
    border: { borderColor: alpha(hex, 0.30) },
});

// ─── Mini Subject Card for Browse ─────────────────────────────────────────────

/**
 * One subject in the catalogue.
 *
 * ─── What it replaces ───────────────────────────────────────────────────────
 * A book icon in a rounded square, the name, the code, a two-line truncated
 * overview, a difficulty pill, a scaling pill and a "Details" link. Thirty-
 * three of them. The icon was the same on every card — the "icon that restates
 * the word next to it" this codebase keeps deleting, thirty-three times over —
 * and the overview was cut mid-sentence on every single one, so the longest
 * element on the card was the one nobody could finish reading.
 *
 * ─── It leads with the number students come here for ────────────────────────
 * Scaling, at size, with its direction drawn correctly (see ScalingMark for
 * the bug that fixes). Then where the subject LEADS — career pathways, which
 * the catalogue has carried for every subject and which lived behind a
 * "Details" link nobody clicks. Those are the two things that cannot be worked
 * out from the name.
 *
 * The prerequisite is called out because it is the one fact that can rule a
 * subject out entirely, and it was buried in the modal with everything else.
 */
function BrowseSubjectCard({ subject, isSelected, onAdd, onRemove, onViewDetails }) {
    const hex = colorFor(subject?.name);
    const pathways = Array.isArray(subject?.career_pathways) ? subject.career_pathways : [];
    const prereq = prerequisiteOf((subject?.prerequisites || [])[0]);

    return (
        <div className="group relative card-soft on-table overflow-hidden flex flex-col
            transition-transform duration-200 hover:-translate-y-0.5">
            {/* The colour spine, matching the shelf on the other tab — the same
                subject is the same colour wherever it appears. */}
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1"
                style={{ background: hex }} />

            <div className="flex-1 pl-4 pr-3 py-3.5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="font-display font-extrabold text-foreground text-sm
                            leading-tight">{subject.name}</h3>
                        <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                            {subject.code}
                        </p>
                    </div>
                    <ScalingMark subject={subject} size="lg" />
                </div>

                {/* Where it leads. The catalogue has had this for every subject
                    since it was written and browse never showed it. */}
                {pathways.length > 0 && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-2.5">
                        {pathways.slice(0, 3).join(" · ")}
                    </p>
                )}

                {/* The one fact that can rule a subject out — and a
                    recommendation is NOT that, so it is labelled as advice
                    and inked as advice. See `prerequisiteOf`. */}
                {prereq && (
                    <p className={`text-[10px] font-bold leading-snug mt-2 ${
                        prereq.kind === "required" ? "text-xp/90" : "text-muted-foreground"}`}>
                        {prereq.kind === "required" ? "Needs " : "Suits "}{prereq.text}
                    </p>
                )}
            </div>

            <div className="flex items-center justify-between gap-2 pl-4 pr-3 pb-3">
                <div className="flex items-center gap-1.5">
                    {subject.difficulty_level && (
                        <span className="pill bg-secondary text-muted-foreground text-[10px] py-0.5 capitalize">
                            {subject.difficulty_level}
                        </span>
                    )}
                    {subject.is_private && (
                        <span className="pill bg-chart-4/10 text-chart-4 text-[10px] py-0.5">Custom</span>
                    )}
                    <button onClick={onViewDetails}
                        className="text-[11px] text-chart-4 hover:text-chart-4/80 font-bold
                            flex items-center gap-0.5 transition-colors">
                        Details <ChevronRight className="w-3 h-3" />
                    </button>
                </div>

                {/* The add/remove control says which state it is in AND what a
                    press would do — a bare tick reads as a badge, not a
                    button, which is why removing was undiscoverable. */}
                <button
                    onClick={(e) => { e.stopPropagation(); isSelected ? onRemove() : onAdd(); }}
                    className={`flex-shrink-0 h-7 px-2.5 rounded-lg flex items-center gap-1
                        transition-colors text-[11px] font-bold ${isSelected
                            ? "bg-primary/15 text-primary hover:bg-streak/15 hover:text-streak"
                            : "bg-secondary text-muted-foreground hover:bg-chart-4/15 hover:text-chart-4"}`}
                    title={isSelected ? "Remove from my subjects" : "Add to my subjects"}
                >
                    {isSelected
                        ? <><Check className="w-3.5 h-3.5" /> Added</>
                        : <><Plus className="w-3.5 h-3.5" /> Add</>}
                </button>
            </div>
        </div>
    );
}
// ─── One subject, as a row ───────────────────────────────────────────────────

/**
 * A subject you are carrying.
 *
 * ─── No playing card here, and that is a considered exception ───────────────
 * `PlayingCard` is the app's language on eighteen surfaces and this row is the
 * nineteenth thing that could have used it. It does not, because a card's rank
 * is a SUMMARY — one glyph standing in for how strong something is — and this
 * row's whole job is the opposite: the target you are chasing, drawn against
 * the state, with the distance to it visible. A rank in the corner would be a
 * second, coarser answer to the question the curve already answers properly,
 * and the card face would take the width the curve needs.
 *
 * What identifies a subject here is its COLOUR, carried as a spine down the
 * left edge rather than as a dot or a pill — the same colour the deck, the
 * quiz and the hub already use, at the size where you can sort by it.
 *
 * ─── What it replaces ───────────────────────────────────────────────────────
 * An icon in a rounded square, a title, two pills, an overview blurb, two more
 * pills and a "Details" link: the generated-app tile this codebase keeps
 * removing, saying nothing whatever about the student's own work.
 */
function SubjectRow({ userSubject, fullSubject, stats, lead, target, onTarget, onCommit, onRemove }) {
    // subjectColor handles all three things this column has ever held: hex,
    // a palette key, and one of the old design-token names.
    const hex = subjectColor(userSubject);
    const name = userSubject.subject_name;
    const urgent = lead && (lead.kind === "assessment" || lead.kind === "mistakes");
    const scaled = target == null ? null : scaledScore(target, fullSubject);
    const hub = `${createPageUrl("SubjectHub")}?subject=${encodeURIComponent(name)}`;

    return (
        <div className="group relative card-soft on-table overflow-hidden">
            {/* The spine. This is the subject's identity and the thing the page
                is sorted by, so it runs the full height of the row rather than
                sitting in a corner as a dot. */}
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5"
                style={{ background: hex }} />
            {/* A breath of the same colour across the row, so a spectrum of
                rows reads as one at a glance without any of them shouting. */}
            <span aria-hidden="true" className="absolute inset-0 pointer-events-none"
                style={{ background: `linear-gradient(90deg, ${alpha(hex, 0.09)}, transparent 45%)` }} />

            <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6
                pl-5 pr-4 py-4">
                <div className="min-w-0 flex-1">
                    <Link to={hub} className="group/name inline-flex items-baseline gap-1.5
                        rounded focus-visible:outline focus-visible:outline-2
                        focus-visible:outline-offset-2 focus-visible:outline-ring">
                        <h3 className="font-display font-extrabold text-foreground text-lg
                            leading-tight truncate group-hover/name:underline
                            decoration-2 underline-offset-2">{name}</h3>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0
                            transition-transform group-hover/name:translate-x-0.5" />
                    </Link>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {userSubject.year_level || "Year 12"}
                        {fullSubject?.scaling_info?.scaling_factor
                            ? ` · scales ${fullSubject.scaling_info.scaling_factor}` : ""}
                    </p>

                    {/* ONE line, and it is the same one the hub leads with. Two
                        surfaces answering "what next" with different sentences
                        is how a student stops believing either. */}
                    <p className={`text-[13px] leading-snug mt-2 font-bold ${
                        urgent ? "text-streak" : lead ? "text-foreground" : "text-muted-foreground"}`}>
                        {lead ? lead.title : "Nothing outstanding"}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-[11px]
                        text-muted-foreground tabular-nums">
                        <span>{stats?.cards || 0} cards</span>
                        {stats?.due > 0 && (
                            <span className="font-bold text-primary">{stats.due} ready</span>
                        )}
                        {stats?.bestScore != null && (
                            <span>{Math.round(stats.bestScore)}% best</span>
                        )}
                    </div>
                </div>

                {/* The target, on the state's own curve. */}
                {/* The scaled figure lives UNDER the curve, not beside the
                    heading: that corner belongs to the remove button, and the
                    two were printing on top of each other. */}
                <div className="sm:w-[300px] flex-shrink-0">
                    <p className="stat-label mb-0.5">Target study score</p>
                    <ScoreCurve target={target} tone={hex} scaled={scaled}
                        label={`Target study score for ${name}`}
                        onChange={onTarget} onCommit={onCommit} />
                </div>
            </div>

            {/* In the gutter, outside the link. A button inside a link is
                invalid and the inner one stops firing. */}
            <button
                onClick={onRemove}
                className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-surface/90 border border-border
                    text-muted-foreground hover:text-streak hover:bg-streak/10 flex items-center
                    justify-center transition-colors opacity-0 group-hover:opacity-100
                    focus-visible:opacity-100 sm:opacity-70"
                title={`Remove ${name}`}
            >
                <X className="w-3.5 h-3.5" />
            </button>
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
    // Browse filters. `area` null means every area.
    const [area, setArea] = useState(null);
    const [sortKey, setSortKey] = useState("area");
    const [showYearLevelDialog, setShowYearLevelDialog] = useState(false);
    const [selectedSubjectForYear, setSelectedSubjectForYear] = useState(null);
    const [selectedYearLevel, setSelectedYearLevel] = useState("Year 12 Units 3&4");
    const [selectedSubjectColor, setSelectedSubjectColor] = useState("");
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newSubjectForm, setNewSubjectForm] = useState({ name: "", code: "", year_level: "Year 12 Units 3&4", color: SUBJECT_PALETTE[0].hex });
    // The student's own work, for the faces on the shelf. Loaded once and
    // sliced per subject rather than queried per card — six subjects would
    // otherwise be thirty-six round trips before the page painted.
    const [work, setWork] = useState({
        flashcards: [], quizzes: [], attempts: [], bank: [], events: [], assessments: [],
    });
    // Targets are held here while a drag is in flight, keyed by subject id.
    // The row reads this first and the row's own column second, so the handle
    // tracks the pointer at once instead of waiting for a round trip — and a
    // failed write rolls the entry back rather than leaving the screen lying.
    const [targets, setTargets] = useState({});
    // The commit handler fires from a pointerup that lands in the same tick as
    // the last move, so reading `targets` from the closure would write the
    // second-to-last value. Same reason WhatToTest carries its pick in a ref.
    const targetsRef = useRef(targets);
    useEffect(() => { targetsRef.current = targets; }, [targets]);
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
        const fail = () => [];
        const [all, mine, cards, quizzes, attempts, bank, sessions, techniques, assessments] =
            await Promise.all([
                VCESubject.list("-created_date").catch(fail),
                UserSubject.filter({ created_by: email }).catch(fail),
                base44.entities.Flashcard.filter({ created_by: email, is_active: true }).catch(fail),
                base44.entities.Quiz.filter({ created_by: email }).catch(fail),
                base44.entities.QuizAttempt.filter({ created_by: email }).catch(fail),
                base44.entities.Flashcard.filter({
                    created_by: email, topic: BANK_TOPIC, is_active: true,
                }).catch(fail),
                base44.entities.StudySession.filter({ created_by: email }, "-date", 400).catch(fail),
                base44.entities.StudyTechnique.filter({ created_by: email }, "-date").catch(fail),
                base44.entities.SubjectAssessment.filter({ created_by: email }).catch(fail),
            ]);
        setWork({
            // Deck cards only: the bank is counted separately as mistakes, and
            // counting it twice would inflate both numbers on the face.
            flashcards: deckCards(cards),
            quizzes: quizzes || [],
            attempts: attempts || [],
            bank: bank || [],
            events: studyEvents(sessions, techniques),
            assessments: assessments || [],
        });
        // Static catalog is canonical for official VCE subjects. Backend entity
        // is only consulted for the user's own private custom subjects — this
        // prevents stale/glitched legacy entries (VET Hebrew, random duplicates,
        // outdated official subjects) from appearing in the browse list.
        const customSubjects = (all || []).filter(s => s.is_private && s.created_by === email);
        setSubjects([...VCE_SUBJECTS, ...customSubjects]);
        setMySubjects(mine);
    }, []);

    const isSubjectInMyList = useCallback((id) => mySubjects.some(us => us.vce_subject_id === id), [mySubjects]);

    /**
     * Browse, narrowed and ordered.
     *
     * Search, then the area chip, then the sort. Grouping happens downstream of
     * all three, so filtering to one area and sorting by scaling gives one
     * section sorted by scaling rather than an argument between the two.
     */
    const filteredSubjects = useMemo(() => {
        const q = debouncedSearch.toLowerCase();
        const hit = subjects.filter((s) =>
            (!q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
            && (!area || areaOf(s.name) === area));
        return sortSubjects(hit, sortKey);
    }, [subjects, debouncedSearch, area, sortKey]);

    /**
     * Sections, but ONLY when sorting by area — any other sort is a single
     * ranking across the whole catalogue, and chopping it into headed sections
     * would break the very order the student asked for.
     */
    const browseGroups = useMemo(
        () => (sortKey === "area" ? groupByArea(filteredSubjects) : null),
        [filteredSubjects, sortKey]);

    /**
     * Which areas have anything in them at all, so a chip can never lead to an
     * empty page. Computed off the SEARCH results, not the area filter, or
     * picking a chip would hide every other chip.
     */
    const availableAreas = useMemo(() => {
        const q = debouncedSearch.toLowerCase();
        const present = new Set(subjects
            .filter((s) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
            .map((s) => areaOf(s.name)));
        return LEARNING_AREAS.filter((a) => present.has(a.key));
    }, [subjects, debouncedSearch]);

    const load = useMemo(() => loadSummary(mySubjects, subjects), [mySubjects, subjects]);

    /**
     * The shelf, in colour-wheel order.
     *
     * Sorting by hue is the point rather than a flourish: the colour IS how a
     * subject is identified everywhere else in the app, so ordering by it
     * makes the page's own spine legible and the position of a subject stable
     * between visits. Greys sort last together — see `hueOf` for why an
     * uncoloured subject must not be scattered into the blues.
     *
     * Name breaks the tie so two subjects sharing a palette entry cannot swap
     * places between renders.
     */
    const mySelectedSubjects = useMemo(() => mySubjects.map(us => {
        const stats = subjectStats(us.subject_name, {
            flashcards: work.flashcards, quizzes: work.quizzes, attempts: work.attempts,
            bankCards: work.bank, events: work.events, assessments: work.assessments,
        });
        const hex = subjectColor(us);
        return {
            ...us,
            hex,
            hue: hueOf(hex),
            fullSubject: subjects.find(s => s.id === us.vce_subject_id)
                || VCE_SUBJECTS.find(s => s.name === us.subject_name),
            stats,
            // Coverage and the mark split are the hub's job — the shelf only
            // needs the lead, and passing nulls keeps it from claiming a gap
            // it has not measured.
            lead: subjectLead(stats, null, null),
            target: us.id in targets ? targets[us.id] : (us.goal_study_score ?? null),
        };
    }).sort((a, b) => a.hue - b.hue
        || String(a.subject_name).localeCompare(String(b.subject_name))),
    [mySubjects, subjects, work, targets]);

    // ─── Handlers ──────────────────────────────────────────────────────────────

    const handleAddSubject = (subject) => {
        setSelectedSubjectForYear(subject);
        setSelectedSubjectColor(subjectColor(subject, subject?.name));
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

    /**
     * Dragging the curve. Local only — one state write per pointer move, no
     * network at all, or a drag across the scale is fifty round trips.
     */
    const handleTarget = useCallback((id, score) => {
        setTargets((t) => ({ ...t, [id]: clampScore(score) }));
    }, []);

    /**
     * Letting go. ONE write, and the local value is kept afterwards rather
     * than dropped: `loadData` is not re-run here, so clearing it would snap
     * the handle back to the stale row until something else refetched.
     *
     * A failed write rolls the entry back to what the row actually holds,
     * because a handle sitting where the student left it while the database
     * says otherwise is the screen quietly lying about their target.
     */
    const handleCommitTarget = useCallback(async (id) => {
        const score = targetsRef.current[id];
        if (score == null) return;
        try {
            await UserSubject.update(id, { goal_study_score: score });
            setMySubjects((rows) => rows.map((r) =>
                (r.id === id ? { ...r, goal_study_score: score } : r)));
        } catch (err) {
            console.error("Could not save target study score:", err);
            setTargets(({ [id]: _dropped, ...rest }) => rest);
            toast({
                variant: "destructive",
                title: "Target not saved",
                description: "That did not save — check your connection and try again.",
            });
        }
    }, [toast]);

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
            setNewSubjectForm({ name: "", code: "", year_level: "Year 12 Units 3&4", color: SUBJECT_PALETTE[0].hex });
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

    const newFormPalette = swatch(newSubjectForm.color);

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

                {/* Browse controls. Thirty-three subjects and, until now, one
                    text box to narrow them with. */}
                {activeTab === "all" && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative flex-1 min-w-[220px] max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                                <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search subjects..." className="pl-10 bg-surface border-border rounded-xl h-10" />
                            </div>
                            <Select value={sortKey} onValueChange={setSortKey}>
                                <SelectTrigger className="rounded-xl h-10 w-[170px] bg-surface">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SORTS.map((o) => (
                                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Only areas that actually have subjects in them — a
                            chip that leads to an empty page reads as a broken
                            filter. */}
                        <div className="flex flex-wrap gap-1.5">
                            <button onClick={() => setArea(null)}
                                className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                                    area === null
                                        ? "bg-foreground text-background"
                                        : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                                All
                            </button>
                            {availableAreas.map((a) => (
                                <button key={a.key}
                                    onClick={() => setArea(area === a.key ? null : a.key)}
                                    className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                                        area === a.key
                                            ? "bg-foreground text-background"
                                            : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                                    {a.label}
                                </button>
                            ))}
                        </div>
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
                            /* One column. These are ROWS — the curve wants
                               300px and the lead line wants prose width, and
                               two of them side by side gives neither. */
                            <div className="space-y-3">
                                <AnimatePresence mode="popLayout">
                                    {mySelectedSubjects.map(us => (
                                        <motion.div key={us.id} layout
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.97 }}>
                                            <SubjectRow
                                                userSubject={us}
                                                fullSubject={us.fullSubject}
                                                stats={us.stats}
                                                lead={us.lead}
                                                target={us.target}
                                                onTarget={(n) => handleTarget(us.id, n)}
                                                onCommit={() => handleCommitTarget(us.id)}
                                                onRemove={() => handleRemoveSubject(us.id)}
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
                        <LoadStrip summary={load} />

                        {filteredSubjects.length === 0 ? (
                            <div className="text-center py-16">
                                <p className="text-muted-foreground text-sm">
                                    Nothing matches that. Try a different area or clear the search.
                                </p>
                            </div>
                        ) : browseGroups ? (
                            /* Sorted by area, so the areas are the sections.
                               Every other sort is one ranking across the whole
                               catalogue and must not be chopped up. */
                            <div className="space-y-7">
                                {browseGroups.map((g) => (
                                    <section key={g.key}>
                                        <div className="flex items-baseline gap-2 mb-3">
                                            <h2 className="font-display font-extrabold text-foreground text-base">
                                                {g.label}
                                            </h2>
                                            <span className="text-[11px] text-muted-foreground tabular-nums">
                                                {g.subjects.length}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                            {g.subjects.map((subject) => (
                                                <BrowseSubjectCard
                                                    key={subject.id}
                                                    subject={subject}
                                                    isSelected={isSubjectInMyList(subject.id)}
                                                    onAdd={() => handleAddSubject(subject)}
                                                    onRemove={() => handleRemoveByVCEId(subject.id)}
                                                    onViewDetails={() => setSelectedSubject(subject)}
                                                />
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {filteredSubjects.map((subject) => (
                                    <BrowseSubjectCard
                                        key={subject.id}
                                        subject={subject}
                                        isSelected={isSubjectInMyList(subject.id)}
                                        onAdd={() => handleAddSubject(subject)}
                                        onRemove={() => handleRemoveByVCEId(subject.id)}
                                        onViewDetails={() => setSelectedSubject(subject)}
                                    />
                                ))}
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
                                    {SUBJECT_PALETTE.map(c => (
                                        <button key={c.key} type="button" title={c.label}
                                            aria-label={c.label}
                                            aria-pressed={selectedSubjectColor === c.hex}
                                            onClick={() => setSelectedSubjectColor(c.hex)}
                                            className={`h-10 rounded-lg transition-all ${selectedSubjectColor === c.hex
                                                ? "ring-4 ring-offset-2 ring-foreground/20 scale-110" : "hover:scale-105"}`}
                                            style={{ backgroundColor: c.hex }} />
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
                                    {SUBJECT_PALETTE.map(c => (
                                        <button key={c.key} type="button" title={c.label}
                                            aria-label={c.label}
                                            aria-pressed={newSubjectForm.color === c.hex}
                                            onClick={() => setNewSubjectForm({ ...newSubjectForm, color: c.hex })}
                                            className={`h-10 rounded-lg transition-all ${newSubjectForm.color === c.hex
                                                ? "ring-4 ring-offset-2 ring-foreground/20 scale-110" : "hover:scale-105"}`}
                                            style={{ backgroundColor: c.hex }} />
                                    ))}
                                </div>
                            </div>
                            {/* Preview */}
                            <div className="rounded-xl border-2 border-dashed p-3 flex items-center gap-3"
                                style={{ ...newFormPalette.border, ...newFormPalette.tile }}>
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={newFormPalette.solid}>
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
