import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Users, Award } from "lucide-react";
import { User, UserProfile, Friendship } from "@/entities/all";

const LeaderboardList = ({ users, currentUserEmail }) => {
    return (
        <div className="space-y-3">
            {users.map((u, index) => (
                <motion.div
                    key={u.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center gap-4 p-4 rounded-xl border ${u.email === currentUserEmail ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}
                >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-lg font-bold text-gray-600">
                        {index + 1}
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-gray-900">{u.full_name}</p>
                        <p className="text-sm text-gray-500">Level {u.level || 1}</p>
                    </div>
                    <div className="flex items-center gap-2 text-amber-600 font-semibold">
                        <Award className="w-5 h-5" />
                        {u.total_xp || 0} XP
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

export default function Leaderboard() {
    const [globalTop, setGlobalTop] = useState([]);
    const [friends, setFriends] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const user = await User.me();
                setCurrentUser(user);

                // Fetch Global Leaderboard
                const topProfiles = await UserProfile.list('-total_xp', 50);
                const profileEmails = topProfiles.map(p => p.created_by);
                const allUsers = await User.list();
                const topUsers = allUsers.filter(u => profileEmails.includes(u.email));
                
                const combinedGlobal = topProfiles.map(profile => {
                    const userDetail = topUsers.find(u => u.email === profile.created_by);
                    return { ...userDetail, ...profile };
                }).sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0));
                setGlobalTop(combinedGlobal);

                // Fetch Friends Leaderboard
                const [friendshipsAsRequester, friendshipsAsRecipient] = await Promise.all([
                    Friendship.filter({ requester_email: user.email, status: 'accepted' }),
                    Friendship.filter({ recipient_email: user.email, status: 'accepted' })
                ]);
                
                const friendships = [...(friendshipsAsRequester || []), ...(friendshipsAsRecipient || [])];
                const friendEmails = friendships.map(f => f.requester_email === user.email ? f.recipient_email : f.requester_email);
                friendEmails.push(user.email); // Include self in friends leaderboard

                if (friendEmails.length > 0) {
                    const allProfiles = await UserProfile.list();
                    const allUsers = await User.list();
                    
                    const friendProfiles = allProfiles.filter(p => friendEmails.includes(p.created_by));
                    const friendUsers = allUsers.filter(u => friendEmails.includes(u.email));

                    const combinedFriends = friendUsers.map(fUser => {
                        const fProfile = friendProfiles.find(p => p.created_by === fUser.email);
                        return { ...fUser, ...fProfile };
                    }).sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0));
                    setFriends(combinedFriends);
                }

            } catch (error) {
                console.error("Error loading leaderboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="animate-pulse space-y-3">
                        <div className="h-10 bg-gray-200 rounded-lg w-1/3"></div>
                        <div className="h-16 bg-gray-200 rounded-lg"></div>
                        <div className="h-16 bg-gray-200 rounded-lg"></div>
                        <div className="h-16 bg-gray-200 rounded-lg"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Leaderboards</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="friends">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="friends">
                            <Users className="w-4 h-4 mr-2" /> Friends
                        </TabsTrigger>
                        <TabsTrigger value="global">
                            <Globe className="w-4 h-4 mr-2" /> Global
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="friends" className="mt-6">
                        {friends.length > 0 ? (
                            <LeaderboardList users={friends} currentUserEmail={currentUser?.email} />
                        ) : (
                            <p className="text-center text-gray-500 py-8">Add some friends to see their rank!</p>
                        )}
                    </TabsContent>
                    <TabsContent value="global" className="mt-6">
                        <LeaderboardList users={globalTop} currentUserEmail={currentUser?.email} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}