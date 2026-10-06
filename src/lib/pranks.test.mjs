/**
 * prank assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/pranks.test.mjs
 *
 * This is the only feature in the app where one student does something TO
 * another, on a product whose users are mostly fifteen to eighteen and which is
 * being sold to schools. Migration 0034 ruled out free text on Compete in its
 * own words; this ships only because every bound below holds, so every bound
 * below is asserted rather than described.
 *
 * The two that matter most are the RECEIVE cap — a send cap bounds each sender
 * and does nothing about a class arriving at once — and the fact that the two
 * recipient-side refusals are INDISTINGUISHABLE, because a refusal that named
 * which one would turn this into a way of finding out who has opted out.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    KINDS, PRANK_LIST, prankKind, optedOut,
    WEEKLY_SEND_MAX, WEEKLY_RECEIVE_MAX, maySend, mayReceive, canSend,
} from "@/lib/pranks";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const friend = { extra: {} };

check("A RECEIVE CAP IS THE ONE THAT STOPS A PILE-ON", () => {
    // Five each from thirty students is a hundred and fifty, which is not a
    // joke. Past the ceiling every further prank is refused whoever sends it.
    assert.equal(canSend({ kind: "shake", target: friend, isFriend: true, receivedThisWeek: WEEKLY_RECEIVE_MAX }).ok, false);
    assert.equal(canSend({ kind: "shake", target: friend, isFriend: true, receivedThisWeek: WEEKLY_RECEIVE_MAX - 1 }).ok, true);
    // And it is TIGHTER than the send cap: better to hold a prank you cannot
    // deliver than to receive one you did not want.
    assert.ok(WEEKLY_RECEIVE_MAX < WEEKLY_SEND_MAX,
        "the receive ceiling must be the tighter of the two");
});

check("THE TWO RECIPIENT REFUSALS CANNOT BE TOLD APART", () => {
    // Otherwise the shelf becomes a way of discovering who has opted out, and
    // that person is exactly who a determined sender would then work around.
    const off = canSend({ kind: "shake", target: { extra: { pranks_opt_out: true } }, isFriend: true });
    const full = canSend({ kind: "shake", target: friend, isFriend: true, receivedThisWeek: WEEKLY_RECEIVE_MAX });
    assert.equal(off.ok, false);
    assert.equal(full.ok, false);
    assert.equal(off.reason, full.reason, "a sender can tell an opt-out from a full week");
    assert.doesNotMatch(off.reason, /opt|off|turned|block/i, "the refusal names the opt-out");
});

check("YOUR OWN LIMIT NAMES ITSELF, because you can act on it", () => {
    const v = canSend({ kind: "shake", target: friend, isFriend: true, sentThisWeek: WEEKLY_SEND_MAX });
    assert.equal(v.ok, false);
    assert.match(v.reason, new RegExp(String(WEEKLY_SEND_MAX)));
    // And it is checked BEFORE theirs: a sender told "they can't receive one"
    // when they had also run out themselves would fix the wrong thing.
    const both = canSend({
        kind: "shake", target: friend, isFriend: true,
        sentThisWeek: WEEKLY_SEND_MAX, receivedThisWeek: WEEKLY_RECEIVE_MAX,
    });
    assert.match(both.reason, /you have sent/i);
});

check("FRIENDS ONLY, and a stranger is refused before anything else", () => {
    assert.equal(canSend({ kind: "shake", target: friend, isFriend: false }).ok, false);
    assert.match(canSend({ kind: "shake", target: friend, isFriend: false }).reason, /friend/i);
});

check("THE VOCABULARY IS FIXED — there is no free text anywhere", () => {
    // The most hostile thing that can arrive is a screen that wobbles.
    for (const k of PRANK_LIST) {
        assert.equal(typeof k.label, "string");
        assert.ok(k.ms > 0 && k.ms <= 5000, `${k.id} lasts ${k.ms}ms`);
        assert.ok(k.price > 0, `${k.id} is free`);
    }
    assert.equal(prankKind("nope"), null, "an unknown kind resolved to something");
    assert.equal(prankKind(""), null);
    assert.equal(prankKind(undefined), null);
    assert.equal(canSend({ kind: "<script>", target: friend, isFriend: true }).ok, false);
});

check("A PRANK CANNOT REACH ANYTHING A STUDENT IS MEASURED ON", () => {
    // Asserted as an ABSENCE over the module, the same shape the refund rule
    // takes: the day somebody adds an effect that touches a mark is the day
    // this stops being a prank and becomes a penalty that was bought.
    const src = readFileSync("src/lib/pranks.js", "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
    // WORD-BOUNDED, because `/xp/i` matches `export` — the false-positive class
    // `fnResult.test.mjs` and `hookDeps.test.mjs` each had to learn, arriving
    // here for the third time.
    for (const forbidden of [/\bxp\b/i, /\bstreak/i, /\batar\b/i, /\bmarks?\b/i,
        /\bscore/i, /\bflashcard/i, /cred_balance/]) {
        assert.doesNotMatch(src, forbidden, `pranks.js reaches for ${forbidden}`);
    }
});

check("optedOut is explicit — an unset field is not an opt-out", () => {
    assert.equal(optedOut({ extra: { pranks_opt_out: true } }), true);
    assert.equal(optedOut({ extra: {} }), false);
    assert.equal(optedOut({}), false);
    assert.equal(optedOut(null), false);
    // Only the boolean counts, so a stray truthy value cannot silently opt
    // somebody out of a thing they never answered.
    assert.equal(optedOut({ extra: { pranks_opt_out: "no" } }), false);
});

check("a missing target is refused rather than broadcast", () => {
    assert.equal(mayReceive({ target: null }).ok, false);
    assert.equal(mayReceive({}).ok, false);
    assert.equal(maySend({ kind: "shake", isFriend: true }).ok, true);
});

/* ══ HOW IT ARRIVES, AND WHAT IT SAYS WHEN IT DOES ═══════════════════════════
   Everything below was found by looking at the screen rather than at the code,
   which is why each one is an assertion now. */

const strip = (f) => readFileSync(f, "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

check("IT ARRIVES WITHOUT A REFRESH — three triggers, and the slowest is the floor", () => {
    // It used to be ONE fetch keyed on the account, and Layout does not unmount
    // between navigations, so a prank sent while somebody had the app open sat
    // in the table until they reloaded the tab.
    const w = strip("src/components/pranks/PrankWatcher.jsx");
    assert.match(w, /useLiveTick\(\)/,
        "no poll underneath: a table outside the realtime publication is SILENT, " +
        "so without the tick this delivers nothing at all until migration 0040 runs");
    assert.match(w, /subscribePranks\(/, "no push, so it is only ever as fast as the tick");
    assert.match(w, /\[email, tick, pull\]/, "the fetch is not keyed on the tick, so it never re-runs");

    // And Layout must actually mount it, or all of the above is a file nobody
    // reaches — the half-wired shape this app keeps meeting.
    const layout = strip("src/Layout.jsx");
    assert.match(layout, /<PrankWatcher\s/, "Layout never renders the watcher");
    assert.ok(!/invoke\("getPranks"/.test(layout),
        "Layout still fetches pranks itself — two readers of a queue that marks rows seen");
});

check("THE PUSH IS A DOORBELL, NOT A DELIVERY", () => {
    // `getPranks` resolves the sender's NAME, drops a row it cannot attribute,
    // and stamps `seen_at`. A client that drew the broadcast row would have an
    // anonymous prank — the one thing migration 0038 says this may never be —
    // and nothing would mark it seen, so it would replay on every load.
    const rt = strip("src/api/realtime.js");
    const fn = rt.slice(rt.indexOf("export async function subscribePranks"));
    assert.ok(fn.length > 100, "subscribePranks is missing");
    assert.match(fn, /event: "INSERT"/, "it listens for its own seen_at write as well");
    assert.match(fn, /filter: `target_email=eq\./,
        "unfiltered, so every open tab in the school wakes for everybody's pranks");
    assert.ok(!/payload/.test(fn), "the broadcast row is being read — it is a trigger, never a source");
});

check("THE OVERLAY IS NOT INSIDE THE ELEMENT IT TRANSFORMS", () => {
    // This is the bug the whole release started from. The overlay rendered
    // INSIDE the wrapper carrying `prank-upside`, so during a flip the plate
    // naming the sender turned over with the page and could not be read — and
    // a transformed (or filtered) ancestor is the containing block for
    // `position: fixed`, so `fixed inset-0` was not the viewport either.
    const layout = strip("src/Layout.jsx");
    const at = layout.indexOf("prankBodyClass(");
    const overlay = layout.indexOf("<PrankOverlay");
    assert.ok(at > 0 && overlay > 0, "Layout no longer wires the prank surface");

    // A DEPTH WALK, because the first draft just looked for a `</div>` between
    // the two — and the entire page tree sits between them, so it passed
    // whether the overlay was inside or out. The `dbColumns` idiom: find the
    // wrapper's opening tag, count div depth forward until it closes, and that
    // span is the element the prank class transforms.
    const start = layout.lastIndexOf("<div", at);
    assert.ok(!/<div[^>]*\/>/.test(layout), "a self-closing div would break the depth walk");
    let depth = 0, i = start, end = -1;
    while (i < layout.length) {
        const nextOpen = layout.indexOf("<div", i);
        const nextClose = layout.indexOf("</div>", i);
        if (nextClose < 0) break;
        if (nextOpen >= 0 && nextOpen < nextClose) { depth += 1; i = nextOpen + 4; continue; }
        depth -= 1; i = nextClose + 6;
        if (depth === 0) { end = i; break; }
    }
    assert.ok(end > start, "could not find the end of the prank wrapper");
    assert.ok(overlay > end,
        "the overlay is still INSIDE the element that carries the prank class — so the " +
        "plate turns over during a flip and `position: fixed` is not the viewport");
});

check("EVERY KIND NAMES THE SENDER — the plate is unconditional", () => {
    const o = strip("src/components/pranks/PrankOverlay.jsx");
    // Drawn OUTSIDE every `spec.id === ...` branch, so a kind added later
    // cannot ship without attribution by forgetting to opt in.
    assert.match(o, /<NamePlate spec=\{spec\} from=\{prank\.from\}/);
    // THE LINE ITSELF CARRIES NO CONDITION. Comparing indices was the first
    // draft and it passed when the plate was wrapped in a branch on its own
    // line, because `spec.id === "` then sits at a LOWER index than
    // `<NamePlate` on that same line.
    const line = o.split("\n").find((l) => l.includes("<NamePlate"));
    assert.ok(line, "the plate is not drawn at all");
    assert.ok(!/spec\.id|&&|\?/.test(line),
        `the plate is behind a condition: ${line.trim()}`);
    assert.match(o, /\{from\} got you/, "the plate does not print the sender's name");
});

check("NO CSS EASING STRING REACHES FRAMER", () => {
    // `ease: "steps(1, end)"` throws `Invalid easing type` at RUNTIME, which
    // aborts the whole animation batch for that render — so the name plate
    // stayed at its initial `opacity: 0` for the entire glitch. Lint passes,
    // the build passes, and the only trace is one line in the console.
    const ALLOWED = new Set(["linear", "easeIn", "easeOut", "easeInOut",
        "circIn", "circOut", "circInOut", "backIn", "backOut", "backInOut",
        "anticipate"]);
    const bad = [];
    for (const f of ["src/components/pranks/PrankOverlay.jsx"]) {
        for (const m of strip(f).matchAll(/ease:\s*"([^"]+)"/g)) {
            if (!ALLOWED.has(m[1])) bad.push(`${f}: ease: "${m[1]}"`);
        }
    }
    assert.deepEqual(bad, [], "a CSS easing string throws at runtime and kills the whole animation");
});

check("A PAGE-LEVEL KIND HAS A CLASS THAT EXISTS", () => {
    // `prankBodyClass` returning a name with no keyframes behind it renders
    // perfectly and simply does nothing — the silent half of a prank.
    const o = strip("src/components/pranks/PrankOverlay.jsx");
    const css = readFileSync("src/index.css", "utf8");
    const classes = [...o.matchAll(/return "(prank-[\w-]+)"/g)].map((m) => m[1]);
    assert.ok(classes.length >= 4, `only ${classes.length} page-level kinds wired`);
    for (const c of classes) {
        assert.ok(css.includes(`.${c} {`) || css.includes(`.${c}{`), `${c} has no rule in index.css`);
        const rule = css.slice(css.indexOf(`.${c} {`));
        const kf = (rule.match(/animation:\s*([\w-]+)/) || [])[1];
        assert.ok(kf && css.includes(`@keyframes ${kf}`), `${c} names keyframes that do not exist`);
    }
    // And every one of them is suppressed under reduced motion. READ THE BLOCK,
    // not the rest of the file: slicing from the first `prefers-reduced-motion`
    // to the end swept up the prank rules THEMSELVES, so every class was
    // "found" whether or not anything suppressed it.
    const blocks = [];
    for (const m of css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{/g)) {
        let d = 1, j = m.index + m[0].length;
        while (j < css.length && d > 0) {
            if (css[j] === "{") d += 1;
            if (css[j] === "}") d -= 1;
            j += 1;
        }
        blocks.push(css.slice(m.index, j));
    }
    assert.ok(blocks.length, "no reduced-motion block at all");
    for (const c of classes) {
        assert.ok(blocks.some((b) => b.includes(`.${c}`)),
            `${c} still animates under prefers-reduced-motion`);
    }
});

check("THE BLACKOUT IS A LITERAL BLACK", () => {
    // `bg-foreground` is near-WHITE in dark mode, so a themed "lights out"
    // would turn the lights ON for half the students — the failure focus mode
    // records about its own ground and `UpdatePrompt`'s scrim after it. A scrim
    // is shadow, never ink.
    const o = strip("src/components/pranks/PrankOverlay.jsx");
    const fn = o.slice(o.indexOf("function LightsOut"), o.indexOf("function NamePlate"));
    assert.match(fn, /bg-black/);
    assert.ok(!/bg-foreground|text-background/.test(fn),
        "the blackout uses a token that inverts with the theme");
});

check("THE NEW KINDS ARE COMPLETE, and the shelf prices them", () => {
    for (const id of ["glitch", "lights"]) {
        const k = prankKind(id);
        assert.ok(k, `${id} is not a kind`);
        assert.ok(k.label && k.blurb, `${id} has no label or blurb`);
        assert.ok(k.ms >= 800 && k.ms <= 5000, `${id} lasts ${k.ms}ms`);
        // Rounded to 50, the rule the cred store keeps: nobody weighs 713
        // against 951, and a shelf of arithmetic showing its working is not a
        // shelf. The server charges `spec.price` off this same object.
        assert.equal(k.price % 50, 0, `${id} is priced at ${k.price}`);
    }
    // Every kind the module knows, the renderer can draw: a kind on the shelf
    // with no branch is something a student buys and never sees.
    const o = strip("src/components/pranks/PrankOverlay.jsx");
    for (const k of PRANK_LIST) {
        const drawn = o.includes(`spec.id === "${k.id}"`) || o.includes(`"${k.id}"`);
        assert.ok(drawn, `${k.id} is on the shelf and nothing draws it`);
    }
});

check("MIGRATION 0040 IS GUARDED and does not assume 0038 has run", () => {
    const sql = readFileSync("supabase/migrations/0040_pranks_realtime.sql", "utf8");
    assert.match(sql, /to_regclass\('public\.pranks'\) is null/,
        "it assumes the table exists, so it fails on a database where 0038 has not run");
    assert.match(sql, /pg_publication_tables/,
        "unguarded: `alter publication ... add table` on a table already in it is an error");
});

check("the scanners recognise the shapes they are looking for", () => {
    assert.ok(/ease:\s*"([^"]+)"/.test('transition={{ ease: "steps(1, end)" }}'));
    assert.ok(!/ease:\s*"([^"]+)"/.test("transition={{ ease: [0.5, 0, 0.6, 1] }}"));
    // …and a comment naming a defect is not the defect, which is the false
    // positive `floorInk` and `fnResult` each had to learn.
    const stripText = (t) => t
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!/ease:\s*"/.test(stripText('// never write ease: "steps(1, end)"')));
    assert.ok(/ease:\s*"/.test(stripText('transition={{ ease: "steps(1, end)" }}')));
});

console.log(`\npranks: ${passed} checks passed\n`);
