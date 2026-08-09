/**
 * attentionAnalytics — when this student actually works well, and for how long.
 *
 * ── WHAT THIS CAN AND CANNOT SEE ────────────────────────────────────────────
 * There is no attention telemetry in the app yet. Nothing records pauses,
 * abandoned timers or tab switches, so none of this measures attention
 * directly. What it has is: when a session was saved, how long it ran, and —
 * on manually logged sessions only — how the student rated it afterwards.
 *
 * That supports two honest questions:
 *   • Which hours of the day carry the student's real work.
 *   • Whether their own ratings fall off past a certain session length.
 *
 * It does NOT support "your attention span is 43 minutes". Session length is a
 * choice as much as a capacity, and the app cannot tell a 20-minute session
 * that ended because focus went from one that ended because the bus arrived.
 * The UI says this; the functions here refuse to imply otherwise.
 *
 * ── WHICH CLOCK IS TRUSTWORTHY ──────────────────────────────────────────────
 * `created_date` is when the row was WRITTEN. For technique sessions the app
 * writes them the moment the session ends, so the timestamp is a real clock.
 * A manually logged StudySession can be entered days later, so its timestamp
 * says when the student did admin, not when they studied. Time-of-day analysis
 * therefore uses auto-saved technique rows only, and reports how many rows it
 * had so a thin sample can't masquerade as a finding.
 */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Enough rows before any of this is worth showing at all. */
export const MIN_SESSIONS = 8;

export const WINDOWS = [
    { id: "early",   label: "Early morning", from: 5,  to: 9,  blurb: "5am–9am" },
    { id: "morning", label: "Late morning",  from: 9,  to: 12, blurb: "9am–midday" },
    { id: "arvo",    label: "Afternoon",     from: 12, to: 17, blurb: "midday–5pm" },
    { id: "evening", label: "Evening",       from: 17, to: 21, blurb: "5pm–9pm" },
    { id: "night",   label: "Late night",    from: 21, to: 29, blurb: "9pm–5am" },
];

const windowOf = (hour) => WINDOWS.find(w => {
    const h = hour < 5 ? hour + 24 : hour;      // 1am belongs to last night
    return h >= w.from && h < w.to;
}) || WINDOWS[WINDOWS.length - 1];

/**
 * Where the student's hours actually land across the day.
 *
 * @param techniques auto-saved StudyTechnique rows (see the note above about
 *        why manually logged sessions are excluded)
 */
export function peakWindow(techniques = []) {
    const buckets = Object.create(null);
    for (const w of WINDOWS) buckets[w.id] = { ...w, minutes: 0, sessions: 0 };

    let counted = 0;
    for (const t of techniques) {
        const when = Date.parse(t?.created_date || "");
        const mins = Math.max(0, num(t?.session_duration));
        if (!Number.isFinite(when) || !mins) continue;
        const b = buckets[windowOf(new Date(when).getHours()).id];
        b.minutes += mins;
        b.sessions++;
        counted++;
    }

    const windows = Object.values(buckets).sort((a, b) => b.minutes - a.minutes);
    const total = windows.reduce((s, w) => s + w.minutes, 0);
    return {
        windows,
        totalMinutes: total,
        sessions: counted,
        top: total > 0 ? windows[0] : null,
        // Below this it's anecdote, and the UI is told so rather than left to
        // guess from the row count.
        enough: counted >= MIN_SESSIONS,
        hasData: total > 0,
    };
}

/**
 * Session length against how the student rated the session.
 *
 * Ratings only exist on manually logged StudySessions, so this reads those —
 * a different source to peakWindow, deliberately, because the rating is the
 * only subjective signal in the database and it's worth having.
 */
export const LENGTH_BANDS = [
    { id: "under25", label: "Under 25m", from: 0,  to: 25 },
    { id: "25to45",  label: "25–45m",    from: 25, to: 45 },
    { id: "45to75",  label: "45–75m",    from: 45, to: 75 },
    { id: "75plus",  label: "75m+",      from: 75, to: Infinity },
];

export function lengthCurve(sessions = []) {
    const bands = LENGTH_BANDS.map(b => ({ ...b, sessions: 0, rated: 0, ratingSum: 0, minutes: 0 }));
    let rated = 0;
    for (const s of sessions) {
        const mins = Math.max(0, num(s?.duration_minutes));
        if (!mins) continue;
        const band = bands.find(b => mins >= b.from && mins < b.to);
        if (!band) continue;
        band.sessions++;
        band.minutes += mins;
        const r = num(s?.productivity_rating);
        if (r > 0) { band.ratingSum += r; band.rated++; rated++; }
    }
    const out = bands.map(b => ({
        ...b,
        // Divided by the RATED sessions, not all of them. Dividing by
        // b.sessions let an unrated session act as a zero and drag the band
        // down — two sessions rated 4 alongside one unrated read as 2.7.
        avgRating: b.rated > 0 ? b.ratingSum / b.rated : null,
    }));
    const withRating = out.filter(b => b.avgRating != null && b.rated >= 2);
    const best = withRating.length
        ? withRating.reduce((a, b) => (b.avgRating > a.avgRating ? b : a))
        : null;
    // A drop-off only counts if a LONGER band rates materially worse than the
    // best one. Any old dip is noise.
    const dropOff = best
        ? withRating.find(b => b.from > best.from && b.avgRating <= best.avgRating - 0.5) || null
        : null;

    return {
        bands: out,
        ratedSessions: rated,
        best,
        dropOff,
        enough: rated >= MIN_SESSIONS,
        hasData: rated > 0,
    };
}

/** One line each, or nothing at all when the sample is too thin to speak. */
export function attentionVerdict({ peak, curve }) {
    const out = [];
    if (peak?.hasData && peak.enough && peak.top) {
        const pct = Math.round((peak.top.minutes / peak.totalMinutes) * 100);
        out.push(`${pct}% of your logged hours land in the ${peak.top.label.toLowerCase()} (${peak.top.blurb}). That's the window worth protecting for the work that matters.`);
    }
    if (curve?.hasData && curve.enough && curve.best) {
        out.push(curve.dropOff
            ? `Your own ratings peak on ${curve.best.label.toLowerCase()} sessions and fall off past ${curve.dropOff.from} minutes — a break there costs less than pushing through.`
            : `Your ratings hold up across every session length you've logged. No drop-off to work around yet.`);
    }
    return out;
}
