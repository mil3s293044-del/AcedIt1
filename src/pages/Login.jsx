// ════════════════════════════════════════════════════════════════════════════
// /login — existing-user sign-in (email+password OR Google OAuth).
//
// New users come through /onboarding instead. This page is for returning
// users who picked email+password at signup and need somewhere to log back
// in (the Landing page used to send everyone straight to Google).
// ════════════════════════════════════════════════════════════════════════════
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
    const { signInWithPassword, navigateToLogin } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submit = async (e) => {
        e?.preventDefault?.();
        setError(null);

        const trimmedEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setError("Enter a valid email address.");
            return;
        }
        if (!password) {
            setError("Enter your password.");
            return;
        }

        setIsSubmitting(true);
        const { ok, error: authError } = await signInWithPassword({
            email: trimmedEmail,
            password,
        });
        setIsSubmitting(false);

        if (!ok) {
            const msg = authError?.message || "";
            if (/email not confirmed/i.test(msg)) {
                setError("Your email hasn't been verified yet. Check your inbox for the verification link.");
            } else if (/invalid|credentials|password/i.test(msg)) {
                setError("Email or password is wrong.");
            } else if (/rate|too many/i.test(msg)) {
                setError("Too many attempts — try again in a minute.");
            } else {
                setError(msg || "Sign-in failed. Try again in a moment.");
            }
            return;
        }
        // onAuthStateChange in AuthContext will flip isAuthenticated → router renders the app.
        navigate("/", { replace: true });
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Top nav strip */}
            <header className="border-b border-border/60 bg-background/95">
                <div className="max-w-2xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <GraduationCap className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-display font-extrabold text-base text-foreground">Acedit</span>
                    </Link>
                    <Link to="/onboarding" className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                        New here? <span className="text-primary">Start free</span>
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
                    <div className="mb-6 text-center">
                        <h1 className="font-display font-extrabold text-foreground text-3xl tracking-tight">
                            Welcome back
                        </h1>
                        <p className="text-sm text-muted-foreground mt-2">
                            Sign in to keep your streak going.
                        </p>
                    </div>

                    <div className="card-soft p-6 space-y-4">
                        {/* Google OAuth (primary for existing users) */}
                        <Button
                            type="button"
                            onClick={navigateToLogin}
                            className="w-full bg-white hover:bg-white text-foreground border border-border h-12 rounded-xl font-semibold text-sm shadow-soft"
                        >
                            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden>
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a10.99 10.99 0 0 0 0 9.86l3.66-2.84z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                            </svg>
                            Continue with Google
                        </Button>

                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">or</span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        {/* Email + password form */}
                        <form onSubmit={submit} className="space-y-3">
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
                                />
                            </div>
                            <div>
                                <div className="flex items-baseline justify-between mb-1.5">
                                    <label className="text-xs font-bold text-foreground">Password</label>
                                    <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                                        Forgot?
                                    </Link>
                                </div>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Your password"
                                    autoComplete="current-password"
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
                                {isSubmitting ? "Signing in…" : (
                                    <>Sign in <ArrowRight className="w-4 h-4 ml-1" /></>
                                )}
                            </Button>
                        </form>
                    </div>

                    <p className="text-xs text-center text-muted-foreground mt-5">
                        New to Acedit?{" "}
                        <Link to="/onboarding" className="font-bold text-primary hover:underline">
                            Create an account
                        </Link>
                    </p>
                </motion.div>
            </main>
        </div>
    );
}
