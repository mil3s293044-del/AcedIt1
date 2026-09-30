/**
 * AgeGate — the birthday question, asked once, of everybody.
 *
 * ─── WHY A GATE AND NOT A WIZARD STEP ───────────────────────────────────────
 * A step in the signup wizard only ever catches NEW accounts. There are ~130
 * existing ones whose age has never been asked, and every claim the published
 * policies make about guardian consent is untrue of them too. So this renders
 * whenever the loaded profile's band is UNKNOWN, which is exactly the set of
 * people who have not answered — new and old alike — and disappears for good
 * once they have.
 *
 * ─── IT BLOCKS, AND THAT IS THE POINT ───────────────────────────────────────
 * Every other prompt in this app can be dismissed. This one cannot, because the
 * permissions hanging off the answer — whether a named minor can be posted to a
 * public board, whether an advertising network hears about them — are decided
 * by the app in the absence of an answer, and the safe default for those is
 * "no". A dismissable question would leave a student silently in the most
 * restricted state with no idea why the Compete tab had gone.
 *
 * ─── UNDER 13 IS REFUSED, AND SAID KINDLY ───────────────────────────────────
 * The account is not deleted from under them and nothing accusatory is said —
 * they are told the app is built for VCE and given the support address. The
 * refusal is enforced by `mayHoldAccount`; this screen is where a person meets
 * it. Deleting on the spot would destroy a child's data faster than anybody
 * could check whether the birthday was a typo, which is the wrong failure.
 *
 * ─── THE GUARDIAN STEP IS AN ACKNOWLEDGEMENT, NOT VERIFICATION ──────────────
 * A under-18 student confirms a parent or guardian knows and agrees, and that
 * declaration is stored with a timestamp. It is NOT verified — no email is
 * sent, nothing is checked — and the code says so plainly rather than implying
 * a rigour it does not have. Verifiable parental consent is a genuinely bigger
 * build and a question for a lawyer; what this closes is the gap between a
 * policy promising consent was sought and a product that never asked at all.
 */
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";
import { ageBand, BAND, MIN_AGE, needsGuardian } from "@/lib/compliance";

export default function AgeGate({ onSave }) {
    const [dob, setDob] = useState("");
    const [guardian, setGuardian] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const band = useMemo(() => (dob ? ageBand(dob) : BAND.UNKNOWN), [dob]);
    const tooYoung = band === BAND.UNDER_MIN;
    const wantsGuardian = needsGuardian(band);
    // A valid date that is not a refusal, plus the guardian tick where one is
    // required. `BAND.UNKNOWN` covers an empty box and a half-typed date.
    const canSave = band !== BAND.UNKNOWN && !tooYoung && (!wantsGuardian || guardian);

    const save = async () => {
        if (!canSave || saving) return;
        setSaving(true);
        setError(null);
        try {
            await onSave({
                date_of_birth: dob,
                // Recorded as a declaration with its own timestamp, so it is
                // legible later as "they said so on this date" and never as
                // "we verified this".
                ...(wantsGuardian
                    ? { guardian_ack: { declared_at: new Date().toISOString() } }
                    : {}),
            });
        } catch (e) {
            // The gate must never strand somebody on a failed write with no way
            // back — it stays open and says what happened.
            setError(e?.message || "That didn't save. Try again in a moment.");
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-background/95 backdrop-blur-sm
            flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="w-full max-w-md card-soft on-table p-6 my-8"
                role="dialog"
                aria-modal="true"
                aria-label="Confirm your age"
            >
                <ShieldCheck className="w-7 h-7 text-primary mb-3" aria-hidden="true" />
                <h2 className="font-display font-black text-xl text-foreground mb-1.5">
                    One quick thing
                </h2>
                <p className="text-sm text-muted-foreground mb-5">
                    We need your date of birth to know which parts of AcedIt to switch on.
                    It decides whether you appear on the Compete board and whether we&rsquo;re
                    allowed to use analytics on your account. We ask once.
                </p>

                <label htmlFor="acedit-dob" className="block text-xs font-bold text-foreground mb-1.5">
                    Date of birth
                </label>
                <Input
                    id="acedit-dob"
                    type="date"
                    value={dob}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => { setDob(e.target.value); setGuardian(false); }}
                    className="mb-4"
                />

                {tooYoung && (
                    <div className="rounded-xl bg-secondary p-3.5 mb-4">
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
                    <label className="flex gap-3 items-start rounded-xl bg-secondary p-3.5 mb-4 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={guardian}
                            onChange={(e) => setGuardian(e.target.checked)}
                            className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
                        />
                        <span className="text-sm text-muted-foreground">
                            A parent or guardian knows I use AcedIt and agrees to the{" "}
                            <a href="/Terms" className="text-primary underline">Terms</a> and{" "}
                            <a href="/Privacy" className="text-primary underline">Privacy Policy</a>.
                        </span>
                    </label>
                )}

                {error && <p className="text-sm text-streak font-semibold mb-3">{error}</p>}

                <Button className="w-full font-bold" disabled={!canSave || saving} onClick={save}>
                    {saving ? "Saving…" : "Save and continue"}
                </Button>

                {/* A disabled button that does not say why is the paper-cut this
                    codebase already records about Active Recall's generate. */}
                {!canSave && !tooYoung && (
                    <p className="text-xs text-muted-foreground mt-2.5 text-center">
                        {!dob || band === BAND.UNKNOWN
                            ? "Enter your date of birth to continue."
                            : "Tick the box above to continue."}
                    </p>
                )}
            </motion.div>
        </div>
    );
}
