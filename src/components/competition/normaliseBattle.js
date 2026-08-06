/**
 * normaliseBattle — one shape for every kind of competition.
 *
 * Duels (study_duels) and group battles (goal_competitions) are different
 * tables with different field names that mean the same things, and the Compete
 * page rendered them in two separate tabs with two separate card designs. That
 * split is what made the page feel disorganised: as a student you have "things
 * I'm currently racing in", not "duels" and "battles".
 *
 * Everything downstream — the unified list and the dashboard — reads this
 * shape, so neither has to know which table a battle came from.
 */
import { winOdds, momentumOf, gapSeries, oddsSeries, battleNarrative } from "./battleOdds";
import { computePot } from "./arenaHelpers";

const METRIC_UNIT = {
    xp: "XP", quiz_marks: "marks", flashcards: "cards", study_minutes: "min",
};

function decorate(base) {
    const rivals = base.sides.filter((s) => !s.isMe);
    const me = base.sides.find((s) => s.isMe) || null;
    const meP = me?.participant ?? null;
    const odds = base.status === "settled" ? null
        : winOdds({ me: meP, rivals: rivals.map((r) => r.participant), targetDate: base.endsAt });
    return {
        ...base,
        me,
        rivals,
        odds,
        momentum: momentumOf(meP, 24),
        swing: gapSeries({ me: meP, rivals: rivals.map((r) => r.participant) }),
        market: oddsSeries({
            me: meP, rivals: rivals.map((r) => r.participant),
            targetDate: base.endsAt, startedAt: base.startedAt,
        }),
        narrative: base.status === "settled" ? null
            : battleNarrative({ me: meP, rivals: rivals.map((r) => r.participant) }),
        leader: [...base.sides].sort((a, b) => b.score - a.score)[0] || null,
    };
}

/** A head-to-head duel from the arena. */
export function fromDuel(duel, myEmail) {
    const scores = duel.status === "settled" ? (duel.final_scores || {}) : (duel.live_scores || {});
    // The trail the server snapshots (migration 0024) is stored as one row per
    // moment holding both sides; split it per participant so duels feed the
    // same momentum, swing and probability code that battles do.
    const trail = Array.isArray(duel.score_history) ? duel.score_history : [];
    const historyFor = (which) =>
        trail.filter(h => h && h.t && typeof h[which] === "number").map(h => ({ t: h.t, s: h[which] }));

    const side = (email, name, which) => ({
        email, name: name || email, score: Math.round(scores[email] || 0),
        isMe: email === myEmail,
        participant: {
            email, name,
            compete_score: Math.round(scores[email] || 0),
            score_history: historyFor(which),
        },
    });
    return decorate({
        id: duel.id,
        kind: "duel",
        title: `${METRIC_UNIT[duel.metric] ? `${duel.metric.replace("_", " ")} ` : ""}duel`.replace(/^\w/, (c) => c.toUpperCase()),
        subtitle: null,
        unit: METRIC_UNIT[duel.metric] || "pts",
        sides: [
            side(duel.challenger_email, duel.challenger_name, "a"),
            side(duel.opponent_email, duel.opponent_name, "b"),
        ],
        startedAt: duel.starts_at,
        endsAt: duel.ends_at,
        potXP: (duel.ante_xp || 0) * 2,
        status: duel.status === "settled" ? "settled" : duel.status === "active" ? "live" : duel.status,
        winnerEmail: duel.winner_email || null,
        raw: duel,
    });
}

/** A multi-player goal competition. */
export function fromCompetition(comp, myEmail) {
    const accepted = (comp.participants || []).filter(
        (p) => p.status === "accepted" || p.status === "completed",
    );
    return decorate({
        id: comp.id,
        kind: "battle",
        title: comp.goal_title || "Battle",
        subtitle: comp.creator_name ? `by ${comp.creator_name}` : null,
        unit: "pts",
        sides: accepted.map((p) => ({
            email: p.email,
            name: p.name || p.email,
            score: Math.round(Number(p.compete_score ?? p.progress_percent ?? 0)),
            isMe: p.email === myEmail,
            participant: p,
        })),
        startedAt: comp.competition_start_date || comp.created_date,
        endsAt: comp.goal_target_date,
        potXP: computePot(comp)?.total || 0,
        status: comp.status === "completed" ? "settled" : "live",
        winnerEmail: comp.winner_email || null,
        raw: comp,
    });
}

/** Everything the student is racing in, most urgent first. */
export function allBattles({ duels = [], competitions = [], myEmail }) {
    const list = [
        ...duels.map((d) => fromDuel(d, myEmail)),
        ...competitions.map((c) => fromCompetition(c, myEmail)),
    ];
    const rank = (b) => (b.status === "live" ? 0 : 1);
    return list.sort((a, b) => {
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        // Live: soonest deadline first. Settled: most recent first.
        const at = a.endsAt ? new Date(a.endsAt).getTime() : Infinity;
        const bt = b.endsAt ? new Date(b.endsAt).getTime() : Infinity;
        return a.status === "live" ? at - bt : bt - at;
    });
}
