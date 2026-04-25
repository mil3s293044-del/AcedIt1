import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, UserPlus, Users, Check, X } from "lucide-react";
import { User, Friendship } from "@/entities/all";
import { useToast } from "@/components/ui/use-toast";

export default function FriendshipManager() {
    const [currentUser, setCurrentUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [sentRequests, setSentRequests] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const loadData = async () => {
            try {
                const user = await User.me();
                setCurrentUser(user);
                loadFriendships(user);
            } catch (error) {
                console.error("User not logged in", error);
            }
        };
        loadData();
    }, []);

    const loadFriendships = async (user) => {
        const [asRequester, asRecipient] = await Promise.all([
            Friendship.filter({ requester_email: user.email }),
            Friendship.filter({ recipient_email: user.email })
        ]);
        
        const friendships = [...(asRequester || []), ...(asRecipient || [])];
        
        setFriends(friendships.filter(f => f.status === 'accepted'));
        setRequests(friendships.filter(f => f.status === 'pending' && f.recipient_email === user.email));
        setSentRequests(friendships.filter(f => f.status === 'pending' && f.requester_email === user.email));
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;
        setIsSearching(true);
        try {
            const allUsers = await User.list();
            const results = allUsers.filter(u => 
                u.email !== currentUser.email &&
                u.full_name.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setSearchResults(results);
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddFriend = async (recipient) => {
        try {
            await Friendship.create({
                requester_email: currentUser.email,
                requester_name: currentUser.full_name,
                recipient_email: recipient.email,
                recipient_name: recipient.full_name,
                status: 'pending'
            });
            toast({ title: "Request Sent!", description: `Friend request sent to ${recipient.full_name}.` });
            loadFriendships(currentUser);
        } catch (error) {
            toast({ title: "Error", description: "Could not send friend request.", variant: "destructive" });
        }
    };

    const handleRequest = async (request, newStatus) => {
        try {
            await Friendship.update(request.id, { status: newStatus });
            toast({ title: "Request Updated", description: `You have ${newStatus} the request.` });
            loadFriendships(currentUser);
        } catch (error) {
            toast({ title: "Error", description: "Could not update request.", variant: "destructive" });
        }
    };
    
    const getFriendName = (friendship) => {
        return friendship.requester_email === currentUser.email ? friendship.recipient_name : friendship.requester_name;
    }

    const isFriendOrPending = (userEmail) => {
        const allRelated = [...friends, ...requests, ...sentRequests];
        return allRelated.some(f => 
            f.requester_email === userEmail || f.recipient_email === userEmail
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Manage Friends</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="my-friends">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="my-friends"><Users className="w-4 h-4 mr-2" />My Friends</TabsTrigger>
                        <TabsTrigger value="requests">
                            <UserPlus className="w-4 h-4 mr-2" />Requests
                            {requests.length > 0 && <span className="ml-2 bg-blue-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">{requests.length}</span>}
                        </TabsTrigger>
                        <TabsTrigger value="find"><Search className="w-4 h-4 mr-2" />Find</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="my-friends" className="mt-6">
                        <h3 className="font-semibold mb-4">Your Friends ({friends.length})</h3>
                        <div className="space-y-2">
                            {friends.length > 0 ? friends.map(f => (
                                <div key={f.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="font-medium">{getFriendName(f)}</span>
                                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleRequest(f, 'declined')}>Remove</Button>
                                </div>
                            )) : <p className="text-center text-gray-500 py-4">You have no friends yet.</p>}
                        </div>
                    </TabsContent>

                    <TabsContent value="requests" className="mt-6">
                        <h3 className="font-semibold mb-4">Incoming Requests ({requests.length})</h3>
                        <div className="space-y-2">
                            {requests.length > 0 ? requests.map(req => (
                                <div key={req.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="font-medium">{req.requester_name}</span>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => handleRequest(req, 'accepted')}><Check className="w-4 h-4 mr-1"/>Accept</Button>
                                        <Button size="sm" variant="outline" onClick={() => handleRequest(req, 'declined')}><X className="w-4 h-4 mr-1"/>Decline</Button>
                                    </div>
                                </div>
                            )) : <p className="text-center text-gray-500 py-4">No new friend requests.</p>}
                        </div>
                    </TabsContent>

                    <TabsContent value="find" className="mt-6">
                        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                            <Input 
                                placeholder="Search for users by name..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <Button type="submit" disabled={isSearching}>
                                {isSearching ? "..." : <Search className="w-4 h-4" />}
                            </Button>
                        </form>
                        <div className="space-y-2">
                            {searchResults.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="font-medium">{user.full_name} ({user.email})</span>
                                    <Button 
                                        size="sm"
                                        disabled={isFriendOrPending(user.email)}
                                        onClick={() => handleAddFriend(user)}
                                    >
                                        {isFriendOrPending(user.email) ? 'Pending/Added' : 'Add Friend'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}