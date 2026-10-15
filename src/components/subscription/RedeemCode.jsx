import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ticket, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { takeFn } from "@/lib/fnResult";
import { fmtDate } from "@/lib/safeDate";
import { createPageUrl } from "@/utils";
import { normaliseCode, cleanName, nameProblem, NAME_MAX, CODE_MAX } from "@/lib/premiumCodes";
import AceShuffle from "@/components/ace/AceShuffle";

/**
 * "Have a code?" on /Subscription — a name and a code, and Premium switches on.
 * No card. The server (`redeemPremiumCode`) decides; this only asks.
 *
 * It starts as one quiet line rather than an open form: a code box on a page
 * that sells a subscription reads as "there is a discount somewhere" to every
 * student who has not been given one. The students who have been told to look
 * for it will find a line that says exactly what they were told.
 *
 * `redeem` is injectable so `scripts/_floorProbe.jsx?v=redeem` can draw every
 * state — the real call goes through base44, which a probe cannot intercept.
 */
async function redeemViaApi({ name, code }) {
    try {
        return takeFn(await base44.functions.invoke("redeemPremiumCode", { name, code }));
    } catch (err) {
        // Refusals arrive as a plain message (takeFn). A non-2xx arrives as
        // "Function 'x' failed (500): {json}", which is not for a student.
        const msg = String(err?.message || "");
        let fromBody = null;
        const at = msg.indexOf("{");
        if (at >= 0) { try { fromBody = JSON.parse(msg.slice(at))?.error || null; } catch { /* not JSON */ } }
        if (fromBody) throw new Error(fromBody);
        if (!msg || /failed \(\d+\)/.test(msg)) throw new Error("Couldn't check that code just now. Try again in a minute.");
        throw err;
    }
}

export default function RedeemCode({ redeem = redeemViaApi, defaultOpen = false, onRedeemed }) {
    const [open, setOpen] = useState(defaultOpen);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(null);

    const submit = async (e) => {
        e.preventDefault();
        if (busy) return;
        const badName = nameProblem(name);
        if (badName) { setError(badName); return; }
        if (!normaliseCode(code)) { setError("Enter the code you were given."); return; }
        setBusy(true);
        setError(null);
        try {
            const result = await redeem({ name: cleanName(name), code: normaliseCode(code) });
            setDone(result);
            onRedeemed?.(result);
        } catch (err) {
            setError(err?.message || "That didn't work. Try again.");
        } finally {
            setBusy(false);
        }
    };

    if (done) {
        return (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="card-soft p-5 sm:p-6 border-2 border-primary/30 bg-primary/5">
                <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Check className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-display font-extrabold text-foreground text-lg">You're in. Premium is on.</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Every AI tool is unlocked until {fmtDate(done.premium_until, "EEEE d MMMM")}. Make it count.
                        </p>
                        {/* A full load, so the nav, the gates and every cached
                            profile read pick up Premium at once. */}
                        <Button onClick={() => window.location.assign(createPageUrl("Dashboard"))}
                            className="mt-4 btn-3d rounded-xl font-display font-extrabold">
                            Start studying
                        </Button>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <AnimatePresence initial={false} mode="popLayout">
            {!open ? (
                <motion.button key="line" type="button" onClick={() => setOpen(true)}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    <Ticket className="w-4 h-4" />
                    Have a code? Enter it here
                </motion.button>
            ) : (
                <motion.form key="form" onSubmit={submit} noValidate
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="card-soft p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                            <h3 className="font-display font-extrabold text-foreground text-lg">Unlock Premium with a code</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">For students in a school program. No card needed.</p>
                        </div>
                        <button type="button" onClick={() => { setOpen(false); setError(null); }}
                            aria-label="Close" className="text-muted-foreground hover:text-foreground cursor-pointer p-1 -m-1">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="redeem-name">Your full name</Label>
                            <Input id="redeem-name" value={name} maxLength={NAME_MAX} autoComplete="name"
                                placeholder="First and last name"
                                onChange={(e) => { setName(e.target.value); setError(null); }} />
                            <p className="text-xs text-muted-foreground">So we can match you to your school's program.</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="redeem-code">Code</Label>
                            <Input id="redeem-code" value={code} maxLength={CODE_MAX} autoComplete="off"
                                autoCapitalize="characters" spellCheck={false} placeholder="e.g. ABC123"
                                className="uppercase tracking-wider font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:font-normal"
                                onChange={(e) => { setCode(e.target.value); setError(null); }} />
                        </div>
                    </div>

                    {error && (
                        <p role="alert" className="mt-4 text-sm font-medium text-destructive">{error}</p>
                    )}

                    <Button type="submit" disabled={busy} className="mt-5 w-full sm:w-auto btn-3d rounded-xl font-display font-extrabold">
                        {busy ? <AceShuffle size="sm" className="mr-2" /> : <Ticket className="w-4 h-4 mr-2" />}
                        Unlock Premium
                    </Button>
                </motion.form>
            )}
        </AnimatePresence>
    );
}
