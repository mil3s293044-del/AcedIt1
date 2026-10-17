/**
 * guides — what the app already knows about each subject and each technique,
 * as something a student can read.
 *
 * /Guides was a page of posts any student could write and every student could
 * read, with a featured flag the author set themselves. So a "guide" was
 * whatever somebody typed, on a product sold to schools, with nothing checking
 * any of it — the free text between students migration 0034 refused for
 * Compete, published to the whole site rather than to one group.
 *
 * Meanwhile the app has been carrying the real thing for months and showing it
 * only to a model: 35 subjects of mark conventions, how candidates actually
 * lose marks, and the terminology examiners want (`subjectExaminerPrompts.js`);
 * VCAA's mark split for 33 of them (`vceSubjects.js`); and the cited science
 * behind each technique (`neuro.js`). The MARKER reads all of it on every
 * call. A student revising for the same exam had never seen a line.
 *
 * So a guide is BUILT, never written, and every field below is read straight
 * off one of those three sources. Three rules hold it:
 *
 *   1. NOTHING IS INVENTED TO FILL A SECTION. A section whose source is empty
 *      is null, and the reader draws nothing for it — the same rule every
 *      builder in `studyQueue` keeps about zero rows.
 *   2. NO GENERIC FALLBACK, EVER. The examiner prompts fall back to a
 *      `_default` profile so a prompt always has something. Printed under a
 *      subject's name that would be the app making up a subject's marking, so
 *      `examinerProfile` returns null and a subject with no profile has no
 *      guide. Model-facing text (`examplePromptStyle`) never reaches a student.
 *   3. EVERY GUIDE ENDS IN A DOOR. Reading how a subject is marked and then
 *      having nowhere to practise it is a diagnosis with no way through, which
 *      is the rule Ranked's component links keep. The doors are built here,
 *      as data, so a test can check every one lands somewhere real.
 */
import { VCE_SUBJECTS } from "../data/vceSubjects.js";
import { examinerProfile, getProfiledSubjects, COMMAND_TERMS } from "./subjectExaminerPrompts.js";
import { TECHNIQUE_NEURO, UTILITY } from "./neuro.js";
import { markSplit } from "./subjectHub.js";
import { areaOf, LEARNING_AREAS } from "./subjectBrowse.js";
import { toolQuery, personaFor } from "./toolBrief.js";

/* ── Techniques ─────────────────────────────────────────────────────────── */

/**
 * The six techniques by the ids and names Study uses. Study's own list is a
 * `.jsx` with icons in it, which neither the test loader nor this module can
 * import, so the names are restated HERE and `guides.test.mjs` reads Study.jsx
 * to hold them equal — a pinned copy rather than a loose one. The id is also
 * the `?tab=` Study honours, so a door built from it opens that technique.
 */
export const TECHNIQUES = [
    { id: "spaced_repetition", name: "Spaced Repetition" },
    { id: "active_recall", name: "Active Recall" },
    { id: "blurting", name: "Blurting" },
    { id: "exam", name: "Revision Mode" },
    { id: "mind_map", name: "Mind Maps" },
    { id: "pomodoro", name: "Pomodoro" },
];

const page = (name) => `/${name}`;

export function techniqueGuide(id) {
    const t = TECHNIQUES.find((x) => x.id === id);
    const science = t ? TECHNIQUE_NEURO[t.id] : null;
    if (!t || !science) return null;
    const utility = science.utility ? UTILITY[science.utility] || null : null;
    return {
        kind: "technique",
        id: t.id,
        key: `technique:${t.id}`,
        name: t.name,
        headline: science.headline,
        utility: utility ? { id: science.utility, label: utility.label, blurb: utility.blurb } : null,
        sources: science.sources.length,
        href: `${page("Guides")}?technique=${encodeURIComponent(t.id)}`,
        doors: [{ id: "try", label: `Start ${t.name}`, to: `${page("Study")}?tab=${t.id}`, primary: true }],
    };
}

/* ── Command terms ──────────────────────────────────────────────────────── */

/**
 * One guide, not thirty-five copies of the same table. The terms are identical
 * for every subject, so printing them inside each subject's guide would be the
 * same fifteen rows on every hub — and a list written out thirty-five times is
 * the one a fix reaches thirty-four of.
 */
export const TERMS_KEY = "command-terms";

export function termsGuide() {
    return {
        kind: "terms",
        id: TERMS_KEY,
        key: `ref:${TERMS_KEY}`,
        name: "Command terms",
        headline: "The first word of a question tells you what earns the marks.",
        terms: COMMAND_TERMS.map((t) => ({ id: t.id, term: t.term, behaviour: t.behaviour })),
        href: `${page("Guides")}?ref=${TERMS_KEY}`,
        doors: [{
            id: "try", primary: true,
            label: "Check what a question is asking",
            to: `${page("AITools")}?${toolQuery({ tool: "command_term" })}`,
        }],
    };
}

/* ── Subjects ───────────────────────────────────────────────────────────── */

/**
 * A profile's lost-marks line, as a list.
 *
 * It is written three ways across the profiles — "Students lose marks by:
 * (1) …; (2) …", a bare "(1) …; (2) …", and a comma list — so it is parsed
 * rather than printed. Splitting on a comma or semicolon only OUTSIDE brackets
 * is what keeps "Ignoring contextual factors (audience, setting, relationship)"
 * one item rather than three.
 */
export function lostMarks(raw) {
    const s = String(raw || "").trim().replace(/^students lose marks by:\s*/i, "");
    if (!s) return [];
    const numbered = /^\(\d+\)\s/.test(s);
    const items = numbered ? s.split(/(?:^|;\s*|\s+)\(\d+\)\s+/) : splitOutside(s, ";,");
    return items
        .map((x) => x.trim().replace(/[;,.]+$/, "").trim())
        .filter(Boolean)
        .map((x) => x[0].toUpperCase() + x.slice(1));
}

function splitOutside(s, seps) {
    const out = [];
    let depth = 0;
    let cur = "";
    for (const ch of s) {
        if (ch === "(" || ch === "[") depth += 1;
        if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
        if (depth === 0 && seps.includes(ch)) { out.push(cur); cur = ""; continue; }
        cur += ch;
    }
    out.push(cur);
    return out;
}

const catalogueFor = (name, catalogue) => {
    const key = String(name || "").trim().toLowerCase();
    return (catalogue || []).find((s) => String(s.name).toLowerCase() === key) || null;
};

/**
 * One subject's guide, or null when the app knows nothing real about it.
 *
 * Each section is null or empty when its source is, never a placeholder.
 * `marks` is the catalogue's split through `markSplit`, the same function the
 * hub draws, so the two screens cannot print different weights.
 */
export function subjectGuide(name, catalogue = VCE_SUBJECTS) {
    const profile = examinerProfile(name);
    if (!profile) return null;
    const full = catalogueFor(profile.name, catalogue);
    const split = markSplit(full);
    const subject = profile.name;
    const tool = personaFor(subject);
    return {
        kind: "subject",
        id: subject,
        key: `subject:${subject}`,
        name: subject,
        area: areaOf(subject),
        mathHeavy: profile.mathHeavy,
        marks: split.parts.length ? split : null,
        exam: profile.examFormat || null,
        rewarded: profile.markConventions || null,
        lost: lostMarks(profile.commonMistakes),
        terms: profile.keyTerms,
        course: profile.topicCoverage || null,
        tips: Array.isArray(full?.study_tips) ? full.study_tips.filter(Boolean) : [],
        href: `${page("Guides")}?subject=${encodeURIComponent(subject)}`,
        doors: [
            {
                // The same three offers the AI Tools brief makes, by the same
                // `personaFor`, so a maths subject is worked through rather
                // than handed a paper and English is planned and marked.
                id: "sit", primary: true,
                label: tool === "math_tutor"
                    ? "Work a question the way it is marked"
                    : tool === "english_mentor"
                        ? "Plan and mark a response"
                        : "Sit questions marked this way",
                to: `${page("AITools")}?${toolQuery({
                    tool,
                    subject,
                    seed: `Give me VCAA-style ${subject} questions and mark my answers the way a VCAA assessor would.`,
                })}`,
            },
            {
                id: "read", label: "Read my answer like an assessor",
                to: `${page("AITools")}?${toolQuery({ tool: "precision", subject })}`,
            },
            { id: "hub", label: `Open ${subject}`, to: `${page("SubjectHub")}?subject=${encodeURIComponent(subject)}` },
        ],
    };
}

/**
 * The one line a library row carries: where most of the marks are. It is the
 * single fact that changes what somebody revises first, and it fits a third
 * of a row. With no split in the catalogue the row says nothing rather than
 * something vague.
 */
export function subjectLine(guide) {
    const top = guide?.marks?.heaviest;
    return top ? `${top.component} is ${top.percentage}%` : "";
}

/** The lead under a guide's name, where there is room for a second fact. */
export function subjectLead(guide) {
    if (!guide) return "";
    const bits = [];
    const top = guide.marks?.heaviest;
    if (top) bits.push(`${top.component} is ${top.percentage}% of the study score`);
    if (guide.lost.length) bits.push(`${guide.lost.length} common ways marks are lost`);
    return bits.join(" · ");
}

/* ── The library ────────────────────────────────────────────────────────── */

/**
 * Every guide, arranged for a student.
 *
 * `mine` leads because a student opening this page before a SAC wants their
 * own six, not thirty-three; it keeps the order they were given and drops
 * anything with no guide rather than listing a subject it can say nothing
 * about. The full shelf is every CATALOGUE subject by learning area, plus any
 * of the student's own subjects that are profiled but not catalogued
 * (Foundation Mathematics), so a guide that exists is never unreachable.
 */
export function guideLibrary({ mySubjects = [], catalogue = VCE_SUBJECTS } = {}) {
    const seen = new Set();
    const mine = [];
    for (const raw of mySubjects) {
        const g = subjectGuide(raw, catalogue);
        if (!g || seen.has(g.name)) continue;
        seen.add(g.name);
        mine.push(g);
    }

    const names = new Set((catalogue || []).map((s) => s.name));
    for (const g of mine) names.add(g.name);
    const all = [...names].map((n) => subjectGuide(n, catalogue)).filter(Boolean);

    const areas = LEARNING_AREAS
        .map((a) => ({
            key: a.key,
            label: a.label,
            guides: all.filter((g) => g.area === a.key).sort((x, y) => x.name.localeCompare(y.name)),
        }))
        .filter((a) => a.guides.length > 0);

    return {
        mine,
        techniques: TECHNIQUES.map((t) => techniqueGuide(t.id)).filter(Boolean),
        reference: [termsGuide()],
        areas,
        count: all.length,
    };
}

/** Narrow the shelf to a search, on the subject's name only. */
export function searchAreas(areas = [], query = "") {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return areas;
    return areas
        .map((a) => ({ ...a, guides: a.guides.filter((g) => g.name.toLowerCase().includes(q)) }))
        .filter((a) => a.guides.length > 0);
}

/**
 * Which guide a URL asks for. One reader for the three shapes the doors above
 * build, so a link and the page cannot disagree about what `?subject=` means.
 * An unknown name is null — the library, not a guess at the nearest subject.
 */
export function guideFromQuery(search = "", catalogue = VCE_SUBJECTS) {
    const q = new URLSearchParams(String(search || "").replace(/^\?/, ""));
    if (q.get("subject")) return subjectGuide(q.get("subject"), catalogue);
    if (q.get("technique")) return techniqueGuide(q.get("technique"));
    if (q.get("ref") === TERMS_KEY) return termsGuide();
    return null;
}

/** Every subject the app can write a guide for — for checks, not for screens. */
export const guidedSubjects = () => getProfiledSubjects();

export default {
    TECHNIQUES, TERMS_KEY, techniqueGuide, termsGuide, lostMarks, subjectGuide,
    subjectLine, subjectLead, guideLibrary, searchAreas, guideFromQuery, guidedSubjects,
};
