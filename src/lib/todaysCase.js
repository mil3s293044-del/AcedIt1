/**
 * todaysCase — the ARGUMENT for the day's move, not just the instruction.
 *
 * The dashboard hero told a student what to do and nothing else: a headline, a
 * line of encouragement, a button. That is an app asserting something. This
 * builds the case underneath it — why this move and not another one, and what
 * it is worth if they do it — out of numbers the student can check.
 *
 * Three parts, and each is a different kind of claim:
 *
 *   TRIGGER   what fired this move. A fact about their data, today. "11 cards
 *             have fallen below reliable recall." The move carries it, because
 *             only the branch that chose the move knows why it chose it.
 *   RISK      what it costs to skip today, where that is a real projection
 *             rather than a scare. Only where the move has one — a review move
 *             can say what falls out of reach; a Pomodoro cannot.
 *   PAYOFF    what it is worth in ATAR points, from atarLift — the same model
 *             Ranked uses. Never XP: XP is a number the app invented, and a
 *             payoff a student cannot check is an advert.
 *
 * ─── The rule ───────────────────────────────────────────────────────────────
 * EVERY ROW IS DROPPED WHEN ITS NUMBER IS NOT REAL. A student in their first
 * week has no ATAR components and no cards below recall, and the hero must not
 * print "+0.0 ATAR" at them — a case made of zeroes is worse than no case,
 * because it teaches them the numbers on this page are decoration. The panel
 * renders whatever survives and drops the rail entirely when nothing does.
 *
 * ─── A row a picture explained cannot survive the picture ───────────────────
 * There was a BRAIN row: "4 regions your recent work hasn't touched", beside a
 * 3D model that showed exactly which ones and how dark. The model went, and
 * the row could not stand on its own — without the picture, "4 regions" is
 * jargon a student cannot act on and cannot check. Evidence that only reads
 * next to a graphic goes when the graphic does.
 */
import { liftFor, ATAR_WEIGHTS } from "@/lib/atarLift";
import { isDue } from "@/lib/due";
import { retentionOutlook } from "@/lib/retention";

/** How much of a component one solid session is worth assuming. */
const STEP = 10;

const COMPONENT_LABEL = {
    mastery: "mastery",
    consistency: "consistency",
    effort: "effort",
    breadth: "breadth",
    planning: "planning",
};

/**
 * What a solid session on this move is worth on the AcedIt ATAR.
 *
 * Ten points on one component, capped at its real headroom by `liftFor` — so a
 * component already at 96 cannot be credited with a rise it has no room for.
 * Returns null rather than zero when there is nothing to claim.
 */
export function payoffFor(components, componentKey) {
    if (!componentKey || !ATAR_WEIGHTS[componentKey]) return null;
    const lift = liftFor(components, componentKey, STEP);
    if (!lift || !(lift.gain > 0.005)) return null;
    return {
        key: componentKey,
        label: COMPONENT_LABEL[componentKey] || componentKey,
        gain: lift.gain,
        headroom: lift.headroom,
    };
}

/**
 * The whole case, assembled and pruned.
 *
 * `move.why` is the trigger fact, supplied by whichever branch chose the move,
 * as `{ value, label }`. A move with no honest number to show simply omits it
 * and the rail is one row shorter.
 */
export function buildCase({ move, components, flashcards = [] }) {
    const rows = [];

    if (move?.why?.value != null && move.why.label) {
        rows.push({ kind: "trigger", value: String(move.why.value), label: move.why.label });
    }

    // What skipping today costs, for the moves that genuinely have an answer.
    // `retentionOutlook` projects their own cards down the forgetting curve;
    // it is the same model RetentionCard draws, so the two cannot disagree.
    // A Pomodoro has no equivalent and gets no row rather than a vague one.
    if (move?.technique === "spaced_repetition" && flashcards.length) {
        const o = retentionOutlook(flashcards, { days: 7 });
        if (o.hasData && o.falling > 0) {
            rows.push({
                kind: "risk",
                value: String(o.falling),
                label: `more drop below reliable recall within ${o.days} days`,
            });
        }
    }

    const payoff = payoffFor(components, move?.component);
    if (payoff) {
        rows.push({
            kind: "payoff",
            value: `+${payoff.gain.toFixed(2)}`,
            label: `on your ATAR, through ${payoff.label}`,
        });
    }

    return { rows, payoff };
}

/**
 * The actual first thing they would face, for the face of the card.
 *
 * ONLY REAL CONTENT. Every branch returns null rather than a placeholder,
 * because the card turns over on a promise — "here is the first one" — and a
 * face reading "your next question will appear here" breaks it on the one
 * interaction the panel asks for. With nothing to show, MovePreview keeps the
 * old icon-and-label face, which promises nothing.
 */
export function previewFor({ move, flashcards = [], deadline, today }) {
    if (!move) return null;

    // A review move shows a card off their own deck. The one the session would
    // actually open with: due, and the longest overdue first, which is the
    // order the review queue itself uses.
    if (move.technique === "spaced_repetition") {
        const due = flashcards
            .filter((c) => c.question && isDue(c, today))
            .sort((a, b) => String(a.next_review_date || "").localeCompare(String(b.next_review_date || "")));
        const card = due[0];
        if (!card) return null;
        return {
            label: card.subject_name || "First up",
            body: card.question,
            foot: due.length > 1 ? `and ${due.length - 1} more` : null,
        };
    }

    // A deadline shows the deadline. The title is the whole point — "your SAC"
    // is something they already know, "Unit 3 AOS 2 SAC" is the thing they
    // have been avoiding.
    if (move.component === "planning" && deadline?.title) {
        const d = deadline.days;
        return {
            label: d === 0 ? "Due today" : `In ${d} day${d === 1 ? "" : "s"}`,
            body: deadline.title,
            foot: "Nothing planned for it yet",
        };
    }

    // A timed block shows the block. It is the only move whose "first thing"
    // is not a piece of content, and a clock IS the work.
    if (move.technique === "pomodoro") {
        return { label: "One block", body: "25:00", foot: "Then a real break" };
    }

    return null;
}
