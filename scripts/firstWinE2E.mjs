/**
 * firstWinE2E — walk the whole first run in a real browser.
 *
 *   sh -c 'cd . && E2E_FAKE=1 npx vite --port 4479'
 *   node scripts/firstWinE2E.mjs
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 * The run is a CONDUCTOR: it writes its place to the profile, navigates into
 * the real QuizPlayer, and picks the thread back up from the attempt the
 * player saved. Every interesting thing about it is an INTEGRATION — a
 * navigation, a write that has to survive it, two components agreeing about
 * whose turn it is to speak — and not one of those is reachable from a plain
 * assertion file. `firstWin.test.mjs` covers the model and cannot see any of
 * this.
 *
 * The first walk found a real bug nothing else could have: FirstWin told
 * Layout it was not live while it was handed off to the player, so on the
 * single most important screen of the first session the student got the
 * study-intent modal, AceBuddy, and a second Ace drawn over their quiz. It
 * rendered perfectly and passed everything.
 *
 * `scripts/_fakeBase44.js` is the backend, swapped in at the module level by
 * `E2E_FAKE=1`. Everything above the API boundary is the real thing.
 */
import { chromium } from "playwright";

const BASE = process.env.PROBE_BASE || "http://localhost:4479";
const SHOT = process.env.SHOT_DIR || "/tmp/claude-0";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium";

const b = await chromium.launch({ executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
// The dev server is the only real thing. AuthContext's public-settings probe is
// the one outbound call the module swap cannot reach.
await ctx.route("**", (r) => {
    const u = r.request().url();
    if (u.includes("/api/apps/public/")) return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    if (u.startsWith(BASE) || u.startsWith("data:") || u.startsWith("blob:")) return r.continue();
    return r.abort();
});
// Base44 mode (what the swap covers) with a token, so AuthContext goes
// straight down the `base44.auth.me()` path into the fake.
await ctx.addInitScript(() => {
    try {
        localStorage.setItem("__acedit_force_supabase", "false");
        localStorage.setItem("base44_access_token", "e2e");
    } catch { /* private mode */ }
});

const pg = await ctx.newPage();
const errs = [];
pg.on("pageerror", (e) => errs.push("THROW: " + e.message));
pg.on("console", (m) => {
    if (m.type() === "error" && !/ERR_FAILED|Failed to load resource/.test(m.text())) {
        errs.push("console: " + m.text().slice(0, 200));
    }
});

let n = 0, bad = 0;
async function check(name, fn) {
    n += 1;
    try { await fn(); console.log(`  ok  ${name}`); }
    catch (e) { bad += 1; console.log(`FAIL  ${name}\n      ${e.message}`); }
}
const text = (sel) => pg.$eval(sel, (el) => el.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const db = () => pg.evaluate(() => JSON.parse(JSON.stringify(window.__FAKE_DB__)));
const firstWin = () => text("[data-first-win]");
/** The attribute flips before the crossfade, so wait on the COPY. */
const waitCopy = (re, ms = 20000) =>
    pg.waitForFunction((src) => new RegExp(src).test(
        document.querySelector("[data-first-win]")?.innerText || ""), re.source, { timeout: ms });

console.log("\n─── FIRST WIN, END TO END ───\n");
await pg.goto(`${BASE}/Dashboard?access_token=e2e`, { waitUntil: "networkidle" });

await check("it opens itself on a fresh account, offering their OWN subjects", async () => {
    await waitCopy(/Which subject/);
    const t = await firstWin();
    if (!/Chemistry/.test(t)) throw new Error(`their subjects are not offered: ${t.slice(0, 140)}`);
});
await pg.screenshot({ path: `${SHOT}/e2e-1-subject.png` });

await check("the subject they picked is named back at them", async () => {
    await pg.click("[data-first-win] button:has-text('Chemistry')");
    await waitCopy(/What is going wrong in Chemistry/);
});

await check("the problem is answered with a TECHNIQUE, and the price is on screen BEFORE the button", async () => {
    await pg.click("[data-first-win] button:has-text(\"I read it, then it's gone\")");
    await waitCopy(/Spaced repetition/);
    const t = await firstWin();
    if (!/chips/.test(t) || !/\b30\b/.test(t)) throw new Error(`no price before the button: ${t.slice(0, 260)}`);
    if (!/Build them/.test(t)) throw new Error("no way to start it");
});
await pg.screenshot({ path: `${SHOT}/e2e-2-build.png` });

await check("Build them writes a REAL quiz and hands off to the REAL player", async () => {
    await pg.click("[data-first-win] button:has-text('Build them')");
    await pg.waitForURL(/\/Quizzes/, { timeout: 25000 });
    const d = await db();
    if (d.quizzes.length !== 1) throw new Error(`${d.quizzes.length} quiz rows written`);
    const q = d.quizzes[0];
    if (q.questions.length !== 3) throw new Error(`${q.questions.length} questions saved`);
    if (q.subject !== "Chemistry") throw new Error(`subject is ${q.subject}`);
    if (!q.questions.every((x) => x.model_answer)) throw new Error("a question has nothing to mark against");
    await pg.waitForSelector("textarea", { timeout: 20000 });
    if (!/exothermic/i.test(await pg.textContent("body"))) throw new Error("the generated question is not on screen");
});

await check("the run's place survived the navigation — it is on the profile, not in memory", async () => {
    const fw = (await db()).user_profiles[0].extra?.first_win;
    if (fw?.beat !== "quiz") throw new Error(`stored beat is ${fw?.beat}`);
    if (!fw?.quiz_id) throw new Error("no quiz_id — the close could never find the attempt");
    if (fw.subject !== "Chemistry" || fw.problem !== "slips") throw new Error("their answers were not kept");
});

await check("HE DOES NOT TALK OVER HIMSELF while they sit it", async () => {
    // The bug this file found. The run is still in progress, so the corner
    // stays his: no intent modal, no AceBuddy, no second Ace over the quiz.
    await pg.waitForTimeout(2500);
    const body = await pg.textContent("body");
    if (/What are we doing\?/.test(body)) throw new Error("the study-intent modal opened over the first quiz");
    const aces = await pg.$$eval("svg", (els) =>
        els.filter((e) => e.closest("[data-ace-walker]")).length);
    if (aces > 0) throw new Error(`${aces} Ace(s) in the corner while the player is up`);
});
await pg.screenshot({ path: `${SHOT}/e2e-3-player.png` });

await check("the three questions can be answered and submitted", async () => {
    const answers = [
        "An exothermic reaction releases energy to the surroundings, so the products hold less chemical energy than the reactants.",
        "Energy leaves the reaction and it just gets hotter around it.",
        "Breaking the C-H and O=O bonds costs less than is released forming C=O and O-H, so the net change is negative.",
    ];
    for (let i = 0; i < 3; i += 1) {
        await pg.waitForSelector("textarea", { timeout: 15000 });
        await pg.fill("textarea", answers[i]);
        const next = pg.locator("button", { hasText: i === 2 ? /Submit|Finish/ : /Next/ }).first();
        await next.click();
        await pg.waitForTimeout(900);
    }
});

await check("the real marking panel runs and the attempt is SAVED", async () => {
    await pg.waitForFunction(() => window.__FAKE_DB__.quiz_attempts.length > 0, null, { timeout: 40000 });
    const a = (await db()).quiz_attempts[0];
    if (typeof a.score !== "number") throw new Error(`attempt saved with score ${a.score}`);
    if (!a.extra?.question_results) throw new Error("no per-criterion verdicts recorded — the close cannot tell what dropped");
});
await pg.waitForTimeout(1500);
await pg.screenshot({ path: `${SHOT}/e2e-4-marked.png`, fullPage: true });

await check("coming back, the close reports what ACTUALLY happened", async () => {
    await pg.goto(`${BASE}/Dashboard`, { waitUntil: "networkidle" });
    await waitCopy(/up and running/, 25000);
    const t = await firstWin();
    const a = (await db()).quiz_attempts[0];
    const m = t.match(/You scored (\d+)%/);
    if (!m) throw new Error(`the close quotes no score: ${t.slice(0, 200)}`);
    if (Number(m[1]) !== Math.round(a.score)) throw new Error(`close says ${m[1]}%, the attempt says ${a.score}%`);
    if (/ATAR is|\+0\.|\d+\.\d+ ATAR/.test(t)) throw new Error(`the close invented an ATAR figure: ${t.slice(0, 200)}`);
});
await pg.screenshot({ path: `${SHOT}/e2e-5-close.png` });

await check("a dropped mark offers the mistake bank, counted off the REAL verdicts", async () => {
    // This is the check that found `droppedFrom` reading `criteria[].met`, a
    // field nothing writes — so the branch was dead and the close reported one
    // dropped mark off the score whatever the marking said.
    const t = await firstWin();
    const a = (await db()).quiz_attempts[0];
    const rows = a.extra?.question_results || [];
    if (!rows.some((r) => (r.criteria || []).length)) throw new Error("no per-criterion verdicts were saved at all");
    const dropped = rows.filter((r) => (r.criteria || []).some((c) => c.got === false)).length;
    if (dropped !== 2) throw new Error(`the canned marking drops 2 questions; counted ${dropped}`);
    if (!/Mistake Bank/.test(t)) throw new Error("marks were dropped and the bank was never mentioned");
});

await check("Show me around closes the run and hands to the tour", async () => {
    await pg.click("[data-first-win] button:has-text('Show me around')");
    await pg.waitForTimeout(2500);
    const fw = (await db()).user_profiles[0].extra?.first_win;
    if (fw?.status !== "done") throw new Error(`run status is ${fw?.status}`);
    await pg.waitForSelector("[data-ace-tour]", { timeout: 15000 });
});
await pg.screenshot({ path: `${SHOT}/e2e-6-tour.png` });

/* ── The replay path: it is gone, and the card is the way back. ─────────── */
await check("a finished run leaves the way back on the dashboard", async () => {
    await pg.goto(`${BASE}/Dashboard`, { waitUntil: "networkidle" });
    await pg.waitForSelector("button:has-text('Start it')", { timeout: 20000 });
    const card = await text("button:has-text('Start it') >> xpath=ancestor::*[contains(@class,'card-soft')][1]");
    if (!/Help page/.test(card)) throw new Error("the card does not say where it goes");
});

await check("Start it runs it AGAIN, months past the window", async () => {
    await pg.click("button:has-text('Start it')");
    await waitCopy(/Which subject/, 20000);
    const fw = (await db()).user_profiles[0].extra?.first_win;
    if (fw?.status !== "active") throw new Error(`replay left status ${fw?.status}`);
    if (fw.quiz_id) throw new Error("the replay resumed last time's quiz instead of starting over");
});
await pg.screenshot({ path: `${SHOT}/e2e-7-replay.png` });

console.log("\n  errors:", errs.length ? errs.slice(0, 6) : "none");
console.log(`\n${n - bad}/${n} passed\n`);
await ctx.close(); await b.close();
process.exitCode = bad ? 1 : 0;
