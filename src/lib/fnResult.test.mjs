/**
 * fnResult assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/fnResult.test.mjs
 *
 * Two halves: the unwrapping itself, and a SCAN that catches the envelope bug
 * at its source. The scan is the important one — the bug is invisible at
 * runtime, because reading the envelope as the payload produces an empty state
 * and no error at all.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { unwrapFn, fnError, takeFn } from "@/lib/fnResult";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

// ─── unwrapping ─────────────────────────────────────────────────────────────

check("the ported-function envelope is unwrapped", () => {
    assert.deepEqual(unwrapFn({ data: { rows: [1] }, error: null }), { rows: [1] });
});

check("a bare Base44 payload is passed through", () => {
    // A function that has NOT been ported falls through to the real SDK, whose
    // shape differs, and during the dual run both are live.
    assert.deepEqual(unwrapFn({ rows: [1] }), { rows: [1] });
});

check("A NULL data FIELD IS NOT A MISSING ENVELOPE", () => {
    // The check is on the KEY, not the value: a ported function that returns
    // nothing answers { data: null }, and treating that as "not an envelope"
    // would hand the caller { data: null, error: null } to read fields off.
    assert.equal(unwrapFn({ data: null, error: null }), null);
    assert.equal(unwrapFn(null), null);
    assert.equal(unwrapFn(undefined), null);
});

check("an error is found at either level", () => {
    // A ported function answers 200 with { error } in its BODY for a refusal
    // it wants the UI to print — "Not enough cred", "You're in this call-out".
    assert.equal(fnError({ error: "outer" }), "outer");
    assert.equal(fnError({ data: { error: "inner" }, error: null }), "inner");
    assert.equal(fnError({ data: { rows: [] }, error: null }), null);
    assert.equal(fnError(null), null);
});

check("takeFn throws the refusal and returns the payload", () => {
    assert.deepEqual(takeFn({ data: { ok: 1 }, error: null }), { ok: 1 });
    assert.throws(() => takeFn({ data: { error: "Not enough cred." } }), /Not enough cred/);
});

// ─── the scan ───────────────────────────────────────────────────────────────

function jsxFiles(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) jsxFiles(p, out);
        else if (/\.(jsx?|mjs)$/.test(name) && !name.endsWith(".test.mjs")) out.push(p);
    }
    return out;
}

check("NOBODY READS THE ENVELOPE AS THE PAYLOAD", () => {
    // The bug, stated as a pattern: capture the result of an invoke into a
    // variable, then read a field off THAT variable rather than off its `data`.
    //
    //     const res = await base44.functions.invoke("getMarkets", {});
    //     setData(res);              // ← { data, error }, so every field is undefined
    //
    // It renders an empty state with no error anywhere, which is why it shipped
    // twice: once on the league board and once on its only entrance, where
    // `res.success` — a field inside `data` — was never true, so the link to
    // the whole page never rendered.
    // ── Two false-positive classes had to go first, both found on the first
    // run against the real codebase — the same lesson hookDeps.test.mjs
    // learned, and the reason a checker that cries wolf gets deleted:
    //
    //   1. `response?.data?.checkoutUrl || response?.checkoutUrl` is the
    //      CORRECT both-shapes idiom, and the Stripe pages all use it. A
    //      variable that is read through `.data` anywhere is handling the
    //      envelope, so its bare reads are the fallback and not the bug.
    //   2. fnResult.js itself documents the broken pattern in its own header,
    //      which a text scan cannot tell from real code.
    const offenders = [];
    for (const file of jsxFiles("src")) {
        if (file.endsWith("fnResult.js")) continue;
        const src = readFileSync(file, "utf8");
        const re = /(?:const|let)\s+(\w+)\s*=\s*await\s+[\w.]*\.functions\.invoke\(/g;
        let m;
        while ((m = re.exec(src)) !== null) {
            const name = m[1];
            const after = src.slice(m.index);
            if (new RegExp(`\\b${name}\\??\\.data\\b`).test(after)) continue;
            // Reading any field off the captured result other than data/error
            // is the bug. `res?.error` and `res.data` are both correct.
            const bad = new RegExp(`\\b${name}\\??\\.(?!data\\b|error\\b)\\w+`).exec(after);
            if (bad) offenders.push(`${file}: ${bad[0]}`);
            // Passing the raw result somewhere that will read fields off it.
            const raw = new RegExp(`set\\w+\\(\\s*${name}\\s*\\)`).exec(after);
            if (raw) offenders.push(`${file}: ${raw[0]}`);
        }
    }
    assert.deepEqual(offenders, [],
        `\n      read the { data, error } envelope as the payload:\n      ${offenders.join("\n      ")}\n`);
});

check("and that scan would have caught the league bug", () => {
    // A check nobody has seen fail is one that has quietly stopped working.
    // This is the real WeekStrip code, with the field it actually read.
    const broken = `
      const res = await base44.functions.invoke("getLeagueStanding", {});
      if (!res?.success) return null;`;
    const re = /(?:const|let)\s+(\w+)\s*=\s*await\s+[\w.]*\.functions\.invoke\(/g;
    const m = re.exec(broken);
    assert.ok(m, "the scanner must recognise the shape it is looking for");
    const bad = new RegExp(`\\b${m[1]}\\??\\.(?!data\\b|error\\b)\\w+`).exec(broken.slice(m.index));
    assert.ok(bad, "res?.success should be flagged");
    assert.match(bad[0], /success/);
});

check("and it leaves the CORRECT shapes alone", () => {
    const fine = `
      const res = await base44.functions.invoke("x", {});
      if (res?.error) throw new Error(res.error);
      const body = res.data ?? res;`;
    const re = /(?:const|let)\s+(\w+)\s*=\s*await\s+[\w.]*\.functions\.invoke\(/g;
    const m = re.exec(fine);
    const bad = new RegExp(`\\b${m[1]}\\??\\.(?!data\\b|error\\b)\\w+`).exec(fine.slice(m.index));
    assert.equal(bad, null, "reading .data and .error is exactly right and must not be flagged");
});

console.log(`\n${passed} passed`);
