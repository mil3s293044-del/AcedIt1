/**
 * Teach plain `node` the `@/` alias that Vite resolves for the browser build.
 *
 * Most of src/lib is pure logic worth asserting against — routing rules,
 * scheduling maths, cost arithmetic — but the moment a module imports
 * `@/lib/something` it stops being runnable outside Vite, and in practice that
 * means it stops being tested. This is the smallest thing that removes the
 * excuse.
 *
 * Usage:  node --import ./src/lib/_aliasLoader.mjs src/lib/whatever.test.mjs
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./_aliasHooks.mjs", pathToFileURL(import.meta.filename));
