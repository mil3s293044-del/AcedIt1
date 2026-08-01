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
