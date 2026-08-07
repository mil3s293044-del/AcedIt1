/**
 * strategise — the rules an AI-drafted SAC plan has to obey.
 *
 * "Plan this week for me" asked for an hours budget and produced a scatter of
 * generic sessions. It knew nothing about what the student was actually
 * preparing for, so it couldn't sequence anything: the same plan came back
 * whether the SAC was tomorrow or in three weeks.
 *
 * Strategise is built around one logged assessment and works backwards from
 * its date. The model drafts the schedule because only it can read "I don't
 * understand titrations at all" and act on it; these rules then constrain the
 * draft, because a language model left alone will happily schedule five
 * blurting sessions in a row and forget the mock exam.
 *
 * The rules encode the study science the app already argues for elsewhere:
 * spacing beats cramming, retrieval beats re-reading, and you sit a timed
 * paper before the real one — not the night before.
 */

/**
 * The principles the plan is built on, with the work they come from. Every
 * rule below cites one of these, and every session carries the id of the
 * principle it applies — so the plan can show its reasoning instead of asking
 * the student to trust it.
 */
// Every claim below was checked against its source before being shown to a
// student. Where a finding is narrower than the popular version of it, the
// claim says so — an assured citation that overstates its paper is worse than
// no citation, because the reader can't tell the difference.
export const PRINCIPLES = {
    testing: {
        name: "Testing effect",
        // The delay qualifier is usually dropped, and it matters: in Roediger
        // & Karpicke's own data re-reading BEAT testing on a test five minutes
        // later. Testing only won at two days and one week.
        claim: "Retrieving beats re-reading when the test is days away — though re-reading wins if you're tested minutes later.",
        source: "Roediger & Karpicke, 2006, Psychological Science 17(3)",
    },
    spacing: {
        name: "Spacing effect",
        claim: "The same total study spread over days beats it massed into one sitting, and the further off the assessment, the wider the gaps should be.",
        source: "Cepeda, Pashler, Vul, Wixted & Rohrer, 2006, Psychological Bulletin 132(3)",
    },
    interleaving: {
        name: "Interleaving",
        // Retention and discrimination, not transfer — the old wording named
        // the wrong construct for this study.
        claim: "Mixing topics feels worse while you practise and holds up far better a week later — 60% vs 89% during practice, 63% vs 20% on the test.",
        source: "Rohrer & Taylor, 2007, Instructional Science 35(6)",
    },
    desirable: {
        name: "Desirable difficulty",
        claim: "Conditions that slow you down while learning — spacing, mixing, self-testing — tend to raise how much you still know later.",
        source: "Bjork & Bjork, 2011, Psychology and the Real World",
    },
    prerequisite: {
        name: "Cover it before you drill it",
        // Reworded and re-sourced. This used to read "you cannot practise
        // recalling material you have never actually learnt", cited to
        // Karpicke, Butler & Roediger 2009 — which is a survey of the study
        // strategies students choose and says nothing of the sort. The strong
        // claim is also wrong: unsuccessful retrieval attempts still help.
        // What the evidence supports is that the size of the benefit depends
        // on how hard the material is relative to what you already know.
        claim: "Retrieval practice pays off most on material you've already met — the harder it is relative to what you know, the smaller the gain.",
        source: "Minear, Coane et al., 2018, J. Exp. Psychol. LMC 44(9)",
    },
    metacognition: {
        name: "You will misjudge re-reading",
        // The finding the mis-citation above was reaching for, stated as what
        // its paper actually shows — and the real reason Strategise schedules
        // retrieval rather than "go over your notes".
        claim: "Asked how they study, most students name re-reading and rate it highly — the strategy the evidence keeps ranking last.",
        source: "Karpicke, Butler & Roediger, 2009, Memory 17(4)",
    },
    transfer: {
        name: "Transfer-appropriate processing",
        claim: "You remember best when practice matches the test, so practise timed, written and closed-book if that's the SAC.",
        source: "Morris, Bransford & Franks, 1977, JVLVB 16(5)",
    },
};

/** Everything Strategise is allowed to schedule, and what each is good for. */
export const TECHNIQUES = {
    pomodoro:          { label: "Focused block",     tab: "pomodoro",           phase: "learn",  principle: "prerequisite", blurb: "Learn or re-learn content you don't know yet" },
    concept_explainer: { label: "Concept explainer", tab: null, tool: true,     phase: "learn",  principle: "prerequisite", blurb: "Get a topic explained when you're stuck" },
    spaced_repetition: { label: "Flashcards",        tab: "spaced_repetition",  phase: "recall", principle: "spacing",      blurb: "Lock in definitions and facts over days" },
    active_recall:     { label: "Active recall",     tab: "active_recall",      phase: "recall", principle: "testing",      blurb: "Answer questions from memory, not notes" },
    blurting:          { label: "Blurting",          tab: "blurting",           phase: "recall", principle: "desirable",    blurb: "Brain-dump a topic, then find the gaps" },
    quiz:              { label: "Quiz",              tab: null, page: "/Quizzes", phase: "test", principle: "testing",      blurb: "Check yourself against marked questions" },
    exam:              { label: "Revision Mode",     tab: "exam",               phase: "test",  principle: "transfer",      blurb: "A timed paper under real conditions" },
};

export const TECHNIQUE_IDS = Object.keys(TECHNIQUES);

/** Where a session lands in the run-up, as a fraction of days remaining. */
const PHASE_WINDOW = {
    // First half: close knowledge gaps. Middle: retrieve. Last quarter: test.
    learn:  [0, 0.55],
    recall: [0.15, 0.9],
    test:   [0.55, 1],
};

const dayKey = (d) => d.toISOString().slice(0, 10);

/**
 * What survives when a day can't hold everything. The timed paper is the one
 * session the rules promise unconditionally, so it claims its minutes first.
 */
const PRIORITY = (s) => (s.technique === "exam" ? 0 : 1);

/** Minutes already committed on a given date. */
const byDayMinutes = (sessions, date) =>
    sessions.filter((s) => s.date === date).reduce((n, s) => n + (s.duration || 0), 0);

/** Every date from tomorrow to the SAC, inclusive of neither past nor SAC day. */
export function runUpDays(sacDate, from = new Date()) {
    const end = new Date(sacDate);
    const days = [];
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    cur.setDate(cur.getDate() + 1);
    while (cur < end && days.length < 60) {
        days.push(dayKey(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return days;
}

/**
 * Constrain a drafted plan. Returns the repaired sessions plus a list of what
 * had to be changed, so the wizard can be honest about it rather than silently
 * rewriting the model's work.
 */
export function applyRules(sessions, { days, availableDays, minutesPerDay, confidence }) {
    const fixes = [];
    const allowed = new Set(days);
    const freeDays = new Set(availableDays?.length ? availableDays : days);

    let out = (sessions || [])
        .filter((s) => s && s.date && TECHNIQUE_IDS.includes(s.technique))
        .map((s) => ({
            ...s,
            duration: Math.max(15, Math.min(120, Number(s.duration) || 40)),
        }));

    // 1. Nothing outside the run-up, and nothing on a day they said they're busy.
    const before = out.length;
    out = out.filter((s) => allowed.has(s.date) && freeDays.has(s.date));
    if (out.length < before) fixes.push(`Dropped ${before - out.length} session${before - out.length === 1 ? "" : "s"} on days you're not free.`);

    // 2. Respect the daily budget — study you won't do isn't a plan.
    const byDay = {};
    out.forEach((s) => { (byDay[s.date] ||= []).push(s); });
    let trimmed = 0;
    Object.values(byDay).forEach((list) => {
        let used = 0;
        list.forEach((s) => {
            if (used + s.duration > minutesPerDay) {
                const room = Math.max(0, minutesPerDay - used);
                if (room < 15) { s._drop = true; trimmed++; }
                else { s.duration = room; }
            }
            used += s._drop ? 0 : s.duration;
        });
    });
    out = out.filter((s) => !s._drop);
    if (trimmed) fixes.push(`Trimmed ${trimmed} session${trimmed === 1 ? "" : "s"} to keep each day inside ${minutesPerDay} minutes.`);

    // 3. Phase discipline: learning early, retrieval through the middle,
    //    testing late. A mock exam on day one tests nothing.
    const total = days.length || 1;
    const posOf = (date) => days.indexOf(date) / Math.max(1, total - 1);
    let moved = 0;
    out.forEach((s) => {
        const [lo, hi] = PHASE_WINDOW[TECHNIQUES[s.technique].phase] || [0, 1];
        const pos = posOf(s.date);
        if (pos < lo || pos > hi) {
            const target = days[Math.round(((lo + hi) / 2) * (total - 1))];
            if (target && freeDays.has(target)) { s.date = target; moved++; }
        }
    });
    if (moved) fixes.push(`Resequenced ${moved} session${moved === 1 ? "" : "s"} so learning comes before testing.`);

    // 4. A timed paper before the real one. Non-negotiable.
    const lastFree = [...days].reverse().find((d) => freeDays.has(d));
    if (!out.some((s) => s.technique === "exam") && lastFree) {
        out.push({
            date: lastFree, technique: "exam", duration: Math.min(minutesPerDay, 45),
            topic: "Full timed run-through", why: "Sit it under real conditions before the real one.",
            principle: "transfer",
        });
        fixes.push("Added a timed Revision Mode paper — you should meet the format before it counts (transfer-appropriate processing).");
    }

    // 5. Low confidence means content is still missing; make sure something
    //    teaches it rather than only quizzing on what isn't there yet.
    if (confidence <= 2 && !out.some((s) => TECHNIQUES[s.technique].phase === "learn")) {
        const firstFree = days.find((d) => freeDays.has(d));
        if (firstFree) {
            out.unshift({
                date: firstFree, technique: "pomodoro", duration: Math.min(minutesPerDay, 45),
                topic: "Cover the content you flagged as shaky",
                why: "You said you don't know this well yet — retrieval needs something to retrieve.",
                principle: "prerequisite",
            });
            fixes.push("Added a content block up front — retrieval practice needs something encoded first.");
        }
    }

    // 6. Spacing. A topic touched once is a topic half-learnt: every topic that
    //    appears in the retrieval phase should come back at least once, on a
    //    different day. Cepeda et al. (2006) — distributed beats massed.
    const retrieval = out.filter((s) => TECHNIQUES[s.technique].phase === "recall");
    const touches = {};
    retrieval.forEach((s) => { (touches[s.topic] ||= []).push(s); });
    let spaced = 0;
    Object.entries(touches).forEach(([topic, list]) => {
        if (list.length > 1) return;
        const first = list[0];
        const firstIdx = days.indexOf(first.date);
        // Come back to it at least two days later, if there's room in the budget.
        const revisit = days.find((d, i) => i >= firstIdx + 2 && freeDays.has(d)
            && (byDayMinutes(out, d) + 20) <= minutesPerDay);
        if (revisit) {
            out.push({
                date: revisit, technique: "spaced_repetition", duration: 20,
                topic, why: `Second pass on ${topic} — spacing it out is what makes it stick.`,
                principle: "spacing",
            });
            spaced++;
        }
    });
    if (spaced) fixes.push(`Added ${spaced} spaced second pass${spaced === 1 ? "" : "es"} — one exposure to a topic isn't learning it.`);

    // 7. Interleaving. Three days of the same technique in a row is blocking,
    //    which feels productive and transfers worse (Rohrer & Taylor, 2007).
    out.sort((a, b) => a.date.localeCompare(b.date));
    let varied = 0;
    for (let i = 2; i < out.length; i++) {
        const [a, b, c] = [out[i - 2], out[i - 1], out[i]];
        if (a.technique === b.technique && b.technique === c.technique) {
            const alt = TECHNIQUE_IDS.find((t) =>
                t !== c.technique && TECHNIQUES[t].phase === TECHNIQUES[c.technique].phase);
            if (alt) { c.technique = alt; c.principle = TECHNIQUES[alt].principle; varied++; }
        }
    }
    if (varied) fixes.push(`Varied ${varied} session${varied === 1 ? "" : "s"} — three of the same in a row is blocking, and it transfers worse.`);

    // 8. No brand-new content in the final stretch. Learning something for the
    //    first time the day before is the cramming this is meant to replace.
    const cutoff = Math.floor((days.length - 1) * 0.8);
    let converted = 0;
    out.forEach((s) => {
        if (TECHNIQUES[s.technique].phase === "learn" && days.indexOf(s.date) > cutoff) {
            s.technique = "active_recall";
            s.principle = "testing";
            s.why = "Too late to meet this cold — test what you've got instead.";
            converted++;
        }
    });
    if (converted) fixes.push(`Turned ${converted} late content block${converted === 1 ? "" : "s"} into retrieval — new material in the last days is cramming.`);

    // 9. Re-settle the day budget. Rules 3 and 6 move and add sessions after
    //    the first budget pass, which let them stack up on one date — the test
    //    for this produced the same session twice on the same day. Dedupe, then
    //    re-apply the ceiling over the final set.
    const seen = new Set();
    out = out.filter((s) => {
        const k = `${s.date}|${s.technique}|${s.topic}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
    const finalByDay = {};
    out.forEach((s) => { (finalByDay[s.date] ||= []).push(s); });
    let spilled = 0;
    Object.entries(finalByDay).forEach(([date, list]) => {
        let used = 0;
        // Claim the budget in priority order. Rule 4 calls the timed paper
        // non-negotiable, but this pass runs after it and used to bin it
        // whenever the last day was already full — which is precisely when it
        // happens, because rule 5's content block is unshifted to the front and
        // ate the budget first. Ordering here is what makes rule 4 true.
        [...list].sort((a, b) => PRIORITY(a) - PRIORITY(b)).forEach((s) => {
            if (used + s.duration <= minutesPerDay) { used += s.duration; return; }
            // Push it to the next free day with room rather than binning it.
            const from = days.indexOf(date);
            const moveTo = days.find((d, i) => i > from && freeDays.has(d)
                && byDayMinutes(out.filter((x) => x !== s), d) + s.duration <= minutesPerDay);
            if (moveTo) { s.date = moveTo; spilled++; return; }
            // Nowhere to go. Shrink it rather than lose it, if it's protected
            // and there's any room at all.
            const room = Math.max(0, minutesPerDay - used);
            if (PRIORITY(s) === 0 && room >= 15) { s.duration = room; used += room; return; }
            s._drop = true;
        });
    });
    out = out.filter((s) => !s._drop);
    if (spilled) fixes.push(`Spread ${spilled} session${spilled === 1 ? "" : "s"} to a later day so no day is overloaded.`);

    // 10. Last line of defence on the timed paper. If every earlier rule has
    //     conspired to leave none — a very short run-up with a tight daily
    //     budget does it — make room by displacing the least important session
    //     on the last available day. A plan that never rehearses the format is
    //     not the plan this feature promises.
    if (lastFree && !out.some((s) => s.technique === "exam")) {
        const dayList = out.filter((s) => s.date === lastFree);
        const used = dayList.reduce((n, s) => n + s.duration, 0);
        let room = minutesPerDay - used;
        while (room < 15 && dayList.length) {
            const victim = dayList.pop();
            out = out.filter((s) => s !== victim);
            room += victim.duration;
        }
        if (room >= 15) {
            out.push({
                date: lastFree, technique: "exam", duration: Math.min(room, 45),
                topic: "Full timed run-through",
                why: "Sit it under real conditions before the real one.",
                principle: "transfer",
            });
            fixes.push("Made room for a timed paper on the last day — meeting the format before it counts is the one thing worth displacing something for.");
        }
    }

    // Every session declares the principle it applies.
    out.forEach((s) => { s.principle ||= TECHNIQUES[s.technique].principle; });

    out.sort((a, b) => a.date.localeCompare(b.date));
    return { sessions: out, fixes };
}

/** A plain-language summary of the shape of a plan. */
export function planSummary(sessions) {
    const mins = sessions.reduce((s, x) => s + (x.duration || 0), 0);
    const days = new Set(sessions.map((s) => s.date)).size;
    const kinds = new Set(sessions.map((s) => s.technique)).size;
    return { totalMinutes: mins, days, kinds, sessions: sessions.length };
}
