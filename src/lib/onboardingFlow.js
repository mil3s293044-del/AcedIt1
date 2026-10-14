/**
 * onboardingFlow — everything the signup wizard SAYS, derived from its answers.
 *
 * The wizard is a deal: a student answers four questions, Ace reacts to each
 * one with a fact, the deck is "built", and the hand is turned over. Every
 * sentence and every figure on those screens comes out of this file, for the
 * reason `closingFacts` gives on the first-run screen — a number invented to
 * keep a funnel moving teaches a student on their very first screen that the
 * numbers here are decoration, after which the real ones do not land either.
 *
 * So nothing here is a claim about AcedIt that the app cannot back. The weeks
 * are the calendar. The scaling is VTAC's, read out of the catalogue. The
 * review dates come from RUNNING the scheduler the review deck uses. The band
 * is the app's own ladder. And where an answer is missing, the line that would
 * have used it is DROPPED rather than printed with a hole in it.
 *
 * It is a .js and not inside a component because the test loader will not
 * resolve a .jsx — the move `xpRanks.js`, `sm2.js` and `spark.js` each made.
 */
import { calculateNextReview } from "./sm2.js";
import { VCE_SUBJECTS } from "../data/vceSubjects.js";
import { scalingOf } from "./subjectBrowse.js";
import { atarBandOf } from "./atarBands.js";
import { suitFor, colorFor } from "../components/cards/cardIdentity.js";

/* ── The steps ─────────────────────────────────────────────────────────────── */

/**
 * Seven screens, and the ONE count the flow prints is the position in this
 * list. The old wizard printed three at once — the header said "/6" while the
 * eyebrows said "1 of 3", then "2 of 4", then "3 of 3" — so a student could
 * not tell how far through they were from the screen that existed to tell
 * them. Eyebrows are names now, never counts.
 */
export const STEPS = ["year", "birthday", "subjects", "target", "build", "reveal", "signin"];

/**
 * An existing student retaking the setup from Settings skips the build: the
 * four seconds of theatre are the moment a NEW deck is assembled, and somebody
 * editing their subjects is not waiting for one.
 */
export function stepsFor({ existingUser = false } = {}) {
    return existingUser ? STEPS.filter((s) => s !== "build") : STEPS;
}

/** What each screen is called. A name, so it can never disagree with a count. */
/**
 * Where Back goes. Never onto the build: it is four seconds of shuffling that
 * plays itself, so landing on it means watching it again to reach the target
 * you wanted to change — a penalty for changing your mind.
 */
export function prevStep(steps = STEPS, index = 0) {
    let j = Math.max(0, index - 1);
    if (steps[j] === "build") j = Math.max(0, j - 1);
    return j;
}

export const STEP_NAME = {
    year: "Your year",
    birthday: "Your birthday",
    subjects: "Your subjects",
    target: "Your target",
    build: "Building your deck",
    reveal: "Your hand",
    signin: "Last step",
};

/* ── The calendar ──────────────────────────────────────────────────────────── */

/**
 * When the exams this student is working toward actually are.
 *
 * VCE written exams run from late October; Units 1 and 2 exams sit in
 * November; junior years finish out the school year in December. Computed
 * against the current date rather than hard-coded, so the number is right in
 * March and still right in September, and it rolls to next year once the date
 * has passed rather than counting backwards.
 */
export function weeksUntilExams(yearLevel, now = new Date()) {
    const senior = /Year 12/.test(yearLevel || "");
    const eleven = /Year 11/.test(yearLevel || "");
    // Month is 0-indexed: 9 = October, 10 = November, 11 = December.
    const [month, day] = senior ? [9, 25] : eleven ? [10, 5] : [11, 12];

    let target = new Date(now.getFullYear(), month, day);
    if (target <= now) target = new Date(now.getFullYear() + 1, month, day);

    // Never zero: a student four days out is in their last week, and "0 weeks"
    // reads as the exams having already happened.
    const weeks = Math.max(1, Math.round((target - now) / (7 * 86400000)));
    const label = senior
        ? "until VCE written exams start"
        : eleven
            ? "until end-of-year exams"
            : "until the end of the school year";
    return { weeks, label };
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ── The review ladder ─────────────────────────────────────────────────────── */

/**
 * The days a topic comes back, if it is answered well every time.
 *
 * DERIVED BY RUNNING THE SCHEDULER, never typed. The reveal used to print
 * "Day 1 · 3 · 8 · 14" under a comment saying they were "the intervals the
 * app's own spaced repetition actually walks", and that "a ladder invented for
 * the graphic would disagree with the schedule the student meets on day two".
 * It did. `calculateNextReview` rated Good gives intervals of 1, 3, 7 and 16,
 * so the reviews land on days 1, 4, 11 and 27 — and the moment a student met
 * their second review, the screen that sold them the schedule was wrong about
 * it. This walks the real function, so it moves if the scheduler does.
 */
export function reviewLadder(count = 4, quality = 3) {
    let card = {};
    let day = 0;
    const days = [];
    for (let i = 0; i < count; i += 1) {
        const next = calculateNextReview(quality, card);
        day += next.interval_days;
        days.push(day);
        card = { ...card, ...next };
    }
    return days;
}

export const REVIEW_LADDER = reviewLadder();

/** The ladder as real dates from `now`, so a student reads a Thursday rather than a day number. */
export function reviewDates(now = new Date(), ladder = REVIEW_LADDER) {
    return ladder.map((d) => {
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        at.setDate(at.getDate() + d);
        return at;
    });
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Thu 15 Oct" — the month only where it changes, so four dates fit one line. */
export function formatReviewDates(dates = []) {
    return dates.map((d, i) => {
        const showMonth = i === dates.length - 1 || dates[i + 1].getMonth() !== d.getMonth();
        return `${WEEKDAY[d.getDay()]} ${d.getDate()}${showMonth ? ` ${MONTH[d.getMonth()]}` : ""}`;
    }).join(" · ");
}

/* ── Scaling ───────────────────────────────────────────────────────────────── */

/**
 * Join the picked subjects to the catalogue and read VTAC's scaling off them.
 *
 * Matched on code first and name second, because a custom subject the student
 * typed can collide on neither and must fall through to the unscaled list.
 * The factor is read through `scalingOf` — the browse page's parser — because
 * the wizard used to carry a second one, and two parsers for one number agree
 * only until somebody adds a decimal to the catalogue.
 */
export function scalingFor(picked = []) {
    const scaled = [];
    const unscaled = [];
    (picked || []).forEach((p) => {
        const cat = VCE_SUBJECTS.find(
            (v) => (p?.code && v.code === p.code) || v.name === p?.name);
        const f = scalingOf(cat);
        if (cat && f != null) {
            scaled.push({
                name: cat.name,
                factor: f,
                mean: cat.scaling_info?.mean_study_score ?? null,
                note: cat.scaling_info?.scaling_description || "",
                color: colorFor(cat.name),
            });
        } else if (p?.name) {
            unscaled.push(p.name);
        }
    });
    scaled.sort((a, b) => b.factor - a.factor);
    return { scaled, unscaled };
}

const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "±0");

/* ── Names that fit on a card ──────────────────────────────────────────────── */

/**
 * The long catalogue names, as they are actually said.
 *
 * A card in the hand is 62px wide and the label is two lines of 7.5px type, so
 * "Mathematical Methods" broke as "Mathem / atical Methods" and "Chemistry" as
 * "Chemistr / y" — a label cut mid-word reads as a rendering fault. These are
 * the names students use in a corridor, which is the right register for a
 * card in their hand anyway.
 */
const SHORT = {
    "Mathematical Methods": "Methods",
    "Specialist Mathematics": "Specialist",
    "General Mathematics": "General",
    "English Language": "Eng Lang",
    "English (EAL)": "EAL",
    "Environmental Science": "Enviro",
    "History: Revolutions": "Revs",
    "Australian History": "Aus History",
    "Legal Studies": "Legal",
    "Australian and Global Politics": "Politics",
    "Business Management": "Business",
    "Visual Communication Design": "VCD",
    "Art Making and Exhibiting": "Art",
    "Music Repertoire Performance": "Music",
    "Software Development": "Software",
    "Data Analytics": "Data",
    "Health and Human Development": "HHD",
    "Physical Education": "PE",
    "Japanese (Second Language)": "Japanese",
    "Chinese (Second Language)": "Chinese",
};

/**
 * The longest WORD a hand card can carry. The rail's overlapped cards show a
 * strip about 46px wide at 7px type, which is ten characters; a label may wrap
 * onto a second line between words, never inside one.
 */
export const SHORT_MAX = 10;

export function shortSubject(name = "") {
    const n = String(name || "").trim();
    if (SHORT[n]) return SHORT[n];
    const fits = (t) => t.split(/\s+/).length <= 2 && t.split(/\s+/).every((w) => w.length <= SHORT_MAX);
    if (fits(n)) return n;
    // A custom subject: the first word that carries meaning, and an ellipsis
    // to say it was cut, rather than a word broken in half.
    const words = n.split(/\s+/).filter((w) => !/^(year|yr|vce|unit|units|the|and|of|\d+)$/i.test(w));
    const first = words[0] || n;
    return first.length <= SHORT_MAX ? first : `${first.slice(0, SHORT_MAX - 1)}…`;
}

/* ── The hand ──────────────────────────────────────────────────────────────── */

/**
 * Seniority, ranked. Years seven to ten are number cards, eleven is a jack and
 * twelve a queen. It stops short of the Ace: the Ace is the target, and handing
 * it out for ticking a box would spend the only card the product has to give.
 *
 * ONE TABLE. The year picker and the hand each kept their own map from year to
 * rank, which is the mirror this codebase keeps deleting. The TONE rides here
 * for the same reason: cool to warm up the years, meaning nothing and not
 * pretending to — it is what stops six white rectangles reading as one, and
 * the card that lands on the table has to be the colour of the one picked.
 */
export const YEARS = [
    { value: "Year 7",            rank: "7",  suit: "club",    tone: "#0EA5E9", label: "Year 7",  sub: "Junior secondary" },
    { value: "Year 8",            rank: "8",  suit: "diamond", tone: "#14B8A6", label: "Year 8",  sub: "Junior secondary" },
    { value: "Year 9",            rank: "9",  suit: "heart",   tone: "#8B5CF6", label: "Year 9",  sub: "Junior secondary" },
    { value: "Year 10",           rank: "10", suit: "club",    tone: "#3B82F6", label: "Year 10", sub: "Senior foundation" },
    { value: "Year 11 Units 1&2", rank: "J",  suit: "diamond", tone: "#F97316", label: "Year 11", sub: "VCE Units 1 & 2" },
    { value: "Year 12 Units 3&4", rank: "Q",  suit: "spade",   tone: "#F0B429", label: "Year 12", sub: "Units 3 & 4 · ATAR year" },
];
export const yearOf = (value) => YEARS.find((y) => y.value === value) || null;
export const yearLabel = (value) => (value ? String(value).replace(/ Units.*$/, "") : "");

/** 96 → "96", 96.35 → "96.35". Trailing zeroes on an ATAR read as a typo. */
export function formatAtar(n) {
    const v = Number(n);
    return v.toFixed(v % 1 === 0 ? 0 : 2);
}

export const GOLD = "#F0B429";

/**
 * The answers so far, in the order they were given, as cards.
 *
 * A pure function of the answers rather than state the steps push into,
 * because the answers persist on every change: a hand built from state would
 * come back empty on a refresh while the answers behind it survived.
 *
 * Every subject is a TWO, and that is the honest bit: rank is mastery
 * everywhere else in the app and nothing has been studied yet.
 */
export function handFrom(answers = {}) {
    const out = [];
    const y = yearOf(answers.yearLevel);
    if (answers.yearLevel) {
        out.push({
            key: "year",
            rank: y?.rank || "Q",
            // The suit of the card they actually picked, so the card that
            // lands in the hand is the card that left the table.
            suit: y?.suit || "spade",
            tone: y?.tone,
            label: yearLabel(answers.yearLevel),
            title: `${answers.yearLevel} — your year, not a mastery rank`,
        });
    }
    (answers.subjects || []).forEach((s) => {
        out.push({
            key: `sub-${s.code || s.id}`,
            rank: "2",
            suit: suitFor(s.name),
            tone: colorFor(s.name),
            label: shortSubject(s.name),
            title: `${s.name} — every subject starts at a two`,
        });
    });
    if (answers.goalAtar) {
        out.push({
            key: "atar",
            rank: "A",
            suit: "spade",
            tone: GOLD,
            label: `ATAR ${formatAtar(answers.goalAtar)}`,
            title: "Your target — the card you are playing for",
            gold: true,
        });
    }
    if (answers.goalCourseName) {
        out.push({
            key: "course",
            rank: "K",
            suit: "diamond",
            label: shortSubject(answers.goalCourseName),
            title: `${answers.goalCourseName}${answers.goalUniversity ? ` at ${answers.goalUniversity}` : ""}`,
        });
    }
    return out;
}

/** "Year 12 · 4 subjects · ATAR 85 · Commerce" — absent answers are left out, never printed as blanks. */
export function personalLine(answers = {}) {
    const n = (answers.subjects || []).length;
    return [
        yearLabel(answers.yearLevel) || null,
        n > 0 ? plural(n, "subject") : null,
        answers.goalAtar ? `ATAR ${formatAtar(answers.goalAtar)}` : null,
        answers.goalCourseName || null,
    ].filter(Boolean).join(" · ");
}

/* ── What Ace says ─────────────────────────────────────────────────────────── */

/**
 * Ace's line on each screen. He REACTS to the answer before, with a fact.
 *
 * A host who says "great choice!" is what a form says when it has nothing.
 * So each line pays out the previous answer: the weeks the year leaves, what
 * VTAC does to the subjects just picked. The birthday is the one answer he
 * never comments on — an app remarking on a fifteen-year-old's age has
 * started editorialising about something that is none of its business.
 */
export function aceLines(step, answers = {}, now = new Date()) {
    const subjects = answers.subjects || [];
    switch (step) {
        case "year":
            return ["Six cards, and one of them is yours.", "Pick it and I'll deal it."];
        case "birthday": {
            if (!answers.yearLevel) return ["One quick one.", "I only ask it once."];
            const { weeks, label } = weeksUntilExams(answers.yearLevel, now);
            return [`${plural(weeks, "week")} ${label}.`, "One quick one, and I only ask it once."];
        }
        case "subjects":
            return ["Now your subjects.", "Each one becomes a suit."];
        case "target": {
            const { scaled } = scalingFor(subjects);
            const up = scaled.find((s) => s.factor > 0);
            if (up) return [`VTAC scales ${up.name} up ${up.factor}.`, "Now, what are you aiming for?"];
            if (subjects.length > 0) {
                return [`${plural(subjects.length, "subject")} in the deck.`, "Now, what are you aiming for?"];
            }
            return ["What are you aiming for?"];
        }
        case "build":
            return ["Shuffling your deck."];
        case "reveal":
            return ["Every subject starts as a two.", "You earn the rest."];
        case "signin":
            return ["Keep the hand and it is yours."];
        default:
            return [];
    }
}

/* ── The build ─────────────────────────────────────────────────────────────── */

/**
 * The lines the build screen ticks off. Each is a thing the app genuinely
 * worked out from the answers, phrased as what it is DOING and then what it
 * GOT — never "analysing ten thousand students", which is the kind of line
 * that makes a wait feel valuable by lying about what the wait is.
 *
 * A line whose answer is missing is not printed. A skipped target produces no
 * target line rather than "ATAR —", and custom subjects with no VTAC data say
 * so plainly instead of being drawn at zero.
 */
export function buildLines(answers = {}, now = new Date()) {
    const out = [];
    const subjects = answers.subjects || [];

    if (answers.yearLevel) {
        const { weeks, label } = weeksUntilExams(answers.yearLevel, now);
        out.push({ id: "weeks", doing: "Counting your weeks", done: `${plural(weeks, "week")} ${label}` });
    }

    if (subjects.length > 0) {
        const { scaled, unscaled } = scalingFor(subjects);
        let done;
        if (scaled.length > 0) {
            done = scaled.slice(0, 3).map((s) => `${shortSubject(s.name)} ${signed(s.factor)}`).join(" · ");
            if (scaled.length > 3) done += ` · +${scaled.length - 3} more`;
        } else {
            done = `${plural(unscaled.length, "custom subject")}, so no VTAC data to read`;
        }
        out.push({ id: "scaling", doing: "Reading VTAC's 2025 scaling", done });
    }

    out.push({
        id: "reviews",
        doing: "Spacing your first reviews",
        done: formatReviewDates(reviewDates(now)),
    });

    if (answers.goalAtar) {
        out.push({
            id: "target",
            doing: "Setting your target",
            done: `ATAR ${formatAtar(answers.goalAtar)} · ${atarBandOf(answers.goalAtar)} on the AcedIt ladder`,
        });
    }

    if (answers.yearLevel || subjects.length > 0) {
        const level = yearLabel(answers.yearLevel);
        out.push({
            id: "level",
            doing: "Pitching your questions",
            done: `${level ? `${level} level, ` : ""}marked against the criteria an assessor uses`,
        });
    }
    return out;
}

/* ── The reveal ────────────────────────────────────────────────────────────── */

/**
 * The three or four things the reveal states about THIS hand. The same rule as
 * the build: derived, and dropped when the answer behind it is missing.
 */
export function revealFacts(answers = {}, now = new Date()) {
    const subjects = answers.subjects || [];
    const facts = [];
    if (subjects.length > 0) {
        facts.push({
            id: "twos",
            head: `${plural(subjects.length, "subject")}, every one a two`,
            body: "Rank is mastery in AcedIt. The only way to hold better cards is to earn them.",
        });
    }
    facts.push({
        id: "reviews",
        head: "Your first reviews are already dated",
        body: `${formatReviewDates(reviewDates(now))}. Short, spread out, and set by the same scheduler your deck runs on.`,
    });
    if (answers.goalAtar) {
        facts.push({
            id: "target",
            head: `Chasing ATAR ${formatAtar(answers.goalAtar)}`,
            body: `${atarBandOf(answers.goalAtar)} on the AcedIt ladder, the same words your dashboard will use.`,
        });
    }
    if (answers.yearLevel) {
        facts.push({
            id: "level",
            head: `Written at ${yearLabel(answers.yearLevel)} level`,
            body: "Questions marked against the criteria an assessor actually uses.",
        });
    }
    return facts;
}
