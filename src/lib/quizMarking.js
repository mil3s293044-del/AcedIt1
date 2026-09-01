/**
 * quizMarking — a mark that shows its working.
 *
 * The marker used to return `{ marks, what_wrong, improve }`: a number and two
 * paragraphs. The landing page, meanwhile, shows the thing students are
 * actually being sold — a criterion list where you can see WHICH mark you
 * dropped, and a word-level edit showing what the better answer said instead.
 * The page was writing a cheque the product did not cash.
 *
 * So a mark is now itemised:
 *
 *   criteria — what the assessor was looking for, each got or missed, each
 *              worth a stated number of marks. This is the part that turns
 *              "you got 2 out of 4" into something a student can act on.
 *   edits    — word or phrase level swaps in their own answer, with what the
 *              swap buys. The landing page's MarkedWord, applied to their work.
 *
 * ─── The rule that keeps it honest ──────────────────────────────────────────
 * THE ITEMISATION IS THE TRUTH. If a model returns "2 marks" and then lists
 * three criteria it says were all met, one of those two statements is wrong,
 * and the student can see both at once. The criteria win — they are the
 * working, the number is the summary — and the number is recomputed from them.
 * A total that visibly contradicts the list under it costs the marking all its
 * credibility, which is the one thing this feature is for.
 *
 * Everything degrades. A response with no criteria falls back to the prose
 * shape and renders as it always did; a mark that arrives as nonsense scores
 * zero rather than poisoning the total.
 *
 * ─── The criteria are the LEDGER, and annotations are evidence for it ───────
 * These were two independent verdicts and they contradicted each other. The
 * criteria said which marks were dropped; the annotations, chosen separately
 * by the model, said "Cost a mark −1" on a phrase — with nothing making the
 * two agree. A student could read "3/3, all criteria met" above their own
 * sentence underlined in red and told it cost them a mark. That is the
 * incoherence, and it is not a wording problem: an annotation is not a
 * verdict, it is a POINTER at where a criterion was lost.
 *
 * So every annotation is now linked to a criterion, and the link decides what
 * it may claim:
 *
 *   linked to a MISSED criterion  → it cost that criterion's marks, exactly
 *   linked to an EARNED criterion → it survived; it is imprecise, not costly
 *   linked to nothing             → it may not claim a mark it isn't attached to
 *
 * Marks lost is therefore the sum of the missed criteria and nothing else,
 * which is `outOf - marks` by construction. Every number on the screen comes
 * from that one subtraction.
 *
 * ─── A module is what a student acts on ─────────────────────────────────────
 * `markModules` turns the ledger into one block per mark: what was wanted,
 * whether they got it, what it cost, where it shows in their own words, and
 * what would have scored. EVERY missed mark gets one, whether or not the
 * marker managed to quote a phrase for it — a criterion like "does not name
 * the transfer" has nothing to quote precisely because the words are absent,
 * and that used to be the mistake a student could neither read about nor save.
 */

import { normaliseAnnotation } from "@/lib/annotate";

const str = (v) => (typeof v === "string" ? v.trim() : "");
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** A criterion is only worth rendering if it says what was being looked for. */
function normaliseCriterion(raw, fallbackWorth) {
    const text = str(raw?.text || raw?.criterion);
    if (!text) return null;
    const worth = Number(raw?.worth);
    return {
        text,
        got: raw?.got === true,
        note: str(raw?.note),
        worth: Number.isFinite(worth) && worth > 0 ? worth : fallbackWorth,
    };
}

/** An edit needs both halves; "improve your wording" is not an edit. */
function normaliseEdit(raw) {
    const was = str(raw?.was), now = str(raw?.now);
    if (!was || !now || was === now) return null;
    const worth = Number(raw?.worth);
    return {
        was, now,
        why: str(raw?.why),
        criterion: str(raw?.criterion) || "Word choice",
        worth: Number.isFinite(worth) && worth > 0 ? worth : 1,
    };
}

/**
 * Which criterion does this annotation belong to?
 *
 * The model names the criterion in free text, so it comes back as "(b) names
 * the transfer" against a criterion reading "Names the electron transfer" —
 * the same mark, spelled two ways. Matching is therefore progressive, and it
 * REFUSES rather than guesses: an annotation attached to the wrong criterion
 * would blame the wrong mark, which is the failure this whole join exists to
 * prevent. Unlinked is a safe, visible outcome; mislinked is not.
 */
const key = (v) => str(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Below this a "match" is a coincidence. "the", "it", "(b)" all appear in
// every criterion on the page.
const MIN_CONTAINMENT = 8;

export function criterionIndexFor(ann, criteria) {
    if (!criteria.length) return null;

    // 1. The model said which one outright. Tested WITHOUT Number(), because
    // Number(null) is 0 — coercing here silently attached every unlinked
    // annotation to the first criterion on the page, which is precisely the
    // mislink this function exists to refuse.
    const stated = ann?.criterionIndex;
    if (Number.isInteger(stated) && stated >= 0 && stated < criteria.length) return stated;

    const label = key(ann?.criterion);
    if (!label) return null;

    // 2. Same criterion, same words.
    const exact = criteria.findIndex((c) => key(c.text) === label);
    if (exact !== -1) return exact;

    // 3. One contains the other — the model abbreviating, or quoting the
    //    criterion with the part label glued on. Longest overlap wins so a
    //    criterion that is a prefix of another does not steal the match.
    let best = null, bestLen = 0;
    criteria.forEach((c, i) => {
        const t = key(c.text);
        if (t.length < MIN_CONTAINMENT || label.length < MIN_CONTAINMENT) return;
        if (!t.includes(label) && !label.includes(t)) return;
        const len = Math.min(t.length, label.length);
        if (len > bestLen) { best = i; bestLen = len; }
    });
    return best;
}

/**
 * Attach each annotation to a criterion, and make it claim only what that
 * link entitles it to.
 *
 * This is where the two halves of the marking are forced to agree. See the
 * header: severity and worth are no longer the model's opinion, they are read
 * off the ledger.
 */
function linkAnnotations(annotations, criteria) {
    if (!criteria.length) {
        // No ledger at all — a degraded response with annotations and nothing
        // to reconcile them against. They keep what the model said, because
        // overriding it here would delete the only marking there is.
        return annotations.map((a) => ({ ...a, criterionIndex: null }));
    }
    return annotations.map((a) => {
        const i = criterionIndexFor(a, criteria);
        if (i == null) {
            // It cannot bill a mark it is not attached to.
            return { ...a, criterionIndex: null, severity: "risk", worth: 0 };
        }
        const c = criteria[i];
        return {
            ...a,
            criterionIndex: i,
            // The label becomes the criterion's own wording. The model's was a
            // paraphrase of it at best, and the phrase's label is what the
            // student reads when they point at it — it has to name the mark
            // they will find when they follow it.
            criterion: c.text,
            severity: c.got ? "risk" : "lost",
            worth: c.got ? 0 : c.worth,
        };
    });
}

/**
 * One part's mark, itemised and reconciled.
 *
 * `outOf` comes from the part, never from the model — a marker that invents
 * its own denominator can quietly rescale a student's score.
 */
export function normaliseMark(raw, outOf = 1) {
    const max = Math.max(1, Number(outOf) || 1);
    const m = raw && typeof raw === "object" ? raw : {};

    const criteria = (Array.isArray(m.criteria) ? m.criteria : [])
        .map((c) => normaliseCriterion(c, 1))
        .filter(Boolean);
    const edits = (Array.isArray(m.edits) ? m.edits : [])
        .map(normaliseEdit)
        .filter(Boolean);
    // Spans of the student's own answer to underline in place. `edits` was the
    // first shape of this and normaliseAnnotation still reads it, so a marker
    // response written against the old prompt keeps working.
    const rawAnnotations = [
        ...(Array.isArray(m.annotations) ? m.annotations : []),
        ...(Array.isArray(m.edits) ? m.edits : []),
    ].map(normaliseAnnotation).filter(Boolean);
    // Linked BEFORE anything is rendered, so no part of the UI can show an
    // annotation claiming a mark the criteria say was earned.
    const annotations = linkAnnotations(rawAnnotations, criteria);

    const stated = Number(m.marks);
    let marks = Number.isFinite(stated) ? clamp(stated, 0, max) : 0;
    let reconciled = false;

    if (criteria.length > 0) {
        // The itemisation wins. See the header — a total that contradicts the
        // list printed under it is worse than either one alone.
        const fromCriteria = clamp(
            criteria.reduce((sum, c) => sum + (c.got ? c.worth : 0), 0), 0, max);
        reconciled = fromCriteria !== marks;
        marks = fromCriteria;
    }

    return {
        marks,
        outOf: max,
        criteria,
        edits,
        annotations,
        // Kept so a response with no itemisation renders exactly as it used to.
        whatWrong: str(m.what_wrong || m.whatWrong),
        improve: str(m.improve),
        reconciled,
        itemised: criteria.length > 0 || annotations.length > 0,
    };
}

/** Did they get everything? Used for the "clean mark" state. */
export const isFullMarks = (mark) => mark.outOf > 0 && mark.marks >= mark.outOf;

/**
 * The criteria worth showing first: the ones they missed.
 *
 * A list that opens with three ticks buries the one line the student needed to
 * read. Missed first, then the ones they got, each keeping its own order.
 */
export function orderedCriteria(mark) {
    const missed = mark.criteria.filter((c) => !c.got);
    const got = mark.criteria.filter((c) => c.got);
    return [...missed, ...got];
}

/**
 * Marks lost. The ONE number every "this cost you" figure on the screen comes
 * from, and by construction it equals `outOf - marks`, because `normaliseMark`
 * computed `marks` from these same criteria.
 */
export const marksLost = (mark) =>
    mark.criteria.filter((c) => !c.got).reduce((sum, c) => sum + c.worth, 0);

const uniq = (list) => [...new Set(list.map((x) => str(x)).filter(Boolean))];

/** The first non-empty of several candidates. */
const firstOf = (...vals) => vals.map(str).find(Boolean) || "";

/**
 * The mark, as blocks a student can act on — one per mark that was on offer.
 *
 * A module is a criterion plus everything we know about it: what it cost, the
 * spans of their own answer that show it, what the assessor wanted, and the
 * wordings that would have scored. The point is that a MISSED mark always gets
 * one. The old panel only had somewhere to put "what to do about it" when the
 * marker had quoted a phrase, and the criteria that most need explaining are
 * exactly the ones with nothing to quote: you cannot underline the sentence a
 * student did not write.
 *
 * `status` is the whole vocabulary:
 *   lost    — a criterion they missed. This is what cost them.
 *   earned  — a criterion they met.
 *   risk    — imprecise wording that survived. Costs nothing, says so.
 */
export function markModules(mark) {
    if (!mark) return [];
    const criteria = mark.criteria || [];
    const annotations = mark.annotations || [];

    const modules = criteria.map((c, i) => {
        const evidence = annotations.filter((a) => a.criterionIndex === i);
        return {
            id: `c${i}`,
            kind: "criterion",
            status: c.got ? "earned" : "lost",
            text: c.text,
            // The criterion's own note first: it was written about this mark.
            // An annotation's `wanted` is about one phrase inside it.
            detail: firstOf(c.note, ...evidence.map((a) => a.issue)),
            // ONLY a genuine statement of what would have scored. This used to
            // fall back to the criterion's note, which is the examiner's remark
            // on what went wrong — so a module headed "The assessor wanted"
            // read "the response asserts electricity is produced without
            // linking it to...". Mislabelling the diagnosis as the remedy is
            // worse than having no remedy: the student copies the criticism.
            // The criterion text is itself the statement of what was wanted,
            // and it is already the module's heading.
            wanted: firstOf(...evidence.map((a) => a.wanted)),
            worth: c.worth,
            cost: c.got ? 0 : c.worth,
            evidence,
            fixes: uniq(evidence.flatMap((a) => a.fixes)),
        };
    });

    // Annotations the join could not attach. They are kept — the marker saw
    // something real — but they are stated as what they are: a note on the
    // wording, not a mark. Grouped by the label the model gave so three
    // observations about one thing read as one module.
    const orphans = annotations.filter((a) => a.criterionIndex == null);
    const byLabel = new Map();
    for (const a of orphans) {
        const k = key(a.criterion) || a.id;
        if (!byLabel.has(k)) byLabel.set(k, []);
        byLabel.get(k).push(a);
    }
    let n = 0;
    for (const group of byLabel.values()) {
        // With no criteria at all there is no ledger to contradict, so an
        // annotation the model called "lost" is the only verdict available.
        const lost = criteria.length === 0 && group.some((a) => a.severity === "lost");
        modules.push({
            id: `n${n++}`,
            kind: "note",
            status: lost ? "lost" : "risk",
            text: firstOf(group[0].criterion, "Wording"),
            detail: firstOf(...group.map((a) => a.issue)),
            wanted: firstOf(...group.map((a) => a.wanted)),
            worth: lost ? group[0].worth : 0,
            cost: lost ? group[0].worth : 0,
            evidence: group,
            fixes: uniq(group.flatMap((a) => a.fixes)),
        });
    }

    // Lost first, then the loose notes, then what they earned. A student opens
    // this to find out what went wrong; three ticks before the first cross is
    // the panel burying its own point.
    const rank = { lost: 0, risk: 1, earned: 2 };
    return modules
        .map((m, i) => ({ m, i }))
        .sort((a, b) => (rank[a.m.status] - rank[b.m.status]) || (a.i - b.i))
        .map(({ m }) => m);
}

/**
 * A module is worth saving if rehearsing it would change a future answer.
 *
 * Every lost mark qualifies, with or without a quote — that is the whole
 * repair. A surviving imprecision qualifies only when the marker said what to
 * write instead, because without that the card has no back.
 */
export const isBankable = (mod) =>
    mod.status === "lost" || (mod.status === "risk" && mod.fixes.length > 0);

/**
 * The whole mark in the numbers the panel prints, all derived from one place.
 *
 * `lost` is the sum of the missed criteria, and `earned + lost === outOf`
 * because `normaliseMark` built `marks` out of the same list. Nothing on the
 * screen may compute "what this cost you" any other way.
 */
export function markLedger(mark) {
    const modules = markModules(mark);
    const lostModules = modules.filter((m) => m.status === "lost");
    return {
        outOf: mark?.outOf ?? 0,
        earned: mark?.marks ?? 0,
        lost: marksLost(mark || { criteria: [] }),
        modules,
        lostModules,
        bankable: modules.filter(isBankable),
    };
}
