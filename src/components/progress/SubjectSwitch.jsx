/**
 * SubjectSwitch — one subject, across every feature tab.
 *
 * ─── EVERY FIGURE ON THIS PAGE WAS WHOLE-ACCOUNT ────────────────────────────
 * The question a student has in the week before a SAC is about ONE subject,
 * and the report could only answer it about all of them at once. The reports
 * already group by subject internally — `sliceBySubject` narrows the INPUTS,
 * so the outstanding rows, the figure, the line and every panel are about the
 * same subject and cannot disagree.
 *
 * ─── A SELECT, NOT CHIPS ────────────────────────────────────────────────────
 * The period switch beside it is three fixed options and is a segmented row
 * for that reason. A student has six subjects and a custom one, the names are
 * long ("Mathematical Methods"), and a wrapping chip row at 390 is two lines
 * of control above the thing it filters. The same call `subjectBrowse` makes
 * about its own long list.
 *
 * ─── IT IS NOT DRAWN FOR ONE SUBJECT ────────────────────────────────────────
 * A filter with a single option is the single-tab `Tabs` rule: nothing can be
 * switched to. A first-week account sees the period switch alone.
 *
 * ─── AND IT NEVER APPEARS ON TODAY ──────────────────────────────────────────
 * That tab is the cross-feature queue ranking all seven kinds against each
 * other; narrowing it would hide a SAC on Friday because somebody happened to
 * be looking at Legal. The parent decides, so this component does not have to
 * know which tab it is on.
 */
import React from "react";
import { Layers } from "lucide-react";
import { ALL_SUBJECTS } from "@/lib/progressReport";
import { tagLabel } from "@/lib/sacTags";

/*
 * ─── AND ONE SAC ─────────────────────────────────────────────────────────────
 * A SAC is a narrower question than a subject — its topics plus everything
 * tagged for it — so it is a second group in the SAME control rather than a
 * second control: two filters that could each be set would let a student ask
 * for "Chemistry" and "a Methods SAC" at once, which is no question at all.
 * `sliceByFolder` reads the SAC's own membership, so the report under it and
 * the folder in Revision cannot disagree. With one subject but a SAC to pick,
 * the control is drawn: there is something to switch to.
 */
export default function SubjectSwitch({ subjects = [], folders = [], value, onChange }) {
    if (subjects.length < 2 && !folders.length) return null;
    const on = value && value !== ALL_SUBJECTS;
    return (
        <label className={`inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1.5 rounded-xl border-2
            transition-colors cursor-pointer
            ${on ? "border-foreground/25 bg-surface" : "border-transparent bg-secondary"}`}>
            <Layers className={`w-3.5 h-3.5 flex-shrink-0 ${on ? "text-foreground" : "text-muted-foreground"}`}
                aria-hidden="true" />
            <span className="sr-only">Filter by subject or SAC</span>
            <select
                value={value || ALL_SUBJECTS}
                onChange={(e) => onChange(e.target.value)}
                className={`bg-transparent border-0 outline-none text-xs font-bold pr-1 cursor-pointer
                    max-w-[12rem] truncate ${on ? "text-foreground" : "text-muted-foreground"}`}>
                <option value={ALL_SUBJECTS}>All subjects</option>
                {subjects.length >= 2 && (
                    <optgroup label="Subjects">
                        {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                    </optgroup>
                )}
                {folders.length > 0 && (
                    <optgroup label="SACs">
                        {folders.map((f) => <option key={f.key} value={f.key}>{tagLabel(f)}</option>)}
                    </optgroup>
                )}
            </select>
        </label>
    );
}
