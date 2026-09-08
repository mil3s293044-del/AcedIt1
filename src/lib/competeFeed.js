/**
 * competeFeed — Compete as a timeline of things people did, not a dashboard of
 * things you have.
 *
 * ─── Why the page needed this ───────────────────────────────────────────────
 * Every surface on Compete was me-centric: your market in `BookPanel`, your
 * rivals in `MoversPanel`, three tabs of your battles, your bets, your calls.
 * Nothing on the page was a SHARED object. So the one question that brings
 * somebody back — "did something happen without me?" — had no answer, and the
 * single most dramatic thing the app can do, one student calling another out,
 * was a private transaction that nobody else ever learned about.
 *
 * A feed fixes that by having VERBS AND PEOPLE. "Priya called Tom out" is an
 * event; "your odds are 61%" is a readout. The first one is worth opening an
 * app for.
 *
 * ─── What it may and may not claim ──────────────────────────────────────────
 * The trail records a score every few hours and the ticker records what a
 * rival did. We can say a price moved, and we can say somebody studied inside
 * the same window. WE CANNOT SAY ONE CAUSED THE OTHER, and a feed that fakes
 * causation is a feed nobody trusts twice — the rule `MoversPanel` already
 * keeps, carried over intact. Two events, never joined with "because".
 *
 * ─── The tone is banter, and it is banter ABOUT THE SCOREBOARD ──────────────
 * A pass gets celebrated by name and at volume. A miss gets a line with some
 * bite in it — and the bite is always aimed at the RESULT, never at the person
 * or at whether they are any good. "The clock won that one" is banter. "Tom is
 * hopeless" is the app kicking a sixteen-year-old, and there is no version of
 * engagement worth that.
 *
 * `BANNED` is the project's own list and a test asserts every line clears it.
 */

import { isRetryAttempt } from "@/lib/quizInsight";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/** Voice guardrails from CLAUDE.md. A test walks every line against these. */
export const BANNED = ["Don't", "Fix it", "No excuses", "Embarrassing", "Move"];

const SOURCE_LABEL = {
    quiz: "a quiz", flashcard: "flashcards", study_session: "a session",
    active_recall: "active recall", blurting: "blurting", focus_session: "a focus block",
    mini_test: "a mock", loading_quiz: "a warm-up", practice_questions: "practice",
};

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "Someone";

/**
 * Pick one line from a set, stably.
 *
 * Deterministic on the event's own id rather than random: a feed that reworded
 * itself on every render would make a student doubt they had read it right,
 * and the same event scrolled past twice has to say the same thing.
 */
export function pick(list, seed) {
    if (!list.length) return "";
    let h = 0;
    const s = String(seed || "");
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return list[h % list.length];
}

export function agoLabel(at) {
    const ms = Date.now() - new Date(at).getTime();
    if (!Number.isFinite(ms)) return "";
    const m = Math.round(ms / MIN);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
}

/** Time remaining, for anything with a clock on it. */
export function leftLabel(until) {
    const ms = new Date(until).getTime() - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const m = Math.round(ms / MIN);
    if (m < 60) return `${m}m left`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h ${m % 60}m left` : `${Math.round(h / 24)}d left`;
}

// ─── Call-outs ──────────────────────────────────────────────────────────────

/**
 * A call-out is now an event in the contest it belongs to, seen by everyone
 * racing in it. That visibility is the whole point: a challenge nobody
 * witnesses is a DM with extra steps, and the reason to answer one is that
 * the people you are racing are watching.
 */
function calloutEvent(c, myEmail) {
    if (!c?.id) return null;
    const caller = firstName(c.caller_name);
    const target = firstName(c.target_name);
    const iCalled = c.caller_email === myEmail;
    const iAmTarget = c.target_email === myEmail;
    const seed = `${c.id}:${c.status}`;
    const at = new Date(c.submitted_at || c.started_at || c.created_date || 0);

    const base = {
        id: `callout:${c.id}:${c.status}`,
        at,
        callout: c,
        battleRef: c.duel_id ? { kind: "duel", id: c.duel_id } : { kind: "competition", id: c.competition_id },
        actor: { name: c.caller_name, email: c.caller_email, isMe: iCalled },
        target: { name: c.target_name, email: c.target_email, isMe: iAmTarget },
        involvesMe: iCalled || iAmTarget,
        reactable: true,
    };

    if (c.status === "pending" || c.status === "active") {
        const left = leftLabel(c.respond_by);
        return {
            ...base,
            kind: "callout_live",
            tone: "live",
            // A live call-out is the only thing on this page with a clock
            // running on somebody's behalf. It sorts first for that reason.
            urgent: true,
            deadline: c.respond_by,
            headline: iAmTarget
                ? pick([
                    `${caller} reckons you clocked the hours without the learning.`,
                    `${caller} has called you out. The quiz is from your own study.`,
                    `${caller} put their whole run on you not knowing this.`,
                ], seed)
                : iCalled
                    ? pick([
                        `You called ${target} out. Ball's in their court.`,
                        `${target} has your challenge sitting there.`,
                    ], seed)
                    : pick([
                        `${caller} called ${target} out.`,
                        `${caller} fancies their chances against ${target}.`,
                        `${caller} has gone after ${target}.`,
                    ], seed),
            // The time left is NOT in here. FeedRow draws a live clock for a
            // live call-out, so putting it in the detail too printed it twice
            // in one line — "19h 0m left · 19h 0m left · 8 questions". `left`
            // is still computed because a surface without a ticking clock
            // needs it.
            timeLeft: left,
            detail: [
                c.status === "active" ? `${target} is sitting it now` : null,
                `${c.question_count || 0} questions`,
            ].filter(Boolean).join(" · "),
        };
    }

    if (c.status === "passed") {
        const pct = typeof c.score === "number" ? Math.round(c.score * 100) : null;
        return {
            ...base,
            kind: "callout_passed",
            tone: "win",
            stat: pct != null ? `${pct}%` : null,
            headline: iAmTarget
                ? pick([
                    `You answered it. ${caller} is paying for asking.`,
                    `Called out, cleared it. That one's on ${caller}.`,
                ], seed)
                : pick([
                    `${target} answered it and took ${caller}'s stake.`,
                    `${target} knew it cold. ${caller} paid for the question.`,
                    `${caller} asked. ${target} answered. Expensive.`,
                ], seed),
            detail: [
                pct != null ? `${pct}% under the clock` : null,
                c.xp_moved ? `${c.xp_moved} XP moved` : null,
            ].filter(Boolean).join(" · "),
        };
    }

    if (c.status === "failed" || c.status === "expired") {
        const ignored = c.status === "expired";
        return {
            ...base,
            kind: ignored ? "callout_expired" : "callout_failed",
            tone: "loss",
            headline: iAmTarget
                ? (ignored
                    ? pick([
                        `The clock ran out on ${caller}'s call-out.`,
                        `That one timed out. ${caller} takes it.`,
                    ], seed)
                    : pick([
                        `${caller} called that one right.`,
                        `Didn't clear it that time. ${caller} takes the stake.`,
                    ], seed))
                : (ignored
                    ? pick([
                        `${target} let ${caller}'s clock run out.`,
                        `${caller} called ${target} out. No answer came.`,
                    ], seed)
                    : pick([
                        `${caller} called it. ${target} came up short.`,
                        `${target} couldn't clear ${caller}'s call-out.`,
                    ], seed)),
            detail: [
                typeof c.score === "number" ? `${Math.round(c.score * 100)}%` : (ignored ? "no answer" : null),
                c.xp_moved ? `${c.xp_moved} XP moved` : null,
            ].filter(Boolean).join(" · "),
        };
    }

    return null; // voided — nothing was tested, so there is nothing to report
}

// ─── Odds and activity, from what MoversPanel already had ───────────────────

/** How far a battle's win probability travelled in the window. */
function oddsEvent(battle, windowHours) {
    const trail = Array.isArray(battle?.oddsSeries) ? battle.oddsSeries : [];
    if (trail.length < 2) return null;
    const cut = Date.now() - windowHours * HOUR;
    const inWindow = trail.filter((d) => new Date(d?.t || 0).getTime() >= cut);
    if (inWindow.length < 2) return null;

    const from = Math.round(Number(inWindow[0].p));
    const to = Math.round(Number(inWindow[inWindow.length - 1].p));
    const delta = to - from;
    // Under three points is noise on a line sampled every few hours, and a
    // feed that reports noise trains people to scroll past it.
    if (!Number.isFinite(delta) || Math.abs(delta) < 3) return null;

    const rival = (battle.sides || []).find((s) => !s.isMe);
    const seed = `${battle.kind}:${battle.id}:${to}`;
    const up = delta > 0;
    return {
        id: `odds:${battle.kind}:${battle.id}:${to}`,
        at: new Date(inWindow[inWindow.length - 1].t),
        kind: "odds_move",
        tone: up ? "win" : "loss",
        battle,
        battleRef: { kind: battle.kind, id: battle.id },
        actor: null,
        involvesMe: true,
        reactable: false,
        stat: `${to}%`,
        headline: up
            ? pick([
                `Your price in ${battle.title || "that battle"} is climbing.`,
                `${battle.title || "That battle"} is swinging your way.`,
            ], seed)
            : pick([
                `${rival ? firstName(rival.name) : "Someone"} is closing on you in ${battle.title || "that battle"}.`,
                `Your price in ${battle.title || "that battle"} is sliding.`,
            ], seed),
        detail: `${from}% → ${to}% · ${up ? "+" : ""}${delta} in ${windowHours}h`,
    };
}

/** A rival turning up. The ticker is already loaded; it was just never a feed. */
function activityEvent(e, battle) {
    if (!e?.email || !e?.at) return null;
    const who = firstName(e.name || e.username);
    const what = SOURCE_LABEL[e.source] || "some study";
    const seed = `${e.email}:${e.at}`;
    return {
        id: `act:${e.email}:${e.at}`,
        at: new Date(e.at),
        kind: "rival_activity",
        tone: "neutral",
        battle,
        battleRef: battle ? { kind: battle.kind, id: battle.id } : null,
        actor: { name: e.name || e.username, email: e.email, isMe: false },
        involvesMe: false,
        reactable: true,
        headline: pick([
            `${who} has been at it — ${what}.`,
            `${who} just put ${what} on the board.`,
            `${who} is not sitting still. ${what[0].toUpperCase()}${what.slice(1)}.`,
        ], seed),
        detail: e.xp ? `+${e.xp} XP` : null,
    };
}

/** A battle finishing. Currently this is a toast and then nothing. */
function settledEvent(battle, myEmail) {
    if (!battle || battle.status !== "completed") return null;
    const sides = [...(battle.sides || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
    const winner = sides[0];
    if (!winner) return null;
    const iWon = winner.isMe || winner.email === myEmail;
    const seed = `${battle.kind}:${battle.id}:done`;
    return {
        id: `settled:${battle.kind}:${battle.id}`,
        at: new Date(battle.endsAt || battle.updated_date || battle.created_date || 0),
        kind: "battle_settled",
        tone: iWon ? "win" : "neutral",
        battle,
        battleRef: { kind: battle.kind, id: battle.id },
        actor: { name: winner.name, email: winner.email, isMe: !!winner.isMe },
        involvesMe: (battle.sides || []).some((s) => s.isMe),
        reactable: true,
        headline: iWon
            ? pick([`You took ${battle.title || "it"}.`, `${battle.title || "That one"} is yours.`], seed)
            : `${firstName(winner.name)} took ${battle.title || "it"}.`,
        detail: sides.length > 1 ? `${Math.round(winner.score || 0)} to ${Math.round(sides[1].score || 0)}` : null,
    };
}

// ─── The feed ───────────────────────────────────────────────────────────────

/**
 * Build the timeline.
 *
 * A LIVE CALL-OUT ALWAYS SORTS FIRST, whatever its timestamp. It is the only
 * item on the page with a clock running on somebody's behalf, and burying it
 * under a fresher odds tick is how a student forfeits one they would have
 * answered. Everything else is newest-first, which is what a feed means.
 */
export function competeFeed({
    callouts = [], battles = [], ticker = [], myEmail = null,
    windowHours = 24, limit = 24,
} = {}) {
    const events = [];

    (callouts || []).forEach((c) => {
        const e = calloutEvent(c, myEmail);
        if (e) events.push(e);
    });

    const live = (battles || []).filter((b) => b?.status === "active");
    live.forEach((b) => {
        const e = oddsEvent(b, windowHours);
        if (e) events.push(e);
    });

    (battles || []).forEach((b) => {
        const e = settledEvent(b, myEmail);
        if (e) events.push(e);
    });

    // Only rivals who are actually racing you. A stranger's flashcard session
    // is not news, and the ticker is site-wide.
    const battleFor = new Map();
    live.forEach((b) => (b.sides || []).forEach((s) => {
        if (!s.isMe && s.email && !battleFor.has(s.email)) battleFor.set(s.email, b);
    }));
    (ticker || []).forEach((t) => {
        if (!t?.email || t.email === myEmail || !battleFor.has(t.email)) return;
        const e = activityEvent(t, battleFor.get(t.email));
        if (e) events.push(e);
    });

    const seen = new Set();
    const deduped = events.filter((e) => {
        if (!e?.id || seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
    });

    deduped.sort((a, b) => {
        if (!!a.urgent !== !!b.urgent) return a.urgent ? -1 : 1;
        return new Date(b.at || 0) - new Date(a.at || 0);
    });

    return deduped.slice(0, limit);
}

/**
 * The people you are actually racing, with the head-to-head that makes a
 * rivalry a rivalry.
 *
 * Derived from rows already loaded, so it cannot go stale or disagree with the
 * feed it sits above — the rule `redoQueue` and `subjectHub` both follow.
 */
export function rivalries({ battles = [], callouts = [], myEmail = null } = {}) {
    const by = new Map();
    const touch = (email, name) => {
        if (!email || email === myEmail) return null;
        if (!by.has(email)) {
            by.set(email, { email, name, wins: 0, losses: 0, live: 0, calledMe: 0, iCalled: 0, gap: null });
        }
        const r = by.get(email);
        if (!r.name && name) r.name = name;
        return r;
    };

    (battles || []).forEach((b) => {
        const mine = (b.sides || []).find((s) => s.isMe);
        (b.sides || []).forEach((s) => {
            const r = touch(s.email, s.name);
            if (!r) return;
            if (b.status === "active") {
                r.live += 1;
                if (mine && typeof mine.score === "number" && typeof s.score === "number") {
                    const g = Math.round(mine.score - s.score);
                    // Keep the CLOSEST live gap: that is the race still worth
                    // watching, and a blowout elsewhere should not stand in
                    // for it.
                    if (r.gap == null || Math.abs(g) < Math.abs(r.gap)) r.gap = g;
                }
            } else if (b.status === "completed" && mine) {
                const won = (mine.score || 0) >= (s.score || 0);
                if (won) r.wins += 1; else r.losses += 1;
            }
        });
    });

    (callouts || []).forEach((c) => {
        if (c?.caller_email === myEmail) { const r = touch(c.target_email, c.target_name); if (r) r.iCalled += 1; }
        if (c?.target_email === myEmail) { const r = touch(c.caller_email, c.caller_name); if (r) r.calledMe += 1; }
    });

    return [...by.values()]
        // A live race beats a finished one; then the closest gap; then the
        // longest history. Somebody you are level with right now is the person
        // you came to this page about.
        .sort((a, b) => (b.live - a.live)
            || (Math.abs(a.gap ?? 999) - Math.abs(b.gap ?? 999))
            || ((b.wins + b.losses) - (a.wins + a.losses)))
        .slice(0, 6);
}

/** Attempts that count as a rival "turning up", for the ticker. */
export const isRealSit = (a) => !!a && !isRetryAttempt(a);
