/**
 * Friends — the people you study with, on one page.
 *
 * ─── FIVE TABS AND FOUR ANNOUNCEMENTS OF THE SAME REQUEST ───────────────────
 * It was a coach line, a "crew" hero with a giant friend count, an inbox panel,
 * a "Today on Friends" featured panel and then five tabs — Friends, Ladder,
 * Requests, Shared, Sent. A single pending request was announced in the
 * headline, the inbox panel, the featured panel AND the tab badge, while the
 * friends themselves were rows saying nothing about the friend at all (a
 * `streak_days: 0` placeholder that was never filled). Remove sat behind a
 * hover, so on a phone it did not exist. And Ladder was a second leaderboard
 * beside Ranked's own Friends board.
 *
 * Now it reads top to bottom as the questions get asked:
 *
 *   1. What is waiting on me — requests and shares, only when there are any,
 *      each with its action on the row.
 *   2. How to add someone — your code and link, and a box for theirs. It
 *      sits ABOVE the list: the code is what a student opens this page to
 *      find or hand over, and below a long list of friends it was a scroll
 *      away on exactly the visit that needed it.
 *   3. My people — a row per friend with their streak and rank, and the two
 *      things you can do with a friend (share, remove) visible.
 *
 * ─── THE WRITES ARE THE SERVER'S ────────────────────────────────────────────
 * Every friendship and share goes through `friendsApi` (see src/lib/friends.js
 * for why: the browser could accept its own request). Nothing here holds
 * another student's email; a friend is a name and a friendship id.
 *
 * `?add=ACE-XXXXX` is the friend link. Opening it looks the code up and asks
 * "add <name>?" — it never sends anything on arrival, because a link can be
 * forwarded and a request should be something the student chose to send.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    UserPlus, Check, X, Copy, Share2, Flame, FileText, Layers, Sparkles, MoreHorizontal, Trophy, Send, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { base44 } from "@/api/base44Client";
import {
    getFriends, lookupFriendCode, requestFriend, respondFriend, cancelFriend, removeFriend, shareWithFriends,
} from "@/api/friendsApi";
import { importedDeck, importDeckId } from "@/lib/sharedDeck";
import { saveResult } from "@/lib/saveResult";
import { deckCards } from "@/lib/mistakeBank";
import { SHARE_NOTES, shownNote, friendLink, normaliseFriendCode } from "@/lib/friends";
import { takePendingFriend } from "@/lib/pendingFriend";
import { XP_RANKS } from "@/lib/xpRanks";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import HelpButton from "@/components/shared/HelpButton";
import AceSpot, { useAceCue } from "@/components/ace/AceSpot";
import AceShuffle from "@/components/ace/AceShuffle";
import Band from "@/components/shared/Band";
import Avatar from "@/components/shared/InitialAvatar";

const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const SHARE_ENTITY = { quiz: "SharedQuiz", deck: "SharedFlashcard", result: "SharedAIResult" };
const SHARE_WORD = { quiz: "a quiz", deck: "a deck", result: "a saved AI result" };

const rankName = (tier) => XP_RANKS[Math.max(0, Math.min(XP_RANKS.length - 1, (tier || 1) - 1))]?.name || null;

/**
 * The headline says ONE thing — the first that is true of: somebody waiting on
 * you, something shared with you, nobody added yet, and otherwise the friend
 * with the longest streak, which is a fact about a person rather than a pep
 * talk. Said once, so nothing below it has to say it again.
 */
function headline({ incoming, shared, friends }) {
    if (incoming.length === 1) return `${incoming[0].name} wants to be friends`;
    if (incoming.length > 1) return `${incoming.length} people want to be friends`;
    if (shared.length === 1) return `${shared[0].from} sent you ${SHARE_WORD[shared[0].kind]}`;
    if (shared.length > 1) return `${shared.length} things shared with you`;
    if (!friends.length) return "Study with people you know";
    const top = [...friends].sort((a, b) => b.streak_days - a.streak_days)[0];
    if (top?.streak_days >= 2) return `${top.name} is on a ${top.streak_days}-day streak`;
    return `${friends.length} friend${friends.length === 1 ? "" : "s"}`;
}

export default function Friends() {
    const { toast } = useToast();
    // What Ace in the empty list sees: a link copied, a request sent.
    const ace = useAceCue();
    const location = useLocation();
    const navigate = useNavigate();

    const [me, setMe] = useState(null);
    const [data, setData] = useState({ code: null, friends: [], incoming: [], outgoing: [] });
    const [shares, setShares] = useState({ quizzes: [], decks: [], results: [] });
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(null);      // id of the row mid-action

    const [addInput, setAddInput] = useState("");
    const [linkInvite, setLinkInvite] = useState(null); // { code, state, name, id }
    const [removing, setRemoving] = useState(null);
    const [sharingTo, setSharingTo] = useState(null);

    const load = useCallback(async () => {
        try {
            const user = await base44.auth.me();
            setMe(user);
            const fail = () => [];
            const [friendsRes, quizzes, decks, results] = await Promise.all([
                getFriends().catch(() => null),
                base44.entities.SharedQuiz.filter({ shared_with_email: user.email, status: "pending" }).catch(fail),
                base44.entities.SharedFlashcard.filter({ shared_with_email: user.email, status: "pending" }).catch(fail),
                // Received AI results were written and then shown NOWHERE — a
                // share that arrived into a void. They are on this page now.
                base44.entities.SharedAIResult.filter({ shared_with_email: user.email, status: "pending" }).catch(fail),
            ]);
            if (friendsRes) setData({ code: friendsRes.code, friends: friendsRes.friends || [], incoming: friendsRes.incoming || [], outgoing: friendsRes.outgoing || [] });
            setShares({ quizzes: quizzes || [], decks: decks || [], results: results || [] });
        } catch (err) {
            console.error("Friends load error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // ─── The friend link ─────────────────────────────────────────────────
    const addParam = useMemo(() => new URLSearchParams(location.search).get("add"), [location.search]);
    useEffect(() => {
        if (!addParam) return;
        // The link is being answered HERE, so a copy kept across a sign-in
        // must not bring the student back to it a second time.
        takePendingFriend();
        let cancelled = false;
        const code = normaliseFriendCode(addParam);
        if (!code) { setLinkInvite({ code: addParam, state: "bad" }); return; }
        lookupFriendCode(code)
            .then((r) => { if (!cancelled) setLinkInvite({ code, state: r?.state, name: r?.name, id: r?.id }); })
            .catch((e) => { if (!cancelled) setLinkInvite({ code, state: "error", error: e.message }); });
        return () => { cancelled = true; };
    }, [addParam]);
    const closeInvite = () => {
        setLinkInvite(null);
        navigate(createPageUrl("Friends"), { replace: true });
    };

    // ─── Actions ─────────────────────────────────────────────────────────
    const run = async (id, fn, okTitle) => {
        setWorking(id);
        try {
            const out = await fn();
            if (okTitle) toast({ title: typeof okTitle === "function" ? okTitle(out) : okTitle });
            await load();
            return out;
        } catch (e) {
            toast({ title: e.message || "That didn't go through.", variant: "destructive" });
            return null;
        } finally {
            setWorking(null);
        }
    };

    const sentTitle = (out) => out?.state === "accepted" ? `You're friends with ${out?.name || "them"} now`
        : out?.state === "friends" ? "You're already friends"
            : out?.name ? `Request sent to ${out.name}` : "Request sent";

    const addFromInput = async (e) => {
        e?.preventDefault();
        const raw = addInput.trim();
        if (!raw) return;
        const code = normaliseFriendCode(raw);
        const by = code ? { code } : raw.includes("@") ? { email: raw.toLowerCase() } : null;
        if (!by) {
            toast({ title: "That isn't a code or an email", description: "Codes look like ACE-7KQ2X.", variant: "destructive" });
            return;
        }
        const out = await run("add", () => requestFriend(by), sentTitle);
        if (out) { setAddInput(""); ace.react("added"); }
    };

    const link = data.code ? friendLink(data.code, window.location.origin) : null;
    const copyLink = async () => {
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link);
            toast({ title: "Link copied", description: "Send it to a friend. Opening it lets them send you a request." });
            ace.react("copied");
        } catch {
            toast({ title: "Couldn't copy", description: link });
        }
    };
    const shareLink = async () => {
        if (!link) return;
        if (navigator.share) {
            try { await navigator.share({ title: "Add me on AcedIt", text: `My AcedIt code is ${data.code}`, url: link }); return; }
            catch { /* dismissed — fall through to copying */ }
        }
        copyLink();
    };

    const acceptQuiz = (sq) => run(sq.id, async () => {
        const q = sq.quiz_data || {};
        await base44.entities.Quiz.create({ title: q.title, subject: q.subject, questions: q.questions, difficulty: q.difficulty, category: q.category });
        // A shared quiz in a subject you do not study would land with no
        // filter chip to reach it, so the subject is provisioned on the way in.
        if (q.subject) {
            const existing = await base44.entities.UserSubject.filter({ created_by: me.email, subject_name: q.subject });
            if (!existing.length) {
                await base44.entities.UserSubject.create({ subject_name: q.subject, subject_code: q.subject.substring(0, 6).toUpperCase(), color: "#6B7280", is_active: true });
            }
        }
        await base44.entities.SharedQuiz.update(sq.id, { status: "accepted" });
    }, `"${sq.quiz_title}" is in your quizzes`);

    const acceptDeck = (sf) => run(sf.id, async () => {
        // `importedDeck`, never a spread — see src/lib/sharedDeck.js.
        const rows = importedDeck(sf.flashcard_data, importDeckId());
        if (!rows.length) throw new Error("That deck came through empty");
        await base44.entities.Flashcard.bulkCreate(rows);
        await base44.entities.SharedFlashcard.update(sf.id, { status: "accepted" });
        return rows.length;
    }, (n) => `${n} cards added to your shelf`);

    const acceptResult = (sr) => run(sr.id, async () => {
        const saved = await saveResult("create", {
            tool_type: sr.tool_type, title: sr.title, content: sr.content,
            topic: sr.extra?.topic || null, subject_name: sr.extra?.subject_name || null,
        });
        if (!saved?.ok) throw new Error("Couldn't save that to your AI history");
        await base44.entities.SharedAIResult.update(sr.id, { status: "accepted" });
    }, `"${sr.title}" is in your AI history`);

    const decline = (entity, row) => run(row.id, () => base44.entities[entity].update(row.id, { status: "declined" }));

    // ─── What is waiting, as one list ────────────────────────────────────
    // Data only; the handlers are attached where the rows are drawn, so the
    // memo depends on the rows and nothing else.
    const shared = useMemo(() => [
        ...shares.quizzes.map((r) => ({ kind: "quiz", row: r, id: r.id, title: r.quiz_title, from: r.shared_by_name, size: count(r.quiz_data?.questions?.length || 0, "question") })),
        ...shares.decks.map((r) => ({ kind: "deck", row: r, id: r.id, title: r.deck_name, from: r.shared_by_name, size: count(Array.isArray(r.flashcard_data) ? r.flashcard_data.length : 0, "card") })),
        ...shares.results.map((r) => ({ kind: "result", row: r, id: r.id, title: r.title, from: r.shared_by_name, size: "Saved AI result" })),
    ], [shares]);
    const acceptShare = (s) => (s.kind === "quiz" ? acceptQuiz(s.row) : s.kind === "deck" ? acceptDeck(s.row) : acceptResult(s.row));
    const declineShare = (s) => decline(SHARE_ENTITY[s.kind], s.row);

    const waiting = data.incoming.length + shared.length;
    const title = headline({ incoming: data.incoming, shared, friends: data.friends });

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <AceShuffle size="lg" />
            </div>
        );
    }

    const SHARE_ICON = { quiz: FileText, deck: Layers, result: Sparkles };

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6 lg:space-y-8">
                <header className="flex items-start justify-between gap-4" data-friends-block="head">
                    <div className="min-w-0">
                        <p className="stat-label text-chart-3 mb-1.5">Friends</p>
                        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1] text-balance">
                            {title}
                        </h1>
                    </div>
                    <HelpButton page="Friends" />
                </header>

                {/* ── A friend link someone sent you ─────────────────────── */}
                <AnimatePresence>
                    {linkInvite && (
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            data-friends-block="invite"
                            className="card-soft on-table p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 border-2 border-chart-3/40">
                            {linkInvite.name && <Avatar name={linkInvite.name} />}
                            <div className="flex-1 min-w-0">
                                <p className="font-display font-extrabold text-foreground">
                                    {linkInvite.state === "available" ? `Add ${linkInvite.name} as a friend?`
                                        : linkInvite.state === "friends" ? `You're already friends with ${linkInvite.name}`
                                            : linkInvite.state === "pending_out" ? `Your request to ${linkInvite.name} is waiting on them`
                                                : linkInvite.state === "pending_in" ? `${linkInvite.name} already asked to be friends`
                                                    : linkInvite.state === "self" ? "That's your own link"
                                                        : linkInvite.state === "not_found" ? "No one has that code"
                                                            : linkInvite.state === "bad" ? "That link isn't quite right"
                                                                : linkInvite.error || "Checking the link…"}
                                </p>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {linkInvite.state === "available" ? "They'll see your request here and can accept it."
                                        : linkInvite.state === "not_found" || linkInvite.state === "bad" ? "Check the code with the person who sent it."
                                            : `Code ${linkInvite.code}`}
                                </p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                {linkInvite.state === "available" && (
                                    <Button disabled={working === "invite"} className="gap-1.5 flex-1 sm:flex-none"
                                        onClick={async () => { const out = await run("invite", () => requestFriend({ code: linkInvite.code }), sentTitle); if (out) closeInvite(); }}>
                                        {working === "invite" ? <AceShuffle size="sm" /> : <UserPlus className="w-4 h-4" />} Send request
                                    </Button>
                                )}
                                {linkInvite.state === "pending_in" && linkInvite.id && (
                                    <Button disabled={working === "invite"} className="gap-1.5 flex-1 sm:flex-none"
                                        onClick={async () => { const out = await run("invite", () => respondFriend(linkInvite.id, true), `You're friends with ${linkInvite.name} now`); if (out) closeInvite(); }}>
                                        <Check className="w-4 h-4" /> Accept
                                    </Button>
                                )}
                                <Button variant="outline" onClick={closeInvite}>
                                    {linkInvite.state === "available" || linkInvite.state === "pending_in" ? "Not now" : "Close"}
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Waiting on you ─────────────────────────────────────── */}
                {waiting > 0 && (
                    <Band title="Waiting on you" count={waiting}>
                        <div className="space-y-2" data-friends-block="waiting">
                            {data.incoming.map((r) => (
                                <div key={r.id} className="card-soft on-table px-4 py-3 flex items-center gap-3">
                                    <Avatar name={r.name} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-foreground truncate">{r.name}</p>
                                        <p className="text-xs text-muted-foreground">Wants to be friends</p>
                                    </div>
                                    <Button size="sm" disabled={working === r.id} className="gap-1"
                                        onClick={() => run(r.id, () => respondFriend(r.id, true), `You're friends with ${r.name} now`)}>
                                        {working === r.id ? <AceShuffle size="sm" /> : <Check className="w-4 h-4" />} Accept
                                    </Button>
                                    <Button size="sm" variant="ghost" disabled={working === r.id} aria-label={`Decline ${r.name}`}
                                        onClick={() => run(r.id, () => respondFriend(r.id, false))}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                            {shared.map((s) => {
                                const Icon = SHARE_ICON[s.kind];
                                const note = shownNote(s.row.message);
                                return (
                                    <div key={`${s.kind}:${s.id}`} className="card-soft on-table px-4 py-3 flex items-center gap-3">
                                        <span className="w-11 h-11 rounded-2xl bg-chart-4/10 text-chart-4 flex items-center justify-center flex-shrink-0">
                                            <Icon className="w-5 h-5" />
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            {/* Two lines, not one: beside two buttons on a phone a
                                                single truncated line was "Redox — 12…". */}
                                            <p className="font-bold text-foreground leading-snug line-clamp-2 break-words">{s.title}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                From {s.from} · {s.size}{note ? <span className="text-foreground"> · “{note}”</span> : null}
                                            </p>
                                        </div>
                                        <Button size="sm" disabled={working === s.id} className="gap-1" onClick={() => acceptShare(s)}>
                                            {working === s.id ? <AceShuffle size="sm" /> : <Check className="w-4 h-4" />} Add
                                        </Button>
                                        <Button size="sm" variant="ghost" disabled={working === s.id} aria-label="Dismiss" onClick={() => declineShare(s)}>
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </Band>
                )}

                {/* ── Adding someone ─────────────────────────────────────── */}
                <Band title="Add a friend">
                    <div className="grid md:grid-cols-2 gap-3" data-friends-block="add">
                        <div className="card-soft on-table p-4 sm:p-5">
                            <p className="text-xs font-bold text-muted-foreground">Your code</p>
                            <p className="font-display font-black text-3xl tracking-wider text-foreground mt-1 tabular-nums select-all">
                                {data.code || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Only people you give it to can find you.</p>
                            <div className="flex gap-2 mt-3">
                                <Button size="sm" onClick={shareLink} disabled={!link} className="gap-1.5 flex-1 sm:flex-none">
                                    <Share2 className="w-4 h-4" /> Send my link
                                </Button>
                                <Button size="sm" variant="outline" onClick={copyLink} disabled={!link} className="gap-1.5">
                                    <Copy className="w-4 h-4" /> Copy
                                </Button>
                            </div>
                        </div>
                        <form onSubmit={addFromInput} className="card-soft on-table p-4 sm:p-5 flex flex-col">
                            <label htmlFor="friend-add" className="text-xs font-bold text-muted-foreground">Their code, link or email</label>
                            <Input id="friend-add" value={addInput} onChange={(e) => setAddInput(e.target.value)}
                                placeholder="Paste a link, or e.g. ACE-4FH9P" autoComplete="off" spellCheck={false}
                                className="mt-2 font-semibold tracking-wide" />
                            <Button type="submit" size="sm" disabled={!addInput.trim() || working === "add"} className="gap-1.5 mt-3 self-start">
                                {working === "add" ? <AceShuffle size="sm" /> : <UserPlus className="w-4 h-4" />} Send request
                            </Button>
                        </form>
                    </div>
                </Band>

                {/* ── Your friends ───────────────────────────────────────── */}
                <Band title="Your friends" count={data.friends.length || null}
                    aside={data.friends.length > 0 && (
                        <Link to={`${createPageUrl("Ranked")}?tab=board&scope=friends`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground whitespace-nowrap">
                            <Trophy className="w-3.5 h-3.5" /> Where you stand <ArrowRight className="w-3 h-3" />
                        </Link>
                    )}>
                    {data.friends.length === 0 ? (
                        <div className="flex items-center gap-4 py-2" data-friends-block="empty">
                            <AceSpot className="w-16 flex-shrink-0" pose="happy" intro="wave" cue={ace.cue} title="Ace" />
                            <p className="text-sm text-muted-foreground max-w-md">
                                Nobody yet. Send your link above to someone in your class — when they open it they can send you a
                                request, and once you're friends you can share decks and quizzes and see each other on Ranked.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border border-y border-border" data-friends-block="friends">
                            {data.friends.map((f) => (
                                <div key={f.id} className="flex items-center gap-3 py-3">
                                    <Avatar name={f.name} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-foreground truncate">
                                            {f.name}
                                            {f.username && f.username !== f.name && <span className="text-muted-foreground font-medium"> @{f.username}</span>}
                                        </p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-2 min-w-0">
                                            {f.streak_days > 0 && (
                                                <span className="inline-flex items-center gap-0.5 font-bold text-streak whitespace-nowrap">
                                                    <Flame className="w-3.5 h-3.5" /> {f.streak_days}d
                                                </span>
                                            )}
                                            <span className="truncate">{rankName(f.rank_tier)}</span>
                                        </p>
                                    </div>
                                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSharingTo(f)}>
                                        <Share2 className="w-4 h-4" /><span className="hidden sm:inline">Share</span>
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button size="icon" variant="ghost" aria-label={`More for ${f.name}`} className="w-9 h-9">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem className="text-streak focus:text-streak" onSelect={() => setRemoving(f)}>
                                                Remove {f.name}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            ))}
                        </div>
                    )}
                    {data.outgoing.length > 0 && (
                        <div className="pt-1 space-y-1.5" data-friends-block="sent">
                            <p className="text-xs font-bold text-muted-foreground">Waiting on them</p>
                            <div className="flex flex-wrap gap-2">
                                {data.outgoing.map((r) => (
                                    <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary pl-3 pr-1 py-1 text-xs font-bold text-foreground">
                                        <Send className="w-3 h-3 text-muted-foreground" /> {r.name}
                                        <button type="button" disabled={working === r.id} aria-label={`Cancel request to ${r.name}`}
                                            onClick={() => run(r.id, () => cancelFriend(r.id), "Request cancelled")}
                                            className="w-5 h-5 rounded-full hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </Band>
            </div>

            <ShareDialog friend={sharingTo} me={me} onClose={() => setSharingTo(null)} />

            <AlertDialog open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You'll stop seeing each other on the Friends board and can't share with each other. Either of you can
                            send a new request later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { const f = removing; setRemoving(null); run(f.id, () => removeFriend(f.id), `${f.name} removed`); }}>
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

/**
 * Pick what to send one friend, and a note from the fixed list. The quizzes
 * and decks are read when the dialog opens rather than with the page — most
 * visits to Friends share nothing.
 */
function ShareDialog({ friend, me, onClose }) {
    const { toast } = useToast();
    const [kind, setKind] = useState("deck");
    const [quizzes, setQuizzes] = useState(null);
    const [decks, setDecks] = useState(null);
    const [picked, setPicked] = useState(null);
    const [note, setNote] = useState(null);
    const [sending, setSending] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!friend || !me?.email) return;
        setPicked(null); setNote(null); setSearch("");
        let cancelled = false;
        Promise.all([
            base44.entities.Quiz.filter({ created_by: me.email }).catch(() => []),
            base44.entities.Flashcard.filter({ created_by: me.email, is_active: true }).then(deckCards).catch(() => []),
        ]).then(([qs, cards]) => {
            if (cancelled) return;
            setQuizzes((qs || []).map((q) => ({ id: q.id, title: q.title, sub: `${q.subject || "No subject"} · ${count(q.questions?.length || 0, "question")}` })));
            const map = new Map();
            for (const c of cards || []) {
                const subject = c.subject_name || "Other";
                const topic = c.topic || "General";
                const k = `${subject}|${topic}`;
                if (!map.has(k)) map.set(k, { id: k, subject_name: subject, topic, deck_id: c.deck_id || null, n: 0 });
                map.get(k).n += 1;
            }
            setDecks([...map.values()].map((d) => ({ ...d, title: `${d.subject_name} — ${d.topic}`, sub: count(d.n, "card") })));
        });
        return () => { cancelled = true; };
    }, [friend, me]);

    const list = (kind === "deck" ? decks : quizzes) || [];
    const shown = list.filter((x) => !search || x.title.toLowerCase().includes(search.toLowerCase()));
    const item = list.find((x) => x.id === picked);

    const send = async () => {
        if (!item || !friend) return;
        setSending(true);
        try {
            await shareWithFriends(kind === "deck"
                ? { kind, friendship_ids: [friend.id], subject_name: item.subject_name, topic: item.topic, deck_id: item.deck_id, note }
                : { kind, friendship_ids: [friend.id], quiz_id: item.id, note });
            toast({ title: `Sent to ${friend.name}` });
            onClose();
        } catch (e) {
            toast({ title: e.message || "Couldn't share that", variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={!!friend} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-lg max-h-[90vh] flex flex-col rounded-3xl">
                <DialogHeader>
                    <DialogTitle>Share with {friend?.name}</DialogTitle>
                </DialogHeader>
                <div className="flex gap-1.5">
                    {[["deck", "A deck"], ["quiz", "A quiz"]].map(([k, label]) => (
                        <button key={k} type="button" onClick={() => { setKind(k); setPicked(null); }} aria-pressed={kind === k}
                            className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition-colors ${
                                kind === k ? "border-chart-4 bg-chart-4/10 text-chart-4" : "border-border text-muted-foreground hover:text-foreground"}`}>
                            {label}
                        </button>
                    ))}
                </div>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={kind === "deck" ? "Find a deck" : "Find a quiz"} className="h-9" />
                <div className="flex-1 min-h-0 overflow-y-auto max-h-64 -mx-1 px-1 space-y-1">
                    {(kind === "deck" ? decks : quizzes) === null ? (
                        <div className="py-8 flex justify-center"><AceShuffle size="md" /></div>
                    ) : shown.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            {search ? "Nothing matches that." : kind === "deck" ? "You don't have a deck to share yet." : "You don't have a quiz to share yet."}
                        </p>
                    ) : shown.map((x) => (
                        <button key={x.id} type="button" onClick={() => setPicked(x.id)} aria-pressed={picked === x.id}
                            className={`w-full text-left rounded-xl border-2 px-3 py-2 transition-colors ${
                                picked === x.id ? "border-chart-4 bg-chart-4/[0.06]" : "border-transparent hover:bg-secondary"}`}>
                            <span className="block text-sm font-bold text-foreground truncate">{x.title}</span>
                            <span className="block text-xs text-muted-foreground">{x.sub}</span>
                        </button>
                    ))}
                </div>
                <div className="space-y-2 pt-1 border-t border-border">
                    <p className="text-xs font-bold text-muted-foreground pt-2">Add a note (optional)</p>
                    <div className="flex flex-wrap gap-1.5">
                        {SHARE_NOTES.map((n) => (
                            <button key={n.id} type="button" onClick={() => setNote(note === n.id ? null : n.id)} aria-pressed={note === n.id}
                                className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors ${
                                    note === n.id ? "border-chart-4 bg-chart-4/10 text-chart-4" : "border-border text-muted-foreground hover:text-foreground"}`}>
                                {n.text}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex gap-2 pt-1">
                    <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
                    <Button onClick={send} disabled={!item || sending} className="flex-1 gap-1.5">
                        {sending ? <AceShuffle size="sm" /> : <Send className="w-4 h-4" />} Send
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
