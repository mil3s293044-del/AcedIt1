/**
 * Explore — the front door.
 *
 * Every other piece of guidance in this app is PUSH: Ace introduces a page you
 * happen to be standing on, a tip explains a term you happen to be looking at,
 * the help button describes the page you already found. All of it good, none of
 * it reachable on purpose. A student who doesn't know what's here has no verb —
 * there was no page to open, nothing to search, and the one surface that looked
 * like an index (Guides) had zero links pointing at it from anywhere in the app.
 *
 * So this is the pull half: one page listing everything, searchable, with the
 * question a student actually arrives with at the top of it.
 *
 * It invents no content. `aceKnowledge` already describes every feature — what
 * it is, WHEN it's worth opening, and what has to exist first — and already
 * ranks them against a phrase, synonyms and all. That file was built to answer
 * Ace's questions and turns out to be a search index nobody had rendered. The
 * one rule this page follows is its rule: describe a feature in exactly one
 * place, so a description that rots rots everywhere at once.
 *
 * `when` leads over `what` on every row on purpose. "What" tells a student the
 * thing exists, which is not their problem — they can see the nav. "When" tells
 * them whether today is the day, which is the whole question.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, X, ArrowRight, Lock, Compass } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { isPremium } from "@/components/shared/subscriptionHelpers";
import { FEATURES, SECTIONS, BY_ID, searchFeatures, readiness, blockedBy } from "@/lib/aceKnowledge";

/**
 * Roughly the order a student needs them, which is not the order they were
 * built in. Setup first because most of the app is dark without it.
 */
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
 * The questions students turn up with, in their words rather than ours.
 *
 * Each one is checked against the real search — a prompt that returns nothing
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

function FeatureRow({ feature, ready, premium }) {
    const blocked = ready ? blockedBy(feature, ready) : null;
    const locked = feature.premium && !premium;
    const parent = feature.parent ? BY_ID[feature.parent] : null;

    return (
        <div className="rounded-2xl bg-surface border border-border p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="font-display font-extrabold text-foreground leading-tight">
                        {feature.name}
                        {parent && (
                            <span className="font-body font-normal text-xs text-muted-foreground ml-2">
                                inside {parent.name}
                            </span>
                        )}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{feature.what}</p>
                </div>
                {locked && (
                    <span className="pill bg-chart-4/10 text-chart-4 text-[10px] flex-shrink-0
                        inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Premium
                    </span>
                )}
            </div>

            {/* The field that does the work. */}
            <p className="text-sm text-foreground mt-3 leading-relaxed">
                <span className="stat-label text-muted-foreground mr-1.5">Worth opening when</span>
                {feature.when}
            </p>

            {feature.proof && (
                <p className="text-xs text-muted-foreground mt-2 italic">{feature.proof}</p>
            )}

            {/* A link into a feature whose inputs don't exist is a dead end with
                a nice button on it, so it sends them to the input instead. */}
            <div className="mt-4">
                {blocked ? (
                    <Link to={blocked.fix}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-chart-4
                            hover:underline">
                        {blocked.verb} {blocked.label} first <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                ) : (
                    <Link to={feature.to}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-primary
                            hover:underline">
                        Open {feature.name} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                )}
            </div>
        </div>
    );
}

export default function Explore() {
    const [query, setQuery] = useState("");
    const [ready, setReady] = useState(null);
    const [premium, setPremium] = useState(true);

    // Readiness is a nicety, not a gate. If any of this fails the page still
    // lists everything and links straight through — a guide that can't reach
    // the database should get quieter, not wrong.
    const load = useCallback(async () => {
        try {
            const me = await base44.auth.me();
            const email = me?.email;
            if (!email) return;
            const q = (entity, extra = {}, ...rest) =>
                base44.entities[entity].filter({ created_by: email, ...extra }, ...rest).catch(() => []);
            const [subjects, flashcards, assessments, techniques, maps, friends, profiles] =
                await Promise.all([
                    q("UserSubject", { is_active: true }),
                    q("Flashcard", { is_active: true }),
                    q("SubjectAssessment", {}, "due_date", 20),
                    q("StudyTechnique", {}, "-date", 120),
                    q("MindMap", {}, "-updated_date", 60),
                    q("Friendship", {}),
                    q("UserProfile", {}),
                ]);
            setReady(readiness({ subjects, flashcards, assessments, techniques, maps, friends }));
            setPremium(isPremium(profiles?.[0] || null));
        } catch { /* leave readiness null — every row stays openable */ }
    }, []);
    useEffect(() => { load(); }, [load]);

    const results = useMemo(
        () => (query.trim() ? searchFeatures(query) : null),
        [query],
    );

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            <div className="flex items-center gap-2 mb-1">
                <Compass className="w-5 h-5 text-primary" />
                <p className="stat-label text-muted-foreground">Explore</p>
            </div>
            <h1 className="font-display font-black text-foreground text-3xl sm:text-4xl leading-tight">
                What do you need?
            </h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">
                Everything AcedIt can do, what it's for, and when it's worth opening.
                Search it, or read down the list.
            </p>

            {/* ── Search ─────────────────────────────────────────────────── */}
            <div className="relative mt-6">
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

            {/* ── The questions people actually arrive with ──────────────── */}
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

            {/* ── Results, or the full list ──────────────────────────────── */}
            {results ? (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
                    <p className="stat-label text-muted-foreground mb-3">
                        {results.length
                            ? `${results.length} ${results.length === 1 ? "match" : "matches"}`
                            : "No match"}
                    </p>
                    {results.length ? (
                        <div className="space-y-3">
                            {results.map((f) => (
                                <FeatureRow key={f.id} feature={f} ready={ready} premium={premium} />
                            ))}
                        </div>
                    ) : (
                        /* An empty result that just says "nothing" teaches the
                           student the search is broken. This one keeps a door
                           open instead. */
                        <div className="rounded-2xl bg-surface border border-border p-5">
                            <p className="text-foreground font-bold">Nothing here matches that.</p>
                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                                Try a plainer word — &ldquo;flashcards&rdquo;, &ldquo;essay&rdquo;,
                                &ldquo;timetable&rdquo; — or clear the box and read down the list.
                                If it's a subject question rather than an app question, Ace in the
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
                <div className="mt-8 space-y-10">
                    {SECTION_ORDER.filter((s) => SECTIONS[s]?.length).map((section) => (
                        <section key={section}>
                            <h2 className="font-display font-extrabold text-foreground text-lg">{section}</h2>
                            {SECTION_BLURB[section] && (
                                <p className="text-sm text-muted-foreground mt-1 mb-4 leading-relaxed">
                                    {SECTION_BLURB[section]}
                                </p>
                            )}
                            <div className="space-y-3">
                                {SECTIONS[section].map((id) => (
                                    <FeatureRow key={id} feature={BY_ID[id]} ready={ready} premium={premium} />
                                ))}
                            </div>
                        </section>
                    ))}

                    <p className="text-xs text-muted-foreground text-center pt-2">
                        {FEATURES.length} things, all of them described in one file so none of them
                        can quietly stop being true.
                    </p>
                </div>
            )}
        </div>
    );
}
