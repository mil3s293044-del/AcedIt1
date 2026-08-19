/**
 * ThemeToggle — one tap to the other table.
 *
 * WHY THIS EXISTS ALONGSIDE THE SETTINGS PANEL. The panel has all four
 * options and is the honest place for the choice. But a theme control that
 * only lives in Settings gets found by a minority of people, and the moment
 * somebody actually wants it is the moment the screen is too bright, which is
 * never while they are on the settings page.
 *
 * IT SETS AN EXPLICIT PREFERENCE, and that is the point worth being careful
 * about. Tapping this from `system` does not mean "stop following my phone
 * forever" in a way anybody consciously chose, so the label says which way it
 * is going and the Settings panel says which mode they ended up in. Getting
 * back to System is one tap there, and the panel tells them so.
 */
import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/useTheme";

export default function ThemeToggle({ className = "" }) {
    const { isDark, toggle } = useTheme();
    const Icon = isDark ? Sun : Moon;

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full
                text-muted-foreground hover:text-foreground hover:bg-muted
                transition-colors ${className}`}
        >
            <Icon className="w-4 h-4" />
        </button>
    );
}
