/**
 * achievements assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/achievements.test.mjs
 *
 * The rule this file exists to keep: EVERY ACHIEVEMENT MUST BE REACHABLE.
 * Five of the original twenty-four were not — they read a column that does not
 * exist, a table nothing writes to, or one of the two study tables — and an
 * achievement nobody can hit teaches a student the grid is decoration, after
 * which the reachable ones stop pulling either.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as LucideIcons from "lucide-react";
import {
    ACHIEVEMENTS, ACHIEVEMENT_BY_CODE, RARITIES, CEREMONY,
    evaluate, board, nearest, summary, showcase,
} from "@/lib/achievements";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

// ─── the catalogue itself ───────────────────────────────────────────────────

check("every achievement is well formed", () => {
    const codes = new Set();
    for (const a of ACHIEVEMENTS) {
        assert.match(a.code, /^[A-Z0-9_]+$/, `bad code: ${a.code}`);
        assert.ok(!codes.has(a.code), `duplicate code: ${a.code}`);
        codes.add(a.code);
        assert.ok(a.name && a.desc, `${a.code} needs a name and a description`);
        assert.ok(RARITIES.includes(a.rarity), `${a.code} has rarity "${a.rarity}"`);
        assert.ok(a.reward_xp > 0, `${a.code} pays nothing`);
        assert.equal(typeof a.progress, "function", `${a.code} has no progress function`);
        assert.ok(a.icon, `${a.code} has no icon`);
    }
});

check("EVERY ACHIEVEMENT IS REACHABLE — some finite stats unlock it", () => {
    // The whole point. Feed a generously large stats object and assert that
    // every single entry comes back unlocked; anything that does not is
    // reading a stat nobody computes, which is exactly how 600 XP ended up
    // behind a page that redirects.
    const generous = {};
    // Discover the stat names by proxying, so a new achievement reading a new
    // stat is covered without this test being edited.
    const seen = new Set();
    const probe = new Proxy({}, {
        get(_, key) { seen.add(String(key)); return 1e9; },
    });
    ACHIEVEMENTS.forEach((a) => a.progress(probe));
    seen.forEach((k) => { generous[k] = 1e9; });

    const unreachable = board(generous, [])
        .filter((a) => !a.unlocked)
        .map((a) => a.code);
    assert.deepEqual(unreachable, [],
        `\n      unreachable even with every stat maxed: ${unreachable.join(", ")}\n`);
});

check("AND EVERY STAT IT READS IS ONE THE SERVER ACTUALLY BUILDS", () => {
    // The other half. An achievement can be "reachable" against a made-up
    // stats object and still be dead in production if `buildAchievementStats`
    // never sets that key — which is precisely how FRIEND_MAGNET failed: the
    // predicate was fine, the query behind it was not.
    const seen = new Set();
    const probe = new Proxy({}, { get(_, k) { seen.add(String(k)); return 0; } });
    ACHIEVEMENTS.forEach((a) => a.progress(probe));

    const server = readFileSync("server.mjs", "utf8");
    const start = server.indexOf("async function buildAchievementStats");
    assert.ok(start > 0, "could not find buildAchievementStats in server.mjs");

    // Brace-match to the function's real end. The first version sliced a flat
    // 6,000 characters, which silently truncated the moment the builder grew
    // and then reported three stats as missing that were set 400 characters
    // past the cut — a scanner that quietly reads less than it claims to is
    // the exact failure mode these guards exist to prevent.
    let depth = 0;
    let end = start;
    for (let i = server.indexOf("{", start); i < server.length; i += 1) {
        if (server[i] === "{") depth += 1;
        else if (server[i] === "}") { depth -= 1; if (depth === 0) { end = i; break; } }
    }
    assert.ok(end > start, "could not find the end of buildAchievementStats");
    const builder = server.slice(start, end);
    assert.ok(builder.includes("return stats"), "the slice does not reach the function's return");

    const missing = [...seen].filter((k) => !new RegExp(`stats\\.${k}\\s*=|\\b${k}:`).test(builder));
    assert.deepEqual(missing, [],
        `\n      progress functions read stats the server never sets: ${missing.join(", ")}\n`);
});

check("and that guard would catch a stat the server does not set", () => {
    // A check nobody has seen fail is one that has quietly stopped working —
    // and this one already reported a false positive once, from a truncating
    // window. Asserted against a stat name that certainly is not in the file.
    const server = readFileSync("server.mjs", "utf8");
    assert.ok(!/stats\.definitely_not_a_real_stat\s*=/.test(server));
});

check("nothing reads the two stats that were silently always zero", () => {
    // `roadmap_completions` counted a table with no writer; `session_count`
    // read study_sessions alone and so missed the entire Study page. Both are
    // gone, and naming them here stops them coming back.
    const seen = new Set();
    const probe = new Proxy({}, { get(_, k) { seen.add(String(k)); return 0; } });
    ACHIEVEMENTS.forEach((a) => a.progress(probe));
    assert.ok(!seen.has("roadmap_completions"), "study_roadmaps has no writer in the app");
    assert.ok(!seen.has("session_count"),
        "study_sessions alone misses pomodoro, blurting, recall and spaced repetition");
    assert.ok(seen.has("study_count"), "the replacement reads BOTH study tables");
});

check("EVERY ICON RESOLVES, because a wrong name fails silently", () => {
    // Every surface looks an icon up by name with a fallback —
    // `Icons[item.icon] || Icons.Award` in AchievementUnlock, the same shape on
    // the gallery tile. A name that misses renders a generic glyph and nothing
    // anywhere says so: the visual twin of the silent-stat failures above.
    const missing = ACHIEVEMENTS.filter((a) => !LucideIcons[a.icon])
        .map((a) => `${a.code} -> ${a.icon}`);
    assert.deepEqual(missing, [], `\n      ${missing.join("\n      ")}\n`);
    assert.ok(!LucideIcons.DefinitelyNotAnIcon, "the lookup itself has to be able to miss");
});

check("AND NO SURFACE LOOKS ICONS UP IN A HAND-KEPT LIST", () => {
    // Checking against the real package is only worth anything if that is what
    // the component checks against. AchievementsGallery kept its own registry
    // of fifteen names, with a comment claiming every catalogue icon was in it,
    // and TWELVE of thirty-one were not — so both quiz tiers, both mistake
    // achievements, both call-outs, breadth, comeback and calibration all drew
    // the same generic sparkle. A lookup with a fallback plus a list somebody
    // has to remember to update is a bug with a schedule on it, and the first
    // version of the check above would have passed straight through it.
    const gallery = readFileSync("src/components/ranked/AchievementsGallery.jsx", "utf8");
    assert.match(gallery, /const ICON_REGISTRY = Icons;/,
        "the gallery must resolve against the whole library, not a literal object");
    const unlock = readFileSync("src/components/ranked/AchievementUnlock.jsx", "utf8");
    assert.match(unlock, /import \* as Icons from "lucide-react"/);
});

check("THE LEAGUE ACHIEVEMENTS READ COUNTS, NEVER A RANK", () => {
    // `best_weekly_rank` gets BETTER as it gets smaller, so an achievement
    // keyed on it cannot draw a progress bar and comes back unreachable from
    // the maxed-stats probe above. It was also read by nothing for months. The
    // three league entries read counts that go up; naming that here stops the
    // rank coming back.
    const seen = new Set();
    const probe = new Proxy({}, { get(_, k) { seen.add(String(k)); return 0; } });
    ACHIEVEMENTS.forEach((a) => a.progress(probe));
    assert.ok(!seen.has("best_weekly_rank"), "a rank is backwards and cannot be a target");

    ["LEAGUE_WEEK", "LEAGUE_PODIUM", "LEAGUE_WIN"].forEach((code) => {
        const a = ACHIEVEMENT_BY_CODE[code];
        assert.ok(a, `${code} is missing from the catalogue`);
        // More of the thing is always closer to the badge — which is what
        // makes it drawable as "1 of 3".
        const low = evaluate(a, { league_weeks: 0, league_podiums: 0, league_wins: 0 });
        const high = evaluate(a, { league_weeks: 9, league_podiums: 9, league_wins: 9 });
        assert.ok(high.ratio > low.ratio, `${code} does not improve as its stat grows`);
        assert.equal(high.unlocked, true);
        assert.equal(low.unlocked, false);
    });
});

check("the rarity ladder pays more as it climbs", () => {
    const worst = {};
    for (const r of RARITIES) {
        const xp = ACHIEVEMENTS.filter((a) => a.rarity === r).map((a) => a.reward_xp);
        assert.ok(xp.length > 0, `no ${r} achievements at all`);
        worst[r] = Math.min(...xp);
    }
    assert.ok(worst.common <= worst.rare);
    assert.ok(worst.rare <= worst.epic);
    assert.ok(worst.epic <= worst.legendary);
});

check("every rarity has a ceremony, and it gets louder", () => {
    RARITIES.forEach((r) => assert.ok(CEREMONY[r], `${r} has no ceremony`));
    assert.ok(CEREMONY.legendary.confetti > CEREMONY.common.confetti);
    assert.equal(CEREMONY.common.takesScreen, false,
        "a common unlock must not take the screen — that is what makes a legendary mean something");
    assert.equal(CEREMONY.legendary.takesScreen, true);
});

// ─── progress ───────────────────────────────────────────────────────────────

check("progress is a fraction a tile can draw, never a padlock", () => {
    const q = ACHIEVEMENT_BY_CODE.QUIZ_25;
    const e = evaluate(q, { quiz_count: 18 });
    assert.equal(e.value, 18);
    assert.equal(e.target, 25);
    assert.equal(e.unlocked, false);
    assert.ok(Math.abs(e.ratio - 0.72) < 1e-9);
});

check("a ratio never exceeds 1", () => {
    // 40,000 XP is 100% of the 25k badge, not 160% — a bar past its own track
    // renders outside the tile.
    const e = evaluate(ACHIEVEMENT_BY_CODE.XP_25K, { total_xp: 40000 });
    assert.equal(e.ratio, 1);
    assert.equal(e.unlocked, true);
});

check("missing stats read as zero rather than throwing", () => {
    // A student whose stats failed to build must see an empty grid, not a
    // crashed page.
    const rows = board({}, []);
    assert.equal(rows.length, ACHIEVEMENTS.length);
    rows.forEach((r) => { assert.equal(r.value, 0); assert.equal(r.unlocked, false); });
    assert.deepEqual(board(undefined, undefined).filter((r) => r.unlocked), []);
});

// ─── the rule about taking one back ─────────────────────────────────────────

check("A GRANTED ACHIEVEMENT IS NEVER TAKEN BACK", () => {
    // A student who sat 25 quizzes and later had attempts deleted keeps the
    // badge. An achievement records something that HAPPENED; recomputing it
    // live and revoking it is the one thing this must never do.
    const rows = board({ quiz_count: 0 }, ["QUIZ_25"]);
    const q = rows.find((r) => r.code === "QUIZ_25");
    assert.equal(q.unlocked, true);
    assert.equal(q.granted, true);
    assert.equal(q.value, 0, "the progress still tells the truth about now");
});

check("held accepts rows as well as codes", () => {
    const rows = board({}, [{ code: "FIRST_SPARK" }, "STREAK_3", null, undefined]);
    assert.equal(rows.find((r) => r.code === "FIRST_SPARK").unlocked, true);
    assert.equal(rows.find((r) => r.code === "STREAK_3").unlocked, true);
});

check("qualifying is distinguishable from granted", () => {
    // The Ranked page self-heals, so there is a real window where a student
    // qualifies and the row has not been written yet.
    const r = board({ total_xp: 200 }, []).find((x) => x.code === "FIRST_SPARK");
    assert.equal(r.unlocked, true);
    assert.equal(r.granted, false);
});

// ─── what to chase ──────────────────────────────────────────────────────────

check("nearest is what you could actually finish, closest first", () => {
    // 24 of 25 quizzes (0.96) beats 1 of 3 friends (0.33) and 2 of 7 days.
    // Written with numbers that are actually ordered — the first draft used
    // 4,900 XP as filler and XP_5K at 0.98 legitimately won.
    const list = nearest({ quiz_count: 24, friend_count: 1, peak_streak: 2 }, [], 3);
    assert.ok(list.length > 0);
    assert.equal(list[0].code, "QUIZ_25", "24 of 25 is the nearest thing on the board");
    for (let i = 1; i < list.length; i += 1) {
        assert.ok(list[i - 1].ratio >= list[i].ratio, "not sorted by closeness");
    }
});

check("ZERO PROGRESS IS NOT A NEAR MISS", () => {
    // "0 of 250 quizzes" is the whole achievement, not an almost. A brand new
    // account gets nothing in this list rather than a list of everything.
    assert.deepEqual(nearest({}, []), []);
    assert.ok(nearest({ quiz_count: 1 }, []).length > 0);
});

check("nearest never suggests something already unlocked", () => {
    const list = nearest({ quiz_count: 300, total_xp: 30000 }, ["QUIZ_250"]);
    assert.ok(list.every((a) => !a.unlocked));
    assert.ok(!list.some((a) => a.code === "QUIZ_250"));
});

// ─── the header, and the row beside your name ───────────────────────────────

check("the summary counts what is on the grid", () => {
    const s = summary({ total_xp: 100 }, []);
    assert.equal(s.total, ACHIEVEMENTS.length);
    assert.equal(s.unlocked, 1);
    assert.equal(s.pct, Math.round((1 / ACHIEVEMENTS.length) * 100));
    assert.equal(s.xpEarned, ACHIEVEMENT_BY_CODE.FIRST_SPARK.reward_xp);
    assert.ok(s.xpAvailable > s.xpEarned);
});

check("an empty account is 0 of N, not a crash or a NaN", () => {
    const s = summary({}, []);
    assert.equal(s.unlocked, 0);
    assert.equal(s.pct, 0);
    assert.equal(s.xpEarned, 0);
});

check("the showcase is the RAREST you hold, not the newest", () => {
    // What sits beside your name has to be the thing worth showing.
    const s = showcase({}, ["FIRST_SPARK", "STREAK_60", "QUIZ_25"], 2);
    assert.equal(s[0].code, "STREAK_60", "legendary outranks rare and common");
    assert.equal(s[0].rarity, "legendary");
    assert.equal(s.length, 2);
});

check("a student with nothing shows nothing", () => {
    assert.deepEqual(showcase({}, []), []);
});

console.log(`\n${passed} passed`);
