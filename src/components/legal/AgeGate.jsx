/**
 * AgeGate — the birthday question, asked once, of everybody.
 *
 * ─── IT IS THE OTHER HALF OF THE WIZARD'S QUESTION, NOT A SECOND ONE ────────
 * A step in the signup wizard only ever catches NEW accounts. There are ~130
 * existing ones whose age has never been asked, and every claim the published
 * policies make about guardian consent is untrue of them too. So this renders
 * whenever the loaded profile's band is UNKNOWN, which is exactly the set of
 * people who have not answered — and since the wizard now asks as well, a new
 * account has already answered by the time it gets here and never sees this at
 * all. Between them it is asked ONCE, of everybody. The control itself is
 * `AgeAnswer`, shared with the wizard: two copies of a legal-facing field is
 * the mirror this codebase keeps deleting, and the copy that drifts would be
 * the one that stops asking for consent.
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
import React, { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import AgeAnswer, { ageAnswerReady, ageAnswerPatch, ageAnswerHint } from "@/components/legal/AgeAnswer";

export default function AgeGate({ onSave }) {
    const [dob, setDob] = useState("");
    const [guardian, setGuardian] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const canSave = ageAnswerReady(dob, guardian);
    const hint = ageAnswerHint(dob, guardian);
    const patch = useCallback((p) => {
        if ("dob" in p) setDob(p.dob);
        if ("guardian" in p) setGuardian(p.guardian);
    }, []);

    const save = async () => {
        if (!canSave || saving) return;
        setSaving(true);
        setError(null);
        try {
            // Recorded as a declaration with its own timestamp, so it is
            // legible later as "they said so on this date" and never as
            // "we verified this".
            await onSave(ageAnswerPatch(dob, guardian));
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

                <AgeAnswer dob={dob} guardian={guardian} onChange={patch} />

                <div className="h-4" />

                {error && <p className="text-sm text-streak font-semibold mb-3">{error}</p>}

                <Button className="w-full font-bold" disabled={!canSave || saving} onClick={save}>
                    {saving ? "Saving…" : "Save and continue"}
                </Button>

                {/* A disabled button that does not say why is the paper-cut this
                    codebase already records about Active Recall's generate. */}
                {!canSave && hint && (
                    <p className="text-xs text-muted-foreground mt-2.5 text-center">{hint}</p>
                )}
            </motion.div>
        </div>
    );
}
