/**
 * AcedIt ATAR bands — CLIENT MIRROR of atarBand() in server.mjs.
 *
 * The server is the source of truth: it computes the score and getRankedBoards
 * returns the band alongside it. This exists for surfaces that read
 * user_profiles.acedit_atar directly (the Dashboard) and so have the number but
 * not the label. KEEP THE THRESHOLDS IN SYNC.
 */
export const ATAR_BANDS = [
    { min: 99, name: "The 99 Club" },
    { min: 95, name: "State Contender" },
    { min: 90, name: "Elite" },
    { min: 80, name: "Strong" },
    { min: 70, name: "Solid" },
    { min: 60, name: "On Track" },
    { min: 50, name: "Building" },
    { min: 0,  name: "Foundation" },
];

export function atarBandOf(atar) {
    if (atar == null) return null;
    const n = Number(atar);
    if (!Number.isFinite(n)) return null;
    return (ATAR_BANDS.find((b) => n >= b.min) || ATAR_BANDS[ATAR_BANDS.length - 1]).name;
}

/**
 * Planning evidence — one wording, used by Ranked and the Analytics panel.
 *
 * Planning is four signals: goals set and met, planned blocks kept, prep
 * started before an assessment, and daily intents actually followed. Prep only
 * counts once there is an assessment on the calendar whose lead-up has begun,
 * so it is named only when the server graded it (`assessments_graded`) — a
 * student with nothing coming up has its weight spread over the other three
 * rather than scored as a zero, and shouldn't be told they missed something
 * they were never asked for.
 */
export function planningEvidence(c = {}) {
    const bits = [];
    const inPlay = c.goals_in_play ?? c.goals_set;
    if (inPlay) bits.push(`${c.goals_met ?? 0}/${inPlay} goals`);
    if (c.blocks_planned) bits.push(`${c.blocks_kept ?? 0}/${c.blocks_planned} blocks`);
    if (c.assessments_graded) {
        const prep = c.planning_signals?.prep;
        bits.push(prep == null
            ? `${c.assessments_graded} assessment${c.assessments_graded === 1 ? "" : "s"} prepped`
            : `${prep}% prep on ${c.assessments_graded} assessment${c.assessments_graded === 1 ? "" : "s"}`);
    }
    if (c.intents_declared) bits.push(`${c.intents_kept ?? 0}/${c.intents_declared} intents kept`);
    return bits.join(" · ") || "nothing planned yet";
}
