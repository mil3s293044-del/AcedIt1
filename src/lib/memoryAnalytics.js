/**
 * memoryAnalytics — how well this student's memory is actually holding.
 *
 * Analytics has always answered "how much did I do". This answers "is any of
 * it sticking", which is a different question and the only one that predicts
 * an exam result.
 *
 * Everything here comes from data the app already stores and has never read
 * for anything but scheduling: the SM-2 state on every flashcard, plus which
 * techniques the study minutes went into.
 *
 * The forgetting model lives in retention.js and is not duplicated here — see
 * that file for what it assumes and what it deliberately refuses to
 * double-count.
 */
import { recallAt, isLearned, stabilityDays, RISK_FLOOR } from "@/lib/retention";

const DAY = 86400000;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const median = (xs) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Techniques where the student pulls information OUT of memory, as opposed to
 * putting it in or simply sitting with it. This split is the single most
 * replicated result in the study literature (Roediger & Karpicke 2006), and
 * the app already teaches it on the Study page — it just never measured it.
 *
 * Pomodoro is not retrieval. It's a container for whatever you do inside it,
 * which is usually reading, so it counts as encoding time rather than being
 * silently credited as practice.
 */
export const RETRIEVAL_TECHNIQUES = new Set([
    "active_recall", "blurting", "spaced_repetition", "exam", "mind_map",
]);

export const TECHNIQUE_LABELS = {
    pomodoro: "Pomodoro", spaced_repetition: "Spaced Repetition",
    active_recall: "Active Recall", blurting: "Blurting",
    exam: "Revision Mode", mind_map: "Mind Maps",
};

/**
 * How much of the study time was spent retrieving rather than reviewing.
 * Returns null share when nothing was logged — an empty month is not 0%
 * retrieval, it's no information.
 */
export function retrievalShare(techniques = []) {
    let retrieval = 0, encoding = 0;
    const byTechnique = Object.create(null);
    for (const t of techniques) {
        const id = t?.technique_name;
        const mins = Math.max(0, num(t?.session_duration));
        if (!id || !mins) continue;
        byTechnique[id] = (byTechnique[id] || 0) + mins;
        if (RETRIEVAL_TECHNIQUES.has(id)) retrieval += mins; else encoding += mins;
    }
    const total = retrieval + encoding;
    return {
        retrievalMinutes: retrieval,
        encodingMinutes: encoding,
        totalMinutes: total,
        share: total > 0 ? retrieval / total : null,
        byTechnique: Object.entries(byTechnique)
            .map(([id, minutes]) => ({
                id, minutes, label: TECHNIQUE_LABELS[id] || id,
                isRetrieval: RETRIEVAL_TECHNIQUES.has(id),
            }))
            .sort((a, b) => b.minutes - a.minutes),
        hasData: total > 0,
    };
}

/**
 * How long memories are lasting, per subject.
 *
 * The headline is the MEDIAN achieved interval, not the mean: one card that
 * has drifted out to 300 days would otherwise drag a struggling deck up into
 * looking healthy. Half-life is what the interval implies about how fast that
 * subject decays, which is the number that means something to a student.
 */
export function stabilityBySubject(cards = []) {
    const bySubject = Object.create(null);
    for (const c of cards) {
        if (!c || c.is_active === false || !isLearned(c)) continue;
        const key = c.subject_name || "Unsorted";
        const s = bySubject[key] || (bySubject[key] = { subject: key, intervals: [], cards: 0, again: 0, reviews: 0 });
        s.intervals.push(Math.max(0, num(c.interval_days)));
        s.cards++;
        s.again += num(c.review_count_again);
        s.reviews += num(c.total_reviews);
    }
    const subjects = Object.values(bySubject).map(s => {
        const med = median(s.intervals);
        return {
            subject: s.subject,
            cards: s.cards,
            medianInterval: Math.round(med * 10) / 10,
            // Days until recall falls to ~37%, from the same model the
            // retention card uses.
            halfLife: Math.round(stabilityDays({ interval_days: med }) * Math.LN2 * 10) / 10,
            lapseRate: s.reviews > 0 ? s.again / s.reviews : null,
        };
    }).sort((a, b) => b.medianInterval - a.medianInterval);

    return {
        subjects,
        hasData: subjects.length > 0,
        // The comparison that matters: a subject holding for weeks next to one
        // that keeps collapsing back to days.
        strongest: subjects[0] || null,
        weakest: subjects.length > 1 ? subjects[subjects.length - 1] : null,
    };
}

/**
 * Overall lapse rate — how often a review comes back wrong.
 *
 * This is the one thing the interval genuinely cannot express. An interval
 * says how long a memory is currently holding; the lapse rate says whether it
 * keeps collapsing and being rebuilt. Consistently high means the cards are
 * being memorised rather than understood, which no amount of extra reviewing
 * fixes.
 */
export function lapseProfile(cards = []) {
    let again = 0, reviews = 0, learned = 0;
    for (const c of cards) {
        if (!c || c.is_active === false || !isLearned(c)) continue;
        learned++;
        again += num(c.review_count_again);
        reviews += num(c.total_reviews);
    }
    const rate = reviews > 0 ? again / reviews : null;
    return {
        rate, again, reviews, learned,
        // Bands are labels on a continuum, not thresholds with a paper behind
        // them — named as judgement rather than dressed up as a finding.
        // Inclusive at 0.2: the copy everywhere says "above roughly 20%", so
        // exactly 20% has to be the top of normal rather than the bottom of
        // shaky, or the label contradicts the sentence next to it.
        band: rate == null ? null : rate <= 0.1 ? "solid" : rate <= 0.2 ? "normal" : rate <= 0.35 ? "shaky" : "not sticking",
        hasData: reviews > 0,
    };
}

/**
 * Projected share of the collection still above the recall floor, day by day.
 * A do-nothing projection: it assumes no reviews happen, which is what makes
 * it a forecast of the cost of stopping rather than a prediction of the future.
 */
export function retentionForecast(cards = [], { days = 30, floor = RISK_FLOOR, now = Date.now() } = {}) {
    const learned = cards.filter(c => c && c.is_active !== false && recallAt(c, now) != null);
    if (!learned.length) return { points: [], learnedCount: 0, hasData: false, days };

    const points = [];
    for (let d = 0; d <= days; d++) {
        const at = now + d * DAY;
        let held = 0, sum = 0;
        for (const c of learned) {
            const r = recallAt(c, at);
            if (r >= floor) held++;
            sum += r;
        }
        points.push({
            day: d,
            held,
            share: held / learned.length,
            meanRecall: sum / learned.length,
        });
    }
    return {
        points,
        learnedCount: learned.length,
        // The single sentence worth pulling out of the curve.
        halfGoneDay: points.find(p => p.share <= 0.5)?.day ?? null,
        endShare: points[points.length - 1].share,
        hasData: true,
        days,
    };
}

/**
 * One honest paragraph per metric, so the UI never has to invent an
 * interpretation of a number it was handed.
 */
export function memoryVerdict({ share, stability, lapse }) {
    const out = [];
    if (share?.hasData && share.share != null) {
        const pct = Math.round(share.share * 100);
        out.push(pct >= 60
            ? `${pct}% of your study time is retrieval practice. That's the ratio the evidence supports.`
            : pct >= 35
                ? `${pct}% of your study time is retrieval practice. Pushing that past 60% is the single highest-return change available.`
                : `Only ${pct}% of your study time is retrieval practice — most of it is time spent with the material rather than pulling it back out.`);
    }
    if (stability?.strongest && stability?.weakest && stability.weakest.subject !== stability.strongest.subject) {
        out.push(`${stability.strongest.subject} holds for around ${stability.strongest.medianInterval} days between reviews; ${stability.weakest.subject} keeps collapsing back to ${stability.weakest.medianInterval}.`);
    }
    if (lapse?.hasData && lapse.rate > 0.2) {
        out.push(`You forget ${Math.round(lapse.rate * 100)}% of cards on review. Above roughly 20% usually means the cards are carrying too much at once.`);
    }
    return out;
}
