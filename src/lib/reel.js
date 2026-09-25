// ════════════════════════════════════════════════════════════════════════════
// reel — the landing page and the onboarding wizard as ONE continuous film.
//
// WHAT WAS WRONG WITH THE OLD PAIR, stated plainly because the fix only makes
// sense against it. The landing page was thirteen alternating bands that faded
// up as you passed them: a brochure. It ended with `window.location.assign`,
// a FULL DOCUMENT RELOAD, into a six-step wizard with a segmented progress bar.
// So the two halves of the only journey that converts anybody were a brochure
// and a form, joined by a white flash.
//
// THE REEL IS ONE OBJECT WITH ACTS IN IT. Nine of them: six scenes that make
// the case and three that ask the questions, and NOTHING between the sixth and
// the seventh — no navigation, no remount, no flash. A student who presses
// "deal me in" watches the same table they have been sitting at for ninety
// seconds ask them their year level.
//
// THREE RULES THE WHOLE THING RESTS ON
//
// 1. EVERY ACT PAYS OUT A CARD. This is the wizard's own rule — "every question
//    pays out", the reason it converts — extended BACKWARDS into the landing.
//    An act you have played leaves a real card in a hand at the bottom of the
//    screen, and that hand is the progress indicator: it shows what you have
//    LEARNED rather than how many screens are left. The card carries a fact
//    that is true and checkable, never a compliment and never a claim about
//    AcedIt. `cardFor` is where each one is minted and it returns NULL rather
//    than a placeholder when the fact is not real yet — the same refusal
//    `previewFor` and the dashboard rail make, for the same reason: a hand with
//    an invented card in it makes the real ones worthless.
//
// 2. THE INTERACTION IS THE POINT, AND IT IS NEVER A GATE. Each act asks for
//    one gesture, and the gesture is what teaches the point — you drag the days
//    and watch your own retention fall, you tap the phrase and see what it
//    cost. But `gate` is false on every scene: a student who wants to skim can
//    scroll, arrow, or click the chapter rail straight past. Requiring the
//    gesture would convert the film into a puzzle box, and the people most
//    likely to pay are the ones least willing to be detained.
//
// 3. SCROLL IS THE ESCAPE HATCH, NOT THE ENGINE. Advancing is a gesture, a key
//    or a rail click. Scrolling still works natively, because the acts are real
//    elements in a real scroll container with snap points — we never listen for
//    a wheel event and swallow it. Hijacking the scroll wheel is the one thing
//    that makes a site like this unusable on a trackpad, with a screen reader,
//    or on any browser whose gesture model we did not anticipate.
//
// The credits tail (pricing detail, FAQ, the feature list, the footer) sits
// BELOW the last act as ordinary scrolling page. It is not an act: it is
// reference, it is where the search engine and the sceptic go, and giving it
// snap points would make leaving the film feel like being detained by it.
// ════════════════════════════════════════════════════════════════════════════

import { RETENTION_K, stabilityFor, recallAfter } from "@/lib/retention";

/* ── The acts ─────────────────────────────────────────────────────────────
 *
 * `kind` is "scene" for the ones that make the case and "step" for the ones
 * that ask a question. It is the ONLY difference between the two halves of the
 * reel, and it exists so the chapter rail can draw them differently — not so
 * they can behave differently. A step is a scene that happens to want an
 * answer.
 */
/**
 * `ground` IS NOT DECORATION — IT IS WHAT THE CHROME READS ITS INK OFF.
 *
 * The nav and the chapter rail are `position: fixed`: they sit OVER whichever
 * act is on screen and belong to none of them. Hard-coding their ink is the
 * exact failure `Countdown variant="banner"` already records in this codebase
 * — `text-white` was legible on the dark header it was written for and
 * invisible on every light surface it was later reused on. Here it shipped the
 * other way round: a cream nav bar with near-black type, floating over three
 * consecutive dark acts as a grey slab, and a chapter rail in `currentColor`
 * that was near-black on near-black and simply could not be seen.
 *
 * Only a SCREENSHOT caught either. Both render, both pass lint and the build,
 * and neither throws.
 *
 * So the ACT declares its ground and the chrome follows. A new act cannot
 * forget to — `reel.test.mjs` asserts every one of them has a ground, because
 * an act added later would otherwise inherit whatever the last one happened to
 * be and be wrong exactly half the time.
 */
export const ACTS = [
    // ACT ONE IS THE YEAR QUESTION, and that is the whole seam dissolving at
    // beat one rather than beat six. A student's first gesture on this site is
    // picking a card, the card pays out a real number they did not know, and
    // the answer it captured is one the wizard would otherwise have asked for
    // on a grey screen four minutes later. There is deliberately no second
    // year step: asking twice is what a form does when its halves were built
    // by different people, which is exactly the impression this rebuild exists
    // to destroy. The subjects act carries a small chip to change it, so a
    // student who scrolled straight past act one is not stranded without one.
    { id: "deal", ground: "light",      kind: "scene", chapter: "Deal in",     gate: false },
    { id: "forget", ground: "dark",    kind: "scene", chapter: "What you lose", gate: false },
    { id: "marking", ground: "dark",   kind: "scene", chapter: "The marking",  gate: false },
    { id: "science", ground: "dark",   kind: "scene", chapter: "The science",  gate: false },
    { id: "cost", ground: "light",      kind: "scene", chapter: "What it costs", gate: false },
    { id: "hand", ground: "light",      kind: "scene", chapter: "Your hand",    gate: false },
    // ── no seam here. This is the same reel, the same table, the same hand ──
    { id: "subjects", ground: "light",  kind: "step",  chapter: "Your subjects", gate: true },
    { id: "target", ground: "light",    kind: "step",  chapter: "Your target",  gate: true },
    { id: "signin", ground: "light",    kind: "step",  chapter: "Deal me in",   gate: true },
];

/** Where the film stops making a case and starts asking questions. */
export const FIRST_STEP = ACTS.findIndex((a) => a.kind === "step");

export const actIds = () => ACTS.map((a) => a.id);

/**
 * The ground an act paints, for the fixed chrome floating over it.
 *
 * Defaults to "light" for an id it does not recognise, because the film opens
 * and closes on cream and an unknown act is far more likely to be a new one at
 * either end than a new dark middle. Guessing dark would put white type on
 * cream, which is invisible; guessing light puts dark type on cream, which is
 * merely the wrong act.
 */
export const groundOf = (id) => ACTS.find((a) => a.id === id)?.ground || "light";
export const GROUNDS = ["light", "dark"];
export const indexOf = (id) => ACTS.findIndex((a) => a.id === id);
export const actAt = (i) => ACTS[i] || null;

/**
 * Clamped, always. An advance off either end of the reel returns the end it
 * ran into rather than -1 or undefined: every caller of this is a key handler
 * or a button, and the correct behaviour at the last act is to stay on the
 * last act, not to navigate to `undefined`.
 */
export function step(id, delta) {
    const i = indexOf(id);
    if (i < 0) return ACTS[0].id;
    return ACTS[Math.min(ACTS.length - 1, Math.max(0, i + delta))].id;
}

export const nextAct = (id) => step(id, 1);
export const prevAct = (id) => step(id, -1);

/** 0 → 1 across the whole film, for the progress hairline. */
export function reelProgress(id) {
    const i = indexOf(id);
    if (i < 0) return 0;
    return ACTS.length > 1 ? i / (ACTS.length - 1) : 1;
}

/* ── Weeks until exams ────────────────────────────────────────────────────
 *
 * MOVED HERE OUT OF Payout.jsx, unchanged, for the reason `sm2.js` and
 * `mastery.js` were moved out of their components: the reel's first act pays
 * out this number before the wizard has asked anything, so it now has two
 * consumers, and the second one is asserted by a test. A .jsx cannot be
 * imported by the test loader — the lesson `mirrors.test.mjs` had to work
 * around for `xpSystem.jsx` — so a number two surfaces print has to live in a
 * .js or it cannot be pinned at all. Payout re-exports it, so nothing that
 * imported it from there had to change.
 *
 * VCE written exams run from late October; Units 1 and 2 exams sit in
 * November; junior years finish out the school year in December. Computed
 * against the current date rather than hard-coded, so the number is right in
 * March and still right in September, and it rolls to next year once the date
 * has passed rather than counting backwards.
 */
export function weeksUntilExams(yearLevel, now = new Date()) {
    const senior = /Year 12/.test(yearLevel || "");
    const eleven = /Year 11/.test(yearLevel || "");
    // Month is 0-indexed: 9 = October, 10 = November, 11 = December.
    const [month, day] = senior ? [9, 25] : eleven ? [10, 5] : [11, 12];

    let target = new Date(now.getFullYear(), month, day);
    if (target <= now) target = new Date(now.getFullYear() + 1, month, day);

    const weeks = Math.round((target - now) / (7 * 86400000));
    const label = senior
        ? "until VCE written exams start"
        : eleven
            ? "until end-of-year exams"
            : "until the end of the school year";
    return { weeks, label };
}

/* ── The forgetting act's model ───────────────────────────────────────────
 *
 * IMPORTED, NEVER RESTATED. `RETENTION_K` is the constant the product's own
 * scheduler derives from SM-2's 90% target, and this act plots the curve it
 * defines. Both it and the marketing chart it replaced used to carry
 * `const K = Math.log(10 / 9)` written out locally — the identical
 * mirror class `mirrors.test.mjs` exists for, and the most dangerous version
 * of it, because a marketing chart that has drifted from the product's model
 * is a promise the app then fails to keep. `reel.test.mjs` scans for a second
 * copy.
 *
 * ALONE_S stands in for a single unreinforced exposure and is the only number
 * here that is a judgement rather than a consequence of the model. It is a
 * GENEROUS one: at S = 4.5 you still have about a fifth of it after a week,
 * which is a kinder curve than the literature would draw. Overstating the
 * decay to make the pitch land would be the exact thing this file refuses.
 */
export const ALONE_S = 4.5;
export const CURVE_DAYS = 30;

/** A realistic SM-2 ladder: tomorrow, three days, eight, then a fortnight. */
export const REVIEWS = [1, 3, 8, 14];

export { RETENTION_K, stabilityFor, recallAfter };

/** What is left of one unreinforced pass, `days` later. 0 → 1. */
export const aloneAt = (days) => recallAfter(days, ALONE_S);

/**
 * What is left of the same material on the review ladder, `days` later.
 *
 * Walked interval by interval rather than solved, because that IS the model:
 * recall decays across each interval and every review puts it back to full.
 * Past the last review it keeps decaying on a longer interval rather than
 * holding flat — a line that stops falling would be claiming the material is
 * permanent, which nothing here is willing to claim.
 */
export function spacedAt(days) {
    let at = 0;
    for (const iv of REVIEWS) {
        if (days <= at + iv) return recallAfter(days - at, stabilityFor(iv));
        at += iv;
    }
    return recallAfter(days - at, stabilityFor(REVIEWS[REVIEWS.length - 1] * 2.4));
}

/**
 * The gap, as whole percentage points, which is the only figure the act
 * actually prints. Rounded ONCE here rather than at the two call sites, or the
 * headline and the caption disagree by a point at some drag positions and the
 * screen is arguing with itself — the failure this whole codebase is a
 * catalogue of.
 */
export function forgettingReadout(days) {
    const d = Math.max(0, Math.min(CURVE_DAYS, Number(days) || 0));
    const alone = Math.round(aloneAt(d) * 100);
    const spaced = Math.round(spacedAt(d) * 100);
    return { days: d, alone, spaced, gap: spaced - alone };
}

/* ── The hand ─────────────────────────────────────────────────────────────
 *
 * The persistent object that makes this one film rather than ten screens. A
 * card is added when an act pays out and is NEVER removed by scrolling back —
 * you cannot unlearn the thing you just learned, and a hand that shrank as you
 * scrolled up would read as progress being taken away.
 */
export const HAND_CAP = 8;

/**
 * Add a card, idempotently, keyed on `id`.
 *
 * IDEMPOTENT IS LOAD-BEARING rather than tidy. Acts pay out from an
 * IntersectionObserver, which fires again every time a student scrolls back up
 * through an act they have already played — and on a snap deck, scrolling back
 * is a normal thing to do. Appending blindly would deal the same card four
 * times for a reader who went back to re-read the marking.
 *
 * A later deal of the same id REPLACES the card in place rather than being
 * dropped, because the wizard's cards genuinely change: a student who picks
 * five subjects, goes back and picks six must see six. Replacing in place
 * keeps the hand's ORDER stable, so the card does not jump to the end of the
 * row when it is edited.
 */
export function dealt(hand = [], card) {
    if (!card || !card.id) return hand;
    const at = hand.findIndex((c) => c.id === card.id);
    if (at >= 0) {
        const next = hand.slice();
        next[at] = card;
        return next;
    }
    return hand.concat(card).slice(-HAND_CAP);
}

/* ── What each act deals ──────────────────────────────────────────────────
 *
 * EVERY BRANCH RETURNS NULL RATHER THAN A PLACEHOLDER. The forgetting act has
 * no card until the student has actually dragged something; the subjects act
 * has none until a subject is picked. A hand holding "your subjects: —" is the
 * card-shaped equivalent of "+0.00 ATAR" on the dashboard rail: it teaches a
 * student that the objects on this screen are decoration, after which the real
 * ones do not land either.
 *
 * `rank` and `suit` are the app's own card language (`cardIdentity`) and they
 * mean here exactly what they mean on the other eighteen surfaces: rank is how
 * strong the thing is, suit is the family it belongs to. These are FACTS
 * rather than achievements, so they are dealt mid-rank and never as aces — an
 * ace is always earned, never given, and handing somebody an ace for scrolling
 * would devalue every ace the product goes on to award.
 */
export function cardFor(actId, state = {}) {
    switch (actId) {
        case "deal": {
            // The number is the payout; the year is what earned it. Both have
            // to be real — a card reading "0 weeks" would be the first thing a
            // student ever saw this app assert, and it would be false.
            const w = state.weeks;
            if (!Number.isFinite(w) || w <= 0 || !state.yearLevel) return null;
            return {
                id: "deal", rank: "9", suit: "spade", tone: "#0D1626",
                label: `${w} weeks`, note: state.weeksLabel || "until exams",
                yearLevel: state.yearLevel,
            };
        }
        case "forget": {
            const r = state.readout;
            // Null until they have actually moved the handle: the act opens at
            // day zero, where the honest reading is "you have not lost
            // anything yet" and there is no fact to deal.
            if (!r || r.days <= 0) return null;
            return {
                id: "forget", rank: "7", suit: "heart", tone: "#FF4B4B",
                label: `${r.alone}% left`, note: `after ${r.days} day${r.days === 1 ? "" : "s"}, unreviewed`,
            };
        }
        case "marking": {
            const c = state.criterion;
            if (!c) return null;
            return {
                id: "marking", rank: "J", suit: "diamond", tone: "#58CC02",
                label: c.cost != null ? `−${c.cost} mark${c.cost === 1 ? "" : "s"}` : "Marked",
                note: c.label || "what it cost",
            };
        }
        case "science": {
            const t = state.technique;
            if (!t) return null;
            return {
                id: "science", rank: "10", suit: "club", tone: "#1CB0F6",
                label: t.label, note: t.region || "what it moves",
            };
        }
        case "cost": {
            const g = state.yearGap;
            if (!Number.isFinite(g) || g <= 0) return null;
            return {
                id: "cost", rank: "Q", suit: "diamond", tone: "#FFC800",
                label: `$${g.toLocaleString()}`, note: "the gap, over a year",
            };
        }
        case "subjects": {
            const n = Array.isArray(state.subjects) ? state.subjects.length : 0;
            if (!n) return null;
            return {
                id: "subjects", rank: "Q", suit: "club", tone: "#1CB0F6",
                label: `${n} subject${n === 1 ? "" : "s"}`,
                note: state.subjects.slice(0, 2).join(", ") + (n > 2 ? `, +${n - 2}` : ""),
            };
        }
        case "target": {
            const a = state.targetAtar;
            if (!Number.isFinite(a) || a <= 0) return null;
            return {
                id: "target", rank: "A", suit: "heart", tone: "#FF4B4B",
                label: String(a), note: state.course ? `for ${state.course}` : "your target",
            };
        }
        default:
            return null;
    }
}

/* ── What it costs, against what it replaces ──────────────────────────────
 *
 * The anchor is a private tutor, which is the thing a VCE family actually
 * weighs this against — not another app.
 *
 * EVERY NUMBER HERE IS CONSERVATIVE, on purpose, because the honest comparison
 * already wins by a mile and an exaggerated one is checkable in about four
 * seconds by anyone with a parent. Tutoring is costed over the SCHOOL year
 * (40 weeks, since nobody books a tutor through summer) and AcedIt over the
 * FULL year (52 weeks, since the subscription does not pause). That asymmetry
 * is deliberately the one that flatters us LEAST.
 */
export const TUTOR_HOURLY = 90;
export const ACEDIT_WEEKLY = 5;
export const TUTOR_WEEKS = 40;
export const ACEDIT_WEEKS = 52;
export const TUTOR_HOURS_MAX = 4;

/**
 * The trial, stated ONCE. It is printed on the reel's turn, in the wizard's
 * sign-in step and across the pricing tail — three surfaces for one number,
 * which is exactly the shape this codebase has had to fix a dozen times.
 */
export const TRIAL_DAYS = 7;

export function tutorGap(hoursPerWeek) {
    const h = Math.max(0, Math.min(TUTOR_HOURS_MAX, Number(hoursPerWeek) || 0));
    const tutor = Math.round(h * TUTOR_HOURLY * TUTOR_WEEKS);
    const acedit = ACEDIT_WEEKLY * ACEDIT_WEEKS;
    // Never negative: at zero hours there is no comparison being made, and a
    // card reading "-$260 the gap, over a year" is the screen arguing against
    // itself. The act deals nothing at zero, which is the honest reading.
    return { hours: h, tutor, acedit, gap: Math.max(0, tutor - acedit) };
}

/* ── Device tier ──────────────────────────────────────────────────────────
 *
 * The reel is built DESKTOP-FIRST and goes as far as the machine will carry
 * it. What it must never do is ship a white screen, and this codebase has the
 * receipts: the old hero animated two 700px elements under a 160px gaussian on
 * an infinite loop and MEASURED 11fps, which was the whole of "the cards jolt
 * across the screen". The card storm on top was innocent — it inherited a
 * frame budget the page had already spent.
 *
 * So the tier is a BUDGET, not a feature flag, and the reduction at each level
 * is designed rather than absent. "full" gets the whole storm; "lite" gets
 * fewer particles and no parallax, which still reads as the same film; "still"
 * gets the composition with nothing moving, which is what reduced-motion has
 * always asked for and is a legitimate way to see this page.
 *
 * DERIVED FROM THE MACHINE, NEVER FROM THE VIEWPORT WIDTH. A narrow window on
 * a desktop is not a weak device, and a 2022 flagship phone outruns plenty of
 * laptops — sizing the spectacle by `window.innerWidth` is the trap that makes
 * a resized browser suddenly drop its animations. `deviceMemory` and
 * `hardwareConcurrency` are absent on Safari, so an unknown machine is treated
 * as CAPABLE: getting it wrong generously costs a weak phone some frames,
 * getting it wrong the other way strips the film from every iPhone.
 */
export const TIERS = ["still", "lite", "full"];

export function deviceTier({ reducedMotion = false, memory, cores, saveData = false } = {}) {
    if (reducedMotion) return "still";
    if (saveData) return "lite";
    const mem = Number(memory);
    const cpu = Number(cores);
    if (Number.isFinite(mem) && mem > 0 && mem <= 2) return "lite";
    if (Number.isFinite(cpu) && cpu > 0 && cpu <= 4) return "lite";
    return "full";
}

/** How many particles the storm may use at a tier. */
export const PARTICLES = { still: 0, lite: 120, full: 460 };
