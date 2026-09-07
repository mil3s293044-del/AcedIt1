/**
 * subjectBrowse — turning a catalogue of 33 subjects into something you can
 * actually choose from.
 *
 * ─── What browse was ────────────────────────────────────────────────────────
 * Thirty-three identical cards, each with the same book icon, a two-line
 * truncated overview nobody can finish reading, and one text box to narrow
 * them with. A student on this page is making one of the larger decisions of
 * their schooling and the page offered them a search field.
 *
 * ─── The three things a VCE student is actually asking ──────────────────────
 *   1. How does it scale.
 *   2. Can I do it, and where does it lead.
 *   3. Does it fit with what I have already.
 *
 * The catalogue has the data for all three — scaling_info, prerequisites and
 * career_pathways on every one of the 33 — and browse showed the first as a
 * pill with the wrong arrow on it and hid the rest behind "Details".
 */

// ─── Learning areas ─────────────────────────────────────────────────────────

/**
 * VCE's own grouping, in the order the catalogue is already written in.
 *
 * Hand-mapped rather than derived. Thirty-three is small enough to be exact,
 * and every heuristic that could produce this ("does the name contain
 * 'Mathematics'") gets Data Analytics wrong. A map is a fact; a heuristic is a
 * guess that will be wrong for one subject and nobody will notice which.
 */
export const LEARNING_AREAS = [
    { key: "maths",      label: "Maths" },
    { key: "english",    label: "English" },
    { key: "science",    label: "Sciences" },
    { key: "humanities", label: "Humanities" },
    { key: "business",   label: "Business" },
    { key: "arts",       label: "Arts" },
    { key: "tech",       label: "Technology" },
    { key: "health",     label: "Health & PE" },
    { key: "languages",  label: "Languages" },
    // Anything the map does not name — a subject a student created themselves.
    { key: "other",      label: "Your own" },
];

const AREA_OF = {
    "Mathematical Methods": "maths",
    "Specialist Mathematics": "maths",
    "General Mathematics": "maths",

    "English": "english",
    "English Language": "english",
    "Literature": "english",
    "English (EAL)": "english",

    "Biology": "science",
    "Chemistry": "science",
    "Physics": "science",
    "Psychology": "science",
    "Environmental Science": "science",

    "History: Revolutions": "humanities",
    "Australian History": "humanities",
    "Geography": "humanities",
    "Legal Studies": "humanities",
    "Australian and Global Politics": "humanities",
    "Philosophy": "humanities",

    // VCAA groups economics with business, not with the humanities.
    "Economics": "business",
    "Business Management": "business",
    "Accounting": "business",

    "Visual Communication Design": "arts",
    "Art Making and Exhibiting": "arts",
    "Media": "arts",
    "Music Repertoire Performance": "arts",
    "Drama": "arts",

    "Software Development": "tech",
    "Data Analytics": "tech",

    "Health and Human Development": "health",
    "Physical Education": "health",

    "French": "languages",
    "Japanese (Second Language)": "languages",
    "Chinese (Second Language)": "languages",
};

export const areaOf = (name) => AREA_OF[String(name || "").trim()] || "other";

export const areaLabel = (key) =>
    LEARNING_AREAS.find((a) => a.key === key)?.label || "Your own";

/**
 * The subjects that satisfy VCE's English requirement.
 *
 * This is a RULE, not advice: a VCE requires three units from the English
 * group including at least one Unit 3–4 sequence, and an ATAR requires a
 * completed Unit 3–4 English sequence. It is the one thing on this page a
 * student can actually fail to satisfy, which is why it is worth checking and
 * why the wording must not drift into recommending anything.
 */
export const ENGLISH_SUBJECTS = new Set([
    "English", "English Language", "Literature", "English (EAL)",
]);

// ─── Sorting ────────────────────────────────────────────────────────────────

const DIFFICULTY_RANK = { intermediate: 0, advanced: 1 };

/** "+5" → 5. Null for the catalogue's "+N" placeholder and for anything else. */
export function scalingOf(subject) {
    const m = /^([+-])(\d+)$/.exec(String(subject?.scaling_info?.scaling_factor || "").trim());
    return m ? (m[1] === "-" ? -1 : 1) * Number(m[2]) : null;
}

export const SORTS = [
    { key: "area",       label: "Learning area" },
    { key: "scaling",    label: "Scaling" },
    { key: "difficulty", label: "Difficulty" },
    { key: "name",       label: "A–Z" },
];

/**
 * Sorted, with name ALWAYS breaking the tie.
 *
 * Without it, sorting 33 subjects by a field with two values (difficulty) or
 * fourteen (scaling) leaves large blocks in whatever order the array happened
 * to be in, and they shuffle whenever the catalogue is edited. A stable, named
 * order inside each block is what makes the page feel like a list rather than
 * a bag.
 *
 * A subject with no scaling in the catalogue sorts LAST rather than as a zero:
 * "+N" means unknown, and dropping it in the middle of the neutral scalers
 * would state something the catalogue does not know.
 */
export function sortSubjects(subjects = [], key = "area") {
    const list = [...(Array.isArray(subjects) ? subjects : [])];
    const byName = (a, b) => String(a?.name || "").localeCompare(String(b?.name || ""));

    if (key === "name") return list.sort(byName);

    if (key === "scaling") {
        return list.sort((a, b) => {
            const x = scalingOf(a);
            const y = scalingOf(b);
            if (x == null && y == null) return byName(a, b);
            if (x == null) return 1;
            if (y == null) return -1;
            return y - x || byName(a, b);
        });
    }

    if (key === "difficulty") {
        return list.sort((a, b) => {
            const x = DIFFICULTY_RANK[a?.difficulty_level] ?? -1;
            const y = DIFFICULTY_RANK[b?.difficulty_level] ?? -1;
            return x - y || byName(a, b);
        });
    }

    const order = LEARNING_AREAS.map((a) => a.key);
    return list.sort((a, b) =>
        order.indexOf(areaOf(a?.name)) - order.indexOf(areaOf(b?.name)) || byName(a, b));
}

/**
 * Subjects grouped into their learning areas, areas in catalogue order and
 * EMPTY ONES DROPPED — a heading over nothing is a broken filter, not a
 * section.
 */
export function groupByArea(subjects = []) {
    const buckets = new Map(LEARNING_AREAS.map((a) => [a.key, []]));
    (Array.isArray(subjects) ? subjects : []).forEach((s) => {
        buckets.get(areaOf(s?.name))?.push(s);
    });
    return LEARNING_AREAS
        .map((a) => ({ ...a, subjects: buckets.get(a.key) || [] }))
        .filter((a) => a.subjects.length > 0);
}

// ─── What the student is already carrying ───────────────────────────────────

/**
 * The load a student has selected, and whether it meets the two requirements
 * that are actually rules.
 *
 * ─── Only rules, never strategy ─────────────────────────────────────────────
 * `hasEnglish` and `MIN_ATAR_STUDIES` are VCAA and VTAC requirements: an ATAR
 * needs a completed Unit 3–4 English sequence and study scores in at least
 * four studies. Those a student can fail to satisfy without knowing.
 *
 * The scaling figure is reported and NOT judged. Scaling reflects the strength
 * of the cohort that took a subject, not a discount available to whoever picks
 * it, so a page that told a student their load "scales badly" would be
 * advising them to change subjects on a misreading of what the number is. It
 * says how the picks scale on average and stops there.
 *
 * Subjects with no scaling in the catalogue are EXCLUDED from the average
 * rather than counted as zero — a zero is a claim that it scales neutrally,
 * which is a different thing from not knowing.
 */
export const MIN_ATAR_STUDIES = 4;

export function loadSummary(mySubjects = [], catalogue = []) {
    const mine = Array.isArray(mySubjects) ? mySubjects : [];
    const byName = new Map(
        (Array.isArray(catalogue) ? catalogue : []).map((s) => [String(s?.name || ""), s]));

    const names = mine.map((s) => String(s?.subject_name || "").trim()).filter(Boolean);
    const offsets = names
        .map((n) => scalingOf(byName.get(n)))
        .filter((v) => typeof v === "number");

    const avg = offsets.length
        ? Math.round((offsets.reduce((a, b) => a + b, 0) / offsets.length) * 10) / 10
        : null;

    return {
        count: names.length,
        hasEnglish: names.some((n) => ENGLISH_SUBJECTS.has(n)),
        enough: names.length >= MIN_ATAR_STUDIES,
        // How many of the picks the catalogue actually knows the scaling for,
        // so the average can say what it is an average OF.
        scaledCount: offsets.length,
        avgScaling: avg,
        scalesUp: offsets.filter((v) => v > 0).length,
    };
}

// ─── Prerequisites ──────────────────────────────────────────────────────────

/**
 * A prerequisite, parsed into what it actually is.
 *
 * ─── The catalogue writes these three different ways ────────────────────────
 * Printed raw with "Needs " in front, all three come out wrong, and two of
 * them come out as nonsense a student would read as a bug:
 *
 *   "None"                        → "Needs None"
 *   "Recommended: Year 10 Drama"  → "Needs Recommended: Year 10 Drama"
 *   "Year 10 maths recommended"   → "Needs Yr 10 maths recommended"
 *
 * The last is the worst of the three, because it reads as a hard requirement
 * and is the opposite — a subject a student could take is being presented as
 * one they cannot.
 *
 * ─── And a requirement can carry advice after it ────────────────────────────
 * "Year 10 Chemistry; concurrent Methods recommended" is a REQUIREMENT with a
 * recommendation attached. The part before the first semicolon or bracket is
 * the requirement; everything after it is advice, and advice belongs behind
 * Details rather than wrapping to a third line on a card meant to be scanned.
 * Nothing is dropped — the full string is still in the modal.
 */
export function prerequisiteOf(raw) {
    const text = String(raw || "").trim();
    if (!text || /^none$/i.test(text)) return null;

    const tidy = (t) => t.trim().replace(/^Year 10 /i, "Yr 10 ");

    // "Recommended: X" — advice announced up front.
    const prefixed = /^recommended:\s*(.+)$/i.exec(text);
    if (prefixed) return { kind: "recommended", text: tidy(prefixed[1]) };

    // The requirement is what precedes the first bracket or semicolon.
    const head = text.split(/[;(]/)[0].trim();

    // "X recommended" / "X strongly recommended" — advice in a trailing word.
    const suffixed = /^(.+?)\s+(?:strongly\s+)?recommended$/i.exec(head);
    if (suffixed) return { kind: "recommended", text: tidy(suffixed[1]) };

    return { kind: "required", text: tidy(head) };
}
