/**
 * _fakeBase44 — an in-memory stand-in for the whole API surface, for driving
 * the first-run flow end to end in a real browser.
 *
 * ─── Why a MODULE ALIAS and not a runtime stub ──────────────────────────────
 * `base44` is a Proxy whose `get` trap answers `entities` / `auth` /
 * `functions` / `integrations` from closures, so assigning over them lands on
 * the underlying client and changes nothing. The only seam is the import
 * itself, so `vite.config.js` swaps this module in when `E2E_FAKE=1` is set —
 * which means ZERO test scaffolding in production code, and every line above
 * the API boundary is the real one: Layout, FirstWin, the Quizzes page, the
 * real QuizPlayer and the real marking panel.
 *
 * What is NOT covered, stated plainly: the boundary itself. Whether
 * `user_profiles` really has the columns written here is `dbColumns.test.mjs`'s
 * job, against the real schema; whether Claude returns usable questions is not
 * something any harness can assert.
 *
 * The canned model answers are deliberately SHAPED, not empty — question 2's
 * marking drops a criterion with a quotable phrase, because the close's
 * mistake-bank branch and the annotation underline are half of what this flow
 * exists to demonstrate and a clean sweep would exercise neither.
 */

const now = () => new Date().toISOString();
let seq = 0;
const nextId = (t) => `${t}_${++seq}`;

/**
 * IT SURVIVES A RELOAD, because a real backend does.
 *
 * Held in memory alone, a full page load wiped the quiz, the attempt and the
 * profile patch — so the run came back as a brand-new account and the close
 * had nothing to report. That is a property of the harness and not of the
 * app, and the difference matters: the whole reason the beat is written to
 * the profile rather than held in state is that a student can shut the tab
 * mid-quiz and come back, which is only testable if the store outlives the
 * page.
 *
 * sessionStorage, so each browser CONTEXT starts clean without the driver
 * having to reset anything.
 */
const KEY = "__fake_db__";
const EMPTY = () => ({
    user_profiles: [], user_subjects: [], quizzes: [],
    quiz_attempts: [], flashcards: [], xp_events: [],
});

const read = () => {
    try {
        const raw = sessionStorage.getItem(KEY);
        if (!raw) return null;
        const o = JSON.parse(raw);
        seq = o.__seq || 0;
        delete o.__seq;
        return o;
    } catch { return null; }
};
const save = () => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ ...DB, __seq: seq })); }
    catch { /* private mode: stay in memory */ }
};

export const DB = (typeof window !== "undefined" && read()) || EMPTY();

/** Table name for an entity, matching entitiesShim's own mapping closely enough. */
const TABLE = {
    UserProfile: "user_profiles", UserSubject: "user_subjects",
    Quiz: "quizzes", QuizAttempt: "quiz_attempts", Flashcard: "flashcards",
};
const tableFor = (name) => TABLE[name] || name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase() + "s";

export const USER = {
    id: "u_1", email: "e2e@acedit.au", full_name: "E2E Student", role: "user",
};

/** A brand-new account with three subjects — the case the first run is for. */
export function seed({ ageHours = 1, firstWin = null, subjects = ["Chemistry", "Mathematical Methods", "English"] } = {}) {
    for (const k of Object.keys(EMPTY())) DB[k] = [];
    seq = 0;
    DB.user_profiles.push({
        id: "p_1", created_by: USER.email, email: USER.email, username: "E2E",
        created_date: new Date(Date.now() - ageHours * 3600_000).toISOString(),
        total_xp: 0, current_level: 1, streak_days: 0, acedit_atar: null,
        subscription_tier: "free", extra: firstWin ? { first_win: firstWin } : {},
    });
    subjects.forEach((subject_name, i) => DB.user_subjects.push({
        id: `s_${i}`, created_by: USER.email, subject_name,
        color: ["#1CB0F6", "#CE82FF", "#58CC02"][i % 3],
    }));
    save();
}
// Only on a genuinely empty store: a reload must find what the last page wrote.
if (!DB.user_profiles.length) seed();

const matches = (row, where) => Object.entries(where || {}).every(([k, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v)) return true;   // operators: ignore
    return row[k] === v;
});

function entity(name) {
    const t = tableFor(name);
    if (!DB[t]) DB[t] = [];
    const rows = () => DB[t];
    const stamp = (o) => ({
        id: nextId(t), created_date: now(), updated_date: now(),
        created_by: USER.email, ...o,
    });
    return {
        async filter(where, sort, limit) {
            let out = rows().filter((r) => matches(r, where));
            if (typeof sort === "string") {
                const desc = sort.startsWith("-"); const k = desc ? sort.slice(1) : sort;
                out = [...out].sort((a, b) => (desc ? 1 : -1) * (String(a[k] ?? "") < String(b[k] ?? "") ? 1 : -1));
            }
            return limit ? out.slice(0, limit) : out;
        },
        async list(sort, limit) { return this.filter({}, sort, limit); },
        async get(id) { return rows().find((r) => r.id === id) || null; },
        async create(o) { const r = stamp(o); rows().push(r); save(); return r; },
        async bulkCreate(arr) { return Promise.all((arr || []).map((o) => this.create(o))); },
        async update(id, patch) {
            const r = rows().find((x) => x.id === id);
            if (!r) throw new Error(`[fake] ${t}#${id} not found`);
            Object.assign(r, patch, { updated_date: now() });
            save();
            return r;
        },
        async bulkUpdate(arr) { return Promise.all((arr || []).map((o) => this.update(o.id, o))); },
        async delete(id) {
            const i = rows().findIndex((x) => x.id === id);
            if (i >= 0) rows().splice(i, 1);
            save();
            return { ok: true };
        },
        subscribe() { return () => {}; },
    };
}

const entitiesProxy = new Proxy({}, { get: (_, name) => (typeof name === "string" ? entity(name) : undefined) });

/* ── The model. Canned, and shaped so the marking has something to say. ───── */
const QUESTIONS = [
    { type: "short_answer", question: "State what is meant by an exothermic reaction.",
      model_answer: "A reaction that releases energy to the surroundings, so the products have less chemical energy than the reactants.", marks: 2 },
    { type: "short_answer", question: "Explain why the temperature of the surroundings rises during an exothermic reaction.",
      model_answer: "Bond forming releases more energy than bond breaking absorbs, and that surplus is transferred to the surroundings as heat, raising their temperature.", marks: 3 },
    { type: "short_answer", question: "Justify, with reference to bond energies, why the combustion of methane is strongly exothermic.",
      model_answer: "The C-H and O=O bonds broken absorb less energy than is released forming the stronger C=O and O-H bonds in carbon dioxide and water, so the net energy change is large and negative.", marks: 5 },
];

/** Marking: Q1 clean, Q2 drops a criterion on a quotable phrase, Q3 partial. */
function markingFor(count) {
    const all = [
        { marks: 2, what_wrong: "", improve: "",
          criteria: [{ text: "States that energy is released to the surroundings", got: true, worth: 1, note: "" },
                     { text: "Relates this to the energy of products against reactants", got: true, worth: 1, note: "" }],
          annotations: [] },
        { marks: 2, what_wrong: "This response describes the temperature change without naming the transfer that causes it.",
          improve: "Name bond forming as the source of the surplus energy.",
          criteria: [{ text: "Identifies that bond forming releases more energy than bond breaking absorbs", got: false, worth: 1, note: "A full-mark response states that the energy released forming bonds exceeds the energy absorbed breaking them." },
                     { text: "States that the surplus is transferred to the surroundings as heat", got: true, worth: 1, note: "" },
                     { text: "Links that transfer to the rise in temperature", got: true, worth: 1, note: "" }],
          annotations: [{ quote: "it just gets hotter", issue: "Restates the observation rather than accounting for it.",
                          wanted: "The energy released forming bonds exceeds the energy absorbed breaking them.",
                          fixes: ["more energy is released forming bonds than is absorbed breaking them"],
                          criterion_index: 0, severity: "lost", worth: 1 }] },
        { marks: 3, what_wrong: "This response asserts the bonds are stronger without comparing the energies.",
          improve: "Compare the total energy absorbed breaking bonds with the total released forming them.",
          criteria: [{ text: "Identifies the bonds broken", got: true, worth: 1, note: "" },
                     { text: "Identifies the bonds formed", got: true, worth: 1, note: "" },
                     { text: "Compares total energy absorbed with total released", got: false, worth: 1, note: "A full-mark response sets the energy absorbed breaking C-H and O=O against the energy released forming C=O and O-H." },
                     { text: "Concludes the net change is negative", got: true, worth: 1, note: "" },
                     { text: "Refers to bond energies quantitatively", got: false, worth: 1, note: "A full-mark response cites the relative magnitudes rather than asserting the outcome." }],
          annotations: [] },
    ];
    return all.slice(0, count);
}

const integrationsProxy = {
    Core: {
        async InvokeLLM(params = {}) {
            await new Promise((r) => setTimeout(r, 120));
            const f = params.feature;
            if (f === "quiz_ai_gen") return { questions: QUESTIONS };
            if (f === "quiz_ai_mark") {
                const n = (params.prompt.match(/Provide feedback for ALL (\d+) questions/) || [])[1];
                return { feedback: markingFor(Number(n) || 3), themes: [] };
            }
            const props = params.response_json_schema?.properties || {};
            if (props.questions) return { questions: QUESTIONS };
            if (props.feedback) return { feedback: markingFor(3), themes: [] };
            return {};
        },
        async UploadFile() { return { file_url: "local-file://fake" }; },
    },
};

/** Ported server functions, answering the `{ data, error }` envelope. */
const FUNCTIONS = {
    awardXP: ({ xp_amount = 0 } = {}) => {
        const p = DB.user_profiles[0];
        const gained = Math.max(0, Math.round(xp_amount));
        p.total_xp = (p.total_xp || 0) + gained;
        save();
        return { success: true, xp_awarded: gained, total_xp: p.total_xp, current_level: 1 };
    },
    updateStreak: () => ({ success: true, streak_days: 1 }),
};

const functionsProxy = {
    async invoke(name, payload) {
        const fn = FUNCTIONS[name];
        if (!fn) return { data: null, error: null };
        try { return { data: fn(payload || {}), error: null }; }
        catch (e) { return { data: null, error: String(e?.message || e) }; }
    },
};

const authProxy = {
    async me() { return USER; },
    async logout() {},
    async login() {},
    async updateMyUserData(patch) { Object.assign(USER, patch); return USER; },
};

/**
 * Anything not named above answers a no-op rather than `undefined`.
 *
 * The real client carries incidental surfaces — NavigationTracker reaches for
 * `appLogic.logUserInApp` on every route change — and a missing one throws
 * inside a component that wraps the whole router, which takes the app down
 * before the flow under test has rendered anything. A harness must not fail on
 * telemetry.
 */
const noop = new Proxy(function () {}, {
    get: (t, k) => (k === "then" ? undefined : noop),   // never thenable
    apply: () => Promise.resolve({}),
});

const SURFACES = {
    entities: entitiesProxy, auth: authProxy,
    functions: functionsProxy, integrations: integrationsProxy,
};

export const realBase44 = new Proxy(SURFACES, {
    get: (t, k) => (k in t ? t[k] : noop),
});
export const base44 = realBase44;

if (typeof window !== "undefined") {
    window.__FAKE_DB__ = DB;
    window.__FAKE_SEED__ = (o) => seed(o);
}
