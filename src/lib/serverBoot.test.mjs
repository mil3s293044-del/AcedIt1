/**
 * serverBoot — every module `server.mjs` reaches must be resolvable BY NODE.
 *
 * ─── THE WHOLE CLASS IS INVISIBLE UNTIL PRODUCTION ──────────────────────────
 * `credStore.js` imported `@/lib/chips`. `server.mjs` imports `credStore.js`.
 * Vite resolves the alias, the test loader resolves the alias, node does not —
 * so the build succeeded, lint was clean, all 946 checks passed, and the
 * server threw ERR_MODULE_NOT_FOUND on boot. On Render the only symptom is a
 * health check that never answers and a deploy marked Failed, two commits
 * after the one that caused it.
 *
 * There is no runtime signal short of starting the process, which is the same
 * shape as the missing-column 400s `dbColumns.test.mjs` exists for: it renders
 * perfectly, it passes everything, and it is simply wrong.
 *
 * ─── SO THE GRAPH IS WALKED ─────────────────────────────────────────────────
 * Start at `server.mjs`, follow every relative import, and assert each one
 * would resolve under node's ESM rules. Three ways to fail and the file is the
 * only place any of them is checked:
 *
 *   `@/lib/x`   an alias — vite and the loader only
 *   `./x`       extensionless — node's ESM resolver does not guess `.js`
 *   `./x.jsx`   a file node has no loader for, which is why `XP_RANKS` had to
 *               move out of `xpSystem.jsx` into `xpRanks.js` in the first place
 *
 * It does not import anything. `server.mjs` boots Express and binds a port on
 * load, so importing it to test it is a side effect in a test runner — the
 * same reason `mirrors.test.mjs` parses both sides as text.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
let failed = 0;
const check = (name, fn) => {
    try {
        const bad = fn();
        if (bad) { console.log(`  FAIL  ${name}\n        ${bad}`); failed += 1; }
        else console.log(`  ok  ${name}`);
    } catch (e) {
        console.log(`  FAIL  ${name}\n        threw: ${e.message}`);
        failed += 1;
    }
};

/** Every `from "…"` / `import "…"` specifier in a file, comments stripped. */
function specifiers(src) {
    const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    const out = [];
    const re = /\bfrom\s+["']([^"']+)["']|\bimport\s+["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(code))) out.push(m[1] || m[2]);
    return out;
}

/**
 * Walk from an entry file, following only the specifiers node would have to
 * resolve on disk. A bare package name is npm's problem, not ours.
 */
function walk(entry) {
    const seen = new Set();
    const problems = [];
    const queue = [path.resolve(ROOT, entry)];

    while (queue.length) {
        const file = queue.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        if (!fs.existsSync(file)) continue;

        for (const spec of specifiers(fs.readFileSync(file, "utf8"))) {
            const where = path.relative(ROOT, file);
            if (spec.startsWith("@/")) {
                problems.push(`${where} imports "${spec}" — node cannot resolve the @ alias`);
                continue;
            }
            if (!spec.startsWith(".")) continue;        // a package; npm's job

            const target = path.resolve(path.dirname(file), spec);
            if (!/\.[a-z]+$/i.test(spec)) {
                problems.push(`${where} imports "${spec}" — node's ESM resolver does not add .js`);
                continue;
            }
            if (/\.(jsx|tsx|css)$/i.test(spec)) {
                problems.push(`${where} imports "${spec}" — node has no loader for that extension`);
                continue;
            }
            if (!fs.existsSync(target)) {
                problems.push(`${where} imports "${spec}" — no such file`);
                continue;
            }
            queue.push(target);
        }
    }
    return { problems, seen };
}

const walked = walk("server.mjs");

console.log("\nserverBoot\n");

check("SERVER.MJS REACHES NOTHING NODE CANNOT RESOLVE", () =>
    walked.problems.length ? walked.problems.join("\n        ") : null);

check("the walk actually reached the shared modules", () => {
    // A walk that silently matched nothing would pass the assertion above
    // forever — the same hole an exemption pointing at a moved file leaves.
    const want = ["src/lib/market.js", "src/lib/credStore.js", "src/lib/chips.js"];
    const got = [...walked.seen].map((f) => path.relative(ROOT, f));
    const missing = want.filter((w) => !got.includes(w));
    return missing.length ? `never reached: ${missing.join(", ")}` : null;
});

check("the walk would CATCH an alias, not merely tolerate one", () => {
    // Verified by putting the real bug back, in memory rather than on disk.
    const found = specifiers(`import { X } from "@/lib/chips";`);
    return found[0] === "@/lib/chips" ? null : `specifiers() missed it: ${found}`;
});

check("a comment naming an alias is NOT a failure", () => {
    // credStore.js's own note about the bug quotes the broken specifier. A
    // scan that reads its own explanation as the defect is the false positive
    // `fnResult.test.mjs` and `hookDeps.test.mjs` each had to learn about.
    const found = specifiers(`// import { X } from "@/lib/chips";\nimport y from "./z.js";`);
    return found.length === 1 && found[0] === "./z.js" ? null : `read the comment: ${found}`;
});

console.log(`\nserverBoot: ${failed ? `${failed} FAILED` : "4 checks passed"}\n`);
process.exit(failed ? 1 : 0);
