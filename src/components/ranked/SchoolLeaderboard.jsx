import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { School, Globe, MapPin, Users, Trophy, Search, Plus, Crown, Flame, Zap, Star } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getCurrentSeason } from "@/components/shared/rankingEngine";
import JoinSchoolDialog from "./JoinSchoolDialog";

const SchoolCard = ({ school, rank, isUserSchool }) => {
    const rankColors = [
        "from-yellow-400 to-amber-500 text-white",
        "from-slate-400 to-gray-500 text-white",
        "from-orange-400 to-amber-600 text-white",
    ];
    const rankColor = rankColors[rank - 1] || "from-indigo-100 to-purple-100 text-indigo-700";
    const rankNum = rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `#${rank}`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rank * 0.04 }}
            className={`bg-white rounded-2xl border ${isUserSchool ? "border-2 border-purple-400 ring-2 ring-purple-200" : "border-gray-100"} p-4 hover:shadow-md transition-all`}
        >
            <div className="flex items-center gap-3">
                {/* Rank badge */}
                <div className={`w-12 h-12 flex-shrink-0 rounded-xl bg-gradient-to-br ${rankColor.split(' ')[0]} ${rankColor.split(' ')[1]} flex items-center justify-center text-xl font-black shadow`}>
                    {rankNum}
                </div>

                {/* School colour dot + info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: school.logo_color || "#6366f1" }} />
                        <p className="font-bold text-gray-900 truncate">{school.school_name}</p>
                        {school.verified && <Badge className="bg-blue-100 text-blue-700 text-xs border-0 px-1.5">✓</Badge>}
                        {isUserSchool && <Badge className="bg-purple-100 text-purple-700 text-xs border-0">Your school</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {school.city || school.state}</span>
                        <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {school.member_count} members</span>
                        {school.top_student_username && (
                            <span className="flex items-center gap-0.5"><Crown className="w-3 h-3 text-yellow-500" /> @{school.top_student_username}</span>
                        )}
                    </div>
                </div>

                {/* Season XP */}
                <div className="text-right flex-shrink-0">
                    <p className="text-xl font-black text-indigo-700">{(school.total_season_xp || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">season XP</p>
                </div>
            </div>
        </motion.div>
    );
};

export default function SchoolLeaderboard() {
    const [schools, setSchools] = useState([]);
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [showJoinDialog, setShowJoinDialog] = useState(false);
    const [activeTab, setActiveTab] = useState("global");
    const { toast } = useToast();
    const season = getCurrentSeason();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const user = await base44.auth.me();
            const [profileArr, schoolList] = await Promise.all([
                base44.entities.UserProfile.filter({ created_by: user.email }),
                base44.entities.SchoolProfile.list("-total_season_xp", 100),
            ]);
            setUserProfile(profileArr[0] || null);
            setSchools(schoolList);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const userSchoolName = userProfile?.school_name;

    const filteredSchools = schools.filter(s => {
        if (activeTab === "state" && userSchoolName) {
            const userSchool = schools.find(sc => sc.school_name === userSchoolName);
            if (userSchool && s.state !== userSchool.state) return false;
        }
        if (searchQuery) return s.school_name.toLowerCase().includes(searchQuery.toLowerCase());
        return true;
    });

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1,2,3,4,5].map(i => (
                    <div key={i} className="bg-white rounded-2xl p-4 animate-pulse h-20" />
                ))}
            </div>
        );
    }

    const topThree = filteredSchools.slice(0, 3);
    const rest = filteredSchools.slice(3);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-white/70 text-xs font-bold uppercase tracking-wider mb-1">School Rankings</p>
                        <h2 className="text-2xl font-black">School Leaderboard 🏫</h2>
                        <p className="text-white/70 text-sm mt-1">Your XP contributes to your school's season rank</p>
                    </div>
                    {!userSchoolName && (
                        <Button
                            onClick={() => setShowJoinDialog(true)}
                            className="bg-white text-indigo-700 hover:bg-white/90 font-bold text-sm flex-shrink-0"
                            size="sm"
                        >
                            <Plus className="w-4 h-4 mr-1" /> Join a School
                        </Button>
                    )}
                </div>
                {season && (
                    <div className="mt-3 bg-white/10 rounded-xl px-3 py-2 text-sm">
                        <span className="font-bold">{season.name}</span>
                        <span className="text-white/70 ml-2">Resets when the season ends — top schools earn recognition 🏆</span>
                    </div>
                )}
            </div>

            {/* Your school summary */}
            {userSchoolName && (() => {
                const mySchool = schools.find(s => s.school_name === userSchoolName);
                const myRank = schools.findIndex(s => s.school_name === userSchoolName) + 1;
                if (!mySchool) return null;
                return (
                    <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-white shadow">🏫</div>
                            <div className="flex-1">
                                <p className="font-bold text-purple-900">{mySchool.school_name}</p>
                                <div className="flex items-center gap-3 text-xs text-purple-700 mt-0.5">
                                    <span>Rank #{myRank} globally</span>
                                    <span>·</span>
                                    <span>{(mySchool.total_season_xp || 0).toLocaleString()} season XP</span>
                                    <span>·</span>
                                    <span>{mySchool.member_count} members</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-black text-purple-700">#{myRank}</p>
                                <p className="text-xs text-purple-500">global rank</p>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 bg-white/50 p-1.5 border border-gray-200">
                    <TabsTrigger value="global" className="data-[state=active]:bg-white font-medium">
                        <Globe className="w-4 h-4 mr-2" /> Global
                    </TabsTrigger>
                    <TabsTrigger value="state" className="data-[state=active]:bg-white font-medium">
                        <MapPin className="w-4 h-4 mr-2" /> My State
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                    placeholder="Search schools..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white"
                />
            </div>

            {/* Podium top 3 */}
            {topThree.length > 0 && !searchQuery && (
                <div className="grid grid-cols-3 gap-2">
                    {[topThree[1], topThree[0], topThree[2]].filter(Boolean).map((school, i) => {
                        const realRank = filteredSchools.indexOf(school) + 1;
                        const heights = ["h-24", "h-32", "h-20"];
                        const podiumIdx = i;
                        return (
                            <motion.div
                                key={school.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex flex-col items-center"
                            >
                                <span className="text-2xl mb-1">{["🥈","🥇","🥉"][podiumIdx]}</span>
                                <div className="w-full rounded-xl p-2 text-center"
                                    style={{ backgroundColor: (school.logo_color || "#6366f1") + "22", borderColor: school.logo_color || "#6366f1", borderWidth: 1 }}
                                >
                                    <p className="font-bold text-xs truncate text-gray-800">{school.school_name}</p>
                                    <p className="text-xs font-black text-indigo-700 mt-0.5">{(school.total_season_xp || 0).toLocaleString()}</p>
                                    <p className="text-xs text-gray-400">XP</p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* List */}
            <div className="space-y-2">
                {filteredSchools.map((school, idx) => (
                    <SchoolCard
                        key={school.id}
                        school={school}
                        rank={idx + 1}
                        isUserSchool={school.school_name === userSchoolName}
                    />
                ))}
                {filteredSchools.length === 0 && (
                    <div className="bg-gray-50 rounded-2xl p-12 text-center">
                        <School className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500">No schools found</p>
                        <Button onClick={() => setShowJoinDialog(true)} className="mt-3" size="sm">
                            <Plus className="w-4 h-4 mr-1" /> Register Your School
                        </Button>
                    </div>
                )}
            </div>

            <JoinSchoolDialog
                open={showJoinDialog}
                onClose={() => setShowJoinDialog(false)}
                existingSchools={schools}
                userProfile={userProfile}
                onJoined={(schoolName) => {
                    toast({ title: `Joined ${schoolName}! 🏫`, description: "Your XP now contributes to your school's rank." });
                    setShowJoinDialog(false);
                    loadData();
                }}
            />
        </div>
    );
}