/**
 * brainActivity — the student's own study history, mapped onto the brain.
 *
 * What this is, precisely, because the difference matters: it is NOT a scan
 * and it is not a measurement of anyone's brain. It takes the techniques the
 * student actually used, looks up the regions that imaging studies
 * consistently implicate in each of those activities (the same citations
 * behind the Study page panels), and weights them by how long they spent. The
 * UI says exactly that. "Here's your brain activity" would be a lie; "here's
 * which systems the work you did leans on" is true and still interesting.
 *
 * The genuinely useful output isn't the picture, it's the quiet regions. A
 * student who only ever runs Pomodoro lights up attention and control and
 * leaves the hippocampus dark — and the hippocampus is where retrieval lives.
 * That's a diagnosis you can act on, and it falls straight out of the mapping.
 */
import { TECHNIQUE_NEURO, REGIONS } from "@/lib/neuro";

/** Rough hours-per-window that counts as "fully lit". */
const FULL_MINUTES = 600;          // 10h across the window
const DAY = 86400000;

export const TECHNIQUE_LABEL = {
    pomodoro: "Pomodoro",
    spaced_repetition: "Spaced Repetition",
    active_recall: "Active Recall",
    blurting: "Blurting",
    exam: "Revision Mode",
    mind_map: "Mind Maps",
};

/**
 * Every region any technique can light, so "quiet" means quiet against the
 * full set rather than against whatever happened to be used.
 */
export const ALL_ACTIVE_REGIONS = [...new Set(
    Object.values(TECHNIQUE_NEURO).flatMap(t => t.regions.map(r => r.id)))];

/**
 * @param techniques rows from StudyTechnique: { technique_name, session_duration, date }
 */
export function brainActivity(techniques = [], { days = 28, now = Date.now() } = {}) {
    const cutoff = now - days * DAY;

    const minutesByTechnique = new Map();
    for (const t of techniques) {
        const id = t.technique_name;
        if (!TECHNIQUE_NEURO[id]) continue;
        const when = Date.parse(t.date || t.created_date || "");
        if (Number.isFinite(when) && when < cutoff) continue;
        const mins = Math.max(0, Number(t.session_duration) || 0);
        if (!mins) continue;
        minutesByTechnique.set(id, (minutesByTechnique.get(id) || 0) + mins);
    }

    // A technique credits every region it engages with its full time — the
    // session used all of them, so splitting the minutes between them would
    // understate a technique that happens to involve more systems.
    const byRegion = new Map();
    for (const [id, mins] of minutesByTechnique) {
        for (const r of TECHNIQUE_NEURO[id].regions) {
            const prev = byRegion.get(r.id) || { id: r.id, minutes: 0, tone: r.tone, drivers: new Map(), roles: new Set() };
            prev.minutes += mins;
            prev.drivers.set(id, (prev.drivers.get(id) || 0) + mins);
            prev.roles.add(r.role);
            // Whichever technique contributed most decides the colour, so the
            // picture reads as "this is mostly your recall work".
            if (prev.drivers.get(id) >= Math.max(...prev.drivers.values())) prev.tone = r.tone;
            byRegion.set(r.id, prev);
        }
    }

    const regions = [...byRegion.values()].map(r => ({
        id: r.id,
        name: REGIONS[r.id]?.name || r.id,
        tone: r.tone,
        minutes: r.minutes,
        activation: Math.min(1, r.minutes / FULL_MINUTES),
        topDriver: [...r.drivers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
        role: [...r.roles][0] || "",
    })).sort((a, b) => b.minutes - a.minutes);

    const totalMinutes = [...minutesByTechnique.values()].reduce((s, m) => s + m, 0);
    const techniques_used = [...minutesByTechnique.entries()]
        .map(([id, minutes]) => ({ id, label: TECHNIQUE_LABEL[id] || id, minutes }))
        .sort((a, b) => b.minutes - a.minutes);

    const litIds = new Set(regions.filter(r => r.minutes > 0).map(r => r.id));
    const quiet = ALL_ACTIVE_REGIONS
        .filter(id => !litIds.has(id))
        .map(id => ({ id, name: REGIONS[id]?.name || id, ...whatLightsIt(id) }));

    return {
        regions,
        quiet,
        totalMinutes,
        techniques: techniques_used,
        coverage: ALL_ACTIVE_REGIONS.length ? litIds.size / ALL_ACTIVE_REGIONS.length : 0,
        litCount: litIds.size,
        totalRegions: ALL_ACTIVE_REGIONS.length,
        hasData: totalMinutes > 0,
    };
}

/**
 * Which technique would light a given region, so a dark area comes with the
 * thing to do about it rather than just a shrug.
 */
export function whatLightsIt(regionId) {
    let best = null;
    for (const [id, data] of Object.entries(TECHNIQUE_NEURO)) {
        const hit = data.regions.find(r => r.id === regionId);
        if (!hit) continue;
        // Prefer the technique that lists it earliest — that's the one where
        // the region is most central to what the technique does.
        const rank = data.regions.indexOf(hit);
        if (!best || rank < best.rank) best = { technique: id, label: TECHNIQUE_LABEL[id] || id, role: hit.role, rank };
    }
    return best ? { technique: best.technique, label: best.label, role: best.role } : {};
}

/**
 * One honest line about the shape of the last month, for the card headline.
 * Deliberately not congratulatory when there's nothing there — a dark brain
 * with an upbeat caption is the kind of thing that stops being believed.
 */
export function activitySummary(a) {
    if (!a?.hasData) return "Nothing logged in the last month yet — this fills in as you study.";
    const top = a.regions[0];
    const spread = a.techniques.length;
    if (spread === 1) {
        return `All of it through ${a.techniques[0].label}. That lights ${a.litCount} of ${a.totalRegions} systems — a second technique would widen it a lot.`;
    }
    return `${spread} techniques, ${a.litCount} of ${a.totalRegions} systems lit. Busiest is your ${top.name.toLowerCase()}.`;
}
