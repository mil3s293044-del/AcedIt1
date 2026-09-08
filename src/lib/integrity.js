/**
 * integrity — what a claim has to survive before it counts against anybody else.
 *
 * ─── The three holes this closes ────────────────────────────────────────────
 *
 *   FABRICATED TIME.  `duration_minutes` and `session_duration` arrive from the
 *                     client, and the hours leaderboard summed them raw — no
 *                     elapsed check, no daily cap. A POST of 600 minutes went
 *                     straight to the top of the board. The ATAR's effort
 *                     component already caps its own days for exactly this
 *                     reason; the board had no equivalent.
 *   IDLE FARMING.     `awardXP` accepts `idle_ratio`, `tab_away_count` and
 *                     `session_complete`, and `calcFocusTimerXP` destructured
 *                     only `duration_minutes`. The anti-farming telemetry was
 *                     collected and thrown away — "collect nothing you don't
 *                     use", inverted, in the one place built to stop this.
 *   TRIVIAL QUIZZES.  Write a five-question quiz on your easiest topic, score
 *                     100%, repeat. Nothing distinguished that from a real sit.
 *
 * ─── The posture is DISCOUNT, never ACCUSE ──────────────────────────────────
 * Every rule here reduces what a claim is worth rather than flagging a person.
 * A student who studied honestly never notices any of it; a student inflating
 * their hours simply finds the inflation is not worth anything. That is a much
 * better place to end up than an app that calls a sixteen-year-old a cheat on
 * the basis of a heuristic, and it is the only version that can be wrong
 * occasionally without doing harm.
 */

import { dayKey } from "@/lib/studyLog";

// ─── Time ───────────────────────────────────────────────────────────────────

/** A single sitting. Beyond this, one row is not one session. */
export const SESSION_MAX_MINUTES = 240;

/** Everything logged in one day, however many sessions it came from. */
export const DAILY_MINUTE_CAP = 720;

const MIN = 60 * 1000;

const minutesOf = (row) => {
    const n = Number(row?.duration_minutes ?? row?.session_duration ?? row?.minutes);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * How much of a session's focus actually counted, and why.
 *
 * `idle_ratio` is the share of the session the timer sat idle; `tab_away_count`
 * is how many times the student left. Both are ALREADY SENT and were ignored.
 *
 * Tab-aways are charged a flat minute each rather than a proportion, because a
 * glance at a message is a fixed interruption whatever the session's length,
 * and charging a proportion would punish a long honest session for the same
 * behaviour that costs a short one almost nothing.
 */
export const TAB_AWAY_MINUTES = 1;

export function focusQuality(row = {}) {
    const claimed = minutesOf(row);
    const idle = Math.min(1, Math.max(0, Number(row.idle_ratio) || 0));
    const aways = Math.max(0, Math.round(Number(row.tab_away_count) || 0));

    const afterIdle = claimed * (1 - idle);
    const counted = Math.max(0, afterIdle - aways * TAB_AWAY_MINUTES);

    const reasons = [];
    if (idle > 0.02) reasons.push(`${Math.round(idle * 100)}% idle`);
    if (aways > 0) reasons.push(`${aways} tab switch${aways === 1 ? "" : "es"}`);

    return {
        claimed,
        counted: Math.round(counted),
        // Null rather than an empty string: "nothing was discounted" and "we
        // have no telemetry" both produce no reason, and only the first should
        // read as a clean session.
        reason: reasons.length ? reasons.join(" · ") : null,
        discounted: Math.round(claimed - counted),
    };
}

/**
 * Countable minutes per day, from any mix of the two study tables.
 *
 * ─── YOU CANNOT HAVE STUDIED MORE MINUTES TODAY THAN HAVE PASSED TODAY ──────
 * That is the whole elapsed check, and it needs no new column and no client
 * cooperation: today's claims are capped by the minutes since local midnight.
 * It catches the actual attack — ten POSTs of 120 minutes inside one second —
 * exactly, and it is trivially explainable to anyone who asks.
 *
 * Past days get the flat daily cap instead. The app cannot know when a row was
 * really earned once the day is over, and a cap is the honest limit of what it
 * can assert.
 *
 * Returns a Map of dayKey → { claimed, counted, capped }.
 */
export function countableByDay(rows = [], now = new Date()) {
    const byDay = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
        const day = String(row?.day || row?.date || row?.created_date || "").slice(0, 10);
        if (!day) return;
        const q = focusQuality(row);
        // One row can never be more than one sitting.
        const counted = Math.min(q.counted, SESSION_MAX_MINUTES);
        const cur = byDay.get(day) || { claimed: 0, counted: 0, capped: false };
        cur.claimed += q.claimed;
        cur.counted += counted;
        byDay.set(day, cur);
    });

    const today = dayKey(now instanceof Date ? now : new Date(now));
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const elapsedToday = Math.max(0, (new Date(now).getTime() - midnight.getTime()) / MIN);

    byDay.forEach((v, day) => {
        const ceiling = day === today
            ? Math.min(DAILY_MINUTE_CAP, elapsedToday)
            : DAILY_MINUTE_CAP;
        if (v.counted > ceiling) {
            v.capped = true;
            v.counted = Math.round(ceiling);
        } else {
            v.counted = Math.round(v.counted);
        }
    });

    return byDay;
}

/** Total countable minutes across a set of rows. What a board may sum. */
export function countableMinutes(rows = [], now = new Date()) {
    let total = 0;
    countableByDay(rows, now).forEach((v) => { total += v.counted; });
    return total;
}

// ─── Quizzes ────────────────────────────────────────────────────────────────

/**
 * A quiz has to be worth sitting before a sit of it counts competitively.
 *
 * Practice is not affected by any of this — a three-question warm-up is a
 * perfectly good thing to do and still scores, still feeds the deck, still
 * pays XP. This governs LEADERBOARDS only, where a five-question quiz on your
 * easiest topic scored 100% sits beside somebody's real paper.
 */
export const BOARD_MIN_QUESTIONS = 8;
export const BOARD_MIN_MARKS = 12;

export function quizCountsForBoard(quiz) {
    const qs = Array.isArray(quiz?.questions) ? quiz.questions : [];
    if (qs.length < BOARD_MIN_QUESTIONS) return { ok: false, why: "too short" };
    const marks = qs.reduce((sum, q) => {
        const m = Number(q?.marks);
        // An MCQ with no stated allocation is one mark, which is what
        // normaliseQuestion resolves it to everywhere else.
        return sum + (Number.isFinite(m) && m > 0 ? m : 1);
    }, 0);
    if (marks < BOARD_MIN_MARKS) return { ok: false, why: "too few marks" };
    return { ok: true, marks, questions: qs.length };
}

/**
 * The sits a board may read: the FIRST real sit of each qualifying quiz.
 *
 * First rather than best, and once rather than every time. Sitting one easy
 * quiz twenty times should not out-rank sitting a hard one once, and picking
 * the best sit rewards grinding the same paper until a good roll comes up —
 * the same "wait for a result you like" shape the forecast settlement refuses.
 *
 * Retries are excluded before any of that, because a wrong-only retry is on a
 * different scale by construction.
 */
export function boardSits(attempts = [], quizzesById = new Map(), isRetry = () => false) {
    const byQuiz = new Map();
    (Array.isArray(attempts) ? attempts : [])
        .filter((a) => a && !isRetry(a))
        .sort((a, b) => new Date(a?.created_date || 0) - new Date(b?.created_date || 0))
        .forEach((a) => {
            const quiz = quizzesById.get?.(a.quiz_id) ?? quizzesById[a.quiz_id];
            if (!quiz || !quizCountsForBoard(quiz).ok) return;
            if (!byQuiz.has(a.quiz_id)) byQuiz.set(a.quiz_id, a);
        });
    return [...byQuiz.values()];
}

// ─── Verification ───────────────────────────────────────────────────────────

/**
 * Hours split into what has been PROVEN and what has only been claimed.
 *
 * ─── Nobody is accused, and that is the design ──────────────────────────────
 * The board does not hide unverified hours, mark them suspicious, or rank them
 * lower. It draws them differently. Verifying is a flex — you passed a quiz on
 * what you said you studied — rather than a defence against an accusation, so
 * the mechanism is something a student wants to use rather than something that
 * happens to them.
 *
 * A verification covers a WINDOW, not a session, because a student proves they
 * know a topic rather than that a particular row is real. `covers` is the span
 * either side of the verification that its proof extends over.
 */
export const VERIFY_COVERS_HOURS = 48;

export function verifiedSplit(rows = [], verifications = [], now = new Date()) {
    // A `callouts` row carries `status`, not a boolean. Checking only for
    // `passed !== false` treated a row with status "failed" as a pass, because
    // its `passed` field is simply absent — the exact shape of bug that turns a
    // verification system into a rubber stamp. Status is checked FIRST and an
    // unrecognised one verifies nothing.
    const isPass = (v) => {
        if (typeof v?.status === "string") return v.status === "passed";
        return v?.passed === true;
    };

    const passes = (Array.isArray(verifications) ? verifications : [])
        .filter((v) => v && isPass(v) && (v.created_date || v.at))
        .map((v) => {
            const at = new Date(v.created_date || v.at).getTime();
            // A call-out row carries the span its questions were BUILT from,
            // so a pass proves exactly that window and no heuristic is needed.
            // `VERIFY_COVERS_HOURS` is only the fallback for a verification
            // that arrived without one.
            const from = v.window_start ? new Date(v.window_start).getTime() : null;
            const to = v.submitted_at ? new Date(v.submitted_at).getTime() : at;
            const real = Number.isFinite(from) && Number.isFinite(to);
            return {
                from: real ? Math.min(from, to) : at - VERIFY_COVERS_HOURS * 60 * MIN,
                to: real ? Math.max(from, to) : at + VERIFY_COVERS_HOURS * 60 * MIN,
                subject: v.subject || null,
            };
        })
        .filter((v) => Number.isFinite(v.from) && Number.isFinite(v.to));

    const covered = (row) => {
        const t = new Date(row?.date || row?.day || row?.created_date || 0).getTime();
        if (!Number.isFinite(t)) return false;
        return passes.some((v) => {
            if (v.subject && row?.subject && v.subject !== row.subject) return false;
            return t >= v.from && t <= v.to;
        });
    };

    const list = Array.isArray(rows) ? rows : [];
    const yes = list.filter(covered);
    const no = list.filter((r) => !covered(r));

    return {
        verifiedMinutes: countableMinutes(yes, now),
        unverifiedMinutes: countableMinutes(no, now),
        verifiedCount: yes.length,
        total: list.length,
        // Nothing verified is NOT zero per cent proven in a way worth drawing —
        // it is a student who has never been asked. The board says "unverified"
        // rather than printing a 0% badge at them.
        anyVerified: yes.length > 0,
    };
}
