/**
 * KeyKnowledge — what a SAC is on, point by point, and how each one stands.
 *
 * ─── Where the list comes from ──────────────────────────────────────────────
 * The teacher's SAC outline, first: paste it, or photograph the sheet and the
 * model copies the dot points out. Those are the points that will be ASSESSED,
 * which nothing else in the app can know. With no outline the model can draft
 * one from the study design — labelled as a draft, unticked rows the student
 * accepts, because a suggested point is a guess about a SAC nobody showed it.
 *
 * ─── Said, and proved ───────────────────────────────────────────────────────
 * Every point takes the student's own rating — Got it, Shaky, Not yet — and,
 * separately, what a marked check showed. "Test me" builds one question per
 * point and sends them through the real quiz player, so the marking, the
 * mistake banking and the strong-answer saving are the ones every other quiz
 * gets. Proof is read back off that attempt; nothing here grades anything.
 *
 * The list keeps the TEACHER's order. Sorting worst-first would move a row out
 * from under the student's finger the moment they rated it; the check is what
 * picks the worst first.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
    Check, X, Plus, Pencil, Trash2, ClipboardPaste, Camera, Wand2, Type, Target, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import MarkdownMath from "@/components/shared/MarkdownMath";
import TierUsagePill from "@/components/shared/TierUsagePill";
import AceShuffle from "@/components/ace/AceShuffle";
import { JobBar } from "@/components/shared/JobTray";
import { base44 } from "@/api/base44Client";
import { FEATURES, checkLiveTier } from "@/lib/tierAccess";
import { getExaminerPrompt } from "@/lib/subjectExaminerPrompts";
import { acceptFiles, uploadAll } from "@/lib/pickFiles";
import {
    RATINGS, CHECK_MAX, POINTS_MAX, splitOutline, mergePoints, ratePoint, removePoint, editPoint,
    pointState, checkCandidates, calibration,
} from "@/lib/revision";

/** A point's state, drawn. Shape carries it as well as colour — the CVD rule. */
const MARK = {
    proved:  { cls: "bg-primary text-primary-foreground border-primary", Icon: Check, label: "Proved on a check" },
    missed:  { cls: "bg-streak/10 text-streak border-streak", Icon: X, label: "Missed on a check" },
    got:     { cls: "bg-surface text-primary border-primary", Icon: Check, label: "You said you've got it" },
    shaky:   { cls: "bg-surface text-xp border-xp", Icon: Minus, label: "Shaky" },
    not_yet: { cls: "bg-surface text-streak border-streak/60", Icon: X, label: "Not yet" },
    unrated: { cls: "bg-surface text-muted-foreground border-dashed border-border", Icon: null, label: "Not rated" },
};
const RATE_ON = {
    got: "border-primary bg-primary/10 text-primary",
    shaky: "border-xp bg-xp/10 text-xp",
    not_yet: "border-streak bg-streak/10 text-streak",
};

function PointMark({ state }) {
    const m = MARK[state] || MARK.unrated;
    return (
        <span title={m.label} aria-label={m.label} data-point-state={state}
            className={`w-6 h-6 rounded-full border-2 grid place-items-center flex-shrink-0 mt-px ${m.cls}`}>
            {m.Icon && <m.Icon className="w-3.5 h-3.5" strokeWidth={3} />}
        </span>
    );
}

const fmtDay = (iso) => {
    const d = new Date(iso || "");
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

function PointRow({ point, proof, onRate, onEdit, onRemove, index }) {
    const reduce = useReducedMotion();
    const state = pointState(point, proof);
    const pr = proof?.get?.(point.id) || null;
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(point.text);
    const save = () => { setEditing(false); if (draft.trim() && draft.trim() !== point.text) onEdit(point.id, draft); };

    return (
        <motion.li layout={!reduce} data-point={point.id}
            initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: Math.min(index * 0.025, 0.3) }}
            className="rounded-2xl border-2 border-border bg-surface px-3.5 py-3 grid gap-x-3 gap-y-2.5
                grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto] items-start">
            <PointMark state={state} />
            <div className="min-w-0">
                {editing ? (
                    <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                        onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
                        className="h-8 text-sm" />
                ) : (
                    <MarkdownMath className="text-sm font-bold text-foreground leading-snug">{point.text}</MarkdownMath>
                )}
                {(pr || point.from === "suggested") && (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
                        {pr && (
                            <span className={`font-bold tabular-nums ${pr.full ? "text-primary" : "text-streak"}`} data-proof>
                                Checked {pr.marks}/{pr.outOf}{fmtDay(pr.at) ? ` · ${fmtDay(pr.at)}` : ""}
                            </span>
                        )}
                        {point.from === "suggested" && <span className="italic">suggested — check it against your outline</span>}
                    </p>
                )}
            </div>
            {/* The rating: under the words on a phone, beside them from sm. */}
            <div role="group" aria-label="How well do you know this?" data-rate-point
                className="col-span-3 sm:col-span-1 sm:order-none order-last flex gap-1 sm:justify-end">
                {RATINGS.map((r) => (
                    <button key={r.id} type="button" onClick={() => onRate(point.id, r.id)}
                        aria-pressed={point.said === r.id}
                        className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg border-2 text-[11px] font-bold transition-colors whitespace-nowrap ${
                            point.said === r.id ? RATE_ON[r.id] : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"}`}>
                        {r.label}
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-0.5 -mr-1">
                <button type="button" onClick={() => { setDraft(point.text); setEditing(true); }} aria-label="Edit this point"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => onRemove(point.id)} aria-label="Remove this point"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-streak hover:bg-streak/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </motion.li>
    );
}

// ─── Adding points ──────────────────────────────────────────────────────────

const SOURCES = [
    { id: "paste", label: "Paste", Icon: ClipboardPaste },
    { id: "photo", label: "Photo", Icon: Camera },
    { id: "suggest", label: "Suggest", Icon: Wand2 },
    { id: "type", label: "Type", Icon: Type },
];

const POINTS_SCHEMA = {
    type: "object",
    properties: { points: { type: "array", items: { type: "string" } } },
    required: ["points"],
};

function Preview({ items, picked, onToggle }) {
    if (!items.length) return null;
    return (
        <ul className="max-h-64 overflow-y-auto space-y-1.5 pr-1" data-points-preview>
            {items.map((t, i) => (
                <li key={`${i}-${t}`}>
                    <button type="button" onClick={() => onToggle(i)} aria-pressed={picked.has(i)}
                        className={`w-full text-left flex items-start gap-2.5 rounded-xl border-2 px-3 py-2 text-sm transition-colors ${
                            picked.has(i) ? "border-primary/40 bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
                        <span className={`w-4 h-4 mt-0.5 rounded border-2 grid place-items-center flex-shrink-0 ${
                            picked.has(i) ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                            {picked.has(i) && <Check className="w-3 h-3" strokeWidth={3} />}
                        </span>
                        <MarkdownMath className="leading-snug min-w-0">{t}</MarkdownMath>
                    </button>
                </li>
            ))}
        </ul>
    );
}

export function AddPoints({ open, onOpenChange, folder, profile, existing = [], onAdd, start = "paste" }) {
    const { toast } = useToast();
    const [source, setSource] = useState(start);
    const [text, setText] = useState("");
    const [one, setOne] = useState("");
    const [found, setFound] = useState({ items: [], from: null });
    const [picked, setPicked] = useState(new Set());
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);
    const room = Math.max(0, POINTS_MAX - existing.length);

    const pasted = useMemo(() => splitOutline(text), [text]);
    const reset = () => { setText(""); setOne(""); setFound({ items: [], from: null }); setPicked(new Set()); };
    const finish = (texts, from) => {
        if (!texts.length) return;
        onAdd(texts, from);
        reset();
        onOpenChange(false);
    };
    const showFound = (items, from) => {
        const clean = splitOutline(items.join("\n"));
        setFound({ items: clean, from });
        // Read off the student's own sheet: ticked. Drafted by the model: also
        // ticked, but labelled a draft on every row it becomes.
        setPicked(new Set(clean.map((_, i) => i)));
        if (!clean.length) toast({ title: "Nothing came back", description: "Try a clearer photo, or paste the points instead.", variant: "destructive" });
    };

    const readPhoto = async (fileList) => {
        const files = await acceptFiles(fileList, { toast });
        if (!files.length) return;
        const access = await checkLiveTier(FEATURES.REVISION_POINTS);
        if (!access.allowed) {
            toast({ title: access.upgradeRequired ? "Premium feature" : "Not enough chips", description: `${access.reason} Pasting the points is free.`, variant: "destructive" });
            return;
        }
        setBusy(true);
        try {
            const { uploaded } = await uploadAll(files.slice(0, 3), base44.integrations.Core.UploadFile);
            if (!uploaded.length) throw new Error("The photo didn't upload.");
            const res = await base44.integrations.Core.InvokeLLM({
                feature: FEATURES.REVISION_POINTS,
                prompt: `This is a VCE ${folder.subject} SAC outline a teacher handed out. Copy out its KEY KNOWLEDGE dot points EXACTLY as written — one string per dot point.

Rules:
- Transcribe. Never reword, merge, split or add a point.
- Skip headings, dates, task instructions, mark allocations and anything that is not a dot point of what will be assessed.
- If the sheet has no dot points, return an empty list. Never invent one.`,
                file_urls: uploaded.map((u) => u.url),
                response_json_schema: POINTS_SCHEMA,
            });
            showFound(Array.isArray(res?.points) ? res.points : [], "outline");
        } catch (e) {
            toast({ title: "Couldn't read that", description: e?.message || "Try again, or paste the points.", variant: "destructive" });
        } finally { setBusy(false); }
    };

    const suggest = async () => {
        const access = await checkLiveTier(FEATURES.REVISION_POINTS);
        if (!access.allowed) {
            toast({ title: access.upgradeRequired ? "Premium feature" : "Not enough chips", description: `${access.reason} Pasting or typing points is free.`, variant: "destructive" });
            return;
        }
        setBusy(true);
        try {
            const on = folder.topics?.length ? folder.topics.join(", ") : "";
            const res = await base44.integrations.Core.InvokeLLM({
                feature: FEATURES.REVISION_POINTS,
                prompt: `${getExaminerPrompt(folder.subject)}

List the KEY KNOWLEDGE a VCE ${folder.subject} student needs for ${folder.kind === "exam" ? "the end-of-year exam" : `an assessment called "${folder.title}"`}${on ? `, which covers: ${on}` : ""}.

Rules:
- Between 8 and 16 dot points, each one a single specific thing to know or do (name the concept, the process, the formula or the skill).
- Only what the current VCAA Units 3 and 4 study design asks for. Never pad, never repeat.
- Write each one the way a study design dot point is written, without numbering.`,
                response_json_schema: POINTS_SCHEMA,
            });
            showFound(Array.isArray(res?.points) ? res.points : [], "suggested");
        } catch (e) {
            toast({ title: "Couldn't draft them", description: e?.message || "Try again in a moment.", variant: "destructive" });
        } finally { setBusy(false); }
    };

    const toggle = (i) => setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; });

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
            <DialogContent className="max-w-lg rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl font-extrabold">What's on it?</DialogTitle>
                    <DialogDescription>
                        Your teacher's outline is the best list there is — it's what will be assessed.
                        {room < POINTS_MAX && ` Room for ${room} more.`}
                    </DialogDescription>
                </DialogHeader>

                <div role="tablist" className="grid grid-cols-4 gap-1 rounded-2xl bg-secondary p-1">
                    {SOURCES.map((s) => (
                        <button key={s.id} type="button" role="tab" aria-selected={source === s.id}
                            onClick={() => { setSource(s.id); setFound({ items: [], from: null }); }}
                            data-add-source={s.id}
                            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors ${
                                source === s.id ? "bg-surface text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}>
                            <s.Icon className="w-3.5 h-3.5" /> {s.label}
                        </button>
                    ))}
                </div>

                {busy && (
                    <div className="flex items-center gap-3 py-6 justify-center">
                        <AceShuffle size="md" />
                        <p className="text-sm text-muted-foreground">{source === "photo" ? "Reading your outline…" : "Drafting the dot points…"}</p>
                    </div>
                )}

                {!busy && found.items.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-sm text-foreground">
                            <span className="font-bold tabular-nums">{found.items.length}</span>{" "}
                            {found.from === "suggested"
                                ? "drafted from the study design. Untick anything your SAC doesn't cover."
                                : "dot points read off your outline. Untick any it got wrong."}
                        </p>
                        <Preview items={found.items} picked={picked} onToggle={toggle} />
                        <Button onClick={() => finish(found.items.filter((_, i) => picked.has(i)), found.from)} disabled={!picked.size}
                            className="btn-3d w-full bg-primary hover:bg-primary text-primary-foreground rounded-xl" data-add-confirm>
                            Add {picked.size} point{picked.size === 1 ? "" : "s"}
                        </Button>
                    </div>
                )}

                {!busy && !found.items.length && source === "paste" && (
                    <div className="space-y-3">
                        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} data-paste
                            placeholder={"Paste the key knowledge from your SAC outline.\nBullets, numbers or plain lines all work."}
                            className="rounded-xl border-2 text-sm" />
                        <Button onClick={() => finish(pasted, "outline")} disabled={!pasted.length} data-add-confirm
                            className="btn-3d w-full bg-primary hover:bg-primary text-primary-foreground rounded-xl">
                            {pasted.length ? `Add ${pasted.length} point${pasted.length === 1 ? "" : "s"}` : "Paste some points first"}
                        </Button>
                    </div>
                )}

                {!busy && !found.items.length && source === "photo" && (
                    <div className="space-y-3">
                        <button type="button" onClick={() => fileRef.current?.click()}
                            className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5
                                transition-colors py-8 flex flex-col items-center gap-2 text-center">
                            <Camera className="w-6 h-6 text-primary" />
                            <span className="text-sm font-bold text-foreground">Photograph or upload the outline</span>
                            <span className="text-xs text-muted-foreground">A photo or a PDF. The dot points are copied out word for word.</span>
                        </button>
                        <input ref={fileRef} type="file" accept="image/*,.heic,.heif,.pdf" multiple className="hidden"
                            onChange={(e) => { readPhoto(Array.from(e.target.files || [])); e.target.value = ""; }} />
                        <div className="flex justify-center"><TierUsagePill feature={FEATURES.REVISION_POINTS} userProfile={profile} /></div>
                    </div>
                )}

                {!busy && !found.items.length && source === "suggest" && (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground leading-snug">
                            A draft from the VCAA study design for {folder.subject}
                            {folder.topics?.length ? <> on <span className="font-bold text-foreground">{folder.topics.join(", ")}</span></> : null}.
                            It can't see your SAC, so check every point against the outline you were given.
                        </p>
                        <Button onClick={suggest} data-suggest
                            className="btn-3d w-full bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-2">
                            <Wand2 className="w-4 h-4" /> Draft the dot points
                        </Button>
                        <div className="flex justify-center"><TierUsagePill feature={FEATURES.REVISION_POINTS} userProfile={profile} /></div>
                    </div>
                )}

                {!busy && !found.items.length && source === "type" && (
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (one.trim()) { onAdd([one.trim()], "typed"); setOne(""); } }}>
                        <Input value={one} onChange={(e) => setOne(e.target.value)} placeholder="e.g. Balance redox half-equations in acidic conditions"
                            className="h-10 rounded-xl" data-type-point />
                        <Button type="submit" disabled={!one.trim()} className="h-10 rounded-xl bg-primary text-primary-foreground">Add</Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Test me ────────────────────────────────────────────────────────────────

function TestMe({ open, onOpenChange, points, proof, profile, onBuild }) {
    const candidates = useMemo(() => checkCandidates(points, proof, points.length), [points, proof]);
    const [picked, setPicked] = useState(() => new Set(candidates.slice(0, CHECK_MAX).map((p) => p.id)));
    const toggle = (id) => setPicked((p) => {
        const n = new Set(p);
        if (n.has(id)) n.delete(id); else if (n.size < CHECK_MAX) n.add(id);
        return n;
    });
    const chosen = candidates.filter((p) => picked.has(p.id));
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl font-extrabold">Test me</DialogTitle>
                    <DialogDescription>
                        One exam-style question on each point, marked like any quiz. Full marks on a point is what
                        moves it from said to proved. Up to {CHECK_MAX} at a time — the shakiest are picked first.
                    </DialogDescription>
                </DialogHeader>
                <ul className="max-h-72 overflow-y-auto space-y-1.5 pr-1" data-test-points>
                    {candidates.map((p) => {
                        const on = picked.has(p.id);
                        const full = !on && picked.size >= CHECK_MAX;
                        return (
                            <li key={p.id}>
                                <button type="button" onClick={() => toggle(p.id)} aria-pressed={on} disabled={full}
                                    className={`w-full text-left flex items-start gap-2.5 rounded-xl border-2 px-3 py-2 text-sm transition-colors ${
                                        on ? "border-primary/40 bg-primary/5 text-foreground" : "border-border text-muted-foreground"} ${full ? "opacity-50" : ""}`}>
                                    <PointMark state={pointState(p, proof)} />
                                    <MarkdownMath className="leading-snug min-w-0 flex-1">{p.text}</MarkdownMath>
                                    {on && <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" strokeWidth={3} />}
                                </button>
                            </li>
                        );
                    })}
                </ul>
                <Button onClick={() => { onBuild(chosen); onOpenChange(false); }} disabled={!chosen.length} data-test-build
                    className="btn-3d w-full bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-2">
                    <Target className="w-4 h-4" /> Build {chosen.length} question{chosen.length === 1 ? "" : "s"}
                </Button>
                <div className="flex justify-center"><TierUsagePill feature={FEATURES.QUIZ_AI_GEN} userProfile={profile} /></div>
            </DialogContent>
        </Dialog>
    );
}

// ─── The section ────────────────────────────────────────────────────────────

export default function KeyKnowledge({ folder, points, proof, profile, onSave, onTest, checkJob, readiness, openTest = 0 }) {
    const [adding, setAdding] = useState(null);
    const [testing, setTesting] = useState(false);
    // The hero's "Test me" opens the same sheet. A counter rather than a flag,
    // so pressing it a second time after closing the sheet opens it again.
    useEffect(() => { if (openTest > 0 && !checkJob) setTesting(true); }, [openTest, checkJob]);
    const cal = useMemo(() => calibration(points, proof), [points, proof]);
    const open = useMemo(() => checkCandidates(points, proof, points.length).length, [points, proof]);

    const add = (texts, from) => onSave(mergePoints(points, texts, from).points);
    const rate = (id, said) => onSave(ratePoint(points, id, said));
    const edit = (id, text) => onSave(editPoint(points, id, text));
    const remove = (id) => onSave(removePoint(points, id));
    const r = readiness?.points;

    return (
        <section aria-label="Key knowledge" data-section="knowledge" className="space-y-3">
            {points.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <p className="text-sm text-muted-foreground flex-1 min-w-[12rem]">
                        <span className="font-bold text-foreground tabular-nums">{points.length}</span> point{points.length === 1 ? "" : "s"}
                        {r && <> · <span className="text-primary font-bold tabular-nums">{r.proved}</span> proved · <span className="tabular-nums">{r.said}</span> said</>}
                    </p>
                    <Button size="sm" variant="outline" onClick={() => setAdding("paste")} data-add-points
                        className="h-9 border-2 border-border rounded-xl gap-1.5 text-xs font-bold">
                        <Plus className="w-3.5 h-3.5" /> Add
                    </Button>
                    {open > 0 && (
                        <Button size="sm" onClick={() => setTesting(true)} disabled={!!checkJob} data-test-me
                            className="btn-3d h-9 bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-1.5 text-xs">
                            <Target className="w-3.5 h-3.5" /> Test me on {Math.min(open, CHECK_MAX)}
                        </Button>
                    )}
                </div>
            )}

            {checkJob && (
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 px-4 py-3" data-check-running>
                    <p className="text-sm font-bold text-foreground">Writing your check</p>
                    <JobBar job={checkJob} claims className="mt-2" />
                    <p className="text-[11px] text-muted-foreground mt-1.5">Leave if you like — it follows you, and opens here when it's done.</p>
                </div>
            )}

            {cal.checked > 0 && (
                <p className="text-sm text-foreground leading-snug" data-calibration>
                    You rated <span className="font-bold tabular-nums">{cal.said}</span> “Got it”.
                    Of the <span className="tabular-nums">{cal.checked}</span> checked,{" "}
                    <span className="font-bold text-primary tabular-nums">{cal.held}</span> held up
                    {cal.slipped > 0 && <> and <span className="font-bold text-streak tabular-nums">{cal.slipped}</span> didn't</>}.
                </p>
            )}

            {points.length === 0 ? (
                <div className="card-soft on-table border-2 border-border rounded-2xl p-5 sm:p-6" data-knowledge-empty>
                    <p className="font-display font-extrabold text-lg text-foreground">
                        {folder.kind === "exam" ? "What does the exam cover?" : "What's on this SAC?"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 leading-snug max-w-lg">
                        Put the key knowledge in once, rate how well you know each point, and test the shaky ones.
                        This is the list everything else in the folder is measured against.
                    </p>
                    <div className="grid sm:grid-cols-3 gap-2 mt-4">
                        {[
                            { id: "paste", Icon: ClipboardPaste, title: "Paste the outline", line: "Free" },
                            { id: "photo", Icon: Camera, title: "Photograph it", line: "Copied out word for word" },
                            { id: "suggest", Icon: Wand2, title: "Draft it for me", line: "From the study design" },
                        ].map((o) => (
                            <button key={o.id} type="button" onClick={() => setAdding(o.id)} data-start-add={o.id}
                                className="text-left rounded-2xl border-2 border-border bg-surface hover:border-primary/50 hover:bg-primary/5
                                    transition-colors px-3.5 py-3">
                                <o.Icon className="w-5 h-5 text-primary" />
                                <span className="block text-sm font-black text-foreground mt-2">{o.title}</span>
                                <span className="block text-[11px] text-muted-foreground">{o.line}</span>
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => setAdding("type")}
                        className="mt-3 text-xs font-bold text-muted-foreground hover:text-foreground underline underline-offset-4">
                        or type them in one at a time
                    </button>
                </div>
            ) : (
                <ol className="space-y-2" data-points>
                    <AnimatePresence initial={false}>
                        {points.map((p, i) => (
                            <PointRow key={p.id} point={p} proof={proof} index={i}
                                onRate={rate} onEdit={edit} onRemove={remove} />
                        ))}
                    </AnimatePresence>
                </ol>
            )}

            {adding && (
                <AddPoints open={!!adding} start={adding} onOpenChange={(v) => { if (!v) setAdding(null); }}
                    folder={folder} profile={profile} existing={points} onAdd={add} />
            )}
            {testing && (
                <TestMe open={testing} onOpenChange={setTesting} points={points} proof={proof} profile={profile}
                    onBuild={onTest} />
            )}
        </section>
    );
}
