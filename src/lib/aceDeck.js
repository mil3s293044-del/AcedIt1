/**
 * aceDeck — which of AcedIt a student has actually touched.
 *
 * The discovery half of the problem. A student who has been using this app for
 * a term has almost certainly never opened half of it, and has no way of
 * knowing that: nothing anywhere says "there are eleven other things in here
 * and three of them are for exactly the thing you're stuck on".
 *
 * The honest difficulty is that the app never recorded feature usage. So this
 * works from two sources, and keeps them apart rather than blurring them,
 * because they mean genuinely different things:
 *
 *   PLAYED — there is data. Flashcards exist, a mind map exists, sessions were
 *   logged under that technique. This is real evidence of use and it follows
 *   the student across devices, because it lives in their rows.
 *
 *   OPENED — the route was visited on this device. It's all we can know about
 *   the read-only parts (Analytics, Ranked, the guides), and it is NOT the
 *   same claim: opening Analytics once is not using Analytics. Kept as its own
 *   state so the deck never says you've done something you've only looked at.
 *
 *   UNSEEN — no evidence either way. Face down.
 *
 * Visits live in localStorage rather than the database. It's a per-device
 * record of something we're already describing as weaker evidence, so the
 * storage matches the strength of the claim, and it costs no migration and no
 * write on every navigation.
 */
import { FEATURES, BY_ID, readiness, blockedBy } from "@/lib/aceKnowledge";

const KEY = "acedit_ace_deck_v1";

export const STATE = { played: "played", opened: "opened", unseen: "unseen" };

function readVisits() {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY));
        if (raw && typeof raw === "object") return raw;
    } catch { /* first run, or private mode */ }
    return {};
}

function writeVisits(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ }
    return v;
}

/**
 * Note that a route was visited.
 *
 * Matching is deliberately narrow. `/Study?tab=mind_map` marks Mind Maps;
 * plain `/Study` marks nothing, because landing on the technique picker isn't
 * seeing any particular technique — and a deck that flips six cards for one
 * visit to a tab strip is a deck that lies immediately.
 */
export function recordVisit(path, { now = Date.now() } = {}) {
    if (!path) return readVisits();
    const clean = String(path).split("#")[0];
    const [route, query] = clean.split("?");
    const visits = readVisits();
    let touched = false;
    for (const f of FEATURES) {
        const [fRoute, fQuery] = f.to.split("?");
        if (fRoute !== route) continue;
        // A feature pinned to a tab only counts when that tab is the one open.
        if (fQuery && fQuery !== query) continue;
        // A feature with no tab of its own doesn't count when some OTHER tab
        // is showing — /Analytics?tab=cognition isn't a visit to Analytics'
        // overview, and more importantly isn't a visit to Weak spots.
        if (!fQuery && query) continue;
        if (!visits[f.id]) { visits[f.id] = now; touched = true; }
    }
    return touched ? writeVisits(visits) : visits;
}

/** Wipe the local half. The data half can't be wiped and shouldn't be. */
export function resetDeck() { return writeVisits({}); }

/**
 * Hard evidence of use, per feature, from the student's own rows.
 *
 * Only returns true where a trace genuinely exists. Everything absent from
 * here falls back to "opened" or "unseen" rather than being guessed at — the
 * whole value of this is that a face-down card means something.
 */
function playedFrom({ subjects = [], flashcards = [], assessments = [], techniques = [], maps = [], plans = [], friends = [], quizzes = [] } = {}) {
    const byTechnique = new Set(
        techniques.map(t => String(t?.technique_name || "").toLowerCase()).filter(Boolean));
    const anyMapWith = (fn) => maps.some(fn);

    return {
        subjects: subjects.length > 0,
        assessments: assessments.length > 0,
        spaced_repetition: flashcards.length > 0,
        pomodoro: byTechnique.has("pomodoro"),
        active_recall: byTechnique.has("active_recall"),
        blurting: byTechnique.has("blurting"),
        exam: byTechnique.has("exam") || byTechnique.has("revision_mode"),
        mind_map: maps.length > 0,
        // A map with a parent is a drilled layer; one with a parent_map_id is
        // a rebuild attempt. Both are real use of a sub-feature nothing else
        // would ever notice.
        mindmap_layers: anyMapWith(m => m?.drill_from_map_id),
        mindmap_recall: anyMapWith(m => m?.parent_map_id || m?.retention_score != null),
        weak_spots: flashcards.some(c => c?.is_weak_spot),
        quizzes: quizzes.length > 0,
        planner: plans.length > 0,
        week_plan: plans.length > 0,
        friends: friends.length > 0,
        streak: techniques.length > 0,
    };
}

/**
 * The deck: every feature, its state, and why it's in that state.
 *
 * Blocked features are marked rather than hidden. "You can't use this yet and
 * here's what it needs" is a more useful thing to show someone than a gap.
 */
export function deck(data = {}) {
    const visits = readVisits();
    const played = playedFrom(data);
    const ready = readiness(data);

    const cards = FEATURES.map(f => {
        const state = played[f.id] ? STATE.played
            : visits[f.id] ? STATE.opened
                : STATE.unseen;
        return {
            id: f.id,
            feature: f,
            state,
            blocked: blockedBy(f, ready),
            at: visits[f.id] || null,
        };
    });

    const count = (s) => cards.filter(c => c.state === s).length;
    return {
        cards,
        total: cards.length,
        played: count(STATE.played),
        opened: count(STATE.opened),
        unseen: count(STATE.unseen),
        // What's worth playing next: unseen, usable right now, and not a
        // sub-feature — you don't "play" Map layers, you play Mind Maps and
        // find them.
        suggestions: cards.filter(c =>
            c.state === STATE.unseen && !c.blocked && !c.feature.parent),
    };
}

/** Cards grouped under the headings the rest of the guidance uses. */
export function deckBySection(d) {
    const out = {};
    for (const c of d.cards) (out[c.feature.section] ||= []).push(c);
    return out;
}

export { BY_ID };
