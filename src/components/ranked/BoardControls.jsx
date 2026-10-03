/**
 * BoardControls — who you are measured against, and on what.
 *
 * ─── ONE SEGMENTED CONTROL, not six bordered chips ──────────────────────────
 * The board header used to carry three board chips and three scope chips on
 * one line. At 360px that is six buttons across, each with a 2px border, which
 * is why the top of the board read as a toolbar rather than as a leaderboard —
 * and the second row of them was answering a question ("ATAR, XP or hours?")
 * that the page now answers with its TABS instead: the ATAR is a trailing
 * 28-day score and lives with the panel that explains it, XP and study time
 * are lifetime totals and live together.
 *
 * So each board tab needs one control, and it is a real segmented switch:
 * inset on the secondary ground with the live segment lifted onto the surface.
 * That is deliberately QUIETER than the tab bar above it, which is filled in
 * the foreground ink — two controls drawn identically, one inside the other,
 * is how a student loses track of which one they are using.
 *
 * ─── AND A DISABLED SEGMENT SAYS WHY ────────────────────────────────────────
 * School sat greyed out with no explanation for anybody who had not set one.
 * The app's own rule, from Active Recall's generate button: a disabled control
 * that does not say what unlocks it is a dead end.
 */
import React from "react";
import { GraduationCap, Zap, Clock } from "lucide-react";
import { SCOPES } from "@/lib/ranked";

/** `BOARDS` carries icon NAMES, because it is a pure module the tests load. */
const ICONS = { GraduationCap, Zap, Clock };

const SEG = "flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 " +
    "rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap " +
    "disabled:opacity-40 disabled:cursor-not-allowed";
const ON = "bg-surface text-foreground shadow-sm";
const OFF = "text-muted-foreground hover:text-foreground";

function Track({ children, label }) {
    return (
        <div role="group" aria-label={label}
            className="inline-flex w-full sm:w-auto p-1 gap-0.5 rounded-xl bg-secondary border border-border">
            {children}
        </div>
    );
}

export function ScopeSwitch({ scope, onScope, hasSchool }) {
    return (
        <Track label="Who you are ranked against">
            {SCOPES.map(s => {
                const locked = s.id === "school" && !hasSchool;
                return (
                    <button key={s.id} type="button" data-scope={s.id}
                        onClick={() => onScope(s.id)} disabled={locked}
                        aria-pressed={scope === s.id}
                        title={locked ? "Add your school in Settings to see this board" : s.blurb}
                        className={`${SEG} ${scope === s.id ? ON : OFF}`}>
                        {s.label}
                    </button>
                );
            })}
        </Track>
    );
}

export function BoardSwitch({ boards, board, onBoard }) {
    // A switch with one thing to switch to is chrome pretending to be
    // navigation — the single-tab `Tabs` the Quizzes shelf deleted.
    if (!boards || boards.length < 2) return null;
    return (
        <Track label="Which board">
            {boards.map(b => {
                const Icon = ICONS[b.icon];
                return (
                    <button key={b.id} type="button" data-board={b.id}
                        onClick={() => onBoard(b.id)} aria-pressed={board === b.id}
                        className={`${SEG} ${board === b.id ? ON : OFF}`}>
                        {Icon && <Icon className="w-3.5 h-3.5" />} {b.label}
                    </button>
                );
            })}
        </Track>
    );
}
