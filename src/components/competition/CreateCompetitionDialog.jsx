import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Users, X, Loader2, Search, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createGoalCompetition } from "@/api/functionsShim";
import { useToast } from "@/components/ui/use-toast";

export default function CreateCompetitionDialog({ open, onClose, goal, onCreated }) {
    const [friends, setFriends] = useState([]);
    const [selectedEmails, setSelectedEmails] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (open) loadFriends();
    }, [open]);

    const loadFriends = async () => {
        setLoading(true);
        try {
            const user = await base44.auth.me();
            const [asReq, asRec] = await Promise.all([
                base44.entities.Friendship.filter({ requester_email: user.email }),
                base44.entities.Friendship.filter({ recipient_email: user.email })
            ]);
            const accepted = [...(asReq||[]), ...(asRec||[])].filter(f => f.status === 'accepted');
            const friendsList = accepted.map(f => ({
                email: f.requester_email === user.email ? f.recipient_email : f.requester_email,
                name: f.requester_email === user.email ? f.recipient_name : f.requester_name,
            }));
            setFriends(friendsList);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        setCreating(true);
        try {
            const res = await createGoalCompetition({ goal_id: goal.id, invite_emails: selectedEmails });
            toast({ title: "Competition created!", description: `Invited ${selectedEmails.length} friend${selectedEmails.length !== 1 ? 's' : ''}.` });
            onCreated?.(res.data?.competition);
            onClose();
        } catch (e) {
            toast({ title: "Error", description: e.message || "Could not create competition.", variant: "destructive" });
        } finally {
            setCreating(false);
        }
    };

    const filtered = friends.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.email.toLowerCase().includes(search.toLowerCase())
    );

    const toggle = (email) => {
        setSelectedEmails(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        Start Goal Competition
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-indigo-900 mb-1">{goal?.title}</p>
                        <p className="text-xs text-indigo-600">Friends will compete to complete this goal first</p>
                    </div>

                    {goal?.subject_code && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                            <p className="text-xs font-semibold text-indigo-800 mb-1">⏱️ How it works</p>
                            <p className="text-xs text-indigo-700">Participants compete on <strong>{goal.subject_code}</strong> study hours from now until the goal deadline. More hours = more XP per hour earned.</p>
                        </div>
                    )}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="text-xs font-semibold text-amber-800 mb-2">🏆 XP Reward Rates</p>
                        <div className="grid grid-cols-4 gap-1 text-xs text-amber-700 text-center">
                            <div><p className="font-black">🥇 1st</p><p>75 XP/hr</p></div>
                            <div><p className="font-black">🥈 2nd</p><p>50 XP/hr</p></div>
                            <div><p className="font-black">🥉 3rd</p><p>30 XP/hr</p></div>
                            <div><p className="font-black">📚 4th+</p><p>15 XP/hr</p></div>
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Users className="w-4 h-4" /> Invite Friends
                        </p>
                        <div className="relative mb-2">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <Input placeholder="Search friends..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                        </div>
                        <ScrollArea className="h-48 border rounded-xl">
                            {loading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    {friends.length === 0 ? "Add friends first to compete!" : "No matching friends"}
                                </div>
                            ) : (
                                <div className="p-2 space-y-1">
                                    {filtered.map(f => (
                                        <div key={f.email} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => toggle(f.email)}>
                                            <Checkbox checked={selectedEmails.includes(f.email)} onCheckedChange={() => toggle(f.email)} />
                                            <div>
                                                <p className="text-sm font-medium">{f.name}</p>
                                                <p className="text-xs text-gray-500">{f.email}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {selectedEmails.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {selectedEmails.map(e => {
                                const f = friends.find(fr => fr.email === e);
                                return (
                                    <Badge key={e} className="bg-indigo-100 text-indigo-700 gap-1">
                                        {f?.name || e}
                                        <button onClick={() => toggle(e)}><X className="w-3 h-3" /></button>
                                    </Badge>
                                );
                            })}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleCreate}
                        disabled={creating}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600"
                    >
                        {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trophy className="w-4 h-4 mr-2" />}
                        {creating ? 'Creating...' : `Create Competition${selectedEmails.length > 0 ? ` (${selectedEmails.length})` : ''}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}