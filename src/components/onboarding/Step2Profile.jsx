import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft } from "lucide-react";

export default function Step2Profile({ data, onNext, onBack, saving }) {
    const [display_name, setDisplayName] = useState(data.display_name || "");
    const [school_name, setSchoolName] = useState(data.school_name || "");
    const [year_level, setYearLevel] = useState(data.year_level || "");

    const canProceed = display_name.trim().length > 0 && year_level.length > 0;

    const handleNext = () => {
        onNext({ display_name: display_name.trim(), school_name: school_name.trim(), year_level });
    };

    return (
        <div className="max-w-lg mx-auto px-6 py-10">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground/60 hover:text-muted-foreground mb-6">
                <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="text-2xl font-bold text-foreground mb-1">First, let's personalise your experience</h2>
            <p className="text-muted-foreground text-sm mb-8">This sets up your profile and appears on your dashboard.</p>

            <div className="space-y-6">
                <div>
                    <Label className="text-sm font-medium text-muted-foreground">What should we call you? <span className="text-red-500">*</span></Label>
                    <Input
                        className="mt-1.5"
                        placeholder="e.g. Alex"
                        value={display_name}
                        onChange={e => setDisplayName(e.target.value)}
                    />
                </div>

                <div>
                    <Label className="text-sm font-medium text-muted-foreground">What school do you go to?</Label>
                    <Input
                        className="mt-1.5"
                        placeholder="e.g. Melbourne High School"
                        value={school_name}
                        onChange={e => setSchoolName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground/60 mt-1">Optional — used for school leaderboards</p>
                </div>

                <div>
                    <Label className="text-sm font-medium text-muted-foreground">What year are you in? <span className="text-red-500">*</span></Label>
                    <Select value={year_level} onValueChange={setYearLevel}>
                        <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Select year level" />
                        </SelectTrigger>
                        <SelectContent className="z-[99999]">
                            <SelectItem value="Year 8">Year 8</SelectItem>
                            <SelectItem value="Year 9">Year 9</SelectItem>
                            <SelectItem value="Year 10">Year 10</SelectItem>
                            <SelectItem value="Year 11">Year 11</SelectItem>
                            <SelectItem value="Year 12">Year 12</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Button
                onClick={handleNext}
                disabled={!canProceed || saving}
                className="w-full h-12 text-base font-semibold mt-10"
                
            >
                {saving ? "Saving..." : "Next →"}
            </Button>
        </div>
    );
}