/**
 * AgeAnswer — the birthday question and its consequences, drawn ONCE.
 *
 * ─── IT WAS ASKED TWICE, IN TWO FORMS ───────────────────────────────────────
 * The signup wizard opens by asking what YEAR LEVEL somebody is in, and
 * `AgeGate` then blocked the whole app asking for a DATE OF BIRTH. Two
 * age-shaped questions back to back on a new account's first two minutes.
 *
 * The gate cannot simply go: it is the only thing that reaches the ~130
 * existing accounts, which are exactly the ones the published policies were
 * already making promises about, and a wizard step only ever catches new
 * signups. So the WIZARD asks as well, and the gate then never fires for
 * anybody who answered there — `bandOfProfile` is UNKNOWN only while the date
 * is missing. One ask per student, with the coverage unchanged.
 *
 * That makes this the shared half: the field, the refusal and the guardian
 * acknowledgement, with the rules in `compliance.js` as they already were. Two
 * copies of a legal-facing control is the mirror this codebase keeps deleting,
 * and it is a worse one than most — the copy that drifts is the one that stops
 * asking for consent.
 *
 * ─── A YEAR LEVEL IS NOT AN AGE, and must never be read as one. ─────────────
 * "Year 11" spans fifteen, sixteen and seventeen, and the thresholds here are
 * exactly 13, 16 and 18. Deriving the band from the year level would put a
 * fifteen-year-old on a public board on a guess, which is the one error this
 * whole area exists to prevent.
 *
 * ─── IT REPORTS, IT DOES NOT SAVE ───────────────────────────────────────────
 * `onChange` hands back the patch the caller writes — the gate writes it
 * immediately, the wizard carries it to the end with the rest of the answers —
 * and `ready` says whether it may be accepted at all. Deciding where it is
 * stored is the caller's; deciding whether it is a valid answer is this file's,
 * once.
 */
import React, { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { ageBand, BAND, MIN_AGE, needsGuardian } from "@/lib/compliance";

/** Whether a date and a guardian tick together make an acceptable answer. */
export function ageAnswerReady(dob, guardian) {
    const band = dob ? ageBand(dob) : BAND.UNKNOWN;
    // UNKNOWN covers an empty box AND a half-typed date, which is why the check
    // is on the band rather than on the string being non-empty.
    return band !== BAND.UNKNOWN && band !== BAND.UNDER_MIN
        && (!needsGuardian(band) || guardian);
}

/** The patch a ready answer writes. Recorded as a declaration, never a check. */
export function ageAnswerPatch(dob, guardian) {
    const band = dob ? ageBand(dob) : BAND.UNKNOWN;
    return {
        date_of_birth: dob,
        ...(needsGuardian(band) && guardian
            ? { guardian_ack: { declared_at: new Date().toISOString() } }
            : {}),
    };
}

export default function AgeAnswer({ dob, guardian, onChange, idPrefix = "acedit" }) {
    const band = useMemo(() => (dob ? ageBand(dob) : BAND.UNKNOWN), [dob]);
    const tooYoung = band === BAND.UNDER_MIN;
    const wantsGuardian = needsGuardian(band);

    // A TICK FOLLOWS ITS DATE. Changing the birthday after ticking would leave
    // a consent attached to an age nobody declared it against, so the box
    // clears whenever the date moves — handled here rather than at each caller,
    // which is the kind of rule that gets implemented in one of two places.
    useEffect(() => {
        if (guardian && !wantsGuardian) onChange({ guardian: false });
    }, [guardian, wantsGuardian, onChange]);

    return (
        <div>
            <label htmlFor={`${idPrefix}-dob`} className="block text-xs font-bold text-foreground mb-1.5">
                Date of birth
            </label>
            <Input
                id={`${idPrefix}-dob`}
                type="date"
                value={dob}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => onChange({ dob: e.target.value, guardian: false })}
            />

            {tooYoung && (
                <div className="rounded-xl bg-secondary p-3.5 mt-4">
                    <p className="text-sm font-bold text-foreground mb-1">
                        AcedIt is built for VCE students
                    </p>
                    <p className="text-sm text-muted-foreground">
                        You need to be at least {MIN_AGE} to have an account. Nothing has been
                        deleted &mdash; if that date was a slip, correct it above. Otherwise
                        email{" "}
                        <a href="mailto:support@acedit.au" className="text-primary underline">
                            support@acedit.au
                        </a>{" "}
                        and we&rsquo;ll sort it out.
                    </p>
                </div>
            )}

            {wantsGuardian && (
                <label className="flex gap-3 items-start rounded-xl bg-secondary p-3.5 mt-4 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={guardian}
                        onChange={(e) => onChange({ guardian: e.target.checked })}
                        className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
                    />
                    <span className="text-sm text-muted-foreground">
                        A parent or guardian knows I use AcedIt and agrees to the{" "}
                        <a href="/Terms" className="text-primary underline">Terms</a> and{" "}
                        <a href="/Privacy" className="text-primary underline">Privacy Policy</a>.
                    </span>
                </label>
            )}
        </div>
    );
}

/** What to say under a disabled button, which must never refuse in silence. */
export function ageAnswerHint(dob, guardian) {
    const band = dob ? ageBand(dob) : BAND.UNKNOWN;
    if (band === BAND.UNDER_MIN) return null;          // the panel above says it
    if (band === BAND.UNKNOWN) return "Enter your date of birth to continue.";
    if (needsGuardian(band) && !guardian) return "Tick the box above to continue.";
    return null;
}

export { BAND, ageBand };
