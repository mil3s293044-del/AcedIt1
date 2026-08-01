/**
 * LineMemoriserArtifact — the memorisation drill, back as a chat artifact.
 *
 * This one was dropped whole in the move to one chatbot, and it's the tool
 * that least survives being prose: the value isn't in what the AI says, it's
 * in the method. Chaining is a real memorisation technique — learn line 1 to
 * mastery, then line 2, then recite 1+2 together, then 3, then 1+2+3, with a
 * chunk test every few lines and a full recital at the end.
 *
 * Flow, unchanged from the standalone tool:
 *   learn a line  → N correct reps to master (3, or 2 once you're on a roll)
 *   → chain it onto everything before it
 *   → chunk test every 4 lines
 *   → final test on the whole passage
 *
 * Answers are checked by the model, not by string equality, so punctuation,
 * capitalisation and small typos don't fail you — with a normalised string
 * compare as the fallback when the call fails.
 */
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { recordStudyAndGetStreak } from "@/components/shared/streakHelpers";
import { Eye, EyeOff, Check, Loader2, Trophy, RotateCcw, Flame } from "lucide-react";

const CHUNK_SIZE = 4;

const MODE = { LEARN: "learn", CHUNK: "chunk", FINAL: "final", DONE: "done" };

const normalise = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();

async function checkAnswer(expected, given) {
    try {
        const res = await base44.integrations.Core.InvokeLLM({
            feature: "ai_tool",
            fast: true,
            prompt: `Compare these two texts. Ignore punctuation, capitalization, and minor typos. Is the meaning and word sequence 95%+ the same?\n\nExpected: "${expected}"\nUser wrote: "${given}"\n\nRespond with is_correct (boolean) and feedback (string, only if incorrect — one short line naming what they missed).`,
            response_json_schema: {
                type: "object",
                properties: { is_correct: { type: "boolean" }, feedback: { type: "string" } },
                required: ["is_correct"],
            },
        });
        return { correct: !!res.is_correct, feedback: res.feedback || "" };
    } catch {
        return { correct: normalise(expected) === normalise(given), feedback: "" };
    }
}

export default function LineMemoriserArtifact({ lines, title = "" }) {
    const [mode, setMode] = useState(MODE.LEARN);
    const [index, setIndex] = useState(0);
    const [chaining, setChaining] = useState(false);
    const [revealed, setRevealed] = useState(true);
    const [input, setInput] = useState("");
    const [reps, setReps] = useState({});          // key -> correct reps so far
    const [mastered, setMastered] = useState(new Set());
    const [streak, setStreak] = useState(0);
    const [chunk, setChunk] = useState(0);
    const [checking, setChecking] = useState(false);
    const [note, setNote] = useState("");          // inline feedback under the box
    const inputRef = useRef(null);
    const { toast } = useToast();

    if (!lines?.length) return null;

    const chain = lines.slice(0, index + 1).join(" ");
    const target =
        mode === MODE.FINAL ? lines.join(" ")
        : mode === MODE.CHUNK ? lines.slice(chunk * CHUNK_SIZE, Math.min((chunk + 1) * CHUNK_SIZE, lines.length)).join(" ")
        : chaining ? chain
        : lines[index];

    const repKey = `${index}_${chaining ? "chain" : "single"}`;
    const needed = streak > 5 ? 2 : 3;
    const done = mastered.size;

    const advance = () => {
        // Mastered a single line — either move on, or start chaining it in.
        if (!chaining) {
            setMastered((prev) => new Set([...prev, index]));
            if (index === 0) {
                if (lines.length > 1) { setIndex(1); setRevealed(true); }
                else { setMode(MODE.FINAL); setRevealed(false); }
                return;
            }
            setChaining(true); setRevealed(false);
            setNote(`Line ${index + 1} down — now recite it onto everything before it.`);
            return;
        }
        // Mastered the chain up to here.
        const atChunkEnd = (index + 1) % CHUNK_SIZE === 0 && index < lines.length - 1;
        if (atChunkEnd) {
            setMode(MODE.CHUNK); setChunk(Math.floor(index / CHUNK_SIZE)); setRevealed(false); setNote("");
        } else if (index < lines.length - 1) {
            setIndex((i) => i + 1); setChaining(false); setRevealed(true); setNote("");
        } else {
            setMode(MODE.FINAL); setRevealed(false); setNote("");
        }
    };

    const submit = async () => {
        if (!input.trim() || checking) return;
        setChecking(true);
        const { correct, feedback } = await checkAnswer(target, input);
        setChecking(false);

        if (!correct) {
            setStreak(0);
            setReps((p) => ({ ...p, [repKey]: 0 }));
            setRevealed(true);
            setInput("");
            setNote(feedback || "Not quite — read it again and go for it.");
            if (mode === MODE.FINAL) { setMode(MODE.LEARN); setIndex(0); setChaining(false); }
            inputRef.current?.focus();
            return;
        }

        setStreak((s) => s + 1);
        setInput("");

        if (mode === MODE.FINAL) {
            setMode(MODE.DONE);
            recordStudyAndGetStreak().catch(() => {});
            toast({ title: "Locked in", description: "You recited the whole thing from memory." });
            return;
        }
        if (mode === MODE.CHUNK) {
            const end = Math.min((chunk + 1) * CHUNK_SIZE, lines.length);
            if (end === lines.length) { setMode(MODE.FINAL); setRevealed(false); }
            else { setIndex(end); setChaining(false); setMode(MODE.LEARN); setRevealed(true); }
            setNote("Chunk cleared.");
            return;
        }

        const next = (reps[repKey] || 0) + 1;
        setReps((p) => ({ ...p, [repKey]: next }));
        if (next >= needed) { advance(); }
        else { setRevealed(false); setNote(`Correct — ${needed - next} more to master this one.`); }
    };

    const restart = () => {
        setMode(MODE.LEARN); setIndex(0); setChaining(false); setRevealed(true);
        setInput(""); setReps({}); setMastered(new Set()); setStreak(0); setChunk(0); setNote("");
    };

    // ── Completed ────────────────────────────────────────────────────────────
    if (mode === MODE.DONE) {
        return (
            <div className="mt-3 rounded-2xl border-2 border-primary bg-primary/5 p-5 text-center">
                <Trophy className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="font-display font-extrabold text-foreground">
                    {title ? `${title} — memorised.` : "Memorised."}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                    {lines.length} line{lines.length === 1 ? "" : "s"}, recited start to finish from memory.
                </p>
                <Button size="sm" variant="outline" onClick={restart} className="rounded-xl gap-1.5 text-xs font-semibold mt-3">
                    <RotateCcw className="w-3.5 h-3.5" /> Run it again
                </Button>
            </div>
        );
    }

    const heading =
        mode === MODE.FINAL ? "Final test — the whole passage"
        : mode === MODE.CHUNK ? `Chunk test — lines ${chunk * CHUNK_SIZE + 1}–${Math.min((chunk + 1) * CHUNK_SIZE, lines.length)}`
        : chaining ? `Recite lines 1–${index + 1}`
        : `Line ${index + 1} of ${lines.length}`;

    return (
        <div className="mt-3 rounded-2xl border-2 border-border bg-surface overflow-hidden">
            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-secondary/40">
                <div className="flex-1 min-w-[140px]">
                    <p className="text-xs font-bold text-foreground">{heading}</p>
                    <p className="text-[11px] text-muted-foreground">
                        {done}/{lines.length} mastered
                        {streak >= 3 && <span className="text-streak font-bold"> · {streak} in a row</span>}
                    </p>
                </div>
                {streak >= 3 && <Flame className="w-4 h-4 text-streak flex-shrink-0" />}
                <Button size="sm" variant="outline" onClick={() => setRevealed((v) => !v)}
                    className="rounded-xl gap-1.5 text-xs font-semibold">
                    {revealed ? <><EyeOff className="w-3.5 h-3.5" /> Hide</> : <><Eye className="w-3.5 h-3.5" /> Peek</>}
                </Button>
            </div>

            {/* ── Progress ─────────────────────────────────────────────── */}
            <div className="flex gap-1 px-4 pt-3">
                {lines.map((_, i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full ${
                        mastered.has(i) ? "bg-primary" : i === index ? "bg-xp" : "bg-secondary"
                    }`} />
                ))}
            </div>

            {/* ── The text ─────────────────────────────────────────────── */}
            <div className="p-4 space-y-3">
                <div className={`rounded-xl px-3 py-2.5 text-sm leading-relaxed transition-all ${
                    revealed ? "bg-secondary/60 text-foreground" : "bg-secondary/30 text-transparent select-none blur-sm"
                }`}>
                    {revealed ? target : "Hidden — type it from memory."}
                </div>

                <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
                    placeholder="Type it from memory…"
                    rows={3}
                    className="rounded-xl bg-background border-2 border-border text-sm"
                />

                {note && <p className="text-xs text-muted-foreground">{note}</p>}

                <div className="flex items-center gap-2">
                    <Button size="sm" onClick={submit} disabled={!input.trim() || checking}
                        className="rounded-xl gap-1.5 text-xs font-semibold">
                        {checking ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…</> : <><Check className="w-3.5 h-3.5" /> Check</>}
                    </Button>
                    <span className="text-[11px] text-muted-foreground">⌘/Ctrl + Enter</span>
                </div>
            </div>
        </div>
    );
}
