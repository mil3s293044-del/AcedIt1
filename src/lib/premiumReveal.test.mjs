/**
 * the moment somebody has just paid —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/premiumReveal.test.mjs
 *
 * ─── EVERY FAILURE HERE RENDERS PERFECTLY ───────────────────────────────────
 * This is the single biggest moment the product has and it is the screen
 * nobody opens twice, so none of its faults was ever going to be reported by
 * a student — they had already paid. Three of them shipped at once:
 *
 *   A LITERAL LIGHT PALETTE. It painted `from-green-50 via-blue-50`, put
 *   `text-green-50` on a `green-600` slab and a `purple-200`-bordered panel
 *   underneath. In the dark that is bright slabs on a near-black page — the
 *   failure /Paywall already records, and the reason focus mode's ground is a
 *   literal `#0A121F` rather than a token.
 *
 *   A HARD REDIRECT THROUGH THE MIDDLE OF IT. 2,500ms, which is less than the
 *   reveal takes to play, so the celebration was cut off mid-deal. Leaving is
 *   the student's tap now, with a long fallback for an abandoned tab.
 *
 *   AN ACE THAT PRINTED BLANK. `PlayingCard`'s default middle is `watermark`,
 *   one ghost suit at 3.5%, and its stock is `--surface` — the same colour as
 *   the panel it sits on. So the one card the whole screen is about came out
 *   white-on-white in the light and a black hole in the dark, between two
 *   bright green backs. `pips` is what prints a real ace, and the deal needed
 *   a table under it. ONLY A SCREENSHOT CAUGHT EITHER.
 */
import assert from "node:assert/strict";
import fs from "node:fs";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (e) { console.log(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

/* Comments are stripped before every scan. This file EXPLAINS the literal
   palettes it refuses, so without this the explanation is the defect — the
   false positive floorInk, fnResult and hookDeps each had to learn, whose
   obvious fix is deleting the sentence that says why. */
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const REVEAL = "src/components/subscription/PremiumReveal.jsx";
const PAGE = "src/pages/PaymentSuccess.jsx";
const src = (f) => strip(fs.readFileSync(f, "utf8"));

check("NO LITERAL LIGHT PALETTE on either file", () => {
    // Tailwind's -50/-100 fills and -700/-800/-900 inks are light-mode
    // literals: they do not follow the theme, so one left behind is a bright
    // slab on a near-black page. Tokens are what this screen is allowed.
    for (const f of [REVEAL, PAGE]) {
        const t = src(f);
        const bad = t.match(/\b(?:bg|text|border|from|via|to)-(?:green|blue|purple|red|amber|yellow|gray|slate)-(?:50|100|700|800|900)\b/g);
        assert.equal(bad, null, `${f} carries ${bad && bad.join(", ")} — those do not follow the theme`);
    }
});

check("THE GROUND IS A TOKEN, not a gradient somebody picked", () => {
    const t = src(PAGE);
    assert.ok(/bg-background/.test(t), "PaymentSuccess no longer paints a themed ground");
    assert.ok(!/bg-gradient-to/.test(t), "PaymentSuccess is back on a hand-picked gradient");
});

check("LEAVING IS A TAP — nothing redirects through the reveal", () => {
    // The old 2,500ms redirect was shorter than the animation it interrupted.
    // A fallback is fine and has to be long; anything under the reveal's own
    // run is the bug coming back.
    const t = src(REVEAL);
    const m = /fallbackMs\s*=\s*(\d+)/.exec(t);
    assert.ok(m, "the fallback is gone, so an abandoned tab never lands anywhere");
    assert.ok(Number(m[1]) >= 10000,
        `the fallback is ${m[1]}ms — that cuts the reveal off rather than catching an abandoned tab`);
    assert.ok(/onContinue/.test(t), "there is no way for the student to leave on their own");
});

check("THE ACE PRINTS AN ACE", () => {
    // Without `pips` the middle is `watermark` — one ghost suit at 3.5% — so
    // the card the headline is about renders blank in both themes.
    const t = src(REVEAL);
    const i = t.indexOf("<PlayingCard");
    assert.ok(i > -1, "the ace is gone from the reveal");
    const tag = t.slice(i, t.indexOf("/>", i));
    assert.ok(/\bpips\b/.test(tag), "the ace has no pips, so it prints a blank card");
    assert.ok(/rank="A"/.test(tag), "the card turned over is not an ace");
});

check("THE DEAL HAS A TABLE UNDER IT", () => {
    // Card stock is `--surface` and so is the panel, so without a well behind
    // the row all three cards are drawn in the colour of the thing behind
    // them. This is the whole reason the ace was invisible.
    const t = src(REVEAL);
    const i = t.indexOf("perspective");
    assert.ok(i > -1, "the deal no longer sets a vanishing point");
    const before = t.slice(Math.max(0, i - 600), i);
    assert.ok(/bg-secondary/.test(before),
        "the deal sits straight on the panel, so the cards are the colour of their own ground");
});

check("perspective is on the PARENT and the rotation on the child", () => {
    // An element cannot supply its own vanishing point; a rotateY without one
    // reads as a horizontal squash. MovePreview and AceDeal both record it.
    const t = src(REVEAL);
    const p = t.indexOf("perspective");
    const r = t.indexOf("rotateY");
    assert.ok(p > -1 && r > p,
        "the rotation is not inside the element that establishes the perspective");
});

console.log(`\npremiumReveal: ${passed} checks passed`);
