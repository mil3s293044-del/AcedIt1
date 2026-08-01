/**
 * CheatSheetArtifact — the cheat sheet as an interactive artifact inside the
 * unified chat, rather than a wall of markdown.
 *
 * The chat asks the model for a ranked POOL of items (more than fit), then
 * this renders the top ones onto the sheet and keeps the rest as swap
 * suggestions. Curating is free — no AI round-trip — so a student can drop an
 * item and pull in a better one as many times as they like, add their own
 * lines, resize the sheet, and print or download an A4 two-column document.
 *
 * Ported from the standalone CheatSheetMaker; that tool owned its own upload
 * form and generation call, which the chat now provides. Everything below the
 * generation step is the same behaviour.
 */
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
    Printer, Plus, Download, Eye, X, Sigma, BookOpen, Check, Lightbulb,
} from "lucide-react";
import MarkdownMath from "@/components/shared/MarkdownMath";

// A tight A4 two-column sheet holds ~22 short lines per page.
const ITEMS_PER_PAGE = 22;

// Static class strings — Tailwind JIT can't see names built from variables.
const TYPE_META = {
    formula:     { label: "Formula",    Icon: Sigma,     color: "text-chart-4", bg: "bg-chart-4/10" },
    definition:  { label: "Definition", Icon: BookOpen,  color: "text-chart-3", bg: "bg-chart-3/10" },
    "key-point": { label: "Key point",  Icon: Check,     color: "text-primary", bg: "bg-primary/10" },
    "exam-tip":  { label: "Exam tip",   Icon: Lightbulb, color: "text-xp",      bg: "bg-xp/10" },
};
const metaFor = (t) => TYPE_META[t] || TYPE_META["key-point"];

const groupBySection = (list) => {
    const map = {};
    list.forEach((it) => { (map[it.section || "General"] = map[it.section || "General"] || []).push(it); });
    return Object.entries(map).map(([name, items]) => ({ name, items }));
};

/** Rank the raw pool and mark the top `pages × 22` as on-sheet. */
export function seedItems(raw, pages = 1) {
    return (raw || [])
        .filter((it) => it?.content)
        .map((it, i) => ({
            ...it,
            id: `i-${i}`,
            importance: Number(it.importance) || 1,
            userExcluded: false,
        }))
        .sort((a, b) => b.importance - a.importance)
        .map((it, idx) => ({ ...it, status: idx < pages * ITEMS_PER_PAGE ? "in" : "out" }));
}

export default function CheatSheetArtifact({ initialItems, subject = "", title = "", defaultPages = 1 }) {
    const [items, setItems] = useState(() => seedItems(initialItems, defaultPages));
    const [pages, setPages] = useState(defaultPages);
    const [customInput, setCustomInput] = useState("");
    const [showPool, setShowPool] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const printRef = useRef(null);
    const { toast } = useToast();

    const excludeItem = (id) =>
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "out", userExcluded: true } : it)));

    const promoteItem = (id) =>
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "in", userExcluded: false } : it)));

    const addCustom = () => {
        const text = customInput.trim();
        if (!text) return;
        setItems((prev) => [...prev, {
            id: `c-${Date.now()}`, type: "key-point", section: "My additions",
            content: text, importance: 5, status: "in", userExcluded: false,
        }]);
        setCustomInput("");
    };

    // ─── Export (print + download share one A4 HTML document) ────────────────
    const docTitle = () => (title || subject || "Cheat Sheet").replace(/</g, "");
    const buildDoc = () => {
        const inner = printRef.current?.innerHTML || "";
        return `<!doctype html><html><head><meta charset="utf-8"><title>${docTitle()} — Cheat Sheet</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<style>
  @page { size: A4; margin: 9mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; font-size: 9.5px; line-height: 1.35; color: #0D1626; margin: 0; padding: 14px; }
  h1 { font-size: 15px; margin: 0 0 8px; }
  .cols { column-count: 2; column-gap: 14px; }
  .sec { break-inside: avoid; margin-bottom: 9px; }
  .sec h2 { font-size: 10.5px; margin: 0 0 3px; color: #217BE0; border-bottom: 1px solid #e2e8f0; padding-bottom: 1px; }
  .item { margin: 0 0 3px; padding-left: 8px; text-indent: -8px; }
  .item::before { content: "• "; color: #58CC02; }
  .katex { font-size: 1em; }
  p { margin: 0; }
</style></head>
<body><h1>${docTitle()}</h1><div class="cols">${inner}</div></body></html>`;
    };

    const printSheet = () => {
        if (!printRef.current) return;
        const w = window.open("", "_blank");
        if (!w) { toast({ title: "Pop-up blocked", description: "Allow pop-ups to print.", variant: "destructive" }); return; }
        w.document.write(buildDoc());
        w.document.close();
        setTimeout(() => { w.focus(); w.print(); }, 450);
    };

    const downloadSheet = () => {
        if (!printRef.current) return;
        const blob = new Blob([buildDoc()], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${docTitle().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "cheat-sheet"}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast({ title: "Downloaded", description: "Saved to your files." });
    };

    const included = items.filter((it) => it.status === "in");
    const pool = items.filter((it) => it.status === "out");
    const sections = groupBySection(included);
    const estPages = Math.max(1, Math.ceil(included.length / ITEMS_PER_PAGE));
    const overBudget = estPages > pages;

    if (!items.length) return null;

    return (
        <div className="mt-3 rounded-2xl border-2 border-border bg-surface overflow-hidden">
            {/* ── Toolbar ──────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-secondary/40">
                <div className="flex-1 min-w-[140px]">
                    <p className="text-xs font-bold text-foreground">{docTitle()}</p>
                    <p className="text-[11px] text-muted-foreground">
                        {included.length} on the sheet · {pool.length} suggestions
                        {overBudget && <span className="text-streak font-bold"> · over {pages} page{pages > 1 ? "s" : ""}</span>}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    {[1, 2, 3].map((p) => (
                        <button key={p} onClick={() => setPages(p)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border-2 transition-all ${
                                pages === p ? "bg-primary border-primary text-white" : "bg-surface border-border text-muted-foreground hover:text-foreground"
                            }`}>
                            {p}p
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setShowPreview(true)} className="rounded-xl gap-1.5 text-xs font-semibold">
                        <Eye className="w-3.5 h-3.5" /> Preview
                    </Button>
                    <Button size="sm" variant="outline" onClick={downloadSheet} className="rounded-xl gap-1.5 text-xs font-semibold">
                        <Download className="w-3.5 h-3.5" /> Download
                    </Button>
                    <Button size="sm" onClick={printSheet} className="rounded-xl gap-1.5 text-xs font-semibold">
                        <Printer className="w-3.5 h-3.5" /> Print
                    </Button>
                </div>
            </div>

            {/* ── The sheet ────────────────────────────────────────────── */}
            <div className="p-4 space-y-4 max-h-[460px] overflow-y-auto">
                {sections.map((sec) => (
                    <div key={sec.name}>
                        <p className="stat-label mb-1.5">{sec.name}</p>
                        <div className="space-y-1">
                            {sec.items.map((it) => {
                                const m = metaFor(it.type);
                                return (
                                    <div key={it.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/60">
                                        <span className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${m.bg}`}>
                                            <m.Icon className={`w-3 h-3 ${m.color}`} />
                                        </span>
                                        <div className="flex-1 min-w-0 text-sm text-foreground leading-snug">
                                            <MarkdownMath>{it.content}</MarkdownMath>
                                        </div>
                                        <button onClick={() => excludeItem(it.id)} aria-label="Remove from sheet"
                                            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-streak transition-opacity flex-shrink-0">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Add your own line */}
                <div className="flex items-center gap-2 pt-1">
                    <Input value={customInput} onChange={(e) => setCustomInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                        placeholder="Add your own line…"
                        className="h-9 rounded-xl bg-background border-border text-sm" />
                    <Button size="sm" variant="outline" onClick={addCustom} className="rounded-xl gap-1.5 text-xs font-semibold flex-shrink-0">
                        <Plus className="w-3.5 h-3.5" /> Add
                    </Button>
                </div>
            </div>

            {/* ── Swap pool ────────────────────────────────────────────── */}
            {pool.length > 0 && (
                <div className="border-t border-border">
                    <button onClick={() => setShowPool((v) => !v)}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                        {showPool ? "Hide" : "Show"} {pool.length} suggestion{pool.length === 1 ? "" : "s"} — swap any of these in, free
                    </button>
                    {showPool && (
                        <div className="px-4 pb-4 space-y-1 max-h-[220px] overflow-y-auto">
                            {pool.map((it) => {
                                const m = metaFor(it.type);
                                return (
                                    <div key={it.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/60">
                                        <span className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${m.bg}`}>
                                            <m.Icon className={`w-3 h-3 ${m.color}`} />
                                        </span>
                                        <div className="flex-1 min-w-0 text-sm text-muted-foreground leading-snug">
                                            <MarkdownMath>{it.content}</MarkdownMath>
                                        </div>
                                        <button onClick={() => promoteItem(it.id)} aria-label="Add to sheet"
                                            className="text-primary hover:text-primary/70 flex-shrink-0">
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── Preview ──────────────────────────────────────────────── */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{docTitle()}</DialogTitle></DialogHeader>
                    <div className="columns-2 gap-4 text-[11px] leading-snug">
                        {sections.map((sec) => (
                            <div key={sec.name} className="break-inside-avoid mb-3">
                                <p className="font-bold text-chart-3 border-b border-border mb-1">{sec.name}</p>
                                {sec.items.map((it) => (
                                    <div key={it.id} className="mb-1"><MarkdownMath>{it.content}</MarkdownMath></div>
                                ))}
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Hidden source for print + download */}
            <div ref={printRef} className="hidden">
                {sections.map((sec) => (
                    <div className="sec" key={sec.name}>
                        <h2>{sec.name}</h2>
                        {sec.items.map((it) => (
                            <div className="item" key={it.id}><MarkdownMath>{it.content}</MarkdownMath></div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
