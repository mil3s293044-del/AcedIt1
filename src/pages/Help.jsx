/**
 * Help — the manual, and the only guidance in here you can go and get.
 *
 * Every other piece of guidance in this app is PUSH: Ace introduces a page you
 * happen to be standing on, a tip explains a term you happen to be looking at,
 * the help button describes the page you already found. All of it good, none of
 * it reachable on purpose. A student who doesn't know what's here has no verb.
 *
 * It lives under Account rather than in the Study section, because that is
 * where a student goes looking when they want the manual — next to Settings
 * and Support, not next to the thing they are trying to do.
 *
 * It invents no content. `aceKnowledge` already describes every feature — what
 * it is, WHEN it's worth opening, what has to exist first — and already ranks
 * them against a phrase, synonyms and all. That file was built to answer Ace's
 * questions and turns out to be a search index nobody had rendered.
 *
 * ─── Why it shows the student's own state ───────────────────────────────────
 * The first version listed all thirty-four features identically, which is a
 * catalogue: nothing on it knew the difference between the technique someone
 * runs daily and the one they've never opened. It was already loading the rows
 * that answer that and spending them on one thing — swapping a dead link for
 * its prerequisite. Now the same rows tick off what's been done, count it, and
 * put what's worth trying next at the top, which is what turns a menu into a
 * map of your own ground.
 *
 * Ticks are POSITIVE EVIDENCE ONLY (see exploreProgress). Nothing here ever
 * tells a student they haven't done something — several features leave no trace
 * a client can read, and being wrong about that once costs the whole page its
 * credibility.
 *
 * `when` leads over `what` on every row, still. "What" tells a student the
 * thing exists, which isn't their problem — they can see the nav. "When" tells
 * them whether today is the day.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, X, ArrowRight, Lock, Compass, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { isPremium } from "@/components/shared/subscriptionHelpers";
import {
    FEATURES, SECTIONS, BY_ID, searchFeatures, readiness, blockedBy,
} from "@/lib/aceKnowledge";
import { featureUsage, suggestNext, MEASURABLE } from "@/lib/exploreProgress";

/** Roughly the order a student needs them. Setup first: most of the app is dark without it. */
const SECTION_ORDER = ["Setup", "Study", "Test", "Plan", "AI", "Progress", "Social"];
const SECTION_BLURB = {
    Setup:    "Do these first — most of the app is organised around them.",
    Study:    "Six techniques doing six different jobs. Which one depends on what's going wrong.",
    Test:     "Finding out what you actually know, rather than what feels familiar.",
    Plan:     "Deciding what to study before you sit down to study it.",
    AI:       "One chat, several specialists. This section is Premium.",
    Progress: "How the last month has actually gone.",
    Social:   "Other people, for when you'll do it for a friend and not for yourself.",
};

/**
 * The suits already carry a plain-English meaning in aceKnowledge — Technique,
 * Motivation, Progress, Together. Borrowing the colour gives a long list some
 * shape without teaching anyone a new word: the label stays the plain one, and
 * the glyph is decoration. Static class strings, because JIT can't see
 * template literals.
 */
const SUIT_STYLE = {
    spade:   { dot: "bg-primary",  soft: "bg-primary/10 text-primary",  edge: "border-l-primary" },
    heart:   { dot: "bg-xp",       soft: "bg-xp/10 text-xp",            edge: "border-l-xp" },
    diamond: { dot: "bg-chart-3",  soft: "bg-chart-3/10 text-chart-3",  edge: "border-l-chart-3" },
    club:    { dot: "bg-chart-4",  soft: "bg-chart-4/10 text-chart-4",  edge: "border-l-chart-4" },
};
const suitOf = (f) => SUIT_STYLE[f?.suit] || SUIT_STYLE.spade;

/**
 * The questions students turn up with, in their words rather than ours.
 * Each is checked against the real search — a prompt that returns nothing
 * teaches a student in one tap that searching here doesn't work, and they will
 * not try twice. If you add one, run it first.
 */
const PROMPTS = [
    "I keep procrastinating",
    "I've got a SAC coming up",
    "I don't understand a topic",
    "I need to memorise something",
    "How am I going?",
    "What am I bad at?",
];

function FeatureCard({ feature, ready, premium, used, compact = false }) {
    const blocked = ready ? blockedBy(feature, ready) : null;
    const locked = feature.premium && !premium;
    const parent = feature.parent ? BY_ID[feature.parent] : null;
    const s = suitOf(feature);

    return (
        <div className={`rounded-2xl bg-surface border border-border p-4 sm:p-5 h-full flex flex-col
            ${parent ? `border-l-4 ${s.edge}` : ""}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-display font-extrabold text-foreground leading-tight
                        flex items-center gap-2 flex-wrap">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} aria-hidden="true" />
                        {feature.name}
                        {parent && (
                            <span className="font-body font-normal text-xs text-muted-foreground">
                                inside {parent.name}
                            </span>
                        )}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{feature.what}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {/* A tick is a fact about a row that exists. There is no
                        opposite badge on purpose — see exploreProgress. */}
                    {used && (
                        <span className="pill bg-primary/10 text-primary text-[10px] inline-flex items-center gap-1">
                            <Check className="w-3 h-3" /> Tried
                        </span>
                    )}
                    {locked && (
                        <span className="pill bg-chart-4/10 text-chart-4 text-[10px] inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Premium
                        </span>
                    )}
                </div>
            </div>

            {!compact && (
                <p className="text-sm text-foreground mt-3 leading-relaxed">
                    <span className="stat-label text-muted-foreground mr-1.5">Worth opening when</span>
                    {feature.when}
                </p>
            )}
            {!compact && feature.proof && (
                <p className="text-xs text-muted-foreground mt-2 italic">{feature.proof}</p>
            )}

            {/* A link into a feature whose inputs don't exist is a dead end with
                a nice button on it, so it sends them to the input instead. */}
            <div className="mt-4 pt-1 mt-auto">
                {blocked ? (
                    <Link to={blocked.fix}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-chart-4 hover:underline">
                        {blocked.verb} {blocked.label} first <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                ) : (
                    <Link to={feature.to}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
                        Open {feature.name} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                )}
            </div>
        </div>
    );
}

export default function Help() {
    const [query, setQuery] = useState("");
    const [section, setSection] = useState("All");
    const [data, setData] = useState(null);
    const [ready, setReady] = useState(null);
    const [premium, setPremium] = useState(true);

    // All of this is a nicety, not a gate. If any of it fails the page still
    // lists everything and links straight through — a guide that can't reach
    // the database should get quieter, not wrong.
    const load = useCallback(async () => {
        try {
            const me = await base44.auth.me();
            const email = me?.email;
            if (!email) return;
            const q = (entity, extra = {}, ...rest) =>
                base44.entities[entity].filter({ created_by: email, ...extra }, ...rest).catch(() => []);
            const [subjects, flashcards, assessments, techniques, maps, plans, friends,
                   quizzes, quizAttempts, aiResults, recallSessions, blurtSessions,
                   competitions, groups, profiles] = await Promise.all([
                q("UserSubject", { is_active: true }),
                q("Flashcard", { is_active: true }),
                q("SubjectAssessment", {}, "due_date", 20),
                q("StudyTechnique", {}, "-date", 200),
                q("MindMap", {}, "-updated_date", 60),
                q("StudyPlan", {}, "date", 40),
                q("Friendship", {}),
                q("Quiz", {}, "-created_date", 40),
                q("QuizAttempt", {}, "-created_date", 40),
                q("AISavedResult", {}, "-created_date", 100),
                q("ActiveRecallSession", {}, "-created_date", 20),
                q("BlurtingSession", {}, "-created_date", 20),
                q("GoalCompetition", {}, "-created_date", 20),
                q("StudyGroup", {}),
                q("UserProfile", {}),
            ]);
            setData({ subjects, flashcards, assessments, techniques, maps, plans, friends,
                      quizzes, quizAttempts, aiResults, recallSessions, blurtSessions,
                      competitions, groups });
            setReady(readiness({ subjects, flashcards, assessments, techniques, maps, friends }));
            setPremium(isPremium(profiles?.[0] || null));
        } catch { /* leave state null — every row stays openable */ }
    }, []);
    useEffect(() => { load(); }, [load]);

    const used = useMemo(() => featureUsage(data), [data]);
    const suggestions = useMemo(
        () => suggestNext(data, { limit: 3, ready, isBlocked: blockedBy }),
        [data, ready]);
    const results = useMemo(() => (query.trim() ? searchFeatures(query) : null), [query]);

    const sections = useMemo(
        () => SECTION_ORDER.filter((s) => SECTIONS[s]?.length), []);
    const visible = section === "All" ? sections : sections.filter((s) => s === section);

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            <div className="flex items-center gap-2 mb-1">
                <Compass className="w-5 h-5 text-primary" />
                <p className="stat-label text-muted-foreground">Help</p>
            </div>
            <h1 className="font-display font-black text-foreground text-3xl sm:text-4xl leading-tight">
                What do you need?
            </h1>
            <p className="text-muted-foreground mt-2 leading-relaxed max-w-2xl">
                Everything AcedIt can do, what it's for, and when it's worth opening.
                Search it, or read down the list.
            </p>

            {/* ── How much of it you've actually used ────────────────────── */}
            {/* Only over what can be proven. Reading Analytics leaves no row a
                client can see, so it isn't in the denominator either — a
                fraction you can never finish is a worse number than no number. */}
            {data && (
                <div className="mt-6 rounded-2xl bg-surface border border-border p-4 sm:p-5">
                    <div className="flex items-baseline justify-between gap-3">
                        <p className="stat-label text-muted-foreground">What you've tried</p>
                        <p className="font-display font-black text-foreground tabular-nums">
                            {used.size}<span className="text-muted-foreground font-bold text-sm"> / {MEASURABLE.length}</span>
                        </p>
                    </div>
                    <div className="h-2 rounded-full bg-secondary mt-2.5 overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.round((used.size / MEASURABLE.length) * 100)}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="h-full rounded-full bg-primary"
                        />
                    </div>
                </div>
            )}

            {/* ── Worth trying next ──────────────────────────────────────── */}
            {suggestions.length > 0 && !query && (
                <section className="mt-6">
                    <h2 className="font-display font-extrabold text-foreground text-lg">Worth trying next</h2>
                    <p className="text-sm text-muted-foreground mt-1 mb-3 leading-relaxed">
                        Picked from what you haven&rsquo;t done yet and can start right now.
                    </p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {suggestions.map((f) => (
                            <FeatureCard key={f.id} feature={f} ready={ready} premium={premium} used={false} />
                        ))}
                    </div>
                </section>
            )}

            {/* ── Search ─────────────────────────────────────────────────── */}
            <div className="relative mt-8">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4
                    text-muted-foreground pointer-events-none" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Try &ldquo;memorise quotes&rdquo; or &ldquo;plan my week&rdquo;"
                    aria-label="Search everything AcedIt can do"
                    className="w-full rounded-2xl bg-surface border-2 border-border focus:border-primary
                        outline-none pl-11 pr-11 py-3.5 text-foreground placeholder:text-muted-foreground
                        transition-colors"
                />
                {query && (
                    <button onClick={() => setQuery("")} aria-label="Clear search"
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full
                            flex items-center justify-center text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
                {PROMPTS.map((p) => (
                    <button key={p} onClick={() => setQuery(p)}
                        className={`pill border transition-colors text-xs ${
                            query === p
                                ? "bg-primary/10 border-primary/40 text-primary"
                                : "bg-surface border-border text-muted-foreground hover:text-foreground"
                        }`}>
                        {p}
                    </button>
                ))}
            </div>

            {results ? (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
                    <p className="stat-label text-muted-foreground mb-3">
                        {results.length
                            ? `${results.length} ${results.length === 1 ? "match" : "matches"}`
                            : "No match"}
                    </p>
                    {results.length ? (
                        <div className="grid md:grid-cols-2 gap-3 items-start">
                            {results.map((f) => (
                                <FeatureCard key={f.id} feature={f} ready={ready}
                                    premium={premium} used={used.has(f.id)} />
                            ))}
                        </div>
                    ) : (
                        /* An empty result that just says "nothing" teaches the
                           student the search is broken. This keeps a door open. */
                        <div className="rounded-2xl bg-surface border border-border p-5">
                            <p className="text-foreground font-bold">Nothing here matches that.</p>
                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                                Try a plainer word — &ldquo;flashcards&rdquo;, &ldquo;essay&rdquo;,
                                &ldquo;timetable&rdquo; — or clear the box and read down the list.
                                If it&rsquo;s a subject question rather than an app question, Ace in the
                                corner is the one to ask.
                            </p>
                            <button onClick={() => setQuery("")}
                                className="text-sm font-bold text-primary hover:underline mt-3">
                                Show everything
                            </button>
                        </div>
                    )}
                </motion.div>
            ) : (
                <>
                    {/* Filter rather than scroll. Thirty-four cards in one
                        column is a wall; the chips make it a shelf. */}
                    <div className="flex flex-wrap gap-2 mt-8 pb-1 border-b border-border">
                        {["All", ...sections].map((s) => (
                            <button key={s} onClick={() => setSection(s)}
                                className={`px-3 py-1.5 rounded-t-xl text-sm font-bold transition-colors ${
                                    section === s
                                        ? "text-primary border-b-2 border-primary -mb-px"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}>
                                {s}
                            </button>
                        ))}
                    </div>

                    <div className="mt-6 space-y-10">
                        {visible.map((s) => (
                            <section key={s}>
                                <h2 className="font-display font-extrabold text-foreground text-lg">{s}</h2>
                                {SECTION_BLURB[s] && (
                                    <p className="text-sm text-muted-foreground mt-1 mb-4 leading-relaxed max-w-2xl">
                                        {SECTION_BLURB[s]}
                                    </p>
                                )}
                                <div className="grid md:grid-cols-2 gap-3 items-start">
                                    {SECTIONS[s].map((id) => (
                                        <FeatureCard key={id} feature={BY_ID[id]} ready={ready}
                                            premium={premium} used={used.has(id)} />
                                    ))}
                                </div>
                            </section>
                        ))}

                        <p className="text-xs text-muted-foreground text-center pt-2">
                            {FEATURES.length} things, all of them described in one file so none of them
                            can quietly stop being true.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
