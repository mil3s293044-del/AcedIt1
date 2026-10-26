/**
 * MaterialTab — what a folder is revising FROM: the decks, quizzes, mind maps
 * and chats in it, and the one place to add or take any of them out.
 *
 * ─── EVERY ROW SAYS WHY IT IS HERE ──────────────────────────────────────────
 * Two rules put a thing in a folder: it is in one of the SAC's topics, or it
 * is tagged. They look the same in a list and they are not the same to undo —
 * a tag comes off with one tap; a topic match goes when the topic does. So a
 * tagged row says "Tagged" and carries the tap that removes it, and a matched
 * row names the topic that matched. A Remove on a topic match would be a
 * button that did nothing.
 *
 * ─── ADDING IS ONE SHEET OVER EVERYTHING THEY OWN ───────────────────────────
 * Tagging from each screen works (the chip is on every deck, quiz, map and
 * chat), but the question in front of a student here is the other way round:
 * "what of mine is for this SAC". The sheet lists all of it, this subject
 * first, and a tick is the same claim the chips write.
 *
 * ─── MAKING SOMETHING NEW FOR IT ────────────────────────────────────────────
 * Each "Make" link carries `?for=` so what is made there is tagged here, and
 * the screen it lands on says so before it happens (`ForNote`).
 */
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Search, Layers, ListChecks, Network, MessageSquare, Timer, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createPageUrl } from "@/utils";
import { claims, deckKeyOf, normTopic, inFolder } from "@/lib/revision";
import { labelForTool } from "@/lib/toolLabels";
import { useToast } from "@/components/ui/use-toast";

export const KINDS = [
    { id: "decks", label: "Decks", one: "deck", Icon: Layers },
    { id: "quizzes", label: "Quizzes", one: "quiz", Icon: ListChecks },
    { id: "maps", label: "Mind maps", one: "mind map", Icon: Network },
    { id: "chats", label: "AI chats", one: "chat", Icon: MessageSquare },
];

const str = (v) => String(v ?? "").trim();

/** Decks out of deck cards: one row per subject + topic, the shelf's own grouping. */
export function decksOf(cards = []) {
    const m = new Map();
    for (const c of cards || []) {
        const key = deckKeyOf(c.subject_name, c.topic);
        if (!m.has(key)) m.set(key, { id: key, subject: str(c.subject_name) || "Other", topic: str(c.topic) || "General", n: 0 });
        m.get(key).n += 1;
    }
    return [...m.values()];
}

/** One row of any kind, in the shape the lists draw. */
export function itemsOf(kind, rows = []) {
    if (kind === "decks") {
        return decksOf(rows).map((d) => ({
            kind, id: d.id, title: d.topic, subject: d.subject, topic: d.topic,
            meta: `${d.n} card${d.n === 1 ? "" : "s"}`,
            href: `${createPageUrl("Study")}?tab=spaced_repetition&subject=${encodeURIComponent(d.subject)}&topic=${encodeURIComponent(d.topic)}`,
        }));
    }
    if (kind === "quizzes") {
        return (rows || []).map((q) => ({
            kind, id: String(q.id), title: str(q.title) || "Untitled quiz", subject: str(q.subject), topic: str(q.title),
            meta: `${q.questions?.length || 0} question${q.questions?.length === 1 ? "" : "s"}`,
            href: `${createPageUrl("Quizzes")}?open=${encodeURIComponent(q.id)}`,
        }));
    }
    if (kind === "maps") {
        return (rows || []).map((m) => ({
            kind, id: String(m.id), title: str(m.title) || str(m.subject_name) || "Mind map", subject: str(m.subject_name), topic: str(m.topic),
            meta: m.is_subject_root ? "Subject map" : `${Math.max(0, (m.nodes?.length || 1) - 1)} nodes`,
            href: `${createPageUrl("Study")}?tab=mind_map&map=${encodeURIComponent(m.id)}`,
        }));
    }
    return (rows || []).map((r) => ({
        kind, id: String(r.id), title: str(r.title) || "Chat", subject: str(r.subject_name), topic: str(r.topic),
        meta: labelForTool(r.tool_type) || "AI chat",
        href: `${createPageUrl("AITools")}?chat=${encodeURIComponent(r.id)}`,
    }));
}

/** Why a row is in the folder: its own tag, or the topic it matched. */
export function whyIn(folder, item) {
    if (folder?.kind === "sac" && claims(folder, item.kind, item.id)) return { tagged: true, label: "Tagged" };
    if (!folder?.topics?.length) return { tagged: false, label: `In ${folder?.subject || "this subject"}` };
    const hit = folder.topics.find((t) => normTopic(t) === normTopic(item.topic));
    return { tagged: false, label: hit ? `In ${hit}` : "In this folder" };
}

function Row({ item, folder, tags, index }) {
    const reduce = useReducedMotion();
    const { toast } = useToast();
    const why = whyIn(folder, item);
    const kind = KINDS.find((k) => k.id === item.kind);
    const Icon = kind?.Icon || Layers;
    const untag = async () => {
        try { await tags.toggle(folder.key, item.kind, item.id, false); }
        catch { toast({ title: "That did not save", description: "Try it again in a moment.", variant: "destructive" }); }
    };
    return (
        <motion.li initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.2) }}
            className="flex items-center gap-3 px-1 py-2.5" data-material={item.kind} data-material-why={why.tagged ? "tagged" : "topic"}>
            <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                    {item.meta}
                    {item.subject && normTopic(item.subject) !== normTopic(folder.subject) ? ` · ${item.subject}` : ""}
                    {" · "}
                    <span className={why.tagged ? "font-bold text-primary" : ""}>{why.label}</span>
                </p>
            </div>
            {why.tagged && tags?.ready && (
                <button type="button" onClick={untag} aria-label={`Take ${item.title} out of ${folder.title}`}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
            <Link to={item.href} className="text-xs font-bold text-primary hover:underline flex-shrink-0">Open</Link>
        </motion.li>
    );
}

/** The sheet: everything the student owns, ticked where it is tagged for this SAC. */
function AddSheet({ open, onOpenChange, folder, all, tags }) {
    const { toast } = useToast();
    const [q, setQ] = useState("");
    const [kind, setKind] = useState("all");
    const rows = useMemo(() => {
        const out = [];
        for (const k of KINDS) for (const it of all[k.id] || []) out.push(it);
        return out;
    }, [all]);
    const shown = useMemo(() => {
        const needle = normTopic(q);
        const mine = (it) => normTopic(it.subject) === normTopic(folder.subject);
        return rows
            .filter((it) => kind === "all" || it.kind === kind)
            .filter((it) => !needle || normTopic(`${it.title} ${it.subject} ${it.meta}`).includes(needle))
            .sort((a, b) => Number(mine(b)) - Number(mine(a)) || a.title.localeCompare(b.title));
    }, [rows, q, kind, folder.subject]);

    const pick = async (it, matched, tagged) => {
        if (matched && !tagged) return;
        try { await tags.toggle(folder.key, it.kind, it.id, !tagged); }
        catch { toast({ title: "That did not save", description: "Try it again in a moment.", variant: "destructive" }); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-3xl max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden" data-add-sheet>
                <DialogHeader className="p-5 pb-3 border-b border-border">
                    <DialogTitle className="text-lg">Add to {folder.title}</DialogTitle>
                    <p className="text-xs text-muted-foreground">Tick anything of yours that is for this SAC. Its mistakes, sits and study time come with it.</p>
                    <div className="mt-3 relative">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your decks, quizzes, maps and chats"
                            className="w-full h-10 pl-9 pr-3 rounded-xl border-2 border-border bg-surface text-sm outline-none focus:border-foreground/30" />
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5" role="tablist">
                        {[{ id: "all", label: "All" }, ...KINDS].map((k) => (
                            <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} onClick={() => setKind(k.id)}
                                className={`h-7 px-2.5 rounded-full text-[11px] font-bold transition-colors ${
                                    kind === k.id ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                                {k.label}
                            </button>
                        ))}
                    </div>
                </DialogHeader>
                <ul className="flex-1 overflow-y-auto p-2">
                    {shown.length === 0 && (
                        <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {q ? "Nothing of yours matches that." : "Nothing of that kind yet."}
                        </li>
                    )}
                    {shown.map((it) => {
                        const tagged = claims(folder, it.kind, it.id);
                        const matched = inFolder(folder, it.subject, it.topic);
                        const on = tagged || matched;
                        const K = KINDS.find((k) => k.id === it.kind);
                        return (
                            <li key={`${it.kind}:${it.id}`}>
                                <button type="button" onClick={() => pick(it, matched, tagged)} aria-pressed={on}
                                    disabled={matched && !tagged} data-add-row={`${it.kind}:${it.id}`}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-secondary transition-colors disabled:cursor-default disabled:hover:bg-transparent">
                                    <span className={`w-4 h-4 rounded-[5px] border-2 flex items-center justify-center flex-shrink-0 ${
                                        on ? (matched && !tagged ? "bg-muted-foreground/40 border-transparent text-background" : "bg-primary border-primary text-primary-foreground") : "border-border"}`}>
                                        {on && <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-bold text-foreground truncate">{it.title}</span>
                                        <span className="block text-[11px] text-muted-foreground truncate">
                                            {K?.one} · {it.subject || "No subject"}{matched && !tagged ? " · already in by its topic" : ""}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </DialogContent>
        </Dialog>
    );
}

export default function MaterialTab({ folder, contents, all, tags, empty }) {
    const [adding, setAdding] = useState(false);
    const lists = useMemo(() => ({
        decks: itemsOf("decks", contents.cards),
        quizzes: itemsOf("quizzes", contents.quizzes),
        maps: itemsOf("maps", contents.maps),
        chats: itemsOf("chats", contents.chats),
    }), [contents]);
    const total = KINDS.reduce((n, k) => n + lists[k.id].length, 0);
    const sac = folder.kind === "sac";
    const forQ = `for=${encodeURIComponent(folder.key)}`;
    const subj = `subject=${encodeURIComponent(folder.subject)}`;
    const MAKE = [
        { label: "A deck", Icon: Layers, href: `${createPageUrl("Study")}?tab=spaced_repetition&${forQ}` },
        { label: "A quiz", Icon: ListChecks, href: `${createPageUrl("Quizzes")}?${forQ}` },
        { label: "A mind map", Icon: Network, href: `${createPageUrl("Study")}?tab=mind_map&${forQ}&${subj}` },
        { label: "An AI chat", Icon: MessageSquare, href: `${createPageUrl("AITools")}?${forQ}&${subj}` },
        { label: "Study time", Icon: Timer, href: `${createPageUrl("Study")}?tab=pomodoro&${forQ}` },
    ];

    return (
        <div className="space-y-6" data-material-tab>
            {sac && (
                <div className="space-y-3">
                    <Button onClick={() => setAdding(true)} disabled={!tags?.ready} data-material-add
                        className="btn-3d bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-2">
                        <Plus className="w-4 h-4" /> Add to this SAC
                    </Button>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground mr-0.5">Or make one for it:</span>
                        {MAKE.map(({ label, Icon, href }) => (
                            <Link key={label} to={href} data-material-make={label}
                                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border-2 border-border text-xs font-bold text-foreground hover:bg-secondary transition-colors">
                                <Icon className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" /> {label}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {total === 0 ? empty : KINDS.filter((k) => lists[k.id].length).map((k) => (
                <section key={k.id} aria-label={k.label} className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <h3 className="font-display font-extrabold text-foreground text-sm">{k.label}</h3>
                        <span className="text-xs text-muted-foreground tabular-nums">{lists[k.id].length}</span>
                        <span className="flex-1 h-px bg-border" aria-hidden="true" />
                    </div>
                    <ul className="divide-y divide-border/60">
                        {lists[k.id].map((it, i) => <Row key={`${it.kind}:${it.id}`} item={it} folder={folder} tags={tags} index={i} />)}
                    </ul>
                </section>
            ))}

            {sac && adding && (
                <AddSheet open={adding} onOpenChange={setAdding} folder={folder} all={all} tags={tags} />
            )}
        </div>
    );
}

