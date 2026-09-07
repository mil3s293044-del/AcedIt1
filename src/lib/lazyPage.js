/**
 * lazyPage — `React.lazy`, but a failed chunk does not blank the app.
 *
 * ─── The bug this fixes ─────────────────────────────────────────────────────
 * "I click a page and it's just a blank screen; when I refresh it finally
 * loads." That is the signature of a dynamic import that REJECTED.
 *
 * The 24 pages are code-split, so a navigation fetches a chunk over the
 * network. When that fetch fails the lazy promise rejects, and with no error
 * boundary anywhere in the tree React unmounts everything above it — the nav,
 * the rail, the whole app — leaving white. A refresh fixes it because the
 * browser re-fetches `index.html` and gets the CURRENT chunk names.
 *
 * Which is also the usual cause: a DEPLOY. A student with the tab open is
 * holding an `index.html` that names `Dashboard-a1b2c3.js`; a deploy replaces
 * it with `Dashboard-d4e5f6.js` and deletes the old one; the next navigation
 * asks for a file that no longer exists and gets a 404 that is not JavaScript.
 * On a site that ships as often as this one, every student with a tab open is
 * one navigation away from a white screen.
 *
 * ─── Two attempts, then a reload, and only ever ONE reload ──────────────────
 * A flaky fetch is retried once — that alone fixes the transient case without
 * anybody noticing. If it still fails, the module really is gone from the
 * server, and the only thing that can help is fetching the new `index.html`,
 * so we reload the page.
 *
 * The `sessionStorage` guard is what stops that becoming a reload loop. If the
 * chunk is missing for any reason a reload cannot cure, an unguarded
 * `location.reload()` spins forever and the app is not merely broken, it is
 * unusable and unreportable. One attempt per session per chunk; after that the
 * error is allowed to reach the boundary, which can at least say something.
 */

import { lazy } from "react";

const RELOAD_KEY = "acedit:chunk-reload";

const alreadyReloadedFor = (name) => {
    try {
        return (sessionStorage.getItem(RELOAD_KEY) || "").split(",").includes(name);
    } catch {
        // Private mode, or storage blocked. Treat it as "already reloaded"
        // rather than risk the loop — a visible error beats a spinning tab.
        return true;
    }
};

const markReloaded = (name) => {
    try {
        const seen = (sessionStorage.getItem(RELOAD_KEY) || "").split(",").filter(Boolean);
        sessionStorage.setItem(RELOAD_KEY, [...new Set([...seen, name])].join(","));
    } catch { /* nothing to do — the guard above already treats this as spent */ }
};

/**
 * `lazyPage("Dashboard", () => import("./pages/Dashboard"))`
 *
 * The name is passed rather than derived, because the import path is a static
 * string the bundler rewrites and there is nothing readable left in it by the
 * time this runs.
 */
export function lazyPage(name, load) {
    return lazy(() => load().catch(async (first) => {
        // One retry, after a beat. A chunk that failed on a flaky connection
        // usually arrives on the second ask, and the student never sees it.
        await new Promise((r) => setTimeout(r, 400));
        try {
            return await load();
        } catch (second) {
            if (!alreadyReloadedFor(name)) {
                markReloaded(name);
                // The module is genuinely not where this build thinks it is.
                // Only a fresh index.html can fix that.
                window.location.reload();
                // Never resolves — the page is going away. Resolving with
                // anything here would flash a wrong render on the way out.
                return new Promise(() => {});
            }
            console.error(`[lazyPage] ${name} failed to load twice and a reload did not help`,
                first, second);
            throw second;
        }
    }));
}
