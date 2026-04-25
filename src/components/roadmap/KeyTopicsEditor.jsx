import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X, BookOpen, Brain } from "lucide-react";

const PRIORITY_CYCLE = { High: "Medium", Medium: "Low", Low: "High" };
const PRIORITY_STYLE = {
    High: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200",
    Medium: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200",
    Low: "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200",
};

export default function KeyTopicsEditor({ topics, onChange, loading }) {
    const [inputVal, setInputVal] = useState("");

    const addTopic = () => {
        const name = inputVal.trim();
        if (!name) return;
        if (topics.some(t => t.name.toLowerCase() === name.toLowerCase())) {
            setInputVal("");
            return;
        }
        onChange([...topics, { name, priority: "Medium", has_prior_data: false }]);
        setInputVal("");
    };

    const removeTopic = (index) => {
        onChange(topics.filter((_, i) => i !== index));
    };

    const cyclePriority = (index) => {
        const updated = [...topics];
        updated[index] = { ...updated[index], priority: PRIORITY_CYCLE[updated[index].priority] || "Medium" };
        onChange(updated);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") { e.preventDefault(); addTopic(); }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-xs text-teal-600 bg-teal-50 rounded-lg px-3 py-2.5 mt-1.5">
                <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                Fetching VCAA study design topics for this subject...
            </div>
        );
    }

    return (
        <div className="mt-1.5 space-y-2">
            {/* Topics list */}
            {topics.length > 0 ? (
                <div className="space-y-1.5">
                    {topics.map((topic, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-2">
                            <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-800 font-medium">{topic.name}</span>
                                {topic.has_prior_data && (
                                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-teal-600 bg-teal-50 rounded px-1.5 py-0.5">
                                        <Brain className="w-3 h-3" /> Prior data
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => cyclePriority(i)}
                                className={`text-xs font-semibold px-2 py-0.5 rounded border transition-colors ${PRIORITY_STYLE[topic.priority]}`}
                                title="Click to change priority"
                            >
                                {topic.priority}
                            </button>
                            <button
                                type="button"
                                onClick={() => removeTopic(i)}
                                className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2.5 border border-dashed border-gray-200">
                    <BookOpen className="w-3 h-3 flex-shrink-0" />
                    No topics added yet — add topics manually or select a subject to auto-populate.
                </div>
            )}

            {/* Priority legend */}
            {topics.length > 0 && (
                <p className="text-xs text-gray-400">Click a priority badge to cycle: <span className="text-red-600 font-medium">High</span> → <span className="text-amber-600 font-medium">Medium</span> → <span className="text-gray-500 font-medium">Low</span>. High priority topics appear earlier and get more sessions.</p>
            )}

            {/* Add topic input */}
            <div className="flex gap-2">
                <Input
                    placeholder="Add a key topic (e.g. Covalent Bonds)"
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="text-sm"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTopic} className="flex-shrink-0">
                    <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
            </div>
        </div>
    );
}