/**
 * theme — which table you are sitting at, light or dark.
 *
 * ─── What was already here ──────────────────────────────────────────────────
 * The whole dark palette. index.css has a complete `.dark` token block and it
 * works. What was missing was any way to reach it: AppearanceSettings.jsx held
 * a working toggle and had zero importers, so it was never mounted, and nothing
 * read the saved value at startup, so even mounted it would have been forgotten
 * on every reload.
 *
 * ─── Four preferences, not a switch ─────────────────────────────────────────
 * A boolean means every student whose phone runs on auto has to set this app
 * separately, forever. So:
 *
 *   system   follow the device. The default, and the one most people want
 *            without knowing they want it.
 *   light    always light.
 *   dark     always dark.
 *   auto     follow the clock — light by day, dark after dark.
 *
 * `auto` is not a gimmick in this app specifically. The dashboard already
 * lights its table by time of day through tableHour(), so the product has had
 * a sense of morning and night in it from the start; this puts the rest of the
 * app on the same clock. It is also just correct for the use case, which is a
 * student opening this at eleven at night.
 *
 * ─── Why resolution lives in a lib ──────────────────────────────────────────
 * The same rule has to run in three places that cannot share a React import:
 * the inline boot script in index.html (before any bundle parses, or the page
 * flashes), the settings control, and the live listeners that react to sunset
 * or to the device flipping. One rule, tested once. The boot script is a hand
 * copy of resolveTheme by necessity, and the test below pins the two together
 * so they cannot drift.
 */

export const PREFERENCES = ["system", "light", "dark", "auto"];
export const DEFAULT_PREFERENCE = "system";

/** Where the choice is kept. Also read by the inline script in index.html. */
export const STORAGE_KEY = "acedit:theme";

/**
 * Dark from this hour, light from the other.
 *
 * 19:00 to 06:00, which is a little later than tableHour()'s "evening" at 17.
 * Deliberate: the table's warm evening wash is a decoration and can start at
 * five, but turning the entire interface dark while it is still bright outside
 * reads as a fault rather than a feature.
 */
export const DARK_FROM_HOUR = 19;
export const LIGHT_FROM_HOUR = 6;

/** Browser chrome colour per theme, so the mobile address bar matches. */
export const THEME_COLOR = { light: "#58CC02", dark: "#0E1417" };

/**
 * The page ground, duplicated out of index.css as a literal.
 *
 * A stylesheet is a separate request, and the browser paints its own white
 * canvas in the frames before that request lands. Measuring the real build
 * frame by frame showed exactly that: luminance 255, then 17 — one white flash
 * ahead of a dark page, on every load, which is the whole thing the boot
 * script exists to prevent and which the boot script alone did not fix,
 * because it only set a class the stylesheet had not arrived to interpret yet.
 *
 * So the boot script paints the ground inline too. These must match the
 * --background token in index.css; the theme test checks that index.html
 * carries these exact values.
 */
export const GROUND = { light: "#FBF6EF", dark: "#0A121F" };

/** Anything unrecognised falls back to system rather than throwing. */
export function normalisePreference(value) {
    return PREFERENCES.includes(value) ? value : DEFAULT_PREFERENCE;
}

/** Is the clock in the dark half of the day? */
export function isDarkHour(hour) {
    const h = Number(hour);
    if (!Number.isFinite(h)) return false;
    return h >= DARK_FROM_HOUR || h < LIGHT_FROM_HOUR;
}

/**
 * The preference plus the world, resolved to the only two things a stylesheet
 * understands.
 *
 * `prefersDark` and `hour` are passed in rather than read here so this is
 * testable at any hour of any day, and so the caller decides what "now" means.
 */
export function resolveTheme(preference, { prefersDark = false, hour = 12 } = {}) {
    switch (normalisePreference(preference)) {
        case "light": return "light";
        case "dark": return "dark";
        case "auto": return isDarkHour(hour) ? "dark" : "light";
        default: return prefersDark ? "dark" : "light";
    }
}

/** Does this preference change on its own, without the student touching it? */
export function isLive(preference) {
    const p = normalisePreference(preference);
    return p === "system" || p === "auto";
}

/**
 * When `auto` next flips, in milliseconds from now.
 *
 * Returned rather than polled: a timer set to the exact boundary costs one
 * wakeup a day, where an interval checking whether it is seven o'clock yet
 * costs one every minute for the same answer.
 */
export function msUntilNextFlip(now = new Date()) {
    const next = new Date(now.getTime());
    next.setMinutes(0, 0, 0);
    const h = now.getHours();
    if (h < LIGHT_FROM_HOUR) next.setHours(LIGHT_FROM_HOUR);
    else if (h < DARK_FROM_HOUR) next.setHours(DARK_FROM_HOUR);
    else { next.setDate(next.getDate() + 1); next.setHours(LIGHT_FROM_HOUR); }
    return Math.max(1000, next.getTime() - now.getTime());
}

/** How the control describes each option. Kept next to the rule it describes. */
export const PREFERENCE_COPY = {
    system: { label: "System", blurb: "Match your phone or computer." },
    light: { label: "Light", blurb: "Always the daylight table." },
    dark: { label: "Dark", blurb: "Always the late-night table." },
    auto: { label: "By time of day", blurb: "Light until 7pm, dark after." },
};

/** What the student is actually looking at right now, said plainly. */
export function currentDescription(preference, resolved) {
    const p = normalisePreference(preference);
    if (p === "light" || p === "dark") return null;
    const what = resolved === "dark" ? "dark" : "light";
    return p === "auto"
        ? `Currently ${what}, and it will change on its own.`
        : `Your device is set to ${what} right now.`;
}

// ─── Applying it ────────────────────────────────────────────────────────────

/** Read the saved preference. Private-mode Safari throws on localStorage. */
export function readPreference() {
    try {
        return normalisePreference(localStorage.getItem(STORAGE_KEY));
    } catch {
        return DEFAULT_PREFERENCE;
    }
}

export function writePreference(preference) {
    try {
        localStorage.setItem(STORAGE_KEY, normalisePreference(preference));
    } catch { /* storage unavailable; the session still works, it just forgets */ }
}

/** Resolve against the real device and clock. Browser only. */
export function resolveNow(preference, now = new Date()) {
    const prefersDark = typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return resolveTheme(preference, { prefersDark, hour: now.getHours() });
}

/**
 * Put a resolved theme on the document.
 *
 * The class is what Tailwind's `darkMode: ["class"]` keys off. The
 * `color-scheme` property is separate and easy to forget: without it the
 * browser keeps drawing scrollbars, form controls and autofill in light
 * colours over a dark page, which is the detail that makes an otherwise
 * finished dark mode feel unfinished.
 */
export function applyTheme(resolved) {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved === "dark" ? "dark" : "light";
    // Kept in step with the inline style the boot script set. Leaving that one
    // at its boot value would mean a student who toggles to light still has a
    // dark <html> behind everything, showing through wherever the page does
    // not paint its own ground — overscroll bounce most visibly.
    root.style.backgroundColor = GROUND[resolved] || GROUND.light;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLOR[resolved] || THEME_COLOR.light);
}
