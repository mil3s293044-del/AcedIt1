/**
 * checkPagesMount — render every page and report the ones that throw.
 *
 *   npm run dev:web -- --port 4475     (or: npx vite --port 4475)
 *   node scripts/checkPagesMount.mjs
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 * Two white screens shipped in two days, both temporal-dead-zone
 * ReferenceErrors from a binding read during render before its own
 * declaration. Neither was visible in the diff, both passed lint, the build,
 * and the whole test suite — because nothing in any of those actually RENDERS
 * a page. `hookDeps.test.mjs` catches the two shapes we have seen; this
 * catches everything, by doing the only thing that really answers the
 * question.
 *
 * Deliberately NOT wired into `npm test`: it needs a dev server and a browser,
 * and the suite is plain node assertions with no runner. It is a script you
 * run before shipping something that touches a page's hooks.
 *
 * Data calls fail here (there is no session) and that is fine — every page
 * catches its own fetch rejections. A render-time throw is what shows up.
 *
 * It copies src/_probe-style mounting into the app under `scripts/`; the page
 * list comes from the same glob the router uses, so a new page is covered
 * without touching this file.
 */
import { chromium } from "playwright";

const BASE = process.env.PROBE_BASE || "http://localhost:4475";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1100, height: 800 } });
await ctx.route("**", (route) => {
  const u = route.request().url();
  if (u.startsWith(BASE) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
  return route.abort();
});
const list = await ctx.newPage();
await list.goto(`${BASE}/scripts/__pagecheck.html`, { waitUntil: "networkidle" });
const names = await list.evaluate(() => window.__PAGES__);
await list.close();

const bad = [];
for (const name of names) {
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  try {
    await p.goto(`${BASE}/scripts/__pagecheck.html?page=${name}`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await p.waitForFunction(() => window.__RESULT__ !== undefined, null, { timeout: 12000 });
  } catch { /* fall through to whatever was recorded */ }
  const verdict = await p.evaluate(() => window.__RESULT__ ?? "NO VERDICT (hung)").catch(() => "NAVIGATED AWAY");
  const tdz = errs.filter(e => /before initialization|before being defined/.test(e));
  if (verdict !== "ok" || tdz.length) bad.push({ name, verdict, tdz: tdz[0] });
  await p.close();
}
console.log(`PAGES CHECKED: ${names.length}`);
console.log(bad.length ? bad.map(r => `  ✗ ${r.name}: ${r.tdz || r.verdict}`).join("\n") : "  all mounted clean");
await b.close();
process.exitCode = bad.length ? 1 : 0;
