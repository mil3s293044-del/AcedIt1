/**
 * GroupRoom — one study group, as its members see it.
 *
 * Three questions, in the order they get asked: how is everybody going this
 * week (it LEADS — see GroupWeek), what has the group shared, and what are
 * people saying. A component rather than part of the page so the probe can
 * draw it against fixture rows, because the page itself is auth-gated.
 *
 * It holds no data and makes no calls: the page hands it `getGroup`'s payload
 * and the handlers, which is what keeps every write on the one path through
 * `groupsApi`.
 */
import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { colorFor } from "@/components/cards/cardIdentity";
import GroupWeek from "@/components/groups/GroupWeek";
import GroupShelf from "@/components/groups/GroupShelf";
import GroupCalls from "@/components/groups/GroupCalls";

export default function GroupRoom({
    data, todayIso, soonDays, working,
    onInvite, onMembers, onShare, onPhrase, onImport, onReact, onRemoveItem, onToggleSacs,
}) {
    const g = data?.group;
    if (!g) return null;
    return (
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-7 lg:space-y-9">
            <header className="space-y-4" data-group-block="head">
                <Link to={createPageUrl("StudyGroups")}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-4 h-4" /> All groups
                </Link>
                <div className="flex items-start gap-4">
                    <span className="w-1.5 self-stretch rounded-full flex-shrink-0"
                        style={{ background: g.subject ? colorFor(g.subject) : "hsl(var(--border))" }} aria-hidden />
                    <div className="min-w-0 flex-1">
                        <p className="stat-label text-chart-3 mb-1.5">{g.subject || "Study group"}</p>
                        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1] break-words">
                            {g.name}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1.5">
                            {g.member_count} of {g.max_members} members{g.owner ? " · you started it" : ""}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={onInvite} className="gap-1.5 flex-1 sm:flex-none">
                        <UserPlus className="w-4 h-4" /> Invite
                    </Button>
                    <Button variant="outline" onClick={onMembers} className="gap-1.5 flex-1 sm:flex-none">
                        <Users className="w-4 h-4" /> Members
                    </Button>
                </div>
            </header>

            <GroupWeek week={data.week} sacs={data.sacs} sharingSacs={data.sharing_sacs}
                todayIso={todayIso} soonDays={soonDays} working={working === "sacs"} onToggleSacs={onToggleSacs} />

            <div className="grid gap-7 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
                <GroupShelf shelf={data.shelf} owner={g.owner} working={working}
                    onShare={onShare} onImport={onImport} onReact={onReact} onRemove={onRemoveItem} />
                <GroupCalls feed={data.feed} phrases={data.phrases} working={working} onPhrase={onPhrase} />
            </div>
        </div>
    );
}
