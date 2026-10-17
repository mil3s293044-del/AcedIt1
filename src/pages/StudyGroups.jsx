/**
 * Study groups — the people you sit with, as a group.
 *
 * ─── WHAT IT WAS ────────────────────────────────────────────────────────────
 * A Base44 page that wrote `study_groups` from the browser, and it had never
 * worked in the way that mattered: a code looked up by somebody not already
 * in the group came back empty, so joining by code failed for every code ever
 * shared. Meanwhile any member could rewrite the group, post as "system", and
 * type free text at other students past a swear-word check that ran in their
 * own browser. src/lib/groups.js has the whole list.
 *
 * ─── WHAT IT IS ─────────────────────────────────────────────────────────────
 * Two screens on one route. The LIST (your groups, a box for a code, a button
 * to start one) and the ROOM (`?g=<id>`), which leads with how everybody is
 * going this week, then the shelf, then the calls. The group rides in the
 * query string for the reason SubjectHub's subject does: `createPageUrl`
 * builds `/PageName`, and a second URL scheme for one page is how routes start
 * disagreeing with the router.
 *
 * `?join=GRP-XXXXXX` is the group link. Opening it looks the code up and
 * ASKS — it never joins on arrival, because a link gets forwarded and joining
 * a group should be something the student chose. A code TYPED into the box is
 * that choice, so it joins straight away.
 *
 * Every read and write goes through `groupsApi`; nothing here holds another
 * student's email.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import {
    getGroups, getGroup, lookupGroupCode, createGroup, joinGroup, leaveGroup, removeGroupMember,
    resetGroupCode, deleteGroup, postGroupPhrase, shareToGroup, importGroupItem, reactToGroupItem,
    removeGroupItem, setGroupSacSharing,
} from "@/api/groupsApi";
import { normaliseGroupCode, minutesLabel } from "@/lib/groups";
import { takePendingGroup } from "@/lib/pendingGroup";
import { SOON_DAYS } from "@/lib/studyQueue";
import { dayKey } from "@/lib/studyLog";
import { useLiveTick } from "@/lib/LiveContext";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { colorFor } from "@/components/cards/cardIdentity";
import Band from "@/components/shared/Band";
import HelpButton from "@/components/shared/HelpButton";
import AceShuffle from "@/components/ace/AceShuffle";
import GroupRoom from "@/components/groups/GroupRoom";
import { InviteDialog, MembersDialog, ShareDialog, CreateDialog } from "@/components/groups/GroupDialogs";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The list's one line: the busiest group's week, or what a group is for. */
function listHeadline(groups) {
    if (!groups.length) return "Study with your class";
    const top = [...groups].sort((a, b) => b.minutes - a.minutes)[0];
    if (top?.minutes > 0) return `${top.name}: ${minutesLabel(top.minutes)} together this week`;
    return groups.length === 1 ? "Your study group" : `${groups.length} study groups`;
}

const INVITE_LINE = {
    available: (i) => `Join ${i.name}?`,
    member: (i) => `You're already in ${i.name}`,
    full: (i) => `${i.name} is full`,
    removed: () => "You can't join this group",
    not_found: () => "No group has that code",
    bad: () => "That link isn't quite right",
};

export default function StudyGroups() {
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const tick = useLiveTick();
    const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const openId = query.get("g");
    const joinParam = query.get("join");

    const [me, setMe] = useState(null);
    const [groups, setGroups] = useState(null);
    const [room, setRoom] = useState(null);           // getGroup payload
    const [roomError, setRoomError] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [working, setWorking] = useState(null);
    const [codeInput, setCodeInput] = useState("");
    const [invite, setInvite] = useState(null);       // a link someone sent
    const [sheet, setSheet] = useState(null);         // invite | members | share | create

    const loadList = useCallback(async () => {
        try {
            const res = await getGroups();
            setGroups(res?.groups || []);
        } catch (e) {
            console.error("[StudyGroups] list:", e);
            setGroups([]);
        }
    }, []);

    const loadRoom = useCallback(async (id, quiet = false) => {
        if (!id) return;
        if (!quiet) { setRoom(null); setRoomError(null); }
        try {
            const res = await getGroup(id);
            setRoom(res);
            setRoomError(null);
        } catch (e) {
            if (!quiet) setRoomError(e.message || "Couldn't load that group.");
        }
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const user = await base44.auth.me();
                setMe(user);
                const subs = await base44.entities.UserSubject.filter({ created_by: user.email, is_active: true }).catch(() => []);
                setSubjects([...new Set((subs || []).map((s) => s.subject_name).filter(Boolean))].sort());
            } catch (e) {
                console.error("[StudyGroups] me:", e);
            }
        })();
        loadList();
    }, [loadList]);

    useEffect(() => { if (openId) loadRoom(openId); else setRoom(null); }, [openId, loadRoom]);

    // The room is live off the poll the app already runs for Compete — calls
    // and shares land without a refresh, and a timer of its own would be a
    // query per student per interval for the same answer.
    useEffect(() => {
        if (!openId || !tick || sheet) return;
        loadRoom(openId, true);
    }, [tick]);

    // ─── The group link ──────────────────────────────────────────────────
    useEffect(() => {
        if (!joinParam) return;
        // Answered HERE, so a copy kept across a sign-in must not bring the
        // student back to it a second time.
        takePendingGroup();
        let cancelled = false;
        const code = normaliseGroupCode(joinParam);
        if (!code) { setInvite({ code: joinParam, state: "bad" }); return; }
        setInvite({ code, state: "checking" });
        lookupGroupCode(code)
            .then((r) => { if (!cancelled) setInvite({ code, ...r }); })
            .catch((e) => { if (!cancelled) setInvite({ code, state: "error", error: e.message }); });
        return () => { cancelled = true; };
    }, [joinParam]);
    const closeInvite = () => {
        setInvite(null);
        navigate(createPageUrl("StudyGroups"), { replace: true });
    };

    // ─── Actions ─────────────────────────────────────────────────────────
    const run = async (key, fn, ok) => {
        setWorking(key);
        try {
            const out = await fn();
            if (ok) toast({ title: typeof ok === "function" ? ok(out) : ok });
            return out ?? true;
        } catch (e) {
            toast({ title: e.message || "That didn't go through.", variant: "destructive" });
            return null;
        } finally {
            setWorking(null);
        }
    };
    const openRoom = (id) => navigate(`${createPageUrl("StudyGroups")}?g=${encodeURIComponent(id)}`);
    const refreshRoom = () => loadRoom(openId, true);

    const join = async (code) => {
        const out = await run("join", () => joinGroup(code),
            (r) => (r?.state === "member" ? "You're already in that group" : `You're in ${r?.name || "the group"}`));
        if (out?.id) { await loadList(); openRoom(out.id); }
        return out;
    };
    const joinFromInput = async (e) => {
        e?.preventDefault();
        const code = normaliseGroupCode(codeInput);
        if (!code) { toast({ title: "That isn't a group code", description: "They look like GRP-7KQ2XM.", variant: "destructive" }); return; }
        if (await join(code)) setCodeInput("");
    };

    const create = async (name, subject) => {
        const out = await run("create", () => createGroup(name, subject), "Group started. Send the code to your class.");
        if (out?.id) { setSheet(null); await loadList(); openRoom(out.id); }
    };

    const g = room?.group;
    const roomActions = {
        onInvite: () => setSheet("invite"),
        onMembers: () => setSheet("members"),
        onShare: () => setSheet("share"),
        onPhrase: async (phrase) => { if (await run("phrase", () => postGroupPhrase(g.id, phrase))) refreshRoom(); },
        onImport: async (item) => {
            const out = await run(item.id, () => importGroupItem(item.id), (r) =>
                r?.state === "already" ? "Already in your library"
                    : r?.kind === "deck" ? `${plural(r.count, "card")} added to your shelf`
                        : r?.kind === "quiz" ? "Added to your quizzes" : "Added to your AI history");
            if (out) refreshRoom();
        },
        onReact: async (item, glyph) => {
            const out = await run(item.id, () => reactToGroupItem(item.id, glyph));
            if (out?.reactions) setRoom((r) => ({ ...r, shelf: r.shelf.map((x) => (x.id === item.id ? { ...x, reactions: out.reactions } : x)) }));
        },
        onRemoveItem: async (item) => { if (await run(item.id, () => removeGroupItem(item.id), "Taken off the shelf")) refreshRoom(); },
        onToggleSacs: async (share) => {
            const out = await run("sacs", () => setGroupSacSharing(g.id, share), share ? "The group can see your SAC dates" : "Your SAC dates are hidden from the group");
            if (out) refreshRoom();
        },
    };

    // ─── The room ────────────────────────────────────────────────────────
    if (openId) {
        if (roomError) {
            return (
                <div className="min-h-screen bg-background">
                    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
                        <p className="font-display text-xl font-extrabold text-foreground">{roomError}</p>
                        <Button variant="outline" onClick={() => navigate(createPageUrl("StudyGroups"))}>All groups</Button>
                    </div>
                </div>
            );
        }
        if (!room) {
            return <div className="min-h-screen bg-background flex items-center justify-center"><AceShuffle size="lg" /></div>;
        }
        return (
            <div className="min-h-screen bg-background">
                <GroupRoom data={room} todayIso={dayKey(new Date())} soonDays={SOON_DAYS} working={working} {...roomActions} />
                <InviteDialog open={sheet === "invite"} onOpenChange={(v) => setSheet(v ? "invite" : null)} group={g} working={working === "code"}
                    onReset={async () => {
                        const out = await run("code", () => resetGroupCode(g.id), "New code made. The old one no longer works.");
                        if (out?.code) setRoom((r) => ({ ...r, group: { ...r.group, code: out.code } }));
                    }} />
                <MembersDialog open={sheet === "members"} onOpenChange={(v) => setSheet(v ? "members" : null)} group={g}
                    members={room.week?.members || []} working={!!working}
                    onRemove={async (m) => { if (await run("member", () => removeGroupMember(g.id, m.id), `${m.name} is out of the group`)) refreshRoom(); }}
                    onLeave={async () => {
                        if (await run("leave", () => leaveGroup(g.id), `You left ${g.name}`)) { setSheet(null); await loadList(); navigate(createPageUrl("StudyGroups")); }
                    }}
                    onDelete={async () => {
                        if (await run("delete", () => deleteGroup(g.id), `${g.name} is deleted`)) { setSheet(null); await loadList(); navigate(createPageUrl("StudyGroups")); }
                    }} />
                <ShareDialog open={sheet === "share"} onOpenChange={(v) => setSheet(v ? "share" : null)} groupName={g.name}
                    me={me?.email} working={working === "share"}
                    onShare={async (payload) => {
                        if (await run("share", () => shareToGroup([g.id], payload), "On the shelf")) { setSheet(null); refreshRoom(); }
                    }} />
            </div>
        );
    }

    // ─── The list ────────────────────────────────────────────────────────
    if (!groups) {
        return <div className="min-h-screen bg-background flex items-center justify-center"><AceShuffle size="lg" /></div>;
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6 lg:space-y-8">
                <header className="flex items-start justify-between gap-4" data-group-block="list-head">
                    <div className="min-w-0">
                        <p className="stat-label text-chart-3 mb-1.5">Study groups</p>
                        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1] text-balance">
                            {listHeadline(groups)}
                        </h1>
                    </div>
                    <HelpButton page="StudyGroups" />
                </header>

                {/* ── A group link someone sent you ──────────────────────── */}
                <AnimatePresence>
                    {invite && (
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            data-group-block="invite"
                            className="card-soft on-table p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 border-2 border-chart-3/40">
                            <span className="w-11 h-11 rounded-2xl bg-chart-3/15 text-chart-3 flex items-center justify-center flex-shrink-0" aria-hidden>
                                <Users className="w-5 h-5" />
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="font-display font-extrabold text-foreground break-words">
                                    {(INVITE_LINE[invite.state] || (() => invite.error || "Checking the link…"))(invite)}
                                </p>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {invite.state === "available" || invite.state === "member"
                                        ? [invite.subject, plural(invite.members || 0, "member"), invite.owner_name && `started by ${invite.owner_name}`].filter(Boolean).join(" · ")
                                        : invite.state === "not_found" || invite.state === "bad" ? "Check the code with whoever sent it."
                                            : invite.state === "full" ? "Ask whoever started it to make room."
                                                : `Code ${invite.code}`}
                                </p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                {invite.state === "available" && (
                                    <Button disabled={working === "join"} className="flex-1 sm:flex-none"
                                        onClick={async () => { if (await join(invite.code)) setInvite(null); }}>
                                        {working === "join" ? "Joining…" : "Join"}
                                    </Button>
                                )}
                                {invite.state === "member" && invite.id && (
                                    <Button className="flex-1 sm:flex-none" onClick={() => { setInvite(null); openRoom(invite.id); }}>Open it</Button>
                                )}
                                <Button variant="outline" className="flex-1 sm:flex-none" onClick={closeInvite}>
                                    {invite.state === "available" ? "Not now" : "Close"}
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Join or start ───────────────────────────────────────── */}
                <Band title="Join or start one">
                    <div className="card-soft on-table p-4 sm:p-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" data-group-block="join">
                        <form onSubmit={joinFromInput} className="min-w-0">
                            <label htmlFor="group-code" className="text-sm font-bold text-foreground block mb-1.5">Got a code?</label>
                            <div className="flex gap-2">
                                <Input id="group-code" value={codeInput} onChange={(e) => setCodeInput(e.target.value)}
                                    placeholder="GRP-7KQ2XM" autoCapitalize="characters" autoComplete="off" spellCheck={false}
                                    className="font-display tracking-wider uppercase" />
                                <Button type="submit" disabled={!codeInput.trim() || working === "join"} className="flex-shrink-0">
                                    {working === "join" ? "Joining…" : "Join"}
                                </Button>
                            </div>
                        </form>
                        <div className="flex items-center gap-3 sm:border-l sm:border-border sm:pl-4">
                            <span className="text-sm text-muted-foreground sm:hidden flex-1">Or make one for your class</span>
                            <Button variant="outline" className="gap-1.5 flex-shrink-0" onClick={() => setSheet("create")}>
                                <Plus className="w-4 h-4" /> Start a group
                            </Button>
                        </div>
                    </div>
                    {groups.length === 0 && (
                        <p className="text-sm text-muted-foreground max-w-prose">
                            A group shows who's been studying this week, keeps a shelf of decks and quizzes anyone can add in one tap,
                            and has quick calls like “Phones down, 25 minutes?” instead of a chat.
                        </p>
                    )}
                </Band>

                {/* ── Your groups ─────────────────────────────────────────── */}
                {groups.length > 0 && (
                    <Band title="Your groups" count={groups.length}>
                        <ul className="space-y-2.5" data-group-block="list">
                            {groups.map((gr) => (
                                <li key={gr.id}>
                                    <button type="button" onClick={() => openRoom(gr.id)}
                                        className="card-soft on-table w-full text-left flex items-stretch overflow-hidden hover:border-primary/40 transition-colors">
                                        <span className="w-1.5 flex-shrink-0" style={{ background: gr.subject ? colorFor(gr.subject) : "hsl(var(--border))" }} aria-hidden />
                                        <span className="flex-1 min-w-0 flex items-center gap-3 p-4">
                                            <span className="min-w-0 flex-1">
                                                <span className="block font-display font-extrabold text-foreground break-words">{gr.name}</span>
                                                <span className="block text-xs text-muted-foreground mt-0.5">
                                                    {[gr.subject, plural(gr.members, "member"), gr.owner && "yours"].filter(Boolean).join(" · ")}
                                                </span>
                                            </span>
                                            <span className="text-right flex-shrink-0">
                                                {gr.minutes > 0 ? (
                                                    <>
                                                        <span className="block font-display font-extrabold text-foreground tabular-nums">{minutesLabel(gr.minutes)}</span>
                                                        <span className="block text-xs text-muted-foreground">{gr.studied} of {gr.members} this week</span>
                                                    </>
                                                ) : (
                                                    <span className="block text-xs text-muted-foreground">Quiet this week</span>
                                                )}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden />
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Band>
                )}
            </div>

            <CreateDialog open={sheet === "create"} onOpenChange={(v) => setSheet(v ? "create" : null)}
                subjects={subjects} working={working === "create"} onCreate={create} />
        </div>
    );
}
