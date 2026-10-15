/**
 * datePick — the arithmetic behind every date a student picks.
 *
 * ─── THE BROWSER'S DATE INPUT WAS THE FIRST THING A NEW STUDENT TOUCHED ─────
 * The signup wizard's birthday was `<input type="date">`, which on a desktop
 * opens on THIS month — so a sixteen-year-old had to page back about two
 * hundred months, or know that the box takes typing in an order the placeholder
 * does not show. On a phone it is the OS wheel, which is fine on iOS and a
 * month grid with a tiny year menu on Android. Either way it was the one
 * control in the funnel the app had not designed, on the screen where a first
 * impression is formed. The planner's SAC date and session day were the same
 * input, unstyled, inside dialogs that were otherwise the app's own.
 *
 * Two pickers replace them, because the two questions are different shapes:
 *
 *   A BIRTHDAY is three decisions far from today — a day, a month and a year,
 *     and the year is the slow one. `BirthdayPicker` asks for each as a grid,
 *     with the years a student can plausibly have been born in on the first
 *     page.
 *   AN EVENT is one decision near today. `DatePicker` leads with the next few
 *     days as chips and keeps a month grid under them, with what is already on
 *     each day marked so a clash shows before it is made.
 *
 * Everything either of them needs to get RIGHT lives here, pure, so the test
 * can hold it: which days a month has, which week a day sits in, what makes a
 * day/month/year a real date, and which years to offer first.
 *
 * ─── A DAY IS A LOCAL "YYYY-MM-DD", NEVER `toISOString()` ───────────────────
 * `AgeAnswer` capped its input with `new Date().toISOString().slice(0, 10)`,
 * which is UTC — so before 10 or 11 in the morning in Melbourne it was
 * YESTERDAY. `isoOf` is `studyLog`'s `dayKey`, the one local day this codebase
 * already agrees on.
 */

import { dayKey } from "@/lib/studyLog";

export const isoOf = (d) => dayKey(d);

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A "YYYY-MM-DD" as a LOCAL midnight. `new Date("2009-03-15")` is UTC. */
export function dateOf(iso) {
    const m = DAY_RE.exec(String(iso || ""));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    // `new Date(2009, 1, 31)` quietly rolls over to 3 March. A date that does
    // not survive the round trip was never a date.
    return isoOf(d) === `${m[1]}-${m[2]}-${m[3]}` ? d : null;
}

export const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
/** Monday first, like every week this app draws (`studyLog.weekStart`). */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * How many days a month has. `month` is 1–12. With no year, February is 29 —
 * the most it can be, so a day grid shown before the year is known never hides
 * a real birthday on the 29th.
 */
export function daysInMonth(month, year) {
    const m = Number(month);
    if (!Number.isInteger(m) || m < 1 || m > 12) return 31;
    const y = Number.isInteger(Number(year)) && year != null && year !== "" ? Number(year) : 2000;
    return new Date(y, m, 0).getDate();
}

/**
 * Day, month and year to a "YYYY-MM-DD", or null when they do not make a real
 * date. A missing part is null, never a zero — `Number(null) === 0` would turn
 * an unpicked day into the 0th, which rolls back to the last day of the month
 * before and saves a birthday nobody chose.
 */
export function composeIso(day, month, year) {
    if (day == null || month == null || year == null) return null;
    const d = Number(day), m = Number(month), y = Number(year);
    if (![d, m, y].every(Number.isInteger)) return null;
    if (y < 1900 || m < 1 || m > 12 || d < 1 || d > daysInMonth(m, y)) return null;
    const p = (n) => String(n).padStart(2, "0");
    return `${y}-${p(m)}-${p(d)}`;
}

/** The parts of a stored date, each null when absent. */
export function splitIso(iso) {
    const d = dateOf(iso);
    if (!d) return { day: null, month: null, year: null };
    return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

/**
 * Why a day/month/year is not a date yet, in words — or null when it is, or
 * when it simply is not finished. "31 February" is the case worth naming: the
 * student picked a real day and a real month, and a picker that silently
 * refuses the pair looks broken.
 */
export function partsProblem(day, month, year) {
    if (day == null || month == null) return null;
    const max = daysInMonth(month, year);
    if (Number(day) <= max) return null;
    const when = year != null ? `${MONTHS[month - 1]} ${year}` : MONTHS[month - 1];
    return `${when} only has ${max} days.`;
}

/* ─── Years ──────────────────────────────────────────────────────────────── */

/** The first page of years: a VCE student is about 15–18, so 12 to 21. */
export const YEARS_PER_PAGE = 10;
export const YOUNGEST_OFFERED = 12;
export const EARLIEST_YEAR = 1920;

/**
 * The first year on the default page. Twelve years back to twenty-one: wide
 * enough that every VCE student and the twelve-year-old who needs to be
 * refused can find their year without paging, narrow enough to fit two rows.
 */
export function defaultYearPage(today = new Date()) {
    return today.getFullYear() - (YOUNGEST_OFFERED + YEARS_PER_PAGE - 1);
}

/**
 * A page of years starting at `start`, ascending. Paging forward stops at the
 * current year, because nobody was born next year; paging back stops at
 * `EARLIEST_YEAR`.
 */
export function yearPage(start, today = new Date()) {
    const last = today.getFullYear();
    const from = Math.max(EARLIEST_YEAR, Math.min(start, last - YEARS_PER_PAGE + 1));
    const years = [];
    for (let y = from; y < from + YEARS_PER_PAGE && y <= last; y++) years.push(y);
    return {
        years,
        from,
        to: years[years.length - 1],
        canBack: from > EARLIEST_YEAR,
        canForward: from + YEARS_PER_PAGE <= last,
    };
}

/** The page a given year sits on, aligned to the default page's rhythm. */
export function pageFor(year, today = new Date()) {
    const base = defaultYearPage(today);
    // `Number(null) === 0`, which IS an integer — so an unpicked year opened
    // the grid on 1920 (year 0, clamped to the earliest page), and only a
    // screenshot said so. Absent is checked before it is coerced.
    if (year == null || year === "" || !Number.isInteger(Number(year))) return base;
    const k = Math.floor((Number(year) - base) / YEARS_PER_PAGE);
    return base + k * YEARS_PER_PAGE;
}

/* ─── Months ─────────────────────────────────────────────────────────────── */

/**
 * The weeks of a month as rows of seven, Monday first, padded with the days
 * either side so every row is full. `month` is 1–12.
 */
export function monthGrid(year, month) {
    const first = new Date(year, month - 1, 1);
    const lead = (first.getDay() + 6) % 7;              // Monday = 0
    const start = new Date(year, month - 1, 1 - lead);
    const total = Math.ceil((lead + daysInMonth(month, year)) / 7) * 7;
    const weeks = [];
    for (let i = 0; i < total; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        if (i % 7 === 0) weeks.push([]);
        weeks[weeks.length - 1].push({
            iso: isoOf(d),
            day: d.getDate(),
            inMonth: d.getMonth() === month - 1,
        });
    }
    return weeks;
}

/** One month either side, wrapping the year. */
export function shiftMonth({ year, month }, delta) {
    const d = new Date(year, month - 1 + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Whether a day is inside [min, max], either bound optional. */
export function inRange(iso, min, max) {
    if (!dateOf(iso)) return false;
    if (min && iso < min) return false;
    if (max && iso > max) return false;
    return true;
}

/**
 * The next `count` days from `from`, for the chips above an event grid —
 * "Today", "Tomorrow", then the weekday. Every chip is a real, pickable day:
 * anything outside the range is left off rather than drawn disabled, because a
 * row of greyed-out shortcuts is a row of things that do not work.
 */
export function quickDays(from, count = 7, { min, max } = {}) {
    const base = dateOf(from) || new Date();
    const today = isoOf(new Date());
    const out = [];
    for (let i = 0; i < count; i++) {
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
        const iso = isoOf(d);
        if (!inRange(iso, min, max)) continue;
        const offset = Math.round((dateOf(iso) - dateOf(today)) / 86400000);
        out.push({
            iso,
            label: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : WEEKDAYS[(d.getDay() + 6) % 7],
            day: d.getDate(),
        });
    }
    return out;
}

/** "Thursday 15 October 2026", or "" for anything that is not a day. */
export function longLabel(iso, { year = true } = {}) {
    const d = dateOf(iso);
    if (!d) return "";
    const wd = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
    return `${wd} ${d.getDate()} ${MONTHS[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ""}`;
}
