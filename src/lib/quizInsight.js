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
        for (const r of resultsOf(a)) {
            if (r.is_correct === null || r.is_correct === undefined) continue;   // unmarked
            const key = `${a.quiz_id || a.quiz_title}::${r.q_index}`;
            const prev = byQuestion.get(key) || {
                key, quizId: a.quiz_id, quizTitle: a.quiz_title, quizCategory: a.quiz_category,
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
        const key = a.quiz_id || a.quiz_title;
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
            title: latest.quiz_title || quizzes.find(q => q.id === latest.quiz_id)?.title || "Untitled quiz",
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
