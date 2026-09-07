/**
 * SubjectHub — one subject, everything the app knows about it, one screen.
 *
 * ─── The page that was missing ──────────────────────────────────────────────
 * A student's work on a subject lived on six screens and gathered on none: the
 * decks on Review, the quizzes on Quizzes, the dropped criteria on
 * /MistakeBank, the hours in two log tables, the SAC on the planner. Subjects —
 * the page named after the thing — showed a VCAA overview, a scaling pill and
 * a "Details" link, which is a catalogue entry. So the question every student
 * actually asks ("where am I up to in Chemistry, and what should I do about
 * it") had nowhere to be answered.
 *
 * ─── It leads with ONE move ─────────────────────────────────────────────────
 * The same discipline as the dashboard: the top of the page makes a case, and
 * everything under it is evidence. `subjectLead` picks by what it costs — a
 * SAC inside a fortnight, then marks you are actively dropping, then the review
 * pile, then a gap in the course — and returns NOTHING rather than a
 * placeholder when none of those is real.
 *
 * ─── And it tells you two things you cannot work out yourself ───────────────
 * WHERE THE MARKS ARE. `assessment_structure` is real VCAA data the app has
 * shipped since the catalogue was written and never once read: Exam 2 is 44%
 * of Methods, the Unit 4 SAC is 14%. A student revising for the 14% the week
 * before the 44% is making a bad trade and has no way to see it, because the
 * weights live in a study design nobody opens.
 *
 * WHAT YOU HAVE NEVER TOUCHED. `key_skills` is the areas of study; the decks
 * and quizzes the student has already made are matched against it by name. No
 * tagging, no new field, no backfill — and anything it does not recognise is
 * SAID rather than swept onto the nearest area, because "you have never
 * studied Vectors" is only worth printing by a page that also admits what it
 * could not place.
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
    ArrowLeft, ArrowRight, Brain, Bookmark, CalendarDays, Layers,
    Target, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PlayingCard from "@/components/cards/PlayingCard";
import { rankFor, suitFor, subjectColor, colorFor } from "@/components/cards/cardIdentity";
import { alpha } from "@/components/cards/PlayingCard";
import { deckCards, BANK_TOPIC } from "@/lib/mistakeBank";
import { studyEvents } from "@/lib/studyLog";
import { VCE_SUBJECTS } from "@/data/vceSubjects";
import { markSplit, coverage, subjectStats, subjectLead } from "@/lib/subjectHub";
import HelpButton from "@/components/shared/HelpButton";

const fmtTime = (m) => {
    const n = Math.max(0, Math.round(m || 0));
    if (n < 60) return `${n}m`;
    const h = Math.floor(n / 60);
    const r = n % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
};

/** The lead's tone, per kind. Static classes — the JIT cannot see a template. */
const LEAD_TONE = {
    assessment: { text: "text-streak", chip: "bg-streak/10 text-streak", icon: CalendarDays },
    mistakes:   { text: "text-streak", chip: "bg-streak/10 text-streak", icon: Bookmark },
    due:        { text: "text-primary", chip: "bg-primary/10 text-primary", icon: Layers },
    gap:        { text: "text-xp", chip: "bg-xp/10 text-xp", icon: Target },
    weight:     { text: "text-chart-3", chip: "bg-chart-3/10 text-chart-3", icon: TrendingUp },
};

/** Where the lead sends you. One button, and it goes somewhere real. */
const LEAD_ACTION = {
    assessment: { label: "Open the planner", page: "Goals" },
    mistakes:   { label: "Fix them", page: "MistakeBank" },
    due:        { label: "Review now", page: "Review" },
    gap:        { label: "Make something for it", page: "Study" },
    weight:     { label: "Sit a quiz", page: "Quizzes" },
};

function Stat({ label, value, sub, tone = "text-foreground" }) {
    return (
        <div className="min-w-0">
            <p className="stat-label">{label}</p>
            <p className={`font-display font-extrabold text-2xl leading-none mt-1 tabular-nums ${tone}`}>
                {value}
            </p>
            {sub && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{sub}</p>}
        </div>
    );
}

export default function SubjectHub() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        flashcards: [], quizzes: [], attempts: [], bank: [],
        events: [], assessments: [], userSubject: null,
    });

    // The subject is in the query string rather than the path: createPageUrl
    // builds `/PageName`, and every other cross-page link in the app is built
    // with it. A second URL scheme for one page is how routes start
    // disagreeing with the router.
    useEffect(() => {
        const q = new URLSearchParams(window.location.search).get("subject") || "";
        setName(q);
    }, []);

    useEffect(() => {
        if (!name) return;
        let cancelled = false;
        (async () => {
            try {
                const user = await base44.auth.me();
                const fail = () => [];
                const [cards, quizzes, attempts, bank, sessions, techniques, assessments, mine] =
                    await Promise.all([
                        base44.entities.Flashcard.filter({ created_by: user.email, is_active: true }).catch(fail),
                        base44.entities.Quiz.filter({ created_by: user.email }).catch(fail),
                        base44.entities.QuizAttempt.filter({ created_by: user.email }).catch(fail),
                        base44.entities.Flashcard.filter({
                            created_by: user.email, topic: BANK_TOPIC, is_active: true,
                        }).catch(fail),
                        base44.entities.StudySession.filter({ created_by: user.email }, "-date", 400).catch(fail),
                        base44.entities.StudyTechnique.filter({ created_by: user.email }, "-date").catch(fail),
                        base44.entities.SubjectAssessment.filter({ created_by: user.email }).catch(fail),
                        base44.entities.UserSubject.filter({ created_by: user.email, is_active: true }).catch(fail),
                    ]);
                if (cancelled) return;
                setData({
                    // Deck cards only. The bank is counted separately as
                    // mistakes, and counting it twice would inflate both.
                    flashcards: deckCards(cards),
                    quizzes: quizzes || [],
                    attempts: attempts || [],
                    bank: bank || [],
                    events: studyEvents(sessions, techniques),
                    assessments: assessments || [],
                    userSubject: (mine || []).find(
                        (s) => String(s.subject_name).toLowerCase() === name.toLowerCase()) || null,
                });
            } catch (err) {
                console.error("Subject hub load error:", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [name]);

    const full = useMemo(
        () => VCE_SUBJECTS.find((s) => String(s.name).toLowerCase() === name.toLowerCase()) || null,
        [name],
    );

    const stats = useMemo(
        () => subjectStats(name, {
            flashcards: data.flashcards, quizzes: data.quizzes, attempts: data.attempts,
            bankCards: data.bank, events: data.events, assessments: data.assessments,
        }),
        [name, data],
    );

    // Coverage reads BOTH decks and quizzes: a student who has never made a
    // flashcard for Vectors but has sat three quizzes on it has covered it,
    // and a page that said otherwise would be wrong in the direction that
    // matters least — but wrong all the same.
    const cov = useMemo(() => {
        const topics = [
            ...stats.topics,
            ...data.quizzes
                .filter((q) => String(q?.subject || "").toLowerCase() === name.toLowerCase())
                .map((q) => q?.title)
                .filter(Boolean),
        ];
        return coverage(full?.key_skills, topics);
    }, [full, stats.topics, data.quizzes, name]);

    const split = useMemo(() => markSplit(full), [full]);
    const lead = useMemo(() => subjectLead(stats, cov, split), [stats, cov, split]);

    const hex = data.userSubject ? subjectColor(data.userSubject) : colorFor(name);
    const rank = rankFor(stats.mastery);
    const suit = suitFor(name);

    if (!name) {
        return (
            <div className="p-6 max-w-2xl mx-auto text-center">
                <p className="font-bold text-foreground">No subject named.</p>
                <Link to={createPageUrl("Subjects")}>
                    <Button className="mt-3">Back to your subjects</Button>
                </Link>
            </div>
        );
    }

    const Icon = lead ? LEAD_TONE[lead.kind].icon : Brain;
    const tone = lead ? LEAD_TONE[lead.kind] : null;
    const action = lead ? LEAD_ACTION[lead.kind] : null;

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <button onClick={() => navigate(createPageUrl("Subjects"))}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground
                            hover:text-foreground transition-colors mb-2">
                        <ArrowLeft className="w-3.5 h-3.5" /> Subjects
                    </button>
                    <h1 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight
                        text-foreground truncate">{name}</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {data.userSubject?.year_level || full?.code || "Your subject"}
                        {full?.scaling_info?.scaling_factor
                            ? ` · scales ${full.scaling_info.scaling_factor}` : ""}
                    </p>
                </div>
                <HelpButton page="Subjects" />
            </div>

            {/* ── The move ───────────────────────────────────────────── */}
            {/* The card is the app's own object, and the rank on it is the
                mastery score every other surface uses — one contract, not a
                second scale invented for this page. */}
            <motion.section
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-surface border border-border on-table overflow-hidden">
                <div className="flex flex-col sm:flex-row items-stretch gap-5 sm:gap-7 p-5 lg:p-6">
                    <div className="flex-shrink-0 self-center sm:self-start">
                        <PlayingCard rank={rank} suit={suit} tone={hex} smallIndices
                            watermark={false} pips="compact"
                            className="w-[104px] aspect-[2.5/3.5]">
                            {/* `pr-4` clears the bottom-right index. A real
                                card never prints over its own index, and
                                centred edge to edge a long subject name runs
                                straight under it. */}
                            <span className="absolute inset-x-0 bottom-0 pl-1.5 pr-4 pt-1 pb-1.5 text-center"
                                style={{ background: alpha(hex, 0.13) }}>
                                <span className="block text-[10px] font-extrabold leading-[1.15]
                                    text-foreground/80 line-clamp-2 break-words">{name}</span>
                            </span>
                        </PlayingCard>
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                        {lead ? (
                            <>
                                <span className={`pill w-fit text-[10px] mb-2 ${tone.chip}`}>
                                    <Icon className="w-3 h-3 mr-1" /> Next
                                </span>
                                <h2 className={`font-display font-extrabold text-xl lg:text-2xl
                                    leading-tight ${tone.text}`}>{lead.title}</h2>
                                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                                    {lead.detail}
                                </p>
                                <Link to={createPageUrl(action.page)} className="mt-4 w-fit">
                                    <Button className="gap-1.5">{action.label}
                                        <ArrowRight className="w-4 h-4" /></Button>
                                </Link>
                            </>
                        ) : (
                            <>
                                <h2 className="font-display font-extrabold text-xl lg:text-2xl
                                    text-foreground leading-tight">Nothing outstanding here</h2>
                                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                                    No cards ready, no mistakes open and nothing on the calendar.
                                    Building something new is the move.
                                </p>
                                <Link to={createPageUrl("Study")} className="mt-4 w-fit">
                                    <Button className="gap-1.5">Open Study
                                        <ArrowRight className="w-4 h-4" /></Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                {/* Your own numbers, as a strip under the case. */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-border/70
                    bg-secondary/30 px-5 lg:px-6 py-4">
                    <Stat label="Ready" value={stats.due}
                        tone={stats.due > 0 ? "text-primary" : "text-muted-foreground/60"}
                        sub={`${stats.cards} card${stats.cards === 1 ? "" : "s"} in ${stats.decks} deck${stats.decks === 1 ? "" : "s"}`} />
                    <Stat label="Best quiz"
                        value={stats.bestScore != null ? `${Math.round(stats.bestScore)}%` : "—"}
                        sub={stats.sits ? `${stats.sits} sit${stats.sits === 1 ? "" : "s"}` : "never sat"} />
                    <Stat label="Mistakes open" value={stats.mistakes}
                        tone={stats.mistakes > 0 ? "text-streak" : "text-muted-foreground/60"}
                        sub={stats.mistakes ? "still costing marks" : "nothing banked"} />
                    <Stat label="This week" value={fmtTime(stats.weekMinutes)}
                        sub={stats.usualMinutes != null
                            ? `usually ${fmtTime(stats.usualMinutes)}`
                            : "no usual yet"} />
                </div>
            </motion.section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-start">
                {/* ── Where the marks are ────────────────────────────── */}
                {split.parts.length > 0 && (
                    <motion.section
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="card-soft on-table p-5 lg:p-6">
                        <p className="stat-label mb-1">Where the marks are</p>
                        <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                            VCAA's split for this subject, heaviest first. Revising the
                            {" "}{split.parts[split.parts.length - 1].percentage}% before the
                            {" "}{split.parts[0].percentage}% is the trade nobody means to make.
                        </p>
                        <ul className="space-y-3">
                            {split.parts.map((p) => (
                                <li key={p.component}>
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="text-[13px] font-bold text-foreground truncate">
                                            {p.component}
                                        </span>
                                        <span className="text-[12px] font-bold tabular-nums text-muted-foreground
                                            flex-shrink-0">{p.percentage}%</span>
                                    </div>
                                    <span className="block h-1.5 rounded-full bg-secondary overflow-hidden mt-1">
                                        <motion.span className="block h-full rounded-full"
                                            style={{ background: hex }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${p.percentage}%` }}
                                            transition={{ duration: 0.6 }} />
                                    </span>
                                    {p.description && (
                                        <span className="block text-[11px] text-muted-foreground/70 mt-1">
                                            {p.description}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                        {/* Said out loud rather than scaled to fit. A study
                            design whose components do not add to 100 is a fact
                            about the data, not something to paper over. */}
                        {split.total !== 100 && (
                            <p className="text-[11px] text-muted-foreground/60 mt-3">
                                These add to {split.total}% — the rest is not in our catalogue.
                            </p>
                        )}
                    </motion.section>
                )}

                {/* ── Coverage ───────────────────────────────────────── */}
                {cov.total > 0 && (
                    <motion.section
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="card-soft on-table p-5 lg:p-6">
                        <div className="flex items-baseline justify-between gap-3 mb-1">
                            <p className="stat-label">The course</p>
                            <span className="text-[12px] font-bold tabular-nums text-muted-foreground">
                                {cov.covered}/{cov.total}
                            </span>
                        </div>
                        <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                            Matched off your own decks and quizzes by name — an area is only
                            ticked if you have material that names it.
                        </p>
                        <ul className="flex flex-wrap gap-2">
                            {cov.areas.map((a) => (
                                <li key={a.skill}
                                    className={`pill text-[11px] ${a.covered
                                        ? "bg-primary/10 text-primary"
                                        : "bg-secondary text-muted-foreground"}`}
                                    title={a.covered ? a.topics.join(", ") : "Nothing of yours names this"}>
                                    {a.skill}
                                </li>
                            ))}
                        </ul>
                        {cov.untouched.length > 0 && (
                            <p className="text-[13px] leading-relaxed mt-4">
                                <span className="font-bold text-xp">Nothing yet on {cov.untouched[0]}</span>
                                <span className="text-muted-foreground">
                                    {cov.untouched.length > 1
                                        ? ` — or ${cov.untouched.length - 1} other area${cov.untouched.length > 2 ? "s" : ""}.`
                                        : "."}
                                </span>
                            </p>
                        )}
                        {/* The honest half. A page that claims to know what you
                            have covered has to admit what it could not place,
                            or the ticks above are worth nothing. */}
                        {cov.unmatched.length > 0 && (
                            <p className="text-[11px] text-muted-foreground/60 mt-2 leading-relaxed">
                                {cov.unmatched.length} of your topic{cov.unmatched.length === 1 ? "" : "s"}
                                {" "}({cov.unmatched.slice(0, 3).join(", ")}
                                {cov.unmatched.length > 3 ? "…" : ""}) didn't match an area by name.
                            </p>
                        )}
                    </motion.section>
                )}
            </div>

            {/* ── The study design's own advice, if the catalogue has it ── */}
            {full?.study_tips?.length > 0 && (
                <motion.section
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="card-soft on-table p-5 lg:p-6">
                    <p className="stat-label mb-3">What works in this subject</p>
                    <ul className="space-y-2">
                        {full.study_tips.map((t, i) => (
                            <li key={i} className="flex gap-2.5 text-[13px] text-foreground leading-relaxed">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ background: hex }} />
                                <span>{t}</span>
                            </li>
                        ))}
                    </ul>
                </motion.section>
            )}

            {loading && (
                <p className="text-center text-sm text-muted-foreground py-4">Loading your work…</p>
            )}
        </div>
    );
}
