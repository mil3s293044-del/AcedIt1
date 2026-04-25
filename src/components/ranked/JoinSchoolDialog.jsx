import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { School, Search } from "lucide-react";

const AU_STATES = ["VIC","NSW","QLD","WA","SA","TAS","ACT","NT"];

export default function JoinSchoolDialog({ open, onClose, existingSchools, userProfile, onJoined }) {
    const [mode, setMode] = useState("search"); // "search" | "create"
    const [searchQuery, setSearchQuery] = useState("");
    const [newSchool, setNewSchool] = useState({ school_name: "", state: "VIC", city: "", logo_color: "#6366f1" });
    const [isSaving, setIsSaving] = useState(false);

    const filteredSchools = existingSchools.filter(s =>
        s.school_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleJoinExisting = async (school) => {
        setIsSaving(true);
        try {
            const user = await base44.auth.me();
            // Update user profile with school
            const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
            if (profiles[0]) {
                await base44.entities.UserProfile.update(profiles[0].id, { school_name: school.school_name, school_code: school.school_code });
            }
            // Increment member count
            await base44.entities.SchoolProfile.update(school.id, { member_count: (school.member_count || 0) + 1 });
            onJoined(school.school_name);
        } catch(e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateSchool = async () => {
        if (!newSchool.school_name.trim()) return;
        setIsSaving(true);
        try {
            const user = await base44.auth.me();
            const created = await base44.entities.SchoolProfile.create({
                ...newSchool,
                member_count: 1,
                total_season_xp: 0,
                total_alltime_xp: 0,
            });
            const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
            if (profiles[0]) {
                await base44.entities.UserProfile.update(profiles[0].id, { school_name: newSchool.school_name });
            }
            onJoined(newSchool.school_name);
        } catch(e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <School className="w-5 h-5 text-indigo-600" /> Join or Register Your School
                    </DialogTitle>
                </DialogHeader>

                <div className="flex gap-2 mb-4">
                    <Button variant={mode === "search" ? "default" : "outline"} onClick={() => setMode("search")} size="sm" className="flex-1">
                        Find School
                    </Button>
                    <Button variant={mode === "create" ? "default" : "outline"} onClick={() => setMode("create")} size="sm" className="flex-1">
                        Register New
                    </Button>
                </div>

                {mode === "search" ? (
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input placeholder="Search school name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                        </div>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                            {filteredSchools.length === 0 && (
                                <p className="text-center text-gray-500 text-sm py-6">No schools found. Register yours!</p>
                            )}
                            {filteredSchools.map(school => (
                                <div key={school.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: school.logo_color || "#6366f1" }} />
                                        <div>
                                            <p className="font-semibold text-sm text-gray-900">{school.school_name}</p>
                                            <p className="text-xs text-gray-500">{school.city || school.state} · {school.member_count} members</p>
                                        </div>
                                    </div>
                                    <Button size="sm" onClick={() => handleJoinExisting(school)} disabled={isSaving}>
                                        Join
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <Label>School Name</Label>
                            <Input placeholder="e.g. Melbourne High School" value={newSchool.school_name} onChange={e => setNewSchool(p => ({...p, school_name: e.target.value}))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>State</Label>
                                <Select value={newSchool.state} onValueChange={v => setNewSchool(p => ({...p, state: v}))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {AU_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>City</Label>
                                <Input placeholder="e.g. Melbourne" value={newSchool.city} onChange={e => setNewSchool(p => ({...p, city: e.target.value}))} />
                            </div>
                        </div>
                        <div>
                            <Label>School Colour</Label>
                            <div className="flex items-center gap-3 mt-1">
                                <input type="color" value={newSchool.logo_color} onChange={e => setNewSchool(p => ({...p, logo_color: e.target.value}))} className="w-10 h-10 rounded cursor-pointer border" />
                                <p className="text-sm text-gray-500">This colour represents your school on the leaderboard</p>
                            </div>
                        </div>
                        <Button onClick={handleCreateSchool} disabled={isSaving || !newSchool.school_name.trim()} className="w-full">
                            {isSaving ? "Creating..." : "Register & Join School"}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}