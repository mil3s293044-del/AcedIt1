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
 * ─── And a dependency array is not the only thing read during render ────────
 * The same crash came back a day later on Study, in a shape this file did not
 * cover:
 *
 *     useBusy(isFocusMode || isRunning, BUSY.FOCUS);   // line 75
 *     const [isFocusMode, setIsFocusMode] = useState(false);   // line 78
 *
 * A hook ARGUMENT is evaluated at the call site exactly like a deps array is.
 * So the rule is not "dependency arrays": it is ANYTHING read during render.
 * Hook calls carrying no arrow function are checked whole, which covers this
 * and cannot flag the safe body-call shape (a `useEffect(() => ...)` always
 * has one, so only its deps array is examined).
 *
 * eslint's own `no-use-before-define` is the general form of this and was
 * measured before writing it: 74 hits across the app, and nearly all of them
 * the SAFE shape. Turning it on would mean reshuffling 74 pieces of working
 * code to catch two real bugs, so the narrow check earns its place.
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
        // `const [a, setA] = useState()` — array destructuring, which is how
        // every piece of React state in this codebase is declared and how the
        // Study crash's own binding was written.
        const d = /^\s*(?:const|let)\s*\[([^\]]*)\]\s*=/.exec(line);
        if (d) {
            d[1].split(",").map((x) => x.trim()).filter((x) => /^[A-Za-z_$][\w$]*$/.test(x))
                .forEach((n) => { if (!at.has(n)) at.set(n, i); });
        }
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

/**
 * Hook calls whose arguments are read during render in full.
 *
 * A call containing `=>` or `function` has a body that runs later, so only its
 * dependency array (handled above) is evaluated at the call site. Everything
 * else — `useBusy(a || b, C)`, `useState(seed)` — is read whole, right there.
 */
function hookArgs(src) {
    const found = [];
    const re = /\buse[A-Z]\w*\s*\(/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        // Walk to the matching close paren.
        let depth = 1;
        let i = m.index + m[0].length;
        while (i < src.length && depth > 0) {
            const c = src[i];
            if (c === "(") depth += 1;
            else if (c === ")") depth -= 1;
            i += 1;
            if (i - m.index > 2000) break;      // runaway; not a call worth reading
        }
        if (depth !== 0) continue;
        // Strings are not references. `useState("duels")` names no binding,
        // and reading inside one flagged Competitions on its own state.
        const args = src.slice(m.index + m[0].length, i - 1)
            .replace(/"(?:[^"\\]|\\.)*"/g, '""')
            .replace(/'(?:[^'\\]|\\.)*'/g, "''")
            .replace(/`(?:[^`\\]|\\.)*`/g, "``");
        if (/=>|\bfunction\b/.test(args)) continue;   // has a deferred body
        const line = src.slice(0, m.index).split("\n").length - 1;

        // Object-literal KEYS are not references. `useState({ strengths: [] })`
        // reads nothing named `strengths`, and counting it flagged three
        // healthy components on the first run.
        const names = [];
        const idRe = /([.]?)\s*([A-Za-z_$][\w$]*)\s*(:?)/g;
        let a;
        while ((a = idRe.exec(args)) !== null) {
            if (a[1] === "." || a[3] === ":") continue;   // member access, or a key
            names.push(a[2]);
        }
        found.push({ line, names: [...new Set(names)] });
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

check("NO HOOK ARGUMENT NAMES A CONST DECLARED LATER EITHER", () => {
    // The Study crash: useBusy(isFocusMode || isRunning, ...) three lines above
    // `const [isFocusMode] = useState(false)`. A hook argument is read at the
    // call site, exactly like a deps array.
    const problems = [];
    for (const file of files) {
        const src = readFileSync(file, "utf8");
        if (!/\buse[A-Z]/.test(src)) continue;
        const lines = src.split("\n");
        const declaredAt = declarationLines(lines);
        const indentOf = (n) => (/^\s*/.exec(lines[n] || "")[0] || "").length;
        for (const { line, names } of hookArgs(src)) {
            for (const name of names) {
                const decl = declaredAt.get(name);
                // Same indentation means same statement scope, which is the
                // cheapest stand-in for "the same function body" without a
                // parser. `React.useContext(X)` inside a nested helper is at a
                // deeper indent than a module-level `const X`, and that pair is
                // perfectly legal — it flagged shadcn's own form.jsx otherwise.
                if (decl != null && decl > line && indentOf(decl) === indentOf(line)) {
                    problems.push(
                        `${file}:${line + 1} — argument "${name}" is declared at line ${decl + 1}. `
                        + "A hook argument is evaluated during render, so this throws a TDZ "
                        + "ReferenceError and the page renders its error boundary.");
                }
            }
        }
    }
    assert.deepEqual(problems, [], `\n      ${problems.join("\n      ")}\n`);
});

check("the argument scanner recognises its own shape", () => {
    const sample = `
        function C() {
            useBusy(isFocusMode || isRunning, BUSY.FOCUS);
            const [isFocusMode, setIsFocusMode] = useState(false);
        }`;
    const calls = hookArgs(sample).filter((c) => c.names.includes("isFocusMode"));
    assert.ok(calls.length >= 1, "the sample's own hazard is not detectable");
});

check("a hook with a deferred body is left to the deps-array check", () => {
    // useEffect/useMemo/useCallback always carry an arrow, so their arguments
    // are not read whole and only the array matters.
    const sample = `useEffect(() => { later(); }, []);\nconst later = () => {};`;
    assert.deepEqual(hookArgs(sample), []);
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
