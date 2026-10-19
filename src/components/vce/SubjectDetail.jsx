/**
 * SubjectDetail — one VCE subject, laid out in the order a choice gets made.
 *
 *   the subject     what it is, where it sits, how it scales, what it needs
 *   how it's marked the study score as one bar, in the order of the year
 *   a score here    the state curve: drag a raw score, see it placed and scaled
 *   the course      its areas of study, ticked off your own work if you take it
 *   alternatives    the rest of its learning area, one tap to switch or compare
 *   where it leads  careers
 *
 * ─── What the old page said, and why it went ────────────────────────────────
 * "Popular choice" and "2 year program" were printed beside EVERY subject in
 * the catalogue, so they told a student nothing about this one. The scaling
 * pill was coloured by reputation rather than by direction — the wrong-arrow
 * bug `ScalingMark` was written to end on Browse. Prerequisites were printed
 * raw, so "Year 10 maths recommended" read as a gate. And it was cards inside
 * a card, eight of them, so nothing led. Every figure on this page now comes
 * off a catalogue field (`subjectInfo.js`), and none of it names a better
 * subject — scaling is the cohort, not a discount, `LoadStrip`'s rule.
 *
 * ─── One box is something you press ─────────────────────────────────────────
 * The hero and the alternatives are bordered, because both are things you act
 * on. Everything else is a ruled section on the page's own ground — the
 * Progress page's rule, and the reason this no longer reads as a stack of
 * identical tiles.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Plus, Check, Columns2, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ScalingMark from "@/components/subjects/ScalingMark";
import ScoreCurve from "@/components/subjects/ScoreCurve";
import YearBar from "@/components/vce/YearBar";
import SubjectCompare from "@/components/vce/SubjectCompare";
import { alpha } from "@/components/cards/PlayingCard";
import { colorFor } from "@/components/cards/cardIdentity";
import { scaledScore, clampScore } from "@/lib/studyScore";
import { yearBar, prereqsOf, alternativesFor, areaNameOf, subjectLink } from "@/lib/subjectInfo";
import { createPageUrl } from "@/utils";

/** A heading with a rule to the end of the row — the band idiom. */
function Section({ title, aside, children, index = 0 }) {
    const reduce = useReducedMotion();
    return (
        <motion.section
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.2) }}>
            <div className="flex items-center gap-3 mb-4">
                <h2 className="font-display font-extrabold text-foreground text-lg flex-shrink-0">{title}</h2>
                <span className="flex-1 h-px bg-border" aria-hidden="true" />
                {aside}
            </div>
            {children}
        </motion.section>
    );
}

/**
 * Hand the page over. On a phone that is the share sheet, because that is
 * where a link is sent from; anywhere else it is the clipboard. A cancelled
 * share says nothing, and a copy that fails SAYS SO — a button that does
 * nothing on a locked-down school laptop reads as broken.
 */
function ShareLink({ subject }) {
    const [state, setState] = useState(null); // "copied" | "failed" | null
    useEffect(() => {
        if (!state) return undefined;
        const t = setTimeout(() => setState(null), 2400);
        return () => clearTimeout(t);
    }, [state]);
    const share = async () => {
        const url = subjectLink(subject.id, window.location.origin);
        const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
        if (touch && navigator.share) {
            try { await navigator.share({ title: subject.name, url }); } catch { /* cancelled */ }
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            setState("copied");
        } catch {
            setState("failed");
        }
    };
    return (
        <Button variant="outline" onClick={share} data-share-subject
            className="rounded-xl gap-1.5 border-2 border-border">
            {state === "copied" ? <Check className="w-4 h-4 text-primary" /> : <Link2 className="w-4 h-4" />}
            {state === "copied" ? "Link copied" : state === "failed" ? "Copy from the address bar" : "Share"}
        </Button>
    );
}

/** A delete that asks once: the first press arms it, the second deletes. */
function DeleteOwn({ onDelete }) {
    const [armed, setArmed] = useState(false);
    useEffect(() => {
        if (!armed) return undefined;
        const t = setTimeout(() => setArmed(false), 3500);
        return () => clearTimeout(t);
    }, [armed]);
    return (
        <Button variant="outline" size="sm" data-delete-own
            onClick={() => (armed ? onDelete() : setArmed(true))}
            className={`rounded-xl gap-1.5 border-2 ${armed ? "border-streak/60 text-streak" : "border-border"}`}>
            <Trash2 className="w-3.5 h-3.5" /> {armed ? "Delete it?" : "Delete"}
        </Button>
    );
}

export default function SubjectDetail({
    subject, catalogue = [], hex: hexProp, userSubject = null, coverage = null,
    target = null, onTarget, onCommitTarget,
    onBack, onAdd, onOpen, onDelete,
}) {
    const reduce = useReducedMotion();
    const hex = hexProp || colorFor(subject?.name);
    const taken = !!userSubject;

    const bar = useMemo(() => yearBar(subject), [subject]);
    const prereqs = useMemo(() => prereqsOf(subject), [subject]);
    const alts = useMemo(() => alternativesFor(subject, catalogue), [subject, catalogue]);
    const area = areaNameOf(subject);
    const skills = (subject?.key_skills || []).filter(Boolean);
    const tips = (subject?.study_tips || []).filter(Boolean);
    const careers = (subject?.career_pathways || []).filter(Boolean);
    const scaling = subject?.scaling_info || null;
    const mean = Number(scaling?.mean_study_score);

    // ── The score you are trying ────────────────────────────────────────
    // For a subject you take, the curve IS your target — the same column the
    // shelf and the hub write. For one you are only looking at, it is a
    // what-if held here and written nowhere, and it starts empty rather than
    // claiming a score you never chose.
    const [whatIf, setWhatIf] = useState(null);
    useEffect(() => { setWhatIf(null); }, [subject?.id]);
    const shown = taken ? target : whatIf;

    // ── Switching subject, with a direction ─────────────────────────────
    // A tap on an alternative to the RIGHT on the ladder slides the page in
    // from the right, so the strip and the page agree about where you went.
    const dirRef = useRef(0);
    const open = (next) => {
        const from = alts.findIndex((a) => a.current);
        const to = alts.findIndex((a) => a.subject.id === next.id);
        dirRef.current = from < 0 || to < 0 ? 0 : Math.sign(to - from);
        // To the top FIRST, instantly, so the slide plays where the student
        // is looking. Scrolling smoothly while the old page faded out left a
        // frame of empty ground where the strip they tapped had been.
        window.scrollTo?.(0, 0);
        onOpen?.(next);
    };
    useEffect(() => { window.scrollTo?.(0, 0); }, [subject?.id]);

    const [comparing, setComparing] = useState(null);
    const compareDefault = alts.find((a) => !a.current)?.subject
        || catalogue.find((s) => s.id !== subject?.id && !s.is_private) || null;

    if (!subject) return null;
    const slide = reduce ? 0 : 36;

    return (
        <div className="min-h-screen bg-background" data-subject-info={subject.id}>
            <div className="max-w-4xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
                <button onClick={onBack}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground
                        hover:text-foreground transition-colors mb-4">
                    <ArrowLeft className="w-3.5 h-3.5" /> Subjects
                </button>

                <AnimatePresence mode="wait" initial={false} custom={dirRef.current}>
                    <motion.div key={subject.id} custom={dirRef.current}
                        variants={{
                            enter: (d) => ({ opacity: 0, x: d * slide }),
                            center: { opacity: 1, x: 0 },
                            exit: (d) => ({ opacity: 0, x: -d * slide }),
                        }}
                        initial="enter" animate="center" exit="exit"
                        transition={{ duration: reduce ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                        className="space-y-10">

                        {/* ── THE SUBJECT ─────────────────────────────────── */}
                        <section className="relative rounded-3xl bg-surface border border-border on-table overflow-hidden">
                            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5" style={{ background: hex }} />
                            <span aria-hidden="true" className="absolute inset-0 pointer-events-none"
                                style={{ background: `linear-gradient(110deg, ${alpha(hex, 0.12)}, transparent 55%)` }} />
                            <div className="relative pl-6 pr-5 sm:pl-8 sm:pr-7 py-6 sm:py-7">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="stat-label text-muted-foreground">
                                            {/* The area alone: the catalogue's codes are just
                                                the name shortened ("GENERAL MATHS"), so printing
                                                one over the name says it twice. */}
                                            {subject.is_private ? "Your own subject" : area || "VCE"}
                                        </p>
                                        <h1 className="font-display font-extrabold tracking-tight text-foreground
                                            text-3xl sm:text-4xl leading-[1.05] mt-1.5">{subject.name}</h1>
                                    </div>
                                    <ScalingMark subject={subject} size="lg" />
                                </div>
                                {subject.overview && (
                                    <p className="text-[15px] sm:text-base text-muted-foreground leading-relaxed mt-3 max-w-2xl">
                                        {subject.overview}
                                    </p>
                                )}

                                {/* Before you start. A requirement is NEEDS, advice is
                                    SUITS, and the catalogue's own sentence is kept —
                                    Browse trims it, so this is where it is whole. */}
                                {prereqs.length > 0 && (
                                    <ul className="flex flex-wrap gap-2 mt-4" data-prereqs>
                                        {prereqs.map((p) => (
                                            <li key={p.raw} title={p.raw !== p.text ? p.raw : undefined}
                                                className={`pill text-[12px] ${p.kind === "required"
                                                    ? "bg-xp/10 text-xp"
                                                    : "bg-secondary text-muted-foreground"}`}>
                                                <span className="font-bold mr-1">{p.kind === "required" ? "Needs" : "Suits"}</span>
                                                {p.text}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <div className="flex flex-wrap items-center gap-2.5 mt-5">
                                    {taken ? (
                                        <>
                                            <span className="pill bg-primary/10 text-primary text-[12px] font-bold">
                                                <Check className="w-3.5 h-3.5 mr-1" /> In your subjects
                                            </span>
                                            <Link to={`${createPageUrl("SubjectHub")}?subject=${encodeURIComponent(userSubject.subject_name || subject.name)}`}>
                                                <Button className="btn-3d gap-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl" data-open-hub>
                                                    Open your hub <ArrowRight className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                        </>
                                    ) : onAdd && (
                                        <Button onClick={() => onAdd(subject)} data-add-subject
                                            className="btn-3d gap-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl">
                                            <Plus className="w-4 h-4" /> Add to my subjects
                                        </Button>
                                    )}
                                    {compareDefault && (
                                        <Button variant="outline" onClick={() => setComparing(compareDefault)} data-compare
                                            className="rounded-xl gap-1.5 border-2 border-border">
                                            <Columns2 className="w-4 h-4" /> Compare
                                        </Button>
                                    )}
                                    {/* A student's own subject is private, so a link to it
                                        would open nothing for anybody else. */}
                                    {!subject.is_private && <ShareLink subject={subject} />}
                                    {onDelete && <DeleteOwn onDelete={onDelete} />}
                                </div>
                            </div>
                        </section>

                        {/* ── HOW IT'S MARKED ─────────────────────────────── */}
                        {bar && (
                            <Section title="How it's marked" index={1}>
                                <p className="font-display font-extrabold text-xl sm:text-2xl text-foreground leading-snug mb-4"
                                    data-bar-lead>{bar.lead}</p>
                                <YearBar bar={bar} hex={hex} delay={0.1} />
                            </Section>
                        )}

                        {/* ── WHAT A SCORE IS WORTH HERE ──────────────────── */}
                        <Section title="What a score is worth here" index={2}>
                            <div className="grid lg:grid-cols-[1fr_15rem] gap-6 lg:gap-8 items-start">
                                <div>
                                    <ScoreCurve target={shown} tone={hex}
                                        scaled={shown == null ? null : scaledScore(shown, subject)}
                                        label={taken ? `Target study score for ${subject.name}` : `Try a study score in ${subject.name}`}
                                        onChange={(n) => (taken ? onTarget?.(clampScore(n)) : setWhatIf(clampScore(n)))}
                                        onCommit={taken ? onCommitTarget : undefined}
                                        emptyHint={taken ? undefined : "Drag the curve to try a score"} />
                                    <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed" data-curve-note>
                                        {taken
                                            ? "This is your target — the same one on your shelf and your hub. Drag to change it."
                                            : "Where a score sits in the state is exact; what it scales to is an estimate. Nothing here is saved."}
                                    </p>
                                </div>
                                <dl className="space-y-4">
                                    {scaling?.scaling_description && (
                                        <div>
                                            <dt className="stat-label">Scaling</dt>
                                            <dd className="text-sm text-foreground leading-relaxed mt-1">{scaling.scaling_description}</dd>
                                        </div>
                                    )}
                                    {Number.isFinite(mean) && mean > 0 && (
                                        <div>
                                            <dt className="stat-label">Average scaled score</dt>
                                            <dd className="mt-0.5">
                                                <span className="font-display font-extrabold text-2xl tabular-nums text-foreground">{mean}</span>
                                                <span className="block text-[12px] text-muted-foreground leading-snug">
                                                    Where the typical student in it finishes, after scaling.
                                                </span>
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </div>
                        </Section>

                        {/* ── WHAT YOU'LL STUDY ───────────────────────────── */}
                        {skills.length > 0 && (
                            <Section title="What you'll study" index={3}
                                aside={coverage?.total > 0 && (
                                    <span className="text-[12px] font-bold tabular-nums text-muted-foreground flex-shrink-0" data-coverage>
                                        {coverage.covered} of {coverage.total} in your work
                                    </span>
                                )}>
                                <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                                    {skills.map((skill, i) => {
                                        const area = coverage?.areas?.find((a) => a.skill === skill);
                                        return (
                                            <motion.li key={skill}
                                                initial={reduce ? false : { opacity: 0, x: -6 }}
                                                whileInView={{ opacity: 1, x: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 0.25, delay: i * 0.05 }}
                                                className="flex items-center gap-3 py-2 border-b border-border/60">
                                                <span className="font-display font-extrabold text-sm tabular-nums w-6 flex-shrink-0"
                                                    style={{ color: hex }}>{String(i + 1).padStart(2, "0")}</span>
                                                <span className="flex-1 min-w-0 text-[15px] text-foreground">{skill}</span>
                                                {area && (
                                                    <span title={area.covered ? `In your work: ${area.topics.join(", ")}` : "Nothing of yours names this yet"}
                                                        data-covered={area.covered ? "1" : "0"}
                                                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                                                            ${area.covered ? "bg-primary" : "border-2 border-border"}`}>
                                                        {area.covered && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                                                    </span>
                                                )}
                                            </motion.li>
                                        );
                                    })}
                                </ol>
                                {coverage?.total > 0 && (
                                    <p className="text-[12px] text-muted-foreground mt-3 leading-relaxed">
                                        Ticked off your own decks and quizzes by name — an area is ticked only if
                                        something of yours names it.
                                    </p>
                                )}
                            </Section>
                        )}

                        {/* ── HOW STUDENTS DO WELL ────────────────────────── */}
                        {tips.length > 0 && (
                            <Section title="How students do well in it" index={4}>
                                <ul className="space-y-3">
                                    {tips.map((tip) => (
                                        <li key={tip} className="pl-4 border-l-2 text-[15px] text-foreground leading-relaxed"
                                            style={{ borderColor: alpha(hex, 0.55) }}>{tip}</li>
                                    ))}
                                </ul>
                            </Section>
                        )}

                        {/* ── ALTERNATIVES ────────────────────────────────── */}
                        {alts.length > 0 && (
                            <Section title={`Other ${area} subjects`} index={5}>
                                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x" data-alternatives>
                                    {alts.map((a) => {
                                        const tone = colorFor(a.subject.name);
                                        return (
                                            <div key={a.subject.id}
                                                className={`relative snap-start flex-shrink-0 w-[13.5rem] rounded-2xl border-2 overflow-hidden
                                                    ${a.current ? "border-foreground/25 bg-secondary/40" : "border-border bg-surface on-table"}`}>
                                                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: tone }} />
                                                <button type="button" disabled={a.current} data-alt={a.subject.id}
                                                    onClick={() => open(a.subject)}
                                                    className="w-full text-left pl-4 pr-3 pt-3 pb-2 disabled:cursor-default">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span className="font-display font-extrabold text-sm text-foreground leading-tight">
                                                            {a.subject.name}
                                                        </span>
                                                        <ScalingMark subject={a.subject} size="sm" showLabel={false} />
                                                    </div>
                                                    <span className="block text-[11px] text-muted-foreground mt-1 tabular-nums">
                                                        {a.exam != null ? `${a.exam}% in the exams` : "No assessment data"}
                                                    </span>
                                                </button>
                                                <div className="pl-4 pr-3 pb-3">
                                                    {a.current ? (
                                                        <span className="text-[11px] font-bold text-muted-foreground">Viewing</span>
                                                    ) : (
                                                        <button type="button" onClick={() => setComparing(a.subject)}
                                                            className="text-[11px] font-bold text-muted-foreground hover:text-foreground
                                                                underline underline-offset-4" data-alt-compare={a.subject.id}>
                                                            Compare side by side
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Section>
                        )}

                        {/* ── WHERE IT LEADS ──────────────────────────────── */}
                        {careers.length > 0 && (
                            <Section title="Where it leads" index={6}>
                                <ul className="flex flex-wrap gap-2">
                                    {careers.map((c) => (
                                        <li key={c} className="px-3 py-1.5 rounded-full text-[13px] font-bold text-foreground"
                                            style={{ background: alpha(hex, 0.12) }}>{c}</li>
                                    ))}
                                </ul>
                                <p className="text-[12px] text-muted-foreground mt-3">
                                    A few of the places it leads, not a list of requirements — a careers adviser
                                    can say what a particular course asks for.
                                </p>
                            </Section>
                        )}

                        <p className="text-[12px] text-muted-foreground leading-relaxed border-t border-border pt-4">
                            Scaling reflects the strength of the students who take a subject, not how hard it is to
                            do well in. The subject you can do well in is usually the better choice.
                        </p>
                    </motion.div>
                </AnimatePresence>
            </div>

            <SubjectCompare open={!!comparing} a={subject} b={comparing} catalogue={catalogue}
                hexA={hex} onChangeB={setComparing} onClose={() => setComparing(null)}
                onOpen={(s) => { setComparing(null); open(s); }} />
        </div>
    );
}
