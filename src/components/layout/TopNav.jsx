import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Menu, X, ChevronDown, Flame, Zap } from "lucide-react";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";

const NAV_GROUPS = [
    {
        label: "Study",
        items: [
            { label: "Study Session", path: "Study" },
            { label: "Flashcards", path: "Study" },
            { label: "AI Tools", path: "AITools" },
            { label: "Quizzes", path: "Quizzes" },
            { label: "Study Roadmap", path: "StudyRoadmap" },
        ]
    },
    {
        label: "Progress",
        items: [
            { label: "Goals", path: "Goals" },
            { label: "Analytics", path: "Analytics" },
            { label: "Ranked", path: "Ranked" },
        ]
    },
    {
        label: "Social",
        items: [
            { label: "Friends", path: "Friends" },
            { label: "Compete", path: "Competitions" },
        ]
    },
    {
        label: "Account",
        items: [
            { label: "Subjects", path: "Subjects" },
            { label: "Subscription", path: "Subscription" },
            { label: "Settings", path: "Settings" },
            { label: "Support", path: "Support" },
        ]
    }
];

export default function TopNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [openGroup, setOpenGroup] = useState(null);
    const [userProfile, setUserProfile] = useState(null);

    useEffect(() => {
        base44.auth.me().then(user => {
            base44.entities.UserProfile.filter({ created_by: user.email }).then(profiles => {
                if (profiles[0]) setUserProfile(profiles[0]);
            }).catch(() => {});
        }).catch(() => {});
    }, []);

    const isDashboard = location.pathname === "/" || location.pathname === "/Dashboard";

    return (
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-violet-100/50 shadow-sm">
            <div className="w-full px-4 lg:px-8">
                <div className="flex items-center justify-between h-14">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
                        <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                            <GraduationCap className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                        </div>
                        <span className="font-black text-lg bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
                            AcedIt
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-1">
                        {NAV_GROUPS.map(group => (
                            <div
                                key={group.label}
                                className="relative"
                                onMouseEnter={() => setOpenGroup(group.label)}
                                onMouseLeave={() => setOpenGroup(null)}
                            >
                                <button className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                    openGroup === group.label ? 'bg-violet-50 text-violet-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}>
                                    {group.label}
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openGroup === group.label ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {openGroup === group.label && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6, scale: 0.97 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 4, scale: 0.97 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-2xl shadow-xl p-2 min-w-[160px]"
                                        >
                                            {group.items.map(item => (
                                                <Link
                                                    key={item.label}
                                                    to={createPageUrl(item.path)}
                                                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 rounded-xl font-medium transition-colors"
                                                    onClick={() => setOpenGroup(null)}
                                                >
                                                    {item.label}
                                                </Link>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </nav>

                    {/* Right side — streak + xp pills */}
                    <div className="hidden md:flex items-center gap-2">
                        {userProfile?.streak_days > 0 && (
                            <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-full px-3 py-1">
                                <Flame className="w-3.5 h-3.5 text-orange-500" />
                                <span className="text-xs font-bold text-orange-700">{userProfile.streak_days}d</span>
                            </div>
                        )}
                        {userProfile?.total_xp > 0 && (
                            <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-100 rounded-full px-3 py-1">
                                <Zap className="w-3.5 h-3.5 text-violet-600" />
                                <span className="text-xs font-bold text-violet-700">{userProfile.total_xp.toLocaleString()} XP</span>
                            </div>
                        )}
                        {!isDashboard && (
                            <Link to="/">
                                <button className="text-xs font-semibold text-gray-500 hover:text-violet-600 transition-colors px-2 py-1 rounded-lg hover:bg-violet-50">
                                    ← Home
                                </button>
                            </Link>
                        )}
                    </div>

                    {/* Mobile hamburger */}
                    <button
                        className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-600"
                        onClick={() => setMobileOpen(!mobileOpen)}
                    >
                        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden border-t border-gray-100 bg-white overflow-hidden"
                    >
                        <div className="px-4 py-3 space-y-1 max-h-[70vh] overflow-y-auto">
                            {NAV_GROUPS.map(group => (
                                <div key={group.label}>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-3 pt-3 pb-1">{group.label}</p>
                                    {group.items.map(item => (
                                        <Link
                                            key={item.label}
                                            to={createPageUrl(item.path)}
                                            className="block px-3 py-2.5 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 rounded-xl font-medium transition-colors"
                                            onClick={() => setMobileOpen(false)}
                                        >
                                            {item.label}
                                        </Link>
                                    ))}
                                </div>
                            ))}
                            {userProfile && (
                                <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-t border-gray-100 mt-2">
                                    {userProfile.streak_days > 0 && (
                                        <div className="flex items-center gap-1 bg-orange-50 border border-orange-100 rounded-full px-2.5 py-1">
                                            <Flame className="w-3 h-3 text-orange-500" />
                                            <span className="text-xs font-bold text-orange-700">{userProfile.streak_days}d streak</span>
                                        </div>
                                    )}
                                    {userProfile.total_xp > 0 && (
                                        <div className="flex items-center gap-1 bg-violet-50 border border-violet-100 rounded-full px-2.5 py-1">
                                            <Zap className="w-3 h-3 text-violet-600" />
                                            <span className="text-xs font-bold text-violet-700">{userProfile.total_xp.toLocaleString()} XP</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}