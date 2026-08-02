// ════════════════════════════════════════════════════════════════════════════
// /reset-password — consume the Supabase password-recovery link and let the
// user set a new password.
//
// The ONLY trusted signal that we're in a real recovery flow is the
// PASSWORD_RECOVERY auth event, which AuthContext catches and exposes as
// recoveryInProgress. We never check supabase.auth.getSession() directly
// here — if the visitor was already signed in as someone else when they
// clicked the email link, getSession() can return the wrong account
// before the recovery session takes over, and a naive read would let
// them silently change the wrong user's password.
//
// On submit, after the password update succeeds, we sign out the recovery
// session so the next sign-in is a clean fresh login.
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

// How long to wait for the PASSWORD_RECOVERY event after mount before
// declaring the link invalid/expired. Supabase processes the URL token
// during the supabase-js init — usually completes in a few hundred ms but
// can stretch to a few seconds on slow networks or cold-cache clients.
// 8s is generous without leaving the user staring at a spinner forever.
const RECOVERY_WAIT_MS = 8000;

export default function ResetPassword() {
    const navigate = useNavigate();
    const { recoveryInProgress, user } = useAuth();

    // null = still waiting for the PASSWORD_RECOVERY event;
    // true  = recovery flow confirmed, show the form;
    // false = waited long enough without the event → invalid/expired link.
    const [recoveryState, setRecoveryState] = useState(null);
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    // Watch for AuthContext flipping recoveryInProgress → true. Once it does,
    // we're committed to the recovery UI. If it stays false past the timeout,
    // the user landed here without a valid recovery token.
    useEffect(() => {
        if (recoveryInProgress) {
            setRecoveryState(true);
            return;
        }
        const t = setTimeout(() => {
            setRecoveryState((prev) => prev === null ? false : prev);
        }, RECOVERY_WAIT_MS);
        return () => clearTimeout(t);
    }, [recoveryInProgress]);

    const submit = async (e) => {
        e?.preventDefault?.();
        setError(null);

        // Defensive: only allow the update if AuthContext has confirmed this
        // is a recovery flow. The UI already gates on this, but a paranoid
        // check here means even if state slipped through, we don't write.
        if (!recoveryInProgress) {
            setError("Recovery session expired. Request a new reset link.");
            return;
        }

        if (password.length < 8) {
            setError("Password needs to be at least 8 characters.");
            return;
        }
        if (password !== confirm) {
            setError("Passwords don't match.");
            return;
        }

        setIsSubmitting(true);
        const { error: updateError } = await supabase.auth.updateUser({ password });
        setIsSubmitting(false);

        if (updateError) {
            const msg = updateError.message || "";
            if (/same.*password|new.*password.*different/i.test(msg)) {
                setError("That's already your current password. Pick a different one.");
            } else {
                setError(msg || "Couldn't update password. Try again in a moment.");
            }
            return;
        }
        setDone(true);
        // Sign out the recovery session so the next sign-in is a deliberate
        // login with the new password. Without this, the user stays signed in
        // via the recovery session — which is fine in theory but mixes the
        // recovery and normal paths.
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="border-b border-border/60 bg-background/95">
                <div className="max-w-2xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <GraduationCap className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-display font-extrabold text-base text-foreground">AcedIt</span>
                    </Link>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center px-4 lg:px-6 py-10">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full max-w-md"
                >
                    {recoveryState === null ? (
                        // Checking — small spinner-equivalent
                        <div className="text-center text-sm text-muted-foreground">Loading…</div>
                    ) : recoveryState === false ? (
                        // No PASSWORD_RECOVERY event fired within the wait window —
                        // user landed here without a valid recovery link
                        <div className="card-soft p-6 text-center">
                            <h1 className="font-display font-extrabold text-foreground text-2xl tracking-tight mb-3">
                                Link expired or invalid
                            </h1>
                            <p className="text-sm text-muted-foreground mb-5">
                                Password reset links work once and expire after an hour. Request a new one.
                            </p>
                            <Link
                                to="/forgot-password"
                                className="inline-flex btn-3d bg-primary text-primary-foreground hover:bg-primary rounded-xl px-5 h-11 items-center justify-center font-bold text-sm"
                            >
                                Send a new link
                            </Link>
                        </div>
                    ) : done ? (
                        // Success — recovery session has been signed out, send user to /login
                        // to deliberately re-authenticate with the new password.
                        <div>
                            <div className="mb-6 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/15 mx-auto mb-4 flex items-center justify-center">
                                    <CheckCircle2 className="w-7 h-7 text-primary" strokeWidth={2.5} />
                                </div>
                                <h1 className="font-display font-extrabold text-foreground text-3xl tracking-tight">
                                    Password updated
                                </h1>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Sign in with your new password to keep going.
                                </p>
                            </div>
                            <Button
                                onClick={() => navigate("/login", { replace: true })}
                                className="btn-3d bg-primary text-primary-foreground hover:bg-primary w-full h-12 rounded-xl font-display font-extrabold text-base"
                            >
                                Sign in <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    ) : (
                        // Set new password form
                        <>
                            <div className="mb-6 text-center">
                                <h1 className="font-display font-extrabold text-foreground text-3xl tracking-tight">
                                    Set a new password
                                </h1>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Pick something you'll remember.
                                </p>
                                {user?.email && (
                                    <p className="text-xs text-muted-foreground mt-3">
                                        Updating password for{" "}
                                        <span className="font-bold text-foreground">{user.email}</span>
                                    </p>
                                )}
                            </div>

                            <div className="card-soft p-6">
                                <form onSubmit={submit} className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-foreground mb-1.5 block">New password</label>
                                        <Input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="At least 8 characters"
                                            autoComplete="new-password"
                                            className="h-11"
                                            disabled={isSubmitting}
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-foreground mb-1.5 block">Confirm password</label>
                                        <Input
                                            type="password"
                                            value={confirm}
                                            onChange={(e) => setConfirm(e.target.value)}
                                            placeholder="Type it again"
                                            autoComplete="new-password"
                                            className="h-11"
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    {error && (
                                        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive font-medium">
                                            {error}
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="btn-3d bg-primary text-primary-foreground hover:bg-primary w-full h-12 rounded-xl font-display font-extrabold text-base disabled:opacity-60"
                                    >
                                        {isSubmitting ? "Saving…" : "Update password"}
                                    </Button>
                                </form>
                            </div>
                        </>
                    )}
                </motion.div>
            </main>
        </div>
    );
}
