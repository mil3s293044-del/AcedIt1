/**
 * AI Tools — one chatbot, eight personas. The old tool grid became a unified
 * Claude/ChatGPT-style chat (UnifiedChat): pick the tool in the composer,
 * past conversations live in the left rail foldered by tool, and every send
 * still carries that tool's tier feature tag so all caps apply unchanged.
 */
import React from "react";
import { Link } from "react-router-dom";
import { Archive } from "lucide-react";
import RequirePremium from "@/components/shared/RequirePremium";
import UnifiedChat from "@/components/ai_tools/UnifiedChat";

function AIToolsInner() {
    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-3 lg:px-8 pt-4 pb-3">
                <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-muted-foreground uppercase tracking-wider">AI Tools</span>
                    </div>
                    <Link to="/AIToolsHistory"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                        <Archive className="w-3.5 h-3.5" /> Saved results
                    </Link>
                </div>
                <UnifiedChat />
            </div>
        </div>
    );
}

export default function AITools() {
    return (
        <RequirePremium
            featureName="AI Tools"
            description="The AI study chat (math tutor, English mentor, exam questions, more) is part of Premium. $5/week, cancel anytime."
        >
            <AIToolsInner />
        </RequirePremium>
    );
}
