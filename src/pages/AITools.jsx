/**
 * AI Tools — the chat, and nothing in front of it.
 *
 * ─── FOUR SHAPES, AND THE CHAT OUTLASTED ALL OF THEM ────────────────────────
 * This page has been a persona dropdown over an empty thread, a BENCH of verbs
 * over a workpiece, a SCAN that diagnosed a pasted paragraph, and a DASHBOARD
 * in front of the chat. Three of those four replaced or fronted the chat, and
 * every time the chat was the half that turned out to be right: it streams, it
 * saves, it bills the right feature through `chatTools.js`, and a conversation
 * is what a student actually wants from an AI tool.
 *
 * So the page IS the chat. What the dashboard was for has not been thrown away
 * — a blank box really does ask for the two hardest parts of the job at once —
 * it has moved into the chat's own empty state (`ChatWelcome`), which is where
 * every chatbot worth copying puts it: composer in the middle, suggestions
 * under it, catalogue below. One screen rather than a lobby and a room, and
 * nothing to navigate back out of.
 *
 * ─── THE PAGE COUNTS, THE CHAT DRAWS ────────────────────────────────────────
 * The direction cards are arithmetic over five tables, and this page was
 * already reading all five for the dashboard. It keeps doing that and hands the
 * RESULT down, so the chat makes no query of its own — a second read of the
 * same rows is the mirror this codebase keeps deleting, and it would be five
 * more round trips before the composer painted.
 *
 * ─── IT IS A ROOM, AND THE ROOM SURVIVED THE REVERT ─────────────────────────
 * `Console` scopes ~15 `--console-*` tokens, which is what makes this page a
 * distinct graphite surface in both themes rather than the dashboard with the
 * chat stuck on it. The chat now renders INSIDE it, so every token it draws
 * with is the room's — see `consoleInk.test.mjs`, which refuses an app
 * ground/ink token anywhere in here because one left behind is a cream patch in
 * a graphite page and renders perfectly until somebody opens it.
 *
 * ─── THE WELCOME IS FREE AND THE TOOLS ARE NOT ──────────────────────────────
 * The whole page used to sit behind a route-level `RequirePremium`, so a free
 * student met a locked door and nothing else. The two halves cost different
 * things: the direction cards are counted off rows the student already owns —
 * no model call, no chips, no money — and they are the most convincing argument
 * this app can make for the tools, because they are about them. The TOOLS are
 * an Anthropic bill. So the page renders for everybody and the COMPOSER is what
 * locks, with every suggestion and every tool going to /Subscription.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import UnifiedChat from "@/components/ai_tools/UnifiedChat";
import Console from "@/components/ai_tools/Console";
import AceShuffle from "@/components/ace/AceShuffle";
import { isPremium } from "@/lib/tierAccess";
import { toolBrief } from "@/lib/toolBrief";
import { toolUsage } from "@/lib/aiChats";
import { loadSavedResults } from "@/lib/saveResult";
import { deckCards, isBankCard } from "@/lib/mistakeBank";
import { isReady, todayISO } from "@/lib/due";

/** A fresh thread, opened on nothing in particular. */
const BLANK = { key: "new", tool: null, subject: "", seed: "", conv: null };

export default function AITools() {
    // `undefined` while it loads, so nothing decides before the profile lands.
    // Defaulting to unlocked would flash a usable composer at a free student
    // and then take it away; defaulting to locked would do the same to somebody
    // who pays. Neither is acceptable, so it waits.
    const [premium, setPremium] = useState(undefined);
    const [rows, setRows] = useState(null);
    const [convs, setConvs] = useState([]);

    /**
     * What the chat is currently opened on.
     *
     * A SUGGESTION OPENS A NEW THREAD, which is why this carries a `key` and
     * the chat is re-keyed on it: the tool, the subject and the seeded prompt
     * are read once on mount, and pressing a second suggestion mid-conversation
     * has to start the second conversation rather than quietly re-pointing the
     * one already on screen at a different persona.
     *
     * `?tool=` is NOT consumed here. `UnifiedChat` reads it inside its own
     * async setup, after the profile resolves, so stripping it from this side
     * would be a race with nothing deciding the winner — and a prop beats the
     * URL there anyway, which is what makes a suggestion override a deep link.
     */
    const [session, setSession] = useState(BLANK);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const u = await base44.auth.me();
                // Each read catches for itself: one unreadable table must not
                // discard the other four and leave the welcome looking like
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

    // UNCAPPED, unlike `recentChats`: four is the length of a list, not the
    // most anybody has ever used a tool. Same rows, same predicate.
    const usage = useMemo(() => toolUsage(convs), [convs]);

    const openCard = useCallback((card) => {
        setSession({
            key: `card:${card.key}`,
            tool: card.tool,
            subject: card.subject || "",
            // THE SEED IS PUT IN THE COMPOSER, NOT SENT. A suggestion that
            // spent a chip on one tap would be the only action in the app that
            // costs a student something they had not read.
            seed: card.seed || "",
            conv: null,
        });
    }, []);

    /**
     * A conversation saved while the chat was open.
     *
     * MERGED, NOT REFETCHED. `UnifiedChat` persists after every completed
     * reply, so re-reading five tables on each turn would be five round trips
     * per message to keep a usage count current. The row it hands over is the
     * row it just wrote — and `{ ...prev, ...row }` keeps the stored timestamp
     * an UPDATE does not carry, which is what `recentChats` sorts on.
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

    // Nothing is decided until the tier is known — see `premium` above. The
    // loader sits inside the room, or the wait is a cream screen that turns
    // graphite, which is a worse arrival than a slightly longer one.
    if (premium === undefined) {
        return (
            <Console>
                <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-3rem)] flex items-center justify-center">
                    <AceShuffle size="lg" />
                </div>
            </Console>
        );
    }

    // A FIXED VIEWPORT COLUMN: 100dvh less the 48px top nav, and the ~80px
    // bottom tab bar as well on a phone. That is what lets the thread scroll
    // inside the page rather than the page scrolling under a composer that has
    // left the screen.
    return (
        <Console>
            <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-3rem)]">
                {/* `px-4` AT EVERY WIDTH, because the lattice behind this is origined
                    at this column's own left edge and a gutter that changes at
                    `lg` would move the grid out from under the content at one
                    breakpoint. See `--lattice-x` in index.css: the two numbers
                    are one decision. */}
                <div className="h-full max-w-7xl mx-auto px-4 py-3 flex flex-col min-h-0">
                    <UnifiedChat
                        key={session.key}
                        locked={!premium}
                        startTool={session.tool}
                        startSubject={session.subject}
                        startSeed={session.seed}
                        startConversation={session.conv}
                        cards={cards}
                        usage={usage}
                        briefLoading={rows === null}
                        onOpenCard={openCard}
                        onSaved={noteSaved}
                    />
                </div>
            </div>
        </Console>
    );
}
