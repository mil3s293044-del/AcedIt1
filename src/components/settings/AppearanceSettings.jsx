/**
 * AppearanceSettings — pick a table to sit at.
 *
 * WHAT THIS REPLACES was a single on/off switch that was never mounted
 * anywhere, wrote straight to localStorage under a different key, and had no
 * counterpart at startup — so even had it been on a page, the setting would
 * have been forgotten on the next reload. It also hardcoded slate colours,
 * which is a dark-mode control that does not itself survive dark mode.
 *
 * FOUR OPTIONS, NOT A SWITCH. A boolean means every student whose phone runs
 * on auto has to set this app separately, forever, so System is here and is
 * the default. `By time of day` is the one the app has earned: the dashboard
 * already lights its table by the clock, and this puts the rest of the app on
 * the same one. See src/lib/theme.js.
 *
 * THE CHOICES ARE SHOWN, NOT HIDDEN IN A SELECT. Four items is exactly the
 * range where a radio group beats a dropdown: every option and its consequence
 * is readable without a click, and picking one is one tap rather than two.
 */
import React from "react";
import { motion } from "framer-motion";
import { Palette, Sun, Moon, Monitor, Clock, Check } from "lucide-react";
import { useTheme } from "@/lib/useTheme";
import { PREFERENCES, PREFERENCE_COPY } from "@/lib/theme";

const ICON = { system: Monitor, light: Sun, dark: Moon, auto: Clock };

export default function AppearanceSettings({ delay = 0 }) {
    const { preference, setPreference, description } = useTheme();

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="card-soft p-6"
        >
            <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                    <Palette className="w-5 h-5 text-chart-4" />
                </div>
                <div>
                    <h2 className="font-display font-extrabold text-foreground text-base">Appearance</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Which table you sit at.</p>
                </div>
            </div>

            <div role="radiogroup" aria-label="Theme" className="grid gap-2 sm:grid-cols-2">
                {PREFERENCES.map((key) => {
                    const Icon = ICON[key];
                    const copy = PREFERENCE_COPY[key];
                    const on = preference === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setPreference(key)}
                            className={`text-left rounded-xl border-2 p-3.5 transition-colors ${
                                on
                                    ? "border-primary bg-primary/5"
                                    : "border-border bg-background/40 hover:border-primary/40 hover:bg-muted/50"
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 flex-shrink-0 ${on ? "text-primary" : "text-muted-foreground"}`} />
                                <span className="font-bold text-sm text-foreground">{copy.label}</span>
                                {on && <Check className="w-3.5 h-3.5 text-primary ml-auto flex-shrink-0" />}
                            </span>
                            <span className="block text-xs text-muted-foreground mt-1">{copy.blurb}</span>
                        </button>
                    );
                })}
            </div>

            {/* Only says something when the answer is not already on screen:
                "Light" needs no explanation, "System" does. */}
            {description && (
                <p className="text-xs text-muted-foreground mt-3">{description}</p>
            )}
        </motion.section>
    );
}
