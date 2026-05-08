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
                    <DialogTitle className="font-display font-extrabold text-foreground flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center flex-shrink-0">
                            <School className="w-5 h-5 text-chart-4" />
                        </div>
                        <div>
                            <span className="block text-base">Join or register your school</span>
                            <span className="block text-xs font-medium text-muted-foreground mt-0.5">Connect your XP to a school's leaderboard.</span>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-secondary border border-border">
                    <Button
                        variant={mode === "search" ? "default" : "ghost"}
                        onClick={() => setMode("search")}
                        size="sm"
                        className="rounded-xl font-bold"
                    >
                        Find school
                    </Button>
                    <Button
                        variant={mode === "create" ? "default" : "ghost"}
                        onClick={() => setMode("create")}
                        size="sm"
                        className="rounded-xl font-bold"
                    >
                        Register new
                    </Button>
                </div>

                {mode === "search" ? (
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                            <Input placeholder="Search school name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                        </div>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                            {filteredSchools.length === 0 && (
                                <div className="p-6 text-center rounded-xl bg-secondary/50 border border-border">
                                    <p className="text-muted-foreground text-sm">No schools found. Register yours.</p>
                                </div>
                            )}
                            {filteredSchools.map(school => (
                                <div key={school.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border hover:bg-secondary/40 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: school.logo_color || "hsl(var(--chart-4))" }} />
                                        <div className="min-w-0">
                                            <p className="font-display font-extrabold text-sm text-foreground truncate">{school.school_name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{school.city || school.state} · {school.member_count} members</p>
                                        </div>
                                    </div>
                                    <Button size="sm" onClick={() => handleJoinExisting(school)} disabled={isSaving} className="flex-shrink-0">
                                        Join
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">School name</Label>
                            <Input placeholder="e.g. Melbourne High School" value={newSchool.school_name} onChange={e => setNewSchool(p => ({...p, school_name: e.target.value}))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">State</Label>
                                <Select value={newSchool.state} onValueChange={v => setNewSchool(p => ({...p, state: v}))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {AU_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">City</Label>
                                <Input placeholder="e.g. Melbourne" value={newSchool.city} onChange={e => setNewSchool(p => ({...p, city: e.target.value}))} />
                            </div>
                        </div>
                        <div className="bg-chart-4/5 border-2 border-chart-4/20 rounded-xl p-4">
                            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">School colour</Label>
                            <div className="flex items-center gap-3 mt-2">
                                <input type="color" value={newSchool.logo_color} onChange={e => setNewSchool(p => ({...p, logo_color: e.target.value}))} className="w-10 h-10 rounded-lg cursor-pointer border-2 border-border" />
                                <p className="text-xs text-muted-foreground leading-relaxed">This colour represents your school on the leaderboard.</p>
                            </div>
                        </div>
                        <Button onClick={handleCreateSchool} disabled={isSaving || !newSchool.school_name.trim()} className="w-full">
                            {isSaving ? "Creating..." : "Register & join school"}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
