import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { StudyTechnique, UserProfile, User, UserSubject } from "@/entities/all";
import { motion } from "framer-motion";
import {
    Clock,
    Brain,
    RefreshCw,
    PenTool,
    AlertTriangle,
    GraduationCap,
    BookOpen,
    Flame,
    Network,
    FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

import PomodoroTimer from "../components/study/PomodoroTimer";
import { fireXPFeedback } from "../components/ranked/XPFeedback";
import { base44 } from "@/api/base44Client";
import SpacedRepetition from "../components/study/SpacedRepetition";
import ActiveRecall from "../components/study/ActiveRecall";
import BlurtingMethod from "../components/study/BlurtingMethod";
import ExamMode from "../components/study/ExamMode";
import MindMaps from "../components/study/MindMaps";
import HelpButton from "@/components/shared/HelpButton";
import NeuroPanel from "../components/study/NeuroPanel";
import TechniqueTabs from "../components/study/TechniqueTabs";
import NextStepCard from "../components/study/NextStepCard";
import { todaysIntent } from "@/lib/studyIntent";
import { isReady } from "@/lib/due";
import { deckCards } from "@/lib/mistakeBank";
import { dayKey } from "@/lib/studyLog";
import {
    minutesSummary, nextDeadline, dominantTechnique, techniqueFacts, nextStep,
    greetingFor, fmtMinutes, stepFigure, todayRing, FALLBACK_FACT, TECHNIQUE_READ_LIMIT,
} from "@/lib/studyPage";

// ─── The six techniques ──────────────────────────────────────────────────────
//
// `ink` colours the glyph and `bar` the underline that slides under the live
// tab — the only two places a technique's hue appears. Static class strings,
// so JIT sees them. The `blurb` is the one sentence the shared header prints:
// what the technique is, and what it is for, which used to be two pills on a
// card that named the technique a second time.
const TECHNIQUES = [
    { id: "pomodoro",          name: "Pomodoro",          icon: Clock,         ink: "text-primary", bar: "bg-primary", tone: "primary", blurb: "25 minutes of focus, then a 5-minute break. Best for getting through one topic without burning out." },
    { id: "spaced_repetition", name: "Spaced Repetition", icon: RefreshCw,     ink: "text-chart-3", bar: "bg-chart-3", tone: "chart-3", blurb: "Flashcards that come back just before you would forget them. Best for locking facts in for the long haul." },
    { id: "active_recall",     history: true, name: "Active Recall",     icon: Brain,         ink: "text-chart-4", bar: "bg-chart-4", tone: "chart-4", blurb: "Questions from your notes, answered without looking. Shows what you know rather than what looks familiar." },
    { id: "blurting",          history: true, name: "Blurting",          icon: PenTool,       ink: "text-xp",      bar: "bg-xp",      tone: "xp", blurb: "Write down everything you remember on a topic, then see what you missed. Finds the gaps before a SAC does." },
    { id: "exam",              name: "Revision Mode",     icon: GraduationCap, ink: "text-streak",  bar: "bg-streak",  tone: "streak", blurb: "A timed mock built from your own cards and quizzes. Builds the stamina and timing a real paper needs." },
    { id: "mind_map",          name: "Mind Maps",         icon: Network,       ink: "text-map",     bar: "bg-map",     tone: "map", blurb: "One map per subject, grown all year. Any node opens into a map of its own, and any branch can become flashcards or recall." },
];

/** A pomodoro running in this browser, from the state the timer persists. */
function timerIsLive() {
    try {
        const t = JSON.parse(localStorage.getItem("pomodoroTimerState") || "null");
        return !!t?.isRunning && (t.timeLeft || 0) > 0;
    } catch {
        return false; // corrupt state is not a running timer
    }
}

/** What the strip says while the rows are still loading: what each one IS. */
const LOADING_FACTS = Object.fromEntries(
    Object.entries(FALLBACK_FACT).map(([id, text]) => [id, { text, live: false }]),
);

export default function Study() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [userSubjects, setUserSubjects] = useState([]);
    const [recentSessions, setRecentSessions] = useState([]);
    const [studySessions, setStudySessions] = useState([]);
    const [flashcards, setFlashcards] = useState([]);
    // Every card in their decks, ready or not — only so the strip can tell
    // "All caught up" apart from "No decks yet".
    const [deckCardCount, setDeckCardCount] = useState(0);
    const [assessments, setAssessments] = useState([]);
    const [activeTab, setActiveTab] = useState("pomodoro");
    // Which technique's history dialog is open, if any. It lives here because
    // the button lives in the page's header, beside the technique's name.
    const [historyFor, setHistoryFor] = useState(null);

    // ── The science is a PREFERENCE, answered once ──────────────────────────
    // One key for every technique, not one per technique: a student who opens
    // it on Pomodoro has said what they think of a reference section, and
    // asking again on Active Recall is the app not listening. Read lazily so a
    // blocked or absent localStorage costs a render rather than a crash.
    //
    // It defaults FOLDED now, and that reverses an earlier call on purpose.
    // Open-by-default was right while it was a rail BESIDE the tool, where
    // folding it gave nothing back but width. Under the tool, open, it is two
    // screens of reference between the student and the bottom of the page, on
    // every technique — so only an explicit "open" opens it.
    const [scienceOpen, setScienceOpen] = useState(() => {
        try { return localStorage.getItem("acedit.study.science") === "open"; }
        catch { return false; }
    });
    const toggleScience = useCallback(() => {
        setScienceOpen((wasOpen) => {
            const next = !wasOpen;
            try { localStorage.setItem("acedit.study.science", next ? "open" : "closed"); }
            catch { /* the choice just does not survive the session */ }
            return next;
        });
    }, []);

    // Deep links: /Study?tab=spaced_repetition etc. Ranked's ATAR doors, the
    // review queue and the Progress report all land on the exact technique
    // they name; `reachable.test.mjs` checks every one against TECHNIQUES.
    useEffect(() => {
        const t = new URLSearchParams(window.location.search).get('tab');
        if (t && TECHNIQUES.some(x => x.id === t)) setActiveTab(t);
    }, []);
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState(false);
    // Today's intent picks the opening technique once per visit, not on every
    // refresh — see loadData.
    const intentAppliedRef = useRef(false);

    const loadData = useCallback(async (userEmail) => {
        if (!userEmail) return;

        setIsLoading(true);
        try {
            const today = dayKey(new Date());
            const [profileData, sessionsData, subjectsData, studySessionsData, flashcardData, assessmentData] = await Promise.all([
                UserProfile.filter({ created_by: userEmail }).then(data => data[0] || null),
                StudyTechnique.filter({ created_by: userEmail }, "-created_date", TECHNIQUE_READ_LIMIT),
                UserSubject.filter({ created_by: userEmail, is_active: true }),
                base44.entities.StudySession.filter({ created_by: userEmail }, "-date", 50).catch(() => []),
                base44.entities.Flashcard.filter({ created_by: userEmail, is_active: true }, "next_review_date").then(deckCards).catch(() => []),
                base44.entities.SubjectAssessment.filter({ created_by: userEmail, is_completed: false }, "due_date", 10).catch(() => []),
            ]);
            setUserProfile(profileData);
            // What they said this morning picks the technique — but only on the
            // first load. loadData also runs after every saved session and on
            // entity subscriptions, and it was re-applying the intent each
            // time: finishing a pomodoro yanked you to Active Recall mid-reset,
            // and any background refresh flashed the page across to it. Steer
            // once, then leave the student wherever they've navigated to.
            if (!intentAppliedRef.current) {
                intentAppliedRef.current = true;
                // Read the URL rather than state — loadData's closure would
                // still hold the pre-effect value on the first run.
                const deepLink = new URLSearchParams(window.location.search).get("tab");
                // A running pomodoro outranks the intent. Reloading mid-session
                // used to drop you on Active Recall with the timer still
                // counting somewhere behind you.
                const intent = todaysIntent(profileData);
                if (timerIsLive()) setActiveTab("pomodoro");
                else if (intent && !deepLink) setActiveTab(intent.plan.technique);
            }
            setRecentSessions(sessionsData || []);
            setUserSubjects(subjectsData || []);
            setStudySessions(studySessionsData || []);
            // Genuinely due, which is not the same as "has a date in the past".
            // A card nobody has opened yet is new material; see lib/due.js.
            setFlashcards((flashcardData || []).filter(c => isReady(c, today)));
            setDeckCardCount((flashcardData || []).length);
            setAssessments(assessmentData || []);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);
                setAuthError(false);
                loadData(currentUser.email);
            } catch (error) {
                console.error("Authentication error:", error);
                setAuthError(true);
                setIsLoading(false);
            }
        };
        init();
    }, [loadData]);

    /**
     * ─── TWO DEAD BROADCASTS LIVED HERE ─────────────────────────────────────
     * `startFlashcardReview` → `triggerDeckReview` was a relay with nothing
     * on the far end: this page heard the first, switched tab, waited 300ms
     * and fired the second, and no component in the tree ever listened for
     * it. Its one caller (the dashboard's deck reminders) links with
     * `?tab=spaced_repetition&subject=` now, which `SpacedRepetition` has
     * read the whole time.
     *
     * `studyTechniqueChanged` fired on EVERY tab change and had no listener
     * either — "collect nothing you don't use", pointed at a broadcast.
     * `reachable.test.mjs` scans for both shapes now, because an event
     * nobody hears throws nothing and costs nothing to keep writing.
     */

    // Real-time updates
    useEffect(() => {
        if (!user?.email) return;

        const unsubscribeTechnique = StudyTechnique.subscribe((event) => {
            if (event.data?.created_by === user.email) {
                setRecentSessions(prev => {
                    if (event.type === 'create') return [event.data, ...prev].slice(0, 50);
                    if (event.type === 'update') return prev.map(s => s.id === event.id ? event.data : s);
                    if (event.type === 'delete') return prev.filter(s => s.id !== event.id);
                    return prev;
                });
            }
        });

        const unsubscribeSubjects = UserSubject.subscribe((event) => {
            if (event.data?.created_by === user.email) {
                setUserSubjects(prev => {
                    if (event.type === 'create') return [...prev, event.data];
                    if (event.type === 'update') return prev.map(s => s.id === event.id ? event.data : s);
                    if (event.type === 'delete') return prev.filter(s => s.id !== event.id);
                    return prev;
                });
            }
        });

        return () => {
            unsubscribeTechnique();
            unsubscribeSubjects();
        };
    }, [user]);

    const handleSessionComplete = async (sessionData) => {
        if (!user) return;
        try {
            await StudyTechnique.create({ ...sessionData });
            loadData(user.email);

            // Award XP by the minute studied. The rate per source lives on the
            // server (calcStudySessionXP and friends); a one-minute floor here
            // so a genuine minute isn't silently dropped.
            const mins = sessionData.session_duration || 0;
            if (mins >= 1) {
                const technique = sessionData.technique_name; // pomodoro, active_recall, blurting
                // EVERY TECHNIQUE THAT LOGS A SESSION NEEDS A SOURCE HERE, and
                // the server must accept it — an unknown one is a 400 that the
                // catch below swallows, so the student simply earns nothing and
                // nothing anywhere reports a problem. `xpRates.test.mjs` pins
                // this map against the server's own switch for that reason.
                //
                // `mind_map` is its own source rather than falling through to
                // `study_session`, because `techniqueFamily` keys the ATAR's
                // BREADTH component on it: folded into focus time it would pay
                // the minutes and still be unreachable as a family.
                const sourceMap = {
                    pomodoro: 'study_session',
                    active_recall: 'active_recall',
                    blurting: 'blurting',
                    mind_map: 'mind_map',
                };
                const source = sourceMap[technique] || 'study_session';
                const eventKey = `${source}_${user.email}_${Date.now()}`;
                const res = await base44.functions.invoke('awardXP', {
                    source,
                    event_key: eventKey,
                    duration_minutes: mins,
                    // The server has accepted these since it was ported and no
                    // client had ever sent one, so an hour with the tab hidden
                    // paid what an hour of work paid. They DISCOUNT the time,
                    // never accuse the student — see calcFocusTimerXP.
                    idle_ratio: sessionData.extra?.idle_ratio ?? 0,
                    tab_away_count: sessionData.extra?.tab_away_count ?? 0,
                });
                fireXPFeedback(res?.data ?? res, source);
            }
        } catch (error) {
            console.error("Error saving session:", error);
        }
    };

    const techniqueComponents = {
        pomodoro: (
            <PomodoroTimer
                onSessionComplete={handleSessionComplete}
                userSubjects={userSubjects}
            />
        ),
        spaced_repetition: (
            <SpacedRepetition
                userSubjects={userSubjects}
            />
        ),
        active_recall: (
            <ActiveRecall
                onSessionComplete={handleSessionComplete}
                userSubjects={userSubjects}
                historyOpen={historyFor === "active_recall"}
                onHistoryChange={(open) => setHistoryFor(open ? "active_recall" : null)}
            />
        ),
        blurting: (
            <BlurtingMethod
                onSessionComplete={handleSessionComplete}
                userSubjects={userSubjects}
                historyOpen={historyFor === "blurting"}
                onHistoryChange={(open) => setHistoryFor(open ? "blurting" : null)}
            />
        ),
        exam: (
            <ExamMode
                userSubjects={userSubjects}
            />
        ),
        mind_map: (
            <MindMaps
                user={user}
                subjects={userSubjects}
                onSessionComplete={handleSessionComplete}
            />
        )
    };

    const currentTechnique = TECHNIQUES.find(t => t.id === activeTab) || TECHNIQUES[0];

    // ─── What the page says before the tool ────────────────────────────────────
    // All of it is `studyPage.js`, so it can be checked without a login: the
    // minutes read BOTH tables through `studyEvents`, and every day is a LOCAL
    // calendar day. The old inline sums parsed `date` as UTC midnight and the
    // deadline floored 24-hour spans, so at 3pm a SAC due tomorrow was "today".
    const now = new Date();
    const minutes = useMemo(
        () => minutesSummary(studySessions, recentSessions),
        [studySessions, recentSessions],
    );
    const deadline = useMemo(() => nextDeadline(assessments), [assessments]);
    const facts = useMemo(() => (isLoading ? LOADING_FACTS : techniqueFacts({
        techniques: recentSessions,
        ready: flashcards.length,
        deckCards: deckCardCount,
        deadline,
        // A full read may have stopped before a technique's last session, so
        // "Not tried yet" cannot be said off it.
        truncated: recentSessions.length >= TECHNIQUE_READ_LIMIT,
    })), [isLoading, recentSessions, flashcards.length, deckCardCount, deadline]);

    // ─── The one next step ─────────────────────────────────────────────────────
    // The duel coach line that used to lead here is gone with the duels: they
    // cannot be started from the app any more (Compete is one market now), and
    // it spoke a betting vocabulary — "defend your ante", "the pot" — the floor
    // has since dropped for forecasting. Nothing else here read `useStakes`.
    const intent = todaysIntent(userProfile);
    const step = isLoading ? null : nextStep({
        todayMins: minutes.today,
        ready: flashcards.length,
        deadline,
        intent,
        timerLive: timerIsLive(),
        dominant: dominantTechnique(recentSessions),
    });
    const figure = stepFigure(step, { ready: flashcards.length, deadline, todayMins: minutes.today });
    const ring = isLoading ? null : todayRing({ intent, todayMins: minutes.today });
    // A finished day has no technique to point at, so it wears the brand.
    const stepTechnique = TECHNIQUES.find(t => t.id === step?.tab) || TECHNIQUES[0];

    const streakDays = userProfile?.streak_days || 0;
    const firstName = userProfile?.username || user?.full_name?.split(' ')[0] || 'friend';
    const greeting = greetingFor(now.getHours());

    // THE BUTTON OPENS THE TECHNIQUE AND TAKES THEM TO IT. On a phone the tool
    // starts below the strip, so switching the tab alone would change
    // something off screen and look like the button did nothing.
    const toolRef = useRef(null);
    const openTechnique = useCallback((id) => {
        if (id) setActiveTab(id);
        requestAnimationFrame(() => {
            toolRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }, []);

    if (authError) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <div className="card-soft p-8 max-w-md w-full text-center">
                    <div className="w-14 h-14 rounded-2xl bg-streak/10 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-7 h-7 text-streak" />
                    </div>
                    <h2 className="font-display font-extrabold text-foreground text-xl mb-2">Connection issue</h2>
                    <p className="text-muted-foreground text-sm mb-6">
                        Unable to connect. Please check your internet and try again.
                    </p>
                    <Button onClick={() => window.location.reload()} className="w-full">
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    if (userSubjects.length === 0 && !isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6">
                    <motion.header
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        className="flex items-start justify-between gap-3"
                    >
                        <h1 className="font-display text-[1.65rem] sm:text-3xl lg:text-[2.5rem] font-extrabold tracking-tight leading-[1.1] text-foreground">
                            <span className="text-muted-foreground">{greeting}, {firstName}.</span> Pick your subjects first.
                        </h1>
                        <HelpButton page="Study" />
                    </motion.header>

                    <div className="card-soft p-8 max-w-2xl text-center">
                        <div className="w-14 h-14 rounded-2xl bg-chart-3/10 flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="w-7 h-7 text-chart-3" />
                        </div>
                        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                            Every technique here works from your subjects: the flashcards, the recall questions and the
                            timed mocks are all built from them.
                        </p>
                        <Button onClick={() => window.location.href = '/Subjects'}>
                            Go to subjects
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-6 lg:pt-10 pb-16">

                {/* ── TODAY: the one next step ────────────────────────────
                    It used to be "Six techniques to make studying actually
                    work" over a "Selected technique" card and a "Today" card,
                    and then a 40px heading with its button floating off at the
                    far edge. It is ONE card now (NextStepCard): the figure the
                    sentence turns on, the sentence, and the door to it — with
                    today's minutes as a ring only when there is a target the
                    student set themselves. */}
                <header className="pb-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            <span>{format(now, "EEE d MMM")}</span>
                            {streakDays > 0 && (
                                <>
                                    <span className="text-muted-foreground/40" aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1 text-streak">
                                        <Flame className="w-3.5 h-3.5" aria-hidden="true" /> {streakDays}-day streak
                                    </span>
                                </>
                            )}
                            {/* Today's minutes live in the ring when there is
                                one; printing them here as well is one number
                                twice, four inches apart. */}
                            {minutes.today > 0 && !ring && (
                                <>
                                    <span className="text-muted-foreground/40" aria-hidden="true">·</span>
                                    <span className="text-foreground tabular-nums">{fmtMinutes(minutes.today)} today</span>
                                </>
                            )}
                            {/* The week only when it says something today does not. */}
                            {minutes.week > minutes.today && (
                                <>
                                    <span className="text-muted-foreground/40" aria-hidden="true">·</span>
                                    <span className="tabular-nums">{fmtMinutes(minutes.week)} this week</span>
                                </>
                            )}
                        </p>
                        <HelpButton page="Study" />
                    </div>

                    <NextStepCard
                        greeting={`${greeting}, ${firstName}`}
                        step={step}
                        figure={figure}
                        technique={stepTechnique}
                        ring={ring}
                        onGo={() => openTechnique(step?.tab)}
                    />
                </header>

                {/* ── THE SWITCHER ─────────────────────────────────────── */}
                <TechniqueTabs
                    techniques={TECHNIQUES}
                    value={activeTab}
                    onChange={setActiveTab}
                    facts={facts}
                    suggested={step?.tab || null}
                />

                {/* ── THE TOOL, under ONE header ───────────────────────────
                    Each technique used to print its own title card as well —
                    "Pomodoro Timer / Focus and productivity timer" — so the
                    name appeared three times before anything could be pressed.
                    This is the one place it is named, with what it is for.
                    `scroll-mt` clears the top bar and the sticky strip, so the
                    heading's button lands the header in view rather than
                    under them. */}
                <section ref={toolRef} className="scroll-mt-[7.5rem] pt-6 lg:pt-8" aria-labelledby="study-technique">
                    <div className="mb-5 lg:mb-6 flex items-start justify-between gap-4">
                        <div className="min-w-0 max-w-3xl">
                            <h2 id="study-technique" className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                                {currentTechnique.name}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground leading-snug">{currentTechnique.blurb}</p>
                        </div>
                        {/* HISTORY BESIDE THE NAME, on every tool that keeps
                            one. It was a quiet link under ~1,000px of setup,
                            opening a panel further down still. */}
                        {currentTechnique.history && (
                            <Button
                                variant="outline"
                                onClick={() => setHistoryFor(currentTechnique.id)}
                                className="flex-shrink-0 h-9 px-3 rounded-xl border-2 gap-1.5 text-sm font-bold"
                            >
                                <FolderOpen className="w-4 h-4" aria-hidden="true" />
                                <span>History</span>
                            </Button>
                        )}
                    </div>
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="min-w-0"
                    >
                        {techniqueComponents[activeTab]}
                    </motion.div>
                </section>

                {/* ── THE SCIENCE, after the work ──────────────────────────
                    It was a 380px rail beside the tool on every technique. The
                    tool takes the page now and this is a named fold after it,
                    shut unless the student has opened it before. */}
                <div className="mt-10 lg:mt-14">
                    <NeuroPanel
                        techniqueId={activeTab}
                        techniqueName={currentTechnique.name}
                        open={scienceOpen}
                        onToggle={toggleScience}
                    />
                </div>
            </div>
        </div>
    );
}
