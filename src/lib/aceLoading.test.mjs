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

/** One named file, from the repo root. */
const read = (f) => fs.readFileSync(path.resolve(f), "utf8");

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


/* ── The floor's deal: the skeleton has to BE the page ───────────────────── */

check("THE DEAL DRAWS THE WHOLE FLOOR, not just the cards", () => {
    // It drew six card slots and nothing else, so the header, the three tabs,
    // the chip row and the 300px tape rail all appeared at once the moment the
    // data landed — on the one screen whose loader exists to stop the page
    // rearranging itself. Each region is named here rather than counted,
    // because a missing one is invisible: the page simply snaps when it loads.
    const deal = read("src/components/market/AceDeal.jsx");
    for (const region of [
        "The floor",        // the header's kicker
        "The tape",         // the 300px rail, the easiest one to forget
        "Cred",             // the figure in the header strip
    ]) {
        assert.ok(deal.includes(`>${region}<`),
            `the deal no longer draws "${region}" — that region will snap in`);
    }
    assert.match(deal, /lg:grid-cols-\[minmax\(0,1fr\)_300px\]/,
        "the board/tape split is gone, so the board moves sideways on load");
    // AND HE IS NEVER OVER A CARD. He stood at the board's left edge, on top
    // of the first one, for the whole wait — the cards being the thing the
    // student is here to watch arrive. A NEGATIVE top is what lifts him clear
    // of the grid into the chip and tab rows above it.
    assert.match(deal, /-top-\[\d+px\]/,
        "Ace is back down on the board, covering the first card");
});

check("A SLOT IS A REAL CARD'S HEIGHT, measured rather than guessed", () => {
    // The slot was `h-[132px]` against a real MarketCard that measures 316 at
    // its SHORTEST — three rows of that is about 550px of jump, under a
    // component whose own header promises nothing jumps. 316 is the commonest
    // card (a weekly streak line); the taller kinds cannot be matched and the
    // common one is what makes the usual case seamless.
    // AND IT IS NOT ONE NUMBER. The board is one column under `sm`, where a
    // 360px phone draws a 328px card whose title takes a third line — 338px,
    // measured the same way. A single desktop figure leaves the same jump on
    // the half of the traffic that is phones.
    const deal = read("src/components/market/AceDeal.jsx");
    const hits = [...deal.matchAll(/--slot-h:(\d+)px/g)].map((m) => Number(m[1]));
    assert.equal(hits.length, 2,
        "the slot needs a phone height and a desktop one, published on the grid");
    for (const h of hits) {
        assert.ok(h >= 280 && h <= 460,
            `${h}px is not the height of any card on that board`);
    }
    // The narrow one is the TALLER one: less width is more wrapping.
    assert.ok(hits[0] > hits[1],
        "the phone slot must be the taller of the two, or the fix is backwards");
});

check("THE LATTICE IS IN PIXELS, so a wide card is not a different deck", () => {
    // `CardBack` drew its weave inside `viewBox="0 0 100 140"` with
    // `preserveAspectRatio="none"`, which scales user space with the box — so
    // a `userSpaceOnUse` pattern inside it stretched too. On the floor's
    // 400x304 slots the 8px weave came out at roughly 32x17 and skewed, which
    // is the EXACT failure that component's own comment says the pattern was
    // chosen to avoid. It renders perfectly either way; only a screenshot at an
    // unusual aspect shows it.
    // COMMENTS FIRST. The fix is documented in CardBack's own words, in prose
    // that names the very attributes this looks for — so a scan over the raw
    // source reads the explanation as the defect. That is the false positive
    // `fnResult.test.mjs` and `hookDeps.test.mjs` each had to learn about, and
    // it fired here on the first run.
    const card = read("src/components/cards/PlayingCard.jsx")
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    const back = card.slice(card.indexOf("export function CardBack"));
    assert.ok(!/viewBox=["']0 0 100 140["']/.test(back),
        "CardBack's lattice is back inside a stretched viewBox");
    assert.ok(!/preserveAspectRatio=["']none["']/.test(back),
        "CardBack's lattice is being non-uniformly scaled again");
});


console.log(`\n${passed} passed`);
