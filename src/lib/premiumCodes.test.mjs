/**
 * premium codes — the Year 10 program —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/premiumCodes.test.mjs
 *
 * The one endpoint that hands out Premium for free. Three things it must never
 * get wrong, and none of them would be reported by a student:
 *
 *   A BLOCK THAT DOES NOT STICK. Revoking somebody who is not in the program
 *   has to stop them on EVERY code, or they type the next one they hear about.
 *
 *   A PREMIUM CHECK THAT DOES NOT KNOW ABOUT CODES. Eight places decided
 *   "is this person Premium" and five of them read `subscription_tier` alone,
 *   so a code would have unlocked the server and left the nav, the planner and
 *   the companion insisting the student was free.
 *
 *   A SECOND WRITER. The column is derived by a trigger from the redemptions
 *   table, so the table editor is the one place to manage it. Anything in the
 *   app writing it as well is how the two start disagreeing.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    normaliseCode, cleanName, nameProblem, codePremiumActive, codePremiumUntil,
    redeemVerdict, CODE_DAYS_DEFAULT,
} from "./premiumCodes.js";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (e) { console.log(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const NOW = new Date("2026-10-15T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (days) => new Date(NOW.getTime() + days * DAY).toISOString();
const CODE = { code: "YEAR10ACE", label: "Year 10", days: 21, max_redemptions: 200, active: true, expires_at: null };

check("a code is matched however it is typed", () => {
    assert.equal(normaliseCode("  year10 ace "), "YEAR10ACE");
    assert.equal(normaliseCode("yr-10"), "YR-10");
    assert.equal(normaliseCode(null), "");
    assert.equal(normaliseCode(undefined), "");
});

check("a name needs letters and some length", () => {
    assert.ok(nameProblem(""));
    assert.ok(nameProblem(" a "));
    assert.ok(nameProblem("!!!"));
    assert.equal(nameProblem("Sam Nguyen"), null);
    assert.equal(nameProblem("Zoë O'Brien"), null);
    assert.equal(cleanName("  Sam    Nguyen "), "Sam Nguyen");
});

check("code Premium is on only while its date is ahead", () => {
    assert.equal(codePremiumActive({ code_premium_until: at(3) }, NOW), true);
    assert.equal(codePremiumActive({ code_premium_until: at(-1) }, NOW), false);
    assert.equal(codePremiumActive({ code_premium_until: null }, NOW), false);
    assert.equal(codePremiumActive({ code_premium_until: "not a date" }, NOW), false);
    assert.equal(codePremiumActive(null, NOW), false);
    assert.equal(codePremiumUntil({ code_premium_until: at(-1) }, NOW), null);
});

check("a valid code gives its days, measured from now", () => {
    const v = redeemVerdict({ codeRow: CODE, mine: [], used: 3, now: NOW });
    assert.equal(v.ok, true);
    assert.equal(v.days, 21);
    assert.equal(v.premiumUntil.toISOString(), at(21));
});

check("a code with no days set falls back to the default", () => {
    const v = redeemVerdict({ codeRow: { ...CODE, days: null }, now: NOW });
    assert.equal(v.days, CODE_DAYS_DEFAULT);
});

check("unknown, switched-off and expired codes are refused", () => {
    assert.equal(redeemVerdict({ codeRow: null, now: NOW }).ok, false);
    assert.equal(redeemVerdict({ codeRow: { ...CODE, active: false }, now: NOW }).ok, false);
    assert.equal(redeemVerdict({ codeRow: { ...CODE, expires_at: at(-1) }, now: NOW }).ok, false);
    assert.equal(redeemVerdict({ codeRow: { ...CODE, expires_at: at(5) }, now: NOW }).ok, true);
});

check("a BLOCKED account is refused on every code, not just the one it used", () => {
    const mine = [{ code: "OTHERCODE", premium_until: at(10), revoked_at: at(-1) }];
    const v = redeemVerdict({ codeRow: CODE, mine, now: NOW });
    assert.equal(v.ok, false);
    assert.match(v.reason, /can't be used on this account/);
});

check("the same code twice is refused, and says when Premium ends", () => {
    const mine = [{ code: "YEAR10ACE", premium_until: at(10), revoked_at: null }];
    const v = redeemVerdict({ codeRow: CODE, mine, now: NOW });
    assert.equal(v.ok, false);
    assert.match(v.reason, /already used/);
});

check("a full code is refused; no limit means no limit", () => {
    assert.equal(redeemVerdict({ codeRow: CODE, used: 200, now: NOW }).ok, false);
    assert.equal(redeemVerdict({ codeRow: CODE, used: 199, now: NOW }).ok, true);
    assert.equal(redeemVerdict({ codeRow: { ...CODE, max_redemptions: null }, used: 9999, now: NOW }).ok, true);
});

const ROOT = process.cwd();
const server = fs.readFileSync(path.join(ROOT, "server.mjs"), "utf8");

// tierAccess reads import.meta.env, which node does not have, so it is read
// as text rather than imported.
check("the client's isPremium counts a code", () => {
    const src = strip(fs.readFileSync(path.join(ROOT, "src/lib/tierAccess.js"), "utf8"));
    const body = src.slice(src.indexOf("export function isPremium"), src.indexOf("const FREE_COUNTER_KEY"));
    assert.match(body, /codePremiumActive\(profile\)/);
});

check("the server's premium check counts a code", () => {
    const body = server.slice(server.indexOf("function tierIsPremium"), server.indexOf("async function loadUserProfile"));
    assert.match(body, /codePremiumActive\(profile\)/);
});

check("nothing in server.mjs writes code_premium_until — the trigger owns it", () => {
    assert.doesNotMatch(strip(server), /code_premium_until\s*:/);
});

check("the migration guards the column from a student's own client", () => {
    const sql = fs.readFileSync(path.join(ROOT, "supabase/migrations/0041_premium_codes.sql"), "utf8");
    assert.match(sql, /create trigger user_profiles_guard_code_premium/);
    assert.match(sql, /create trigger premium_code_redemptions_sync/);
    assert.match(sql, /alter table public\.premium_code_redemptions enable row level security/);
    assert.match(sql, /alter table public\.premium_codes enable row level security/);
});

check("no screen decides Premium off subscription_tier alone", () => {
    // Layout's is the expiry downgrade (a WRITE about a paid subscription) and
    // tierAccess is the one check itself.
    const allowed = new Set(["src/Layout.jsx", "src/lib/tierAccess.js"]);
    const hits = [];
    const walk = (dir) => {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, f.name);
            if (f.isDirectory()) walk(p);
            else if (/\.(jsx?|mjs)$/.test(f.name) && !f.name.endsWith(".test.mjs")) {
                const rel = path.relative(ROOT, p);
                if (allowed.has(rel)) continue;
                if (/subscription_tier\s*===?\s*['"]premium['"]/.test(strip(fs.readFileSync(p, "utf8")))) hits.push(rel);
            }
        }
    };
    walk(path.join(ROOT, "src"));
    assert.deepEqual(hits, [], `these ignore premium codes: ${hits.join(", ")}`);
});

console.log(`\npremiumCodes: ${passed} checks passed`);
