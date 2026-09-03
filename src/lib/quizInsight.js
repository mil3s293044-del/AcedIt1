/**
 * quizInsight — turning a pile of quiz attempts into what to do next.
 *
 * Three analyses, and they need different things:
 *
 *   • retrievalStrength() runs on data that already exists — date and score
 *     per attempt — so it works on day one.
 *   • weakSpots() and commandTermStats() need per-question results, which the
 *     app did NOT record. `user_answers` stores the index of the option the
 *     student picked, into a per-attempt shuffle that was never persisted, so
 *     a stored attempt genuinely cannot say which questions were missed. The
 *     player now writes `extra.question_results` alongside it; both of these
 *     fill from the next attempt onwards and honestly say so until then.
 *
 * The command-term analysis is the one worth the most to a VCE student. Marks
 * are lost on the verb as often as on the content — you knew it and you
 * described when the question said evaluate — and nothing in the app was
 * looking at that. The term is derived from the question stem, so it needs no
 * new field on the question.
 */

/**
 * VCAA command terms, grouped by what they ask you to do.
 *
 * Order within each tier matters: the scan takes the earliest match in the
 * stem, and multi-word terms are listed before the single words they contain
 * so "distinguish between" doesn't get read as something weaker.
 */
export const COMMAND_TIERS = [
    { id: "recall",   label: "Recall",        tone: "chart-3",
      terms: ["identify", "state", "name", "list", "define", "recall", "label"] },
    { id: "describe", label: "Describe",      tone: "primary",
      terms: ["describe", "outline", "summarise", "summarize", "calculate", "determine", "convert"] },
    { id: "explain",  label: "Explain",       tone: "xp",
      terms: ["explain", "compare", "contrast", "distinguish", "apply", "predict", "illustrate", "account for"] },
    { id: "evaluate", label: "Evaluate",      tone: "streak",
      terms: ["evaluate", "analyse", "analyze", "discuss", "justify", "assess", "critique", "propose", "recommend"] },
];

const TERM_LOOKUP = COMMAND_TIERS.flatMap(t =>
    t.terms.map(term => ({ term, tier: t.id, tierLabel: t.label, tone: t.tone })));

/**
 * Pull the command term out of a question stem.
 *
 * Takes the EARLIEST term in the stem, because VCE questions lead with the
 * verb — "Evaluate the extent to which..." — and a later incidental word
 * ("...and identify one example") is not what the marker is grading.
 */
export function commandTermOf(text) {
    const s = String(text || "").toLowerCase();
    if (!s.trim()) return null;
    let best = null;
    for (const entry of TERM_LOOKUP) {
        const i = s.search(new RegExp(`\\b${entry.term}\\b`));
        if (i < 0) continue;
        // Prefer the earliest; on a tie prefer the longer term, so
        // "account for" beats a stray "for".
        if (!best || i < best.at || (i === best.at && entry.term.length > best.term.length)) {
            best = { ...entry, at: i };
        }
    }
    return best ? { term: best.term, tier: best.tier, tierLabel: best.tierLabel, tone: best.tone } : null;
}

/** Per-question rows the player now writes onto each attempt. */
export const resultsOf = (attempt) => {
    const r = attempt?.extra?.question_results;
    return Array.isArray(r) ? r : [];
};

export const hasQuestionData = (attempts = []) => attempts.some(a => resultsOf(a).length > 0);

/**
 * Was this attempt a "wrong only" retry rather than a run at the whole quiz?
 *
 * It matters because a retry is a run at the HARD SUBSET. Its score is not
 * comparable to a score on the full paper, and treating it as the quiz's most
 * recent result made a student who had just done the right thing — gone back
 * over the questions they missed — look like their retention had collapsed.
 * That is what put "Mathematical Methods — wrong only · 0%" at the top of the
 * fading list: not a decayed quiz, a drill in progress.
 *
 * The flag is written on new attempts. Attempts saved before it existed are
 * recognised by the title the retry path gives them, which is the only trace
 * they left.
 */
export const isRetryAttempt = (a) =>
    a?.extra?.is_retry === true || / — wrong only$/.test(String(a?.quiz_title || ""));

/** The quiz's own title, with any retry suffix taken back off. */
export const baseQuizTitle = (t) => String(t || "").replace(/ — wrong only$/, "");

/**
 * A retry saved BEFORE the player recorded which question of the parent quiz
 * each result belonged to.
 *
 * Its `q_index` counts positions in the subset it was built from — question 5
 * of the quiz, sat as the only question in a retry, recorded as index 0. Read
 * back against the parent quiz that attributes the miss to a question the
 * student may well have got right, and `buildDrillQuestions` then drills that
 * wrong question. There is no way to recover the mapping after the fact, so
 * these are skipped rather than half-trusted.
 */
export const isLegacyRetry = (a) => isRetryAttempt(a) && a?.extra?.is_retry !== true;

// ─── 1. Where you're losing marks ───────────────────────────────────────────

/**
 * Questions the student has now got wrong more than once.
 *
 * Deliberately not "every question you've ever missed": one miss is noise, and
 * a list of forty items is a list nobody acts on. Two misses is a pattern, and
 * the most recent attempt still being wrong is what makes it current rather
 * than historical.
 */
export function weakSpots(attempts = [], { minMisses = 2, limit = 8 } = {}) {
    const byQuestion = new Map();
    const ordered = [...attempts].sort((a, b) =>
        String(a.date || a.created_date || "").localeCompare(String(b.date || b.created_date || "")));

    for (const a of ordered) {
        if (isLegacyRetry(a)) continue;
        for (const r of resultsOf(a)) {
            if (r.is_correct === null || r.is_correct === undefined) continue;   // unmarked
            const key = `${a.quiz_id || baseQuizTitle(a.quiz_title)}::${r.q_index}`;
            const prev = byQuestion.get(key) || {
                key, quizId: a.quiz_id, quizTitle: baseQuizTitle(a.quiz_title),
                quizCategory: a.quiz_category,
                qIndex: r.q_index, question: r.question, type: r.type,
                commandTerm: r.command_term || null, seen: 0, missed: 0, lastCorrect: null,
            };
            prev.seen += 1;
            if (!r.is_correct) prev.missed += 1;
            prev.lastCorrect = !!r.is_correct;
            // Keep the freshest wording, in case the quiz was edited.
            if (r.question) prev.question = r.question;
            byQuestion.set(key, prev);
        }
    }

    return [...byQuestion.values()]
        .filter(q => q.missed >= minMisses && q.lastCorrect === false)
        .sort((a, b) => (b.missed - a.missed) || (b.seen - a.seen))
        .slice(0, limit);
}

/**
 * Rebuild real, playable questions for a drill from the source quizzes.
 *
 * Copies the original question objects rather than asking a model to write new
 * ones: it's free, it's instant, and the whole point is to re-face the exact
 * questions that keep catching you out.
 */
export function buildDrillQuestions(spots = [], quizzes = []) {
    const byId = new Map(quizzes.map(q => [q.id, q]));
    const out = [];
    for (const s of spots) {
        const quiz = byId.get(s.quizId);
        const q = quiz?.questions?.[s.qIndex];
        if (q?.question) out.push({ ...q });
    }
    return out;
}

// ─── 2. Command terms ───────────────────────────────────────────────────────

/**
 * Accuracy per command-term tier.
 *
 * Reported as marks earned over marks available rather than questions right
 * over questions asked, because a 5-mark "evaluate" and a 1-mark "state" are
 * not the same thing to get wrong.
 */
export function commandTermStats(attempts = [], { minMarks = 3 } = {}) {
    const tiers = new Map(COMMAND_TIERS.map(t => [t.id, {
        id: t.id, label: t.label, tone: t.tone, marks: 0, max: 0, questions: 0, terms: new Map(),
    }]));

    for (const a of attempts) {
        for (const r of resultsOf(a)) {
            const ct = r.command_term;
            if (!ct?.tier || !tiers.has(ct.tier)) continue;
            const max = r.marks_max ?? (r.type === "mcq" ? 1 : 5);
            const got = r.marks ?? (r.is_correct ? max : 0);
            if (r.is_correct === null && r.marks === undefined) continue;        // unmarked
            const t = tiers.get(ct.tier);
            t.marks += got; t.max += max; t.questions += 1;
            const term = t.terms.get(ct.term) || { term: ct.term, marks: 0, max: 0 };
            term.marks += got; term.max += max;
            t.terms.set(ct.term, term);
        }
    }

    const rows = [...tiers.values()]
        .filter(t => t.max >= minMarks)
        .map(t => ({
            ...t,
            pct: Math.round((t.marks / t.max) * 100),
            terms: [...t.terms.values()].sort((a, b) => b.max - a.max),
        }));
    // Keep the tiers in cognitive order, not sorted by score — the shape of
    // the ladder is the finding.
    const order = COMMAND_TIERS.map(t => t.id);
    rows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

    const scored = rows.filter(r => r.max >= minMarks);
    const weakest = scored.length ? scored.reduce((w, r) => (r.pct < w.pct ? r : w)) : null;
    const strongest = scored.length ? scored.reduce((s, r) => (r.pct > s.pct ? r : s)) : null;
    return { rows, weakest, strongest, hasGap: !!(weakest && strongest && strongest.pct - weakest.pct >= 15) };
}

// ─── 3. Retrieval strength ──────────────────────────────────────────────────

const DAY = 86400000;
const daysBetween = (a, b) => Math.max(0, (b - a) / DAY);

/**
 * How much of a quiz you'd probably still have right now.
 *
 * An ESTIMATE, and labelled as one everywhere it's shown. The model is a
 * plain exponential decay whose stability grows with the number of times
 * you've passed the quiz — the same shape as the spacing literature, but
 * fitted to nobody's data. It is a prompt for what to revisit, not a
 * measurement of your memory, and overselling it would be exactly the kind of
 * fake-precision this app is trying not to do.
 */
export function retrievalStrength(quizzes = [], attempts = [], now = Date.now()) {
    const byQuiz = new Map();
    for (const a of attempts) {
        // A retry covers only the questions you got wrong, so its score says
        // nothing about the quiz as a whole and its date is not the last time
        // you sat the quiz. Counting it did both: it renamed the row to
        // "… — wrong only" and reported the subset score as the quiz's
        // retention.
        if (isRetryAttempt(a)) continue;
        const key = a.quiz_id || baseQuizTitle(a.quiz_title);
        if (!key) continue;
        if (!byQuiz.has(key)) byQuiz.set(key, []);
        byQuiz.get(key).push(a);
    }

    const out = [];
    for (const [key, list] of byQuiz) {
        const sorted = list.sort((x, y) =>
            String(y.date || y.created_date || "").localeCompare(String(x.date || x.created_date || "")));
        const latest = sorted[0];
        const when = Date.parse(latest.date || latest.created_date || "");
        if (!Number.isFinite(when)) continue;

        const passes = sorted.filter(a => (a.score ?? 0) >= 60).length;
        // Calibrated so the curve is at least plausible. The first draft used a
        // 2-day base, which said a quiz you passed YESTERDAY had already decayed
        // to 68% and that ten days cost you 95% — steep enough to be obviously
        // wrong, and an estimate nobody believes is worse than none.
        //
        // One successful retrieval buys roughly a fortnight before you're down
        // to ~60% of what you had, which is the right order of magnitude for
        // meaningful material that's been tested once. Each further pass
        // stretches it. Never passed it? It holds for days, not weeks.
        const stability = passes === 0 ? 4 : 12 * Math.pow(1.8, Math.min(passes - 1, 4));
        const days = daysBetween(when, now);
        const retention = Math.exp(-days / stability);
        const strength = Math.round(Math.max(0, Math.min(100, (latest.score ?? 0) * retention)));

        // When it's predicted to fall below 60% of what you had.
        const daysLeft = Math.max(0, stability * Math.log(1 / 0.6) - days);
        out.push({
            key,
            quizId: latest.quiz_id,
            title: quizzes.find(q => q.id === latest.quiz_id)?.title
                || baseQuizTitle(latest.quiz_title) || "Untitled quiz",
            category: latest.quiz_category,
            lastScore: Math.round(latest.score ?? 0),
            daysSince: Math.round(days),
            attempts: sorted.length,
            strength,
            dueInDays: Math.round(daysLeft),
            overdue: daysLeft <= 0,
        });
    }
    return out.sort((a, b) => a.strength - b.strength);
}

// ─── 4. One queue, because a student has one next thing ─────────────────────

/**
 * What to work on, in order.
 *
 * ─── Why this replaced three panels ─────────────────────────────────────────
 * The rail used to be "Where you're losing marks", "What the verb is costing
 * you" and "Fading fastest", stacked. Add the mistake bank panel and the
 * "Next quiz" strip on the same page and a student opening Quizzes was told
 * four different things to do next, each with its own heading, its own bar
 * chart and its own idea of what mattered. Four next moves is no next move;
 * choosing between them is work the app is supposed to have already done.
 *
 * So the diagnosis panels moved to /MistakeBank — the screen whose entire job
 * is "what am I getting wrong, and am I fixing it" — and what stays here is
 * the one thing this page can act on: a single ordered list, with a button
 * that plays it.
 *
 * ─── The order is by KIND first, and that is deliberate ─────────────────────
 * A question you have now missed twice is EVIDENCE. A quiz that is fading is
 * an ESTIMATE off a decay curve fitted to nobody's data, and the panel has
 * always said so. Blending them into one number would have meant inventing an
 * exchange rate between the two — how many days of estimated decay equal one
 * demonstrated miss — and then presenting the result as though it were
 * measured. Evidence first, estimate second, each sorted by its own measure,
 * and every row says which it is and why it is there.
 */
export function workQueue(quizzes = [], attempts = [], { limit = 6, now = Date.now() } = {}) {
    const spots = weakSpots(attempts, { limit: 20 });
    const fading = retrievalStrength(quizzes, attempts, now).filter(f => f.overdue);

    const misses = spots.map(s => ({
        id: `miss:${s.key}`,
        kind: "miss",
        title: s.question,
        where: s.quizTitle,
        // The count IS the reason. "Missed 4 of 4" needs no interpreting and
        // cannot be argued with, which is the whole advantage evidence has
        // over an estimate.
        detail: `missed ${s.missed} of ${s.seen}`,
        term: s.commandTerm?.term || null,
        quizId: s.quizId,
        qIndex: s.qIndex,
        spot: s,
    }));

    const stale = fading.map(f => ({
        id: `fade:${f.key}`,
        kind: "fade",
        title: f.title,
        where: null,
        detail: `${f.lastScore}% · ${f.daysSince === 0 ? "today" : `${f.daysSince}d ago`}`,
        quizId: f.quizId,
        strength: f.strength,
        fade: f,
    }));

    return {
        rows: [...misses, ...stale].slice(0, limit),
        misses,
        stale,
        total: misses.length + stale.length,
    };
}

// ─── 5. A repeated miss banks itself ────────────────────────────────────────

/**
 * Bank rows for questions the student keeps getting wrong.
 *
 * ─── Why automatically ──────────────────────────────────────────────────────
 * Banking used to need a press: mark a quiz, read the criteria, press save on
 * each mark you want back. That is the right shape for a nuanced mark — the
 * student is choosing which of five criteria is worth rehearsing — but it is
 * the wrong shape for a whole question they have now missed TWICE. There is
 * nothing to judge there. The evidence is unambiguous, the app noticed it, and
 * leaving it in a list to be pressed meant the clearest mistakes a student
 * makes were the ones least likely to end up somewhere they came back.
 *
 * ─── It is the same card as a hand-banked one ───────────────────────────────
 * Same topic, same unit, same `extra.mistake` shape, so it reviews through the
 * same SM-2 ladder, counts in the same summary and groups by criterion with
 * everything else. A second kind of banked mistake would be a second scheduler
 * and a second review screen, which is the thing `mistakeBank.js` opens by
 * refusing to build.
 *
 * ─── Never invents a back ───────────────────────────────────────────────────
 * A card needs an answer that would actually score. An MCQ has one (the
 * correct option, plus any explanation); a short-answer question has one only
 * if the quiz carries a model answer or an explanation. Where there is
 * neither, no card is made — a card whose back reads "the correct answer" is
 * worse than the student never seeing it, because it takes a real mistake and
 * spends it on nothing.
 */
export function autoBankRows(spots = [], quizzes = [], existing = [], { topic, unit } = {}) {
    const byId = new Map(quizzes.map(q => [q.id, q]));
    // Already banked, by the source key written below. Keyed on the QUESTION,
    // not on its wording: a quiz edited to reword a stem must not re-bank a
    // mistake the student has been working on for a fortnight.
    const have = new Set(
        existing.map(c => c?.extra?.mistake?.source).filter(Boolean));

    const rows = [];
    for (const s of spots) {
        const source = `quiz:${s.quizId}:${s.qIndex}`;
        if (!s.quizId || have.has(source)) continue;
        const quiz = byId.get(s.quizId);
        const q = quiz?.questions?.[s.qIndex];
        if (!q) continue;

        const back = q.type === "mcq"
            ? [Array.isArray(q.options) ? q.options[q.correct_answer] : null, q.explanation]
                .filter(Boolean).join("\n\n")
            : [q.model_answer, q.explanation].filter(Boolean).join("\n\n");
        if (!String(back || "").trim()) continue;

        rows.push({
            subject_name: quiz.subject || null,
            topic, unit,
            question: String(q.question || s.question || "").trim(),
            answer: back,
            is_active: true,
            // Missed twice is a demonstrated weak spot by definition, so it
            // enters the schedule as one rather than queueing behind material
            // the student has never got wrong.
            is_weak_spot: true,
            extra: {
                mistake: {
                    // The criterion IS the question here. There is no marked
                    // criterion to group on — the student got the whole thing
                    // wrong — and grouping needs something stable, so the
                    // question stands for itself.
                    criterion: String(q.question || s.question || "").trim().slice(0, 200),
                    quote: "",
                    question_title: s.quizTitle || quiz.title || "",
                    cost: 0,
                    lost: true,
                    source,
                    auto: true,
                    missed: s.missed,
                    seen: s.seen,
                    banked_at: new Date().toISOString(),
                },
            },
        });
    }
    return rows;
}
