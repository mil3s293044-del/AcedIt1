/**
 * The back half of the reel: the three questions, staged as acts.
 *
 * THEY RENDER THE WIZARD'S OWN COMPONENTS, NOT COPIES OF THEM. `Step2Subjects`,
 * `Step4Target` and `Step6Signin` are imported straight out of the Onboarding
 * page. Same code, same answers shape, same `STORAGE_KEY`, so a student who
 * starts in the reel and reloads onto /onboarding resumes mid-sentence.
 *
 * That is not tidiness, it is the only safe way to do this. Step6Signin's error
 * branches were each written after something actually went wrong in
 * production — the Supabase rate-limit message that used to name a developer
 * by first name, the "unable to validate" path, the resend. A second copy of a
 * sign-up screen is a second place for a sign-up bug to live, on the one screen
 * in this app where a bug costs money rather than goodwill.
 *
 * WHAT IS RESTAGED IS THE SHELL AROUND THEM. Full-bleed act, the film's own
 * eyebrow and rhythm, the hand still held at the bottom of the screen, the same
 * chapter rail — so the questions arrive as the next thing that happens rather
 * than as a form that opened. The steps' own footers render in place, because
 * `StepShell` already falls back to that when no `ActionsSlot` is provided.
 *
 * THE YEAR CHIP IS THE SKIMMER'S SAFETY NET. Act one is the only year question
 * in the film, so somebody who scrolled straight past it arrives here without
 * one — and the year decides the exam date every payout downstream is built on.
 * It is a chip rather than a screen: re-asking properly would be the second
 * year question the manifest exists to prevent.
 */
import React from "react";
import { motion } from "framer-motion";
import { Step2Subjects, Step4Target, Step6Signin } from "@/pages/Onboarding";
import { useAct } from "@/components/reel/ReelContext";

const YEARS = ["Year 10 or below", "Year 11", "Year 12"];

/**
 * ONE COUNTER PER SCREEN. This used to render its own "Question 1 of 3"
 * heading directly above the step's own "The deal \u00B7 2 of 4" — the wizard
 * counts six steps and the reel asks three questions, so both were internally
 * consistent and they disagreed in front of the reader. The act passes its
 * count INTO the step now, and the step prints it once.
 */
/** One control, not a screen. See the header. */
function YearChip({ answers, update }) {
    if (answers.yearLevel) {
        return (
            <p className="text-center text-xs font-bold text-muted-foreground mb-4">
                {answers.yearLevel}
                <button
                    type="button"
                    onClick={() => update({ yearLevel: null })}
                    className="ml-2 underline underline-offset-2 hover:text-foreground cursor-pointer"
                >
                    change
                </button>
            </p>
        );
    }
    return (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
            <span className="text-xs font-bold text-muted-foreground">What year are you in?</span>
            {YEARS.map((y) => (
                <button
                    key={y}
                    type="button"
                    onClick={() => update({ yearLevel: y })}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-border
                               bg-surface hover:border-primary/40 cursor-pointer transition"
                >
                    {y}
                </button>
            ))}
        </div>
    );
}

export function ActSubjects({ answers, update }) {
    const { advance, deal } = useAct("subjects");

    /* Paid out on every change rather than on continue: the hand is the
       progress indicator, so a student adding a fifth subject has to see the
       card change under their thumb. `dealt` replaces in place, so this cannot
       stack up. */
    React.useEffect(() => {
        deal({ subjects: answers.subjects.map((s) => s.name) });
    }, [answers.subjects, deal]);

    return (
        <div className="w-full">
            <YearChip answers={answers} update={update} />
            <Step2Subjects
                eyebrow="Question 1 of 3"
                answers={answers}
                update={update}
                onNext={advance}
                canContinue={answers.subjects.length > 0}
            />
        </div>
    );
}

export function ActTarget({ answers, update }) {
    const { advance, deal } = useAct("target");

    React.useEffect(() => {
        deal({ targetAtar: answers.goalAtar, course: answers.goalCourseName });
    }, [answers.goalAtar, answers.goalCourseName, deal]);

    return (
        <div className="w-full">
            <Step4Target eyebrow="Question 2 of 3" answers={answers} update={update} onNext={advance} />
        </div>
    );
}

/**
 * The last act. It does NOT advance — there is nowhere after it, and the film
 * ends where the account begins.
 */
export function ActSignin({ answers, update }) {
    return (
        <motion.div
            className="w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
        >
            <Step6Signin answers={answers} update={update} />
        </motion.div>
    );
}

/**
 * ONE lazy chunk, three acts.
 *
 * `React.lazy` resolves to a COMPONENT, not to a module namespace, so three
 * separate `lazy()` calls would mean three `import()` sites for one file and
 * three Suspense boundaries that can resolve at different moments — on a snap
 * deck that means three acts changing height independently, which re-runs the
 * reel's fit measurement mid-scroll. One entry point, switched on a prop.
 */
export default function StepActs({ which, ...props }) {
    if (which === "subjects") return <ActSubjects {...props} />;
    if (which === "target") return <ActTarget {...props} />;
    if (which === "signin") return <ActSignin {...props} />;
    return null;
}
