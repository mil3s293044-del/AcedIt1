/**
 * AI Tools — one chatbot, eight personas, laid out like a first-class chat
 * app: the conversation IS the page (full viewport height, no card chrome),
 * history lives behind a "View chats" pill, and the composer is a single
 * rounded surface pinned to the bottom. Every send still carries the tool's
 * tier feature tag so all caps apply unchanged.
 */
import React from "react";
import RequirePremium from "@/components/shared/RequirePremium";
import UnifiedChat from "@/components/ai_tools/UnifiedChat";

function AIToolsInner() {
    // Fixed viewport column: 100dvh minus the 48px top nav (desktop) and the
    // additional ~80px bottom tab bar on mobile. This is what kills the dead
    // space below the thread — the chat always fills exactly the screen.
    return (
        <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-3rem)] bg-background">
            <div className="h-full max-w-7xl mx-auto px-2 lg:px-4 py-3 flex flex-col min-h-0">
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
