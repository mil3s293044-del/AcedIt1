/**
 * The wizard's screens, one decision each.
 *
 *   Year → Birthday → Subjects → Target → Build → Reveal → Sign in
 *
 * ONE DECISION PER SCREEN. The birthday used to arrive underneath the year
 * cards once one was picked, half behind the pinned button on a phone; the
 * subjects screen held a 340px scroll box with the payout BELOW it; and the
 * course fields sat under the target card where nobody scrolled. Each screen
 * now asks one thing, and the thing it gives back is where the eye already is
 * — Ace says it, or the table draws it.
 *
 * THE BRAIN LEFT THE FUNNEL. It asked nothing, ended in a "Makes sense"
 * button, and sat between the second and third questions, which made it the
 * likeliest place in the flow to lose somebody. Its argument — spacing beats
 * rereading — is now a line the build screen states with the student's own
 * review dates on it, which is the version a student can check.
 *
 * Every figure on these screens comes out of onboardingFlow.js.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Search, Plus, X, Info, BookOpen, MapPin, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { alpha } from "@/components/cards/PlayingCard";
import { colorFor } from "@/components/cards/cardIdentity";
import { VCE_SUBJECTS } from "@/data/vceSubjects";
import { groupByArea } from "@/lib/subjectBrowse";
import AgeAnswer from "@/components/legal/AgeAnswer";
import YearCards from "@/components/onboarding/wizard/YearCards";
import AtarCut from "@/components/onboarding/wizard/AtarCut";
import ScalingReport from "@/components/onboarding/wizard/ScalingReport";
import { Spread } from "@/components/onboarding/Table";
import { useFlight } from "@/components/onboarding/DealFlight";
import { StepShell, PrimaryCTA, SkipLink } from "@/components/onboarding/Shell";
import {
    STEP_NAME, handFrom, buildLines, revealFacts, personalLine,
} from "@/lib/onboardingFlow";

/* ═══ Year ═══════════════════════════════════════════════════════════════════ */

/**
 * A pick DEALS and then advances. The pause is tuned to the flight rather than
 * a round number: long enough to watch the card leave your hand and land on
 * the table, short enough that nobody taps twice. The payout — the weeks this
 * year leaves — is what Ace says on the next screen, which is why advancing
 * straight away no longer throws it away.
 */
const ADVANCE_MS = 820;

export function StepYear({ answers, update, onNext }) {
    const { fly } = useFlight();
    const reduce = useReducedMotion();
    const timer = useRef(0);
    useEffect(() => () => window.clearTimeout(timer.current), []);

    const pick = (value, el) => {
        // Fly BEFORE writing the answer, so the card's first render on the
        // table already knows it is airborne (see DealFlight).
        if (answers.yearLevel !== value) fly(el, handFrom({ yearLevel: value })[0]);
        update({ yearLevel: value });
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(onNext, reduce ? 260 : ADVANCE_MS);
    };

    return (
        <StepShell
            eyebrow={STEP_NAME.year}
            title="What year are you in?"
            subtitle="Pick your card. Everything AcedIt writes for you is pitched at that level."
            footer={answers.yearLevel ? <PrimaryCTA onClick={onNext}>Continue</PrimaryCTA> : null}
        >
            <YearCards value={answers.yearLevel} onPick={pick} />
        </StepShell>
    );
}

/* ═══ Birthday ═══════════════════════════════════════════════════════════════ */

/**
 * The birthday is asked ONCE, here, through the same control `AgeGate` uses —
 * one control and one stored answer is what stops the gate asking again a
 * screen later (compliance.test.mjs holds it). A year level is not an age:
 * "Year 11" spans fifteen to seventeen and the thresholds are 13, 16 and 18,
 * so nothing here derives one from the other.
 */
export function StepBirthday({ answers, update, onNext, ready, hint }) {
    return (
        <StepShell
            eyebrow={STEP_NAME.birthday}
            title="When's your birthday?"
            subtitle="Asked once. It decides which parts of AcedIt switch on for you."
            footer={(
                <>
                    <PrimaryCTA onClick={onNext} disabled={!ready}>Continue</PrimaryCTA>
                    {/* A disabled button that will not say why is a paper-cut
                        this codebase already records about Active Recall. */}
                    {!ready && hint && (
                        <p className="text-xs text-muted-foreground mt-2.5 text-center">{hint}</p>
                    )}
                </>
            )}
        >
            <div className="card-soft on-table p-5 sm:p-6 max-w-md">
                <AgeAnswer idPrefix="acedit-wizard" dob={answers.dob || ""} guardian={!!answers.guardian} onChange={update} />
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground mt-4 max-w-md">
                It sets whether you appear on the Compete board and whether analytics may run
                on your account. Under 18, both stay off unless somebody who can say yes does.
            </p>
        </StepShell>
    );
}

/* ═══ Subjects ═══════════════════════════════════════════════════════════════ */

function isPreVceYear(yearLevel) {
    return !!yearLevel && /^Year (7|8|9)\b/.test(yearLevel);
}

/** English first: it is the one study every VCE student has to carry. */
const AREA_ORDER = ["english", "maths", "science", "humanities", "languages", "business", "tech", "arts", "health", "other"];

function Check({ on, reduce }) {
    return (
        <svg viewBox="0 0 16 16" className="w-3 h-3" aria-hidden="true">
            <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor"
                strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
                initial={false}
                animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
                transition={reduce ? { duration: 0 } : { duration: 0.28, ease: "easeOut" }} />
        </svg>
    );
}

function SubjectChip({ sub, on, onToggle, reduce }) {
    const tone = colorFor(sub.name);
    return (
        <motion.button
            type="button"
            aria-pressed={on}
            onClick={(e) => onToggle(sub, e.currentTarget)}
            whileTap={reduce ? undefined : { scale: 0.94 }}
            animate={on && !reduce ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={{ duration: 0.28 }}
            className={`inline-flex items-center gap-2 h-10 pl-1.5 pr-3.5 rounded-full border-2
                text-[13px] font-bold transition-colors duration-200
                ${on ? "border-transparent text-foreground" : "bg-surface border-border text-foreground/85 hover:border-foreground/25"}`}
            style={on ? { background: alpha(tone, 0.16), boxShadow: `inset 0 0 0 2px ${tone}` } : undefined}
        >
            <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-colors"
                style={{ background: on ? tone : alpha(tone, 0.18) }}>
                {on ? <Check on reduce={reduce} /> : <span className="w-2 h-2 rounded-full" style={{ background: tone }} />}
            </span>
            {sub.name}
        </motion.button>
    );
}

export function StepSubjects({ answers, update, onNext, isDesktop }) {
    const { fly } = useFlight();
    const reduce = useReducedMotion();
    const [query, setQuery] = useState("");
    const [adding, setAdding] = useState(false);
    const [customName, setCustomName] = useState("");

    const picked = answers.subjects || [];
    const has = (sub) => picked.some((x) => x.code === sub.code);

    const toggle = (sub, el) => {
        if (has(sub)) {
            update({ subjects: picked.filter((x) => x.code !== sub.code) });
            return;
        }
        const next = { id: sub.id, name: sub.name, code: sub.code, is_custom: !!sub.is_custom };
        fly(el, handFrom({ subjects: [next] })[0]);
        update({ subjects: [...picked, next] });
    };

    const addCustom = () => {
        const name = customName.trim();
        if (!name) return;
        const code = name.slice(0, 12).replace(/\s+/g, "_").toUpperCase();
        if (!picked.some((x) => x.code === code)) {
            update({ subjects: [...picked, { id: `custom_${Date.now()}`, name, code, is_custom: true }] });
        }
        setCustomName("");
        setAdding(false);
    };

    const q = query.toLowerCase().trim();
    const results = useMemo(() => (q
        ? VCE_SUBJECTS.filter((s) => s.name.toLowerCase().includes(q) || (s.code || "").toLowerCase().includes(q))
        : VCE_SUBJECTS), [q]);
    const groups = useMemo(() => groupByArea(results)
        .sort((a, b) => AREA_ORDER.indexOf(a.key) - AREA_ORDER.indexOf(b.key)), [results]);
    const customs = picked.filter((s) => s.is_custom);

    return (
        <StepShell
            eyebrow={STEP_NAME.subjects}
            title="What are you taking?"
            subtitle="Tap each one. Every subject becomes a suit in your deck."
            width="max-w-2xl"
            footer={(
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm min-h-[20px]">
                        <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span key={picked.length} className="font-bold text-foreground tabular-nums"
                                initial={reduce ? false : { y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.18 }}>
                                {picked.length === 0 ? "Pick at least one" : `${picked.length} in your deck`}
                            </motion.span>
                        </AnimatePresence>
                        {picked.length > 0 && (
                            <button type="button" onClick={() => update({ subjects: [] })}
                                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                                Clear all
                            </button>
                        )}
                    </div>
                    <PrimaryCTA onClick={onNext} disabled={picked.length === 0}>Continue</PrimaryCTA>
                </div>
            )}
        >
            {isPreVceYear(answers.yearLevel) && (
                <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-chart-3/[0.07] border border-chart-3/15 p-3.5">
                    <Info className="w-4 h-4 text-chart-3 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                    <p className="text-[13px] text-foreground leading-relaxed">
                        These are VCE studies, so most Year 7 to 9 subjects are not listed. Use{" "}
                        <span className="font-bold">Add your own</span> for Maths, English, Science and the rest.
                    </p>
                </div>
            )}

            <div className="sticky top-[60px] z-10 -mx-1 px-1 pb-3 pt-1 bg-background">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search subjects, or add your own"
                        className="pl-10 h-12 rounded-2xl border-2 bg-surface text-[15px]" />
                </div>
            </div>

            {customs.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                    {customs.map((sub) => (
                        <button key={sub.id} type="button" onClick={() => toggle(sub)}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-chart-4/10 border-2 border-chart-4/30 text-chart-4 text-[13px] font-bold hover:bg-chart-4/15 transition-colors">
                            {sub.name}
                            <X className="w-3.5 h-3.5" strokeWidth={3} />
                        </button>
                    ))}
                </div>
            )}

            <div className="space-y-5">
                {groups.map((g) => (
                    <section key={g.key}>
                        <div className="flex items-center gap-3 mb-2.5">
                            <h2 className="stat-label text-muted-foreground">{g.label}</h2>
                            <span className="flex-1 h-px bg-border" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {g.subjects.map((sub) => (
                                <SubjectChip key={sub.id} sub={sub} on={has(sub)} onToggle={toggle} reduce={reduce} />
                            ))}
                        </div>
                    </section>
                ))}
                {results.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">
                        No VCE study called &ldquo;{query}&rdquo;. Add it as your own below.
                    </p>
                )}

                <section>
                    <div className="flex items-center gap-3 mb-2.5">
                        <h2 className="stat-label text-muted-foreground">Your own</h2>
                        <span className="flex-1 h-px bg-border" />
                    </div>
                    {adding ? (
                        <div className="flex gap-2 max-w-md">
                            <Input value={customName} onChange={(e) => setCustomName(e.target.value)}
                                placeholder="e.g. Year 9 Science" autoFocus className="h-11 rounded-xl"
                                onKeyDown={(e) => e.key === "Enter" && addCustom()} />
                            <Button type="button" onClick={addCustom} disabled={!customName.trim()}
                                className="h-11 rounded-xl bg-chart-4 hover:bg-chart-4/90 text-white font-bold">
                                Add
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => { setAdding(false); setCustomName(""); }}
                                className="h-11 rounded-xl">Cancel</Button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => { setAdding(true); setCustomName(query); }}
                            className="inline-flex items-center gap-2 h-10 pl-1.5 pr-4 rounded-full border-2 border-dashed border-chart-4/45 text-chart-4 text-[13px] font-bold hover:bg-chart-4/[0.07] transition-colors">
                            <span className="w-7 h-7 rounded-full bg-chart-4/15 flex items-center justify-center">
                                <Plus className="w-4 h-4" strokeWidth={3} />
                            </span>
                            Add your own subject
                        </button>
                    )}
                </section>
            </div>

            {/* On a desktop the payout is on the felt beside this list. On a
                phone there is no beside, so it follows the list. */}
            {!isDesktop && picked.length > 0 && (
                <div className="mt-7"><ScalingReport subjects={picked} /></div>
            )}
        </StepShell>
    );
}

/* ═══ Target ═════════════════════════════════════════════════════════════════ */

export const DEFAULT_TARGET = 85;

export function StepTarget({ answers, update, onNext }) {
    const value = answers.goalAtar ?? DEFAULT_TARGET;
    const [course, setCourse] = useState(!!(answers.goalCourseName || answers.goalUniversity));
    const reduce = useReducedMotion();

    const commit = () => { update({ goalAtar: value }); onNext(); };
    const skip = () => { update({ goalAtar: null, goalCourseName: "", goalUniversity: "" }); onNext(); };

    return (
        <StepShell
            eyebrow={STEP_NAME.target}
            title="What are you playing for?"
            subtitle="Drag to set the ATAR you are chasing. It goes on the table as your Ace."
            footer={(
                <div className="space-y-1">
                    <PrimaryCTA onClick={commit}>Lock it in</PrimaryCTA>
                    <SkipLink onClick={skip} />
                </div>
            )}
        >
            <div className="max-w-md">
                <AtarCut value={value} onChange={(v) => update({ goalAtar: v })} />

                <div className="mt-6">
                    {!course ? (
                        <button type="button" onClick={() => setCourse(true)}
                            className="w-full flex items-center justify-between rounded-2xl border-2 border-dashed border-border px-4 h-12 text-sm font-bold text-muted-foreground hover:text-foreground hover:border-foreground/25 transition-colors">
                            <span className="inline-flex items-center gap-2"><Plus className="w-4 h-4" strokeWidth={3} />
                                Add the course it is for <span className="font-semibold">(optional)</span></span>
                            <ChevronDown className="w-4 h-4" />
                        </button>
                    ) : (
                        <motion.div className="card-soft p-5 space-y-4"
                            initial={reduce ? false : { opacity: 0, y: -6, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            transition={{ duration: 0.28 }}>
                            <div className="space-y-1.5">
                                <label htmlFor="acedit-course" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <BookOpen className="w-3.5 h-3.5 text-primary" /> Course
                                </label>
                                <Input id="acedit-course" value={answers.goalCourseName}
                                    onChange={(e) => update({ goalCourseName: e.target.value })}
                                    placeholder="e.g. Bachelor of Commerce" className="h-11" />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="acedit-uni" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-primary" /> University
                                </label>
                                <Input id="acedit-uni" value={answers.goalUniversity}
                                    onChange={(e) => update({ goalUniversity: e.target.value })}
                                    placeholder="e.g. University of Melbourne" className="h-11" />
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </StepShell>
    );
}

/* ═══ Build ══════════════════════════════════════════════════════════════════ */

/**
 * THE WAIT IS THEATRE AND THE LINES ARE NOT. Every line is something the app
 * genuinely worked out from the answers (`buildLines`), and it says what it is
 * doing and then what it got. The pacing is a dealer's, and it is skippable.
 * What it never does is claim work that is not happening — "analysing ten
 * thousand students like you" is the line that makes a wait feel valuable by
 * lying about it, and the test refuses it by name.
 */
const LINE_MS = 620;
const AFTER_MS = 1100;

export function StepBuild({ answers, onNext, isDesktop }) {
    const reduce = useReducedMotion();
    const lines = useMemo(() => buildLines(answers), [answers]);
    const [done, setDone] = useState(reduce ? lines.length : 0);
    const left = useRef(false);

    useEffect(() => {
        if (done < lines.length) {
            const t = window.setTimeout(() => setDone((d) => d + 1), done === 0 ? 450 : LINE_MS);
            return () => window.clearTimeout(t);
        }
        if (reduce) return undefined;
        const t = window.setTimeout(() => { if (!left.current) { left.current = true; onNext(); } }, AFTER_MS);
        return () => window.clearTimeout(t);
    }, [done, lines.length, reduce, onNext]);

    const finished = done >= lines.length;
    const go = () => { if (!left.current) { left.current = true; onNext(); } };

    return (
        <StepShell
            eyebrow={STEP_NAME.build}
            title={finished ? "Your deck is ready." : "Putting your deck together"}
            footer={<PrimaryCTA onClick={go}>{finished ? "Turn it over" : "Skip ahead"}</PrimaryCTA>}
        >
            {!isDesktop && (
                <div className="onb-felt rounded-3xl h-[200px] mb-6 overflow-hidden">
                    <Spread answers={answers} mode="deck" compact />
                </div>
            )}
            <ol className="space-y-1 max-w-md">
                {lines.map((l, i) => {
                    const state = i < done ? "done" : i === done ? "doing" : "waiting";
                    return (
                        <motion.li key={l.id}
                            initial={reduce ? false : { opacity: 0, x: -10 }}
                            animate={{ opacity: state === "waiting" ? 0.35 : 1, x: 0 }}
                            transition={{ duration: 0.3, delay: reduce ? 0 : i * 0.05 }}
                            className="flex items-start gap-3.5 py-3 border-b border-border/70 last:border-0">
                            <span className={`mt-0.5 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-colors duration-300
                                ${state === "done" ? "bg-primary text-primary-foreground" : "border-2 border-border"}`}>
                                {state === "done" && <Check on reduce={reduce} />}
                                {state === "doing" && !reduce && (
                                    <motion.span className="w-2 h-2 rounded-full bg-primary"
                                        animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                                        transition={{ duration: 0.9, repeat: Infinity }} />
                                )}
                            </span>
                            <span className="min-w-0">
                                <span className="block text-[13px] font-semibold text-muted-foreground">{l.doing}</span>
                                <AnimatePresence initial={false}>
                                    {state === "done" && (
                                        <motion.span className="block font-display font-extrabold text-foreground text-[15px] leading-snug mt-0.5"
                                            initial={reduce ? false : { opacity: 0, y: 6, filter: "blur(3px)" }}
                                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                            transition={{ duration: 0.32 }}>
                                            {l.done}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </span>
                        </motion.li>
                    );
                })}
            </ol>
            <p className="text-[13px] text-muted-foreground leading-relaxed mt-5 max-w-md">
                Four short reviews, spread out, hold a topic better than four hours of
                rereading. It is most of what memory research has kept finding.
            </p>
        </StepShell>
    );
}

/* ═══ Reveal ═════════════════════════════════════════════════════════════════ */

const PIPS = ["♠", "♥", "♦", "♣"];

export function StepReveal({ answers, onNext, isDesktop, cta = "Keep this hand", footerExtra = null }) {
    const reduce = useReducedMotion();
    const facts = useMemo(() => revealFacts(answers), [answers]);
    const n = handFrom(answers).length;
    // The facts arrive once the last card has turned, so the hand is the
    // headline and the facts are what you read after looking at it.
    const after = reduce ? 0 : 0.45 + n * 0.2 + 0.3;

    return (
        <StepShell
            eyebrow={STEP_NAME.reveal}
            title="This is your hand."
            subtitle={personalLine(answers) || null}
            footer={(
                <>
                    {footerExtra}
                    <PrimaryCTA onClick={onNext}>{cta}</PrimaryCTA>
                </>
            )}
        >
            {!isDesktop && (
                <div className="onb-felt rounded-3xl h-[230px] mb-6 overflow-hidden">
                    <Spread answers={answers} mode="reveal" compact />
                </div>
            )}
            <ul className="space-y-3 max-w-md">
                {facts.map((f, i) => (
                    <motion.li key={f.id}
                        initial={reduce ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: after + i * 0.12 }}
                        className="flex gap-3.5">
                        <span aria-hidden="true"
                            className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-base font-bold
                                ${f.id === "target" ? "bg-[#F0B429]/15 text-[#B7860F]" : i % 2 ? "bg-destructive/10 text-destructive" : "bg-foreground/[0.06] text-foreground"}`}>
                            {f.id === "target" ? "♠" : PIPS[i % 4]}
                        </span>
                        <span className="min-w-0">
                            <span className="block font-display font-extrabold text-foreground text-[15px] leading-snug">{f.head}</span>
                            <span className="block text-[13px] text-muted-foreground leading-relaxed mt-0.5">{f.body}</span>
                        </span>
                    </motion.li>
                ))}
            </ul>
        </StepShell>
    );
}
