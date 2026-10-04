/**
 * AI Tools — a dashboard in front of the chat.
 *
 * ─── THE CHAT IS THE SURFACE; IT IS A POOR LANDING ──────────────────────────
 * This page has been a persona dropdown over an empty thread, then a "bench" of
 * verbs over a workpiece, then a scan that diagnosed a pasted paragraph. The
 * last two replaced the chat, and that was the wrong lever: the chat streams,
 * saves, bills the right feature and is what a student actually wants from an
 * AI tool. What was wrong was arriving at it with nothing on screen, which asks
 * for the two hardest parts of the job at once — which tool solves this, and
 * what exactly is wrong.
 *
 * So the chat is back exactly as it was, and `ToolsDashboard` is what the page
 * opens on: what their own work says is worth a tool, the twelve tools grouped
 * by when you reach for one, and the conversations they can carry on.
 *
 * ─── TWO STATES, AND A DEEP LINK SKIPS THE FIRST ────────────────────────────
 * `?tool=` goes straight to the chat, which is what MistakeBank, SubjectHub and
 * every `toolQuery` link already build. Landing them on a dashboard would be
 * the half-wired shape this app keeps meeting: the link arrives on the right
 * page and the thing it promised to open does not open.
 *
 * ─── THE DASHBOARD IS FREE AND THE TOOLS ARE NOT ────────────────────────────
 * The whole page used to sit behind a route-level `RequirePremium`, so a free
 * student met a locked door and nothing else. The two halves cost different
 * things: the direction cards are arithmetic over rows the student already
 * owns — no model call, no chips, no money — and they are the most convincing
 * argument this app can make for the tools, because they are about them. The
 * TOOLS are an Anthropic bill. So the page renders for everybody and the
 * COMPOSER is what locks, with every card and every tool going to
 * /Subscription rather than nowhere.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import UnifiedChat from "@/components/ai_tools/UnifiedChat";
import ToolsDashboard from "@/components/ai_tools/ToolsDashboard";
import AceShuffle from "@/components/ace/AceShuffle";
import { isPremium } from "@/lib/tierAccess";
import { toolBrief } from "@/lib/toolBrief";
import { recentChats } from "@/lib/aiChats";
import { loadSavedResults } from "@/lib/saveResult";
import { deckCards, isBankCard } from "@/lib/mistakeBank";
import { isReady, todayISO } from "@/lib/due";

export default function AITools() {
    // `undefined` while it loads, so nothing decides before the profile lands.
    // Defaulting to unlocked would flash a usable composer at a free student
    // and then take it away; defaulting to locked would do the same to somebody
    // who pays. Neither is acceptable, so it waits.
    const [premium, setPremium] = useState(undefined);
    const [rows, setRows] = useState(null);
    const [convs, setConvs] = useState([]);

    // What the chat is open ON, or null for the dashboard. A deep link decides
    // this before the first paint: `?tool=` is read here as well as inside
    // `UnifiedChat`, because the page has to know which of two screens to draw
    // and the chat has to know which tool to open.
    const [open, setOpen] = useState(() => {
        try {
            const tool = new URLSearchParams(window.location.search).get("tool");
            return tool ? { key: `link:${tool}`, tool, subject: "", seed: "", conv: null } : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const u = await base44.auth.me();
                // Each read catches for itself: one unreadable table must not
                // discard the other four and leave the dashboard looking like
                // an account with no history at all.
                const [profiles, flashcards, attempts, assessments, saved] = await Promise.all([
                    base44.entities.UserProfile.filter({ created_by: u.email }).catch(() => []),
                    base44.entities.Flashcard.filter({ created_by: u.email, is_active: true }).catch(() => []),
                    base44.entities.QuizAttempt.filter({ created_by: u.email }).catch(() => []),
                    base44.entities.SubjectAssessment.filter({ created_by: u.email }).catch(() => []),
                    loadSavedResults(null, u.email).catch(() => []),
                ]);
                if (!alive) return;
                setPremium(isPremium(profiles?.[0] ?? null));
                setConvs(saved || []);
                setRows({
                    // `deckCards` is the filter every DECK surface reads
                    // through, and the mistake bank's own rows are read
                    // SEPARATELY — the repeat card is about those rows, and the
                    // weak-topic and slipping cards are about real decks.
                    cards: deckCards(flashcards || []),
                    bankCards: (flashcards || []).filter(isBankCard),
                    attempts: attempts || [],
                    assessments: assessments || [],
                });
            } catch {
                // A FAILED READ LOCKS. The server refuses the send either way,
                // so an unlocked composer here would only produce a refusal the
                // student cannot act on — the drift tierAccess.js's own header
                // warns about, pointed at the page.
                if (alive) { setPremium(false); setRows({}); }
            }
        })();
        return () => { alive = false; };
    }, []);

    // `isReady` IS PASSED WITH ITS DAY, the way /Review passes it — the
    // point-free form is the arity bug due.js records, which renders perfectly
    // and reports every learned card as due.
    const cards = useMemo(() => {
        if (!rows) return [];
        const today = todayISO();
        return toolBrief({ ...rows, isReady: (c) => isReady(c, today) });
    }, [rows]);

    const recent = useMemo(() => recentChats(convs), [convs]);

    /* ── Opening the chat ───────────────────────────────────────────────── */

    const openCard = useCallback((card) => {
        setOpen({
            key: `card:${card.key}`,
            tool: card.tool,
            subject: card.subject || "",
            // THE SEED IS PUT IN THE COMPOSER, NOT SENT. A card that spent a
            // chip on one tap would be the only action in the app that costs a
            // student something they had not read.
            seed: card.seed || "",
            conv: null,
        });
    }, []);

    const openTool = useCallback((tool) => {
        setOpen({ key: `tool:${tool.id}`, tool: tool.id, subject: "", seed: "", conv: null });
    }, []);

    const openChat = useCallback((item) => {
        setOpen({
            key: `conv:${item.id}`,
            tool: item.tool || null,
            subject: item.subject || "",
            seed: "",
            conv: item.row,
        });
    }, []);

    const leave = useCallback(() => {
        setOpen(null);
        // The link's `?tool=` would otherwise re-open the chat on every return,
        // so the way out of a deep-linked chat would lead straight back into
        // it. Dropped from the URL rather than from state, because a refresh
        // reads the URL again.
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.has("tool") || url.searchParams.has("q") || url.searchParams.has("subject")) {
                url.searchParams.delete("tool");
                url.searchParams.delete("q");
                url.searchParams.delete("subject");
                window.history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
            }
        } catch { /* a browser without history.replaceState keeps the query */ }
    }, []);

    /**
     * A conversation saved while the chat was open.
     *
     * MERGED, NOT REFETCHED. `UnifiedChat` persists after every completed
     * reply, so re-reading five tables on each turn would be five round trips
     * per message to update one list the student cannot currently see. The row
     * it hands over is the row it just wrote, so the Recent list is correct the
     * moment they come back out — and `{ ...prev, ...row }` keeps the stored
     * timestamp an UPDATE does not carry, which is what the list sorts on.
     */
    const noteSaved = useCallback((row) => {
        if (!row?.id) return;
        setConvs((prev) => {
            const id = String(row.id);
            let found = false;
            const next = (prev || []).map((c) => {
                if (String(c?.id) !== id) return c;
                found = true;
                return { ...c, ...row };
            });
            return found ? next : [row, ...next];
        });
    }, []);

    if (premium === undefined) {
        return (
            <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-3rem)] flex items-center justify-center">
                <AceShuffle size="lg" />
            </div>
        );
    }

    // ── THE CHAT TAKES THE WHOLE SCREEN ─────────────────────────────────────
    // Fixed viewport column: 100dvh minus the 48px top nav (desktop) and the
    // additional ~80px bottom tab bar on mobile. This is what kills the dead
    // space below the thread — the chat always fills exactly the screen.
    if (open) {
        return (
            <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-3rem)] bg-background">
                <div className="h-full max-w-7xl mx-auto px-2 lg:px-4 py-3 flex flex-col min-h-0">
                    <UnifiedChat
                        key={open.key}
                        locked={!premium}
                        startTool={open.tool}
                        startSubject={open.subject}
                        startSeed={open.seed}
                        startConversation={open.conv}
                        onSaved={noteSaved}
                        onExit={leave}
                        exitLabel="AI Tools"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100dvh-8rem)] md:min-h-[calc(100dvh-3rem)] bg-background">
            <ToolsDashboard
                cards={cards}
                recent={recent}
                locked={!premium}
                loading={rows === null}
                onOpenCard={openCard}
                onOpenTool={openTool}
                onOpenChat={openChat}
            />
        </div>
    );
}
