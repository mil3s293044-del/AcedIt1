/**
 * AI Tools — one chatbot, eight personas, full-bleed. The chat fills the
 * whole content area (no page gutters); tool + options live in the composer
 * and every send carries the tool's tier feature tag (caps unchanged).
 */
import React from "react";
import { Link } from "react-router-dom";
import { Archive } from "lucide-react";
import RequirePremium from "@/components/shared/RequirePremium";
import UnifiedChat from "@/components/ai_tools/UnifiedChat";

function AIToolsInner() {
    return (
        <div className="bg-background flex flex-col px-2 lg:px-4 pt-2 pb-2 h-[calc(100dvh-8.25rem)] md:h-[calc(100dvh-3.25rem)]">
            <div className="flex items-center justify-between mb-2 px-1 flex-shrink-0">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">AI Tools</span>
                <Link to="/AIToolsHistory"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                    <Archive className="w-3.5 h-3.5" /> Saved results
                </Link>
            </div>
            <div className="flex-1 min-h-0">
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
