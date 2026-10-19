/**
 * subjectInfo — what the subject information page says, derived from the
 * catalogue and nothing else.
 *
 * The page it replaces printed "Popular choice" and "2 year program" beside
 * EVERY subject in the catalogue, which made both sentences say nothing; it
 * coloured the scaling pill by reputation rather than by direction, the bug
 * `ScalingMark` was written to end on Browse; and it printed prerequisites
 * raw, so "Year 10 maths recommended" read as a gate. Every figure here comes
 * off a catalogue field, and nothing on the page is a judgement of which
 * subject is better — scaling reflects the cohort that sat a study, not a
 * discount available to whoever picks it, which is `LoadStrip`'s rule too.
 *
 * Pure, so a test can hold it.
 */
import { areaOf, areaLabel, scalingOf, prerequisiteOf } from "@/lib/subjectBrowse";

/* ── The year, as one bar ─────────────────────────────────────────────────── */

/**
 * What kind of assessment a component is. Read off the catalogue's own names:
 * "End-of-year exam", "Exam 2 (CAS)", "Oral exam" are exams; "Unit 3 SAC",
 * "Unit 3-4 SAT (folio)" are assessed at school. "Solo performance" is
 * neither by name, and guessing would put a third of Music's study score on
 * the wrong side of the headline, so it is OTHER and said as such.
 */
export function assessKind(component) {
    const c = String(component || "");
    if (/\bexam\b/i.test(c)) return "exam";
    if (/\bSA[CT]s?\b|folio|coursework/i.test(c)) return "school";
    return "other";
}

const KIND_ORDER = { school: 0, other: 1, exam: 2 };

/**
 * The study score as one bar, in the order of the year: what is assessed at
 * school first, then what is not obviously either, then the exams, which come
 * at the end. Within a kind the catalogue's own order stands. No dates are
 * claimed — the catalogue has none, and "Term 2" printed under a SAC would be
 * the app inventing a school calendar.
 *
 * The percentages are VCAA's and are NOT renormalised, `markSplit`'s rule. A
 * segment's WIDTH is drawn against whichever is larger of 100 and the total,
 * so a study design that overshoots cannot push the bar past its own edge.
 */
export function yearBar(subject) {
    const rows = (Array.isArray(subject?.assessment_structure) ? subject.assessment_structure : [])
        .map((r, i) => ({
            component: String(r?.component || "").trim(),
            description: String(r?.description || "").trim(),
            percentage: Number(r?.percentage) || 0,
            kind: assessKind(r?.component),
            at: i,
        }))
        .filter((r) => r.component && r.percentage > 0)
        .sort((a, b) => (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) || (a.at - b.at));
    if (!rows.length) return null;

    const total = rows.reduce((t, r) => t + r.percentage, 0);
    const scale = Math.max(100, total);
    const top = Math.max(...rows.map((r) => r.percentage));
    let start = 0;
    const parts = rows.map(({ at: _at, ...r }) => {
        const part = {
            ...r,
            start: (start / scale) * 100,
            width: (r.percentage / scale) * 100,
            // Every part that ties for the most marks, not just the first:
            // two 25% SACs are both the heaviest thing on the paper.
            heaviest: r.percentage === top,
        };
        start += r.percentage;
        return part;
    });
    const sum = (kind) => parts.filter((p) => p.kind === kind).reduce((t, p) => t + p.percentage, 0);
    const school = sum("school");
    const exam = sum("exam");
    const other = sum("other");
    return { parts, total, school, exam, other, lead: barLead({ school, exam, other }) };
}

/**
 * The one sentence over the bar. The larger half leads; an even split says
 * so; a subject with no exam at all says THAT, because it is the fact that
 * changes how somebody plans a year.
 */
export function barLead({ school = 0, exam = 0, other = 0 } = {}) {
    if (!school && !exam && !other) return null;
    if (!exam) return "No exam — every mark is earned during the year.";
    if (exam === school && !other) return `Split evenly: ${exam}% at school, ${exam}% in the exams.`;
    if (exam >= school + other) return `${exam}% of the study score is decided in the exams.`;
    if (school >= exam + other) return `${school}% is earned at school, before the exams.`;
    return `${exam}% in the exams, ${school + other}% across the year.`;
}

/* ── Prerequisites ────────────────────────────────────────────────────────── */

/**
 * Every prerequisite, read the way Browse reads them — a requirement is
 * "Needs", advice is "Suits" — with the catalogue's full sentence kept beside
 * it. Browse trims the advice off for a card meant to be scanned; this page is
 * where "Nothing is dropped" has to be true.
 */
export function prereqsOf(subject) {
    return (Array.isArray(subject?.prerequisites) ? subject.prerequisites : [])
        .map((raw) => {
            const p = prerequisiteOf(raw);
            return p ? { ...p, raw: String(raw).trim() } : null;
        })
        .filter(Boolean);
}

/* ── Alternatives in the same area ────────────────────────────────────────── */

/** The most an alternatives strip shows. The largest area holds six. */
export const ALT_MAX = 8;

/**
 * The subjects a student would weigh this one against: the others in its
 * learning area, INCLUDING this one (flagged), ordered by scaling so General,
 * Methods and Specialist read as the ladder they are. A subject whose scaling
 * the catalogue does not know goes last rather than being sorted as a zero.
 *
 * A student's own custom subject has no area and no alternatives — "Your own"
 * is a heading for things they made, not a field of study to choose within.
 */
export function alternativesFor(subject, catalogue = []) {
    const area = areaOf(subject?.name);
    if (!subject || area === "other") return [];
    const rows = catalogue
        .filter((s) => s && !s.is_private && areaOf(s.name) === area)
        .map((s) => ({
            subject: s,
            current: s.id === subject.id,
            scaling: scalingOf(s),
            exam: yearBar(s)?.exam ?? null,
        }))
        .sort((a, b) => ((a.scaling ?? Infinity) - (b.scaling ?? Infinity))
            || String(a.subject.name).localeCompare(String(b.subject.name)));
    // A strip of one is the subject itself: there is nothing to weigh.
    return rows.length > 1 ? rows.slice(0, ALT_MAX) : [];
}

export const areaNameOf = (subject) => {
    const key = areaOf(subject?.name);
    return key === "other" ? null : areaLabel(key);
};

/* ── Side by side ─────────────────────────────────────────────────────────── */

const norm = (s) => String(s || "").trim().toLowerCase();

/** What two lists share, and what is only in each — compared without case. */
export function overlap(a = [], b = []) {
    const inB = new Set(b.map(norm));
    const inA = new Set(a.map(norm));
    return {
        both: a.filter((x) => inB.has(norm(x))),
        onlyA: a.filter((x) => !inB.has(norm(x))),
        onlyB: b.filter((x) => !inA.has(norm(x))),
    };
}

const signed = (n) => (n == null ? null : n > 0 ? `+${n}` : String(n));

/**
 * Two subjects as rows of the same facts.
 *
 * NO ROW NAMES A WINNER. A higher scaling number is not a better subject, and
 * a lower exam share is not an easier one; the compare puts the facts beside
 * each other and the student weighs them. That is the whole difference between
 * this and a ranking, and the test asserts the absence.
 *
 * A fact one side lacks is printed as a dash on that side and never as a zero.
 */
export function compareRows(a, b) {
    if (!a || !b) return [];
    const barA = yearBar(a);
    const barB = yearBar(b);
    const heavy = (bar) => {
        const p = bar?.parts.find((x) => x.heaviest);
        return p ? `${p.component} · ${p.percentage}%` : null;
    };
    const need = (s) => {
        const p = prereqsOf(s)[0];
        return p ? `${p.kind === "required" ? "Needs" : "Suits"} ${p.text}` : "None listed";
    };
    const mean = (s) => {
        const m = Number(s?.scaling_info?.mean_study_score);
        return Number.isFinite(m) && m > 0 ? String(m) : null;
    };
    return [
        { key: "scaling", label: "Scaling", a: signed(scalingOf(a)), b: signed(scalingOf(b)) },
        { key: "mean", label: "Average scaled score", a: mean(a), b: mean(b) },
        { key: "exam", label: "Decided in exams",
            a: barA ? `${barA.exam}%` : null, b: barB ? `${barB.exam}%` : null },
        { key: "heaviest", label: "Heaviest single assessment", a: heavy(barA), b: heavy(barB) },
        { key: "prereq", label: "Before you start", a: need(a), b: need(b) },
    ];
}

/* ── The page's own address ───────────────────────────────────────────────── */

/**
 * The subject a `?view=` names. The catalogue's ids are stable by
 * construction (`vce-<code>`), so a link sent today still opens the same page
 * next term. An id that matches nothing is NULL — the page then shows Browse
 * rather than an empty detail screen.
 */
export function subjectForView(view, subjects = []) {
    const id = String(view || "").trim();
    if (!id) return null;
    return subjects.find((s) => s?.id === id) || null;
}

/**
 * The address the share button hands over. `createPageUrl("Subjects")` is
 * "/Subjects"; it is written out here because this module is read by plain
 * node, which cannot load the TypeScript `utils`. The test holds the path
 * against the route map, so the two cannot drift apart.
 */
export const subjectLink = (id, origin = "") => `${origin}/Subjects?view=${encodeURIComponent(String(id || ""))}`;

export default {
    assessKind, yearBar, barLead, prereqsOf, alternativesFor, areaNameOf,
    overlap, compareRows, subjectForView, subjectLink, ALT_MAX,
};
