import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Home, Brain, Sparkles, Trophy, Menu, X,
    FileQuestion, BookOpen, Users, Map,
    Swords, BarChart3, Settings as SettingsIcon,
    CreditCard, HelpCircle, Compass
} from "lucide-react";
import { createPageUrl } from "@/utils";

const PRIMARY_TABS = [
    { label: "Home",   path: "Dashboard", icon: Home },
    { label: "Study",  path: "Study",     icon: Brain },
    { label: "AI",     path: "AITools",   icon: Sparkles },
    { label: "Ranked", path: "Ranked",    icon: Trophy },
];

const MORE_GROUPS = [
    // First, and on its own. It is the door to everything below it, and a door
    // filed alphabetically among the rooms is not a door.
    {
        label: "Start here",
        items: [
            { label: "Explore — what can I do?", path: "Explore", icon: Compass },
        ],
    },
    {
        label: "Study",
        items: [
            { label: "Quizzes",       path: "Quizzes",      icon: FileQuestion },
            { label: "Planner",       path: "Goals", icon: Map },
        ],
    },
    {
        label: "Progress",
        items: [
            { label: "Analytics", path: "Analytics", icon: BarChart3 },
        ],
    },
    {
        label: "Social",
        items: [
            { label: "Friends", path: "Friends",      icon: Users },
            { label: "Compete", path: "Competitions", icon: Swords },
        ],
    },
    {
        label: "Account",
        items: [
            { label: "Subjects",     path: "Subjects",     icon: BookOpen },
            { label: "Subscription", path: "Subscription", icon: CreditCard },
            { label: "Settings",     path: "Settings",     icon: SettingsIcon },
            { label: "Support",      path: "Support",      icon: HelpCircle },
        ],
    },
];

function pathMatches(currentPath, itemPath) {
    const target = createPageUrl(itemPath).toLowerCase();
    const current = currentPath.toLowerCase();
    return current === target || current.startsWith(target + "/");
}

export default function BottomNav() {
    const location = useLocation();
    const [moreOpen, setMoreOpen] = useState(false);

    // Close sheet on route change
    useEffect(() => {
        setMoreOpen(false);
    }, [location.pathname]);

    // Lock body scroll when sheet open
    useEffect(() => {
        if (moreOpen) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => { document.body.style.overflow = prev; };
        }
    }, [moreOpen]);

    // Esc closes sheet
    useEffect(() => {
        if (!moreOpen) return;
        const onKey = (e) => { if (e.key === "Escape") setMoreOpen(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [moreOpen]);

    const isHome = location.pathname === "/" || location.pathname.toLowerCase() === "/dashboard";
    const isInMoreGroup = MORE_GROUPS.some(g => g.items.some(i => pathMatches(location.pathname, i.path)));

    return (
        <>
            <nav
                className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t-2 border-border"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                aria-label="Primary"
            >
                <div className="flex items-stretch justify-around">
                    {PRIMARY_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = tab.path === "Dashboard"
                            ? isHome
                            : pathMatches(location.pathname, tab.path);
                        return (
                            <Link
                                key={tab.label}
                                to={createPageUrl(tab.path)}
                                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] active:scale-95 transition-transform"
                                aria-current={isActive ? "page" : undefined}
                            >
                                <div className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${
                                    isActive ? "bg-primary/15" : ""
                                }`}>
                                    <Icon className={`w-5 h-5 transition-colors ${
                                        isActive ? "text-primary" : "text-muted-foreground"
                                    }`} />
                                </div>
                                <span className={`text-[10px] font-bold tracking-wide leading-none transition-colors ${
                                    isActive ? "text-primary" : "text-muted-foreground"
                                }`}>
                                    {tab.label}
                                </span>
                            </Link>
                        );
                    })}
                    <button
                        onClick={() => setMoreOpen(true)}
                        className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] active:scale-95 transition-transform"
                        aria-haspopup="dialog"
                        aria-expanded={moreOpen}
                    >
                        <div className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${
                            isInMoreGroup || moreOpen ? "bg-primary/15" : ""
                        }`}>
                            <Menu className={`w-5 h-5 transition-colors ${
                                isInMoreGroup || moreOpen ? "text-primary" : "text-muted-foreground"
                            }`} />
                        </div>
                        <span className={`text-[10px] font-bold tracking-wide leading-none transition-colors ${
                            isInMoreGroup || moreOpen ? "text-primary" : "text-muted-foreground"
                        }`}>
                            More
                        </span>
                    </button>
                </div>
            </nav>

            <AnimatePresence>
                {moreOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setMoreOpen(false)}
                            className="md:hidden fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50"
                            aria-hidden="true"
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 32, stiffness: 320 }}
                            className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-3xl border-t-2 border-border max-h-[80vh] overflow-y-auto shadow-2xl"
                            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
                            role="dialog"
                            aria-modal="true"
                            aria-label="More navigation"
                        >
                            <div className="sticky top-0 bg-surface/95 backdrop-blur-xl pt-3 pb-2 px-4 border-b border-border">
                                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-border" />
                                <div className="flex items-center justify-between pt-3">
                                    <h2 className="font-display font-extrabold text-foreground text-lg">More</h2>
                                    <button
                                        onClick={() => setMoreOpen(false)}
                                        className="p-2 -mr-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                        aria-label="Close menu"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 space-y-5">
                                {MORE_GROUPS.map(group => (
                                    <div key={group.label}>
                                        <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider px-3 mb-1.5">
                                            {group.label}
                                        </p>
                                        <div className="space-y-0.5">
                                            {group.items.map(item => {
                                                const Icon = item.icon;
                                                const isActive = pathMatches(location.pathname, item.path);
                                                return (
                                                    <Link
                                                        key={item.label}
                                                        to={createPageUrl(item.path)}
                                                        className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
                                                            isActive
                                                                ? "bg-primary/10 text-primary"
                                                                : "text-foreground hover:bg-secondary active:bg-secondary"
                                                        }`}
                                                        onClick={() => setMoreOpen(false)}
                                                    >
                                                        <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                                                        {item.label}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
