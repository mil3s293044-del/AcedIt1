/**
 * ComposerSetup — the subject and the tool's own settings, behind one chip.
 *
 * ─── A CHIP CLOUD ABOVE THE COMPOSER COST THE PHONE ITS THREAD ──────────────
 * Every tool's options (strand, depth, section, output…) were drawn as rows of
 * pills directly above the composer, on every turn, at full size. On a 390px
 * phone that was two rows of chips running off the right edge ("Spe…"), on top
 * of a composer, under a three-button header — about 260px of controls,
 * leaving a third of the screen for the conversation the page exists to show.
 * They are set once a chat, so they live behind one chip that SAYS what is set
 * ("Chemistry · Deep dive") and opens to change it.
 *
 * ─── THE SUBJECT AND THE STRAND WERE TWO CONTROLS FOR ONE FACT ──────────────
 * Math Tutor offered "No subject" beside a strand reading "Mathematical
 * Methods", free to disagree, and the prompt settled it by letting the strand
 * win silently. When the subject is one of the four maths studies it decides
 * the strand (`strandFor`) and the strand row is not drawn.
 *
 * Not portalled, for the reason ToolPalette gives: the room's tokens are blank
 * outside `.console`.
 */
import React, { useEffect, useRef } from "react";
import { resolveChoices } from "./chatTools";
import { strandFor } from "@/lib/chatModel";

/** One selectable pill. The selected state is the room's accent, not the tool's hue. */
function Pill({ on, onClick, children, title }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            aria-pressed={on}
            className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-bold transition-colors
                ${on
                    ? "border-[rgb(var(--console-accent-rgb)/0.5)] bg-[rgb(var(--console-accent-rgb)/0.12)] text-[var(--console-accent-ink)]"
                    : "border-[var(--console-line)] bg-[var(--console-panel)] text-[var(--console-ink-dim)] hover:text-[var(--console-ink)]"}`}
        >
            {children}
        </button>
    );
}

/** The groups that are the student's to set — the strand only when no maths subject decides it. */
export function visibleGroups(tool, subject) {
    return (tool?.options || []).filter((g) => !(g.key === "strand" && strandFor(subject)));
}

export default function ComposerSetup({
    tool,
    options = {},
    subject = "",
    subjects = [],
    placement = "up",
    anchorRef = null,
    shortName = (s) => s,
    onSubject,
    onOption,
    onClose,
}) {
    const rootRef = useRef(null);
    useEffect(() => {
        const down = (e) => {
            if (rootRef.current?.contains(e.target)) return;
            if (anchorRef?.current?.contains(e.target)) return;
            onClose?.();
        };
        const key = (e) => { if (e.key === "Escape") onClose?.(); };
        document.addEventListener("mousedown", down);
        document.addEventListener("touchstart", down, { passive: true });
        document.addEventListener("keydown", key);
        return () => {
            document.removeEventListener("mousedown", down);
            document.removeEventListener("touchstart", down);
            document.removeEventListener("keydown", key);
        };
    }, [anchorRef, onClose]);

    const groups = visibleGroups(tool, subject);

    return (
        <div
            ref={rootRef}
            className={`absolute left-0 right-0 z-30 max-h-[min(24rem,56vh)] overflow-y-auto rounded-2xl border
                border-[var(--console-line)] bg-[var(--console-panel)] p-3.5 shadow-soft-lg space-y-3.5
                ${placement === "up" ? "bottom-full mb-2" : "top-full mt-2"}`}
        >
            <div>
                <p className="mb-1.5 text-[11px] font-bold text-[var(--console-ink-faint)]">Subject</p>
                <div className="flex flex-wrap gap-1.5">
                    <Pill on={!subject} onClick={() => onSubject?.("")}>Any subject</Pill>
                    {subjects.map((s) => (
                        <Pill key={s} on={subject === s} onClick={() => onSubject?.(s)} title={s}>
                            {shortName(s)}
                        </Pill>
                    ))}
                </div>
                {/* What choosing a subject actually changes, said once: it is
                    what loads that study's VCAA examiner profile into the
                    prompt, which is the difference between "a VCE expert" and
                    an examiner for Chemistry. */}
                <p className="mt-1.5 text-[11px] leading-snug text-[var(--console-ink-faint)]">
                    {subject
                        ? `Answers are written against the ${subject} study design.`
                        : "Pick one and answers follow that study design and its marking."}
                </p>
            </div>
            {groups.map((group) => (
                <div key={group.key}>
                    <p className="mb-1.5 text-[11px] font-bold text-[var(--console-ink-faint)]">{group.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                        {resolveChoices(group, options).map((c) => (
                            <Pill key={c.value} on={options[group.key] === c.value} onClick={() => onOption?.(group.key, c.value)}>
                                {c.label}
                            </Pill>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
