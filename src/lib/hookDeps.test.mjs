/**
 * hookDeps — a dependency array may not name something declared later.
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/hookDeps.test.mjs
 *
 * ─── The bug this exists to catch ───────────────────────────────────────────
 * This took the Compete page down in production, as a white screen:
 *
 *     useEffect(() => { loadCallouts(); }, [tick, loadCallouts]);   // line 175
 *     ...
 *     const loadCallouts = useCallback(...);                        // line 224
 *
 * A function called INSIDE an effect body is read when the effect runs, which
 * is after render — so `useEffect(() => loadData(), [])` above its own
 * declaration is completely fine, and the codebase does that in several
 * places. A DEPENDENCY ARRAY is different: it is evaluated during render, at
 * the point the hook is called. Naming a `const` that has not been reached yet
 * is a temporal-dead-zone ReferenceError, the component throws on its first
 * render, and PageErrorBoundary shows "This page didn't load".
 *
 * The two look almost identical on screen and one of them is a crash, which is
 * exactly the kind of difference a person reviewing a diff will not see.
 *
 * ─── Deliberately a text scan, not a parser ─────────────────────────────────
 * There is no AST tooling in this repo and adding a parser to catch one bug
 * shape is not a trade worth making. This looks for the literal pattern —
 * `}, [ ... ]` closing a hook — and checks each bare identifier in it against
 * the `const`/`let` declarations in the same file. It can only report a
 * problem when a declaration genuinely appears later in the file, so a false
 * positive requires a same-named binding declared twice.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const ROOTS = ["src/pages", "src/components", "src/lib"];

function walk(dir, out = []) {
    let entries;
    try { entries = readdirSync(dir); } catch { return out; }
    for (const e of entries) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.jsx?$/.test(e) && !/\.test\.mjs$/.test(e)) out.push(p);
    }
    return out;
}

/** Where each top-level `const`/`let` binding is first declared. */
function declarationLines(lines) {
    const at = new Map();
    lines.forEach((line, i) => {
        // `const foo = ...` / `let foo = ...`, ignoring destructuring, which
        // cannot be matched to a single name without a parser.
        const m = /^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/.exec(line);
        if (m && !at.has(m[1])) at.set(m[1], i);
    });
    return at;
}

/**
 * Every hook dependency array in a file, as { line, names }.
 *
 * Matches the closing `}, [...])` of a hook call. Arrays spanning lines are
 * joined first so a wrapped list is still seen whole.
 */
function depArrays(src) {
    const found = [];
    const flat = src.replace(/\r/g, "");
    const re = /\}\s*,\s*\[([^\]]*)\]\s*\)/g;
    let m;
    while ((m = re.exec(flat)) !== null) {
        const upto = flat.slice(0, m.index);
        // Only hook calls. A plain `}, [x])` in an ordinary function call has
        // no dependency semantics and no TDZ risk worth reporting.
        if (!/use(?:Effect|Memo|Callback|LayoutEffect|ImperativeHandle)\s*\($/m.test(
            upto.replace(/[\s\S]*?(use\w+\s*\()?[^(]*$/, "$1") || "")) {
            // Fall back to a scan backwards for the nearest hook opener, which
            // is more reliable than trying to anchor the regex.
            const back = upto.slice(-4000);
            const lastHook = Math.max(
                back.lastIndexOf("useEffect("), back.lastIndexOf("useMemo("),
                back.lastIndexOf("useCallback("), back.lastIndexOf("useLayoutEffect("));
            if (lastHook === -1) continue;
        }
        const line = upto.split("\n").length - 1;
        const names = m[1]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            // Bare identifiers only: `a.b`, `a?.b` and literals carry no TDZ
            // risk of their own for the base name we could check.
            .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s));
        found.push({ line, names });
    }
    return found;
}

const files = ROOTS.flatMap((r) => walk(r));

check("there are files to check at all", () => {
    assert.ok(files.length > 100, `expected the app's components, found ${files.length}`);
});

check("NO DEPENDENCY ARRAY NAMES A CONST DECLARED LATER IN THE SAME FILE", () => {
    const problems = [];
    for (const file of files) {
        const src = readFileSync(file, "utf8");
        if (!/use(Effect|Memo|Callback|LayoutEffect)\s*\(/.test(src)) continue;
        const lines = src.split("\n");
        const declaredAt = declarationLines(lines);

        for (const { line, names } of depArrays(src)) {
            for (const name of names) {
                const decl = declaredAt.get(name);
                // Only a genuine "declared below where it is read" is a
                // problem. Anything declared above, imported, or a parameter
                // is fine.
                if (decl != null && decl > line) {
                    problems.push(
                        `${file}:${line + 1} — dependency "${name}" is declared at line ${decl + 1}. `
                        + "A deps array is evaluated during render, so this throws a TDZ "
                        + "ReferenceError and the page renders its error boundary.");
                }
            }
        }
    }
    assert.deepEqual(problems, [], `\n      ${problems.join("\n      ")}\n`);
});

check("the scanner actually recognises the shape it is looking for", () => {
    // Without this the suite could pass by finding nothing at all — which is
    // exactly how a static check quietly stops working.
    const sample = `
        function C() {
            useEffect(() => { go(); }, [tick, later]);
            const later = useCallback(() => {}, []);
        }`;
    const arrays = depArrays(sample);
    assert.ok(arrays.length >= 1, "no dependency arrays were found in an obvious sample");
    assert.ok(arrays[0].names.includes("later"));
    const decl = declarationLines(sample.split("\n"));
    assert.ok(decl.get("later") > arrays[0].line, "the sample's own hazard is detectable");
});

check("and it does not flag the safe shape the codebase uses on purpose", () => {
    // Calling a later-declared function INSIDE the body is fine: the body runs
    // after render. Only the array is read during it.
    const sample = `
        function C() {
            useEffect(() => { loadData(); }, []);
            const loadData = async () => {};
        }`;
    const arrays = depArrays(sample);
    const decl = declarationLines(sample.split("\n"));
    const flagged = arrays.flatMap(({ line, names }) =>
        names.filter((n) => (decl.get(n) ?? -1) > line));
    assert.deepEqual(flagged, []);
});

console.log(`\n${passed} passed`);
