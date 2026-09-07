/**
 * LoadStrip — what the student is already carrying, above the catalogue.
 *
 * ─── Why this belongs on Browse ─────────────────────────────────────────────
 * Browse knew which subjects the student had — it was already drawing a tick
 * on them — and did nothing else with it. But every question asked on this
 * page is asked against an existing load: whether you still need an English,
 * whether you have enough studies, what the ones you have look like. Without
 * it the page is a catalogue you consult; with it, it is the screen where the
 * decision actually gets made.
 *
 * ─── Rules are checked. Strategy is not offered. ────────────────────────────
 * The two checks are real requirements a student can fail without knowing: an
 * ATAR needs a completed Unit 3–4 English sequence, and study scores in at
 * least four studies. Those are worth flagging.
 *
 * The scaling figure is REPORTED AND NOT JUDGED, and that restraint is the
 * point. Scaling reflects the strength of the cohort that sat a subject, not a
 * discount available to whoever picks it — so a strip that graded a load as
 * "scaling badly" would be pushing a student to drop subjects on a misreading
 * of what the number means. It says what the average is, over how many, and
 * stops.
 */
import React from "react";
import { Check, AlertTriangle, Layers } from "lucide-react";
import { MIN_ATAR_STUDIES } from "@/lib/subjectBrowse";

/**
 * One check. `ok` drives the icon and the ink together so they cannot
 * disagree — the failure ScalingMark exists to fix, on a smaller scale.
 */
function Rule({ ok, met, unmet }) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-[12px] font-bold ${
            ok ? "text-primary" : "text-xp"}`}>
            {ok ? <Check className="w-3.5 h-3.5 flex-shrink-0" />
                : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
            {ok ? met : unmet}
        </span>
    );
}

export default function LoadStrip({ summary }) {
    if (!summary) return null;
    const { count, hasEnglish, enough, avgScaling, scaledCount } = summary;

    // An account with nothing selected is not failing two requirements, it is
    // a student who has not started. Printing two warnings at somebody on
    // their first visit is scolding them for the app being empty.
    if (count === 0) {
        return (
            <div className="card-soft on-table px-4 py-3 mb-5 flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <p className="text-[13px] text-muted-foreground">
                    Nothing picked yet. Add subjects here and they turn up across the app.
                </p>
            </div>
        );
    }

    return (
        <div className="card-soft on-table px-4 py-3 mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="text-[13px] font-bold text-foreground">
                {count} subject{count === 1 ? "" : "s"}
            </p>

            <Rule ok={hasEnglish}
                met="English sequence"
                unmet="No English yet" />

            <Rule ok={enough}
                met={`${MIN_ATAR_STUDIES}+ studies`}
                unmet={`${MIN_ATAR_STUDIES - count} more for an ATAR`} />

            {/* Reported, not graded. See the note at the top of this file. */}
            {avgScaling != null && (
                <p className="text-[12px] text-muted-foreground tabular-nums sm:ml-auto">
                    Scales{" "}
                    <span className="font-bold text-foreground">
                        {avgScaling > 0 ? `+${avgScaling}` : avgScaling}
                    </span>{" "}
                    on average
                    {/* Says what it is an average OF, because "+N" subjects are
                        excluded rather than counted as zero. */}
                    {scaledCount < count ? ` across ${scaledCount} of ${count}` : ""}
                </p>
            )}
        </div>
    );
}
