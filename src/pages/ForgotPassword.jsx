// ════════════════════════════════════════════════════════════════════════════
// /forgot-password — request a Supabase password-reset email.
//
// We always show the success state (even for unknown emails) to avoid
// enumeration. Supabase only sends an email if the address actually exists
// and has a password identity — Google-only accounts get nothing, which is
// fine since they should be using Google to sign in anyway.
// ════════════════════════════════════════════════════════════════════════════
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";

export default function ForgotPassword() {
    const { requestPasswordReset } = useAuth();
    const [email, setEmail] = useState("");
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const submit = async (e) => {
        e?.preventDefault?.();
        setError(null);

        const trimmedEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setError("Enter a valid email address.");
            return;
        }

        setIsSubmitting(true);
        const { ok, error: resetError } = await requestPasswordReset(trimmedEmail);
        setIsSubmitting(false);

        if (!ok) {
            const msg = resetError?.message || "";
            if (/rate|too many/i.test(msg)) {
                setError("Too many attempts — try again in a minute.");
            } else {
                setError(msg || "Couldn't send reset email. Try again in a moment.");
            }
            return;
        }
        setSent(true);
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="border-b border-border/60 bg-background/95">
                <div className="max-w-2xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <GraduationCap className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-display font-extrabold text-base text-foreground">Acedit</span>
                    </Link>
                    <Link to="/login" className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
                        <ArrowLeft className="w-3 h-3" /> Back to sign in
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
                    {sent ? (
                        <div>
                            <div className="mb-6 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/15 mx-auto mb-4 flex items-center justify-center">
                                    <Mail className="w-7 h-7 text-primary" strokeWidth={2.5} />
                                </div>
                                <h1 className="font-display font-extrabold text-foreground text-3xl tracking-tight">
                                    Check your inbox
                                </h1>
                                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                    If <span className="font-bold text-foreground">{email}</span> has an Acedit
                                    account with a password, you'll get a reset link in the next minute.
                                </p>
                            </div>
                            <div className="card-soft p-5 space-y-3 text-xs text-muted-foreground leading-relaxed">
                                <p>
                                    <span className="font-bold text-foreground">No email?</span> You might have signed up with Google — try{" "}
                                    <Link to="/login" className="text-primary font-bold hover:underline">
                                        Continue with Google
                                    </Link>{" "}instead.
                                </p>
                                <p>Otherwise check spam, or try a different email.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6 text-center">
                                <h1 className="font-display font-extrabold text-foreground text-3xl tracking-tight">
                                    Reset your password
                                </h1>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Pop in your email and we'll send you a link.
                                </p>
                            </div>

                            <div className="card-soft p-6">
                                <form onSubmit={submit} className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-foreground mb-1.5 block">Email</label>
                                        <Input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            autoComplete="email"
                                            className="h-11"
                                            disabled={isSubmitting}
                                            autoFocus
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
                                        {isSubmitting ? "Sending…" : "Send reset link"}
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
