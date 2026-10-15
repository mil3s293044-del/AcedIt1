/**
 * AceVerdict — Ace, reading the one sentence each Progress tab has to say.
 *
 * ─── HE SAYS WHAT THE PAGE ALREADY COMPUTED, AND NOTHING ELSE ──────────────
 * The line is `verdictFor`'s, or the strip's note saying why there is no
 * comparison yet — never a sentence written for him. A mascot that adds his
 * own commentary on top of a report is a second answer to a question the
 * report already answered, and the one answer nobody can check: the reason the
 * AI coach was deleted from this page. So he is a VOICE for the verdict, not a
 * source of one, and a tab whose verdict is allowed to say nothing has him say
 * nothing — no line, no Ace.
 *
 * ─── HIS POSE FOLLOWS THE MOVEMENT ─────────────────────────────────────────
 * Up is a cheer, down is thinking it over, level or "not enough yet" is a
 * shrug. Never disappointment: a sentence reading "Down 6 points on last week"
 * already lands, and a mascot looking let down beside it turns a fact into a
 * judgement of the student.
 *
 * ─── ONE ACE ON SCREEN ─────────────────────────────────────────────────────
 * He claims the stage as `"report"`, which `ACE_ORDER` ranks under the first
 * run and the tour and above the buddy and the launcher — on a page that is
 * saying something, the ambient Ace stands down. When something outranks him
 * (an XP celebration, a tour stop) he steps out and the sentence stays as
 * plain text, because the verdict is the content and he is only its voice.
 *
 * ─── THE BUBBLE IS FLAT ────────────────────────────────────────────────────
 * On this page a bordered, elevated box means something you PRESS. A speech
 * bubble is not one, so it is a flat tint with the speech corner, and nothing
 * about it says "tap me".
 */
import React, { useEffect } from "react";
import AceBody from "@/components/ace/AceBody";
import { AceSay, AceLine } from "@/components/ace/AceWalker";
import { claimAce, useAceClaimed } from "@/components/ace/useAceYield";

const POSE = { good: "cheer", watch: "think", flat: "ponder", note: "ponder", lead: "point" };
const INK = {
    good: "text-primary",
    watch: "text-streak",
    flat: "text-foreground",
    note: "text-muted-foreground",
};

export default function AceVerdict({ line, tone = "flat", headline = null }) {
    useEffect(() => claimAce("report"), []);
    const outranked = useAceClaimed("report");
    const pose = POSE[tone] || "stand";

    // The headline variant: Ace beside the page's own h1, no bubble — the
    // heading IS what he is saying.
    if (headline) {
        return (
            <div className="flex items-end gap-3 sm:gap-4">
                {!outranked && (
                    <AceBody className="w-12 sm:w-14 flex-shrink-0 -mb-1" pose={pose} title="Ace" />
                )}
                <div className="min-w-0 flex-1">{headline}</div>
            </div>
        );
    }

    if (!line) return null;
    const ink = INK[tone] || INK.flat;

    if (outranked) {
        return <p className={`text-sm leading-snug font-semibold ${ink}`}>{line}</p>;
    }

    return (
        <div className="flex items-end gap-2.5" data-ace-verdict={tone}>
            <AceBody className="w-11 sm:w-12 flex-shrink-0 -mb-0.5" pose={pose} title="Ace" />
            <div className="relative min-w-0 rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2.5">
                <AceSay beat={line}>
                    <AceLine className={`text-sm leading-snug font-semibold text-balance ${ink}`}>
                        {line}
                    </AceLine>
                </AceSay>
            </div>
        </div>
    );
}
