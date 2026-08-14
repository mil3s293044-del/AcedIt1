import React, { useEffect, useState } from "react";
import { motion, useScroll, useReducedMotion } from "framer-motion";
import { trackStartTrial } from "@/lib/analytics";
import EmailCapture from "@/components/marketing/EmailCapture";
import DealtHand from "@/components/marketing/DealtHand";
import CardStorm from "@/components/marketing/CardStorm";
import StepCards from "@/components/marketing/StepCards";
import EvidenceSplit from "@/components/marketing/EvidenceSplit";
import BrainShowcase from "@/components/marketing/BrainShowcase";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Check,
  GraduationCap,
  Sparkles,
  Brain,
  Flame,
  Trophy,
  Users,
  ShieldCheck,
  Clock,
  CreditCard,
  Quote,
} from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

const SUBJECTS = [
  "English",
  "Methods",
  "Specialist Maths",
  "General Maths",
  "Chemistry",
  "Physics",
  "Biology",
  "Psychology",
  "Legal Studies",
  "Business Management",
  "Economics",
  "Accounting",
  "Literature",
  "EAL",
  "Health & HD",
  "PE",
  "Geography",
  "History: Revolutions",
  "Philosophy",
  "Software Development",
  "Visual Communication",
  "Studio Arts",
  "Media",
  "Music",
  "Drama",
  "Theatre Studies",
  "Religion & Society",
  "Texts & Traditions",
];

/**
 * Three numbers, and each one answers a different objection: does it cover my
 * subject, can I afford it, is it there when I actually work. "100% VCAA
 * aligned" answered nobody's question and could not be checked.
 */
const STATS = [
  { num: "34", label: "VCE subjects, every one" },
  { num: "$5", label: "a week, not $90 an hour" },
  { num: "2am", label: "open when you actually study" },
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Primary CTA: route new visitors through the personalised onboarding
  // wizard (which collects year + subjects + goals, sells Premium, then
  // hands off to sign-in). Existing users use the "Login" link which sends
  // them to /login (email+password OR Google).
  const startTrial = () => { trackStartTrial(); window.location.assign("/onboarding"); };
  const goToLogin = () => { window.location.assign("/login"); };

  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#FBF7F0] text-[#0D1626] font-sans antialiased overflow-x-hidden scroll-smooth">
      {/* The opening. Hundreds of cards thrown at the screen, assembling into
          the app's own brain, which then takes them in. Sits on top of a page
          that is already rendered and interactive underneath, skips on any
          input, and runs once a session. See CardStorm for the rest. */}
      <CardStorm />

      {/* Scroll progress bar */}
      <motion.div
        aria-hidden
        className="fixed top-0 left-0 right-0 h-[2px] bg-primary z-[60] origin-left"
        style={{ scaleX: scrollYProgress }}
      />

      {/* ============================================================== */}
      {/* TOP NAV                                                          */}
      {/* ============================================================== */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#FBF7F0]/85 backdrop-blur-md border-b border-black/5"
            : "bg-transparent"
        }`}
      >
        {/* The nav used to switch from white ink to dark the moment you
            scrolled, because it started life over a navy hero. Over cream
            there is nothing to switch to — white on #FBF7F0 is invisible,
            which is exactly what recolouring the hero would have shipped.
            One ink, both states; only the bar behind it changes. */}
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_24px_rgba(88,204,2,0.45)]">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-extrabold text-xl tracking-tight text-[#0D1626]">
              AcedIt
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToId("how")}
              className="text-sm font-semibold text-[#0D1626]/80 hover:text-[#0D1626] transition cursor-pointer"
            >
              How it works
            </button>
            <button
              onClick={() => scrollToId("features")}
              className="text-sm font-semibold text-[#0D1626]/80 hover:text-[#0D1626] transition cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToId("pricing")}
              className="text-sm font-semibold text-[#0D1626]/80 hover:text-[#0D1626] transition cursor-pointer"
            >
              Pricing
            </button>
            <button
              onClick={goToLogin}
              className="text-sm font-semibold text-[#0D1626]/80 hover:text-[#0D1626] transition cursor-pointer"
            >
              Login
            </button>
          </div>
          <Button
            onClick={startTrial}
            className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-5 h-10 shadow-pop border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-2 transition cursor-pointer"
          >
            Start free week
          </Button>
        </div>
      </nav>

      {/* ============================================================== */}
      {/* HERO                                                             */}
      {/* ============================================================== */}
      {/* The hero is the app's own cream, not a navy slab.
          #0A0F1F is literally the app's DARK-mode background, so the page was
          matched to a theme most people never see: you went from a cold navy
          marketing site into a warm cream product. Same ground now, same white
          cards on it, and the drama comes from the hand rather than from the
          contrast. The indigo wash went with it — #6366F1 is not a colour this
          app owns. */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#FBF7F0]">
        <div className="absolute inset-0">
          {/* Two soft washes, both in the app's own accents.
              A light ground carries FAR less of these than a dark one did:
              at the strength that read as a glow behind navy, the green
              stained the whole left third and the corner of the nav sat on
              it. Pushed out to the corners and dropped to roughly a third of
              the opacity, they do what they are for — stop the cream being
              flat — without becoming the first thing you see. */}
          <motion.div
            className="absolute -top-56 -left-56 w-[620px] h-[620px] rounded-full blur-[150px] opacity-[0.10]"
            style={{ background: "radial-gradient(circle, #58CC02 0%, transparent 70%)" }}
            animate={prefersReducedMotion ? undefined : { x: [0, 80, 0], y: [0, 40, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-48 right-[-14%] w-[700px] h-[700px] rounded-full blur-[160px] opacity-[0.07]"
            style={{ background: "radial-gradient(circle, #FF4B4B 0%, transparent 70%)" }}
            animate={prefersReducedMotion ? undefined : { x: [0, -70, 0], y: [0, -50, 0] }}
            transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* The table the hand is dealt onto. Dark lines on a light ground
              now, rather than white ones on a dark one. */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[55%] opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(13,22,38,0.9) 1px, transparent 1px), linear-gradient(to bottom, rgba(13,22,38,0.9) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              transform: "perspective(800px) rotateX(60deg) translateY(20%)",
              transformOrigin: "center bottom",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 30%, black 80%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 30%, black 80%, transparent 100%)",
            }}
          />
          {/* Soft grain */}
          <div
            className="absolute inset-0 opacity-[0.05] mix-blend-multiply pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
        </div>

        <div className="relative z-20 w-full max-w-5xl mx-auto px-6 text-center pt-20 pb-[27vh] sm:pb-[37vh]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface border border-black/5 shadow-soft mb-7"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-[#0D1626]/80 tracking-wide">
              Built on 40 years of memory research
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-display font-extrabold text-[#0D1626] text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.98] tracking-tight"
          >
            {/* THE HOOK IS THE UNCOMFORTABLE TRUTH, and the sub-head is the
                fix. Every study app opens by promising a score, which is the
                one claim a student has already learned to discount. This opens
                by describing what they did last night.

                It is also, precisely, what the research says: Roediger and
                Karpicke put rereading against self-testing and the rereaders
                felt MORE confident and remembered less. Naming the thing
                everyone does and telling them it does not work is a real
                position, and a real position is the only thing on a landing
                page that cannot be copied by the next one. */}
            Rereading your notes
            <br />
            <span className="text-primary">barely works</span>
            <span className="text-primary">.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 text-lg sm:text-xl text-[#0D1626]/70 max-w-2xl mx-auto leading-relaxed"
          >
            It feels like studying, and the research is brutal about it.
            AcedIt is built on the four techniques that do work, with an AI
            examiner on top that marks every attempt against real VCAA criteria
            across all 34 subjects.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 rounded-2xl bg-primary blur-xl opacity-40 pointer-events-none"
              />
              <Button
                onClick={startTrial}
                className="relative bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl h-14 px-8 text-base shadow-pop border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-2 transition group cursor-pointer"
              >
                Start your free week
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </div>
            <button
              onClick={() => scrollToId("how")}
              className="h-14 px-7 rounded-2xl text-[#0D1626] font-semibold border-2 border-black/10 bg-surface hover:bg-surface/70 shadow-soft transition cursor-pointer"
            >
              See how it works
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-7 text-xs text-[#0D1626]/45 tracking-wide"
          >
            7 days free  ·  No card required  ·  Built for Year 10 to 12
          </motion.p>

        </div>

        {/* The hand. Every card is a real object from inside the app, drawn by
            the same component the app draws it with, so the hero shows the
            product rather than describing it.

            Pinned to the bottom of the section rather than placed at the end
            of the centred column: in the column it pushed the headline up and
            hung the fan off the fold. Cropped a little by the edge on purpose
            — a hand you are holding is not fully in view. */}
        {/* The positioning lives on a wrapper, NOT passed into the component.
            DealtHand's own class list starts with `relative`, and Tailwind
            emits position utilities in a fixed order where `relative` comes
            last — so an `absolute` handed in loses, the hand stayed in flow,
            and it squeezed the headline into the left half of the hero. */}
        <div className="absolute inset-x-0 bottom-[1%] z-30 pointer-events-none">
          <div className="pointer-events-auto"><DealtHand /></div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SUBJECTS MARQUEE                                                 */}
      {/* ============================================================== */}
      <section
        aria-label="VCE subjects covered"
        className="relative border-y border-black/5 bg-surface py-7 overflow-hidden"
      >
        <div
          className="absolute inset-y-0 left-0 w-24 z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, #FFFFFF 0%, rgba(255,255,255,0) 100%)",
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-24 z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(to left, #FFFFFF 0%, rgba(255,255,255,0) 100%)",
          }}
        />
        <motion.div
          className="flex gap-10 whitespace-nowrap"
          animate={prefersReducedMotion ? undefined : { x: ["0%", "-50%"] }}
          transition={{
            duration: 60,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {[...SUBJECTS, ...SUBJECTS].map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="text-sm font-semibold text-[#0D1626]/45 tracking-wide flex items-center gap-10"
            >
              {s}
              <span aria-hidden className="w-1 h-1 rounded-full bg-[#0D1626]/15" />
            </span>
          ))}
        </motion.div>
      </section>

      {/* ============================================================== */}
      {/* STATS STRIP                                                      */}
      {/* ============================================================== */}
      <section className="relative py-20 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.08 }}
              className="text-center"
            >
              <div className="font-display font-extrabold text-5xl sm:text-6xl tracking-tight text-[#0D1626]">
                {s.num}
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.2em] font-bold text-[#0D1626]/55">
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============================================================== */}
      {/* HOOK                                                             */}
      {/* ============================================================== */}
      <section className="relative py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.p
            {...fadeUp}
            className="text-xs font-bold tracking-[0.2em] text-primary uppercase mb-6"
          >
            The honest bit
          </motion.p>
          <motion.h2
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight"
          >
            In 2006 two researchers ran the experiment every student should
            be shown.
            <br />
            <span className="text-[#0D1626]/50">
              One group reread the material. One group put it away and tested
              themselves. The rereaders were more confident about how they
              would do. A week later they remembered far less. Feeling
              productive and being productive came apart completely, and almost
              nothing about how VCE is taught has caught up.
            </span>
          </motion.h2>
        </div>
      </section>

      {/* ============================================================== */}
      {/* THE EVIDENCE                                                     */}
      {/* ============================================================== */}
      {/* Dark, because it is the serious part of the page and because the
          cards in it need something to lie on. This is the section the whole
          product argument rests on: two techniques rated high, two rated low,
          and the fact that every student does the low ones. */}
      <section id="evidence" className="relative py-24 px-6 bg-[#0D1626] text-white overflow-hidden">
        <div className="relative max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="mb-14 max-w-2xl">
            <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase mb-4">
              What the research says
            </p>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight text-white leading-[1.05]">
              Ten techniques were ranked. Two came out on top.
            </h2>
            <p className="text-white/60 mt-5 leading-relaxed">
              Dunlosky and colleagues reviewed the ten study techniques students
              actually use and rated each for practical utility. The two that
              scored highest are the two nobody is taught. The two that scored
              lowest are the two everybody does.
            </p>
          </motion.div>

          <EvidenceSplit />

          <motion.p {...fadeUp} className="text-white/45 text-sm mt-14 max-w-2xl leading-relaxed">
            AcedIt is the two on the left, built into a daily loop, for VCE. The
            AI is not a replacement for any of it. It is the thing that marks
            each attempt, so the practice you are doing is practice at the
            standard you are actually being assessed against.
          </motion.p>
        </div>
      </section>

      {/* ============================================================== */}
      {/* THE BRAIN                                                        */}
      {/* ============================================================== */}
      {/* The same rotating model the Study page and the Analytics cognition
          tab render, driven by the same cited table. It is on the landing page
          because "built on the research" is a claim, and showing the actual
          model is the only cheap way to make a claim checkable. */}
      <section id="brain" className="relative py-24 px-6 bg-[#0B1220] text-white overflow-hidden">
        <div className="relative max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="mb-12 max-w-2xl">
            <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase mb-4">
              Inside the app
            </p>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight text-white leading-[1.05]">
              Every technique uses a different part of you.
            </h2>
            <p className="text-white/60 mt-5 leading-relaxed">
              This is the model AcedIt actually ships, not an illustration of
              one. Pick a technique and see which systems the work leans on. The
              useful part is the dark regions: a term of nothing but timed focus
              blocks leaves the memory systems barely touched, and that is a
              diagnosis you can do something about.
            </p>
          </motion.div>

          <BrainShowcase />
        </div>
      </section>

      {/* ============================================================== */}
      {/* HOW IT WORKS                                                     */}
      {/* ============================================================== */}
      {/* The band is dark because white cards on a white section are a shadow
          and a hairline rule and nothing else — the whole point of a card is
          that it is an object lying ON something. It also rhymes with the
          hero, so the page opens and explains itself on the same table. */}
      <section id="how" className="relative py-24 px-6 bg-[#0D1626] text-white overflow-hidden">
        {/* The same perspective floor the hero uses, so this reads as the
            table continuing rather than as an unrelated dark stripe. */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[70%] opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            transform: "perspective(800px) rotateX(62deg) translateY(18%)",
            transformOrigin: "center bottom",
            maskImage: "linear-gradient(to bottom, transparent 0%, black 40%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 40%, transparent 100%)",
          }} />
        <div className="relative max-w-7xl mx-auto">
          <motion.div {...fadeUp} className="max-w-2xl mb-16">
            <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase mb-4">
              How it works
            </p>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight text-white">
              Three steps. Then you just turn up.
            </h2>
          </motion.div>

          {/* The steps are three cards, turned over one at a time as you
              reach them — not three boxes with ghosted numerals and icons in
              rounded squares. Same words; the reveal is the app's own flip. */}
          <StepCards steps={[
            {
              title: "Pick your subjects",
              body: "Tell us your year level and what you are taking. AcedIt builds the roadmap to your exams. No setup, no menus, no blank page to stare at.",
              suit: "spade",
              tone: "#58CC02",
            },
            {
              title: "Practise the way that works",
              body: "Active recall, spaced repetition, blurting, exam mode. The methods are the ones the research backs, and the AI marks every attempt against the actual VCAA criteria.",
              suit: "diamond",
              tone: "#8B5CF6",
            },
            {
              title: "Come back before you forget",
              body: "AcedIt tracks how fast each topic is fading and puts it back in front of you at the point where the review actually counts. Streaks and a leaderboard handle the rest.",
              suit: "heart",
              tone: "#FF4B4B",
            },
          ]} />
        </div>
      </section>

      {/* ============================================================== */}
      {/* FEATURES BENTO                                                   */}
      {/* ============================================================== */}
      <section id="features" className="relative py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp} className="max-w-2xl mb-16">
            <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase mb-4">
              What you get
            </p>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight">
              Everything a top of state student does, in one app.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-5 auto-rows-[minmax(220px,auto)]">
            {/* Big tile — AI tutor */}
            <motion.div
              {...fadeUp}
              className="md:col-span-4 rounded-3xl bg-[#0D1626] text-white p-8 md:p-10 relative overflow-hidden flex flex-col justify-between min-h-[360px] border border-white/[0.06]"
            >
              {/* Faint grid overlay */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 mb-5">
                  <Brain className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-bold text-primary tracking-wide uppercase">
                    AI tutor
                  </span>
                </div>
                <h3 className="font-display font-extrabold text-3xl md:text-4xl tracking-tight mb-3 max-w-md">
                  Trained on VCAA examiner reports.
                </h3>
                <p className="text-white/60 text-sm md:text-base max-w-md leading-relaxed">
                  Every subject gets its own tutor, because marking Methods and
                  marking English are not the same job. It grades your SAC
                  answers the way an assessor would, then tells you the exact
                  words you were supposed to use.
                </p>
              </div>
              {/* Mock chat preview */}
              <div className="relative z-10 mt-8 space-y-2.5 max-w-md">
                <div className="bg-surface/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white/80 backdrop-blur-sm">
                  Mark this paragraph for English Analysis…
                </div>
                <div className="bg-primary/15 border border-primary/30 rounded-2xl px-4 py-3 text-sm text-white/90 backdrop-blur-sm">
                  <span className="text-primary font-semibold">Examiner says:</span>{" "}
                  Strong contention. Add a metalanguage tag here →
                </div>
              </div>
              {/* Decorative blur */}
              <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-primary/30 blur-[100px]" />
            </motion.div>

            {/* Streak + XP */}
            <motion.div
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.05 }}
              className="md:col-span-2 rounded-3xl bg-gradient-to-br from-[#FF4B4B] to-[#FF8A4B] text-white p-8 relative overflow-hidden flex flex-col justify-between min-h-[360px]"
            >
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5" />
                <span className="text-[11px] font-bold tracking-wide uppercase">
                  Streaks &amp; XP
                </span>
              </div>
              <div>
                <div className="font-display font-extrabold text-7xl tracking-tight leading-none">
                  47
                </div>
                <div className="text-sm font-semibold text-white/80 mt-1">
                  day streak
                </div>
              </div>
              <div>
                <div className="text-xs text-white/80 mb-2 font-semibold">
                  Today&rsquo;s XP  ·  240 / 300
                </div>
                <div className="h-2 rounded-full bg-surface/20 overflow-hidden">
                  <div className="h-full w-[80%] bg-surface rounded-full" />
                </div>
                <p className="mt-4 text-xs text-white/80 leading-relaxed">
                  Daily goals that make turning up the easy option, and make
                  skipping the one that costs you something.
                </p>
              </div>
            </motion.div>

            {/* Adaptive quizzes */}
            <motion.div
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.1 }}
              className="md:col-span-2 rounded-3xl bg-surface border border-black/5 p-8 relative overflow-hidden flex flex-col justify-between min-h-[300px]"
            >
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(217_91%_60%)]/10 border border-[hsl(217_91%_60%)]/20 mb-4">
                  <Sparkles className="w-3.5 h-3.5 text-[hsl(217_91%_60%)]" />
                  <span className="text-[11px] font-bold text-[hsl(217_91%_60%)] tracking-wide uppercase">
                    Adaptive quizzes
                  </span>
                </div>
                <h3 className="font-display font-extrabold text-2xl tracking-tight mb-2">
                  Practice questions from{" "}
                  <span className="text-[hsl(217_91%_60%)]">your</span> notes.
                </h3>
                <p className="text-[#0D1626]/60 text-sm leading-relaxed">
                  Upload your class notes and get exam-style questions back,
                  aimed at the topics you keep getting wrong rather than the
                  ones you already know.
                </p>
              </div>
              <div className="mt-6 flex gap-2">
                <span className="px-3 py-1 rounded-full bg-[hsl(217_91%_60%)]/10 text-[hsl(217_91%_60%)] text-xs font-semibold">
                  Methods
                </span>
                <span className="px-3 py-1 rounded-full bg-[#0D1626]/5 text-[#0D1626]/70 text-xs font-semibold">
                  Chemistry
                </span>
                <span className="px-3 py-1 rounded-full bg-[#0D1626]/5 text-[#0D1626]/70 text-xs font-semibold">
                  English
                </span>
              </div>
            </motion.div>

            {/* Friends + leaderboard */}
            <motion.div
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.15 }}
              className="md:col-span-4 rounded-3xl bg-surface border border-black/5 p-8 md:p-10 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 min-h-[300px]"
            >
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(280_65%_60%)]/10 border border-[hsl(280_65%_60%)]/20 mb-4">
                  <Users className="w-3.5 h-3.5 text-[hsl(280_65%_60%)]" />
                  <span className="text-[11px] font-bold text-[hsl(280_65%_60%)] tracking-wide uppercase">
                    Mates
                  </span>
                </div>
                <h3 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight mb-3 max-w-md">
                  Study with your group, not alone at midnight.
                </h3>
                <p className="text-[#0D1626]/60 text-sm leading-relaxed max-w-md">
                  Compete on weekly XP, set score wagers, run goal challenges
                  with your year level. The whole school can be on AcedIt.
                </p>
              </div>
              <div className="flex-shrink-0 w-full md:w-72 rounded-2xl bg-[#FBF7F0] p-5 border border-black/5">
                <div className="text-[11px] font-bold tracking-wide uppercase text-[#0D1626]/50 mb-3">
                  Year 12 leaderboard
                </div>
                {[
                  { name: "Sienna L.", xp: "12,480", rank: 1 },
                  { name: "Kai M.", xp: "11,210", rank: 2 },
                  { name: "You", xp: "10,940", rank: 3, you: true },
                ].map((row) => (
                  <div
                    key={row.rank}
                    className={`flex items-center justify-between py-2 border-b last:border-0 border-black/5 ${row.you ? "font-semibold" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          row.rank === 1
                            ? "bg-[hsl(35_100%_50%)] text-white"
                            : row.you
                            ? "bg-primary text-white"
                            : "bg-[#0D1626]/10 text-[#0D1626]"
                        }`}
                      >
                        {row.rank}
                      </div>
                      <span className="text-sm">{row.name}</span>
                    </div>
                    <span className="text-xs text-[#0D1626]/60">{row.xp} XP</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SOCIAL PROOF                                                     */}
      {/* ============================================================== */}
      <section className="relative py-24 px-6 bg-surface">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp} className="max-w-2xl mb-14">
            <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase mb-4">
              Real students
            </p>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight">
              What it actually changed.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote:
                  "It is a private tutor that happens to be awake at 2am the night before a SAC. The way it marks my essays is genuinely scary.",
                name: "Sienna",
                meta: "Year 12 · English & Methods",
                avatarColor: "bg-[hsl(280_65%_60%)]",
              },
              {
                quote:
                  "I finally know what the examiner actually wants. My Methods scores went from the 60s to the 80s in a term.",
                name: "Kai",
                meta: "Year 12 · Methods & Chem",
                avatarColor: "bg-primary",
              },
              {
                quote:
                  "The streak got me. I have studied every day for three months, which has literally never happened to me before.",
                name: "Aisha",
                meta: "Year 11 · Bio & Psych",
                avatarColor: "bg-[hsl(217_91%_60%)]",
              },
            ].map((t, i) => (
              <motion.div
                key={t.name}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.08 }}
                className="rounded-3xl border border-black/5 bg-[#FBF7F0] p-7 flex flex-col"
              >
                <Quote className="w-6 h-6 text-primary mb-5" />
                <p className="text-[#0D1626]/85 leading-relaxed text-base flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${t.avatarColor} flex items-center justify-center text-white font-bold text-sm`}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-[#0D1626]/55">{t.meta}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* PRICING                                                          */}
      {/* ============================================================== */}
      <section id="pricing" className="relative py-32 px-6 bg-[#0D1626] text-white overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary/20 blur-[140px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.p
            {...fadeUp}
            className="text-xs font-bold tracking-[0.2em] text-primary uppercase mb-4"
          >
            One plan. No tricks.
          </motion.p>
          <motion.h2
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.05 }}
            className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl tracking-tight mb-5"
          >
            Try it free for a week.
          </motion.h2>
          <motion.p
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="text-white/60 text-lg max-w-xl mx-auto mb-12"
          >
            Full access to every tool, every subject, every feature. Cancel
            before day 7 and you pay nothing.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.15 }}
            className="relative rounded-3xl bg-surface/[0.04] border border-white/10 backdrop-blur-md p-8 md:p-10 text-left shadow-[0_0_60px_rgba(88,204,2,0.08)]"
          >
            {/* Top gradient hairline */}
            <div
              aria-hidden
              className="absolute inset-x-8 top-0 h-px pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(88,204,2,0.6) 50%, transparent 100%)",
              }}
            />
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
              <div>
                <div className="inline-block text-[10px] font-bold tracking-wide uppercase text-primary bg-primary/15 border border-primary/30 px-2.5 py-1 rounded-full mb-4">
                  7-day free trial
                </div>
                <h3 className="font-display font-extrabold text-3xl tracking-tight mb-1">
                  AcedIt Premium
                </h3>
                <p className="text-white/55 text-sm">Everything, unlimited.</p>
              </div>
              <div className="text-right">
                <div className="font-display font-extrabold text-5xl leading-none">
                  Free
                </div>
                <div className="text-white/55 text-sm mt-2">
                  then $5 / week
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mb-8">
              {[
                "Essays and SACs marked against real VCAA criteria",
                "All 34 VCE subjects, each with its own tutor",
                "Ace, your study companion, awake whenever you are",
                "Unlimited quizzes, flashcards & practice",
                "Active recall, blurting & spaced repetition",
                "Compete: XP battles, wagers & friend leaderboards",
                "A planner that maps your week around your SACs",
                "Full progress & analytics dashboard",
              ].map((f) => (
                <div key={f} className="flex items-start gap-2 text-sm text-white/85">
                  <Check className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 rounded-2xl bg-primary blur-xl opacity-30 pointer-events-none"
              />
              <Button
                onClick={startTrial}
                className="relative w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl h-14 text-base shadow-pop border-b-4 border-primary-dark active:translate-y-0.5 active:border-b-2 transition group cursor-pointer"
              >
                Start your free week
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-7 text-[11px] text-white/55 font-semibold">
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-primary" /> No card needed
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-primary" /> Cancel in 30s
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> All VCE subjects
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-primary" /> Parent-approved
              </div>
            </div>
          </motion.div>

          <motion.p
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.2 }}
            className="mt-8 text-xs text-white/45"
          >
            Melbourne tutors charge $60 to $120 an hour. AcedIt is $5 a week.
          </motion.p>
        </div>
      </section>

      {/* ============================================================== */}
      {/* FAQ                                                              */}
      {/* ============================================================== */}
      <section className="relative py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-12">
            <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase mb-4">
              FAQ
            </p>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight">
              The questions worth asking.
            </h2>
          </motion.div>

          <motion.div {...fadeUp}>
            <Accordion type="single" collapsible className="w-full">
              {[
                {
                  q: "Is the trial really free?",
                  a: "Yes. Seven days, full access, no card needed to start. Cancel before day seven and we never charge you.",
                },
                {
                  q: "Which VCE subjects does it cover?",
                  a: "All 34. Each one has its own tutor trained on that subject’s examiner reports, so Methods feels like Methods and English feels like English. A single general-purpose chatbot cannot do that, which is the whole reason we built it this way.",
                },
                {
                  q: "How is this different from just using ChatGPT?",
                  a: "ChatGPT will tell you your answer is good. It has not read the VCAA criteria for your subject, so it cannot tell you that you have written a strong paragraph that scores 2 out of 5 because you never named the technique. AcedIt marks against the actual criteria and shows you the missing marks.",
                },
                {
                  q: "Will it actually help my ATAR?",
                  a: "It does not sit the exam for you. What it does is make each hour count for more, by marking your work the way an assessor would and naming the exact things you left out. Nobody can promise you a number, and you should not trust anyone who does.",
                },
                {
                  q: "Is this worth it for my kid? (the parent question)",
                  a: "Most Melbourne tutors charge $60 to $120 an hour. AcedIt is $5 a week, so a whole month costs less than one session, and it is there on the Sunday night before a SAC when a tutor is not.",
                },
                {
                  q: "How do I cancel?",
                  a: "Subscription settings, one tap. We show you the exact date the trial ends before you start, so there is nothing to be surprised by.",
                },
                {
                  q: "Is my data safe?",
                  a: "Your work and your notes stay yours. We never sell student data, and your account sits on encrypted Australian-region infrastructure.",
                },
              ].map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="border-b border-black/10 last:border-0"
                >
                  <AccordionTrigger className="text-left font-semibold text-base py-5 hover:no-underline">
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

      {/* ============================================================== */}
      {/* FINAL CTA BAND                                                   */}
      {/* ============================================================== */}
      <section className="relative py-24 px-6">
        <motion.div
          {...fadeUp}
          className="max-w-5xl mx-auto rounded-[36px] bg-gradient-to-br from-primary to-[hsl(89_97%_32%)] p-10 md:p-16 text-center text-white shadow-soft-lg overflow-hidden relative"
        >
          <div className="absolute inset-0 opacity-20 mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
          <div className="relative">
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl tracking-tight mb-5">
              Find out what you have been missing.
            </h2>
            <p className="text-white/85 text-lg max-w-xl mx-auto mb-9">
              Free for seven days, about thirty seconds to set up. Bring the
              last thing you wrote and see what an assessor would have said.
            </p>
            <Button
              onClick={startTrial}
              className="bg-surface hover:bg-surface/95 text-[#0D1626] font-bold rounded-2xl h-14 px-8 text-base shadow-soft-lg group cursor-pointer"
            >
              Start your free week
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ============================================================== */}
      {/* LEAD CAPTURE — for visitors not ready to start a trial yet       */}
      {/* ============================================================== */}
      <section className="px-6 py-16">
        <motion.div {...fadeUp} className="max-w-2xl mx-auto rounded-3xl bg-[#F7F8FA] border border-black/5 p-8 md:p-10">
          <EmailCapture source="landing_roadmap" leadMagnet="vce_study_roadmap" />
        </motion.div>
      </section>

      {/* ============================================================== */}
      {/* FOOTER                                                           */}
      {/* ============================================================== */}
      <footer className="border-t border-black/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-extrabold text-lg">AcedIt</span>
            <span className="text-xs text-[#0D1626]/50 ml-2">
              VCE study, done well.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#0D1626]/55">
            <button onClick={() => scrollToId("how")} className="hover:text-[#0D1626] cursor-pointer">How it works</button>
            <button onClick={() => scrollToId("features")} className="hover:text-[#0D1626] cursor-pointer">Features</button>
            <button onClick={() => scrollToId("pricing")} className="hover:text-[#0D1626] cursor-pointer">Pricing</button>
            <button onClick={goToLogin} className="hover:text-[#0D1626] cursor-pointer">Login</button>
            <a href="/privacy" className="hover:text-[#0D1626] cursor-pointer">Privacy</a>
            <a href="/terms" className="hover:text-[#0D1626] cursor-pointer">Terms</a>
            <a href="mailto:admin@acedit.com.au" className="hover:text-[#0D1626] cursor-pointer">Contact</a>
          </div>
          <div className="text-xs text-[#0D1626]/40">
            © {new Date().getFullYear()} AcedIt. Made for VCE.
          </div>
        </div>
      </footer>
    </div>
  );
}
