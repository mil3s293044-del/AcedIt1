/**
 * dbEnums — every status string the server writes has to be one the column
 * actually accepts.
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/dbEnums.test.mjs
 *
 * ─── The bug this exists to catch ───────────────────────────────────────────
 * `score_wagers.status` carries a CHECK constraint from migration 0008:
 *
 *     check (status in ('active','resolved','cancelled'))
 *
 * The forecast layer, written months later, spoke a different vocabulary —
 * `pending` while open, `won`/`lost` once settled. So `placeForecast` inserted
 * `status: "pending"`, Postgres rejected the whole row, and the feature
 * returned a 500 on every call ever made. Not a regression: it had never once
 * worked. And because the stake was debited before the insert, each attempt
 * also destroyed the student's XP on the way out.
 *
 * `buildAchievementStats` had the read-side twin — `.in('status',
 * ['won','lost'])` asked for two values that cannot exist, so the calibration
 * stat counted nothing for anybody, silently and forever.
 *
 * ─── Why nothing else could see it ──────────────────────────────────────────
 * `dbColumns.test.mjs` checks that every column NAMED exists, which is the
 * other half of this and would not have helped: `status` is a real column and
 * the query was well formed. Lint, the build, the suite and the page-mount
 * sweep never touch a database. The gap was always VALUES, and a string
 * literal in JavaScript has no relationship to a CHECK constraint in SQL that
 * any tool in this project was looking at.
 *
 * ─── Constraints come from the MIGRATIONS, not from schema.json ─────────────
 * Unlike `dbColumns`, which reads a real `information_schema` dump, this
 * parses the SQL — `scripts/dumpSchema.sh` records column names only, and
 * re-dumping constraints is a bigger change than this check is worth. The
 * parse is narrow and ORDERED: statements are replayed in migration order so a
 * dropped-then-recreated constraint (which is exactly what 0008 does) ends up
 * with the last definition rather than the first. A constraint this cannot
 * parse is simply not checked — a checker that cries wolf gets deleted.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

// ─── What the database allows ───────────────────────────────────────────────

/**
 * `{ "table.column": Set(values) }` for every `check (col in (...))` the
 * migrations define, replayed in order so the last word wins.
 */
export function allowedValues(files) {
    const allowed = new Map();
    const tableOf = (stmt) => {
        const m = /\btable\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/i.exec(stmt);
        return m ? m[1] : null;
    };

    for (const sql of files) {
        // Statement-at-a-time, comments stripped first so a `--` line holding
        // the words "check (status in ...)" cannot be read as a constraint.
        const bare = sql.replace(/--[^\n]*/g, "");
        for (const stmt of bare.split(";")) {
            const table = tableOf(stmt);
            if (!table) continue;

            // A dropped table takes its constraints with it (0008 does this).
            if (/\bdrop\s+table\b/i.test(stmt)) {
                [...allowed.keys()].forEach((k) => {
                    if (k.startsWith(`${table}.`)) allowed.delete(k);
                });
                continue;
            }

            // `drop constraint … <table>_<column>_check` — the naming
            // convention is the only link back to a column, and it is the one
            // Postgres itself generates and every migration here follows.
            const dropped = /\bdrop\s+constraint\s+(?:if\s+exists\s+)?"?([a-z0-9_]+)"?/i.exec(stmt);
            if (dropped) {
                const m = new RegExp(`^${table}_([a-z0-9_]+)_check$`).exec(dropped[1]);
                if (m) allowed.delete(`${table}.${m[1]}`);
                // falls through: 0008 drops and re-adds in separate statements,
                // but an inline `add constraint … check (…)` in the SAME one
                // still has to be picked up below.
            }

            // Every `check (col in ('a','b'))` in the statement. A create-table
            // can carry several, one per column.
            const checkRe = /check\s*\(\s*"?([a-z_][a-z0-9_]*)"?\s+in\s*\(([^)]*)\)\s*\)/gi;
            let c;
            while ((c = checkRe.exec(stmt)) !== null) {
                const values = [...c[2].matchAll(/'([^']*)'/g)].map((v) => v[1]);
                if (values.length) allowed.set(`${table}.${c[1]}`, new Set(values));
            }
        }
    }
    return allowed;
}

// ─── What the server writes and reads ───────────────────────────────────────

/**
 * Literal values the code binds to a column, as { table, column, value, line }.
 *
 * Same forward-walk as `columnRefs` in dbColumns.test.mjs: a Supabase query is
 * a chain, so the table is whichever `.from("x")` most recently opened. Only
 * string LITERALS are collected — a variable or template is skipped rather
 * than guessed at.
 */
export function valueRefs(text, columns) {
    const refs = [];
    const opens = [];
    const fromRe = /\.from\(\s*"([a-z_][a-z0-9_]*)"\s*\)/g;
    let m;
    while ((m = fromRe.exec(text)) !== null) opens.push({ table: m[1], at: m.index });

    const lineAt = (i) => text.slice(0, i).split("\n").length;
    const cols = `(?:${columns.join("|")})`;

    opens.forEach((open, i) => {
        const end = Math.min(opens[i + 1]?.at ?? text.length, open.at + 1200);
        const chain = text.slice(open.at, end);
        const push = (column, value, at) =>
            refs.push({ table: open.table, column, value, line: lineAt(open.at + at) });

        // Writes: `status: "x"` inside an .insert / .update object.
        const writeRe = new RegExp(`\\b(${cols})\\s*:\\s*"([^"]+)"`, "g");
        let w;
        while ((w = writeRe.exec(chain)) !== null) push(w[1], w[2], w.index);

        // Reads: .eq("status", "x") / .neq(...)
        const eqRe = new RegExp(`\\.(?:eq|neq)\\(\\s*"(${cols})"\\s*,\\s*"([^"]+)"\\s*\\)`, "g");
        let e;
        while ((e = eqRe.exec(chain)) !== null) push(e[1], e[2], e.index);

        // Reads: .in("status", ["x", "y"])
        const inRe = new RegExp(`\\.(?:in|not)\\(\\s*"(${cols})"\\s*,\\s*\\[([^\\]]*)\\]`, "g");
        let n;
        while ((n = inRe.exec(chain)) !== null) {
            [...n[2].matchAll(/['"]([^'"]+)['"]/g)].forEach((v) => push(n[1], v[1], n.index));
        }
    });
    return refs;
}

// ─── The check itself ───────────────────────────────────────────────────────

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    .map((f) => readFileSync(`${dir}/${f}`, "utf8"));
const allowed = allowedValues(files);
const src = readFileSync("server.mjs", "utf8");

check("the migrations define constraints this can actually read", () => {
    // A parser that silently finds nothing would make every check below pass.
    assert.ok(allowed.size >= 5,
        `only parsed ${allowed.size} CHECK constraints — the parse has probably broken`);
    assert.deepEqual([...(allowed.get("score_wagers.status") || [])].sort(),
        ["active", "cancelled", "resolved"],
        "score_wagers.status is the constraint this whole file exists for");
});

check("EVERY STATUS THE SERVER WRITES IS ONE THE COLUMN ACCEPTS", () => {
    const columns = [...allowed.keys()].map((k) => k.split(".")[1]);
    const bad = valueRefs(src, [...new Set(columns)])
        .filter((r) => allowed.has(`${r.table}.${r.column}`))
        .filter((r) => !allowed.get(`${r.table}.${r.column}`).has(r.value))
        .map((r) => `server.mjs:${r.line} ${r.table}.${r.column} = "${r.value}" `
            + `(allowed: ${[...allowed.get(`${r.table}.${r.column}`)].join(", ")})`);
    assert.deepEqual(bad, [], `\n      ${bad.join("\n      ")}\n`);
});

check("and it would have caught the bug that shipped", () => {
    // A static check nobody has seen fail is one that has quietly stopped
    // working. This is the real placeForecast insert, with the value it
    // actually carried, asserted to be rejected.
    const broken = `
      const { data: row } = await supabaseAdmin.from("score_wagers").insert({
        bettor_email: user.email,
        wagered_xp: amount,
        status: "pending",
      }).select().single();`;
    const hits = valueRefs(broken, ["status"])
        .filter((r) => !allowed.get(`${r.table}.${r.column}`)?.has(r.value));
    assert.equal(hits.length, 1, "the pending insert should be flagged");
    assert.equal(hits[0].value, "pending");

    // And the read-side twin, which was just as silent.
    const brokenRead = `await supabaseAdmin.from("score_wagers").select("xp_outcome")
        .eq("bettor_email", userEmail).in("status", ["won", "lost"]).limit(500);`;
    const readHits = valueRefs(brokenRead, ["status"])
        .filter((r) => !allowed.get(`${r.table}.${r.column}`)?.has(r.value));
    assert.deepEqual(readHits.map((r) => r.value), ["won", "lost"]);
});

check("a value the column DOES allow is left alone", () => {
    const fine = `await supabaseAdmin.from("score_wagers")
        .update({ status: "resolved" }).eq("status", "active");`;
    const hits = valueRefs(fine, ["status"])
        .filter((r) => !allowed.get(`${r.table}.${r.column}`)?.has(r.value));
    assert.deepEqual(hits, [], "active and resolved are both legal");
});

check("a table with no constraint on that column is not guessed at", () => {
    // `study_bets.status` is unconstrained and legitimately uses won/lost.
    // Flagging it would be the false positive that gets this file deleted.
    assert.equal(allowed.has("study_bets.status"), false);
    const bets = `await supabaseAdmin.from("study_bets").update({ status: "won" });`;
    const hits = valueRefs(bets, ["status"])
        .filter((r) => allowed.has(`${r.table}.${r.column}`));
    assert.deepEqual(hits, []);
});

console.log(`\n${passed} passed`);
