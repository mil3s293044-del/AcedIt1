import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Users,
    Plus,
    MessageCircle,
    Share2,
    UserPlus,
    ArrowLeft,
    Copy,
    Check,
    Trash2,
    Crown,
    LogOut
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useParams, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";

import GroupChat from "../components/groups/GroupChat";
import GroupResources from "../components/groups/GroupResources";
import AceShuffle from "@/components/ace/AceShuffle";

export default function StudyGroups() {
    const [user, setUser] = useState(null);
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isJoiningGroup, setIsJoiningGroup] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [copiedCode, setCopiedCode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showInviteFriends, setShowInviteFriends] = useState(false);
    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const { toast } = useToast();
    const params = useParams();
    const navigate = useNavigate();

    const [newGroup, setNewGroup] = useState({
        name: "",
        description: "",
        subject: "",
        is_private: false,
    });

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
                await loadGroups(currentUser.email);
                await loadFriends(currentUser.email);

                if (params.groupId) {
                    const group = await base44.entities.StudyGroup.filter({ id: params.groupId });
                    if (group && group.length > 0) {
                        setSelectedGroup(group[0]);
                    }
                }
            } catch (error) {
                console.error("Error initializing:", error);
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, [params.groupId]);

    const loadGroups = async (userEmail) => {
        try {
            const allGroups = await base44.entities.StudyGroup.filter({ is_active: true });
            
            const userGroups = allGroups.filter(g => 
                g.owner_email === userEmail || g.member_emails?.includes(userEmail)
            );
            
            setGroups(userGroups);
        } catch (error) {
            console.error("Error loading groups:", error);
        }
    };

    const loadFriends = async (userEmail) => {
        try {
            const friendships = await base44.entities.Friendship.filter({
                status: "accepted"
            });
            
            const friendsList = friendships
                .filter(f => f.requester_email === userEmail || f.recipient_email === userEmail)
                .map(f => ({
                    email: f.requester_email === userEmail ? f.recipient_email : f.requester_email,
                    name: f.requester_email === userEmail ? f.recipient_name : f.requester_name,
                    username: f.requester_email === userEmail ? f.recipient_username : f.requester_username
                }));
            
            setFriends(friendsList);
        } catch (error) {
            console.error("Error loading friends:", error);
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroup.name || !newGroup.subject) {
            toast({ title: "Missing fields", description: "Name and subject are required.", variant: "destructive" });
            return;
        }

        const joinCode = Math.random().toString(36).substring(2, 10).toUpperCase();

        try {
            const group = await base44.entities.StudyGroup.create({
                ...newGroup,
                owner_email: user.email,
                owner_name: user.full_name,
                join_code: joinCode,
                member_emails: [user.email],
                member_names: [user.full_name]
            });

            await base44.entities.GroupMessage.create({
                group_id: group.id,
                sender_email: "system",
                sender_name: "System",
                message: `${user.full_name} created the group`,
                message_type: "system",
                timestamp: new Date().toISOString()
            });

            toast({ title: "Study group created! 🎉", description: `Share code: ${joinCode}` });
            setIsCreatingGroup(false);
            setNewGroup({ name: "", description: "", subject: "", is_private: false });
            await loadGroups(user.email);
        } catch (error) {
            console.error("Error creating group:", error);
            toast({ title: "Failed to create group", variant: "destructive" });
        }
    };

    const handleJoinGroup = async () => {
        if (!joinCode) {
            toast({ title: "Enter a code", variant: "destructive" });
            return;
        }

        try {
            const queriedGroups = await base44.entities.StudyGroup.filter({ join_code: joinCode.toUpperCase(), is_active: true });
            if (queriedGroups.length === 0) {
                toast({ title: "Invalid code", description: "No group found with this code.", variant: "destructive" });
                return;
            }

            const group = queriedGroups[0];

            if (group.member_emails?.includes(user.email)) {
                toast({ title: "Already a member", description: `You are already a member of ${group.name}.` });
                setIsJoiningGroup(false);
                setJoinCode("");
                return;
            }

            const updatedMembers = [...(group.member_emails || []), user.email];
            const updatedNames = [...(group.member_names || []), user.full_name];

            await base44.entities.StudyGroup.update(group.id, {
                member_emails: updatedMembers,
                member_names: updatedNames
            });

            await base44.entities.GroupMessage.create({
                group_id: group.id,
                sender_email: "system",
                sender_name: "System",
                message: `${user.full_name} joined the group`,
                message_type: "system",
                timestamp: new Date().toISOString()
            });

            toast({ title: "Joined group!", description: `You're now a member of ${group.name}` });
            setIsJoiningGroup(false);
            setJoinCode("");
            await loadGroups(user.email);
        } catch (error) {
            console.error("Error joining by code:", error);
            toast({ title: "Failed to join", variant: "destructive" });
        }
    };

    const handleInviteFriends = async () => {
        if (!selectedGroup || selectedFriends.length === 0) {
            toast({ title: "No friends selected", description: "Please select at least one friend.", variant: "destructive" });
            return;
        }

        try {
            const existingMemberEmails = new Set(selectedGroup.member_emails || []);
            const newFriendsToAdd = selectedFriends.filter(email => !existingMemberEmails.has(email));

            if (newFriendsToAdd.length === 0) {
                toast({ title: "No new friends to invite", description: "All selected friends are already in the group." });
                return;
            }

            const updatedMembers = [...(selectedGroup.member_emails || []), ...newFriendsToAdd];
            const friendNames = newFriendsToAdd.map(email => 
                friends.find(f => f.email === email)?.name || email
            );
            const updatedNames = [...(selectedGroup.member_names || []), ...friendNames];

            await base44.entities.StudyGroup.update(selectedGroup.id, {
                member_emails: updatedMembers,
                member_names: updatedNames
            });

            const messagePromises = friendNames.map(name => 
                base44.entities.GroupMessage.create({
                    group_id: selectedGroup.id,
                    sender_email: "system",
                    sender_name: "System",
                    message: `${name} was invited and added to the group`,
                    message_type: "system",
                    timestamp: new Date().toISOString()
                })
            );

            await Promise.all(messagePromises);

            toast({ 
                title: "Friends invited! 🎉", 
                description: `Added ${newFriendsToAdd.length} friend${newFriendsToAdd.length > 1 ? 's' : ''} to the group.` 
            });

            setShowInviteFriends(false);
            setSelectedFriends([]);
            await loadGroups(user.email);
            
            const updatedGroupData = await base44.entities.StudyGroup.filter({ id: selectedGroup.id });
            if (updatedGroupData && updatedGroupData.length > 0) {
                setSelectedGroup(updatedGroupData[0]);
            }
        } catch (error) {
            console.error("Error inviting friends:", error);
            toast({ title: "Error", description: "Could not invite friends.", variant: "destructive" });
        }
    };

    const handleLeaveGroup = async (groupId) => {
        if (!confirm(`Are you sure you want to leave this group?`)) return;

        try {
            const group = groups.find(g => g.id === groupId);
            if (!group) {
                console.error("Group not found to leave:", groupId);
                return;
            }

            const updatedMembers = (group.member_emails || []).filter(e => e !== user.email);
            const memberIndex = (group.member_emails || []).indexOf(user.email);
            const updatedNames = (group.member_names || []).filter((_, i) => i !== memberIndex);

            await base44.entities.StudyGroup.update(group.id, {
                member_emails: updatedMembers,
                member_names: updatedNames
            });

            await base44.entities.GroupMessage.create({
                group_id: group.id,
                sender_email: "system",
                sender_name: "System",
                message: `${user.full_name} left the group`,
                message_type: "system",
                timestamp: new Date().toISOString()
            });

            toast({ title: "Left group" });
            setSelectedGroup(null);
            await loadGroups(user.email);
        } catch (error) {
            console.error("Error leaving group:", error);
            toast({ title: "Failed to leave group", variant: "destructive" });
        }
    };

    const handleDeleteGroup = async (groupId) => {
        if (!confirm("Are you sure you want to delete this group? This action cannot be undone.")) return;

        try {
            await base44.entities.StudyGroup.update(groupId, { is_active: false });
            toast({ title: "Group deleted", description: "The study group has been removed." });
            setSelectedGroup(null);
            await loadGroups(user.email);
        } catch (error) {
            console.error("Error deleting group:", error);
            toast({ title: "Error", description: "Could not delete group.", variant: "destructive" });
        }
    };

    const copyJoinCode = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(true);
        toast({ title: "Code copied!" });
        setTimeout(() => setCopiedCode(false), 2000);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <AceShuffle size="lg" className="mb-4 mx-auto" />
                        <p className="text-muted-foreground">Loading study groups...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Group Detail View
    if (selectedGroup) {
        const isOwner = selectedGroup.owner_email === user.email;

        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 p-4 lg:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedGroup(null);
                                navigate(createPageUrl("StudyGroups"));
                            }}
                            className="hover:bg-indigo-50"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Groups
                        </Button>
                        <div className="flex gap-2">
                            {isOwner && (
                                <Button
                                    onClick={() => {
                                        setSelectedFriends([]);
                                        setShowInviteFriends(true);
                                    }}
                                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                                >
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Invite Friends
                                </Button>
                            )}
                            {isOwner ? (
                                <Button
                                    onClick={() => handleDeleteGroup(selectedGroup.id)}
                                    variant="outline"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Group
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => handleLeaveGroup(selectedGroup.id)}
                                    variant="outline"
                                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Leave Group
                                </Button>
                            )}
                        </div>
                    </div>

                    <Card className="shadow-xl border-2 border-indigo-200">
                        <CardHeader className="bg-gradient-to-r from-indigo-500 to-cyan-500 text-white">
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="text-2xl mb-2">{selectedGroup.name}</CardTitle>
                                    <p className="text-indigo-100">{selectedGroup.description}</p>
                                    <div className="flex gap-2 mt-3 flex-wrap">
                                        <Badge className="bg-surface/20 text-white border-white/30">
                                            {selectedGroup.subject}
                                        </Badge>
                                        <Badge className="bg-surface/20 text-white border-white/30">
                                            <Users className="w-3 h-3 mr-1" />
                                            {selectedGroup.member_emails?.length || 0} members
                                        </Badge>
                                        {isOwner && (
                                            <Badge className="bg-yellow-500 text-white">
                                                <Crown className="w-3 h-3 mr-1" />
                                                Owner
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copyJoinCode(selectedGroup.join_code)}
                                        className="bg-surface/20 border-white/30 text-white hover:bg-surface/30"
                                    >
                                        {copiedCode ? (
                                            <>
                                                <Check className="w-4 h-4 mr-2" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4 mr-2" />
                                                {selectedGroup.join_code}
                                            </>
                                        )}
                                    </Button>
                                    <p className="text-xs text-white/80">Share code to invite others</p>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    <Tabs defaultValue="chat" className="space-y-6">
                        <TabsList className="grid w-full grid-cols-2 bg-surface border-2 border-indigo-200">
                            <TabsTrigger value="chat" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Chat
                            </TabsTrigger>
                            <TabsTrigger value="resources" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                                <Share2 className="w-4 h-4 mr-2" />
                                Resources
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="chat">
                            <GroupChat group={selectedGroup} user={user} />
                        </TabsContent>

                        <TabsContent value="resources">
                            <GroupResources group={selectedGroup} user={user} />
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Invite Friends Dialog */}
                <Dialog open={showInviteFriends} onOpenChange={setShowInviteFriends}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <UserPlus className="w-5 h-5" />
                                Invite Friends to {selectedGroup.name}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {friends.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No friends yet.</p>
                                    <p className="text-sm mt-2">Add friends in the Friends tab!</p>
                                </div>
                            ) : (
                                <div>
                                    <Label className="mb-2 block text-sm font-medium">Select friends to invite:</Label>
                                    <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                                        {friends
                                            .filter(friend => !(selectedGroup.member_emails || []).includes(friend.email))
                                            .map(friend => (
                                                <div key={friend.email} className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`friend-${friend.email}`}
                                                        checked={selectedFriends.includes(friend.email)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setSelectedFriends([...selectedFriends, friend.email]);
                                                            } else {
                                                                setSelectedFriends(selectedFriends.filter(e => e !== friend.email));
                                                            }
                                                        }}
                                                    />
                                                    <Label htmlFor={`friend-${friend.email}`} className="flex-1 cursor-pointer">
                                                        <p className="font-medium text-sm">{friend.name}</p>
                                                        <p className="text-xs text-muted-foreground">@{friend.username}</p>
                                                    </Label>
                                                </div>
                                            ))}
                                    </div>
                                    {friends.filter(f => !(selectedGroup.member_emails || []).includes(f.email)).length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-4">All your friends are already in this group!</p>
                                    )}
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => {
                                setShowInviteFriends(false);
                                setSelectedFriends([]);
                            }}>
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleInviteFriends}
                                disabled={selectedFriends.length === 0}
                            >
                                <UserPlus className="w-4 h-4 mr-2" />
                                Invite {selectedFriends.length} friend{selectedFriends.length !== 1 ? 's' : ''}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // Main Groups List View
    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 p-4 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-2">
                        Study Groups 👥
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        Collaborate with peers, share resources, and study together
                    </p>
                </motion.div>

                <div className="flex gap-4 mb-8">
                    <Button
                        onClick={() => setIsCreatingGroup(true)}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Group
                    </Button>
                    <Button
                        onClick={() => setIsJoiningGroup(true)}
                        variant="outline"
                        className="border-indigo-300"
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Join by Code
                    </Button>
                </div>

                {groups.length === 0 ? (
                    <Card className="shadow-lg">
                        <CardContent className="p-12 text-center">
                            <Users className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-foreground mb-2">No groups yet</h3>
                            <p className="text-muted-foreground mb-6">Create or join a study group to get started</p>
                            <Button onClick={() => setIsCreatingGroup(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                                <Plus className="w-4 h-4 mr-2" />
                                Create First Group
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {groups.map((group, index) => (
                            <motion.div
                                key={group.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card
                                    className="cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-indigo-300"
                                    onClick={() => setSelectedGroup(group)}
                                >
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            {group.name}
                                            {group.owner_email === user.email && (
                                                <Crown className="w-4 h-4 text-yellow-500" />
                                            )}
                                        </CardTitle>
                                        <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <Badge className="bg-indigo-100 text-indigo-800">
                                                {group.subject}
                                            </Badge>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Members</span>
                                                <Badge variant="outline">
                                                    {group.member_emails?.length || 0}
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Create Group Dialog */}
                <Dialog open={isCreatingGroup} onOpenChange={setIsCreatingGroup}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Study Group</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <Label className="text-sm font-medium block mb-2">Group Name</Label>
                                <Input
                                    value={newGroup.name}
                                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                                    placeholder="e.g., VCE Math Methods Study Group"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-medium block mb-2">Description</Label>
                                <Textarea
                                    value={newGroup.description}
                                    onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                                    placeholder="What will you study together?"
                                    rows={3}
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-medium block mb-2">Subject</Label>
                                <Input
                                    value={newGroup.subject}
                                    onChange={(e) => setNewGroup({ ...newGroup, subject: e.target.value })}
                                    placeholder="e.g., Mathematics, History, Physics"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreatingGroup(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateGroup} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                                <Plus className="w-4 h-4 mr-2" />
                                Create Group
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Join by Code Dialog */}
                <Dialog open={isJoiningGroup} onOpenChange={setIsJoiningGroup}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Join Study Group</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <Label className="text-sm font-medium block mb-2">Enter Group Code</Label>
                                <Input
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    placeholder="e.g., ABC123"
                                    className="uppercase"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsJoiningGroup(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleJoinGroup}>
                                <UserPlus className="w-4 h-4 mr-2" />
                                Join Group
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}