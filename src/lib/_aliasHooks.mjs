/**
 * Resolve hook for the `@/` alias — the loader half of _aliasLoader.mjs.
 *
 * `@/` means the `src/` directory, matching the alias in vite.config.js. Vite
 * also resolves a missing extension; Node does not, so an extensionless
 * specifier is retried as `.js` and then `.jsx` before giving up.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../", import.meta.url);   // src/lib/ → src/

export function resolve(specifier, context, next) {
    if (!specifier.startsWith("@/")) return next(specifier, context);

    const bare = new URL(specifier.slice(2), SRC);
    const candidates = [bare, new URL(`${bare.pathname}.js`, SRC), new URL(`${bare.pathname}.jsx`, SRC)];
    for (const url of candidates) {
        if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(bare.href, context);   // let Node report the real miss
}
