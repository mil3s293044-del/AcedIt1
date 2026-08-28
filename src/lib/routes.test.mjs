/**
 * route registration assertions —
 *   node --import ./src/lib/_aliasLoader.mjs src/lib/routes.test.mjs
 *
 * The bug this exists to catch, which shipped and 404'd in production for a
 * day: `pages.config.js` opens with a doc comment containing an EXAMPLE of
 * itself, complete with its own `import` lines and its own `export const
 * PAGES = {`. An edit anchored on the first match of either lands inside the
 * comment, where it changes nothing, and a grep for the page name then finds
 * it and looks like proof.
 *
 * So this parses with comments stripped, and checks the thing that actually
 * matters: every page the navigation links to has a route.
 */
import assert from "node:assert/strict";
import fs from "node:fs";

let passed = 0;
const check = (name, fn) => {
    try { fn(); passed += 1; console.log(`  ok  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.message}`); process.exitCode = 1; }
};

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const configRaw = fs.readFileSync("src/pages.config.js", "utf8");
const config = strip(configRaw);
const routeKeys = (() => {
    const m = config.match(/export const PAGES = \{([\s\S]*?)\n\}/);
    assert.ok(m, "PAGES object not found outside comments");
    return [...m[1].matchAll(/"([A-Za-z0-9_]+)"\s*:/g)].map((x) => x[1]);
})();

const navPaths = ["src/components/layout/SideRail.jsx", "src/components/layout/BottomNav.jsx"]
    .flatMap((f) => [...strip(fs.readFileSync(f, "utf8")).matchAll(/path:\s*"([A-Za-z0-9_]+)"/g)]
        .map((m) => m[1]));

check("the route map parses from real code, not the example in the header", () => {
    assert.ok(routeKeys.length > 10, `only ${routeKeys.length} routes parsed`);
    assert.ok(routeKeys.includes("Dashboard"), "Dashboard missing — parser is looking at the wrong object");
});

check("every page the nav links to has a route", () => {
    const missing = [...new Set(navPaths)].filter((p) => !routeKeys.includes(p));
    assert.deepEqual(missing, [], `nav links with no route: ${missing.join(", ")}`);
});

check("every registered route has a component file", () => {
    const missing = routeKeys.filter((k) => !fs.existsSync(`src/pages/${k}.jsx`));
    assert.deepEqual(missing, [], `routes with no page file: ${missing.join(", ")}`);
});

check("every registered route is really imported", () => {
    const missing = routeKeys.filter((k) =>
        !new RegExp(`^import\\s+${k}\\s+from`, "m").test(config));
    assert.deepEqual(missing, [], `registered but not imported: ${missing.join(", ")}`);
});

check("nothing was written into the header comment by mistake", () => {
    // Anything the code needs must survive comment-stripping. If a name appears
    // only in the raw file, an edit landed in the example block.
    for (const k of ["Explore", ...routeKeys.slice(0, 5)]) {
        const inRaw = (configRaw.match(new RegExp(`\\b${k}\\b`, "g")) || []).length;
        const inCode = (config.match(new RegExp(`\\b${k}\\b`, "g")) || []).length;
        assert.ok(inCode >= 2, `${k}: appears ${inCode}× in code (needs import + registration)`);
        assert.equal(inRaw, inCode, `${k}: ${inRaw - inCode} stray mention(s) inside the doc comment`);
    }
});

console.log(`\n${passed} passed`);
