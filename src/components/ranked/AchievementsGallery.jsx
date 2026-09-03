// ════════════════════════════════════════════════════════════════════════════
// AchievementsGallery — visual grid of unlockable achievements.
//
// Catalog comes from the server (POST /local-ai/fn/getAchievements). Each
// achievement has a Lucide icon name, rarity (common/rare/epic/legendary)
// and a reward XP amount granted automatically on unlock.
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles, Play, BookOpen, Flame, BrainCircuit, Users, Swords, Target,
    PencilLine, Lightbulb, Trophy, Map, Zap, Medal, Crown, Lock, X,
} from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import AceShuffle from "@/components/ace/AceShuffle";

// Lucide icon registry — every name used by the catalog must be in here.
const ICON_REGISTRY = {
    Sparkles, Play, BookOpen, Flame, BrainCircuit, Users, Swords, Target,
    PencilLine, Lightbulb, Trophy, Map, Zap, Medal, Crown,
};

// Per-rarity visual styling. Static Tailwind only.
const RARITY = {
    common:    { label: "Common",    chip: "bg-muted text-muted-foreground",  haloEarned: "bg-muted text-foreground border-border/60",  ring: "ring-border/30" },
    rare:      { label: "Rare",      chip: "bg-chart-3/10 text-chart-3",       haloEarned: "bg-chart-3/10 text-chart-3 border-chart-3/30", ring: "ring-chart-3/30" },
    epic:      { label: "Epic",      chip: "bg-chart-4/10 text-chart-4",       haloEarned: "bg-chart-4/10 text-chart-4 border-chart-4/30", ring: "ring-chart-4/30" },
    legendary: { label: "Legendary", chip: "bg-xp/10 text-xp",                  haloEarned: "bg-xp/10 text-xp border-xp/30",                ring: "ring-xp/30" },
};

export default function AchievementsGallery() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Not signed in");
            const r = await fetch("/local-ai/fn/getAchievements", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({}),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || "Failed to load achievements");
            setData(j);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    if (loading) {
        return (
            <div className="card-soft p-8 text-center">
                <AceShuffle size="lg" className="mx-auto" />
            </div>
        );
    }
    if (error || !data) {
        return (
            <div className="card-soft p-8 text-center">
                <p className="text-muted-foreground text-sm">{error || "Could not load achievements."}</p>
                <button onClick={load} className="mt-3 text-sm font-bold text-primary hover:underline">Retry</button>
            </div>
        );
    }

    // Read defensively. This grid is the bottom half of the profile tab, and a
    // payload without `items` — an older server, a partial response — took the
    // whole tab down with it rather than rendering one empty section.
    const items = Array.isArray(data.items) ? data.items : [];
    const total = data.total_count ?? items.length;
    const unlocked = data.unlocked_count ?? items.filter((i) => i.unlocked).length;
    const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

    return (
        <div className="space-y-4">
            {/* Progress header */}
            <div className="card-soft p-5">
                <div className="flex items-baseline justify-between mb-2">
                    <div>
                        <p className="stat-label text-muted-foreground">Achievements</p>
                        <p className="font-display font-extrabold text-foreground text-xl mt-0.5">
                            {unlocked} <span className="text-muted-foreground/60 text-base">/ {total} unlocked</span>
                        </p>
                    </div>
                    <span className="pill bg-primary/10 text-primary text-xs">{pct}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                        className="h-full bg-primary rounded-full"
                    />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    Unlock conditions check automatically when you earn XP. Rewards stack on your total XP.
                </p>
            </div>

            {/* Hex-grid gallery */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {items.map((item) => (
                    <AchievementTile
                        key={item.code || item.id}
                        item={item}
                        onClick={() => setSelected(item)}
                    />
                ))}
            </div>

            {/* Detail modal */}
            <AnimatePresence>
                {selected && (
                    <DetailModal item={selected} onClose={() => setSelected(null)} />
                )}
            </AnimatePresence>
        </div>
    );
}

function AchievementTile({ item, onClick }) {
    const Icon = ICON_REGISTRY[item.icon] || Sparkles;
    const r = RARITY[item.rarity] || RARITY.common;
    return (
        <button
            onClick={onClick}
            className={`card-soft card-soft-hover p-3 flex flex-col items-center gap-2 transition-all ${item.unlocked ? r.ring : ""} ${item.unlocked ? "ring-2" : ""}`}
        >
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
                item.unlocked ? r.haloEarned : "bg-muted/40 text-muted-foreground/40 border-border/30"
            }`}>
                {item.unlocked
                    ? <Icon className="w-6 h-6" strokeWidth={2.5} />
                    : <Lock className="w-5 h-5" strokeWidth={2.5} />}
            </div>
            <p className={`text-[11px] font-display font-extrabold text-center leading-tight line-clamp-2 ${
                item.unlocked ? "text-foreground" : "text-muted-foreground/60"
            }`}>
                {item.unlocked ? item.name : "Locked"}
            </p>
            {item.unlocked && item.reward_xp > 0 && (
                <span className="pill bg-xp/10 text-xp text-[9px] px-1.5 py-0">
                    +{item.reward_xp} XP
                </span>
            )}
        </button>
    );
}

function DetailModal({ item, onClose }) {
    const Icon = ICON_REGISTRY[item.icon] || Sparkles;
    const r = RARITY[item.rarity] || RARITY.common;
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
        >
            <motion.div
                initial={{ scale: 0.96, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 12 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-surface rounded-2xl border border-border/60 shadow-soft-lg max-w-sm w-full overflow-hidden"
            >
                <div className="relative px-6 pt-7 pb-5 text-center">
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <div className={`w-20 h-20 mx-auto rounded-3xl border-2 flex items-center justify-center mb-4 ${
                        item.unlocked ? r.haloEarned : "bg-muted/40 text-muted-foreground/40 border-border/30"
                    }`}>
                        {item.unlocked
                            ? <Icon className="w-10 h-10" strokeWidth={2} />
                            : <Lock className="w-8 h-8" strokeWidth={2} />}
                    </div>
                    <span className={`pill ${r.chip} text-[10px] mb-2`}>{r.label}</span>
                    <h3 className="font-display font-extrabold text-foreground text-xl tracking-tight">
                        {item.unlocked ? item.name : "Locked"}
                    </h3>
                    <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                        {item.desc}
                    </p>
                    {item.reward_xp > 0 && (
                        <div className="mt-4 inline-flex items-center gap-1.5 pill bg-xp/10 text-xp text-sm">
                            <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
                            <span className="font-bold">+{item.reward_xp.toLocaleString()} XP reward</span>
                        </div>
                    )}
                    {item.unlocked && item.unlocked_at && (
                        <p className="text-xs text-muted-foreground mt-3">
                            Unlocked {new Date(item.unlocked_at).toLocaleDateString()}
                        </p>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
