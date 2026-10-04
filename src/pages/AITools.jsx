/**
 * AI Tools — one chatbot, nine personas, laid out like a first-class chat app:
 * the conversation IS the page (full viewport height, no card chrome), history
 * lives behind a "View chats" pill, and the composer is a single rounded
 * surface pinned to the bottom. Every send carries the tool's tier feature tag
 * so all caps apply unchanged.
 *
 * ─── THE BRIEF IS FREE AND THE TOOLS ARE NOT ────────────────────────────────
 * The whole page used to sit behind a route-level `RequirePremium` wrapper, so
 * a free student met a locked door and nothing else. That component had no
 * other caller and is deleted with this change. What is behind that door is now split in two,
 * because only one half costs anything to run:
 *
 *   The DIAGNOSIS is arithmetic over rows the student already owns. It costs no
 *   model call, no chips and no money, it is about THEM, and it is the single
 *   most convincing argument this app can make for the tools — "you have
 *   dropped this criterion three times" lands in a way no feature list does.
 *   Withholding it protects nothing and sells nothing.
 *
 *   The TOOLS are an Anthropic bill, and they stay premium.
 *
 * So the page renders for everybody and the COMPOSER is what locks. A free
 * student reads a real brief about their own work with the tool that fixes each
 * one named, and every card goes to /Subscription rather than nowhere.
 *
 * This also settles a model that disagreed with the product. `TIER_FREE_CAPS`
 * granted free accounts 5 `ai_tool` and 5 `ai_chat` uses that the page gate
 * made unspendable — counters that could never move, which is "collect nothing
 * you don't use" inverted. Those two caps are gone; the gate here is now the
 * only thing deciding, and it says so in one place.
 */
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import UnifiedChat from "@/components/ai_tools/UnifiedChat";
import AceShuffle from "@/components/ace/AceShuffle";
import { isPremium } from "@/lib/tierAccess";

export default function AITools() {
    // `undefined` while it loads, so nothing decides before the profile lands.
    // Defaulting to unlocked would flash a usable composer at a free student
    // and then take it away; defaulting to locked would do the same to somebody
    // who pays. Neither is acceptable, so it waits.
    const [premium, setPremium] = useState(undefined);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const u = await base44.auth.me();
                const rows = await base44.entities.UserProfile.filter({ created_by: u.email });
                if (alive) setPremium(isPremium(rows?.[0] ?? null));
            } catch {
                // A FAILED READ LOCKS. The server refuses the send either way,
                // so an unlocked composer here would only produce a refusal the
                // student cannot act on — the drift tierAccess.js's own header
                // warns about, pointed at the page.
                if (alive) setPremium(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    if (premium === undefined) {
        return (
            <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-3rem)] flex items-center justify-center">
                <AceShuffle size="lg" />
            </div>
        );
    }

    // Fixed viewport column: 100dvh minus the 48px top nav (desktop) and the
    // additional ~80px bottom tab bar on mobile. This is what kills the dead
    // space below the thread — the chat always fills exactly the screen.
    return (
        <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-3rem)] bg-background">
            <div className="h-full max-w-7xl mx-auto px-2 lg:px-4 py-3 flex flex-col min-h-0">
                <UnifiedChat locked={!premium} />
            </div>
        </div>
    );
}
