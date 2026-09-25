/**
 * aceTourE2E — walk the signup tour in a real browser.
 *
 *   npm run e2e:serve      (in another shell)
 *   npm run e2e:tour       (the alias loader, because aceTour.js imports `@/`)
 *
 * ─── What only a walk can answer ────────────────────────────────────────────
 * `aceTour.test.mjs` covers the copy and the eligibility arithmetic, which is
 * most of what can go wrong in a MODULE. Everything else about this thing is
 * a browser fact: it navigates six times, it writes its place before each one,
 * it has to come back to the same stop after a refresh, it has to go quiet on
 * the payment flow and pick up again afterwards, and it shares one corner and
 * one mascot with three other surfaces that must not speak over it.
 *
 * The first run's walk found exactly that class of bug — Layout un-suppressing
 * AceBuddy over the quiz — so the same question is asked here.
 *
 * `scripts/_fakeBase44.js` is the backend, swapped in by `E2E_FAKE=1`.
 */
import { STOPS, CONTENT_STOPS, TOUR_WINDOW_HOURS } from "../src/lib/aceTour.js";
import { launch, store, BASE } from "./_e2eHarness.mjs";

/* The tour is held until the first run is done or skipped, so every walk that
   is about the TOUR starts from a run that is already out of the way. */
const RUN_DONE = { first_win: { status: "skipped" } };

console.log("\n─── THE SIGNUP TOUR, END TO END ───\n");

const h = await launch({ seed: store({ ageHours: 2, extra: RUN_DONE }) });
const { pg, check, db, profile, text, waitCopy, shot } = h;
const tour = () => text("[data-ace-tour]");
const stopId = () => pg.$eval("[data-ace-tour]", (n) => n.dataset.aceTour).catch(() => null);
const next = () => pg.click("[data-ace-tour-next]");

await pg.goto(`${BASE}/Dashboard?access_token=e2e`, { waitUntil: "networkidle" });

await check("it opens itself on a fresh account, on the dashboard, at 1 of 6", async () => {
    await waitCopy("[data-ace-tour]", /This is home/);
    if (await stopId() !== "dashboard") throw new Error(`opened on ${await stopId()}`);
    const t = await tour();
    if (!new RegExp(`1/${CONTENT_STOPS}`).test(t)) throw new Error(`progress reads: ${t.slice(0, 120)}`);
    const st = (await profile()).extra?.ace_tour;
    if (st?.status !== "active") throw new Error(`stored status is ${st?.status}`);
});
await shot("tour-1-dashboard");

await check("HE DOES NOT TALK OVER HIMSELF — one Ace, one bubble", async () => {
    await pg.waitForTimeout(1200);
    const body = await pg.textContent("body");
    if (/What are we doing\?/.test(body)) throw new Error("the study-intent modal opened over the tour");
    const walkers = await pg.$$eval("[data-ace-walker]", (n) => n.length);
    if (walkers !== 1) throw new Error(`${walkers} Aces on screen at once`);
    const asides = await pg.$$eval("aside[aria-label]", (n) => n.map((x) => x.getAttribute("aria-label")));
    if (asides.filter((a) => /tour|first session|Ace/i.test(a)).length > 1) {
        throw new Error(`two of him speaking: ${asides.join(", ")}`);
    }
});

await check("Next WALKS to each page in order, and says what that page is for", async () => {
    const content = STOPS.filter((s) => !s.final);
    for (let i = 1; i < content.length; i += 1) {
        await next();
        const want = content[i];
        await pg.waitForURL(new RegExp(`/${want.page}`), { timeout: 15000 });
        await waitCopy("[data-ace-tour]", new RegExp(want.lead.slice(0, 28).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        if (await stopId() !== want.id) throw new Error(`on ${want.page} the bubble says ${await stopId()}`);
        const st = (await profile()).extra?.ace_tour;
        if (st?.stop !== i) throw new Error(`stored stop is ${st?.stop}, showing ${i}`);
    }
});
await shot("tour-2-help");

await check("HIS POSE SETTLES — he is not frozen mid-gesture while they read", async () => {
    // The bug acePose.test.mjs guards, checked where it actually renders:
    // after the gesture he has to land on a pose AceBody fidgets out of.
    await pg.waitForTimeout(3200);
    const pose = await pg.$eval("[data-ace-walker]", (n) => n.dataset.acePose);
    if (!["stand", "happy", "peek", "offer"].includes(pose)) {
        throw new Error(`holding "${pose}", which he never fidgets out of`);
    }
});

await check("a REFRESH resumes the stop rather than restarting the tour", async () => {
    const before = (await profile()).extra?.ace_tour?.stop;
    await pg.reload({ waitUntil: "networkidle" });
    await waitCopy("[data-ace-tour]", /./, 20000);
    if (await stopId() !== STOPS[before].id) {
        throw new Error(`came back on ${await stopId()}, left on ${STOPS[before].id}`);
    }
});

await check("it goes QUIET on the payment flow, and keeps its place", async () => {
    const before = (await profile()).extra?.ace_tour?.stop;
    await pg.goto(`${BASE}/Subscription`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(1800);
    if (await pg.$("[data-ace-tour]")) throw new Error("the tour talked over the checkout");
    await pg.goto(`${BASE}/Help`, { waitUntil: "networkidle" });
    await waitCopy("[data-ace-tour]", /./, 20000);
    const after = (await profile()).extra?.ace_tour?.stop;
    if (after !== before) throw new Error(`the stop moved from ${before} to ${after} while it was quiet`);
});

await check("the sign-off hands them back to the Dashboard and closes the tour", async () => {
    await next();                                   // help → signoff
    await waitCopy("[data-ace-tour]", /That is the tour/);
    if (await stopId() !== "signoff") throw new Error(`last stop is ${await stopId()}`);
    if (!/You are set/.test(await tour())) throw new Error("the sign-off does not sign off");
    await pg.waitForURL(/\/Dashboard/, { timeout: 15000 });
    await next();                                   // "Start studying"
    await pg.waitForTimeout(1500);
    const st = (await profile()).extra?.ace_tour;
    if (st?.status !== "done") throw new Error(`finished with status ${st?.status}`);
    if (await pg.$("[data-ace-tour]")) throw new Error("it is still on screen after finishing");
});
await shot("tour-3-signoff");

await check("a finished tour never fires again", async () => {
    await pg.reload({ waitUntil: "networkidle" });
    await pg.waitForTimeout(2500);
    if (await pg.$("[data-ace-tour]")) throw new Error("it opened again at somebody who has seen it");
});

await h.done("the tour, start to finish");

/* ── Eligibility and the two orderings, each from its own clean context. ──── */
async function walk(title, seed, fn) {
    const w = await launch({ seed });
    await w.pg.goto(`${BASE}/Dashboard?access_token=e2e`, { waitUntil: "networkidle" });
    await fn(w);
    return w.done(title);
}

console.log("─── WHO IT MAY OPEN AT ───\n");
let bad = 0;

bad += await walk("an OLD account is never ambushed", store({ ageHours: TOUR_WINDOW_HOURS + 5, extra: RUN_DONE }), async (w) => {
    await w.check("nothing opens, and nothing is written to their row", async () => {
        await w.pg.waitForTimeout(3000);
        if (await w.pg.$("[data-ace-tour]")) throw new Error("all ~130 existing accounts would meet this");
        if ((await w.profile()).extra?.ace_tour) throw new Error("it wrote to a profile it must not have touched");
    });
});

bad += await walk("THE RUN LEADS AND THE TOUR WAITS", store({ ageHours: 2 }), async (w) => {
    await w.check("with a run pending, the tour holds — one of him, not two", async () => {
        await w.waitCopy("[data-first-win]", /Which subject/);
        if (await w.pg.$("[data-ace-tour]")) throw new Error("both fired on the same first screen");
    });
    await w.check("skipping the run hands over to the tour WITHOUT a reload", async () => {
        await w.pg.click("[data-first-win] button[aria-label='Close']");
        await w.waitCopy("[data-ace-tour]", /This is home/, 20000);
    });
});

bad += await walk("it can be ASKED for at any age", store({ ageHours: 24 * 200, extra: { ...RUN_DONE, ace_tour: { status: "done" } } }), async (w) => {
    await w.check("Show me around on Help replays it months later", async () => {
        await w.pg.goto(`${BASE}/Help`, { waitUntil: "networkidle" });
        await w.pg.waitForSelector("button:has-text('Show me around')", { timeout: 20000 });
        await w.pg.click("button:has-text('Show me around')");
        await w.waitCopy("[data-ace-tour]", /This is home/, 20000);
        await w.pg.waitForURL(/\/Dashboard/, { timeout: 15000 });
        const st = (await w.profile()).extra?.ace_tour;
        if (st?.status !== "active" || st?.stop !== 0) throw new Error(`replay left ${JSON.stringify(st)}`);
    });
    await w.shot("tour-4-replay");
});

process.exitCode = process.exitCode || (bad ? 1 : 0);
