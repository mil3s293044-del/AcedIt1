/**
 * cognitiveProfile — five axes describing how this student's learning behaves.
 *
 * Deliberately NOT a score out of 100 with a grade attached. Each axis is a
 * separate measurable thing with its own unit, its own evidence, and its own
 * fix; collapsing them into one number would throw away the only part that's
 * useful, which is knowing WHICH one is weak.
 *
 * The hard rule here: an axis with no data reads as UNKNOWN, never as zero.
 * A student who has never made a flashcard does not have bad memory stability
 * — the app has no idea what their memory stability is, and a radar chart with
 * a spike collapsed to the origin would tell them a lie they'd believe.
 */
import { retrievalShare, stabilityBySubject, lapseProfile } from "@/lib/memoryAnalytics";
import { brainActivity } from "@/lib/brainActivity";
import { lengthCurve } from "@/lib/attentionAnalytics";

/**
 * Reference points, stated openly because they are judgement calls rather than
 * findings. Each is the level at which an axis reads as "full" — chosen to be
 * a good student's month, not a theoretical maximum.
 */
export const REFERENCES = {
    retrievalShare: 0.6,     // 60% of study time spent retrieving
    medianInterval: 21,      // cards holding three weeks between reviews
    lapseRate: 0.1,          // one in ten reviews coming back wrong
    focusMinutes: 45,        // a sustained block
};

const clamp01 = (n) => Math.max(0, Math.min(1, n));

export const AXES = [
    {
        id: "retrieval",
        label: "Retrieval",
        unit: "of study time",
        what: "How much of your time is spent pulling information out rather than putting it in.",
        why: "The most replicated result in the study literature: testing yourself beats reviewing, and the gap widens the longer you leave it.",
        fix: "Blurting or Active Recall instead of another read-through.",
        to: "Study?tab=active_recall",
    },
    {
        id: "stability",
        label: "Stability",
        unit: "median interval",
        what: "How long your cards hold between reviews before they need seeing again.",
        why: "A memory that survives three weeks is a different thing to one that needs topping up every second day.",
        fix: "Spaced Repetition — the intervals only stretch if you keep the schedule.",
        to: "Study?tab=spaced_repetition",
    },
    {
        id: "durability",
        label: "Durability",
        unit: "review survival",
        what: "How often a card comes back right rather than having to be relearned.",
        why: "A high lapse rate is the signature of memorising without understanding, and more reviewing doesn't fix it.",
        fix: "Split the cards that keep failing — one idea each.",
        to: "Study?tab=spaced_repetition",
    },
    {
        id: "spread",
        label: "Spread",
        unit: "systems engaged",
        what: "How many of the brain systems the imaging literature links to studying your month actually touched.",
        why: "Narrow work leaves whole systems idle — a month of pure Pomodoro barely involves retrieval at all.",
        fix: "A technique you haven't touched this month.",
        to: "Study",
    },
    {
        id: "focus",
        label: "Focus",
        unit: "typical session",
        what: "How long your sessions run, against a sustained block of 45 minutes.",
        why: "Depth needs a run at it. A month of ten-minute sessions covers ground without ever getting below the surface.",
        fix: "One longer sitting rather than several short ones.",
        to: "Study?tab=pomodoro",
    },
];

const AXIS_BY_ID = Object.fromEntries(AXES.map(a => [a.id, a]));

/**
 * @param techniques StudyTechnique rows for the window
 * @param cards      all flashcards (not windowed — memory state is cumulative)
 * @param sessions   StudySession rows for the window
 */
export function cognitiveProfile({ techniques = [], cards = [], sessions = [] } = {}) {
    const share = retrievalShare(techniques);
    const stability = stabilityBySubject(cards);
    const lapse = lapseProfile(cards);
    const brain = brainActivity(techniques);
    const curve = lengthCurve(sessions);

    // Median interval across every learned card, weighted by how many cards
    // each subject holds — a subject with three cards shouldn't count the same
    // as one with three hundred.
    const totalCards = stability.subjects.reduce((s, x) => s + x.cards, 0);
    const weightedInterval = totalCards
        ? stability.subjects.reduce((s, x) => s + x.medianInterval * x.cards, 0) / totalCards
        : null;

    const sessionMins = sessions
        .map(s => Number(s?.duration_minutes))
        .filter(n => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b);
    const medianSession = sessionMins.length
        ? sessionMins[sessionMins.length >> 1]
        : null;

    const raw = {
        retrieval: share.share,
        stability: weightedInterval,
        durability: lapse.rate == null ? null : 1 - lapse.rate,
        spread: brain.hasData ? brain.coverage : null,
        focus: medianSession,
    };

    const scored = {
        retrieval: raw.retrieval == null ? null : clamp01(raw.retrieval / REFERENCES.retrievalShare),
        stability: raw.stability == null ? null : clamp01(raw.stability / REFERENCES.medianInterval),
        // Durability maps the band between "every review fails" and the
        // reference lapse rate, so a merely-normal 15% doesn't read as 85%
        // when the target is 10%.
        durability: lapse.rate == null ? null : clamp01(1 - lapse.rate / (REFERENCES.lapseRate * 3)),
        spread: raw.spread,
        focus: raw.focus == null ? null : clamp01(raw.focus / REFERENCES.focusMinutes),
    };

    const display = {
        retrieval: raw.retrieval == null ? null : `${Math.round(raw.retrieval * 100)}%`,
        stability: raw.stability == null ? null : `${Math.round(raw.stability)}d`,
        durability: lapse.rate == null ? null : `${Math.round((1 - lapse.rate) * 100)}%`,
        spread: raw.spread == null ? null : `${brain.litCount}/${brain.totalRegions}`,
        focus: raw.focus == null ? null : `${Math.round(raw.focus)}m`,
    };

    const axes = AXES.map(a => ({
        ...a,
        score: scored[a.id],
        raw: raw[a.id],
        display: display[a.id],
        known: scored[a.id] != null,
    }));

    const known = axes.filter(a => a.known);
    return {
        axes,
        known: known.length,
        total: axes.length,
        // The weakest KNOWN axis. Deliberately not "the weakest axis" — an
        // unmeasured one would win that every time and send the student to fix
        // something the app simply hasn't seen.
        weakest: known.length ? known.reduce((lo, a) => (a.score < lo.score ? a : lo)) : null,
        strongest: known.length ? known.reduce((hi, a) => (a.score > hi.score ? a : hi)) : null,
        hasData: known.length > 0,
        sources: { share, stability, lapse, brain, curve },
    };
}

/** What the app would need to see before an axis stops reading unknown. */
export function whatUnlocks(axisId) {
    switch (axisId) {
        case "retrieval": return "Log any study session and this fills in.";
        case "stability": return "Review a flashcard deck a couple of times — this comes from the schedule those reviews build.";
        case "durability": return "Review a flashcard deck; this is how many of those reviews come back right.";
        case "spread":    return "Log any study session and this fills in.";
        case "focus":     return "Log a study session with a duration and this fills in.";
        default:          return AXIS_BY_ID[axisId] ? "Not enough logged yet." : "";
    }
}
