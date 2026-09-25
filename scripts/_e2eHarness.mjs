/**
 * _e2eHarness — the browser, the fake backend's seed, and the assertions.
 *
 * Shared by `firstWinE2E.mjs` and `aceTourE2E.mjs` because they are the same
 * setup twice: the same route table, the same two localStorage keys, the same
 * "wait on the COPY rather than the attribute" rule. Two near-identical
 * two-hundred-line drivers is the copy that rots, which this codebase has
 * written down about CardPack and DeckStack already.
 *
 * Run the server first:  npm run e2e:serve
 */
import { chromium } from "playwright";

export const BASE = process.env.PROBE_BASE || "http://localhost:4479";
export const SHOT = process.env.SHOT_DIR || "/tmp/claude-0";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium";

export const EMAIL = "e2e@acedit.au";

/**
 * A store to drop into sessionStorage before the page boots, so a walk can
 * START from a state rather than having to reach it. `ageHours` is what both
 * onboarding surfaces derive their eligibility from, so it is the whole test
 * for "this must never fire at the ~130 accounts that already exist".
 */
export function store({ ageHours = 1, extra = {}, subjects = ["Chemistry", "Mathematical Methods", "English"] } = {}) {
    return JSON.stringify({
        user_profiles: [{
            id: "p_1", created_by: EMAIL, email: EMAIL, username: "E2E",
            created_date: new Date(Date.now() - ageHours * 3600e3).toISOString(),
            total_xp: 0, current_level: 1, streak_days: 0, subscription_tier: "free", extra,
        }],
        user_subjects: subjects.map((subject_name, i) => ({
            id: `s_${i}`, created_by: EMAIL, subject_name,
            color: ["#1CB0F6", "#CE82FF", "#58CC02"][i % 3],
        })),
        quizzes: [], quiz_attempts: [], flashcards: [], xp_events: [], __seq: 20,
    });
}

export async function launch({ seed = null, viewport = { width: 1280, height: 900 } } = {}) {
    const b = await chromium.launch({ executablePath: CHROME });
    const ctx = await b.newContext({ viewport });
    // The dev server is the only real thing on the network. AuthContext's
    // public-settings probe is the one outbound call the module swap cannot
    // reach, so it is answered here rather than left to time out.
    await ctx.route("**", (r) => {
        const u = r.request().url();
        if (u.includes("/api/apps/public/")) {
            return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
        }
        if (u.startsWith(BASE) || u.startsWith("data:") || u.startsWith("blob:")) return r.continue();
        return r.abort();
    });
    // Base44 mode (what the swap covers) plus a token, so AuthContext goes
    // straight down the `base44.auth.me()` path into the fake.
    await ctx.addInitScript((s) => {
        try {
            localStorage.setItem("__acedit_force_supabase", "false");
            localStorage.setItem("base44_access_token", "e2e");
            // ONLY IF THE STORE IS EMPTY. This runs on every document load, so
            // writing it unconditionally re-seeded on every reload and every
            // `goto` — which reads as the app losing its place, and cost three
            // failing assertions that looked exactly like a tour that cannot
            // resume. A seed is a STARTING state, not a state to return to.
            if (s && !sessionStorage.getItem("__fake_db__")) {
                sessionStorage.setItem("__fake_db__", s);
            }
        } catch { /* private mode */ }
    }, seed);

    const pg = await ctx.newPage();
    const errs = [];
    pg.on("pageerror", (e) => errs.push("THROW: " + e.message));
    pg.on("console", (m) => {
        if (m.type() === "error" && !/ERR_FAILED|Failed to load resource/.test(m.text())) {
            errs.push("console: " + m.text().slice(0, 200));
        }
    });

    const state = { n: 0, bad: 0 };
    const api = {
        b, ctx, pg, errs,
        async check(name, fn) {
            state.n += 1;
            try { await fn(); console.log(`  ok  ${name}`); }
            catch (e) { state.bad += 1; console.log(`FAIL  ${name}\n      ${e.message}`); }
        },
        /** The whole in-memory backend, as the page currently holds it. */
        db: () => pg.evaluate(() => JSON.parse(JSON.stringify(window.__FAKE_DB__))),
        profile: async () => (await api.db()).user_profiles[0],
        text: (sel) => pg.$eval(sel, (el) => el.innerText.replace(/\s+/g, " ").trim()).catch(() => ""),
        /**
         * WAIT ON THE COPY, NEVER ON THE ATTRIBUTE. Both surfaces flip
         * `data-first-win` / `data-ace-tour` when the beat changes, but the
         * bubble inside is an AnimatePresence `mode="wait"` — so for a couple
         * of hundred milliseconds the attribute says one thing and the words on
         * screen are still the previous ones. Asserting on the attribute reads
         * the old copy and fails for a reason that has nothing to do with the
         * app.
         */
        waitCopy: (sel, re, ms = 20000) => pg.waitForFunction(
            ([s, src]) => new RegExp(src).test(document.querySelector(s)?.innerText || ""),
            [sel, re.source], { timeout: ms }),
        /**
         * Settles first. A shot taken the moment `waitCopy` returns catches
         * AceBubble's spring mid-entrance — it has a 0.25s delay on top of the
         * walk — and the bubble reads as washed out in a screenshot that is
         * supposed to be how the screen looks. The pixels are the only thing
         * some of these bugs ever show up in, so they have to be judgeable.
         */
        async shot(name, settle = 900) {
            await pg.waitForTimeout(settle);
            return pg.screenshot({ path: `${SHOT}/${name}.png` });
        },
        async done(title) {
            console.log("\n  errors:", errs.length ? errs.slice(0, 6) : "none");
            console.log(`\n${state.n - state.bad}/${state.n} passed — ${title}\n`);
            await ctx.close();
            await b.close();
            process.exitCode = state.bad ? 1 : 0;
            return state.bad;
        },
    };
    return api;
}
