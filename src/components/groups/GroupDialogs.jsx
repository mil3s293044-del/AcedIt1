/**
 * The four sheets a group opens: invite, members, share, start one.
 *
 * Nothing in here writes anything itself — every action is a handler the page
 * passes in, so every write still goes through `groupsApi` and the server.
 * Every destructive act asks first, in the app's own dialog rather than a
 * native `confirm()` a phone renders as a system alert.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Copy, Share2, RefreshCw, Crown, Layers, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { base44 } from "@/api/base44Client";
import { deckCards } from "@/lib/mistakeBank";
import { groupLink, GROUP_NAME_MAX, cleanGroupName } from "@/lib/groups";
import InitialAvatar from "@/components/shared/InitialAvatar";
import AceShuffle from "@/components/ace/AceShuffle";
import { useToast } from "@/components/ui/use-toast";

// ─── Invite ──────────────────────────────────────────────────────────────────

export function InviteDialog({ open, onOpenChange, group, working, onReset }) {
    const { toast } = useToast();
    const [confirmReset, setConfirmReset] = useState(false);
    if (!group) return null;
    const link = groupLink(group.code, typeof window === "undefined" ? "" : window.location.origin);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            toast({ title: "Link copied", description: "Opening it asks them to join — it never adds anybody on its own." });
        } catch {
            toast({ title: "Couldn't copy", description: link });
        }
    };
    const share = async () => {
        if (navigator.share) {
            try { await navigator.share({ title: `Join ${group.name} on AcedIt`, text: `Our study group code is ${group.code}`, url: link }); return; }
            catch { /* dismissed — fall through to copying */ }
        }
        copy();
    };
    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Invite to {group.name}</DialogTitle>
                        <DialogDescription>Anyone with the code or the link can ask to join. Opening the link asks first.</DialogDescription>
                    </DialogHeader>
                    <div className="rounded-2xl bg-secondary/60 px-4 py-5 text-center">
                        <p className="stat-label text-muted-foreground mb-1">Group code</p>
                        <p className="font-display text-3xl font-extrabold tracking-[0.12em] text-foreground select-all" data-group-code>{group.code}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button className="flex-1 gap-1.5" onClick={share}><Share2 className="w-4 h-4" /> Send the link</Button>
                        <Button variant="outline" className="gap-1.5" onClick={copy}><Copy className="w-4 h-4" /> Copy</Button>
                    </div>
                    {group.owner && (
                        <div className="border-t border-border pt-4 flex items-start gap-3">
                            <p className="text-xs text-muted-foreground flex-1">
                                If the code ended up somewhere it shouldn't, a new one stops the old one working. Everyone already in stays in.
                            </p>
                            <Button size="sm" variant="outline" disabled={working} className="gap-1.5 flex-shrink-0" onClick={() => setConfirmReset(true)}>
                                <RefreshCw className="w-3.5 h-3.5" /> New code
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Make a new code?</AlertDialogTitle>
                        <AlertDialogDescription>{group.code} stops working straight away. Anyone you still want to invite will need the new one.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep this one</AlertDialogCancel>
                        <AlertDialogAction onClick={onReset}>New code</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// ─── Members ─────────────────────────────────────────────────────────────────

export function MembersDialog({ open, onOpenChange, group, members = [], working, onRemove, onLeave, onDelete }) {
    const [removing, setRemoving] = useState(null);
    const [ending, setEnding] = useState(false);
    if (!group) return null;
    const sorted = [...members].sort((a, b) => (b.owner - a.owner) || (b.me - a.me) || String(a.name).localeCompare(String(b.name)));
    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Members · {members.length}</DialogTitle>
                        <DialogDescription>
                            {group.owner ? "You started this group, so you can take people out. They can't rejoin on the same code."
                                : "Whoever started the group can take people out."}
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="max-h-[50vh] overflow-y-auto -mx-1 px-1 divide-y divide-border">
                        {sorted.map((m) => (
                            <li key={m.id} className="flex items-center gap-3 py-2.5">
                                <InitialAvatar name={m.name} size="sm" />
                                <span className="min-w-0 flex-1">
                                    <span className="block font-bold text-foreground truncate">{m.name}{m.me ? " (you)" : ""}</span>
                                    {m.owner && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Crown className="w-3 h-3" /> Started the group</span>}
                                </span>
                                {group.owner && !m.owner && (
                                    <Button size="sm" variant="outline" disabled={working} onClick={() => setRemoving(m)}>Remove</Button>
                                )}
                            </li>
                        ))}
                    </ul>
                    <div className="border-t border-border pt-4">
                        <Button variant="outline" className="w-full text-destructive" onClick={() => setEnding(true)}>
                            {group.owner ? "Delete this group" : "Leave this group"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>They leave the group straight away and can't rejoin with this code. Nothing they shared is deleted.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep them</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { const m = removing; setRemoving(null); onRemove?.(m); }}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={ending} onOpenChange={setEnding}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{group.owner ? `Delete ${group.name}?` : `Leave ${group.name}?`}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {group.owner ? "The group, its shelf and its calls go for everyone, and it can't be undone. Anything people already added to their own library stays theirs."
                                : "You can come back with the code any time."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Stay</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { setEnding(false); (group.owner ? onDelete : onLeave)?.(); }}>
                            {group.owner ? "Delete" : "Leave"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// ─── Share ───────────────────────────────────────────────────────────────────

const KINDS = [
    { id: "deck", label: "Deck", icon: Layers },
    { id: "quiz", label: "Quiz", icon: FileText },
    { id: "result", label: "Saved result", icon: Sparkles },
];

/**
 * Pick something of YOURS to put on the shelf. The page lists your own rows;
 * the server reads the content off them again rather than trusting what the
 * page sends, so what lands on the shelf is what you actually own.
 */
export function ShareDialog({ open, onOpenChange, groupName, me, working, onShare }) {
    const [kind, setKind] = useState("deck");
    const [items, setItems] = useState(null);
    const [pick, setPick] = useState(null);

    useEffect(() => {
        if (!open || !me) return;
        let cancelled = false;
        setItems(null);
        setPick(null);
        (async () => {
            const fail = () => [];
            const [cards, quizzes, results] = await Promise.all([
                base44.entities.Flashcard.filter({ created_by: me, is_active: true }).catch(fail),
                base44.entities.Quiz.filter({ created_by: me }, "-created_date", 100).catch(fail),
                base44.entities.AISavedResult.filter({ created_by: me }, "-created_date", 100).catch(fail),
            ]);
            const decks = new Map();
            for (const c of deckCards(cards || [])) {
                const subject = c.subject_name || "Other";
                const key = `${subject}|${c.topic || ""}`;
                if (!c.topic) continue;
                const d = decks.get(key) || { id: key, title: c.topic, sub: subject, subject_name: subject, topic: c.topic, deck_id: c.deck_id || null, n: 0 };
                d.n += 1;
                decks.set(key, d);
            }
            if (cancelled) return;
            setItems({
                deck: [...decks.values()].map((d) => ({ ...d, meta: `${d.sub} · ${d.n} card${d.n === 1 ? "" : "s"}` })),
                quiz: (quizzes || []).map((q) => ({ id: q.id, title: q.title || "Untitled quiz", meta: `${q.subject || "No subject"} · ${(q.questions || []).length} questions` })),
                result: (results || []).map((r) => ({ id: r.id, title: r.title || r.topic || "Saved result", meta: String(r.tool_type || "").replace(/_/g, " ") })),
            });
        })();
        return () => { cancelled = true; };
    }, [open, me]);

    const list = items?.[kind] || [];
    const chosen = list.find((x) => x.id === pick) || null;
    const payload = !chosen ? null
        : kind === "deck" ? { kind, subject_name: chosen.subject_name, topic: chosen.topic, deck_id: chosen.deck_id }
            : kind === "quiz" ? { kind, quiz_id: chosen.id }
                : { kind, result_id: chosen.id };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Share with {groupName}</DialogTitle>
                    <DialogDescription>It goes on the shelf, and anyone in the group can add a copy to their own library.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1" role="tablist">
                    {KINDS.map((k) => {
                        const Icon = k.icon;
                        const on = kind === k.id;
                        return (
                            <button key={k.id} type="button" role="tab" aria-selected={on}
                                onClick={() => { setKind(k.id); setPick(null); }}
                                className={`h-9 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${on ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                                <Icon className="w-4 h-4 hidden sm:block" aria-hidden /> {k.label}
                            </button>
                        );
                    })}
                </div>
                <div className="max-h-[45vh] overflow-y-auto -mx-1 px-1">
                    {!items ? (
                        <div className="py-8 flex justify-center"><AceShuffle size="md" /></div>
                    ) : list.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">
                            {kind === "deck" ? "No decks of your own yet." : kind === "quiz" ? "No quizzes of your own yet." : "No saved AI results yet."}
                        </p>
                    ) : (
                        <ul className="space-y-1.5">
                            {list.map((x) => (
                                <li key={x.id}>
                                    <button type="button" onClick={() => setPick(x.id)} aria-pressed={pick === x.id}
                                        className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors ${pick === x.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"}`}>
                                        <span className="block font-bold text-foreground text-sm break-words">{x.title}</span>
                                        <span className="block text-xs text-muted-foreground mt-0.5">{x.meta}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <Button disabled={!payload || working} onClick={() => onShare?.(payload)} className="w-full gap-1.5">
                    <Share2 className="w-4 h-4" /> {working ? "Sharing…" : "Put it on the shelf"}
                </Button>
            </DialogContent>
        </Dialog>
    );
}

// ─── Start a group ───────────────────────────────────────────────────────────

export function CreateDialog({ open, onOpenChange, subjects = [], working, onCreate }) {
    const [name, setName] = useState("");
    const [subject, setSubject] = useState("");
    useEffect(() => { if (open) { setName(""); setSubject(""); } }, [open]);
    const check = useMemo(() => (name.trim() ? cleanGroupName(name) : null), [name]);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Start a group</DialogTitle>
                    <DialogDescription>You get a code to send your class. Up to 30 people, and you can take anyone out.</DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (check?.name) onCreate?.(check.name, subject || null); }}>
                    <div>
                        <label htmlFor="group-name" className="text-sm font-bold text-foreground block mb-1.5">Name</label>
                        <Input id="group-name" value={name} maxLength={GROUP_NAME_MAX} autoFocus
                            onChange={(e) => setName(e.target.value)} placeholder="e.g. 12B Chem" />
                        {check?.error && name.trim().length > 1 && <p className="text-xs text-destructive mt-1.5">{check.error}</p>}
                    </div>
                    {subjects.length > 0 && (
                        <div>
                            <p className="text-sm font-bold text-foreground mb-1.5">Subject</p>
                            <div className="flex flex-wrap gap-1.5">
                                {["", ...subjects].map((s) => (
                                    <button key={s || "none"} type="button" onClick={() => setSubject(s)} aria-pressed={subject === s}
                                        className={`h-9 px-3 rounded-full border text-sm font-bold transition-colors ${subject === s ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                                        {s || "Any subject"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <Button type="submit" disabled={!check?.name || working} className="w-full">
                        {working ? "Starting…" : "Start the group"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
