/**
 * aceLoading assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/aceLoading.test.mjs
 *
 * ═══ ONE LOADER, AND THIS IS WHAT KEEPS IT ONE ══════════════════════════════
 * `AceShuffle` shipped and the generic spinners were simply left where they
 * were, so the commonest wait in the app played BOTH — a green ring while the
 * page's chunk arrived, then the riffle while its data did. Two different
 * loaders, in sequence, on one navigation.
 *
 * Nothing catches that. A `<Loader2 className="animate-spin" />` renders
 * perfectly, passes lint, passes the build, and is simply a DIFFERENT loader
 * from the one either side of it — the same invisible class as the hand-rolled
 * mark allocation `quizScore.test.mjs` scans for, and the envelope read
 * `fnResult.test.mjs` scans for. So it is scanned for too.
 *
 * Two idioms, because the app had both:
 *
 *   `<Loader2 …/>`  — lucide's spinner, 68 of them across 44 files.
 *   a hand-rolled `border-t-* rounded-full animate-spin` ring, which is what
 *   `App.jsx` drew on every single page navigation.
 *
 * ═══ WHAT IS DELIBERATELY NOT AN OFFENCE ═══════════════════════════════════
 * `animate-spin` on a REFRESH glyph is not a loader — it is the refresh icon
 * turning, which says "this control is working" in the place the control
 * already is, and swapping a card deck in for it would be nonsense. Only
 * `Loader2` and the ring are loaders pretending to be somewhere else.
 *
 * `AceDeal` (the Compete floor) and `AceLoading`'s `toss` / `think` variants
 * are the specialised waits and are NOT exceptions to the rule — they are Ace
 * doing something rather than a generic spinner, which is the rule.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (e) { console.log(`FAIL  ${name}\n      ${e.message}\n`); process.exitCode = 1; }
};

const SRC = path.resolve("src");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.jsx?$/.test(e.name) ? [full] : [];
});
const rel = (f) => path.relative(SRC, f);
// The loader's own file documents both broken idioms in its header, the same
// exemption fnResult.js needs for exactly the same reason.
const SELF = new Set(["components/ace/AceShuffle.jsx", "lib/aceLoading.test.mjs"]);
const files = walk(SRC).filter((f) => !SELF.has(rel(f)));

check("nothing renders lucide's Loader2", () => {
    const offenders = files.filter((f) => /<Loader2\b/.test(fs.readFileSync(f, "utf8")));
    assert.deepEqual(offenders.map(rel), [],
        "these render a generic spinner where the rest of the app riffles a deck — "
        + "use <AceShuffle size=\"sm\" /> in a control or beside a line of text, "
        + "<AceLoading> for a whole panel");
});

check("and nothing imports it either", () => {
    // An import with no render is the next one waiting to happen, and it is
    // what makes the offence easy to reintroduce without thinking about it.
    const offenders = files.filter((f) => {
        const src = fs.readFileSync(f, "utf8");
        return /\bLoader2\b/.test(src) && /from\s+["']lucide-react["']/.test(src);
    });
    assert.deepEqual(offenders.map(rel), []);
});

check("NO HAND-ROLLED SPINNING RING ANYWHERE", () => {
    // `App.jsx`'s was the worst component in the codebase by exposure: every
    // one of the 24 pages is code-split, so it fired on every navigation and
    // handed straight over to a completely different loader.
    const RING = /rounded-full[^"'`]*animate-spin|animate-spin[^"'`]*rounded-full/;
    const offenders = files.filter((f) => {
        const src = fs.readFileSync(f, "utf8");
        return RING.test(src) && /border-t-/.test(src);
    });
    assert.deepEqual(offenders.map(rel), []);
});

check("a refresh glyph that turns is NOT caught", () => {
    // The scanner has to leave this alone or it is a rule nobody can follow:
    // `RefreshCw` spinning IS the control working, in the control's own place.
    const src = "<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />";
    assert.equal(/<Loader2\b/.test(src), false);
    assert.equal(/rounded-full[^"'`]*animate-spin/.test(src) && /border-t-/.test(src), false);
});

check("the scanner recognises the shapes it is looking for", () => {
    // Verified by putting each bug back, the way fnResult.test.mjs was.
    assert.ok(/<Loader2\b/.test('<Loader2 className="w-4 h-4 animate-spin" />'));
    const ring = '<div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />';
    assert.ok(/rounded-full[^"'`]*animate-spin/.test(ring) && /border-t-/.test(ring));
});

check("every wait still has SOMETHING to draw", () => {
    // The replacement is only correct if the loader is actually mounted. A
    // file that dropped its spinner and imported nothing is a wait that now
    // renders empty space, which is worse than the spinner it replaced.
    const offenders = files.filter((f) => {
        const src = fs.readFileSync(f, "utf8");
        if (!/<AceShuffle\b|<AceLoading\b/.test(src)) return false;
        return !/from\s+["']@\/components\/ace\/AceShuffle["']/.test(src);
    });
    assert.deepEqual(offenders.map(rel), [], "renders the loader without importing it");
});

console.log(`\n${passed} passed`);
