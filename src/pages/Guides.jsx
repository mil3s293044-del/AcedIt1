/**
 * Guides — how every subject is marked, and why each technique works.
 *
 * This page used to be posts. Any student could write one, any student could
 * read all of them, and the author ticked their own "featured" box — free
 * text between students on a product sold to schools, with nothing checking a
 * word of it. Every guide here is BUILT from what the app already knows
 * (`src/lib/guides.js`): the examiner notes the marker works from, VCAA's mark
 * split, and the cited science behind each technique. Nothing on it was
 * written by a student, and the old posts are no longer read at all.
 *
 * Two screens on one route, chosen by the query string the way SubjectHub's
 * is: the LIBRARY, and one guide (`?subject=`, `?technique=`, `?ref=`). The
 * subject guide is the same component the subject's hub draws, so the two
 * cannot word a convention differently.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { colorFor } from "@/components/cards/cardIdentity";
import Band from "@/components/shared/Band";
import SubjectGuide, { GuideDoors } from "@/components/guides/SubjectGuide";
import NeuroPanel from "@/components/study/NeuroPanel";
import { guideLibrary, guideFromQuery, searchAreas, subjectLine, subjectLead } from "@/lib/guides";
import { areaLabel } from "@/lib/subjectBrowse";

/* The colour each technique already wears on the Study page, so a technique
   is one colour across the app. Static classes: JIT cannot see a built one. */
const TECHNIQUE_TONE = {
    pomodoro: { spine: "bg-primary", text: "text-primary" },
    spaced_repetition: { spine: "bg-chart-3", text: "text-chart-3" },
    active_recall: { spine: "bg-chart-4", text: "text-chart-4" },
    blurting: { spine: "bg-xp", text: "text-xp" },
    exam: { spine: "bg-streak", text: "text-streak" },
    mind_map: { spine: "bg-map", text: "text-map" },
};
const UTILITY_PILL = {
    high: "bg-primary/15 text-primary",
    moderate: "bg-xp/15 text-xp",
    low: "bg-streak/15 text-streak",
};

const enter = (reduce, i = 0) => (reduce ? {} : {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay: Math.min(0.3, i * 0.03) },
});

/** A guide on the shelf. The whole row is the link, so it is a card. */
function GuideRow({ to, spine, spineStyle, title, line, aside, i = 0 }) {
    const reduce = useReducedMotion();
    return (
        <motion.li {...enter(reduce, i)}>
            <Link to={to}
                className="group relative flex items-center gap-3 rounded-2xl bg-surface border border-border on-table
                    pl-5 pr-3 py-3 min-h-[3.75rem] overflow-hidden hover:border-foreground/20 transition-colors">
                <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${spine || ""}`} style={spineStyle} />
                <span className="min-w-0 flex-1">
                    <span className="block font-bold text-foreground leading-snug">{title}</span>
                    {line && <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">{line}</span>}
                </span>
                {aside}
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </Link>
        </motion.li>
    );
}

function Library({ library }) {
    const [query, setQuery] = useState("");
    const areas = useMemo(() => searchAreas(library.areas, query), [library.areas, query]);
    return (
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-8 lg:space-y-10">
            <header className="max-w-2xl">
                <p className="stat-label text-chart-3 mb-1.5">Guides</p>
                <h1 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                    How it&apos;s marked, and why it works
                </h1>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Every subject&apos;s marking, from the same notes the app&apos;s marker works from, and the
                    research behind each technique with its sources named. None of it is written by other students.
                </p>
            </header>

            {library.mine.length > 0 && (
                <Band title="Your subjects" count={library.mine.length}>
                    <ul className="grid gap-2 sm:grid-cols-2" data-guides="mine">
                        {library.mine.map((g, i) => (
                            <GuideRow key={g.key} i={i} to={g.href} title={g.name} line={subjectLine(g)}
                                spineStyle={{ background: colorFor(g.name) }} />
                        ))}
                    </ul>
                </Band>
            )}

            <Band title="Techniques">
                <ul className="grid gap-2 sm:grid-cols-2" data-guides="techniques">
                    {library.techniques.map((t, i) => (
                        <GuideRow key={t.key} i={i} to={t.href} title={t.name} line={t.headline}
                            spine={TECHNIQUE_TONE[t.id]?.spine || "bg-border"}
                            aside={t.utility && (
                                <span className={`pill text-[10px] flex-shrink-0 hidden sm:inline-flex ${UTILITY_PILL[t.utility.id] || UTILITY_PILL.high}`}>
                                    {t.utility.label}
                                </span>
                            )} />
                    ))}
                </ul>
            </Band>

            <Band title="Reading a question">
                <ul className="grid gap-2 sm:grid-cols-2" data-guides="reference">
                    {library.reference.map((r) => (
                        <GuideRow key={r.key} to={r.href} title={r.name} line={r.headline} spine="bg-chart-3" />
                    ))}
                </ul>
            </Band>

            <Band title="Every subject" count={library.count}
                aside={(
                    <label className="relative w-40 sm:w-56 flex-shrink-0">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden />
                        <input value={query} onChange={(e) => setQuery(e.target.value)}
                            placeholder="Find a subject" aria-label="Find a subject"
                            className="w-full h-9 rounded-full border border-border bg-surface pl-8 pr-8 text-sm text-foreground
                                placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                        {query && (
                            <button type="button" onClick={() => setQuery("")} aria-label="Clear"
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </label>
                )}>
                {areas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No subject matches &ldquo;{query}&rdquo;.</p>
                ) : (
                    <div className="space-y-6" data-guides="all">
                        {areas.map((a) => (
                            <div key={a.key}>
                                <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2">{a.label}</p>
                                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {a.guides.map((g) => (
                                        <GuideRow key={g.key} to={g.href} title={g.name} line={subjectLine(g)}
                                            spineStyle={{ background: colorFor(g.name) }} />
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </Band>
        </div>
    );
}

/** The top of every guide: the way back, what kind of guide, its name. */
function GuideHead({ eyebrow, title, lead, spineStyle, spine, aside }) {
    return (
        <header className="space-y-4">
            <Link to={createPageUrl("Guides")}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" /> All guides
            </Link>
            <div className="flex items-start gap-4">
                <span aria-hidden className={`w-1.5 self-stretch rounded-full flex-shrink-0 ${spine || ""}`} style={spineStyle} />
                <div className="min-w-0 flex-1">
                    <p className="stat-label text-muted-foreground mb-1.5">{eyebrow}</p>
                    <h1 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1] break-words">
                        {title}
                    </h1>
                    {lead && <p className="text-base text-muted-foreground mt-2 leading-relaxed max-w-2xl">{lead}</p>}
                    {aside && <div className="mt-3">{aside}</div>}
                </div>
            </div>
        </header>
    );
}

function SubjectPage({ guide }) {
    const hex = colorFor(guide.name);
    return (
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-8 lg:space-y-10">
            <GuideHead eyebrow={`${areaLabel(guide.area)} · how it's marked`} title={guide.name}
                lead={subjectLead(guide) || null} spineStyle={{ background: hex }} />
            <SubjectGuide guide={guide} place="page" hex={hex} />
        </div>
    );
}

function TechniquePage({ guide }) {
    const tone = TECHNIQUE_TONE[guide.id] || {};
    return (
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-8">
            <GuideHead eyebrow="Technique" title={guide.name} lead={guide.headline} spine={tone.spine || "bg-border"}
                aside={<GuideDoors doors={guide.doors} />} />
            {/* The same panel Study draws beside the technique, as the body of
                the page: the science is written down once. */}
            <NeuroPanel techniqueId={guide.id} techniqueName={guide.name} layout="page" />
        </div>
    );
}

function TermsPage({ guide }) {
    return (
        <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-8">
            <GuideHead eyebrow="Reading a question" title={guide.name} lead={guide.headline} spine="bg-chart-3" />
            <Band title="What each one asks for" count={guide.terms.length}>
                <dl className="divide-y divide-border border-y border-border" data-guide-terms>
                    {guide.terms.map((t) => (
                        <div key={t.id} className="grid grid-cols-[7rem_minmax(0,1fr)] sm:grid-cols-[9rem_minmax(0,1fr)] gap-3 py-2.5">
                            <dt className="font-display font-extrabold text-foreground">{t.term}</dt>
                            <dd className="text-[14px] text-foreground leading-relaxed">
                                {t.behaviour.charAt(0).toUpperCase() + t.behaviour.slice(1)}
                            </dd>
                        </div>
                    ))}
                </dl>
            </Band>
            <div className="space-y-3">
                <p className="font-display font-extrabold text-foreground text-lg lg:text-xl">Try it</p>
                <GuideDoors doors={guide.doors} />
            </div>
        </div>
    );
}

export default function Guides() {
    const location = useLocation();
    const [mySubjects, setMySubjects] = useState([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const user = await base44.auth.me();
                const rows = await base44.entities.UserSubject.filter({ created_by: user.email, is_active: true });
                if (!cancelled) setMySubjects((rows || []).map((r) => r.subject_name).filter(Boolean));
            } catch (e) {
                // The library still works without them: it is every subject.
                console.error("[Guides] subjects:", e);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const guide = useMemo(() => guideFromQuery(location.search), [location.search]);
    const library = useMemo(() => guideLibrary({ mySubjects }), [mySubjects]);

    // A guide opened from a link lands at its top, not wherever the library
    // had been scrolled to.
    useEffect(() => { window.scrollTo({ top: 0 }); }, [location.search]);

    return (
        <div className="min-h-screen bg-background">
            {!guide ? <Library library={library} />
                : guide.kind === "subject" ? <SubjectPage guide={guide} />
                    : guide.kind === "technique" ? <TechniquePage guide={guide} />
                        : <TermsPage guide={guide} />}
        </div>
    );
}
