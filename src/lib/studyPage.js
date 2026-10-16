/**
 * studyPage — what the Study page says before the tool: the ONE next step, a
 * live fact under each technique, and today's minutes.
 *
 * ─── THE PAGE NAMED THE TECHNIQUE THREE TIMES AND THE NEXT STEP NOT AT ALL ──
 * It opened on "Six techniques to make studying actually work" — a pitch, read
 * by somebody who had already arrived — then a "Selected technique" card, then
 * six pastel tiles, then the tool's own header card. The tool began ~730px down
 * on a laptop and ~1,200px down on a phone, and the one thing the page had
 * worked out (what is worth doing NOW) was a "Top pick" badge in the corner of
 * one tile. So the heading is that step now, with a button, and the switcher
 * under it says one true thing about each technique rather than a slogan.
 *
 * ─── EVERY FACT IS COUNTED, AND A FACT THAT CANNOT BE COUNTED IS NOT SAID ───
 * "14 ready" is `isReady` over the deck; "SAC in 3 days" is the planner's own
 * row; "2 days ago" is the last row the technique wrote. Where the rows cannot
 * answer — the read is capped at 50, so a technique missing from a full read
 * may simply be older than it — the fact falls back to what the technique IS,
 * never to "Not tried yet", which would be a claim about somebody's history
 * made off a truncated list.
 *
 * ─── DAYS ARE LOCAL ─────────────────────────────────────────────────────────
 * `differenceInDays(dueDate, now)` counts whole 24-hour spans, so at 3pm an
 * assessment due TOMORROW is 9 hours away, floors to 0, and the page announced
 * "Exam today". Every day here is a local calendar day (`dayKey`), and the gap
 * between two of them is counted on the calendar.
 *
 * Minutes come through `studyEvents`, which reads BOTH tables study lands in —
 * the trap CLAUDE.md records three times.
 */
import { studyEvents, dayKey, weekStart } from "./studyLog.js";

export const TECHNIQUE_IDS = ["pomodoro", "spaced_repetition", "active_recall", "blurting", "exam", "mind_map"];

export const TECHNIQUE_NAMES = {
    pomodoro: "Pomodoro",
    spaced_repetition: "Spaced Repetition",
    active_recall: "Active Recall",
    blurting: "Blurting",
    exam: "Revision Mode",
    mind_map: "Mind Maps",
};

/** What a technique IS, for when nothing live can be said about it. */
export const FALLBACK_FACT = {
    pomodoro: "25-min blocks",
    spaced_repetition: "Flashcards",
    active_recall: "Test yourself",
    blurting: "Write it all out",
    exam: "Timed mock",
    mind_map: "Map a topic",
};

/** The techniques whose sessions are logged under their own name. */
const LOGGED = new Set(["pomodoro", "active_recall", "blurting", "mind_map", "spaced_repetition"]);

/** Fewer ready cards than this is not worth leading the page with. */
export const READY_NUDGE = 5;

/** An assessment this close outranks what the student said today was for. */
export const DEADLINE_URGENT = 3;
/** And this close, it outranks a pile of cards. */
export const DEADLINE_SOON = 7;
/** How far ahead the Revision Mode tab mentions one at all. */
export const DEADLINE_SHOWN = 14;

/** The read cap Study.jsx uses on study_techniques. */
export const TECHNIQUE_READ_LIMIT = 50;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" → local midnight, or null. The shape is checked, not the length. */
function localDay(s) {
    const m = DAY_RE.exec(String(s ?? "").slice(0, 10));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    // `new Date(2026, 1, 31)` is quietly 3 March. A day that does not survive
    // the round trip was never a day.
    if (Number.isNaN(d.getTime()) || dayKey(d) !== m[0]) return null;
    return d;
}

/**
 * Calendar days from today to `day`. Negative is the past; null when `day` is
 * not a day. Rounded rather than floored, so a daylight-saving change — a
 * 23- or 25-hour day — still counts as one.
 */
export function daysUntil(day, now = new Date()) {
    const target = localDay(day);
    if (!target) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - today) / 86400000);
}

/** "2h 15m", "45m", "0m". */
export function fmtMinutes(m) {
    const n = Math.max(0, Math.round(Number(m) || 0));
    const h = Math.floor(n / 60);
    const mm = n % 60;
    if (h === 0) return `${mm}m`;
    return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

/** Today's minutes and this week's (Monday-anchored), across both tables. */
export function minutesSummary(sessions = [], techniques = [], now = new Date()) {
    const today = dayKey(now);
    const monday = dayKey(weekStart(now));
    let todayMins = 0;
    let weekMins = 0;
    for (const e of studyEvents(sessions, techniques)) {
        // A row dated ahead of today is not study that has happened.
        if (!DAY_RE.test(e.day) || e.day > today) continue;
        if (e.day === today) todayMins += e.minutes;
        if (e.day >= monday) weekMins += e.minutes;
    }
    return { today: Math.round(todayMins), week: Math.round(weekMins) };
}

/** The soonest assessment still ahead (today counts), as `{ days, title }`. */
export function nextDeadline(assessments = [], now = new Date()) {
    let best = null;
    for (const a of Array.isArray(assessments) ? assessments : []) {
        if (a?.is_completed) continue;
        const days = daysUntil(a?.due_date, now);
        if (days == null || days < 0) continue;
        if (!best || days < best.days) best = { days, title: String(a.title || "Your assessment").trim() };
    }
    return best;
}

/** The row's day, or "". `date` is authoritative, `created_date` the fallback. */
const rowDay = (r) => {
    const s = String(r?.date || r?.created_date || "").slice(0, 10);
    return DAY_RE.test(s) ? s : "";
};

/**
 * One technique held ≥70% of at least four sessions in the last seven days,
 * or null. That is a habit worth naming; three sessions is a coincidence.
 */
export function dominantTechnique(techniques = [], now = new Date()) {
    const today = dayKey(now);
    const counts = {};
    let total = 0;
    for (const t of Array.isArray(techniques) ? techniques : []) {
        const day = rowDay(t);
        if (!day || day > today) continue;
        const gap = daysUntil(day, now);
        if (gap == null || gap < -6) continue;
        const id = t.technique_name || "pomodoro";
        counts[id] = (counts[id] || 0) + 1;
        total += 1;
    }
    if (total < 4) return null;
    const [id, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [];
    return id && n / total >= 0.7 ? id : null;
}

function agoLabel(days) {
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.round(days / 7)} weeks ago`;
    return "A while ago";
}

function sacLabel(days) {
    if (days === 0) return "SAC today";
    if (days === 1) return "SAC tomorrow";
    return `SAC in ${days} days`;
}

/**
 * The fact printed under each technique's name in the switcher.
 *
 * Returns `{ [id]: { text, live } }` — `live` is false when the text is only
 * the technique's description, so the strip can set it quieter.
 */
export function techniqueFacts({
    techniques = [],
    ready = 0,
    deckCards = 0,
    deadline = null,
    now = new Date(),
    truncated = false,
} = {}) {
    const today = dayKey(now);
    const minsToday = {};
    const last = {};
    for (const t of Array.isArray(techniques) ? techniques : []) {
        const id = t?.technique_name;
        if (!LOGGED.has(id)) continue;
        const day = rowDay(t);
        if (!day || day > today) continue;
        if (day === today) minsToday[id] = (minsToday[id] || 0) + (Number(t.session_duration) || 0);
        if (!last[id] || day > last[id]) last[id] = day;
    }

    const out = {};
    for (const id of TECHNIQUE_IDS) {
        let text = "";
        if (id === "spaced_repetition") {
            const n = Math.max(0, Math.round(Number(ready) || 0));
            if (n > 0) text = `${n} ready`;
            else if (Number(deckCards) > 0) text = "All caught up";
            else text = "No decks yet";
        } else if (id === "exam") {
            if (deadline && deadline.days >= 0 && deadline.days <= DEADLINE_SHOWN) text = sacLabel(deadline.days);
        } else if (minsToday[id] > 0) {
            text = `${fmtMinutes(minsToday[id])} today`;
        } else if (last[id]) {
            text = agoLabel(daysUntil(last[id], now) * -1);
        } else if (!truncated) {
            // Only claimable when the read was COMPLETE — a full read may just
            // have stopped before this technique's last session.
            text = "Not tried yet";
        }
        out[id] = text ? { text, live: true } : { text: FALLBACK_FACT[id], live: false };
    }
    return out;
}

/** Morning / Afternoon / Evening / Late night, on the student's own clock. */
export function greetingFor(hour) {
    if (hour < 5) return "Late night";
    if (hour < 12) return "Morning";
    if (hour < 17) return "Afternoon";
    if (hour < 21) return "Evening";
    return "Late night";
}

const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

function deadlineStep(deadline) {
    const { days, title } = deadline;
    const when = days === 0 ? "is today" : days === 1 ? "is tomorrow" : `is in ${days} days`;
    return {
        id: "deadline",
        tab: "exam",
        title: `${title} ${when}.`,
        sub: "A timed mock from your own cards and quizzes shows what is still shaky.",
        cta: "Open Revision Mode",
    };
}

/**
 * The one thing the page leads with. Ranked, in this order, and each rule is a
 * sentence a student could check:
 *
 *   1. a focus block already running — the page is about to open on it anyway;
 *   2. an assessment inside DEADLINE_URGENT days;
 *   3. what they SAID today was for, until they have done that much — their
 *      own word beats our guess, which is the whole point of asking;
 *   4. an assessment inside DEADLINE_SOON days;
 *   5. at least READY_NUDGE cards ready;
 *   6. nothing yet today → the easiest start;
 *   7. one technique has been most of the week → a different one;
 *   8. some today, under an hour → another block;
 *   9. an hour or more → nothing to push. `cta` is null and no button draws.
 *
 * EVERY BUTTON NAMES WHERE IT GOES, never a thing it does not do. The button
 * opens the technique and scrolls to it; it does not start the timer or build
 * a session, so it may not say "Start". A suggestion that says it will build
 * the thing has to build it — `startFromSuggestion`'s rule — and the honest
 * way to keep it is to promise only the door.
 */
export function nextStep({
    todayMins = 0,
    ready = 0,
    deadline = null,
    intent = null,
    timerLive = false,
    dominant = null,
} = {}) {
    if (timerLive) {
        return {
            id: "timer", tab: "pomodoro",
            title: "Your focus block is still running.",
            sub: "Pick it up where you left it.",
            cta: "Back to the timer",
        };
    }
    if (deadline && deadline.days >= 0 && deadline.days <= DEADLINE_URGENT) return deadlineStep(deadline);

    const intentTab = intent?.plan?.technique;
    const intentOpen = intent && (Number(intent.duration) || 0) > todayMins;
    if (intentOpen && intentTab === "pomodoro") {
        return {
            id: "intent", tab: "pomodoro",
            title: "You said today is for homework.",
            sub: "A 25-minute focus block is the way in.",
            cta: "Open the timer",
        };
    }
    if (intentOpen && intentTab === "active_recall") {
        return {
            id: "intent", tab: "active_recall",
            title: "You said you're cramming.",
            sub: "Testing yourself shows what is still missing. Re-reading only feels like it does.",
            cta: "Open Active Recall",
        };
    }
    // Free study points at the cards, which is a dead end with none ready.
    if (intentOpen && intentTab === "spaced_repetition" && ready > 0) {
        return {
            id: "intent", tab: "spaced_repetition",
            title: "Free study today.",
            sub: `${ready} ${plural(ready, "card is", "cards are")} ready. A short review is the best start.`,
            cta: "Open your decks",
        };
    }

    if (deadline && deadline.days >= 0 && deadline.days <= DEADLINE_SOON) return deadlineStep(deadline);

    if (ready >= READY_NUDGE) {
        return {
            id: "cards", tab: "spaced_repetition",
            title: `${ready} cards are ready to review.`,
            sub: "A short session now keeps them from piling up.",
            cta: "Open your decks",
        };
    }
    if (todayMins <= 0) {
        return {
            id: "start", tab: "pomodoro",
            title: "A 25-minute focus block is the easiest start.",
            sub: "Pick a topic, start the timer, and stop when it rings.",
            cta: "Open the timer",
        };
    }
    if (dominant && TECHNIQUE_NAMES[dominant]) {
        const tab = dominant === "active_recall" ? "blurting" : "active_recall";
        return {
            id: "mix", tab,
            title: `Try ${TECHNIQUE_NAMES[tab]} next.`,
            sub: `Most of this week was ${TECHNIQUE_NAMES[dominant]}. A different technique is what the breadth part of your ATAR counts.`,
            cta: `Open ${TECHNIQUE_NAMES[tab]}`,
        };
    }
    if (todayMins < 60) {
        return {
            id: "stack", tab: "pomodoro",
            title: `${fmtMinutes(todayMins)} in today. Stack another block?`,
            sub: "Another 25 minutes while you are warmed up.",
            cta: "Open the timer",
        };
    }
    return {
        id: "done", tab: null,
        title: `${fmtMinutes(todayMins)} in today. Good work.`,
        sub: "Keep going with anything below, or call it a day.",
        cta: null,
    };
}
