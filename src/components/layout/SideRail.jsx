import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    GraduationCap,
    Brain, FileQuestion, Sparkles, Map, BarChart3, Trophy,
    Users, Swords,
    BookOpen, CreditCard, Settings as SettingsIcon, HelpCircle, LifeBuoy,
} from "lucide-react";
import { createPageUrl } from "@/utils";

const NAV_SECTIONS = [
    {
        label: "Study",
        items: [
            { label: "Study Session", path: "Study",        icon: Brain },
            { label: "Quizzes",       path: "Quizzes",      icon: FileQuestion },
            { label: "AI Tools",      path: "AITools",      icon: Sparkles },
            { label: "Planner",       path: "Goals", icon: Map },
        ],
    },
    {
        label: "Progress",
        items: [
            { label: "Analytics", path: "Analytics", icon: BarChart3 },
            { label: "Ranked",    path: "Ranked",    icon: Trophy },
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
            // Two different things, so two different icons: Help is the manual
            // for the app, Support is a human you can write to.
            { label: "Help",         path: "Help",         icon: HelpCircle },
            { label: "Support",      path: "Support",      icon: LifeBuoy },
        ],
    },
];

function pathMatches(currentPath, itemPath) {
    const target = createPageUrl(itemPath).toLowerCase();
    const current = currentPath.toLowerCase();
    return current === target || current.startsWith(target + "/");
}

export default function SideRail() {
    const location = useLocation();
    const [expanded, setExpanded] = useState(false);
    const closeTimer = useRef(null);

    // Small delay on mouseleave so a flick across the rail doesn't flash collapse.
    const handleEnter = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setExpanded(true);
    };
    const handleLeave = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => setExpanded(false), 120);
    };

    useEffect(() => () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
    }, []);

    return (
        <aside
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            className="hidden md:flex fixed top-0 left-0 bottom-0 z-40 flex-col bg-surface border-r-2 border-border shadow-soft"
            style={{ width: expanded ? 280 : 64, transition: "width 220ms cubic-bezier(0.4, 0, 0.2, 1)" }}
            aria-label="Primary navigation"
        >
            {/* ── Logo ──────────────────────────────────────────────── */}
            <Link
                to="/"
                className="flex items-center gap-3 h-16 px-3 border-b border-border group flex-shrink-0"
            >
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center btn-3d transition-transform group-hover:scale-105 flex-shrink-0">
                    <GraduationCap className="w-5 h-5 text-primary-foreground" />
                </div>
                <AnimatePresence>
                    {expanded && (
                        <motion.span
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -6 }}
                            transition={{ duration: 0.15 }}
                            className="font-display font-extrabold text-foreground text-xl tracking-tight whitespace-nowrap overflow-hidden"
                        >
                            AcedIt
                        </motion.span>
                    )}
                </AnimatePresence>
            </Link>

            {/* ── Nav items ─────────────────────────────────────────── */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-4">
                {NAV_SECTIONS.map((section) => (
                    <div key={section.label}>
                        {/* Section label, only when expanded */}
                        <AnimatePresence>
                            {expanded && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.12 }}
                                    className="px-3 pb-1 text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground"
                                >
                                    {section.label}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="space-y-0.5">
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathMatches(location.pathname, item.path);
                                return (
                                    <Link
                                        key={item.label}
                                        to={createPageUrl(item.path)}
                                        title={!expanded ? item.label : undefined}
                                        aria-label={item.label}
                                        aria-current={isActive ? "page" : undefined}
                                        className={`relative flex items-center gap-3 h-10 rounded-xl text-sm font-bold transition-colors duration-200 ${
                                            isActive
                                                ? "bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                                        }`}
                                        style={{ paddingLeft: 14, paddingRight: 12 }}
                                    >
                                        {/* Active accent bar */}
                                        {isActive && (
                                            <motion.span
                                                layoutId="rail-active-accent"
                                                className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary"
                                                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                                            />
                                        )}
                                        <Icon className="w-5 h-5 flex-shrink-0" />
                                        <AnimatePresence>
                                            {expanded && (
                                                <motion.span
                                                    initial={{ opacity: 0, x: -4 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -4 }}
                                                    transition={{ duration: 0.12 }}
                                                    className="whitespace-nowrap overflow-hidden"
                                                >
                                                    {item.label}
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>
        </aside>
    );
}
