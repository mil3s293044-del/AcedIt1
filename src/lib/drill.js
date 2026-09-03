/**
 * drill — the same mistake, asked harder each time you get it right.
 *
 * ─── The problem with a flashcard here ──────────────────────────────────────
 * A banked mistake used to be an ordinary two-sided card: read the prompt,
 * read the model wording, rate yourself. That is RECOGNITION, and recognition
 * is the weakest thing you can do with a mistake — it feels like learning
 * because the answer looks familiar when you see it, which is exactly the
 * illusion the whole app exists to argue against. The landing page calls
 * rereading out by name and then the mistake bank did the same thing in a
 * nicer frame.
 *
 * ─── The ladder ─────────────────────────────────────────────────────────────
 * So a mistake gets harder as the student gets it right:
 *
 *   RECOGNISE  first time. What they wrote, and what would have scored. There
 *              is nothing to retrieve yet — they have not been told the answer
 *              once. Asking somebody to produce a wording nobody has shown
 *              them is a test, not a drill.
 *   SPOT       their own sentence, with the words that cost the mark to be
 *              found in it. The first rung that asks for a JUDGEMENT rather
 *              than a memory, and it is the one that generalises: a student
 *              who can see the weak phrase in their own writing catches the
 *              next one before it is marked.
 *   CLOZE      the model wording with the load-bearing terms removed, and
 *              those same terms as the word bank. Cheap, fast, and it targets
 *              precisely the words the criterion turns on.
 *   REPAIR     their sentence, editable, rewritten so it would score — marked
 *              against that one criterion. Production, but anchored to what
 *              they actually wrote, which is a smaller and fairer ask than a
 *              blank box and teaches the edit rather than a replacement text.
 *   REDO       the whole question again, in the quiz, marked. Not a rung on
 *              this ladder — it is the GATE past it, and it lives in
 *              mistakeBank's `clearedBy` because it is evidence rather than
 *              rehearsal. Nothing here can prove a mistake is gone; only
 *              writing the answer again can.
 *
 * Expanding retrieval plus the generation effect, on the app's own schedule —
 * the stage is read off `repetitions`, which SM-2 already maintains, so
 * nothing new is stored and the ladder cannot drift out of step with the
 * scheduler.
 *
 * ─── A stage that cannot be built is never forced ───────────────────────────
 * A cloze needs at least two blankable terms. Some model wordings do not have
 * them — a one-clause fix, an answer that is all common words. Rather than
 * blanking a stopword and asking a student to guess "the", the ladder falls
 * back a rung. Every function here returns null instead of degrading.
 */

export const STAGES = ["recognise", "spot", "cloze", "repair"];

/** Correct recalls before the rung goes up. */
const SPOT_AFTER = 1;
const CLOZE_AFTER = 2;
const REPAIR_AFTER = 4;

/**
 * The counter value at which every rung has been passed at least once.
 *
 * Exported because mistakeBank's "has the rehearsal finished" test has to
 * agree with this file about where the ladder ends. It used to ask a different
 * question entirely — two consecutive good recalls — which a student could
 * satisfy on the SECOND rung and never see the top two at all. "Pass all the
 * modules" has to mean passing all the modules.
 */
export const LADDER_COMPLETE_AT = REPAIR_AFTER + 1;

// Blanking one of these teaches nothing and reads as a bug.
const STOP = new Set(`a an the and or but of to in on at by for with from as is are was were
be been being it its this that these those they them their there then than so such which who whom
whose what when where why how not no nor if into over under about across through during before
after above below up down out off again further once here also very can will just do does did
your you i we he she has have had would could should may might must own same too s t don now`
    .split(/\s+/));

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ");

/**
 * Which rung this card is on.
 *
 * Read off the SM-2 counters rather than stored, so a card reset by a lapse
 * drops back down the ladder with the scheduler rather than staying hard while
 * its interval collapses — which would be the worst of both.
 */
export function drillStage(card) {
    const reps = Number(card?.repetitions) || 0;
    if (reps >= REPAIR_AFTER) return "repair";
    if (reps >= CLOZE_AFTER) return "cloze";
    if (reps >= SPOT_AFTER) return "spot";
    return "recognise";
}

/**
 * The words a cloze should remove.
 *
 * THE CRITERION DECIDES. A term that appears in both the model wording and the
 * criterion is a term the mark turns on — "fairness", "equality", "access" —
 * and those are exactly what a student who wrote a vague answer left out.
 * Words that appear only in the answer are its scaffolding, and blanking
 * scaffolding produces a puzzle about grammar rather than about the subject.
 *
 * Falls back to the rarest long words in the answer when the criterion shares
 * nothing with it, because a criterion phrased in completely different words
 * is still a real criterion.
 */
export function keyTerms(answer, criterion, { max = 3 } = {}) {
    const words = norm(answer).split(/\s+/).filter(Boolean);
    const critSet = new Set(norm(criterion).split(/\s+/).filter(Boolean));

    const seen = new Set();
    const candidate = (w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w);

    const shared = [];
    const rest = [];
    words.forEach((w, i) => {
        if (!candidate(w) || seen.has(w)) return;
        seen.add(w);
        // NEVER THE FIRST WORD. A passage that opens with a hole gives the
        // student nothing to work from — the whole value of a cloze is the
        // context around the gap, and the opening word has none before it.
        // "______ uphold the principle of fairness" is a guessing game;
        // "Remedies uphold the principle of ______" is a drill.
        if (i === 0) return;
        (critSet.has(w) ? shared : rest).push(w);
    });
    // Longest first within each group: a longer word is more likely to be the
    // technical one, and a four-letter near-stopword makes a weak blank.
    const byLen = (a, b) => b.length - a.length;
    const picked = [...shared.sort(byLen), ...rest.sort(byLen)].slice(0, max);
    return picked;
}

/**
 * Deterministic shuffle, seeded from the card id.
 *
 * The word bank must not reorder on every render — a student who looks away
 * and back to find the options moved will not trust the screen. Seeded rather
 * than sorted, because alphabetical order would put the answer to the first
 * blank first often enough to be a tell.
 */
function seededShuffle(list, seed) {
    let h = 0;
    for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        h = (h * 1103515245 + 12345) >>> 0;
        const j = h % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * The model wording as a fill-in-the-gap, or null if it cannot be one.
 *
 * Returns segments so the renderer never has to parse a string with markers in
 * it — text, blank, text, blank — plus the shuffled bank. Only the FIRST
 * occurrence of a term is blanked: removing every "fairness" from a paragraph
 * leaves a sentence nobody can read, let alone complete.
 */
export function buildCloze(card, { minBlanks = 2, maxBlanks = 3 } = {}) {
    const answer = String(card?.answer || "").trim();
    if (!answer) return null;
    // The first wording only. A back with two alternatives joined by "or" is
    // for reading; blanking both is asking the same question twice.
    const body = answer.split(/\n\s*or\s*\n/i)[0].trim();
    // Three gaps, not four. Four holes in one sentence stops being a recall
    // exercise and becomes a word-order puzzle, and the extra one is always
    // the weakest candidate by definition.
    const terms = keyTerms(body, card?.extra?.mistake?.criterion || "", { max: maxBlanks });
    if (terms.length < minBlanks) return null;

    const segments = [];
    let cursor = 0;
    const used = [];
    for (const term of terms) {
        // Word-boundary match on the original text, so the blank lands on the
        // real casing and the rest of the sentence survives intact.
        const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        const rel = body.slice(cursor).search(re);
        if (rel === -1) continue;
        const at = cursor + rel;
        const matched = body.slice(at).match(re)[0];
        segments.push({ text: body.slice(cursor, at) });
        segments.push({ blank: used.length, answer: matched });
        used.push(matched);
        cursor = at + matched.length;
    }
    if (used.length < minBlanks) return null;
    segments.push({ text: body.slice(cursor) });

    return {
        segments,
        answers: used,
        bank: seededShuffle(used, card?.id || used.join("")),
    };
}

/** Case- and punctuation-insensitive, because a drill is not a spelling test. */
export const sameTerm = (a, b) => norm(a).trim() === norm(b).trim();

/**
 * Did they fill every gap correctly?
 *
 * Returns the per-blank verdict as well as the total, because "you got two of
 * three" with no indication of WHICH is a mark without a reason — the same
 * failure the quiz marking exists to fix.
 */
export function gradeCloze(cloze, filled = []) {
    if (!cloze) return null;
    const each = cloze.answers.map((a, i) => sameTerm(a, filled[i] || ""));
    const right = each.filter(Boolean).length;
    return { each, right, total: cloze.answers.length, allRight: right === cloze.answers.length };
}

// ─── Spot the error ─────────────────────────────────────────────────────────

/**
 * Their own sentence, with the words that cost the mark marked as the target.
 *
 * ─── Where the target comes from ────────────────────────────────────────────
 * A word-level DIFF between what they wrote and what would have scored. The
 * marker already returns both — the quoted phrase and the replacement — and
 * the words present in one and absent from the other are, precisely, the
 * words the mark turned on. Nothing is generated and nothing is guessed: if
 * the two wordings share everything or share nothing, there is no diff worth
 * tapping and the rung is not built.
 *
 * ─── Why tapping rather than reading ────────────────────────────────────────
 * Being shown the weak phrase is recognition; FINDING it is the judgement a
 * student has to make while writing, when nobody has underlined anything yet.
 * It is also the only rung that works on the student's own words rather than
 * on a model answer, which is what makes it transfer.
 *
 * Returns tokens rather than a marked-up string so the renderer never parses:
 * `{ words: [{ text, index, wrong }], targets, wanted }`.
 */
export function buildSpot(card, { minTargets = 1, maxTargets = 4 } = {}) {
    const quote = String(card?.extra?.mistake?.quote || "").trim();
    const wanted = String(card?.extra?.mistake?.wanted || "").trim();
    if (!quote || !wanted) return null;

    // Split on whitespace but KEEP the original tokens, punctuation and all —
    // a student taps the word as they wrote it, not a normalised copy of it.
    const raw = quote.split(/(\s+)/).filter((t) => t !== "");
    const wantedSet = new Set(norm(wanted).split(/\s+/).filter(Boolean));

    const words = [];
    let i = 0;
    for (const tok of raw) {
        if (/^\s+$/.test(tok)) { words.push({ text: tok, space: true }); continue; }
        const n = norm(tok).trim();
        // A word is a candidate when it is theirs alone AND carries meaning. A
        // stopword that happens to differ is a grammatical accident of two
        // phrasings, and asking somebody to tap "the" teaches them that the
        // exercise is noise.
        const wrong = !!n && !wantedSet.has(n) && !STOP.has(n) && n.length >= 3;
        words.push({ text: tok, index: i++, wrong, weight: n.length });
    }

    // THE FOUR MOST LOAD-BEARING, not everything that differs. A casual
    // sentence compared against a tight model phrase differs almost
    // everywhere — "the situation was unfair to Mary because she got less
    // money" against "equality is undermined because like cases are not
    // treated alike" flags six of eight words, which is not a drill, it is
    // "your sentence is wrong". Longest-first is the same proxy for
    // technical weight that `keyTerms` uses on the other rung: "situation"
    // and "unfair" carry the mistake, "got" and "less" are how English works.
    const ranked = words.filter((w) => w.wrong).sort((a, b) => b.weight - a.weight);
    for (const w of ranked.slice(maxTargets)) w.wrong = false;

    const targets = words.filter((w) => w.wrong).length;
    const tokens = words.filter((w) => !w.space).length;
    // No differing words: the two wordings say the same thing and there is
    // nothing to find.
    if (targets < minTargets) return null;
    // Too many, PROPORTIONALLY. "Most of this sentence" is not a spot — it is
    // a rewrite, which is the rung above, and asking a student to tap almost
    // every word makes tapping every word the right answer. The threshold is a
    // share of the sentence rather than a count, because three wrong words in
    // four is the whole sentence and three in twenty is a phrase.
    if (!tokens || targets / tokens > 0.5) return null;

    return { words, targets, wanted };
}

/**
 * Marked on BOTH kinds of miss.
 *
 * Tapping every word gets full marks on a scheme that only counts hits, so
 * false positives count against you exactly as misses do. Otherwise the
 * winning strategy is to tap everything, and a drill with a winning strategy
 * that is not "know the answer" teaches the strategy.
 */
export function gradeSpot(spot, picked = []) {
    if (!spot) return null;
    const chosen = new Set(picked);
    const targets = spot.words.filter((w) => w.wrong).map((w) => w.index);
    const hits = targets.filter((i) => chosen.has(i));
    const falsePositives = [...chosen].filter((i) => !targets.includes(i));
    const right = Math.max(0, hits.length - falsePositives.length);
    return {
        targets,
        hits,
        falsePositives,
        right,
        total: targets.length,
        allRight: hits.length === targets.length && falsePositives.length === 0,
    };
}

/**
 * The rating a result suggests, on the app's 1–4 scale.
 *
 * SUGGESTS. The student still presses the button — an app that grades a typed
 * answer and then schedules the card on its own verdict has taken away the one
 * judgement only they can make, which is whether they actually knew it or
 * guessed. Everything else in the review flow is self-rated and this stays
 * consistent with it.
 */
export function suggestRating({ right, total }) {
    if (!total) return null;
    if (right === total) return 4;
    if (right >= Math.ceil(total * 0.6)) return 3;
    if (right > 0) return 2;
    return 1;
}

/**
 * What to actually show, given the card and what could be built.
 *
 * One place decides, so the runner never has to ask "is there a cloze" and
 * "which stage" separately and risk answering them inconsistently.
 */
export function drillFor(card) {
    const stage = drillStage(card);

    // Each rung falls back to the one below rather than degrading, and the
    // fallbacks CASCADE: a card with no quote cannot be spotted, and if its
    // model wording also has nothing worth blanking it cannot be clozed
    // either, so it lands on recognise. Checking one level down and stopping
    // would leave a card showing an empty cloze.
    if (stage === "repair") {
        const criterion = String(card?.extra?.mistake?.criterion || "").trim();
        // Repair needs something to mark against. Without a criterion the
        // prompt would be "rewrite this to satisfy the thing you cannot see".
        if (criterion) return { stage: "repair", criterion, quote: String(card?.extra?.mistake?.quote || "").trim() };
    }
    if (stage === "repair" || stage === "cloze") {
        const cloze = buildCloze(card);
        if (cloze) return { stage: "cloze", cloze };
    }
    if (stage !== "recognise") {
        const spot = buildSpot(card);
        if (spot) return { stage: "spot", spot };
    }
    return { stage: "recognise" };
}

// ─── The ladder, as something a student can see ─────────────────────────────

/**
 * The five steps, in order, with what each one asks for.
 *
 * The labels are the ASK, not the technique. "Cloze" means nothing to a
 * seventeen-year-old and "Put the words back" means exactly what will happen.
 */
export const LADDER = [
    { id: "recognise", label: "See it",   blurb: "Read what would have scored." },
    { id: "spot",      label: "Spot it",  blurb: "Find the words that cost the mark." },
    { id: "cloze",     label: "Fill it",  blurb: "Put the load-bearing words back." },
    { id: "repair",    label: "Fix it",   blurb: "Rewrite it so it scores." },
    { id: "redo",      label: "Prove it", blurb: "Sit the whole question again." },
];

/** Which rung a `repetitions` count sits on, without the buildability check. */
const rawStageIndex = (card) => {
    const reps = Number(card?.repetitions) || 0;
    if (reps >= REPAIR_AFTER) return 3;
    if (reps >= CLOZE_AFTER) return 2;
    if (reps >= SPOT_AFTER) return 1;
    return 0;
};

/**
 * Every step of one mistake's journey, for the progress tracker.
 *
 * ─── Why show this at all ───────────────────────────────────────────────────
 * The ladder is the most useful thing about the bank and it was completely
 * invisible: a student saw one exercise, rated it, and had no idea whether
 * that was the first of two or the third of five. A card said "coming back"
 * and nothing else, so the only way to find out how close a mistake was to
 * done was to keep doing it and see.
 *
 * ─── A skipped rung is shown as skipped ─────────────────────────────────────
 * Not every rung can be built for every mistake — spotting needs the student's
 * own words, filling needs a wording with something worth blanking. `drillFor`
 * already falls back when a rung cannot be built; this says so on the tracker
 * rather than drawing a step that will never happen. Pretending the ladder is
 * five long for a card that will only ever see three is the same class of lie
 * as a progress bar that jumps.
 *
 * ─── The two facts it cannot work out for itself ────────────────────────────
 * `laddered` (the SM-2 counters say the rehearsal is complete) and `cleared`
 * (a later sit of the question earned the criterion back) both live in
 * mistakeBank, and both are passed in rather than guessed at — this file must
 * not grow a second opinion about when a mistake is done.
 *
 * `laddered` matters for more than tidiness. The rung is read off
 * `repetitions`, which stops climbing at the top rehearsal rung, so without it
 * a card sits on "Fix it" as CURRENT forever and the tracker can never reach
 * the end. A student who has finished would be looking at four of five.
 */
export function ladderFor(card, { cleared = false, laddered = false } = {}) {
    const at = rawStageIndex(card);
    const buildable = {
        recognise: true,
        spot: !!buildSpot(card),
        cloze: !!buildCloze(card),
        repair: !!String(card?.extra?.mistake?.criterion || "").trim(),
        // The gate is always available in principle — a mistake with no source
        // question is the one exception, and it reports as fixed on the ladder
        // alone rather than showing a step it can never take.
        redo: !!card?.extra?.mistake?.source,
    };

    return LADDER.map((step, i) => {
        if (step.id === "redo") {
            return {
                ...step,
                state: !buildable.redo ? "skipped"
                    : cleared ? "done"
                    // The gate is the live step the moment the rehearsal is
                    // done, and only then — offering "sit it again" to
                    // somebody two rungs off is asking for the exam before
                    // the revision.
                    : laddered || at >= LADDER.length - 2 ? "current" : "todo",
            };
        }
        if (!buildable[step.id]) return { ...step, state: "skipped" };
        // The rehearsal is finished as a whole, so every rung of it is behind
        // them — including the one the counter is still parked on.
        if (laddered) return { ...step, state: "done" };
        // Everything below where the counter has reached is done, whether or
        // not it was ever shown — the student got past it either way.
        return { ...step, state: i < at ? "done" : i === at ? "current" : "todo" };
    });
}

/** How far along, as a fraction, counting only the steps this card will see. */
export function ladderProgress(steps = []) {
    const live = steps.filter((s) => s.state !== "skipped");
    if (!live.length) return { done: 0, total: 0, pct: 0 };
    const done = live.filter((s) => s.state === "done").length;
    return { done, total: live.length, pct: Math.round((done / live.length) * 100) };
}
