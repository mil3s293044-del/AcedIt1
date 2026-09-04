import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Target, ArrowRight,
    GraduationCap, Zap, Brain, FileQuestion,
    Sparkles, Trophy, Play, Layers, Timer,
    Map, BarChart3, CheckCircle2, AlertTriangle, Shield, Sprout
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, differenceInDays, parseISO, isToday, isYesterday } from "date-fns";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import HelpButton from "@/components/shared/HelpButton";
import { reconcileUserXP } from "@/lib/reconcileXP";
import { getStreakMultiplier as getStreakMultiplierValue } from "@/components/shared/streakHelpers";
import RetentionCard from "@/components/dashboard/RetentionCard";
import DueRadar from "@/components/dashboard/DueRadar";
import WeekPace from "@/components/dashboard/WeekPace";
import TableGround from "@/components/dashboard/TableGround";
import TodaysPlay from "@/components/dashboard/TodaysPlay";
import { buildCase, previewFor } from "@/lib/todaysCase";
import HandRail from "@/components/dashboard/HandRail";
import RunOfSeven from "@/components/dashboard/RunOfSeven";
import Placed from "@/components/dashboard/Placed";
import { bestLever } from "@/lib/atarLift";
import { atarBandOf } from "@/lib/atarBands";
import { todaysIntent } from "@/lib/studyIntent";
import { needsSetup, outstandingTasks, setupCopy } from "@/lib/onboardingTasks";
import { isDue } from "@/lib/due";
import { studyEvents } from "@/lib/studyLog";
import { deckCards } from "@/lib/mistakeBank";
import AceTip from "@/components/ace/AceTip";
import AceShuffle from "@/components/ace/AceShuffle";
import AceBody from "@/components/ace/AceBody";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (m) => {
    if (!m) return "0m";
    const h = Math.floor(m / 60);
    const mm = Math.round(m % 60);
    if (h === 0) return `${mm}m`;
    if (mm === 0) return `${h}h`;
    return `${h}h ${mm}m`;
};

const fmtXP = (n) => (n || 0).toLocaleString();

// Mirrors the real ladder in streakHelpers/server — what's shown is exactly
// what awardXP applies (capped at 2.0×).
function getStreakMultiplier(days) {
    return `${getStreakMultiplierValue(days)}×`;
}

function getNextStreakMilestone(days) {
    const tiers = [
        { at: 3,   mult: "1.1×" },
        { at: 7,   mult: "1.25×" },
        { at: 14,  mult: "1.5×" },
        { at: 30,  mult: "2.0×" },
    ];
    for (const t of tiers) if (days < t.at) return { ...t, away: t.at - days };
    return null;
}

// Which lever actually lifts the ATAR right now. Naming one beats a generic
// "study more" — the whole point of breaking the score into parts is that each
// part has a different fix.
//
// This used to pick the LOWEST raw component, which is the wrong answer and
// disagreed with the Distance-to-target strip further down the same page.
// Mastery carries 0.28 of the composite and planning 0.10, so a planning score
// of 22 has less ATAR sitting on it than a mastery score of 48. bestLever
// weighs headroom by weight and is the number the strip prices, so both say
// the same thing.
const ATAR_LEVERS = {
    mastery:     "Mastery has the most left on it, and a quiz or a flashcard round does the most for it.",
    consistency: "Consistency has the most left on it, and showing up again tomorrow counts for more than a long session today.",
    effort:      "Effort has the most left on it, and one longer sitting lifts it faster than several short ones.",
    breadth:     "Breadth has the most left on it, and a technique you have not touched this month is the quickest lift.",
    planning:    "Planning has the most left on it, and setting a goal or blocking out tomorrow is the quickest lift.",
};

function weakestComponent(components) {
    return bestLever(components)?.key || null;
}

// Coach voice — chill, supportive, motivational. Specific not generic.
// Returns a headline plus one supporting line: where you stand, then the single
// thing worth doing about it today.
function getCoachLine({
    name, hour, streakDays, todayMins, studiedYesterday,
    urgentDays, urgentTitle, atar, band, components, goalAtar, intentBlurb,
}) {
    const period = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Late night";

    // ── Headline: the most pressing true thing right now ────────────────────
    let line;
    if (urgentDays !== null && urgentDays === 0) {
        line = urgentTitle
            ? `${period}, ${name}. ${urgentTitle} is due today. Let's get on it.`
            : `${period}, ${name}. You've got something due today. Let's get on it.`;
    } else if (urgentDays !== null && urgentDays <= 3 && todayMins === 0) {
        line = urgentTitle
            ? `${period}, ${name}. ${urgentTitle} lands in ${urgentDays} day${urgentDays === 1 ? "" : "s"}.`
            : `${period}, ${name}. Something lands in ${urgentDays} day${urgentDays === 1 ? "" : "s"}.`;
    } else if (intentBlurb && todayMins > 0) {
        // They declared something this morning and then did it — close the loop
        // while it's still today, because that is the whole habit.
        line = atar != null
            ? `${period}, ${name}. ${fmtTime(todayMins)} in on what you said you'd do, ${atar.toFixed(2)} on the board.`
            : `${period}, ${name}. ${fmtTime(todayMins)} in on what you said you'd do.`;
    } else if (atar != null && band) {
        // The ATAR is the flagship number — lead with it once it exists.
        if (todayMins >= 90) line = `${period}, ${name}. ${fmtTime(todayMins)} in and sitting at ${atar.toFixed(2)}. Big day.`;
        else if (todayMins > 0) line = `${period}, ${name}. ${fmtTime(todayMins)} down, ${atar.toFixed(2)} on the board.`;
        else line = `${period}, ${name}. You're at ${atar.toFixed(2)}, ${band}.`;
    } else if (streakDays >= 30 && todayMins > 0) {
        line = `${period}, ${name}. ${streakDays} days deep and still showing up. Keep cooking.`;
    } else if (streakDays >= 30) {
        line = `${period}, ${name}. ${streakDays} days deep. You're built different now.`;
    } else if (streakDays >= 7 && todayMins === 0 && hour >= 17) {
        line = `${period}, ${name}. A quick session keeps your ${streakDays}-day streak going.`;
    } else if (streakDays === 0 && todayMins === 0 && !studiedYesterday) {
        line = `${period}, ${name}. Today's a great day to start a streak.`;
    } else if (todayMins >= 90) {
        line = `${period}, ${name}. ${fmtTime(todayMins)} in already. Big day shaping up.`;
    } else if (todayMins >= 30) {
        line = `${period}, ${name}. ${fmtTime(todayMins)} down. Want to stack another?`;
    } else if (todayMins > 0) {
        line = `${period}, ${name}. Nice start. Keep building.`;
    } else {
        line = `${period}, ${name}. Let's make today count.`;
    }

    // ── Support: where you stand, NOT what to do ────────────────────────────
    // The Today's move card owns the instruction — it has a CTA button, which a
    // headline can't. Anything actionable said here is said twice on one screen,
    // so this sticks to what the Move card never shows: your score, the gap to
    // your goal, and which of the five components is holding it back.
    let sub;
    const lever = weakestComponent(components);

    if (atar == null) {
        sub = "Three study days puts you on the board and unlocks your AcedIt ATAR.";
    } else if (goalAtar && atar >= goalAtar) {
        sub = `You're past your ${goalAtar} goal. Hold it there and it stops being a fluke.`;
    } else if (goalAtar) {
        // Just the gap. When a goal is set, the Distance-to-target strip is on
        // the page and says the lever properly — with what it's worth in ATAR
        // points, which this line can't. Saying it here too put the same
        // sentence on screen twice.
        sub = `${(goalAtar - atar).toFixed(2)} off your ${goalAtar} goal.`;
    } else if (lever) {
        sub = ATAR_LEVERS[lever];
    }

    return { line, sub };
}

function getStreakBlurb(streakDays) {
    if (streakDays === 0) return null;
    if (streakDays === 1) return "First day down. The next one is the test.";
    if (streakDays < 7)   return `${streakDays} days strong. Almost at your XP boost.`;
    if (streakDays < 14)  return `${streakDays} days in. You're past the dabblers.`;
    if (streakDays < 30)  return `${streakDays}-day streak. Top 5% of users this month.`;
    if (streakDays < 100) return `${streakDays} days deep. This is who you are now.`;
    return `${streakDays} days. Different breed.`;
}

// Intent modes map onto the move the student already committed to. Without
// this the modal asks what today is for, then the card behind it ignores the
// answer and offers a generic Pomodoro — two instructions, one click apart.
const INTENT_MOVES = {
    homework: {
        label: "Homework mode",
        title: "You said homework today",
        sub: "List the tasks first, then run the clock on them one at a time.",
        cta: "Start the timer", link: "Study", accent: "chart-3", icon: Timer,
        technique: "pomodoro", component: "effort",
    },
    cramming: {
        label: "Cram mode",
        title: "You said cramming today",
        sub: "Cover ground fast, and quiz yourself as you go so it actually sticks.",
        cta: "Start a session", link: "Study", accent: "xp", icon: Zap,
        technique: "active_recall", component: "mastery",
    },
    free: {
        label: "Free study",
        title: "You said free study today",
        sub: "No deadline pressure, so it is a good day to shore up a weak spot.",
        cta: "Pick a technique", link: "Study", accent: "primary", icon: Sprout,
        technique: "spaced_repetition", component: "breadth",
    },
};

// What the student told onboarding they struggle with. It picked which features
// the tour displayed and was then never read again — so a student who said
// burnout and one who said they forget everything got the same nudge every
// morning. Used only as the quiet-day fallback: anything they've declared or
// that's actually due still outranks it.
const CHALLENGE_MOVES = {
    forget: {
        label: "Your sticking point",
        title: "Retrieval beats re-reading, every time",
        sub: "You said it slips away after studying, and pulling it back out from memory is what makes it stay.",
        cta: "Start active recall", link: "Study", accent: "chart-4", icon: Brain,
        technique: "active_recall", component: "mastery",
    },
    time: {
        label: "Your sticking point",
        title: "Map the week before it gets away",
        sub: "You said there's never enough runway before a SAC, and blocking it out now buys some back.",
        cta: "Open the planner", link: "Goals", accent: "xp", icon: Map,
        component: "planning",
    },
    weak: {
        label: "Your sticking point",
        title: "Find out what you're actually shaky on",
        sub: "You said it's hard to tell, and your analytics already know which topics keep costing you marks.",
        cta: "See weak topics", link: "Analytics", accent: "chart-3", icon: BarChart3,
        component: "mastery",
    },
    motivated: {
        label: "Your sticking point",
        title: "A short session still counts on the board",
        sub: "You said staying motivated is the hard part, and 25 minutes is enough to keep the streak and the score going.",
        cta: "Start a Pomodoro", link: "Study", accent: "primary", icon: Timer,
        technique: "pomodoro", component: "consistency",
    },
    writing: {
        label: "Your sticking point",
        title: "Get a response marked properly",
        sub: "You said writing strong answers is the gap, and the English mentor marks to VCAA criteria and shows you the upgrade.",
        cta: "Open AI Tools", link: "AITools", accent: "chart-4", icon: Sparkles,
        component: "mastery",
    },
    burnout: {
        label: "Your sticking point",
        title: "One focused block, then genuinely stop",
        sub: "You said the pressure is getting heavy, and a short bounded session beats an open-ended one.",
        cta: "Start 25 minutes", link: "Study", accent: "primary", icon: Timer,
        technique: "pomodoro", component: "consistency",
    },
};

// Students can pick more than one. Rotate by day so the same card isn't the
// only thing they ever see, and deterministically so it doesn't flicker on
// re-render.
function challengeMove(challenge) {
    const list = (Array.isArray(challenge) ? challenge : [challenge])
        .filter((c) => CHALLENGE_MOVES[c]);
    if (!list.length) return null;
    return CHALLENGE_MOVES[list[new Date().getDate() % list.length]];
}

/** Minutes as a `why` row reads them — short, and never "0m". */
const fmtWhy = (mins) => (mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}` : `${mins}m`);

function getTodaysMove({ todayMins, streakDays, dueFlashcards, totalCards, urgentDays, urgentTitle, hour, intentMode, challenge }) {
    // What they told us this morning outranks anything we'd infer — until they
    // actually start, at which point the usual signals take over again.
    if (intentMode && todayMins === 0 && INTENT_MOVES[intentMode]) {
        return INTENT_MOVES[intentMode];
    }
    if (urgentDays !== null && urgentDays <= 3) {
        return {
            label: urgentDays === 0 ? "Today's deadline" : `In ${urgentDays} day${urgentDays === 1 ? '' : 's'}`,
            title: urgentTitle ? `${urgentTitle} is coming up` : "You've got a deadline incoming",
            sub: "Open the planner and get the week mapped out.",
            cta: "Open planner",
            link: "Goals",
            accent: "streak",
            // The Ace, explicitly. It shares the streak accent but a deadline
            // is not a streak — it is the one card nothing else beats.
            card: { rank: "A", suit: "spade", tone: "#0D1626" },
            icon: AlertTriangle,
            component: "planning",
            why: urgentDays === 0
                ? { value: "Today", label: "is the deadline" }
                : { value: urgentDays, label: `day${urgentDays === 1 ? "" : "s"} until it lands` },
        };
    }
    if (dueFlashcards >= 10) {
        return {
            label: "Cards waiting",
            title: `${dueFlashcards} flashcards ready for review`,
            sub: "Quick session and you're back on track with spaced rep.",
            cta: "Review now",
            link: "Study",
            accent: "chart-3",
            icon: Layers,
            technique: "spaced_repetition",
            component: "mastery",
            why: { value: dueFlashcards, label: "cards at or past their review date" },
        };
    }
    if (streakDays > 0 && todayMins === 0 && hour >= 18) {
        return {
            label: "Streak protection",
            title: `Quick session keeps your ${streakDays}-day streak alive`,
            sub: `${24 - hour} hours left, and a Pomodoro is all it takes.`,
            cta: "Start a Pomodoro",
            link: "Study",
            accent: "streak",
            icon: Timer,
            technique: "pomodoro",
            component: "consistency",
            why: { value: `${streakDays}d`, label: "streak on the line tonight" },
        };
    }
    // A pile under ten still outranks a generic nudge. The branch above needs
    // ten to beat a streak on the line tonight; this one only has to beat
    // "here is a Pomodoro", and cards that are genuinely due are always the
    // more concrete thing to do. Ignoring four due cards and suggesting a timer
    // is the app failing to read its own screen.
    if (dueFlashcards > 0) {
        return {
            label: "Cards waiting",
            title: `${dueFlashcards} flashcard${dueFlashcards === 1 ? "" : "s"} ready for review`,
            sub: "Short session, and the deck is clear again.",
            cta: "Review now",
            link: "Study",
            accent: "chart-3",
            icon: Layers,
            technique: "spaced_repetition",
            component: "mastery",
            why: { value: dueFlashcards, label: `card${dueFlashcards === 1 ? "" : "s"} at or past their review date` },
        };
    }

    // THE DECK IS CLEAR, and saying so is the point. A student who has just
    // worked through the pile — or cleared it on /Review by marking cards known
    // — came back to a dashboard that behaved as though nothing had happened.
    // An app that never acknowledges finishing is one you stop finishing things
    // in. Only claimed when they HAVE cards: "all caught up" to somebody with
    // an empty deck is congratulating them on owning nothing.
    if (totalCards > 0 && todayMins === 0) {
        return {
            label: "All caught up",
            title: "Your deck is clear — nothing due today",
            sub: "Nothing is asking for you. A short session now is pure ground gained.",
            cta: "Start a Pomodoro",
            link: "Study",
            accent: "primary",
            icon: Timer,
            technique: "pomodoro",
            component: "consistency",
            why: { value: totalCards, label: "cards on schedule, none overdue" },
        };
    }

    if (todayMins === 0) {
        // Nothing declared, nothing due — this is where their stated struggle
        // is the most useful thing we know about them.
        return challengeMove(challenge) || {
            label: "Easiest start",
            title: "A 25-minute Pomodoro is the easiest win today",
            sub: "Show up, stay focused, walk away with momentum.",
            cta: "Start a Pomodoro",
            link: "Study",
            accent: "primary",
            icon: Timer,
            technique: "pomodoro",
            component: "consistency",
        };
    }
    if (todayMins < 60) {
        return {
            label: "Lock it in",
            title: "Good start. Let's test what you remember",
            sub: "Active recall locks in what passive reading misses.",
            cta: "Take a quiz",
            link: "Quizzes",
            accent: "xp",
            icon: Brain,
            technique: "active_recall",
            component: "mastery",
            why: { value: fmtWhy(todayMins), label: "in so far — testing is what banks it" },
        };
    }
    return {
        label: "Stack the win",
        title: "You've got momentum. Let's make it count",
        sub: "Generate exam questions or hit your weak topics.",
        cta: "Open AI tools",
        link: "AITools",
        accent: "chart-4",
        icon: Sparkles,
        technique: "exam",
        component: "breadth",
        why: { value: fmtWhy(todayMins), label: "logged today already" },
    };
}

// Direction A — softer tints, lighter borders, shadow for depth.
/**
 * The move, as a playing card.
 *
 * THE RANK IS NOT DECORATION. It is how urgent the move is, on the scale every
 * card player already knows:
 *
 *   A♠  a deadline you cannot beat.
 *   K♥  your streak is on the line tonight.
 *   Q♦  the pile is asking for you.
 *   J♣  you have not started — the easiest opening.
 *   10♦ you are going; now test what stuck.
 *   9♠  you are well past the day's minimum, here is the bonus.
 *
 * Keyed on the accent each move already carries, so nothing has to be kept in
 * sync by hand; the deadline move overrides it to the Ace explicitly, because
 * it shares the streak accent and is not the same thing at all.
 *
 * The rank on its own could never justify the space — it says "this is
 * urgent", which the headline beside it already says. What pays for it is the
 * FACE, which turns over to the first real question, assessment or block the
 * student is about to meet. See MovePreview.
 */
const MOVE_CARD = {
    streak:    { rank: "K",  suit: "heart",   tone: "#FF4B4B" },
    "chart-3": { rank: "Q",  suit: "diamond", tone: "#3B82F6" },
    primary:   { rank: "J",  suit: "club",    tone: "#58CC02" },
    xp:        { rank: "10", suit: "diamond", tone: "#F59E0B" },
    "chart-4": { rank: "9",  suit: "spade",   tone: "#8B5CF6" },
};

const MOVE_THEME = {
    primary:   { bg: "bg-primary/5",   border: "border-primary/15",   iconBg: "bg-primary/10",   iconText: "text-primary",   bar: "bg-primary"   },
    streak:    { bg: "bg-streak/5",    border: "border-streak/15",    iconBg: "bg-streak/10",    iconText: "text-streak",    bar: "bg-streak"    },
    xp:        { bg: "bg-xp/5",        border: "border-xp/15",        iconBg: "bg-xp/10",        iconText: "text-xp",        bar: "bg-xp"        },
    "chart-3": { bg: "bg-chart-3/5",   border: "border-chart-3/15",   iconBg: "bg-chart-3/10",   iconText: "text-chart-3",   bar: "bg-chart-3"   },
    "chart-4": { bg: "bg-chart-4/5",   border: "border-chart-4/15",   iconBg: "bg-chart-4/10",   iconText: "text-chart-4",   bar: "bg-chart-4"   },
};

// The badge text is foreground, not the accent colour. Measured on the tinted
// rows these sat at 2.43:1 in light mode — invisible. Urgency still reads from
// the row tint and the icon, which are graphics and only owe 3:1.
// URGENCY and urgencyKey coloured the reminder rows by how close a thing was.
// The dial says that with distance now, so the palette had nothing left to do.


// ─── Component ────────────────────────────────────────────────────────────────
export default function Dashboard() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [studySessions, setStudySessions] = useState([]);
    const [studyTechniques, setStudyTechniques] = useState([]);
    const [quizAttempts, setQuizAttempts] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [flashcardReminders, setFlashcardReminders] = useState([]);
    const [flashcards, setFlashcards] = useState([]);
    const [plannerReminders, setPlannerReminders] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = useCallback(async (userEmail) => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const in14 = format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
            const [profileData, sessionsData, techniquesData, quizData, assessmentData, flashcardData, plannerData, lbData] = await Promise.all([
                base44.entities.UserProfile.filter({ created_by: userEmail }).catch(() => []),
                // 400, not 30. WeekPace compares this week against the same weekday
                // in up to eight prior weeks, and a thirty-row window is about
                // a fortnight for anybody active — which silently gave the
                // heaviest users the shortest history.
                base44.entities.StudySession.filter({ created_by: userEmail }, "-date", 400).catch(() => []),
                base44.entities.StudyTechnique.filter({ created_by: userEmail }, "-date").catch(() => []),
                base44.entities.QuizAttempt.filter({ created_by: userEmail }, "-date", 10).catch(() => []),
                base44.entities.SubjectAssessment.filter({ created_by: userEmail, is_completed: false }, "due_date", 10).catch(() => []),
                base44.entities.Flashcard.filter({ created_by: userEmail, is_active: true }, "next_review_date").catch(() => []),
                base44.entities.StudyPlan.filter({ created_by: userEmail, is_completed: false, date: { $gte: today, $lte: in14 } }, "date", 8).catch(() => []),
                base44.entities.Leaderboard.list('-total_xp', 200).catch(() => []),
            ]);

            let profile = profileData[0] || null;
            if (!profile) {
                profile = await base44.entities.UserProfile.create({
                    onboarding_tasks: { username_set: false, subjects_selected: false, goals_set: false },
                    onboarding_completed: false
                }).catch(() => null);
            }

            // Self-heal: if the leaderboard knows about more XP than the
            // profile (because the profile was wiped/corrupted), restore it.
            // XP is strictly additive — taking the max is always safe.
            if (profile) {
                const result = await reconcileUserXP({ email: userEmail }, profile).catch(() => null);
                if (result?.reconciled) {
                    profile = {
                        ...profile,
                        total_xp:  result.correctTotalXp,
                        season_xp: result.correctSeasonXp,
                    };
                }
            }

            setUserProfile(profile);
            // Today's XP used to be summed here for the daily goal ring, off a
            // hundred-row XPEvent query fired on every dashboard load. The ring
            // is gone and it was the only reader, so the query went with it —
            // one fewer round trip before this page can paint.
            setStudySessions(sessionsData || []);
            setStudyTechniques(techniquesData || []);
            setQuizAttempts(quizData || []);
            setLeaderboard((lbData || []).filter(e => (e.total_xp || 0) > 0));

            const upcoming = (assessmentData || []).filter(a => {
                const days = differenceInDays(parseISO(a.due_date), new Date());
                return days >= 0 && days <= 30;
            });
            setAssessments(upcoming);

            const urgentTypes = ['SAC', 'Exam', 'Test', 'Assignment', 'Oral', 'Folio', 'Performance'];
            const plannerEvents = (plannerData || [])
                .filter(e => urgentTypes.includes(e.event_type) || differenceInDays(parseISO(e.date), new Date()) <= 3)
                .slice(0, 5);
            setPlannerReminders(plannerEvents);

            // The raw cards, for the retention projection. Only a due-deck
            // summary was being kept, which threw away every SM-2 field the
            // forgetting curve is built from.
            // Minus the mistake bank: it is stored as flashcards and is not
            // one, so it must not reach due counts, retention, Today's Play or
            // the week's subject split. See deckCards.
            setFlashcards(deckCards(flashcardData));

            // GENUINELY due, not "has a date that has passed". A card is
            // created with next_review_date set to today, so this line used to
            // report a deck generated ten minutes ago as a full backlog, and
            // once a card went past its date it stayed counted forever. Both
            // are fixed in lib/due.js, along with the two states — marked known
            // and put off — that let a student answer back. See /Review.
            const dueCards = (flashcardData || []).filter(c => isDue(c, today));
            const deckMap = {};
            dueCards.forEach(card => {
                const key = card.deck_id || `${card.subject_name}_${card.topic}`;
                if (!deckMap[key]) deckMap[key] = { subject: card.subject_name, topic: card.topic, count: 0 };
                deckMap[key].count++;
            });
            // All of them, not the first three. They get folded together by
            // subject at render, and truncating here silently undercounted the
            // pile — "90 cards due" when the real number was 260.
            setFlashcardReminders(Object.values(deckMap));
        } catch (err) {
            console.error("Dashboard load error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                await loadData(currentUser.email);
            } catch {
                base44.auth.redirectToLogin(window.location.pathname);
            }
        };
        init();
    }, [loadData]);

    useEffect(() => {
        if (!user?.email) return;
        const unsub = base44.entities.StudySession.subscribe((event) => {
            if (event.data?.created_by !== user.email) return;
            setStudySessions(prev => {
                if (event.type === 'create') return [event.data, ...prev];
                if (event.type === 'update') return prev.map(s => s.id === event.id ? event.data : s);
                if (event.type === 'delete') return prev.filter(s => s.id !== event.id);
                return prev;
            });
        });
        return unsub;
    }, [user]);

    const todaysStudyTime = useMemo(() => {
        const sum = (arr, key) => arr
            .filter(s => s.date && isToday(new Date(s.date)))
            .reduce((a, s) => a + (s[key] || 0), 0);
        return sum(studySessions, 'duration_minutes') + sum(studyTechniques, 'session_duration');
    }, [studySessions, studyTechniques]);

    const studiedYesterday = useMemo(() => {
        return studySessions.some(s => s.date && isYesterday(new Date(s.date)))
            || studyTechniques.some(s => s.date && isYesterday(new Date(s.date)));
    }, [studySessions, studyTechniques]);

    const weeklyStudyTime = useMemo(() => {
        const weekStart = startOfWeek(new Date());
        const sum = (arr, key) => arr
            .filter(s => s.date && new Date(s.date) >= weekStart)
            .reduce((a, s) => a + (s[key] || 0), 0);
        return sum(studySessions, 'duration_minutes') + sum(studyTechniques, 'session_duration');
    }, [studySessions, studyTechniques]);

    const avgQuizScore = useMemo(() => {
        if (!quizAttempts.length) return null;
        const recent = quizAttempts.slice(0, 5);
        return Math.round(recent.reduce((a, q) => a + (q.score || 0), 0) / recent.length);
    }, [quizAttempts]);

    const dueFlashcardCount = useMemo(
        () => flashcardReminders.reduce((a, d) => a + d.count, 0),
        [flashcardReminders]
    );

    const nextDeadline = useMemo(() => {
        const all = [
            ...assessments.map(a => ({ days: differenceInDays(parseISO(a.due_date), new Date()), title: a.title })),
            ...plannerReminders.map(e => ({ days: differenceInDays(parseISO(e.date), new Date()), title: e.title })),
        ].filter(x => x.days >= 0).sort((a, b) => a.days - b.days);
        return all[0] || null;
    }, [assessments, plannerReminders]);

    // Rank computation: find position + 3 rivals above + 1 below for context
    const rankInfo = useMemo(() => {
        if (!leaderboard.length || !user) return null;
        const myIdx = leaderboard.findIndex(e => e.user_email === user.email);
        const myRank = myIdx >= 0 ? myIdx + 1 : null;
        const myEntry = myIdx >= 0 ? leaderboard[myIdx] : null;
        const myXP = myEntry?.total_xp || userProfile?.total_xp || 0;

        // Rivals above (closest 3)
        let rivals = [];
        if (myIdx > 0) {
            const start = Math.max(0, myIdx - 3);
            rivals = leaderboard.slice(start, myIdx).map((e, i) => ({
                ...e,
                rank: start + i + 1,
                gap: (e.total_xp || 0) - myXP,
            }));
        } else if (myIdx === -1 || myIdx >= 50) {
            // Not ranked or way down — show top 3 as aspirational
            rivals = leaderboard.slice(0, 3).map((e, i) => ({
                ...e,
                rank: i + 1,
                gap: (e.total_xp || 0) - myXP,
            }));
        }

        // One below for context
        const below = myIdx >= 0 && myIdx < leaderboard.length - 1
            ? { ...leaderboard[myIdx + 1], rank: myIdx + 2, gap: (leaderboard[myIdx + 1].total_xp || 0) - myXP }
            : null;

        return { myRank, myXP, myEntry, rivals, below, total: leaderboard.length };
    }, [leaderboard, user, userProfile]);

    const streakDays = userProfile?.streak_days || 0;
    const firstName = userProfile?.username || user?.full_name?.split(' ')[0] || 'friend';
    const goalHours = userProfile?.weekly_study_goal_hours || 20;
    const weeklyPct = Math.min(100, Math.round((weeklyStudyTime / (goalHours * 60)) * 100));

    // ── The radar, as one ranked list ────────────────────────────────────────
    // This used to render each source as its own run of tiles — up to eleven
    // of them in a three-wide grid, mixing SAC deadlines with planner tasks and
    // flashcard decks. Worse, decks were keyed per deck and titled by SUBJECT,
    // so three Chemistry decks came out as three identical-looking rows with
    // the topic (which was fetched, and sitting right there) never rendered.
    //
    // One list, sorted by how soon it actually bites, decks folded together by
    // subject, and everything past the top few behind a link.
    const radar = useMemo(() => {
        const now = new Date();
        const items = [];
        const daysTo = (iso) => {
            const d = differenceInDays(parseISO(iso), now);
            return Number.isFinite(d) ? d : null;
        };

        for (const a of assessments) {
            const days = daysTo(a.due_date);
            if (days == null) continue;
            items.push({ key: `as-${a.id}`, icon: Target, days, rank: 0,
                title: a.title, subtitle: a.subject_name, to: "Goals",
                // The radar draws bearing and colour from the subject, and blip
                // size from the pile. A deadline is one thing, so size 1.
                subject: a.subject_name || a.title, kind: "deadline", count: 1 });
        }
        for (const ev of plannerReminders) {
            const days = daysTo(ev.date);
            if (days == null) continue;
            items.push({ key: `pl-${ev.id}`, icon: FileQuestion, days, rank: 1,
                title: ev.title, subtitle: ev.event_type, to: "Goals",
                subject: ev.subject_name || ev.title, kind: "task", count: 1 });
        }

        // Decks: one row per subject, with the topics that make up the pile.
        // NOT a `new Map()` — this file imports `Map` from lucide-react as an
        // icon, so the global is shadowed and `new Map()` throws at render.
        const bySubject = Object.create(null);
        for (const deck of flashcardReminders) {
            const subject = deck.subject || "Flashcards";
            const prev = bySubject[subject] || (bySubject[subject] = { subject, count: 0, topics: [] });
            prev.count += deck.count || 0;
            if (deck.topic && !prev.topics.includes(deck.topic)) prev.topics.push(deck.topic);
        }
        for (const d of Object.values(bySubject)) {
            const detail = d.topics.length
                ? `${d.count} cards · ${d.topics.slice(0, 2).join(", ")}${d.topics.length > 2 ? ` +${d.topics.length - 2}` : ""}`
                : `${d.count} cards due`;
            items.push({ key: `fc-${d.subject}`, icon: Layers, days: 0, rank: 2,
                title: d.subject, subtitle: detail, to: "Study", badge: "Now",
                subject: d.subject, kind: "deck", count: d.count });
        }

        // Soonest first; a deadline outranks a task outranks a deck on the same day.
        items.sort((a, b) => (a.days - b.days) || (a.rank - b.rank));
        return items;
    }, [assessments, plannerReminders, flashcardReminders]);

    const hour = new Date().getHours();
    // ── Study intent ─────────────────────────────────────────────────────────
    // What the student said today is for. Kept on profile.extra alongside the
    // Planner's daily_intention (free text — a different thing, left alone) and
    // appended to a capped log so the ATAR's planning component can see whether
    // declared intents actually turn into sessions. Same shape as the trailing
    // mock_atar_history the server already keeps there.
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const todayIntentPlan = todaysIntent(userProfile);

    // The Planner's free-text intention for today. It was being written there
    // and then only ever displayed on the page that wrote it — which is the
    // one screen you're least likely to be on when you need reminding.
    const todayIntention = userProfile?.extra?.daily_intention?.date === todayKey
        ? userProfile.extra.daily_intention.text
        : null;

    // Wired to Ace: when he asks "what's the plan?" and you answer, that
    // answer arrives here. Same field the retired three-choice modal wrote, so
    // the coach line, today's move and the ATAR's planning component all carry
    // on without needing to know who asked the question.
    useEffect(() => {
        const onPlan = (e) => {
            const mode = e?.detail?.mode;
            if (mode) saveIntentRef.current?.({ mode, duration: null });
        };
        window.addEventListener("ace:plan", onPlan);
        return () => window.removeEventListener("ace:plan", onPlan);
    }, []);

    const saveIntent = useCallback(async ({ mode, duration }) => {
        if (!userProfile?.id) return;
        const extra = userProfile.extra || {};
        const log = Array.isArray(extra.intent_log) ? [...extra.intent_log] : [];
        // One entry per day — re-picking overwrites rather than stacking.
        const withoutToday = log.filter((e) => e.d !== todayKey);
        withoutToday.push({ d: todayKey, m: mode });
        const nextExtra = {
            ...extra,
            daily_intent: { date: todayKey, mode, duration },
            intent_log: withoutToday.slice(-30),
        };
        setUserProfile((prev) => ({ ...(prev || {}), extra: nextExtra }));
        try {
            await base44.entities.UserProfile.update(userProfile.id, { extra: nextExtra });
        } catch (e) {
            console.error("Failed to save study intent:", e);
        }
    }, [userProfile, todayKey]);
    // A ref so the listener above never captures a stale closure over the
    // profile — it mounts once and lives for the whole page.
    const saveIntentRef = useRef(saveIntent);
    useEffect(() => { saveIntentRef.current = saveIntent; }, [saveIntent]);

    // What today is most likely for, in order of how strong the evidence is:
    // a deadline beats a plan, a plan beats a habit, and a habit beats nothing.
    // Only a suggestion — the student still picks.
    const intentSuggestion = useMemo(() => {
        const days = nextDeadline?.days ?? null;
        if (days !== null && days <= 3) {
            const what = nextDeadline.title || "Something";
            return {
                mode: "cramming",
                reason: days === 0 ? `${what} is due today` : `${what} in ${days} day${days === 1 ? "" : "s"}`,
            };
        }
        const plannedCount = plannerReminders.filter(p => p.date === todayKey).length;
        if (plannedCount > 0) {
            return {
                mode: "homework",
                reason: `${plannedCount} session${plannedCount === 1 ? "" : "s"} blocked in today`,
            };
        }
        // Their own pattern — needs a couple of picks before it means anything.
        const log = Array.isArray(userProfile?.extra?.intent_log) ? userProfile.extra.intent_log : [];
        const recent = log.slice(-14);
        if (recent.length >= 3) {
            const counts = {};
            recent.forEach((e) => { if (e?.m) counts[e.m] = (counts[e.m] || 0) + 1; });
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
            if (top && top[1] >= 2) return { mode: top[0], reason: "What you usually pick" };
        }
        return null;
    }, [nextDeadline, plannerReminders, userProfile, todayKey]);

    // Handed to Ace so he can lead with it rather than asking cold. This was
    // computed for the retired modal and is the best guess the app has about
    // what today is actually for — throwing it away with the modal would have
    // made the new question dumber than the old one.
    useEffect(() => {
        if (!intentSuggestion) return;
        window.dispatchEvent(new CustomEvent("ace:suggest", { detail: intentSuggestion }));
    }, [intentSuggestion]);

    const coachLine = getCoachLine({
        name: firstName,
        hour,
        streakDays,
        todayMins: todaysStudyTime,
        studiedYesterday,
        urgentDays: nextDeadline?.days ?? null,
        urgentTitle: nextDeadline?.title ?? null,
        atar: userProfile?.acedit_atar != null ? Number(userProfile.acedit_atar) : null,
        band: atarBandOf(userProfile?.acedit_atar),
        components: userProfile?.atar_components || null,
        goalAtar: userProfile?.goal_atar ? Number(userProfile.goal_atar) : null,
        intentBlurb: todayIntentPlan?.plan?.blurb ?? null,
    });
    const streakBlurb = getStreakBlurb(streakDays);
    const multiplier = getStreakMultiplier(streakDays);

    // Last 7 calendar days with a studied-or-not flag — feeds the streak hero.
    const last7Days = useMemo(() => {
        const studiedDates = new Set(
            [...studySessions, ...studyTechniques].map(s => (s.date || '').slice(0, 10)).filter(Boolean)
        );
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(Date.now() - (6 - i) * 24 * 3600 * 1000);
            const key = format(d, 'yyyy-MM-dd');
            return {
                label: format(d, 'EEEEE'),
                studied: studiedDates.has(key),
                isToday: i === 6,
            };
        });
    }, [studySessions, studyTechniques]);
    const milestone = getNextStreakMilestone(streakDays);
    const move = getTodaysMove({
        todayMins: todaysStudyTime,
        streakDays,
        dueFlashcards: dueFlashcardCount,
        // So "all caught up" can only be claimed by somebody who has a deck to
        // be caught up ON. Active cards only — a retired card is not a card
        // they are keeping on schedule.
        totalCards: flashcards.filter(c => c.is_active !== false && !c.retired_at).length,
        urgentDays: nextDeadline?.days ?? null,
        urgentTitle: nextDeadline?.title ?? null,
        hour,
        intentMode: todayIntentPlan?.mode ?? null,
        challenge: userProfile?.primary_challenge ?? null,
    });
    const moveTheme = MOVE_THEME[move.accent];

    const moveCard = { ...(MOVE_CARD[move.accent] || MOVE_CARD.primary), ...(move.card || {}) };

    // The argument for the move: what fired it, what skipping it costs, and
    // what it is worth in ATAR points. Every row drops out when its number is
    // not real — see todaysCase.js.
    const todaysCase = useMemo(
        () => buildCase({ move, components: userProfile?.atar_components || null, flashcards }),
        [move, userProfile?.atar_components, flashcards],
    );
    // The first real thing they would face, for the face of the card. Null
    // when we have no genuine material — never a placeholder.
    const movePreview = useMemo(
        () => previewFor({ move, flashcards, deadline: nextDeadline }),
        [move, flashcards, nextDeadline],
    );

    // The modal asks "how long?" and saves the answer, but nothing ever read it
    // back — a student committed to an hour and the app never mentioned it
    // again. Track today's minutes against what they actually committed to.
    const commitment = useMemo(() => {
        if (!todayIntentPlan?.duration) return null;
        const target = todayIntentPlan.duration;
        const done = todaysStudyTime;
        return { target, done, pct: Math.min(100, Math.round((done / target) * 100)), met: done >= target };
    }, [todayIntentPlan, todaysStudyTime]);

    /**
     * How far off the person immediately above you, as one phrase.
     *
     * This is what survives of the rank panel. That panel resolved four rows
     * of names, handled anonymity for each and drew a card per row; the only
     * thing a student ever took from it was whether they were close to passing
     * someone. Anonymity still has to be honoured, but for one name instead of
     * four.
     */
    const rankGap = useMemo(() => {
        const rival = rankInfo?.rivals?.[rankInfo.rivals.length - 1];
        if (!rival || !rankInfo?.myRank || rankInfo.myRank > 50) return null;
        const name = rival.is_anonymous && rival.user_email !== user?.email
            ? `Anon #${(rival.id || "").slice(-4)}`
            : (rival.username || rival.user_name || "Student");
        return `${fmtXP(rival.gap)} XP off ${name}`;
    }, [rankInfo, user]);

    /**
     * Your subjects, ranked. Built from the flashcards this page already
     * fetches, through the same mastery formula the review deck uses, so a
     * subject that shows as a Queen here opens as a Queen over there.
     */
    // BOTH study tables. Only quizzes and the activity tracker write to
    // study_sessions; everything the Study page runs writes to
    // study_techniques, so anything asking "when did they last work on this"
    // has to read the pair. See studyLog.js.
    const logEvents = useMemo(
        () => studyEvents(studySessions, studyTechniques),
        [studySessions, studyTechniques],
    );

    // The subjects the student actually carries, for the week's breakdown.
    // From the flashcards rather than from the log, so a subject they have set
    // up and never studied is still a name this panel knows — WeekPace decides
    // for itself which of them it has enough history to show.
    const subjectNames = useMemo(
        () => [...new Set(flashcards.map((c) => c?.subject_name).filter(Boolean))],
        [flashcards],
    );


    /**
     * What setup is genuinely outstanding, derived from the profile rather than
     * read off three booleans. The signup wizard only ever wrote two of those
     * three, so every student who came through the funnel was permanently told
     * to go and do a "quick setup" they had already done. See onboardingTasks.js.
     */
    const setupLeft = useMemo(() => outstandingTasks(userProfile), [userProfile]);
    const setup = useMemo(() => setupCopy(userProfile), [userProfile]);
    const showOnboarding = needsSetup(userProfile) && !!setup;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <AceShuffle size="lg" className="mb-3 mx-auto" />
                    <p className="text-muted-foreground font-medium text-sm">Loading your dashboard…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background relative">
            {/* The surface everything below is lying on. Static paint, behind
                the content, and it is what stops a page full of playing cards
                from still reading as a document. */}
            <TableGround />
            <div className="relative z-10 w-full px-4 lg:px-8 py-6 lg:py-10 max-w-[1600px] mx-auto space-y-8 lg:space-y-10">

                {/* ── COACH STRIP ─────────────────────────────────────── */}
                <Placed index={0}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-muted-foreground uppercase tracking-wider">{format(new Date(), 'EEE · MMM d')}</span>
                            {/* The streak is NOT repeated here. It has a panel
                                below with the run of seven and the multiplier
                                in it, and printing the number twice on one
                                screen makes the second one look like a
                                different statistic. */}
                            {userProfile?.acedit_atar != null && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="inline-flex items-center gap-1 font-extrabold text-chart-4">
                                        <GraduationCap className="w-3.5 h-3.5" /> {Number(userProfile.acedit_atar).toFixed(2)} ATAR
                                    </span>
                                </>
                            )}
                            {/* What the Ranked panel was actually for. */}
                            {rankInfo?.myRank && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <Link to={createPageUrl("Ranked")}
                                        className="inline-flex items-center gap-1 font-extrabold
                                            text-xp hover:underline">
                                        <Trophy className="w-3.5 h-3.5" /> #{rankInfo.myRank}
                                        {rankGap && (
                                            <span className="text-muted-foreground font-bold">
                                                · {rankGap}
                                            </span>
                                        )}
                                    </Link>
                                </>
                            )}
                        </div>
                        <HelpButton page="Dashboard" />
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                        {coachLine.line}
                    </h1>
                    {coachLine.sub && (
                        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                            {coachLine.sub}
                        </p>
                    )}
                </Placed>

                {/* ── YOUR PLAY — the move, and the case for it ───────── */}
                <Placed index={1}>
                    <TodaysPlay move={move} card={moveCard} theme={moveTheme}
                        todaysCase={todaysCase} preview={movePreview}
                        commitment={commitment} fmtTime={fmtTime}
                        todayMins={todaysStudyTime} weekMins={weeklyStudyTime}
                        weekGoalHours={goalHours} weekPct={weeklyPct}
                        avgQuiz={avgQuizScore} />
                </Placed>


                {/* Everything below runs in two columns so the right-hand
                    margin stops being dead space. The streak row keeps its own
                    internal 3-column layout untouched — at 1600px the left
                    column is the same width the whole page used to be. */}
                <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-6 xl:gap-8 items-start">
                <div className="min-w-0 space-y-8 lg:space-y-10">

                {/* ── THE RUN, AND THE HAND ───────────────────────────── */}
                {/* Paired, and that is the single biggest change to the shape
                    of this page. The streak was a full-width panel using its
                    left third: the number, the week and the shields all sat in
                    eight of twelve columns and the remaining third held two
                    small boxes and about four hundred pixels of nothing. Beside
                    it now is the hand, which is the panel this dashboard was
                    missing — the app is a deck and the page never showed you
                    your deck. Two panels that were each half empty become one
                    row that is full. */}
                <div className="grid lg:grid-cols-2 gap-6 lg:gap-7 items-stretch">
                <Placed index={2} className="min-w-0">
                    <div>
                        {streakDays > 0 ? (
                            <div className="relative overflow-hidden rounded-2xl bg-surface border border-border shadow-soft p-6 lg:p-8 h-full">
                                {/* Was sm:grid-cols-12. Breakpoints are viewport-wide, not
                                    container-wide, so at 1600px the `sm:` split stayed on
                                    inside a column half the width it was written for and
                                    squeezed the run of seven into four columns. It splits
                                    at xl now, which is the width this panel is actually
                                    wide again. */}
                                <div className="relative grid grid-cols-1 xl:grid-cols-12 gap-5 items-center">
                                    <div className="xl:col-span-8">
                                        <p className="stat-label text-streak/80 mb-1 inline-flex items-center gap-1">
                                            Day streak <AceTip term="streak" />
                                        </p>
                                        <div className="flex items-baseline gap-3">
                                            <span
                                                className="font-display font-extrabold text-streak leading-none"
                                                style={{ fontSize: 'clamp(3.5rem, 10vw, 6rem)' }}
                                            >
                                                {streakDays}
                                            </span>
                                            <span className="font-display font-extrabold text-streak/50 text-2xl lg:text-3xl">
                                                {streakDays === 1 ? 'day' : 'days'}
                                            </span>
                                        </div>
                                        {streakBlurb && (
                                            <p className="text-foreground text-sm lg:text-base mt-2 max-w-md font-medium leading-snug">
                                                {streakBlurb}
                                            </p>
                                        )}

                                        {/* Last 7 days — the run. Face-up is a
                                            day you showed up, face-down is a
                                            gap, and today is the card still to
                                            be played. */}
                                        <RunOfSeven days={last7Days} />

                                        {/* Shields — insurance against one missed day */}
                                        <div className="inline-flex items-center gap-1.5 mt-3 bg-surface rounded-full px-3 py-1.5 border border-chart-3/20">
                                            <Shield className={`w-3.5 h-3.5 ${(userProfile?.streak_shields || 0) > 0 ? 'text-chart-3' : 'text-muted-foreground/40'}`} />
                                            <span className="text-xs font-bold text-foreground">
                                                {userProfile?.streak_shields || 0} shield{(userProfile?.streak_shields || 0) === 1 ? '' : 's'}
                                            </span>
                                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                                · earn one each 7-day milestone
                                            </span>
                                        </div>
                                    </div>
                                    <div className="xl:col-span-4 grid grid-cols-2 xl:grid-cols-1 gap-3">
                                        <div className="bg-surface rounded-xl p-3 border border-streak/10 shadow-soft">
                                            <p className="stat-label">XP boost</p>
                                            <p className="font-display font-extrabold text-streak text-2xl mt-0.5 leading-none">{multiplier}</p>
                                        </div>
                                        {milestone ? (
                                            <div className="bg-surface rounded-xl p-3 border border-border/60 shadow-soft">
                                                <p className="stat-label">Next jump</p>
                                                <p className="font-bold text-foreground text-sm mt-0.5">
                                                    {milestone.away}d <span className="text-muted-foreground/60">→</span> {milestone.mult}
                                                </p>
                                                <div className="h-1 bg-secondary rounded-full mt-1.5 overflow-hidden">
                                                    <motion.div
                                                        className="h-full bg-streak rounded-full"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${((milestone.at - milestone.away) / milestone.at) * 100}%` }}
                                                        transition={{ duration: 0.9, delay: 0.5 }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-surface rounded-xl p-3 border border-border/60 shadow-soft">
                                                <p className="stat-label">Status</p>
                                                <p className="font-bold text-streak text-sm mt-0.5">Maxed at 2.0×</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-surface border border-dashed border-border p-6 lg:p-8 text-center h-full flex flex-col items-center justify-center on-table">
                                <AceBody className="w-28 mb-1" pose="point" title="Ace" />
                                <h2 className="font-display font-extrabold text-foreground text-xl lg:text-2xl mb-2">
                                    Ready to start a streak?
                                </h2>
                                <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-5">
                                    A study session today gets you started. Show up tomorrow to keep it.
                                </p>
                                <Link to={createPageUrl("Study")}>
                                    <Button><Play className="w-4 h-4" /> Start your first session</Button>
                                </Link>
                            </div>
                        )}
                    </div>

                </Placed>

                {/* The hand. Same row, same height. */}
                <Placed index={3} className="min-w-0">
                    {/* The subjects hand was here — a fan of playing cards
                        whose corner ended up printing the same usual weekly
                        hours this panel is built on, two panels apart, on a
                        different object. One of them had to go, and the fan
                        was the one whose own number had already been replaced
                        twice looking for something worth putting there. */}
                    <WeekPace events={logEvents} subjects={subjectNames} className="h-full" />
                </Placed>
                </div>

                {/* RANK & RIVALS lived here and took 230px of the best space on
                    the page to say "#3 of 5". Its two real facts — where you
                    sit, and how far off the person above — are one line in the
                    header strip now. Everything else it drew was a leaderboard
                    widget of the shape every app has, and for most students it
                    was four rows of people they have never met. The full board
                    is still a click away on Ranked, where someone who wants a
                    leaderboard goes to look at one. */}

                {/* ── ONBOARDING NUDGE ────────────────────────────────── */}
                {showOnboarding && (
                    <Placed index={4} className="rounded-2xl bg-primary/5 border border-primary/15 on-table p-5 lg:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div>
                                    <h3 className="font-display font-extrabold text-foreground text-base">
                                        {setup.title}
                                    </h3>
                                    <p className="text-muted-foreground text-sm">
                                        {setup.body}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {setupLeft.includes("username_set") && (
                                    <Link to={createPageUrl("Settings")}>
                                        <Button size="sm" variant="outline"><CheckCircle2 className="w-3.5 h-3.5" /> Username</Button>
                                    </Link>
                                )}
                                {setupLeft.includes("subjects_selected") && (
                                    <Link to={createPageUrl("Subjects")}>
                                        <Button size="sm" variant="outline"><CheckCircle2 className="w-3.5 h-3.5" /> Subjects</Button>
                                    </Link>
                                )}
                                {setupLeft.includes("goals_set") && (
                                    <Link to={createPageUrl("Goals")}>
                                        <Button size="sm" variant="outline"><CheckCircle2 className="w-3.5 h-3.5" /> Plan</Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </Placed>
                )}

                {/* DISTANCE TO TARGET lived here. It answered "how am I
                    going", which is the question Ranked and Analytics both
                    exist to answer properly, with room to show the working.
                    On a page whose one job is "what do I do right now", a
                    target ATAR is a number you can look at and not act on —
                    and it was the third progress readout on the screen after
                    the header strip and the streak. The goal itself is still
                    set and tracked in the Planner. */}


                    {/* ── WHAT YOU'LL LOSE THIS WEEK ──────────────────────── */}
                    {/* Moved out of the side rail to balance the columns. Folding
                        the daily numbers into Your Play took ~300px off the left
                        column and left it ending well short of the rail, so the
                        bottom third of the page was empty on one side and dense on
                        the other. This is the tallest panel of the set, so it is
                        the one that squares them up.

                        The brain picture stays off the dashboard — it lives on
                        Study and in the Analytics cognition tab. Here it was one
                        idea too many next to the streak, the goal and the rank:
                        it pulled attention without the page having room for the
                        explanation that makes it mean anything. */}
                    <RetentionCard flashcards={flashcards} />

                </div>

                {/* ── SIDE RAIL ───────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    /* min-w-0: a grid item defaults to min-width:auto, so its
                       widest intrinsic child sets the track. Without this the
                       radar rows pushed the whole page 21px wider than the
                       viewport on a phone. */
                    className="min-w-0 space-y-5 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 xl:block xl:space-y-5"
                >
                    {/* Today's intention — set in the Planner, read here. It was
                        being written and then only ever shown on the page that
                        wrote it. */}
                    <div className="card-soft on-table border-2 border-border p-5">
                        <p className="stat-label text-chart-4/80 mb-1.5">Today's intention</p>
                        {todayIntention ? (
                            <>
                                <p className="text-base font-display font-extrabold text-foreground leading-snug">
                                    {todayIntention}
                                </p>
                                <Link to={createPageUrl("Goals")}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground mt-2 transition-colors">
                                    Change it in the Planner <ArrowRight className="w-3 h-3" />
                                </Link>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-muted-foreground leading-snug">
                                    Nothing set for today. One line about what today is for makes it much
                                    harder to drift.
                                </p>
                                <Link to={createPageUrl("Goals")}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-chart-4 hover:underline mt-2">
                                    Set one in the Planner <ArrowRight className="w-3 h-3" />
                                </Link>
                            </>
                        )}
                    </div>

                    {/* The dial. It was a list of rows with pink pills under a
                        heading that said "radar", which is a word doing the job
                        a picture should — see DueRadar for why the geometry IS
                        the data here rather than a skin over it.

                        Rendered unconditionally: it owns its own empty state,
                        and an empty dial saying "nothing inside a fortnight" is
                        a useful thing to be told. The list it replaced had to
                        be guarded because a panel with no rows in it is just a
                        heading. */}
                    <DueRadar items={radar} />



                </motion.div>
                </div>

                {/* ── JUMP-TO RAIL ────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="border-t border-border/60 pt-6"
                >
                    {/* Centred over the hand rather than parked at the far
                        left, where the heading and the thing it headed sat at
                        opposite ends of a 1376px row. */}
                    <p className="stat-label mb-2 md:text-center">Jump to</p>
                    {/* Ace is deliberately NOT here. He stood at the edge of
                        the table for one revision and it was one Ace too many:
                        AceBuddy already lives in the corner of every page and
                        two of the same character on one screen makes the
                        companion read as decoration. The corner is enough. */}
                    <HandRail />
                </motion.section>

            </div>
        </div>
    );
}

// ─── Inline components ────────────────────────────────────────────────────────
// ReminderRow drew one line of the old radar list. Deleted with it.

