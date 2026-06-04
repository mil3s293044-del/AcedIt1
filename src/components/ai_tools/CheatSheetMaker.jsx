import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import {
    Upload, X, FileText, Loader2, Wand2, Printer, Plus, RotateCcw,
    Sigma, BookOpen, Check, Lightbulb, ChevronDown, Download, Eye
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { getExaminerPrompt } from "@/lib/subjectExaminerPrompts";

// A tight A4 two-column cheat sheet holds ~22 short lines per page. The page
// selector multiplies this to set how many items fill the sheet; the AI is
// asked for a larger ranked pool so excluded items can be swapped for free.
const ITEMS_PER_PAGE = 22;

// Per-sheet swap budget. Swaps (auto-replace on remove, or pinning a pooled
// item) are free of AI cost, but the oversized pool means unlimited swapping
// would let one credit's generation be harvested for several sheets' worth of
// content. Cap it; once spent, the user regenerates (1 credit) for a fresh set.
const SWAP_LIMIT = 8;

// Static class strings (Tailwind JIT-safe — literals live here, not built from
// template variables).
const TYPE_META = {
    formula:    { label: "Formula",    Icon: Sigma,     color: "text-chart-4", bg: "bg-chart-4/10" },
    definition: { label: "Definition", Icon: BookOpen,  color: "text-chart-3", bg: "bg-chart-3/10" },
    "key-point":{ label: "Key point",  Icon: Check,     color: "text-primary", bg: "bg-primary/10" },
    "exam-tip": { label: "Exam tip",   Icon: Lightbulb, color: "text-xp",      bg: "bg-xp/10" },
};
const metaFor = (t) => TYPE_META[t] || TYPE_META["key-point"];

const groupBySection = (list) => {
    const map = {};
    list.forEach((it) => { (map[it.section || "General"] = map[it.section || "General"] || []).push(it); });
    return Object.entries(map).map(([name, items]) => ({ name, items }));
};

export default function CheatSheetMaker() {
    const [subject, setSubject] = useState("");
    const [title, setTitle] = useState("");
    const [pages, setPages] = useState(1);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const [userSubjects, setUserSubjects] = useState([]);

    const [items, setItems] = useState([]); // {id,type,section,content,importance,status,userExcluded}
    const [hasGenerated, setHasGenerated] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [customInput, setCustomInput] = useState("");
    const [showPool, setShowPool] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [swapsUsed, setSwapsUsed] = useState(0);

    const printRef = useRef(null);
    const { toast } = useToast();

    useEffect(() => {
        const init = async () => {
            try {
                const currentUser = await base44.auth.me();
                const subjects = await base44.entities.UserSubject.filter({ created_by: currentUser.email, is_active: true }).catch(() => []);
                const unique = subjects.reduce((acc, s) => { if (!acc.find((x) => x.subject_name === s.subject_name)) acc.push(s); return acc; }, []);
                setUserSubjects(unique || []);
            } catch { /* not signed in */ }
        };
        init();
    }, []);

    // ─── File handling ───────────────────────────────────────────────────────
    const allowed = [
        "application/pdf",
        "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];

    const handleFiles = (newFiles) => {
        const valid = Array.from(newFiles).filter((f) => {
            if (!allowed.includes(f.type)) {
                toast({ title: `Unsupported: ${f.name}`, description: "Only PDF, TXT, DOCX, PPTX", variant: "destructive" });
                return false;
            }
            return true;
        });
        if (valid.length) {
            setUploadedFiles((prev) => {
                const names = new Set(prev.map((f) => f.name));
                const merged = [...prev, ...valid.filter((f) => !names.has(f.name))];
                if (!title && merged.length > 0) setTitle(merged[0].name.replace(/\.[^/.]+$/, ""));
                return merged;
            });
        }
    };

    const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); };

    // Upload files + extract text from docx/pptx (mirrors the Note Summarizer).
    const prepareSources = async () => {
        const uploaded = await Promise.all(uploadedFiles.map((f) =>
            base44.integrations.Core.UploadFile({ file: f }).then((r) => ({ url: r.file_url, name: f.name, ext: f.name.split(".").pop()?.toLowerCase() }))
        ));
        const docxPptx = uploaded.filter((f) => f.ext === "docx" || f.ext === "pptx");
        const direct = uploaded.filter((f) => f.ext !== "docx" && f.ext !== "pptx");
        let extracted = "";
        for (const f of docxPptx) {
            const r = await base44.functions.invoke("extractDocumentText", { file_url: f.url });
            extracted += `\n\n[${f.name}]:\n${r.data?.text || ""}`;
        }
        return { directUrls: direct.map((f) => f.url), extracted };
    };

    // ─── Generate ────────────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!subject || !uploadedFiles.length) {
            toast({ title: "Need a subject and at least one file", variant: "destructive" });
            return;
        }
        setIsGenerating(true);
        try {
            const { directUrls, extracted } = await prepareSources();

            const fitCount = pages * ITEMS_PER_PAGE;
            const poolCount = Math.round(fitCount * 2.2); // ranked superset for free swaps

            const prompt = `${getExaminerPrompt(subject)}

You are building a high-density EXAM CHEAT SHEET for VCE ${subject}${title ? ` on "${title}"` : ""}, sized to fit ${pages} A4 page${pages > 1 ? "s" : ""} of tight two-column notes.

From the study material provided${extracted ? " (extracted text below, plus any attached files)" : ""}, pull the single most useful, exam-relevant items: key formulas, definitions, must-know facts, and sharp exam tips.

RULES
- Return a RANKED list of about ${poolCount} items (deliberately MORE than fit on the page, so the best fill the sheet and the rest are alternates).
- importance: integer 1-5. 5 = absolutely essential, 1 = nice-to-have. Be decisive — only a handful of 5s.
- Each item is ONE concise line — a phrase, a formula, a definition. No full paragraphs, no filler.
- ALL maths in LaTeX: inline $...$ or display $$...$$. NEVER plain-text maths.
- Give each item a short "section" label (e.g. "Calculus", "Definitions", "Exam tips").
- Prioritise things a student forgets under pressure. Exclude trivial or obvious content.
${extracted ? `\nEXTRACTED CONTENT:${extracted}` : ""}`;

            const response = await base44.integrations.Core.InvokeLLM({
                feature: "ai_tool",
                prompt,
                file_urls: directUrls.length ? directUrls : undefined,
                response_json_schema: {
                    type: "object",
                    properties: {
                        items: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: { type: "string", enum: ["formula", "definition", "key-point", "exam-tip"] },
                                    section: { type: "string" },
                                    content: { type: "string" },
                                    importance: { type: "number" },
                                },
                                required: ["type", "section", "content", "importance"],
                            },
                        },
                    },
                    required: ["items"],
                },
            });

            const raw = (response?.items || []).filter((it) => it?.content);
            if (!raw.length) {
                toast({ title: "Couldn't build a cheat sheet", description: "Try different or clearer material.", variant: "destructive" });
                return;
            }
            // Sort by importance (desc); top `fitCount` are on the sheet, rest pooled.
            const sorted = raw
                .map((it, i) => ({ ...it, id: `i-${i}`, importance: Number(it.importance) || 1, userExcluded: false }))
                .sort((a, b) => b.importance - a.importance);
            const fit = pages * ITEMS_PER_PAGE;
            setItems(sorted.map((it, idx) => ({ ...it, status: idx < fit ? "in" : "out" })));
            setSwapsUsed(0);
            setHasGenerated(true);
            recordStudyAndGetStreak().catch(() => {});
        } catch (err) {
            toast({ title: "Generation failed", description: err?.message, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    // ─── Item actions ────────────────────────────────────────────────────────
    const swapsLeft = SWAP_LIMIT - swapsUsed;
    const swapLimitReached = swapsLeft <= 0;

    // Remove an item from the sheet — this just drops it (the count goes down).
    // The student adds a replacement themselves, either from the suggestions
    // pool or their own text. Removing is free and doesn't spend a swap.
    const excludeItem = (id) =>
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "out", userExcluded: true } : it)));

    // Pulling a NEW suggestion onto the sheet is the action that could harvest
    // the oversized pool, so it spends one of the swap budget.
    const promoteItem = (id) => {
        if (swapLimitReached) { toast({ title: "Swap limit reached", description: "Regenerate for a fresh set of suggestions." }); return; }
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "in", userExcluded: false } : it)));
        setSwapsUsed((s) => s + 1);
    };

    const addCustom = () => {
        const text = customInput.trim();
        if (!text) return;
        // Your own text — no AI, no swap cost.
        setItems((prev) => [...prev, { id: `c-${Date.now()}`, type: "key-point", section: "My additions", content: text, importance: 5, status: "in", userExcluded: false }]);
        setCustomInput("");
    };

    const startOver = () => {
        if (hasGenerated && !window.confirm("Discard this cheat sheet and start over?")) return;
        setItems([]); setHasGenerated(false); setUploadedFiles([]); setSwapsUsed(0);
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

    // Download a self-contained .html document (renders formulas, opens in any
    // browser, saves straight to the device's Files/Downloads).
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

    return (
        <div className="space-y-5">
            {/* ── SETUP ─────────────────────────────────────────────── */}
            {!hasGenerated && (
                <div className="card-soft p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-xp/15 flex items-center justify-center">
                            <Wand2 className="w-4 h-4 text-xp" />
                        </div>
                        <p className="font-display font-extrabold text-foreground text-sm">Cheat sheet setup</p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="stat-label">Subject</label>
                        <Select value={subject} onValueChange={setSubject}>
                            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                            <SelectContent>
                                {userSubjects.map((s) => <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="stat-label">Title (optional)</label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Calculus — Unit 3" />
                    </div>

                    {/* Drop zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                            isDragging ? "border-primary bg-primary/5" : uploadedFiles.length ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-primary/5"
                        }`}
                    >
                        <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.txt,.docx,.pptx" multiple onChange={(e) => handleFiles(e.target.files)} />
                        {uploadedFiles.length === 0 ? (
                            <div>
                                <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                                <p className="text-sm font-bold text-foreground">Drop notes here, or click to browse</p>
                                <p className="text-xs text-muted-foreground mt-1">PDF, TXT, DOCX, PPTX — multiple files supported</p>
                            </div>
                        ) : (
                            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                {uploadedFiles.map((f, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-surface rounded-xl px-3 py-2 border border-primary/20">
                                        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                                        <div className="flex-1 text-left min-w-0">
                                            <p className="text-xs font-bold text-foreground truncate">{f.name}</p>
                                            <p className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                        <button onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))} className="p-1 text-muted-foreground hover:text-streak hover:bg-streak/10 rounded-lg transition-colors flex-shrink-0">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="text-xs text-primary hover:underline font-bold mt-1">+ Add more files</button>
                            </div>
                        )}
                    </div>

                    {/* Page count */}
                    <div className="space-y-1.5">
                        <label className="stat-label">Cheat sheet length</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPages(p)}
                                    className={`p-2.5 rounded-xl border-2 text-center transition-all ${pages === p ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 bg-surface"}`}
                                >
                                    <div className={`text-sm font-bold ${pages === p ? "text-primary" : "text-foreground"}`}>{p} page{p > 1 ? "s" : ""}</div>
                                    <div className="text-xs text-muted-foreground/70 mt-0.5">~{p * ITEMS_PER_PAGE} items</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button onClick={handleGenerate} disabled={!subject || !uploadedFiles.length || isGenerating} size="lg" className="w-full">
                        {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Building your cheat sheet…</> : <><Wand2 className="w-4 h-4" /> Generate cheat sheet</>}
                    </Button>
                </div>
            )}

            {/* ── RESULT ────────────────────────────────────────────── */}
            {hasGenerated && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-soft overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3 border-b-2 border-border bg-secondary/30">
                        <div className="w-8 h-8 rounded-lg bg-xp/15 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-xp" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-display font-extrabold text-foreground text-sm leading-tight truncate">{title || subject || "Cheat Sheet"}</p>
                            <p className={`text-xs ${overBudget ? "text-streak font-bold" : "text-muted-foreground"}`}>
                                {included.length} items · {overBudget ? `slightly over — trim a few to fit ${pages} page${pages > 1 ? "s" : ""}` : `fits ~${estPages} page${estPages > 1 ? "s" : ""}`} · {swapLimitReached ? "no swaps left" : `${swapsLeft} swap${swapsLeft === 1 ? "" : "s"} left`}
                            </p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                            <Button size="sm" variant="outline" onClick={startOver} title="Start over"><RotateCcw className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="outline" onClick={() => setShowPreview(true)} disabled={!included.length}><Eye className="w-3.5 h-3.5" /> Preview</Button>
                            <Button size="sm" variant="outline" onClick={downloadSheet} disabled={!included.length} title="Download as a document"><Download className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" onClick={printSheet} disabled={!included.length}><Printer className="w-3.5 h-3.5" /> Print / PDF</Button>
                        </div>
                    </div>

                    <div className="px-5 py-5 bg-surface space-y-5">
                        <p className="text-xs text-muted-foreground">
                            Tap any item to remove it. Add a replacement from your own text below, or from “more suggestions”
                            {swapLimitReached ? " (swap limit reached — regenerate for more)." : ` (up to ${SWAP_LIMIT} per sheet).`}
                        </p>

                        {/* Included items, grouped, two-column on wide screens */}
                        <div className="sm:columns-2 sm:gap-5 space-y-3">
                            {sections.map((sec) => (
                                <div key={sec.name} className="break-inside-avoid mb-3 space-y-1.5">
                                    <p className="stat-label text-chart-3">{sec.name}</p>
                                    {sec.items.map((it) => {
                                        const m = metaFor(it.type);
                                        return (
                                            <button
                                                key={it.id}
                                                onClick={() => excludeItem(it.id)}
                                                title="Remove from cheat sheet"
                                                className="group w-full text-left flex items-start gap-2 px-3 py-2 rounded-xl border border-border bg-background hover:border-streak/40 hover:bg-streak/5 transition-all"
                                            >
                                                <span className={`flex-shrink-0 w-5 h-5 rounded-md ${m.bg} flex items-center justify-center mt-0.5`}>
                                                    <m.Icon className={`w-3 h-3 ${m.color}`} />
                                                </span>
                                                <span className="flex-1 text-sm leading-snug text-foreground"><MarkdownMath>{it.content}</MarkdownMath></span>
                                                <X className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-streak transition-colors flex-shrink-0 mt-0.5" />
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>

                        {/* Add your own */}
                        <div className="flex gap-2 pt-1">
                            <Input
                                value={customInput}
                                onChange={(e) => setCustomInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                                placeholder="Add your own point or formula (LaTeX with $…$ works)"
                                className="flex-1"
                            />
                            <Button onClick={addCustom} disabled={!customInput.trim()} className="flex-shrink-0"><Plus className="w-4 h-4" /> Add</Button>
                        </div>

                        {/* Pool of alternates */}
                        {pool.length > 0 && (
                            <div className="rounded-xl border border-border overflow-hidden">
                                <button onClick={() => setShowPool(!showPool)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/40 transition-colors">
                                    <span className="text-xs font-bold text-foreground">More suggestions not on the sheet ({pool.length})</span>
                                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showPool ? "rotate-180" : ""}`} />
                                </button>
                                <AnimatePresence>
                                    {showPool && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-border">
                                            <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
                                                {pool.map((it) => {
                                                    const m = metaFor(it.type);
                                                    return (
                                                        <button
                                                            key={it.id}
                                                            onClick={() => promoteItem(it.id)}
                                                            disabled={swapLimitReached}
                                                            title={swapLimitReached ? "Swap limit reached" : "Add to cheat sheet"}
                                                            className="group w-full text-left flex items-start gap-2 px-3 py-2 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <span className={`flex-shrink-0 w-5 h-5 rounded-md ${m.bg} flex items-center justify-center mt-0.5`}>
                                                                <m.Icon className={`w-3 h-3 ${m.color}`} />
                                                            </span>
                                                            <span className="flex-1 text-sm leading-snug text-muted-foreground group-hover:text-foreground"><MarkdownMath>{it.content}</MarkdownMath></span>
                                                            <Plus className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Preview — shows the printable A4 layout before exporting */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Preview · {title || subject || "Cheat Sheet"}</DialogTitle></DialogHeader>
                    <div className="bg-white text-[#0D1626] rounded-lg border border-border shadow-soft p-6">
                        <h1 className="text-lg font-extrabold mb-3">{title || subject || "Cheat Sheet"}</h1>
                        <div className="columns-1 sm:columns-2 gap-6 text-[12px] leading-snug">
                            {sections.map((sec) => (
                                <div key={sec.name} className="break-inside-avoid mb-3">
                                    <p className="text-[13px] font-bold text-chart-3 border-b border-gray-200 pb-0.5 mb-1">{sec.name}</p>
                                    {sec.items.map((it) => (
                                        <div key={it.id} className="flex gap-1.5 mb-1">
                                            <span className="text-primary flex-shrink-0">•</span>
                                            <div className="flex-1 min-w-0"><MarkdownMath>{it.content}</MarkdownMath></div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={downloadSheet}><Download className="w-4 h-4" /> Download</Button>
                        <Button onClick={printSheet}><Printer className="w-4 h-4" /> Print / PDF</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Hidden print source — KaTeX renders here so the print window gets typeset maths */}
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
