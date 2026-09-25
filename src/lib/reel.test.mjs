/**
 * reel assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/reel.test.mjs
 *
 * Three classes of failure, and all three render perfectly.
 *
 * A PLACEHOLDER CARD IS THE DANGEROUS ONE. The hand at the bottom of the reel
 * is the whole reason this reads as one film, and it works only because every
 * card in it is a real fact the student has just been shown. One branch of
 * `cardFor` returning a card-shaped object with a dash in it teaches them, in
 * the first ninety seconds, that the objects on this screen are decoration —
 * after which the real ones do not land either. That is the dashboard rail's
 * rule and `previewFor`'s rule, applied to the surface that converts.
 *
 * THE CURVE IS MIRRORED THREE WAYS. `RETENTION_K` is derived from SM-2's own
 * 90% target in lib/retention, and the marketing chart used to carry
 * `Math.log(10 / 9)` written out again. A changed exponent would put the
 * landing page's promise and the product's scheduler on different curves,
 * silently, and both would still draw. The scan below is the only thing that
 * catches it.
 *
 * AND `dealt` FIRES FROM AN INTERSECTION OBSERVER, which re-fires every time
 * somebody scrolls back up through an act. Appending blindly deals the same
 * card four times to a reader who went back to re-read the marking.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    ACTS, FIRST_STEP, actIds, indexOf, actAt, step, nextAct, prevAct, groundOf, GROUNDS,
    reelProgress, weeksUntilExams, dealt, cardFor, HAND_CAP,
    forgettingReadout, aloneAt, spacedAt, CURVE_DAYS,
    deviceTier, TIERS, PARTICLES,
    tutorGap, TUTOR_HOURS_MAX, TUTOR_HOURLY, ACEDIT_WEEKLY,
} from "@/lib/reel";
import { RETENTION_K } from "@/lib/retention";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

/* ── The manifest ─────────────────────────────────────────────────────── */

check("act ids are unique", () => {
    const ids = actIds();
    assert.equal(new Set(ids).size, ids.length);
});

check("every act carries a chapter label for the rail", () => {
    for (const a of ACTS) {
        assert.ok(a.chapter && a.chapter.trim().length, `${a.id} has no chapter`);
        assert.ok(a.kind === "scene" || a.kind === "step", `${a.id} has an odd kind`);
    }
});

check("EVERY act declares the ground its chrome must read", () => {
    // The nav and the chapter rail are `position: fixed`: they float over
    // whichever act is on screen and belong to none of them. The first version
    // hard-coded their ink and rendered as a grey slab with unreadable type
    // over the three dark acts, with a chapter rail that was near-black on
    // near-black. Both render, both pass lint and the build; only a screenshot
    // caught either. An act added later must not be able to inherit the wrong
    // one by omission.
    for (const a of ACTS) {
        assert.ok(GROUNDS.includes(a.ground), `${a.id} declares ground "${a.ground}"`);
        assert.equal(groundOf(a.id), a.ground);
    }
    // An unknown id answers light: the film opens and closes on cream, and
    // guessing dark would put white type on it, which is invisible.
    assert.equal(groundOf("not-an-act"), "light");
    assert.equal(groundOf(undefined), "light");
});

check("scenes come first and steps are contiguous after them", () => {
    // The seam is the whole design: everything before FIRST_STEP makes the
    // case, everything after it asks a question, and there is nothing between
    // them. Interleaving a scene back into the wizard would put a sales pitch
    // between two questions, which is what the old flow did and why it read
    // as being sold to mid-form.
    const kinds = ACTS.map((a) => a.kind);
    assert.equal(kinds.indexOf("step"), FIRST_STEP);
    assert.ok(!kinds.slice(FIRST_STEP).includes("scene"));
    assert.ok(!kinds.slice(0, FIRST_STEP).includes("step"));
});

check("no scene gates: a skimmer can always get past", () => {
    // The gesture is the point and is never a detention. The people most
    // likely to pay are the least willing to be held up by a puzzle box.
    for (const a of ACTS.filter((x) => x.kind === "scene")) {
        assert.equal(a.gate, false, `${a.id} gates a scene`);
    }
});

/* ── Moving through it ────────────────────────────────────────────────── */

check("step clamps at both ends rather than running off", () => {
    const first = ACTS[0].id, last = ACTS[ACTS.length - 1].id;
    assert.equal(prevAct(first), first);
    assert.equal(nextAct(last), last);
    assert.equal(step(first, -50), first);
    assert.equal(step(last, 50), last);
});

check("an unknown act id lands on the first act, never undefined", () => {
    // Every caller of this is a key handler or a button. Returning undefined
    // navigates to `#undefined` and the film simply stops.
    assert.equal(step("not-an-act", 1), ACTS[0].id);
    assert.equal(indexOf("not-an-act"), -1);
    assert.equal(actAt(99), null);
});

check("progress runs 0 → 1 across the whole film", () => {
    assert.equal(reelProgress(ACTS[0].id), 0);
    assert.equal(reelProgress(ACTS[ACTS.length - 1].id), 1);
    assert.equal(reelProgress("nope"), 0);
});

/* ── Weeks until exams ────────────────────────────────────────────────── */

check("weeks until exams rolls forward rather than counting backwards", () => {
    // Late December, after every exam date has passed. The answer must be
    // next year's exams, not a negative number.
    const dec = new Date(2026, 11, 20);
    for (const yr of ["Year 12", "Year 11", "Year 10"]) {
        const { weeks } = weeksUntilExams(yr, dec);
        assert.ok(weeks > 0, `${yr} in December gave ${weeks}`);
        assert.ok(weeks <= 53, `${yr} in December gave ${weeks}`);
    }
});

check("year 12 sits before year 11, which sits before junior", () => {
    const mar = new Date(2026, 2, 1);
    const y12 = weeksUntilExams("Year 12", mar).weeks;
    const y11 = weeksUntilExams("Year 11", mar).weeks;
    const y10 = weeksUntilExams("Year 10", mar).weeks;
    assert.ok(y12 < y11 && y11 < y10, `${y12} / ${y11} / ${y10}`);
});

/* ── The forgetting act ───────────────────────────────────────────────── */

check("the curve is imported, not restated", () => {
    // Guard on the mirror class. If lib/retention's constant changed and this
    // module had its own, the two would silently diverge.
    assert.ok(Math.abs(RETENTION_K - Math.log(10 / 9)) < 1e-12);
});

check("nothing outside lib/retention declares the curve constant", () => {
    // THE SCAN. It is not enough that reel.js imports it — the failure is a
    // FOURTH copy appearing in a component six months from now, which renders
    // perfectly and is simply a different curve from the product's.
    const root = path.resolve("src");
    const offenders = [];
    const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) { walk(p); continue; }
            if (!/\.(js|jsx|mjs)$/.test(e.name)) continue;
            if (p.endsWith(path.join("lib", "retention.js"))) continue;
            if (p.endsWith(path.join("lib", "reel.test.mjs"))) continue;
            // COMMENTS ARE STRIPPED FIRST. Both this module and lib/retention
            // describe the trap in prose, and a scan that cannot tell a
            // warning about a constant from the constant itself punishes
            // exactly the files documenting why it exists. Naive, but the
            // shapes it gets wrong (a `//` inside a string) do not occur here.
            const src = fs.readFileSync(p, "utf8")
                .replace(/\/\*[\s\S]*?\*\//g, " ")
                .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
            // `Math.log(10 / 9)` and `-Math.log(0.9)` are the same number
            // written two ways; both are the constant, however it is spelled.
            if (/Math\.log\(\s*10\s*\/\s*9\s*\)/.test(src) || /-\s*Math\.log\(\s*0?\.9\s*\)/.test(src)) {
                offenders.push(path.relative(root, p));
            }
        }
    };
    walk(root);
    assert.deepEqual(offenders, [],
        `the retention constant is restated in: ${offenders.join(", ")} — import RETENTION_K instead`);
});

check("spacing beats one pass at every day on the chart", () => {
    // If this ever inverts, the landing page is drawing an argument against
    // the product it is selling.
    for (let d = 1; d <= CURVE_DAYS; d += 1) {
        assert.ok(spacedAt(d) > aloneAt(d), `day ${d}: ${spacedAt(d)} vs ${aloneAt(d)}`);
    }
});

check("both lines start at full, and the spaced line SAWS rather than holding", () => {
    assert.equal(Math.round(aloneAt(0) * 100), 100);
    assert.equal(Math.round(spacedAt(0) * 100), 100);

    // The saw IS the trick being sold: recall decays across an interval and
    // each review puts it back to full. So the line is deliberately NOT
    // monotonic, and an earlier version of this test asserted that it was —
    // day 30 sits just past the fourth review and is legitimately HIGHER than
    // day 25, which is four fifths of the way through the third interval.
    // Asserting monotonicity here would have forced the model to draw a line
    // that never recovers, which is an argument against the product.
    assert.ok(spacedAt(26.5) > spacedAt(25.9), "the fourth review does not lift the line");

    // And nothing claims permanence: inside the tail, past every review, it
    // still falls.
    assert.ok(spacedAt(CURVE_DAYS) < spacedAt(27), "the tail has gone flat");
    assert.ok(aloneAt(CURVE_DAYS) < aloneAt(1));
});

check("the readout is rounded ONCE, so the gap matches the printed numbers", () => {
    // Rounding at two call sites lets the headline and the caption disagree by
    // a point at some drag positions, which is the screen arguing with itself.
    for (let d = 0; d <= CURVE_DAYS; d += 1) {
        const r = forgettingReadout(d);
        assert.equal(r.gap, r.spaced - r.alone, `day ${d}`);
    }
});

check("the readout clamps its input rather than plotting off the chart", () => {
    assert.equal(forgettingReadout(-10).days, 0);
    assert.equal(forgettingReadout(999).days, CURVE_DAYS);
    assert.equal(forgettingReadout("banana").days, 0);
    assert.equal(forgettingReadout(null).days, 0);
});

/* ── The hand ─────────────────────────────────────────────────────────── */

const card = (id, label) => ({ id, rank: "9", suit: "spade", label });

check("dealing the same act twice does not deal two cards", () => {
    // The observer re-fires every time somebody scrolls back up.
    let hand = [];
    for (let i = 0; i < 5; i += 1) hand = dealt(hand, card("forget", "63% left"));
    assert.equal(hand.length, 1);
});

check("a later deal replaces in place and keeps the hand's order", () => {
    // A student who goes back and picks a sixth subject must see six — and the
    // card must not jump to the end of the row when they do.
    let hand = dealt(dealt(dealt([], card("deal", "11 weeks")), card("subjects", "5 subjects")), card("target", "85"));
    hand = dealt(hand, card("subjects", "6 subjects"));
    assert.deepEqual(hand.map((c) => c.id), ["deal", "subjects", "target"]);
    assert.equal(hand[1].label, "6 subjects");
});

check("the hand is capped and a junk deal is ignored", () => {
    let hand = [];
    for (let i = 0; i < HAND_CAP + 6; i += 1) hand = dealt(hand, card(`c${i}`, String(i)));
    assert.equal(hand.length, HAND_CAP);
    assert.equal(dealt(hand, null), hand);
    assert.equal(dealt(hand, { label: "no id" }), hand);
});

/* ── What each act deals ──────────────────────────────────────────────── */

check("EVERY act refuses to deal a placeholder", () => {
    // The one that matters. Empty state in, nothing out — for every act, so a
    // branch added later cannot quietly start printing a dash on a card.
    for (const a of ACTS) {
        assert.equal(cardFor(a.id, {}), null, `${a.id} dealt a card from nothing`);
        assert.equal(cardFor(a.id, undefined), null, `${a.id} dealt a card from undefined`);
    }
    assert.equal(cardFor("not-an-act", { weeks: 9 }), null);
});

check("Number(null) === 0 cannot deal a card", () => {
    // Five modules in this codebase have been bitten by this exact coercion.
    // Here it would print "0 weeks until exams" and "$0 gap" on a student's
    // first screen.
    assert.equal(cardFor("deal", { weeks: null }), null);
    assert.equal(cardFor("deal", { weeks: 0 }), null);
    assert.equal(cardFor("cost", { yearGap: null }), null);
    assert.equal(cardFor("cost", { yearGap: 0 }), null);
    assert.equal(cardFor("target", { targetAtar: null }), null);
    // Act one needs BOTH halves: a week count with no year behind it is a
    // number the student cannot check.
    assert.equal(cardFor("deal", { weeks: 11 }), null);
    assert.equal(cardFor("deal", { yearLevel: "Year 12" }), null);
    assert.equal(cardFor("subjects", { subjects: [] }), null);
    assert.equal(cardFor("forget", { readout: { days: 0, alone: 100, spaced: 100 } }), null);
});

check("a real answer deals a card carrying the real figure", () => {
    const c = cardFor("deal", { weeks: 11, yearLevel: "Year 12", weeksLabel: "until VCE written exams start" });
    assert.equal(c.id, "deal");
    assert.equal(c.label, "11 weeks");
    assert.ok(c.note.includes("exams"));

    const s = cardFor("subjects", { subjects: ["Methods", "Chemistry", "English", "Physics"] });
    assert.equal(s.label, "4 subjects");
    assert.equal(s.note, "Methods, Chemistry, +2");
});

check("act one is the only year question in the film", () => {
    // Asking the same thing twice is what a form does when its two halves were
    // built by different people — precisely the impression this rebuild
    // exists to destroy. There must be no separate year step.
    assert.ok(!actIds().includes("year"), "a second year question came back");
    const c = cardFor("deal", { weeks: 11, yearLevel: "Year 12" });
    assert.equal(c.yearLevel, "Year 12", "act one's card does not carry the answer forward");
});

/* ── What it costs ────────────────────────────────────────────────────── */

check("the tutor comparison is costed conservatively and clamps", () => {
    // Tutoring over 40 school weeks, AcedIt over 52 — the asymmetry that
    // flatters us LEAST, because the honest comparison already wins and an
    // exaggerated one is checkable by anyone with a parent.
    const two = tutorGap(2);
    assert.equal(two.tutor, 2 * TUTOR_HOURLY * 40);
    assert.equal(two.acedit, ACEDIT_WEEKLY * 52);
    assert.equal(two.gap, two.tutor - two.acedit);
    assert.equal(tutorGap(99).hours, TUTOR_HOURS_MAX);
    assert.equal(tutorGap(-5).hours, 0);
    assert.equal(tutorGap("banana").hours, 0);
});

check("at zero hours the gap is zero, never negative", () => {
    // AcedIt costs more than no tutor at all. A card reading "-$260 the gap,
    // over a year" is the screen arguing against itself, so the act deals
    // nothing there instead.
    assert.equal(tutorGap(0).gap, 0);
    assert.equal(cardFor("cost", { yearGap: tutorGap(0).gap }), null);
});

check("no act hands out an ace it did not earn", () => {
    // Rank means strength on eighteen surfaces and an ace is always earned.
    // The scene cards are facts a student was shown, not achievements — only
    // the target, which is the student's own declared ambition, is an ace.
    const scenes = ACTS.filter((a) => a.kind === "scene").map((a) => a.id);
    const dealtScenes = [
        cardFor("deal", { weeks: 11, yearLevel: "Year 12" }),
        cardFor("forget", { readout: { days: 7, alone: 21, spaced: 94 } }),
        cardFor("marking", { criterion: { cost: 2, label: "does not name the transfer" } }),
        cardFor("science", { technique: { label: "Active recall", region: "hippocampus" } }),
        cardFor("cost", { yearGap: 4420 }),
    ].filter(Boolean);
    assert.equal(dealtScenes.length, scenes.length - 1);   // "hand" deals nothing; it IS the hand
    for (const c of dealtScenes) assert.notEqual(c.rank, "A", `${c.id} handed out an ace`);
});

/* ── Device tier ──────────────────────────────────────────────────────── */

check("an unknown machine is treated as capable", () => {
    // deviceMemory and hardwareConcurrency are absent on Safari. Guessing
    // "weak" there strips the film from every iPhone; guessing "capable"
    // costs one slow phone some frames.
    assert.equal(deviceTier({}), "full");
    assert.equal(deviceTier({ memory: undefined, cores: undefined }), "full");
});

check("reduced motion wins over everything", () => {
    assert.equal(deviceTier({ reducedMotion: true, memory: 32, cores: 16 }), "still");
});

check("a weak or data-saving machine gets a designed reduction, not nothing", () => {
    assert.equal(deviceTier({ memory: 2 }), "lite");
    assert.equal(deviceTier({ cores: 4 }), "lite");
    assert.equal(deviceTier({ saveData: true, memory: 32, cores: 16 }), "lite");
    // "lite" still gets a storm. It is fewer particles, not an empty stage.
    assert.ok(PARTICLES.lite > 0);
    assert.equal(PARTICLES.still, 0);
    assert.ok(PARTICLES.full > PARTICLES.lite);
});

check("every tier has a particle budget", () => {
    for (const t of TIERS) assert.ok(Number.isFinite(PARTICLES[t]), `${t} has no budget`);
});

console.log(`\n${passed} reel assertions passed.`);
