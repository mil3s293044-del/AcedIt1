/**
 * The credits. Everything the film does not have room to say.
 *
 * IT IS NOT AN ACT AND IT DELIBERATELY DOES NOT SNAP. The reel carries you;
 * this is where you go to check it. Giving reference material snap points would
 * make LEAVING the film feel like being detained by it, which is the exact
 * failure that makes a scroll-jacked site hateful — the moment you decide you
 * want to read the pricing, the page should stop performing.
 *
 * WHAT SURVIVED FROM THE OLD PAGE, and why so little. It had thirteen bands: a
 * subject marquee, a stats strip, a hook, an evidence split, a brain, a
 * how-it-works, a feature bento, a marking demo, a forgetting curve, a price
 * anchor, pricing, FAQ, and a final CTA. Six of those are now ACTS, where they
 * are interactive rather than recited. The marquee, the stats strip, the hook
 * and the how-it-works were all restatements of things the acts now demonstrate
 * — and a demonstration followed by a paragraph repeating it is the paragraph
 * telling the reader the demonstration did not work.
 *
 * What is left is the three things a film genuinely cannot do: the PRICE in
 * full, the OBJECTIONS answered in the reader's own words, and the legal
 * footer. Those are reference, they are read rather than watched, and they are
 * where the sceptic and the search engine both go.
 *
 * THE TRIAL LENGTH COMES FROM `TRIAL_DAYS`. It is printed on the reel's turn,
 * inside the wizard's sign-in step and three times here — six surfaces for one
 * number, which is precisely the shape this codebase has had to fix a dozen
 * times over.
 */
import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Clock, CreditCard, ShieldCheck, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import BrandMark from "@/components/shared/BrandMark";
import EmailCapture from "@/components/marketing/EmailCapture";
import { TRIAL_DAYS, ACEDIT_WEEKLY } from "@/lib/reel";

const fadeUp = {
    initial: { opacity: 0, y: 22 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-70px" },
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
};

const INCLUDED = [
    "Essays and SACs marked against real VCAA criteria",
    "Every VCE subject, each with its own tutor",
    "Ace, your study companion, awake whenever you are",
    "Unlimited quizzes, flashcards & practice",
    "Active recall, blurting & spaced repetition",
    "Compete: markets, leagues & friend leaderboards",
    "A planner that maps your week around your SACs",
    "Full progress & analytics dashboard",
];

const FAQ = [
    {
        q: "Is the trial really free?",
        a: `Yes. ${TRIAL_DAYS} days, full access, no card needed to start. Cancel before day ${TRIAL_DAYS} and we never charge you.`,
    },
    {
        q: "Which VCE subjects does it cover?",
        a: "Every one of them, including the small ones. Each subject has its own tutor trained on that subject’s examiner reports, so Methods feels like Methods and Theatre Studies feels like Theatre Studies. A single general-purpose chatbot cannot do that, which is the whole reason we built it this way.",
    },
    {
        q: "How is this different from just using ChatGPT?",
        a: "ChatGPT will tell you your answer is good. It has not read the VCAA criteria for your subject, so it cannot tell you that you have written a strong paragraph that scores 2 out of 5 because you never named the technique. AcedIt marks against the actual criteria and shows you the missing marks — which is the thing you tapped through a few screens ago.",
    },
    {
        q: "Will it actually help my ATAR?",
        a: "It does not sit the exam for you. What it does is make each hour count for more, by marking your work the way an assessor would and naming the exact things you left out. Nobody can promise you a number, and you should not trust anyone who does.",
    },
    {
        q: "Is this worth it for my kid? (the parent question)",
        a: `Most Melbourne tutors charge $60 to $120 an hour. AcedIt is $${ACEDIT_WEEKLY} a week, so a whole month costs less than one session, and it is there on the Sunday night before a SAC when a tutor is not.`,
    },
    {
        q: "How do I cancel?",
        a: "Subscription settings, one tap. We show you the exact date the trial ends before you start, so there is nothing to be surprised by.",
    },
    {
        q: "Is my data safe?",
        a: "Your work and your notes stay yours. We never sell student data, and your account sits on encrypted Australian-region infrastructure.",
    },
];

export default function ReelTail({ onStart, onLogin }) {
    return (
        <div id="details" className="relative bg-[#FBF7F0] text-[#0D1626]">

            {/* ── Pricing ──────────────────────────────────────────────── */}
            <section id="pricing" className="relative py-24 sm:py-32 px-6 bg-[#0D1626] text-white overflow-hidden">
                {/* A radial gradient, NOT a blurred circle. A 140px gaussian on
                    a 500px element is re-rasterised every frame it is composited
                    over, which is what put the old hero at 11fps. A blurred
                    circle IS a radial gradient; drawn as one it costs nothing. */}
                <div
                    aria-hidden
                    className="absolute -top-40 -right-40 w-[560px] h-[560px] rounded-full pointer-events-none opacity-20"
                    style={{ background: "radial-gradient(circle, #58CC02 0%, rgba(88,204,2,0) 70%)" }}
                />
                <div className="relative max-w-3xl mx-auto text-center">
                    <motion.p {...fadeUp} className="text-xs font-black tracking-[0.2em] text-primary uppercase mb-4">
                        One plan. No tricks.
                    </motion.p>
                    <motion.h2 {...fadeUp} className="font-display font-black text-4xl sm:text-5xl md:text-6xl tracking-tight mb-5">
                        Try it free for a week.
                    </motion.h2>
                    <motion.p {...fadeUp} className="text-white/60 text-lg max-w-xl mx-auto mb-12">
                        Full access to every tool, every subject, every feature. Cancel
                        before day {TRIAL_DAYS} and you pay nothing.
                    </motion.p>

                    <motion.div
                        {...fadeUp}
                        className="relative rounded-3xl bg-white/[0.04] border border-white/10 p-8 md:p-10 text-left
                                   shadow-[0_0_60px_rgba(88,204,2,0.08)]"
                    >
                        <div
                            aria-hidden
                            className="absolute inset-x-8 top-0 h-px pointer-events-none"
                            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(88,204,2,0.6) 50%, transparent 100%)" }}
                        />
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
                            <div>
                                <div className="inline-block text-[10px] font-black tracking-wide uppercase text-primary
                                                bg-primary/15 border border-primary/30 px-2.5 py-1 rounded-full mb-4">
                                    {TRIAL_DAYS}-day free trial
                                </div>
                                <h3 className="font-display font-black text-3xl tracking-tight mb-1">AcedIt Premium</h3>
                                <p className="text-white/55 text-sm">Everything, unlimited.</p>
                            </div>
                            <div className="text-right">
                                <div className="font-display font-black text-5xl leading-none">Free</div>
                                <div className="text-white/55 text-sm mt-2">then ${ACEDIT_WEEKLY} / week</div>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mb-8">
                            {INCLUDED.map((f) => (
                                <div key={f} className="flex items-start gap-2 text-sm text-white/85">
                                    <Check className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                                    <span>{f}</span>
                                </div>
                            ))}
                        </div>

                        <Button
                            onClick={onStart}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-black rounded-2xl h-14 text-base
                                       shadow-pop border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-2
                                       transition group cursor-pointer"
                        >
                            Start your free week
                            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                        </Button>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-7 text-[11px] text-white/55 font-bold">
                            <div className="flex items-center gap-2"><CreditCard className="w-3.5 h-3.5 text-primary" /> No card needed</div>
                            <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-primary" /> Cancel in 30s</div>
                            <div className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-primary" /> All VCE subjects</div>
                            <div className="flex items-center gap-2"><Trophy className="w-3.5 h-3.5 text-primary" /> Parent-approved</div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── FAQ ──────────────────────────────────────────────────── */}
            <section id="faq" className="relative py-20 sm:py-24 px-6">
                <div className="max-w-3xl mx-auto">
                    <motion.div {...fadeUp} className="text-center mb-10">
                        <p className="text-xs font-black tracking-[0.2em] text-primary uppercase mb-4">FAQ</p>
                        <h2 className="font-display font-black text-4xl sm:text-5xl tracking-tight">
                            The questions worth asking.
                        </h2>
                    </motion.div>
                    <motion.div {...fadeUp}>
                        <Accordion type="single" collapsible className="w-full">
                            {FAQ.map((item, i) => (
                                <AccordionItem key={i} value={`q${i}`} className="border-b border-black/10 last:border-0">
                                    <AccordionTrigger className="text-left font-bold text-base py-5 hover:no-underline">
                                        {item.q}
                                    </AccordionTrigger>
                                    <AccordionContent className="text-[#0D1626]/70 leading-relaxed text-sm pb-5">
                                        {item.a}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </motion.div>
                </div>
            </section>

            {/* ── Lead capture, for the ones not ready ─────────────────── */}
            <section className="px-6 pb-16">
                <motion.div {...fadeUp} className="max-w-2xl mx-auto rounded-3xl bg-[#F7F8FA] border border-black/5 p-8 md:p-10">
                    <EmailCapture source="landing_roadmap" leadMagnet="vce_study_roadmap" />
                </motion.div>
            </section>

            {/* ── Footer ───────────────────────────────────────────────── */}
            <footer className="border-t border-black/5 py-12 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <BrandMark size="sm" tone="fill-[#0D1626]" wordClassName="text-[#0D1626]" />
                        <span className="text-xs text-[#0D1626]/50 ml-2">VCE study, done well.</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#0D1626]/55">
                        <a href="#pricing" className="hover:text-[#0D1626] cursor-pointer">Pricing</a>
                        <a href="#faq" className="hover:text-[#0D1626] cursor-pointer">FAQ</a>
                        <button onClick={onLogin} className="hover:text-[#0D1626] cursor-pointer">Login</button>
                        <a href="/privacy" className="hover:text-[#0D1626] cursor-pointer">Privacy</a>
                        <a href="/terms" className="hover:text-[#0D1626] cursor-pointer">Terms</a>
                        <a href="mailto:admin@acedit.com.au" className="hover:text-[#0D1626] cursor-pointer">Contact</a>
                    </div>
                    <div className="text-xs text-[#0D1626]/40">
                        &copy; {new Date().getFullYear()} AcedIt. Made for VCE.
                    </div>
                </div>
            </footer>
        </div>
    );
}
