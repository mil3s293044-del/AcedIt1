/**
 * The last screen: keep the hand.
 *
 * THE AUTH IS PORTED, NOT REWRITTEN. Sign-up is where a clever interface costs
 * real money, and every error branch below was written after something
 * actually went wrong — the vendor-and-developer message a seventeen-year-old
 * was once shown, the security-purposes throttle, the resend that has to be
 * the identical call. What changed is the shape around them:
 *
 * THE BUTTON IS PINNED. The plan picker is the decision and the Google button
 * is the act, and on a phone the act used to sit below two plan cards, an
 * anchor panel and a label — below the fold on the one screen where a scroll
 * costs a signup. It rides in the actions bar now, so it is on screen from the
 * first paint whatever the picker above it is doing.
 *
 * WHAT EACH PLAN HOLDS IS COUNTED, NOT TYPED. The tool count is the
 * catalogue's own length and the free allowance is `FREE_LIFETIME_CAPS`, so a
 * plan card cannot sell a number the gate does not enforce — the pricing page
 * did exactly that in both directions for months.
 *
 * NOTHING HERE PROMISES A TRIAL. Whether there is one is an open pricing
 * decision recorded in pricing.js; this screen says what is true today and
 * leaves that one alone.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "framer-motion";
import { Check, Crown, Mail, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AceShuffle from "@/components/ace/AceShuffle";
import { supabase } from "@/api/supabaseClient";
import { useAuth, applyOnboardingUpdateForCurrentUser } from "@/lib/AuthContext";
import { priceLabel, weeksPerTutorHour, TUTOR_HOURLY_AUD } from "@/lib/pricing";
import { FREE_LIFETIME_CAPS, FEATURES } from "@/lib/tierAccess";
import { TOOL_LABELS } from "@/lib/toolLabels";
import { personalLine, STEP_NAME } from "@/lib/onboardingFlow";
import { StepShell, PrimaryCTA } from "@/components/onboarding/Shell";
import CostGap from "@/components/onboarding/wizard/CostGap";

// The live catalogue, by its own length. toolLabels.js is the plain copy of
// chatTools' names and `toolBrief.test.mjs` holds the two to the same twelve,
// so this is TOOL_COUNT without pulling every examiner prompt into signup.
const TOOL_N = Object.keys(TOOL_LABELS).length;

const PLANS = {
    premium: {
        name: "Premium",
        price: priceLabel(),
        per: "/wk",
        points: [
            `All ${TOOL_N} AI tools`,
            "AI quizzes, decks and marking every week",
            "Cancel anytime",
        ],
    },
    free: {
        name: "Free",
        price: "$0",
        per: "",
        points: [
            "Flashcards, planner and Progress",
            `${FREE_LIFETIME_CAPS[FEATURES.QUIZ_AI_GEN]} AI quizzes and ${FREE_LIFETIME_CAPS[FEATURES.FLASHCARD_AI_GEN]} AI decks to start`,
            `${FREE_LIFETIME_CAPS[FEATURES.QUIZ_AI_MARK]} answers marked by AI`,
        ],
    },
};

function PlanCard({ id, on, onPick, disabled, reduce }) {
    const p = PLANS[id];
    const premium = id === "premium";
    return (
        <button type="button" role="radio" aria-checked={on} disabled={disabled}
            onClick={() => onPick(id)}
            className={`relative text-left rounded-2xl p-4 sm:p-5 border-2 transition-colors duration-200
                ${on ? "border-transparent" : "border-border bg-surface hover:border-foreground/20"}`}>
            {/* One ring that MOVES between the two, rather than two rings that
                switch: the choice reads as a thing you slid across. */}
            {on && (
                <motion.span layoutId="plan-ring" aria-hidden="true"
                    className={`absolute -inset-[2px] rounded-[1.05rem] border-2
                        ${premium ? "border-primary bg-primary/[0.07]" : "border-foreground/45 bg-foreground/[0.03]"}`}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} />
            )}
            <span className="relative block">
                <span className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 stat-label ${on && premium ? "text-primary" : "text-muted-foreground"}`}>
                        {premium && <Crown className="w-3.5 h-3.5" strokeWidth={2.5} />}
                        {p.name}
                    </span>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                        ${on ? (premium ? "bg-primary border-primary text-primary-foreground" : "bg-foreground border-foreground text-background") : "border-border"}`}>
                        {on && <Check className="w-3 h-3" strokeWidth={3.5} />}
                    </span>
                </span>
                <span className="block font-display font-extrabold text-foreground text-[1.75rem] leading-none mt-2.5 tabular-nums">
                    {p.price}<span className="text-sm text-muted-foreground font-bold">{p.per}</span>
                </span>
                <span className="block mt-3 space-y-1.5">
                    {p.points.map((t) => (
                        <span key={t} className="flex items-start gap-1.5 text-[12px] sm:text-[13px] leading-snug text-foreground/80">
                            <Check className={`w-3.5 h-3.5 mt-[1px] flex-shrink-0 ${premium ? "text-primary" : "text-muted-foreground"}`} strokeWidth={3} />
                            {t}
                        </span>
                    ))}
                </span>
            </span>
        </button>
    );
}

function GoogleMark() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#fff" opacity="0.95" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#fff" opacity="0.95" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z" />
            <path fill="#fff" opacity="0.95" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a10.99 10.99 0 0 0 0 9.86l3.66-2.84z" />
            <path fill="#fff" opacity="0.95" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
    );
}

function Field({ id, label, ...rest }) {
    return (
        <div>
            <label htmlFor={id} className="text-xs font-bold text-foreground mb-1.5 block">{label}</label>
            <Input id={id} className="h-12 rounded-xl text-[15px]" {...rest} />
        </div>
    );
}

export function StepSignin({ answers, update, persist, isDesktop }) {
    const { signUpWithPassword } = useAuth();
    const reduce = useReducedMotion();
    const [isStarting, setIsStarting] = useState(false);

    // Plan: "premium" (default) | "free"
    const [selectedPlan, setSelectedPlan] = useState(answers.intent || "premium");

    // Auth method: null (chooser) | "email" (form). Google has no in-page form
    // — it redirects out — so it needs no mode of its own.
    const [authMode, setAuthMode] = useState(null);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [emailError, setEmailError] = useState(null);
    const [emailSent, setEmailSent] = useState(false);
    const [resending, setResending] = useState(false);
    const [resent, setResent] = useState(false);
    const [resendError, setResendError] = useState("");

    // ─── Google OAuth path ──────────────────────────────────────────────────
    const startGoogleSignIn = async () => {
        const completedAt = new Date().toISOString();
        update({ intent: selectedPlan, completedAt });
        persist({ ...answers, intent: selectedPlan, completedAt });
        setIsStarting(true);
        try {
            const redirectTo = `${window.location.origin}/`;
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo },
            });
            if (error) throw error;
            // Browser navigates away — code below doesn't run.
        } catch (e) {
            console.error("[onboarding] OAuth error:", e);
            setIsStarting(false);
        }
    };

    // ─── Email + password path ──────────────────────────────────────────────
    const submitEmailSignup = async () => {
        setEmailError(null);

        const trimmedEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setEmailError("Enter a valid email address.");
            return;
        }
        if (password.length < 8) {
            setEmailError("Password needs to be at least 8 characters.");
            return;
        }
        if (password !== confirmPassword) {
            setEmailError("Those two passwords are different.");
            return;
        }

        // The typed email rides with the answers so the post-verify apply only
        // fires for THIS user (the email-match guard in AuthContext).
        const completedAt = new Date().toISOString();
        const nextAnswers = { ...answers, intent: selectedPlan, completedAt, email: trimmedEmail };
        update({ intent: selectedPlan, completedAt, email: trimmedEmail });
        persist(nextAnswers);

        setIsStarting(true);
        const { ok, error } = await signUpWithPassword({
            email: trimmedEmail,
            password,
            fullName: fullName.trim() || undefined,
        });
        setIsStarting(false);

        if (!ok) {
            const msg = error?.message || "Sign-up failed. Try again in a moment.";
            // Specific about which error this was, and Supabase's real message
            // for anything unrecognised — a generic "try again" hides whether
            // the email path is actually broken.
            if (/already registered|exists/i.test(msg)) {
                setEmailError("This email already has an account. Try signing in instead.");
            } else if (/too many|rate limit/i.test(msg)) {
                // NEVER NAME THE VENDOR OR THE DEVELOPER. This branch once told
                // a student to "have Miles set up Resend SMTP". Signup goes
                // through our own sender now, so this is rare, and when it fires
                // it says the one thing they can act on.
                setEmailError(msg);
            } else if (/for security purposes/i.test(msg)) {
                setEmailError("Too soon to send another to this address — give it a minute.");
            } else if (/invalid.*email|unable to validate/i.test(msg)) {
                setEmailError("That email address was rejected. Try a different one.");
            } else {
                setEmailError(msg);
            }
            return;
        }
        setEmailSent(true);
    };

    /**
     * Send the verification email again — the SAME call as the first send.
     * `generateLink` regenerates the link for an unconfirmed account, so there
     * is no second path to keep in step, and the password is still in state
     * because the student never left this screen.
     */
    const handleResend = async () => {
        if (resending || resent) return;
        setResending(true);
        setResendError("");
        const { ok, error } = await signUpWithPassword({
            email: email.trim().toLowerCase(),
            password,
            fullName: fullName.trim() || undefined,
        });
        setResending(false);
        if (ok) {
            // Latched, so pressing it repeatedly cannot trip the rate limit
            // that exists to protect them from exactly that.
            setResent(true);
            return;
        }
        setResendError(error?.message || "Couldn't send it just now. Try again in a minute.");
    };

    // ─── Sent: check your inbox ─────────────────────────────────────────────
    if (emailSent) {
        return (
            <StepShell
                eyebrow="One more step"
                title="Check your inbox"
                subtitle={`We sent a link to ${email}. Tap it and your hand is waiting.`}
            >
                <div className="card-soft on-table p-5 sm:p-6 space-y-4 max-w-md">
                    <div className="flex items-start gap-3.5">
                        <motion.div
                            initial={reduce ? false : { scale: 0.4, rotate: -18, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.1 }}
                            className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <Mail className="w-5 h-5 text-primary" strokeWidth={2.5} />
                        </motion.div>
                        <div className="text-sm leading-relaxed">
                            <p className="font-bold text-foreground mb-1">Almost there.</p>
                            <p className="text-muted-foreground">
                                Open the email from AcedIt and tap the verification link.
                                Your subjects, target and plan will be set up when you land.
                            </p>
                        </div>
                    </div>
                    <div className="rounded-xl bg-chart-3/[0.06] border border-chart-3/15 p-3 text-xs text-foreground leading-relaxed">
                        <span className="font-bold">Already use AcedIt with Google?</span>{" "}
                        No email is coming for that address —{" "}
                        <Link to="/login" className="text-primary font-bold hover:underline">sign in with Google</Link> instead.
                    </div>
                    {/* A way forward when the email never arrives. There was
                        none: a student whose mail was eaten could only start
                        over with an address most people do not have. */}
                    <div className="space-y-2">
                        <Button type="button" variant="outline" disabled={resending || resent} onClick={handleResend}
                            className="w-full h-11 border-2 border-border rounded-xl gap-2 font-bold">
                            {resending ? <><AceShuffle size="sm" /> Sending…</>
                                : resent ? <><Check className="w-4 h-4 text-primary" /> Sent — check again</>
                                : <><Mail className="w-4 h-4" /> Send it again</>}
                        </Button>
                        {resendError && <p className="text-xs text-streak text-center">{resendError}</p>}
                        <p className="text-xs text-muted-foreground text-center">
                            Still nothing? Check spam, or{" "}
                            <button type="button"
                                onClick={() => { setEmailSent(false); setResent(false); setResendError(""); }}
                                className="font-bold text-primary hover:underline">
                                try a different email
                            </button>.
                        </p>
                    </div>
                </div>
            </StepShell>
        );
    }

    const emailMode = authMode === "email";
    const startLabel = `Create account${selectedPlan === "premium" ? " & start Premium" : ""}`;

    return (
        <StepShell
            eyebrow={STEP_NAME.signin}
            title="Keep the hand."
            subtitle="Sign in and everything you just set up is saved to your account."
            footer={emailMode ? (
                <PrimaryCTA onClick={submitEmailSignup} disabled={isStarting}>
                    {isStarting ? "Creating account…" : startLabel}
                </PrimaryCTA>
            ) : (
                <div className="space-y-2">
                    <motion.button type="button" onClick={startGoogleSignIn} disabled={isStarting}
                        whileTap={reduce || isStarting ? undefined : { scale: 0.97, y: 2 }}
                        className="w-full btn-3d bg-primary text-primary-foreground rounded-2xl h-14
                            inline-flex items-center justify-center gap-2.5 font-display font-extrabold text-[17px] disabled:opacity-60">
                        {isStarting ? <AceShuffle size="sm" /> : <GoogleMark />}
                        Continue with Google
                    </motion.button>
                    <button type="button" onClick={() => { setAuthMode("email"); setEmailError(null); }} disabled={isStarting}
                        className="w-full rounded-2xl border-2 border-border bg-surface hover:bg-muted/50 h-12
                            inline-flex items-center justify-center gap-2 font-display font-extrabold text-[15px] text-foreground transition-colors disabled:opacity-60">
                        <Mail className="w-[18px] h-[18px]" />
                        Use email instead
                    </button>
                </div>
            )}
        >
            <div className="max-w-lg">
                {/* The anchor, once, at the point of the decision — and phrased
                    so it does not sneer at tutors. A good one is worth the money;
                    the honest difference is availability. */}
                <p className="text-[15px] leading-snug text-foreground mb-5">
                    <span className="font-display font-extrabold">One hour with a tutor pays for{" "}
                        <span className="text-primary">{weeksPerTutorHour()} weeks</span> of AcedIt.</span>{" "}
                    <span className="text-muted-foreground text-[13px]">
                        Melbourne VCE tutoring runs about ${TUTOR_HOURLY_AUD} an hour.
                    </span>
                </p>

                <LayoutGroup>
                    <div role="radiogroup" aria-label="Choose your plan" className="grid grid-cols-2 gap-3">
                        {["premium", "free"].map((id) => (
                            <PlanCard key={id} id={id} on={selectedPlan === id} onPick={setSelectedPlan}
                                disabled={isStarting} reduce={reduce} />
                        ))}
                    </div>
                </LayoutGroup>

                <AnimatePresence initial={false}>
                    {emailMode && (
                        <motion.div key="email"
                            initial={reduce ? false : { opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                            className="overflow-hidden">
                            <div className="pt-6">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="stat-label text-muted-foreground">Sign up with email</p>
                                    <button type="button" onClick={() => { setAuthMode(null); setEmailError(null); }}
                                        disabled={isStarting}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
                                        <ArrowLeft className="w-3.5 h-3.5" /> Use Google
                                    </button>
                                </div>
                                <form className="card-soft on-table p-4 sm:p-5 space-y-3"
                                    onSubmit={(e) => { e.preventDefault(); submitEmailSignup(); }}>
                                    <Field id="onb-name" label="Name (optional)" value={fullName}
                                        onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Sienna L"
                                        autoComplete="name" disabled={isStarting} />
                                    <Field id="onb-email" label="Email" type="email" value={email}
                                        onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                                        autoComplete="email" disabled={isStarting} />
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <Field id="onb-pass" label="Password" type="password" value={password}
                                            onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters"
                                            autoComplete="new-password" disabled={isStarting} />
                                        <Field id="onb-pass2" label="Same again" type="password" value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Type it again"
                                            autoComplete="new-password" disabled={isStarting} />
                                    </div>
                                    <AnimatePresence>
                                        {emailError && (
                                            <motion.div role="alert"
                                                initial={reduce ? false : { opacity: 0, x: -6 }}
                                                animate={reduce ? { opacity: 1 } : { opacity: 1, x: [0, -5, 5, -3, 3, 0] }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.36 }}
                                                className="rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive font-semibold">
                                                {emailError}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    {/* Enter submits; the visible button is the pinned one. */}
                                    <button type="submit" className="sr-only" tabIndex={-1}>Create account</button>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <p className="text-xs font-semibold text-muted-foreground mt-6">
                    Already have an account?{" "}
                    <Link to="/login" className="text-primary font-bold hover:underline">Sign in</Link>
                </p>
                {personalLine(answers) && (
                    <p className="text-[11px] text-muted-foreground/70 mt-1.5">Saving: {personalLine(answers)}</p>
                )}
                {/* On a desktop the year of tutoring is on the table beside
                    this. A phone has no beside, so it follows the decision. */}
                {!isDesktop && !emailMode && <div className="mt-8"><CostGap /></div>}
            </div>
        </StepShell>
    );
}

/**
 * A retake from Settings. There is no plan or auth decision left to make, so
 * this writes the hand back to the signed-in account and returns to the app.
 */
export function StepSaveExisting({ answers, onSaved }) {
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const email = user?.email;
            if (!email) throw new Error("You're not signed in.");
            const result = await applyOnboardingUpdateForCurrentUser(email, answers);
            if (!result.ok) throw new Error(result.error || "Couldn't save. Try again.");
            onSaved();
        } catch (e) {
            setError(e.message || "Something went wrong. Try again.");
            setIsSaving(false);
        }
    };

    return (
        <StepShell
            eyebrow="Update your setup"
            title="Save this hand?"
            subtitle="It updates your subjects and target. Your plan and login stay exactly as they are."
            footer={(
                <div className="space-y-2">
                    {error && <p className="text-sm text-destructive font-semibold text-center">{error}</p>}
                    <PrimaryCTA onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving…" : "Save changes"}
                    </PrimaryCTA>
                </div>
            )}
        >
            {personalLine(answers) && (
                <p className="font-display font-extrabold text-foreground text-lg">{personalLine(answers)}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
                A subject you took out comes off your subject list. Its cards, quizzes and
                marks stay exactly where they are.
            </p>
        </StepShell>
    );
}
