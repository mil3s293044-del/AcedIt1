/**
 * useTheme — the theme preference, shared by everything that shows or sets it.
 *
 * Context rather than a hook each component calls on its own, because there are
 * two controls (the nav button and the Settings panel) that must agree the
 * instant either one is used. Two independent copies of this state is how you
 * get a moon icon in the corner while the settings page still says Light.
 *
 * WHAT THIS DOES NOT DO is decide the theme at startup. The inline script in
 * index.html has already done that, before the first paint and before this
 * module existed. This picks up from there and keeps it true afterwards: when
 * the student changes the setting, when their device flips at dusk, and when
 * the clock crosses seven on the `auto` setting.
 */
import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import {
    readPreference, writePreference, resolveNow, applyTheme,
    isLive, msUntilNextFlip, normalisePreference, currentDescription,
} from "@/lib/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
    const [preference, setPreferenceState] = useState(() => readPreference());
    const [resolved, setResolved] = useState(() => resolveNow(readPreference()));

    const setPreference = useCallback((next) => {
        const p = normalisePreference(next);
        setPreferenceState(p);
        writePreference(p);
        const r = resolveNow(p);
        setResolved(r);
        applyTheme(r);
    }, []);

    /**
     * Apply once on mount.
     *
     * The boot script has normally already done this, so in the app this is a
     * no-op that writes the same class back. It is here because without it the
     * provider is not self-sufficient: rendering the settings panel on its own
     * showed Dark selected, the moon swapped for a sun, and a light page,
     * because nothing had told the document anything yet. Anything that
     * mounts this without index.html's head — a preview, a test, an embed —
     * hit exactly that, and a component whose correctness depends on a script
     * in another file is a component waiting to be wrong somewhere.
     */
    useEffect(() => { applyTheme(resolveNow(preference)); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

    /**
     * Follow the device, but only while the student is following the device.
     *
     * The listener is always attached and cheap; what changes is whether it
     * acts. Attaching and detaching on every preference change instead would
     * be more code for a listener that fires perhaps twice a day.
     */
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => {
            if (!isLive(preference)) return;
            const r = resolveNow(preference);
            setResolved(r);
            applyTheme(r);
        };
        // Safari below 14 has addListener and not addEventListener.
        if (mq.addEventListener) mq.addEventListener("change", onChange);
        else mq.addListener(onChange);
        return () => {
            if (mq.removeEventListener) mq.removeEventListener("change", onChange);
            else mq.removeListener(onChange);
        };
    }, [preference]);

    /**
     * Cross the boundary on the `auto` setting.
     *
     * A timer set to the exact next flip, re-armed each time, rather than an
     * interval asking whether it is seven o'clock yet. One wakeup a day instead
     * of fourteen hundred, on a page students leave open for hours.
     */
    useEffect(() => {
        if (preference !== "auto") return undefined;
        let timer;
        const arm = () => {
            timer = setTimeout(() => {
                const r = resolveNow("auto");
                setResolved(r);
                applyTheme(r);
                arm();
            }, msUntilNextFlip());
        };
        arm();
        return () => clearTimeout(timer);
    }, [preference]);

    /**
     * Another tab changed it.
     *
     * Students keep AcedIt open in several tabs, and a theme that only applies
     * to the tab it was set in reads as the setting not having saved.
     */
    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const onStorage = (e) => {
            if (e.key && e.key !== "acedit:theme") return;
            const p = readPreference();
            setPreferenceState(p);
            const r = resolveNow(p);
            setResolved(r);
            applyTheme(r);
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const value = useMemo(() => ({
        preference,
        setPreference,
        resolved,
        isDark: resolved === "dark",
        /** Plain English for what is on screen, or null when it is obvious. */
        description: currentDescription(preference, resolved),
        /** What the nav button should do: straight to the opposite of now. */
        toggle: () => setPreference(resolved === "dark" ? "light" : "dark"),
    }), [preference, resolved, setPreference]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Safe outside the provider, returning a sane read-only shape rather than
 * throwing — a theme button is never worth crashing a page over.
 */
export function useTheme() {
    return useContext(ThemeContext) ?? {
        preference: "system",
        setPreference: () => {},
        resolved: "light",
        isDark: false,
        description: null,
        toggle: () => {},
    };
}
