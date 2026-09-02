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
 *   BRAIN     which systems the move works, and which of those their last four
 *             weeks have left dark. This is the one thing on the page nothing
 *             else in the product says.
 *   PAYOFF    what it is worth in ATAR points, from atarLift — the same model
 *             Ranked uses. Never XP: XP is a number the app invented, and a
 *             payoff a student cannot check is an advert.
 *
 * ─── The rule ───────────────────────────────────────────────────────────────
 * EVERY ROW IS DROPPED WHEN ITS NUMBER IS NOT REAL. A student in their first
 * week has no ATAR components, no 28-day brain history and no cards below
 * recall, and the hero must not print "+0.0 ATAR" or "0 regions quiet" at
 * them — a case made of zeroes is worse than no case, because it teaches them
 * the numbers on this page are decoration. The panel renders whatever survives
 * and drops the rail entirely when nothing does.
 */
import { TECHNIQUE_NEURO, REGIONS } from "@/lib/neuro";
import { liftFor, ATAR_WEIGHTS } from "@/lib/atarLift";

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
 * The regions to light, and what they mean.
 *
 * TWO LAYERS IN ONE PICTURE, and the contrast is the argument:
 *   - everything the student's last 28 days actually lit, at its real
 *     activation, so a Pomodoro-only month reads as a bright front and a dark
 *     middle;
 *   - the regions today's move works, pushed to full.
 *
 * A region that is dark in the first layer and full in the second is precisely
 * "this is the gap and this move fills it", drawn rather than asserted.
 */
export function caseRegions(technique, activity) {
    const lit = new Map();
    for (const r of activity?.regions || []) {
        if (!REGIONS[r.id]) continue;
        lit.set(r.id, { id: r.id, tone: r.tone, activation: Math.max(0.12, r.activation || 0) });
    }
    const target = TECHNIQUE_NEURO[technique]?.regions || [];
    for (const r of target) {
        if (!REGIONS[r.id]) continue;
        lit.set(r.id, { id: r.id, tone: r.tone, activation: 1 });
    }
    return [...lit.values()];
}

/**
 * The regions this move brings online that the student's recent work has not.
 *
 * `activity.quiet` is every region NOTHING they did lit. Intersecting it with
 * the move's own regions is the honest version of "here is what you are
 * missing" — it names only gaps this move actually closes, rather than
 * listing everything dark and hoping one of them looks relevant.
 */
export function quietGaps(technique, activity) {
    const target = TECHNIQUE_NEURO[technique]?.regions || [];
    if (!target.length || !activity?.hasData) return [];
    const quiet = new Set((activity.quiet || []).map((q) => q.id));
    return target
        .filter((r) => quiet.has(r.id))
        .map((r) => ({ id: r.id, name: REGIONS[r.id]?.short || REGIONS[r.id]?.name || r.id, role: r.role }));
}

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
export function buildCase({ move, activity, components }) {
    const rows = [];

    if (move?.why?.value != null && move.why.label) {
        rows.push({ kind: "trigger", value: String(move.why.value), label: move.why.label });
    }

    const gaps = quietGaps(move?.technique, activity);
    if (gaps.length) {
        rows.push({
            kind: "brain",
            value: gaps.length === 1 ? gaps[0].name : `${gaps.length} regions`,
            label: gaps.length === 1
                ? "quiet for four weeks — this wakes it"
                : "your recent work hasn't touched",
        });
    }

    const payoff = payoffFor(components, move?.component);
    if (payoff) {
        rows.push({
            kind: "payoff",
            value: `+${payoff.gain.toFixed(2)}`,
            label: `on your ATAR, through ${payoff.label}`,
        });
    }

    return {
        rows,
        regions: caseRegions(move?.technique, activity),
        // The picture is worth drawing only when it is showing THIS student's
        // work. With no history every region reads the same and it is an
        // illustration, which is the decoration this app keeps removing.
        hasBrain: Boolean(TECHNIQUE_NEURO[move?.technique]) || Boolean(activity?.hasData),
        payoff,
        gaps,
    };
}
