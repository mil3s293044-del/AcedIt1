/**
 * GroupShelf — what the group has shared, and one tap to make it yours.
 *
 * Adding is ONE call (`importGroupItem`) and it reports what actually
 * happened. It used to create the cards in the browser and then write the
 * import count to a row only the sharer could update, so everybody the share
 * was FOR read "Failed to import" over a deck that had landed — and tapped
 * again, and got it twice.
 *
 * Reactions are the only thing anybody can say about a shared item: four
 * glyphs, counted, never a comment box.
 */
import React from "react";
import { Layers, FileText, Sparkles, Check, Plus, MoreHorizontal, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Band from "@/components/shared/Band";

const KIND = {
    deck:   { icon: Layers,   ink: "text-chart-4 bg-chart-4/10", word: "Deck" },
    quiz:   { icon: FileText, ink: "text-chart-3 bg-chart-3/10", word: "Quiz" },
    result: { icon: Sparkles, ink: "text-xp bg-xp/10",           word: "Saved result" },
};

export function ago(at, now = Date.now()) {
    const t = new Date(at || 0).getTime();
    if (!Number.isFinite(t) || t <= 0) return "";
    const m = Math.max(0, Math.round((now - t) / 60000));
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    return d < 14 ? `${d}d ago` : `${Math.round(d / 7)}w ago`;
}

export default function GroupShelf({ shelf = [], owner = false, working, onShare, onImport, onReact, onRemove }) {
    return (
        <Band title="Shelf" count={shelf.length || null}
            aside={
                <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0" onClick={onShare}>
                    <Share2 className="w-4 h-4" /> Share
                </Button>
            }>
            <div data-group-block="shelf">
                {shelf.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                        Nothing on the shelf yet. Share a deck or a quiz and the whole group can add it in one tap.
                    </p>
                ) : (
                    <ul className="space-y-2.5">
                        {shelf.map((item) => {
                            const k = KIND[item.kind] || KIND.deck;
                            const Icon = k.icon;
                            const busy = working === item.id;
                            return (
                                <li key={item.id} className="card-soft on-table p-3.5 sm:p-4">
                                    <div className="flex items-start gap-3">
                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${k.ink}`}>
                                            <Icon className="w-5 h-5" aria-label={k.word} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-foreground leading-snug break-words">{item.title}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {[item.size, item.subject, `${item.mine ? "you" : item.by}, ${ago(item.at)}`].filter(Boolean).join(" · ")}
                                            </p>
                                        </div>
                                        {(item.mine || owner) && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1 flex-shrink-0" aria-label="More">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem className="text-destructive" onClick={() => onRemove?.(item)}>
                                                        Take it off the shelf
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                                        {item.reactions.map((r) => (
                                            <button key={r.glyph} type="button" disabled={busy}
                                                onClick={() => onReact?.(item, r.glyph)}
                                                aria-pressed={r.mine}
                                                aria-label={`${r.glyph} ${r.count}`}
                                                className={`h-8 min-w-[2.75rem] px-2 rounded-full border text-sm flex items-center justify-center gap-1 transition-colors ${
                                                    r.mine ? "border-primary/50 bg-primary/10 text-foreground" : "border-border bg-surface text-muted-foreground hover:bg-secondary"}`}>
                                                <span aria-hidden>{r.glyph}</span>
                                                {r.count > 0 && <span className="font-bold tabular-nums text-xs">{r.count}</span>}
                                            </button>
                                        ))}
                                        <span className="flex-1" />
                                        {item.imports > 0 && !item.imported && !item.mine && (
                                            <span className="text-xs text-muted-foreground mr-1 whitespace-nowrap">{item.imports} added it</span>
                                        )}
                                        {item.mine ? (
                                            <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                                                {item.imports > 0 ? `${item.imports} added it` : "Yours"}
                                            </span>
                                        ) : item.imported ? (
                                            <span className="inline-flex items-center gap-1 text-sm font-bold text-primary whitespace-nowrap">
                                                <Check className="w-4 h-4" /> Added
                                            </span>
                                        ) : (
                                            <Button size="sm" disabled={busy} className="gap-1.5" onClick={() => onImport?.(item)}>
                                                <Plus className="w-4 h-4" /> {busy ? "Adding…" : "Add to mine"}
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </Band>
    );
}
