/**
 * openingDeal assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/openingDeal.test.mjs
 *
 * ═══ THE OPENING IS A DEAL, AND EVERY MISTAKE IN IT RENDERS ═════════════════
 * Ace riffles a deck, fans it, turns the middle card over to the ace of
 * spades and flies it into the logo while the navy opens onto the page. None
 * of what can go wrong throws: an ace that lands beside the logo is still a
 * nice animation, an iris that stops short leaves a sliver of navy, a riffle
 * that shuffles nothing is just seven cards, and a hold that never polls sits
 * on the ace forever. That last one happened while this was being built, and
 * only a recording showed it. Every check below was verified by putting the
 * bug back.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    DECK, BEATS, OPEN_MS, FLIGHT_MS, HOLD_MAX_MS, STOCK_FADE_DELAY_MS, STOCK_FADE_MS, LOGO_SWAP_MS,
    ANNOUNCE_MS, FLICK, LIFT_SCALE, PIP_SHARE, CARD_BORDER, ACE_INDEX, IRIS_EDGE,
    stackOf, riffleOf, fanAngle, foldDelay, flightTo, irisRadius, landable, holdStep, opensOn,
} from "@/lib/openingDeal";
import { OPENING_MAX_MS } from "@/components/marketing/flushGate";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const COMPONENT = "src/components/marketing/OpeningDeal.jsx";
const comp = read(COMPONENT);
const compCode = code(comp);
const html = read("index.html");

check("the beats run in order and the whole thing is about two and a half seconds", () => {
    const order = [BEATS.ARRIVE, BEATS.SPLIT, BEATS.RIFFLE, BEATS.FAN, BEATS.TURN];
    for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `beat ${i} lands before the one before it`);
    const total = BEATS.TURN + OPEN_MS;
    assert.ok(total >= 2300 && total <= 2700, `the ready path runs ${total}ms, and ~2.5s is what was asked for`);
});

check("the hold gives up before the hero hand does, so the hand never deals behind the curtain", () => {
    assert.ok(HOLD_MAX_MS + ANNOUNCE_MS < OPENING_MAX_MS,
        `the opening can announce at ${HOLD_MAX_MS + ANNOUNCE_MS}ms but the hand stops waiting at ${OPENING_MAX_MS}ms`);
    assert.ok(HOLD_MAX_MS > BEATS.TURN, "the ceiling is shorter than the deal it is a ceiling on");
});

check("THE HOLD POLLS FROM THE TICK IT STARTS, which it did not", () => {
    // The first check runs in the same tick as setPhase("hold"), when the
    // state still reads "turn". Treated as a stop, it never checked again.
    assert.equal(holdStep({ phase: "turn", ready: true, elapsed: 0 }), "open");
    assert.equal(holdStep({ phase: "turn", ready: false, elapsed: 0 }), "wait");
    assert.equal(holdStep({ phase: "hold", ready: false, elapsed: BEATS.TURN + 200 }), "wait");
    assert.equal(holdStep({ phase: "hold", ready: true, elapsed: BEATS.TURN + 200 }), "open");
    assert.equal(holdStep({ phase: "hold", ready: false, elapsed: HOLD_MAX_MS }), "open", "a page that never readies holds forever");
    for (const p of ["skip", "open", null, "fan"]) assert.equal(holdStep({ phase: p, ready: true, elapsed: 0 }), "stop", `${p} keeps polling`);
    assert.ok(/holdStep\(\{/.test(compCode), "the component decides the hold some other way");
});

check("the riffle is a riffle: a cut, the halves alternating, and the deck actually shuffled", () => {
    const rif = riffleOf(DECK);
    const orders = rif.map((r) => r.order).sort((a, b) => a - b);
    assert.deepEqual(orders, Array.from({ length: DECK }, (_, i) => i), "a card was dropped or doubled");
    const cut = Math.ceil(DECK / 2);
    rif.forEach((r, i) => assert.equal(r.side, i < cut ? -1 : 1, `card ${i} went to the wrong half`));
    // Back in order of return, the sides alternate until one half runs out.
    const bySeq = rif.map((r, i) => ({ ...r, i })).sort((a, b) => a.order - b.order);
    for (let k = 1; k < 2 * (DECK - cut); k++) assert.notEqual(bySeq[k].side, bySeq[k - 1].side, "two cards from one half fell together");
    assert.ok(rif.some((r, i) => r.order !== i), "every card is back where it started: the shuffle shuffled nothing");
});

check("the ace is the middle of the hand and upright in it, so its pivot can change without a jump", () => {
    const rif = riffleOf(DECK);
    const ace = rif.findIndex((r) => r.order === ACE_INDEX);
    assert.ok(ace >= 0, "no card becomes the ace");
    assert.equal(fanAngle(ACE_INDEX, DECK), 0, "the ace is tilted in the fan, and switching its pivot then jumps");
    for (let i = 0; i < DECK; i++) assert.ok(fanAngle(i, DECK) + fanAngle(DECK - 1 - i, DECK) === 0, "the fan is lopsided");
    assert.ok(foldDelay(0) < foldDelay(ACE_INDEX), "the hand folds from the middle out rather than the outside in");
    assert.equal(stackOf(DECK).length, DECK);
});

check("THE ACE LANDS ON THE LOGO: its pip becomes the glyph, centre and size", () => {
    // A card at 134px, lifted and scaled, flown to an 18.4px glyph at the top left.
    const layoutW = 134, layoutH = layoutW * 1.4;
    const box = { left: 573, top: 266, width: layoutW, height: layoutH };
    const origin = { x: box.left + layoutW / 2, y: box.top + layoutH / 2 };
    const liftY = -0.42 * layoutH;
    const card = {
        width: layoutW * LIFT_SCALE, height: layoutH * LIFT_SCALE,
        left: origin.x - (layoutW * LIFT_SCALE) / 2, top: origin.y + liftY - (layoutH * LIFT_SCALE) / 2,
    };
    const target = { left: 49, top: 23, width: 18.4, height: 18.4 };
    const f = flightTo(card, origin, target, LIFT_SCALE);
    assert.ok(f, "no flight for a card and a target that both exist");
    // The flight wrapper maps p → origin + t + s·(p − origin).
    const at = (p) => ({ x: origin.x + f.x + f.scale * (p.x - origin.x), y: origin.y + f.y + f.scale * (p.y - origin.y) });
    const c = at({ x: card.left + card.width / 2, y: card.top + card.height / 2 });
    assert.ok(Math.abs(c.x - (target.left + target.width / 2)) < 1e-9, `lands ${c.x - (target.left + target.width / 2)}px off in x`);
    assert.ok(Math.abs(c.y - (target.top + target.height / 2)) < 1e-9, `lands ${c.y - (target.top + target.height / 2)}px off in y`);
    const pipOnScreen = PIP_SHARE * (layoutW - 2 * CARD_BORDER) * LIFT_SCALE * f.scale;
    assert.ok(Math.abs(pipOnScreen - target.width) < 1e-9, `the pip arrives ${pipOnScreen}px wide on a ${target.width}px glyph`);
});

check("the landing holds wherever the ace sits in the deck box, on both axes", () => {
    // The ace is centred horizontally today, so an x term that ignores the
    // wrapper's scale cancels out in the fixture above; offset it both ways.
    const origin = { x: 640, y: 400 };
    for (const [ox, oy, s0] of [[37, -81, LIFT_SCALE], [-52, 23, 1], [12, 140, 1.6]]) {
        const w = 120 * s0, h = 168 * s0;
        const card = { width: w, height: h, left: origin.x + ox - w / 2, top: origin.y + oy - h / 2 };
        const target = { left: 1200, top: 760, width: 24, height: 24 };
        const f = flightTo(card, origin, target, s0);
        const cx = origin.x + f.x + f.scale * ox, cy = origin.y + f.y + f.scale * oy;
        assert.ok(Math.abs(cx - 1212) < 1e-9 && Math.abs(cy - 772) < 1e-9, `an ace offset by (${ox},${oy}) lands at (${cx},${cy})`);
    }
});

check("with nothing to land on, there is no flight and the ace goes out where it is", () => {
    const card = { left: 0, top: 0, width: 100, height: 140 };
    assert.equal(flightTo(card, { x: 50, y: 70 }, null), null);
    assert.equal(flightTo(card, null, { left: 0, top: 0, width: 18, height: 18 }), null);
    assert.equal(flightTo({ ...card, width: 0 }, { x: 0, y: 0 }, { left: 0, top: 0, width: 18, height: 18 }), null);
    assert.ok(/flight\.out \? 0 : 1/.test(compCode) && /\|\| \{[^}]*out: true/.test(compCode),
        "a missing target no longer has its own exit");
});

check("the logo is only a target when it is on screen and drawn", () => {
    assert.equal(landable({ left: 49, top: 23, right: 67, bottom: 41, width: 18, height: 18 }, 1280, 800), true);
    assert.equal(landable({ left: 32, top: 10959, right: 48, bottom: 10975, width: 16, height: 16 }, 1280, 800), false, "the footer logo is a target");
    assert.equal(landable({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }, 1280, 800), false, "a hidden logo is a target");
    assert.equal(landable(null, 1280, 800), false);
});

check("the iris clears every corner from wherever the ace was", () => {
    for (const [w, h] of [[1280, 800], [390, 844], [1920, 1080]]) {
        for (const [x, y] of [[0, 0], [w, h], [w / 2, h * 0.3], [w * 0.1, h * 0.9]]) {
            const r = irisRadius(x, y, w, h);
            for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
                assert.ok(r - IRIS_EDGE > Math.hypot(cx - x, cy - y), `a sliver of navy is left at (${cx},${cy}) on ${w}x${h}`);
            }
        }
    }
});

check("the flight is choreographed: the stock goes late, the logo swaps after landing, the glyph lands upright", () => {
    assert.ok(STOCK_FADE_DELAY_MS >= FLIGHT_MS * 0.4, "the stock fades from the start of the flight and goes grey over the navy");
    assert.ok(STOCK_FADE_DELAY_MS + STOCK_FADE_MS <= FLIGHT_MS, "the stock is still there when the pip lands");
    assert.ok(LOGO_SWAP_MS >= FLIGHT_MS && LOGO_SWAP_MS < OPEN_MS + 60, "the real glyph shows before the ace has landed, or after it has gone");
    assert.equal(FLICK[0], 0); assert.equal(FLICK[FLICK.length - 1], 0, "the glyph lands tilted against the logo's");
    assert.ok(FLIGHT_MS <= OPEN_MS, "the ace is still flying when the curtain goes");
});

check("the pip that flies is the pip that was printed: the same box as an ace's face", () => {
    const card = read("src/components/cards/PlayingCard.jsx");
    const aceBranch = card.slice(card.indexOf('if (String(rank) === "A")'), card.indexOf("// The pip is positioned by a wrapper"));
    const pct = /w-\[(\d+)%\] h-\[\1%\]/.exec(aceBranch);
    assert.ok(pct, "PlayingCard no longer prints an ace's pip in a square percentage box");
    assert.equal(Number(pct[1]) / 100, PIP_SHARE, "the ace's pip changed size and the flight still aims at the old one");
    assert.ok(new RegExp(`<SpadePip className="w-\\[${pct[1]}%\\] h-\\[${pct[1]}%\\]"`).test(compCode),
        "the overlay pip is not the printed pip's box, so it shows as a second mark until the stock fades");
    assert.ok(/border border-transparent grid place-items-center/.test(compCode), "the overlay is not inside the same 1px border as the card's pip");
    const brand = read("src/components/shared/BrandMark.jsx");
    assert.ok(/<span data-brand-spade/.test(code(brand)), "the logo glyph is no longer marked as the landing target");
    assert.ok(/<SpadePip className=\{s\.pip\}/.test(brand), "the logo is not drawn with the same glyph as the card");
});

check("it never opens onto a loader: every app loader is marked, and the component reads the mark", () => {
    const app = code(read("src/App.jsx"));
    const loaders = [...app.matchAll(/<div([^>]*)>\s*<AceShuffle size="lg"/g)];
    assert.ok(loaders.length >= 3, `found ${loaders.length} full loaders in App.jsx`);
    for (const m of loaders) assert.ok(/data-app-waiting/.test(m[1]), `an app loader is not marked: <div${m[1]}>`);
    assert.ok(/querySelector\("\[data-app-waiting\]"\)/.test(compCode), "the opening no longer checks for a loader before it opens");
    assert.ok(/<OpeningDeal \/>/.test(app), "App.jsx no longer mounts the opening");
});

check("the boot layer and the opening draw the line with ONE class, defined once", () => {
    assert.ok(/<div id="boot"[^>]*><span class="acedit-open-line">The new age of studying<\/span><\/div>/.test(html),
        "the boot layer's line is not the shared class, or says something else");
    assert.ok(/<p className="acedit-open-line"[^>]*>\s*The new age of studying\s*<\/p>/.test(compCode),
        "the opening draws its own line, which is how the two ended up in different places");
    assert.equal((html.match(/\.acedit-open-line\s*\{/g) || []).length, 1, "the line is styled more than once in index.html");
    assert.ok(!/acedit-open-line\s*\{/.test(read("src/index.css")), "a second definition of the line lives in index.css");
    assert.ok(/getAnimations/.test(compCode), "the line's fade is no longer phased off the boot layer's own clock");
    assert.ok(/\.acedit-open-deck\s*\{/.test(html) && /className="acedit-open-deck/.test(compCode), "the deck box is not the shared one");
});

check("it plays only on the marketing entry, once a session, never under reduced motion", () => {
    assert.equal(opensOn({ pathname: "/", seen: false, reduce: false }), true);
    assert.equal(opensOn({ pathname: "/", seen: true, reduce: false }), false);
    assert.equal(opensOn({ pathname: "/", seen: false, reduce: true }), false);
    assert.equal(opensOn({ pathname: "/Dashboard", seen: false, reduce: false }), false);
    assert.equal(opensOn({ pathname: "/", seen: false, reduce: null }), true, "an unresolved preference is not a refusal");
    assert.ok(/prefers-reduced-motion: reduce[\s\S]{0,60}#boot \{ display: none/.test(html), "the boot layer shows under reduced motion");
    assert.ok(/pathname !== "\/"\) b\.remove\(\)/.test(html), "the boot layer shows on routes the opening does not play on");
});

check("the page is hidden from paint, never from layout, and always given back", () => {
    assert.ok(!/root\.style\.display/.test(compCode), "the page is display:none'd, so the logo cannot be measured and it reflows on reveal");
    const eff = compCode.slice(compCode.indexOf('root.style.visibility = "hidden"'));
    const cleanup = eff.slice(eff.indexOf("return () => {"), eff.indexOf("}, [playing]);"));
    assert.ok(/root\.style\.visibility = prev/.test(cleanup), "an unmount mid-opening leaves the site invisible");
    assert.ok(/showLogo\(\)/.test(cleanup), "an unmount mid-flight leaves the logo hidden");
});

check("skipping is any input, and it tells the hand to deal", () => {
    for (const ev of ["wheel", "touchstart", "keydown"]) {
        assert.ok(new RegExp(`addEventListener\\("${ev}", skip`).test(compCode), `${ev} no longer skips`);
    }
    assert.ok(/onClick=\{skip\}/.test(compCode), "a tap no longer skips");
    const skip = compCode.slice(compCode.indexOf("const skip = useCallback"), compCode.indexOf("}, [announce]);", compCode.indexOf("const skip = useCallback")));
    assert.ok(/announce\(\)/.test(skip) && /showPage\(\)/.test(skip), "a skip leaves the hand waiting or the page hidden");
    const dealt = read("src/components/marketing/DealtHand.jsx");
    assert.ok(/addEventListener\(OPENING_DONE, open\)/.test(dealt), "the hero hand no longer listens for the opening");
});

check("the old storm is gone, not orphaned", () => {
    assert.ok(!fs.existsSync(new URL("../components/marketing/CardStorm.jsx", import.meta.url)), "CardStorm.jsx is back");
    for (const f of ["src/App.jsx", "src/components/marketing/DealtHand.jsx", "src/components/marketing/flushGate.js"]) {
        assert.ok(!/\bSTORM_(DONE|MAX_MS)\b|CardStorm/.test(code(read(f))), `${f} still names the storm`);
    }
});

check("no CSS easing string reaches framer, which throws on one and drops the whole batch", () => {
    const ok = new Set(["linear", "easeIn", "easeOut", "easeInOut", "circIn", "circOut", "circInOut", "backIn", "backOut", "backInOut", "anticipate"]);
    for (const m of compCode.matchAll(/ease:\s*"([^"]+)"/g)) assert.ok(ok.has(m[1]), `ease: "${m[1]}" is not one of framer's`);
});

console.log(`\n${passed} checks passed`);
