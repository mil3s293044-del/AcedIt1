/**
 * strategyEvidence — what the app already knows about a student in one subject,
 * as the chips Strategise opens on.
 *
 * ─── THE PAGE ASKED FOR WHAT IT ALREADY HAD ─────────────────────────────────
 * Strategise used to open on four text boxes: what are you shaky on, which
 * topics does it cover, how did the last one go, what do you want out of it.
 * Every one of those is something this app has on file — the cards that keep
 * missing, the criteria dropped three times, the course areas with nothing
 * against them, the marks typed into the planner, the target dragged onto the
 * study-score curve. Most students left the boxes empty, so the prompt read
 * "they didn't name specific topics" and the plan came back generic, about a
 * student the app could have described in detail.
 *
 * So the page opens on a list it can stand behind, and the student edits it
 * rather than writing it. That is the "collect nothing you don't use" rule
 * pointed the other way: ask for nothing you already know.
 *
 * ─── EVERY CHIP NAMES WHERE IT CAME FROM ────────────────────────────────────
 * A plan built on "Redox" is only as good as the reason Redox is on the list,
 * and a student who cannot see that reason cannot disagree with it. Each chip
 * carries its `source` and a `detail` the student can check against the screen
 * it came from — "41% of reviews missed" is on their flashcards, "dropped 3
 * times" is in the mistake bank.
 *
 * Nothing is invented to fill the list. A builder with no real number returns
 * nothing, and an account with no history in the subject gets the course
 * outline and nothing else — which is still more than four empty boxes.
 */
import { weakTopicsFrom } from "@/lib/weakTopics";
import { repeatOffenders, mistakeMeta, fixState, isRetired, BANK_TOPIC } from "@/lib/mistakeBank";
import { coverage } from "@/lib/subjectHub";
import { commandTermStats, isRetryAttempt } from "@/lib/quizInsight";
import { markPercent } from "@/lib/market";

/** How many chips of each kind may lead, and of all topic chips together. */
export const EVIDENCE_LIMITS = { weak: 3, repeat: 2, open: 2, untouched: 3, topics: 8 };

/** The most a student may add of their own, and how long each may be. */
export const CUSTOM_MAX = 4;
export const CUSTOM_LEN = 80;

/** Marks it takes before an average is stated rather than a single result. */
export const MARK_AVERAGE_AT = 2;

const norm = (s) => String(s || "").trim().toLowerCase();
const same = (a, b) => !!norm(a) && norm(a) === norm(b);

/**
 * Cut on a word boundary with an ellipsis. A criterion runs long, and one cut
 * mid-word reads as a rendering fault — the complaint the mistake bank's
 * clipped questions drew.
 */
export function clipWords(text, max = 64) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const at = cut.lastIndexOf(" ");
    return `${(at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[\s,;:.—-]+$/, "")}…`;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The chips, in the order a plan should weigh them: what is costing marks now,
 * then what has never been touched, then the context (marks, target).
 *
 * Inputs are the rows the page already loads, UNFILTERED — this does the
 * subject cut itself so every caller cuts the same way.
 *
 *   { id, kind, label, detail, source, prompt, on, context }
 *
 * `context` chips are not topics: they tell the model how it went last time
 * and what the student is aiming for, so they never count against the topic
 * cap and the prompt files them under their own headings.
 */
export function evidenceFor({
    subject,
    flashcards = [],
    attempts = [],
    quizzes = [],
    assessments = [],
    userSubject = null,
    keySkills = [],
    sacId = null,
} = {}) {
    if (!norm(subject)) return [];
    const inSubject = (c) => same(c?.subject_name, subject);
    const deck = (flashcards || []).filter((c) => inSubject(c) && c?.topic !== BANK_TOPIC);
    const bank = (flashcards || []).filter((c) => inSubject(c) && c?.topic === BANK_TOPIC && !isRetired(c));
    const subjectQuizzes = (quizzes || []).filter((q) => same(q?.subject, subject));
    const quizIds = new Set(subjectQuizzes.map((q) => q.id));
    const sits = (attempts || []).filter((a) => quizIds.has(a?.quiz_id) && !isRetryAttempt(a));

    const out = [];
    const seenLabels = new Set();
    const push = (chip) => {
        const k = norm(chip.label);
        if (!k || seenLabels.has(`${chip.context ? "c" : "t"}:${k}`)) return;
        seenLabels.add(`${chip.context ? "c" : "t"}:${k}`);
        out.push({ on: true, context: false, ...chip });
    };

    // 1. Cards that keep missing. A topic with reviews whose miss rate is a
    //    real 0 is never here — `weakTopicsFrom` keeps it on flagged cards
    //    alone, and "0% missed" under a weakness is the sentence recallSuggest
    //    records a screenshot catching.
    for (const t of weakTopicsFrom(deck).slice(0, EVIDENCE_LIMITS.weak)) {
        const pct = t.missRate;
        const detail = pct != null && pct > 0
            ? `${pct}% of your reviews missed`
            : t.weakCards > 0 ? `${plural(t.weakCards, "card")} flagged weak` : null;
        if (!detail) continue;
        push({
            id: `weak:${norm(t.topic)}`, kind: "weak", label: t.topic, detail,
            source: "Your flashcards",
            prompt: `${t.topic} — ${detail} on their flashcards`,
        });
    }

    // 2. The same criterion dropped more than once, still open. One thing to
    //    fix instead of four, which is the most useful line the bank has.
    const repeats = repeatOffenders(bank, { attempts: sits }).filter((r) => r.open > 0);
    for (const r of repeats.slice(0, EVIDENCE_LIMITS.repeat)) {
        push({
            id: `repeat:${norm(r.criterion)}`, kind: "repeat", label: clipWords(r.criterion),
            detail: `Dropped ${r.count} times`, source: "Mistake bank",
            prompt: `Keeps losing the mark for "${r.criterion}" — dropped ${r.count} times in marked quizzes`,
        });
    }

    // 3. Open mistakes by topic, beyond the repeats above.
    const openByTopic = new Map();
    for (const c of bank) {
        if (fixState(c, sits) === "fixed") continue;
        const topic = mistakeMeta(c).topic;
        if (!topic) continue;
        openByTopic.set(topic, (openByTopic.get(topic) || 0) + 1);
    }
    [...openByTopic.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, EVIDENCE_LIMITS.open)
        .forEach(([topic, n]) => push({
            id: `open:${norm(topic)}`, kind: "open", label: clipWords(topic),
            detail: `${plural(n, "mistake")} not fixed yet`, source: "Mistake bank",
            prompt: `${topic} — ${plural(n, "banked mistake")} not fixed yet`,
        }));

    // 4. The command-term tier they lose marks on, only when the gap is real
    //    (`hasGap`, fifteen points) — a weakest tier three points under the
    //    strongest is noise, and naming it would send the plan after nothing.
    const terms = commandTermStats(sits);
    if (terms.weakest && terms.hasGap) {
        push({
            id: `terms:${terms.weakest.id}`, kind: "terms", label: `${terms.weakest.label} questions`,
            detail: `${terms.weakest.pct}% of marks`, source: "Your quizzes",
            prompt: `Loses marks on ${terms.weakest.label.toLowerCase()} questions — ${terms.weakest.pct}% of the marks available`,
        });
    }

    // 5. Course areas with nothing against them. Said as what the app can SEE
    //    ("not in your decks or quizzes yet"), never as "you have never studied
    //    this" — a student may have covered it in class, and the claim this
    //    page can stand behind is only about their work here.
    const topics = [
        ...deck.map((c) => c.topic),
        ...subjectQuizzes.map((q) => q.title),
    ].filter(Boolean);
    const cov = coverage(keySkills, topics);
    for (const skill of cov.untouched.slice(0, EVIDENCE_LIMITS.untouched)) {
        push({
            id: `untouched:${norm(skill)}`, kind: "untouched", label: skill,
            detail: "Not in your decks or quizzes yet", source: "Study design",
            prompt: `${skill} — a study-design area with nothing in their decks or quizzes yet`,
        });
    }

    // The cap is on TOPIC chips; the order above is the priority.
    const topicChips = out.filter((c) => !c.context).slice(0, EVIDENCE_LIMITS.topics);

    // 6. How it went last time, off the marks typed into the planner. The same
    //    conversion the markets settle on, so this percentage and that one are
    //    one number. A missing half is null — never a zero — or a mark nobody
    //    entered would read as a fail.
    const marks = (assessments || [])
        .filter((a) => a?.id !== sacId && same(a?.subject_name, subject))
        .map((a) => ({ a, pct: markPercent(a.score, a.out_of) }))
        .filter((m) => m.pct != null)
        .sort((x, y) => String(y.a.due_date || "").localeCompare(String(x.a.due_date || "")));
    const context = [];
    if (marks.length) {
        const last = marks[0];
        const avg = marks.length >= MARK_AVERAGE_AT
            ? Math.round(marks.reduce((s, m) => s + m.pct, 0) / marks.length) : null;
        context.push({
            id: "mark", kind: "mark", context: true, on: true,
            label: `Last ${subject} mark ${last.pct}%`,
            detail: avg != null ? `Averaging ${avg}% over ${marks.length}` : (last.a.title || "From your planner"),
            source: "Your planner",
            prompt: `Their last ${subject} assessment (${last.a.title || "untitled"}) was ${last.pct}%`
                + (avg != null ? `; they average ${avg}% across ${marks.length} recorded marks` : ""),
        });
    }

    // 7. What they are aiming for, off the curve on their subject. A target is
    //    a goal they set; nothing here guesses one.
    const target = Number(userSubject?.goal_study_score);
    if (userSubject?.goal_study_score != null && Number.isFinite(target) && target > 0) {
        context.push({
            id: "target", kind: "target", context: true, on: true,
            label: `Aiming for ${target}`, detail: "Your target study score", source: "Subjects",
            prompt: `They are aiming for a study score of ${target} in ${subject}`,
        });
    }

    return [...topicChips, ...context];
}

/**
 * A student's own addition, normalised. Empty, duplicate or over-long entries
 * are refused rather than trimmed into something they did not write.
 */
export function customChip(text, existing = []) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > CUSTOM_LEN) return null;
    if (existing.some((c) => norm(c.label) === norm(t))) return null;
    if (existing.filter((c) => c.kind === "custom").length >= CUSTOM_MAX) return null;
    return {
        id: `custom:${norm(t)}`, kind: "custom", label: t, detail: "You added this",
        source: "You", prompt: `${t} (the student named this themselves)`, on: true, context: false,
    };
}
