/**
 * BankTray — the marks this quiz dropped, ticked, and saved in one press.
 *
 * It replaces a card on the verdict that said "save the ones worth rehearsing
 * from the marks below" and offered one button, which left for the mistake
 * bank before anything had been saved to it. The marks are here now, on the
 * screen the student is already looking at. See bankTray.js for what starts
 * ticked and why.
 *
 * ─── A ROW IS ONE CHECKBOX, THE WHOLE ROW ──────────────────────────────────
 * Tapping anywhere on a mark ticks it. A ten-pixel box to aim at on a phone is
 * the kind of control nobody uses twice. The question label is the one thing
 * on a row that does something else (it opens that question), so it sits in
 * the group header rather than inside a row.
 *
 * ─── SAVED IS SAID ON THE ROW, NOT BY A TOAST ──────────────────────────────
 * A saved mark keeps its place, ticked in the brand green, reading "in your
 * bank". It cannot be unticked: it exists now, and taking it out is the bank's
 * job, not the results screen's.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Bookmark, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkdownMath from "@/components/shared/MarkdownMath";
import { trayPicks, trayOpen, trayButton } from "@/lib/bankTray";

function Tick({ on, saved }) {
    return (
        <span aria-hidden="true"
            className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors
                ${saved ? "bg-primary border-primary" : on ? "bg-foreground border-foreground" : "border-muted-foreground/40"}`}>
            {(on || saved) && <Check className="w-3.5 h-3.5 text-background" strokeWidth={3.5} />}
        </span>
    );
}

export default function BankTray({ groups, banked, saving, onSave, onOpenQuestion, onOpenBank, children }) {
    const reduce = useReducedMotion();
    const [picked, setPicked] = useState(() => trayPicks(groups, banked));

    // The marking lands after the tray could first draw, and a re-mark can
    // change the list. Re-seed when the SET OF ROWS changes — not on every
    // render, or a student's untick would be put straight back.
    const sig = useMemo(() => groups.map((g) => g.rows.map((r) => r.key).join("|")).join("‖"), [groups]);
    const seeded = useRef(sig);
    useEffect(() => {
        if (seeded.current === sig) return;
        seeded.current = sig;
        setPicked(trayPicks(groups, banked));
    }, [sig, groups, banked]);

    const open = useMemo(() => trayOpen(groups, banked), [groups, banked]);
    const chosen = open.filter((r) => picked.has(r.key) && !saving.has(r.key));
    const inFlight = open.some((r) => saving.has(r.key));
    const savedCount = groups.reduce((n, g) => n + g.rows.filter((r) => banked.has(r.key)).length, 0);
    const allOn = open.length > 0 && open.every((r) => picked.has(r.key));

    const toggle = (key) => {
        if (banked.has(key) || saving.has(key)) return;
        setPicked((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };
    const setAll = (on) => setPicked(on ? new Set(open.map((r) => r.key)) : new Set());

    return (
        <motion.section data-bank-tray initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="card-soft p-5">
            <div className="flex items-center justify-between gap-3">
                <p className="stat-label text-streak flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5" /> Marks you dropped
                </p>
                {open.length > 1 && (
                    <button type="button" onClick={() => setAll(!allOn)} data-tray-all
                        className="text-xs font-bold text-muted-foreground hover:text-foreground underline underline-offset-4 flex-shrink-0">
                        {allOn ? "Untick all" : "Tick all"}
                    </button>
                )}
            </div>
            {children}

            <div className="mt-4 space-y-4">
                {groups.map((g) => (
                    <div key={g.qIndex} data-tray-question={g.qIndex}>
                        <div className="flex items-center gap-2 mb-1.5">
                            <button type="button" onClick={() => onOpenQuestion?.(g.qIndex)}
                                className="text-xs font-black text-foreground hover:text-primary underline-offset-4 hover:underline">
                                {g.label}
                            </button>
                            <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                                {g.blank ? "left blank — a question to sit again" : g.lost > 0 ? `−${g.lost} of ${g.outOf}` : "no marks lost"}
                            </span>
                            <span className="flex-1 h-px bg-border" aria-hidden="true" />
                        </div>
                        <ul className="space-y-1">
                            {g.rows.map((r) => {
                                const saved = banked.has(r.key);
                                const busy = saving.has(r.key);
                                const on = picked.has(r.key);
                                return (
                                    <li key={r.key}>
                                        <button type="button" role="checkbox" aria-checked={saved || on}
                                            aria-disabled={saved || busy} onClick={() => toggle(r.key)}
                                            data-tray-row={r.key} data-picked={on ? "1" : "0"} data-saved={saved ? "1" : "0"}
                                            className={`w-full text-left flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors
                                                ${saved ? "cursor-default" : "cursor-pointer hover:bg-secondary/60"}
                                                ${on && !saved ? "bg-secondary/50" : ""}`}>
                                            <Tick on={on} saved={saved} />
                                            <span className="min-w-0 flex-1">
                                                <MarkdownMath className={`text-sm font-bold leading-snug ${saved ? "text-muted-foreground" : "text-foreground"}`}>
                                                    {r.mod.text}
                                                </MarkdownMath>
                                                {r.quote && (
                                                    <span className="block text-xs text-muted-foreground italic leading-snug mt-0.5">
                                                        You wrote “{r.quote}”
                                                    </span>
                                                )}
                                            </span>
                                            <span className={`text-[11px] font-black tabular-nums flex-shrink-0 mt-0.5
                                                ${saved ? "text-primary" : r.cost > 0 ? "text-streak" : "text-xp"}`}>
                                                {saved ? "in bank" : busy ? "saving…" : r.cost > 0 ? `−${r.cost}` : "wording"}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-border flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-muted-foreground leading-snug">
                    {savedCount > 0
                        ? <>{savedCount} in your bank. Each comes back as a drill until you can write it.</>
                        : <>Each one comes back as a drill until you can write it, then on the real question.</>}
                </p>
                {open.length > 0 ? (
                    <Button data-tray-save disabled={!chosen.length || inFlight}
                        onClick={() => onSave?.(chosen)}
                        className="btn-3d gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl flex-shrink-0 w-full sm:w-auto">
                        <Bookmark className="w-4 h-4" />
                        {inFlight ? "Saving…" : trayButton(chosen.length)}
                    </Button>
                ) : (
                    <Button data-tray-open variant="outline" onClick={onOpenBank}
                        className="gap-2 rounded-xl border-2 border-border flex-shrink-0 w-full sm:w-auto">
                        Open my mistake bank <ArrowRight className="w-4 h-4" />
                    </Button>
                )}
            </div>
        </motion.section>
    );
}
