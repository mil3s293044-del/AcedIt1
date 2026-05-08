import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { School, Globe, MapPin, Users, Search, Plus, Crown, Trophy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getCurrentSeason } from "@/components/shared/rankingEngine";
import JoinSchoolDialog from "./JoinSchoolDialog";

const SchoolRow = ({ school, rank, isUserSchool }) => {
    let rowAccent = "border border-border hover:bg-secondary/40";
    if (isUserSchool) {
        rowAccent = "border-2 border-primary bg-primary/5";
    } else if (rank === 1) {
        rowAccent = "border border-xp/30 bg-xp/10";
    } else if (rank === 2) {
        rowAccent = "border border-border bg-secondary";
    } else if (rank === 3) {
        rowAccent = "border border-streak/20 bg-streak/5";
    }

    let rankBadgeBg = "bg-secondary text-foreground";
    if (rank === 1) rankBadgeBg = "bg-xp/15 text-xp";
    else if (rank === 2) rankBadgeBg = "bg-secondary text-foreground";
    else if (rank === 3) rankBadgeBg = "bg-streak/10 text-streak";
    else if (isUserSchool) rankBadgeBg = "bg-primary/15 text-primary";

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(rank * 0.03, 0.4) }}
            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${rowAccent}`}
        >
            {/* Rank badge */}
            <div className={`w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center font-display font-extrabold text-sm ${rankBadgeBg}`}>
                {rank <= 3 ? ["1st", "2nd", "3rd"][rank - 1] : `#${rank}`}
            </div>

            {/* School colour dot + info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: school.logo_color || "hsl(var(--chart-4))" }} />
                    <p className="font-display font-extrabold text-foreground truncate text-sm">{school.school_name}</p>
                    {school.verified && (
                        <span className="pill bg-chart-3/15 text-chart-3 text-[10px] py-0.5 px-1.5">Verified</span>
                    )}
                    {isUserSchool && (
                        <span className="pill bg-primary/15 text-primary text-[10px] py-0.5">Your school</span>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {school.city || school.state}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {school.member_count} members</span>
                    {school.top_student_username && (
                        <span className="flex items-center gap-1"><Crown className="w-3 h-3 text-xp" /> @{school.top_student_username}</span>
                    )}
                </div>
            </div>

            {/* Season XP */}
            <div className="text-right flex-shrink-0">
                <p className="font-display font-extrabold text-foreground text-lg leading-none">{(school.total_season_xp || 0).toLocaleString()}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">season XP</p>
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
                    <div key={i} className="card-soft p-4 animate-pulse">
                        <div className="h-12 bg-secondary/50 rounded-xl" />
                    </div>
                ))}
            </div>
        );
    }

    const topThree = filteredSchools.slice(0, 3);

    return (
        <div className="space-y-5">
            {/* Header card */}
            <div className="card-soft p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-5 h-5 text-chart-4" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="font-display font-extrabold text-foreground text-base">School leaderboard</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Your XP contributes to your school's season rank.</p>
                        </div>
                    </div>
                    {!userSchoolName && (
                        <Button
                            onClick={() => setShowJoinDialog(true)}
                            size="sm"
                            className="flex-shrink-0"
                        >
                            <Plus className="w-4 h-4" /> Join a school
                        </Button>
                    )}
                </div>
                {season && (
                    <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-secondary/50 border border-border">
                        <span className="pill bg-chart-4/15 text-chart-4 text-[11px]">{season.name}</span>
                        <span className="text-xs text-muted-foreground">Resets when the season ends — top schools earn recognition.</span>
                    </div>
                )}
            </div>

            {/* Your school summary */}
            {userSchoolName && (() => {
                const mySchool = schools.find(s => s.school_name === userSchoolName);
                const myRank = schools.findIndex(s => s.school_name === userSchoolName) + 1;
                if (!mySchool) return null;
                return (
                    <div className="card-soft p-5 border-2 border-primary/30 bg-primary/5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                                <School className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-display font-extrabold text-foreground truncate">{mySchool.school_name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                    <span>Rank #{myRank} globally</span>
                                    <span>·</span>
                                    <span>{(mySchool.total_season_xp || 0).toLocaleString()} season XP</span>
                                    <span>·</span>
                                    <span>{mySchool.member_count} members</span>
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="stat-num text-primary">#{myRank}</p>
                                <p className="stat-label">global rank</p>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 h-auto p-1.5 rounded-2xl bg-surface border-2 border-border shadow-soft">
                    <TabsTrigger
                        value="global"
                        className="flex items-center gap-1.5 py-2.5 px-2 rounded-xl text-xs lg:text-sm font-bold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-soft transition-all"
                    >
                        <Globe className="w-4 h-4" /> Global
                    </TabsTrigger>
                    <TabsTrigger
                        value="state"
                        className="flex items-center gap-1.5 py-2.5 px-2 rounded-xl text-xs lg:text-sm font-bold text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-soft transition-all"
                    >
                        <MapPin className="w-4 h-4" /> My state
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                    placeholder="Search schools..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Podium top 3 */}
            {topThree.length > 0 && !searchQuery && (
                <div className="card-soft p-5">
                    <div className="grid grid-cols-3 gap-3">
                        {[topThree[1], topThree[0], topThree[2]].filter(Boolean).map((school, i) => {
                            const podiumIdx = i;
                            const podiumLabels = ["2nd", "1st", "3rd"];
                            const accents = [
                                { bg: "bg-secondary", border: "border-border", text: "text-foreground", pill: "bg-secondary text-foreground" },
                                { bg: "bg-xp/10",     border: "border-xp/30",  text: "text-xp",         pill: "bg-xp/15 text-xp" },
                                { bg: "bg-streak/5",  border: "border-streak/20", text: "text-streak",  pill: "bg-streak/10 text-streak" },
                            ];
                            const a = accents[podiumIdx];
                            return (
                                <motion.div
                                    key={school.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex flex-col items-center"
                                >
                                    <span className={`pill mb-2 ${a.pill}`}>{podiumLabels[podiumIdx]}</span>
                                    <div className={`w-full rounded-xl p-3 text-center border-2 ${a.bg} ${a.border}`}>
                                        <p className="font-display font-extrabold text-xs truncate text-foreground">{school.school_name}</p>
                                        <p className={`font-display font-extrabold text-base mt-1 ${a.text}`}>{(school.total_season_xp || 0).toLocaleString()}</p>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">XP</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* List */}
            <div className="card-soft p-3 space-y-2">
                {filteredSchools.map((school, idx) => (
                    <SchoolRow
                        key={school.id}
                        school={school}
                        rank={idx + 1}
                        isUserSchool={school.school_name === userSchoolName}
                    />
                ))}
                {filteredSchools.length === 0 && (
                    <div className="p-12 text-center">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-secondary flex items-center justify-center">
                            <School className="w-6 h-6 text-muted-foreground/60" />
                        </div>
                        <p className="text-muted-foreground text-sm">No schools found.</p>
                        <Button onClick={() => setShowJoinDialog(true)} className="mt-4" size="sm">
                            <Plus className="w-4 h-4" /> Register your school
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
                    toast({ title: `Joined ${schoolName}`, description: "Your XP now contributes to your school's rank." });
                    setShowJoinDialog(false);
                    loadData();
                }}
            />
        </div>
    );
}
