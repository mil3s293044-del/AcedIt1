import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import Step1Welcome from "./Step1Welcome";
import Step2Profile from "./Step2Profile";
import Step3Subjects from "./Step3Subjects";
import Step4PainPoint from "./Step4PainPoint";
import Step5Goals from "./Step5Goals";
import Step6FeatureTour from "./Step6FeatureTour";
import Step7Paywall from "./Step7Paywall";
import Step7Summary from "./Step7Summary";
import Step8Complete from "./Step8Complete";

const TOTAL_STEPS = 9;

export default function OnboardingModal({ userProfile, onComplete }) {
    const [step, setStep] = useState(1);
    const [profileId, setProfileId] = useState(userProfile?.id || null);
    const [data, setData] = useState({
        display_name: userProfile?.display_name || userProfile?.username || "",
        school_name: userProfile?.school_name || "",
        year_level: userProfile?.year_level || "Year 12",
        enrolled_subjects: userProfile?.enrolled_subjects || [],
        primary_challenge: userProfile?.primary_challenge || "",
        qualitative_goal: userProfile?.qualitative_goal || "",
        dream_course: userProfile?.dream_course || "",
    });
    const [saving, setSaving] = useState(false);
    // null = still checking. Anyone who came through the /onboarding funnel
    // already has user_subjects rows created at signup, and asking them to pick
    // the same subjects a second time is the first thing they meet after paying
    // attention through eight screens.
    const [alreadyHasSubjects, setAlreadyHasSubjects] = useState(null);

    const [email, setEmail] = useState(userProfile?.created_by || null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // Scope by created_by like every other UserSubject read in the app.
            // RLS covers this on Supabase, but the dual-run shim can route to
            // Base44 instead, where that guarantee doesn't hold.
            let who = userProfile?.created_by;
            if (!who) {
                who = await base44.auth.me().then(u => u?.email).catch(() => null);
                if (!cancelled && who) setEmail(who);
            }
            if (!who) { if (!cancelled) setAlreadyHasSubjects(false); return; }
            try {
                const rows = await base44.entities.UserSubject.filter({ created_by: who, is_active: true });
                if (cancelled) return;
                const names = [...new Set((rows || []).map(r => r.subject_name).filter(Boolean))];
                setAlreadyHasSubjects(names.length > 0);
                // Seed them so the summary screen shows what they actually picked.
                if (names.length) updateData({ enrolled_subjects: names });
            } catch {
                if (!cancelled) setAlreadyHasSubjects(false);
            }
        })();
        return () => { cancelled = true; };
    }, [userProfile?.created_by]);

    // If returning from Stripe with subscription_active, jump to final step
    useEffect(() => {
        if (userProfile?.subscription_active && !userProfile?.onboarding_completed) {
            setStep(9);
        }
    }, [userProfile?.subscription_active]);

    const updateData = (fields) => setData(prev => ({ ...prev, ...fields }));

    const saveToProfile = async (fields) => {
        setSaving(true);
        try {
            if (profileId) {
                await base44.entities.UserProfile.update(profileId, fields);
            } else {
                // Create a new UserProfile for this user
                const created = await base44.entities.UserProfile.create(fields);
                setProfileId(created.id);
            }
        } catch (e) {
            console.error("Failed to save profile:", e);
        }
        setSaving(false);
    };

    // Step 3 is the subjects picker. Skip past it in both directions when the
    // funnel already collected them — stepping back into a skipped screen is
    // just as confusing as being asked twice.
    const nextFrom = (s) => (s + 1 === 3 && alreadyHasSubjects ? 4 : s + 1);
    const prevFrom = (s) => (s - 1 === 3 && alreadyHasSubjects ? 2 : s - 1);

    const goNext = async (fields = {}) => {
        if (Object.keys(fields).length > 0) {
            updateData(fields);
            await saveToProfile(fields);
        }
        setStep(nextFrom);
    };

    const goBack = () => setStep(prevFrom);

    const handleComplete = async (fields = {}) => {
        if (Object.keys(fields).length > 0) {
            await saveToProfile(fields);
        }
        await saveToProfile({
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString(),
        });
        onComplete({ ...data, ...fields });
    };

    // Count the skipped subjects step out of the progress too, or the bar jumps
    // and the label reads "Step 4 of 8" on someone's third screen.
    const skipped = alreadyHasSubjects ? 1 : 0;
    const stepsShown = TOTAL_STEPS - 1 - skipped;
    const stepShown = alreadyHasSubjects && step > 3 ? step - 1 : step;
    const progressPct = ((stepShown - 1) / Math.max(1, stepsShown - 1)) * 100;

    return (
        <div className="fixed inset-0 z-[9999] bg-surface flex flex-col overflow-hidden">
            {/* Progress bar */}
            {step < 8 && (
                <div className="flex-shrink-0 px-6 pt-5 pb-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground/60 font-medium">Step {stepShown} of {stepsShown}</span>
                        <span className="text-xs text-muted-foreground/60">{Math.round(progressPct)}% complete</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                            className="h-full rounded-full"
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.4, ease: "easeInOut" }}
                        />
                    </div>
                </div>
            )}

            {/* Step content */}
            <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.25 }}
                        className="h-full"
                    >
                        {step === 1 && <Step1Welcome onNext={() => setStep(2)} />}
                        {step === 2 && <Step2Profile data={data} onNext={(f) => goNext(f)} onBack={goBack} saving={saving} />}
                        {step === 3 && <Step3Subjects data={data} email={email} onNext={(f) => goNext(f)} onBack={goBack} saving={saving} />}
                        {step === 4 && <Step4PainPoint data={data} onNext={(f) => goNext(f)} onBack={goBack} saving={saving} />}
                        {step === 5 && <Step5Goals data={data} onNext={(f) => goNext(f)} onBack={goBack} saving={saving} />}
                        {step === 6 && <Step6FeatureTour onNext={() => setStep(7)} onBack={goBack} data={data} />}
                        {step === 7 && <Step7Summary data={data} onNext={() => setStep(8)} onBack={goBack} />}
                        {step === 8 && <Step7Paywall data={data} onBack={goBack} onSkip={() => handleComplete({})} />}
                        {step === 9 && <Step8Complete data={data} onComplete={handleComplete} saving={saving} />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}