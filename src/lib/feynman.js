/**
 * feynman — explain it simply, find where it is hollow, rewrite.
 *
 * ─── THE TECHNIQUE IS A LOOP, NOT A CONVERSATION, AND THAT IS WHAT MAKES IT
 *     AFFORDABLE ───────────────────────────────────────────────────────────
 * The obvious build is a chat: the model plays a confused classmate and the
 * student teaches it. That is `teaching_assistant` and it already exists — and
 * as a TECHNIQUE it is unshippable, because a conversation is N model calls. At
 * `ai_chat`'s price a ten-turn session is 80 chips of a 1,000-chip week, which
 * is the most expensive thing on the Study page by a factor of ten.
 *
 * But Feynman's method is four steps and only ONE of them needs a model:
 * explain it simply → find the gaps → go back to the source → rewrite. Steps
 * one, three and four are the student working. So this is a loop of one-shot
 * passes, which is both cheaper AND closer to what Feynman actually described:
 *
 *   first pass   8 chips, the student's own tier — this is judgement
 *   a rewrite    3 chips, pinned to Haiku — this is classification
 *   full loop   14 chips against ~80 for the conversational version
 *
 * ─── THREE THINGS HERE COST NOTHING AT ALL ──────────────────────────────────
 * `jargonUsed` reads the subject's own `keyTerms` — twenty-odd hand-written
 * VCAA terms that have been in `subjectExaminerPrompts.js` for months — and
 * `readingLevel` is arithmetic over the text. Both are instant, free, and
 * honest, which is `buildSpot`'s posture in drill.js: a word diff, nothing
 * generated and nothing guessed.
 *
 * ─── AND THE FREE HALF MAY NOT CLAIM WHAT ONLY THE MODEL CAN KNOW ───────────
 * The tempting version of the jargon ribbon marks a term GREEN once it looks
 * "explained nearby" — a window heuristic over definitional cues. It would be
 * wrong constantly, and wrong in the direction that tells a student their
 * hand-wave was fine. So the ribbon states the FACT (you leaned on these
 * terms) and the model's pass is the only thing that may call one hollow. The
 * same refusal `coverage` makes about an unrecognised topic.
 */

/* ── Who you are explaining it to ────────────────────────────────────────── */

/**
 * The audience sets the bar, and it is a real input rather than flavour: the
 * reading level it targets changes which gaps count, so "a Year 7 kid" and
 * "your examiner" are different exercises on the same material.
 *
 * Three chips with the middle one pre-selected, so the common path costs the
 * student no decision at all.
 */
export const AUDIENCES = [
    {
        id: "kid",
        label: "A Year 7 kid",
        short: "a 12-year-old",
        targetYear: 7,
        note: "No jargon survives. Everything in plain words.",
    },
    {
        id: "classmate",
        label: "A classmate who missed the lesson",
        short: "a classmate who missed the lesson",
        targetYear: 10,
        note: "Terms are fine once you have said what they mean.",
        default: true,
    },
    {
        id: "examiner",
        label: "Your examiner",
        short: "a VCAA examiner",
        targetYear: 12,
        note: "Precise terminology, and every step justified.",
    },
];

export const audienceOf = (id) =>
    AUDIENCES.find((a) => a.id === id) || AUDIENCES.find((a) => a.default) || AUDIENCES[0];

/* ── What a gap is ───────────────────────────────────────────────────────── */

/**
 * The four ways an explanation fails, and each carries a SHAPE as well as a
 * hue — the rule the floor's step dots settled, because the brand green and
 * the streak red sit at ΔE 7.0 under deuteranopia and a bare colour would be
 * the only thing saying which kind this is.
 */
export const GAP_KINDS = {
    hollow: {
        id: "hollow",
        label: "Named, never explained",
        shape: "ring",
        tone: "berry",
        blurb: "You used the idea as if it were the answer.",
    },
    jargon: {
        id: "jargon",
        label: "Leaned on a term",
        shape: "box",
        tone: "xp",
        blurb: "The word is doing work your explanation has not done.",
    },
    leap: {
        id: "leap",
        label: "A step is missing",
        shape: "arrow",
        tone: "chart-4",
        blurb: "This does not follow from what came before it.",
    },
    wrong: {
        id: "wrong",
        label: "Not right",
        shape: "cross",
        tone: "streak",
        blurb: "This would lose marks as written.",
    },
};

export const GAP_LIST = Object.values(GAP_KINDS);
export const isGapKind = (k) => Object.prototype.hasOwnProperty.call(GAP_KINDS, String(k || ""));
export const kindOf = (k) => GAP_KINDS[String(k || "")] || GAP_KINDS.hollow;

/** How many gaps one pass may raise. Past this it is a rewrite, not a drill. */
export const GAPS_MAX = 5;

/** Too little to judge, and too much to read back on a phone. */
export const WORK_MIN_WORDS = 25;
export const WORK_MAX = 6000;

/** What the two passes are billed as. The recheck is pinned cheap in aiModels. */
export const FEYNMAN_FEATURE = "feynman";
export const RECHECK_FEATURE = "feynman_recheck";

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

/**
 * One gap off the model.
 *
 * THE QUESTION IS WHAT IS REQUIRED, not the quote — which is the opposite of
 * `normaliseAnnotation` and deliberate. An annotation with nothing to point at
 * is not an annotation; a Feynman gap with nothing to point at is the STRONGEST
 * kind there is, because "never says why it is spontaneous" is unquotable
 * precisely in that the words are absent. That is the failure `MarkModule` was
 * rebuilt to end, met again one technique over.
 */
export function normaliseGap(raw, i = 0) {
    const ask = str(raw?.ask || raw?.question).trim();
    if (!ask) return null;
    return {
        id: str(raw?.id).trim() || `g${i}`,
        kind: isGapKind(raw?.kind) ? raw.kind : "hollow",
        quote: str(raw?.quote).trim(),
        ask,
        why: str(raw?.why || raw?.note).trim(),
        closed: raw?.closed === true,
    };
}

/**
 * Read a pass.
 *
 * A quote the model invented is BLANKED rather than taken as a reason to drop
 * the gap — `annotate.js` drops an unplaceable annotation because underlining
 * the wrong six words sends a student to rewrite a sentence that was fine, and
 * that reasoning covers the UNDERLINE, not the question. The question is the
 * payload here, so losing it over a bad quote would throw away the thing the
 * pass was paid for. It simply loses its underline.
 */
export function readGaps(res, { work = "" } = {}) {
    const body = str(work);
    const raw = Array.isArray(res?.gaps) ? res.gaps
        : Array.isArray(res?.data?.gaps) ? res.data.gaps : [];
    const gaps = [];
    const seen = new Set();
    let unplaced = 0;
    for (const [i, r] of raw.entries()) {
        const g = normaliseGap(r, i);
        if (!g) continue;
        // One question per idea. A pass that asks the same thing twice reads as
        // padding, which is what the GAPS_MAX cap is defending against.
        const key = g.ask.toLowerCase().replace(/\s+/g, " ");
        if (seen.has(key)) continue;
        seen.add(key);
        if (g.quote && !body.includes(g.quote)) { g.quote = ""; unplaced += 1; }
        gaps.push(g);
        if (gaps.length >= GAPS_MAX) break;
    }
    return { gaps, unplaced };
}

/**
 * A later pass may only CLOSE a gap, never raise one.
 *
 * `applyRescan`'s rule, and it is what makes the all-clear reachable: left to
 * append, each pass finds new or reshaped gaps and the student who worked for
 * an hour sees a readout as red as when they began. The prompt says so too, so
 * reporting a new one costs the model nothing and the student a finding they
 * could have had.
 */
export function applyRecheck(gaps = [], stillOpenIds = []) {
    const open = new Set((Array.isArray(stillOpenIds) ? stillOpenIds : []).map(String));
    return (gaps || []).map((g) =>
        g.closed ? g : { ...g, closed: !open.has(String(g.id)) });
}

export const openGaps = (gaps = []) => (gaps || []).filter((g) => g && !g.closed);

/** How far through the loop, for the track. Never NaN on an empty list. */
export function progressOf(gaps = []) {
    const total = (gaps || []).length;
    const closed = total - openGaps(gaps).length;
    return { total, closed, open: total - closed, pct: total ? Math.round((closed / total) * 100) : 0 };
}

/* ── The free half ───────────────────────────────────────────────────────── */

const WORD = /[A-Za-z][A-Za-z'’-]*/g;

/**
 * Which of the subject's own terms the explanation leans on.
 *
 * Matched on a word boundary and case-insensitively, longest term first so
 * "normal distribution" is not reported twice as "normal" and "distribution".
 * It states a FACT and makes no claim about whether the term was explained —
 * see the header.
 */
export function jargonUsed(text, terms = []) {
    const body = str(text);
    if (!body.trim()) return [];
    const low = body.toLowerCase();
    const out = [];
    const sorted = [...(terms || [])].filter(Boolean)
        .map(String).sort((a, b) => b.length - a.length);
    const claimed = [];
    const overlaps = (a, b) => a[0] < b[1] && b[0] < a[1];
    for (const term of sorted) {
        const t = term.toLowerCase();
        let from = 0;
        for (;;) {
            const at = low.indexOf(t, from);
            if (at === -1) break;
            const before = at === 0 ? " " : low[at - 1];
            const after = at + t.length >= low.length ? " " : low[at + t.length];
            const bounded = !/[a-z]/.test(before) && !/[a-z]/.test(after);
            const span = [at, at + t.length];
            if (bounded && !claimed.some((c) => overlaps(c, span))) {
                claimed.push(span);
                out.push({ term, at });
                break;
            }
            from = at + 1;
        }
    }
    return out.sort((a, b) => a.at - b.at).map((x) => x.term);
}

/** Vowel groups, which is the standard cheap proxy for syllables. */
function syllables(word) {
    const w = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return 0;
    const groups = w.replace(/e$/, "").match(/[aeiouy]+/g);
    return Math.max(1, groups ? groups.length : 1);
}

/**
 * Roughly what year level the writing reads at.
 *
 * Flesch-Kincaid, which is a PROXY and is labelled as one on screen — "reads
 * like Year 9", never "is". Two refusals, both the `TREND_MIN` posture:
 *
 *   - under `WORK_MIN_WORDS` it returns null rather than a number, because the
 *     grade of two sentences is noise and a figure that moves wildly on every
 *     keystroke teaches a student that the numbers here are decoration;
 *   - a text that is mostly symbols returns null too. On a Methods explanation
 *     full of LaTeX the formula is the content and the measure is meaningless,
 *     so printing one would be inventing a reading of maths notation.
 */
export function readingLevel(text) {
    const body = str(text);
    const words = body.match(WORD) || [];
    if (words.length < WORK_MIN_WORDS) return null;
    const letters = words.join("").length;
    if (letters < body.replace(/\s/g, "").length * 0.5) return null;
    const sentences = Math.max(1, (body.match(/[.!?]+(\s|$)/g) || []).length);
    const syl = words.reduce((a, w) => a + syllables(w), 0);
    const grade = 0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59;
    return { year: Math.max(3, Math.min(12, Math.round(grade))), words: words.length };
}

/** Enough to be worth a pass? The button says so rather than failing at the far end. */
export function readyToCheck(text) {
    const words = (str(text).match(WORD) || []).length;
    if (words < WORK_MIN_WORDS) return { ok: false, words, need: WORK_MIN_WORDS - words };
    return { ok: true, words, need: 0 };
}

export default {
    AUDIENCES, audienceOf, GAP_KINDS, GAP_LIST, isGapKind, kindOf,
    normaliseGap, readGaps, applyRecheck, openGaps, progressOf,
    jargonUsed, readingLevel, readyToCheck,
    GAPS_MAX, WORK_MIN_WORDS, WORK_MAX, FEYNMAN_FEATURE, RECHECK_FEATURE,
};
