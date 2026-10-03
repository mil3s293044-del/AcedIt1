/**
 * A fixture harness for the floor's three new surfaces. Lives under scripts/
 * so it is never an entry point of the production build.
 */
import UpdatePrompt from "@/components/shared/UpdatePrompt";
import { LiveProvider } from "@/lib/LiveContext";
import WeekStrip from "@/components/ranked/WeekStrip";
import { Swords as ReachSwords, ListChecks as ReachList,
    Trophy as ReachTrophy, GraduationCap as ReachCap } from "lucide-react";
import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import AceDeal from "@/components/market/AceDeal";
import TakeSide from "@/components/market/TakeSide";
import MarketCard from "@/components/market/MarketCard";
import SettlementReveal from "@/components/market/SettlementReveal";
import Room from "@/components/market/Room";
import MarkEntry from "@/components/planner/MarkEntry";
import DeckStack from "@/components/cards/DeckStack";
import SourcePanel from "@/components/quizzes/SourcePanel";
import { isReady } from "@/lib/due";
import { normaliseQuestion } from "@/lib/quizSchema";
import { PROBLEMS, GENERATE_PRICE, closingFacts } from "@/lib/firstWin";
import { LineDialog } from "@/pages/Competitions";
import CalibrationCurve from "@/components/market/CalibrationCurve";
import PortfolioPanel from "@/components/market/PortfolioPanel";
import { readMarket } from "@/lib/market";
import AceShuffle, { AceLoading } from "@/components/ace/AceShuffle";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { MemoryRouter } from "react-router-dom";
import ConsentBanner from "@/components/legal/ConsentBanner";
import AgeGate from "@/components/legal/AgeGate";
import CredStore from "@/components/market/CredStore";
import PriceTick from "@/components/market/PriceTick";
import { CATALOGUE, grantForTier } from "@/lib/credStore";
import BottomNav from "@/components/layout/BottomNav";
import { CardBack } from "@/components/cards/PlayingCard";
import PrankOverlay from "@/components/pranks/PrankOverlay";
import { PRANK_LIST } from "@/lib/pranks";
import { BACK_SKINS } from "@/lib/cosmetics";
import WeeklyBoard from "@/components/league/WeeklyBoard";
import Podium from "@/components/league/Podium";
import ScoreGuide from "@/components/league/ScoreGuide";
import Crest from "@/components/shared/Crest";
import { podiumGap, ordinal } from "@/lib/league";
import { grantForLeague } from "@/lib/credStore";
import WhatToTest from "@/components/study/WhatToTest";
import SourceRow from "@/components/study/SourceRow";
import { Flag, Plus, Scale } from "lucide-react";
import ActiveRecall from "@/components/study/ActiveRecall";
import BlurtingMethod from "@/components/study/BlurtingMethod";
import { ArrowRight, Target } from "lucide-react";
import { COMPONENT_MOVE, boardById, titlesFor, standing } from "@/lib/ranked";
import RankedBoard from "@/components/ranked/RankedBoard";
import StandingRail from "@/components/ranked/StandingRail";
import { ScopeSwitch, BoardSwitch } from "@/components/ranked/BoardControls";
import { movementMap } from "@/lib/boardMovement";
import { boardsFor } from "@/lib/ranked";
import { liftFor } from "@/lib/atarLift";

const which = new URLSearchParams(location.search).get("v") || "deal";

// POSITIONS NEED TIMESTAMPS OR THE TAPE IS A VERTICAL BAR. `priceHistory`
// sorts and plots on `created_date`; without one every step collapses onto
// x=0 and the sparkline renders as a single stroke against the left edge,
// which reads as a broken chart rather than as a quiet market. The fixture
// has to carry the shape of real data — the same lesson the Quizzes shelf
// learned when three-quizzes-per-subject hid a layout that fell apart on a
// real account.
const ago = (h) => new Date(Date.now() - h * 36e5).toISOString();

const sac = readMarket({
    id: "m-sac", kind: "sac", status: "open", prior: 0.38,
    title: "Will Miles score 85%+ on Chemistry Unit 3 SAC 2?",
    resolves_note: "On the mark Miles enters on their planner. They can't back it — you can.",
    created_date: ago(72),
    closes_at: new Date(Date.now() + 5 * 864e5).toISOString(),
    subject_is_me: true, subject_email: "me@x.com",
    meta: { target: 85, subject: "Chemistry", thin: false, seen: 4, average: 74 },
}, [
    { id: "a", p: 0.72, stake: 100, price_at_entry: 0.38, created_date: ago(58),
        user_name: "Ava", user_email: "ava@x.com" },
    { id: "b", p: 0.3, stake: 150, price_at_entry: 0.5, created_date: ago(31),
        user_name: "Ben", user_email: "ben@x.com" },
    { id: "c", p: 0.25, stake: 50, price_at_entry: 0.55, created_date: ago(6),
        user_name: "Cat", user_email: "cat@x.com" },
], "me@x.com");

/* A head-to-head: the sides are two people, so nothing on the card may say
   "Yes". The longest labels the board can produce, which is what makes this
   the case worth drawing. */
const versus = readMarket({
    id: "m-vs", kind: "versus", status: "open", prior: 0.52,
    title: "Who logs more hours this week — Priyanka or Sam?",
    created_date: ago(96),
    closes_at: new Date(Date.now() + 26 * 36e5).toISOString(),
    meta: { names: ["Priyanka", "Sam"] },
}, [
    { id: "d", p: 0.66, stake: 250, price_at_entry: 0.52, created_date: ago(70),
        user_name: "Ben", user_email: "ben@x.com" },
    { id: "e", p: 0.58, stake: 120, price_at_entry: 0.6, created_date: ago(20),
        user_name: "Me", user_email: "me@x.com" },
], "me@x.com");

/* THE EXTREME. A longshot sitting at single digits is where a split bar is
   most tempting to draw wrong: labels inside the segments have nowhere to go,
   and an unclamped fill renders the long side as a hairline that reads as no
   side at all. */
const longshot = readMarket({
    id: "m-ls", kind: "longshot", status: "open", prior: 0.08,
    title: "Will anyone on the board log 7 days AND sit 5 quizzes this week?",
    created_date: ago(120),
    closes_at: new Date(Date.now() + 40 * 36e5).toISOString(),
    meta: { target: 7 },
}, [
    { id: "f", p: 0.05, stake: 400, price_at_entry: 0.08, created_date: ago(90),
        user_name: "Ravi", user_email: "r@x.com" },
    { id: "g", p: 0.04, stake: 300, price_at_entry: 0.07, created_date: ago(40),
        user_name: "Ines", user_email: "i@x.com" },
], "me@x.com");

/* Nobody has touched it. The quietest card the board can deal, and the one
   that has to read as a question rather than as a chart that failed. */
const quiet = readMarket({
    id: "m-q", kind: "streak", status: "open", prior: 0.5,
    title: "Will Ava study 5+ days this week?",
    created_date: ago(12),
    closes_at: new Date(Date.now() + 3 * 864e5).toISOString(),
    meta: { target: 5, thin: true },
}, [], "me@x.com");

const views = {
    deal: () => <Room><AceDeal /></Room>,
    take: () => (
        <Room>
            <div className="max-w-sm mx-auto space-y-6">
                {[0.62, 0.86, 0.22, 0.97].map((price) => (
                    <div key={price} className="rounded-2xl border-2 border-[#233247] bg-[#121C2E] p-4">
                        <p className="text-[#E8F0FB] font-bold text-sm mb-1">
                            room at {Math.round(price * 100)}¢
                        </p>
                        <TakeSide price={price} balance={1000} onTake={() => {}} onCancel={() => {}} />
                    </div>
                ))}
            </div>
        </Room>
    ),
    // EVERY SHAPE THE BOARD CAN DEAL, one under the other: a market about you,
    // a head-to-head whose sides are two names, one you already hold, and one
    // nobody has touched. Judging a card on its happy case is how the Quizzes
    // shelf shipped a layout that fell apart on a real account.
    card: () => (
        <Room>
            <div className="max-w-sm mx-auto grid gap-3">
                <MarketCard market={sac} balance={1000} onTake={() => {}} onReport={() => {}} />
                <MarketCard market={versus} balance={1000} onTake={() => {}} />
                <MarketCard market={longshot} balance={1000} onTake={() => {}} />
                <MarketCard market={quiet} balance={1000} onTake={() => {}} />
            </div>
        </Room>
    ),
    book: () => <Room><div className="max-w-5xl mx-auto"><PortfolioPanel /></div></Room>,
    equity: () => (
        <Room>
            <div className="max-w-md mx-auto rounded-2xl border-2 border-[var(--floor-edge)]
                bg-[var(--floor-card)] p-4 space-y-4">
                <CalibrationCurve data={{
                    ready: true, graded: 24, needs: 0,
                    bands: [
                        { label: "50–60%", stated: 0.55, actual: 0.52, n: 6, enough: true },
                        { label: "60–70%", stated: 0.65, actual: 0.71, n: 5, enough: true },
                        { label: "70–80%", stated: 0.75, actual: 0.62, n: 8, enough: true },
                        { label: "80–90%", stated: 0.85, actual: 0.9, n: 5, enough: true },
                        { label: "90–100%", stated: 0.95, actual: 0.5, n: 2, enough: false },
                    ],
                }} />
            </div>
        </Room>
    ),
    reveal: () => (
        <Room>
            <SettlementReveal onSeen={() => {}} items={[{
                id: "called:x", kind: "beat",
                title: "Will Miles score 85%+ on Chemistry Unit 3 SAC 2?",
                called: 85, actual: 91, room: 41, backed: 1, faded: 2, traders: 3,
                outcome: true, payout: 0,
            }]} />
        </Room>
    ),
    // The whole floor in one screen: board card, take-side, the dialog and the
    // portfolio's two charts, so the palette can be judged as a room.
    floor: () => (
        <Room>
            <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                    <h2 className="text-[10px] font-black uppercase tracking-widest
                        text-[var(--floor-dim)]">The board</h2>
                    <MarketCard market={sac} balance={1000} onTake={() => {}} onReport={() => {}} />
                    <MarketCard market={versus} balance={1000} onTake={() => {}} />
                    <MarketCard market={quiet} balance={1000} onTake={() => {}} />
                    <div className="rounded-2xl border-2 border-[var(--floor-edge)]
                        bg-[var(--floor-card)] p-4">
                        <h2 className="text-[10px] font-black uppercase tracking-widest
                            text-[var(--floor-dim)] mb-2.5">The tape</h2>
                        <p className="text-[12px] text-[var(--floor-muted)]">
                            Ava took <span className="font-black text-[var(--floor-yes-ink)]">yes</span> at
                            71% with 300 credits
                        </p>
                        <p className="text-[12px] text-[var(--floor-muted)]">
                            Ben took <span className="font-black text-[var(--floor-no-ink)]">no</span> at
                            29% with 150 credits
                        </p>
                        <p className="text-[11px] text-[var(--floor-dimmest)] mt-2">
                            Credits are not XP — a call that goes against you can&apos;t touch your level.
                        </p>
                    </div>
                </div>
                <div className="rounded-2xl border-2 border-[var(--floor-edge)]
                    bg-[var(--floor-card)] p-4">
                    <h2 className="text-[10px] font-black uppercase tracking-widest
                        text-[var(--floor-dim)] mb-2">Take a side</h2>
                    <TakeSide price={0.38} balance={1000} onTake={() => {}} onCancel={() => {}} />
                </div>
            </div>
        </Room>
    ),
    line: () => (
        <Room>
            <LineDialog onClose={() => {}} onOpen={() => {}} busy={false}
                taken={new Set()} email="me@x.com" />
        </Room>
    ),
    // Every size of the one loader, on both grounds, plus the in-control case
    // that 58 buttons now use.
    loaders: () => (
        <div className="min-h-screen bg-background p-8 space-y-8">
            <div className="flex items-end gap-8">
                {["sm", "md", "lg"].map((z) => (
                    <div key={z} className="text-center">
                        <AceShuffle size={z} />
                        <p className="text-xs text-muted-foreground mt-2">{z}</p>
                    </div>
                ))}
            </div>
            <div className="card-soft max-w-md"><AceLoading>Loading the board…</AceLoading></div>
            <div className="flex flex-wrap items-center gap-3">
                <Button className="gap-2"><AceShuffle size="sm" /> Generating…</Button>
                <Button size="sm" className="gap-2"><AceShuffle size="sm" /> Saving…</Button>
                <Button variant="outline" className="gap-2"><AceShuffle size="sm" /> Marking…</Button>
                <button type="button" className="px-2.5 py-1.5 rounded-xl text-xs font-bold border-2
                    border-border inline-flex items-center gap-1.5">
                    <AceShuffle size="sm" /> Set
                </button>
            </div>
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                <AceShuffle size="sm" /> Loading your books…
            </p>
            {/* The floor: literal ink, both themes. */}
            <div className="rounded-2xl p-8 flex items-center gap-6" style={{ background: "#0A121F" }}>
                <AceShuffle size="lg" ink="floor" />
                <AceShuffle size="lg" />
                <span className="text-xs" style={{ color: "#6F86A8" }}>floor ink · token ink</span>
            </div>
        </div>
    ),
    mark: () => (
        <div className="min-h-screen bg-background p-8">
            <MarkEntry assessment={{ id: "1", subject_name: "Chemistry", title: "Unit 3 SAC 2", out_of: 60 }}
                busy={false} onSave={() => {}} onSkip={() => {}} onClose={() => {}} />
        </div>
    ),

    /* The complaint that produced this: a 50-card deck with 10 reviewed said
       "10 due", and a deck nobody had opened said "All caught up". Both faces
       are drawn here against real card rows so the number can be read off a
       screenshot rather than off a test. */
    decks: () => {
        const yday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const card = (learned) => learned
            ? { question: "q", answer: "a", total_reviews: 3, repetitions: 3, next_review_date: yday }
            : { question: "q", answer: "a", total_reviews: 0, repetitions: 0, next_review_date: yday };
        const n = (count, learned) => Array.from({ length: count }, () => card(learned));
        const decks = [
            { topic: "Redox reactions", unit: "Unit 3", cards: [...n(10, true), ...n(40, false)] },
            { topic: "Never opened", unit: "Unit 4", cards: n(50, false) },
            { topic: "Genuinely clear", unit: "Unit 3", cards: n(12, true).map(
                (c) => ({ ...c, next_review_date: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10) })) },
        ];
        return (
            <div className="min-h-screen bg-background p-8 space-y-4">
                <p className="text-sm text-muted-foreground">
                    Left: 10 reviewed + 40 never opened. Middle: nothing opened. Right: all scheduled ahead.
                </p>
                <div className="flex flex-wrap gap-5">
                    {decks.map((d, i) => (
                        <DeckStack key={d.topic} index={i} topic={d.topic} unit={d.unit}
                            subject="Chemistry" tone="#1CB0F6" total={d.cards.length}
                            ready={d.cards.filter(isReady).length}
                            weak={0} mastery={40}
                            onSelect={() => {}} onStats={() => {}} onDelete={() => {}} />
                    ))}
                </div>
            </div>
        );
    },

    /* The first run's four talking beats, side by side. It is auth-gated AND
       only fires for an account a few hours old, so this is the only way to
       judge the copy and the controls without making a new account. The bubble
       is the real one; only the state around it is fixture. */
    firstwin: () => {
        const subjects = [
            { name: "Chemistry", color: "#1CB0F6" },
            { name: "Mathematical Methods", color: "#CE82FF" },
            { name: "English", color: "#58CC02" },
        ];
        const Bubble = ({ title, eyebrow, children }) => (
            <div className="w-[min(21rem,calc(100vw-8.5rem))] flex-none">
                <div className="card-soft p-4">
                    <p className="stat-label">{eyebrow}</p>
                    <p className="font-display font-extrabold text-foreground leading-tight">{title}</p>
                    {children}
                </div>
            </div>
        );
        const facts = closingFacts({ score: 67, xp: 24, dropped: 2 });
        return (
            <div className="min-h-screen bg-background p-8">
                <p className="text-sm text-muted-foreground mb-5">
                    First run — the four beats Ace speaks. Beat four is the real QuizPlayer.
                </p>
                <div className="flex flex-wrap gap-5 items-start">
                    <Bubble eyebrow="Let's do one real thing" title="Which subject?">
                        <p className="text-sm text-foreground leading-snug mt-2.5">
                            I will build you three real exam questions and mark them. Pick the one
                            you are most worried about.
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {subjects.map((s) => (
                                <span key={s.name} className="inline-flex items-center gap-1.5 rounded-xl
                                    border-2 border-border px-2.5 py-1.5 text-xs font-bold text-foreground">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                    {s.name}
                                </span>
                            ))}
                        </div>
                    </Bubble>

                    <Bubble eyebrow="Let's do one real thing" title="What is going wrong in Chemistry?">
                        <div className="mt-2.5 space-y-1.5">
                            {PROBLEMS.map((p) => (
                                <span key={p.id} className="block w-full text-left rounded-xl border-2
                                    border-border px-3 py-2 text-sm font-bold text-foreground">
                                    {p.label}
                                </span>
                            ))}
                        </div>
                    </Bubble>

                    <Bubble eyebrow="Let's do one real thing" title="Three questions, then">
                        <p className="text-sm text-foreground leading-snug mt-2.5">{PROBLEMS[0].answer}</p>
                        <p className="text-sm text-foreground leading-snug mt-2">
                            <span className="font-bold">{PROBLEMS[0].techniqueLabel}</span> is on the Study
                            page for that. First, let's see where you actually are.
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-snug mt-2.5">
                            Anything AI costs <span className="font-bold text-foreground">chips</span> from a
                            weekly allowance — this one is {GENERATE_PRICE} of your 450.
                        </p>
                        <div className="flex items-center gap-3 mt-3">
                            <span className="text-xs font-bold text-muted-foreground">Not now</span>
                            <span className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary
                                text-primary-foreground px-3 py-1.5 text-xs font-bold">
                                Build them
                            </span>
                        </div>
                    </Bubble>

                    <Bubble eyebrow="That is a real result" title="You are up and running">
                        <p className="text-sm text-foreground leading-snug mt-2.5">
                            You scored <span className="font-bold">{facts.score}%</span> on that and earned
                            {" "}{facts.xp} XP. That quiz and your answers are yours now — they are in your library.
                        </p>
                        <p className="text-sm text-foreground leading-snug mt-2">
                            You dropped a mark or two. Every one you save from a marked answer goes to your
                            {" "}<span className="font-bold">Mistake Bank</span>, which drills it until you can
                            produce it — then asks you to prove it on the real question again.
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-snug mt-2.5">{facts.atarLine}</p>
                    </Bubble>
                </div>
            </div>
        );
    },

    /* A stimulus question, as a student meets it. The source has to read as a
       document rather than as another of the app's panels — half the skill
       being tested is reading it. */
    source: () => {
        const q = normaliseQuestion({
            question: "Refer to Source A.",
            stimulus: {
                label: "Source A",
                content: "In October 1962, United States reconnaissance aircraft photographed Soviet medium-range ballistic missile sites under construction in western Cuba. President Kennedy convened an executive committee, which considered an air strike, an invasion and a naval quarantine.\n\nThe quarantine was announced on 22 October. Soviet vessels turned back two days later.",
            },
            parts: [
                { prompt: "State the date on which the quarantine was announced.", marks: 1 },
                { prompt: "Using Source A, explain TWO reasons the executive committee preferred a quarantine to an air strike.", marks: 6 },
            ],
        }, 3);
        return (
            <div className="min-h-screen bg-background p-8">
                <div className="max-w-2xl card-soft p-6">
                    <span className="pill mb-3 bg-chart-3/15 text-chart-3">
                        {q.parts.length} parts · {q.marks} marks
                    </span>
                    <SourcePanel stimulus={q.stimulus} />
                    <p className="text-lg font-semibold text-foreground mb-4">{q.stem}</p>
                    {q.parts.map((pt) => (
                        <div key={pt.key} className="mb-4">
                            <p className="text-sm font-semibold text-foreground">
                                ({pt.label}) {pt.prompt}
                                <span className="float-right text-muted-foreground">{pt.marks} marks</span>
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        );
    },
};

// ?v=nav — the two nav surfaces, side by side, for the one thing a scan cannot
// check: that nothing is DRAWN on the Compete item. A grep proves the component
// is not imported; only a render proves no bubble is left behind it.
views.nav = () => (
    <div className="min-h-screen bg-background">
        <MemoryRouter initialEntries={["/Dashboard"]}>
            <div className="flex">
                <SideRail />
                <div className="flex-1 p-8 pl-24">
                    <h1 className="text-2xl font-display font-black text-foreground mb-2">Nav check</h1>
                    <p className="text-sm text-muted-foreground mb-6">
                        Hover the rail to expand it. Compete must carry no bubble, expanded or collapsed.
                    </p>
                    <div className="relative h-24 border-2 border-dashed border-border rounded-2xl">
                        <BottomNav />
                    </div>
                </div>
            </div>
        </MemoryRouter>
    </div>
);

// ?v=legal — the two blocking surfaces, which are auth-gated in the real app.
views.legal = () => (
    <div className="min-h-screen bg-background p-8">
        <MemoryRouter>
            <h1 className="text-2xl font-display font-black text-foreground mb-2">Consent + age gate</h1>
            <p className="text-sm text-muted-foreground mb-6">
                The banner pins to the bottom. The gate covers the screen; type a birthday to see it change.
            </p>
            <ConsentBanner />
            <AgeGate onSave={async (p) => { console.log("would save", p); }} />
        </MemoryRouter>
    </div>
);

// ?v=store — the cred store against a fixture profile, plus the price tick
// driven on a timer so the motion can actually be judged.
function TickDemo() {
    const [p, setP] = React.useState(0.62);
    React.useEffect(() => {
        const t = setInterval(() => setP((v) => {
            const next = Math.min(0.95, Math.max(0.05, v + (Math.random() - 0.5) * 0.14));
            return Math.round(next * 100) / 100;
        }), 1800);
        return () => clearInterval(t);
    }, []);
    return (
        <div className="flex items-center gap-6 mb-8">
            <div className="rounded-2xl bg-[var(--floor-well)] p-4 flex items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--floor-dim)]">
                    Price, ticking
                </span>
                <PriceTick price={p} label={`${Math.round(p * 100)}\u00a2`} />
            </div>
        </div>
    );
}

views.store = () => (
    <Room>
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="font-display font-black text-2xl text-[var(--floor-ink)] mb-1">Credits</h1>
            <p className="text-sm text-[var(--floor-muted-2)] mb-6">
                Fixture profile: tier 6, 2,400 cred, owns the felt back.
            </p>
            <TickDemo />
            <CredStore
                busy={false}
                onBuy={(id, u) => console.log("buy", id, u)}
                onConvert={(xp) => console.log("convert", xp)}
                onEquip={(id, slot) => console.log("equip", id, slot)}
                store={{
                    cred: 2400,
                    tier: 6,
                    weekly_grant: grantForTier(6),
                    // What the shelf now has to draw: XP waiting to convert, and
                    // a cosmetic that is owned AND worn, which is the state that
                    // had nowhere to be shown before.
                    xp: { convertible: 18400, per_credit: 4, week_room: 500, week_max: 500 },
                    owned: ["back-felt", "crest-bolt"],
                    held: {},
                    equipped: { back: "back-felt" },
                    items: CATALOGUE.map((i) => ({
                        ...i,
                        verdict: i.id === "back-gilt"
                            ? { ok: false, reason: "You need 238 more cred." }
                            : i.id === "back-felt"
                            ? { ok: false, reason: "You already own this." }
                            : { ok: true, reason: null },
                    })),
                }}
            />
        </div>
    </Room>
);

/* Every back a student can buy, beside the default, at the two sizes they are
   actually dealt at. A skin that reads at 176px and smudges at 62px is a skin
   that looks bought on the shelf and broken on the shelf it is worn to. */
views.backs = () => (
    <div className="p-8 bg-background min-h-screen">
        <h1 className="font-display font-black text-2xl text-foreground mb-6">Card backs</h1>
        {[176, 92, 62].map((w) => (
            <div key={w} className="mb-8">
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                    {w}px
                </p>
                <div className="flex items-end gap-4">
                    <div>
                        <CardBack tone="#58CC02" skin={null}
                            style={{ width: w, height: w * 1.4 }} />
                        <p className="text-[11px] text-muted-foreground mt-1.5">default</p>
                    </div>
                    {Object.values(BACK_SKINS).map((sk) => (
                        <div key={sk.id}>
                            <CardBack skin={sk} style={{ width: w, height: w * 1.4 }} />
                            <p className="text-[11px] text-muted-foreground mt-1.5">{sk.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

/* Every prank, over a page that looks like a real one. The card is the part
   that must always be legible — it is what names who did this — so it is drawn
   over content rather than over an empty screen. */
views.pranks = () => {
    const [i, setI] = React.useState(0);
    const k = PRANK_LIST[i];
    return (
        <div className="min-h-screen bg-background p-8">
            <h1 className="font-display font-black text-2xl text-foreground mb-2">Pranks</h1>
            <div className="flex gap-2 mb-6 flex-wrap">
                {PRANK_LIST.map((p, n) => (
                    <button key={p.id} onClick={() => setI(n)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-bold border
                            ${n === i ? "bg-primary text-primary-foreground border-primary"
                                      : "border-border text-muted-foreground"}`}>
                        {p.label}
                    </button>
                ))}
            </div>
            <div className="max-w-md space-y-3">
                <div className="rounded-2xl border border-border bg-surface p-4">
                    <p className="font-display font-black text-foreground">A page underneath</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        The prank plays over whatever the student was doing, so the card has to
                        read against real content rather than an empty screen.
                    </p>
                </div>
                <div className="rounded-2xl border border-border bg-surface p-4">
                    <p className="text-sm text-muted-foreground">Another panel, for contrast.</p>
                </div>
            </div>
            <PrankOverlay key={`${k.id}-${i}`} prank={{ id: i, kind: k.id, from: "Priyanka" }}
                onDone={() => {}} />
        </div>
    );
};

/* ── ?v=league — the podium, the payline and the guide ──────────────────────
 *
 * The League page is auth-gated and the board needs a dozen scored members to
 * be judged at all: a two-row fixture hides the payline, the gap scale and the
 * 2-1-3 step entirely, which is the "check a layout against the shape of the
 * data somebody actually has" lesson the Quizzes shelf learned. This deals a
 * real board — a podium with a crest on it, the student fourth and 40 points
 * off, and somebody wearing a bought crest.
 */
const LEAGUE_ROWS = [
    { score: 812, name: "Priyanka", crest: "gold" },
    { score: 744, name: "Marcus", crest: null, skin: "laurel" },
    { score: 601, name: "Anon #4f21", crest: "silver" },
    { score: 561, name: "Jordan", me: true, crest: "bronze" },
    { score: 548, name: "Hana", crest: null },
    { score: 410, name: "Dao", crest: null, skin: "bolt" },
    { score: 377, name: "Oliver", crest: null },
    { score: 212, name: "Sam", crest: null },
    { score: 96, name: "Anon #a1c3", crest: null },
].map((r, i) => ({
    position: i + 1,
    compete_score: r.score,
    display_name: r.name,
    is_me: !!r.me,
    crest: r.crest,
    crest_skin: r.skin || null,
    streak_days: i % 3 === 0 ? 4 + i : 0,
    score_breakdown: {
        effort: Math.min(400, Math.round(r.score * 0.42)),
        mastery: Math.min(400, Math.round(r.score * 0.4)),
        consistency: Math.min(200, Math.round(r.score * 0.2)),
    },
}));

const LEAGUE_ME = {
    position: 4,
    compete_score: 561,
    weekly_xp: 1840,
    board_sits: 2,
    active_days: 4,
    avg_accuracy: 71,
    board_min_questions: 8,
    is_anonymous: false,
};

views.league = () => {
    const pod = podiumGap(LEAGUE_ROWS);
    const mine = LEAGUE_ROWS.find((r) => r.is_me);
    return (
        <div className="min-h-screen bg-background p-4 sm:p-6">
            <div className="max-w-4xl mx-auto space-y-5">
                <section className="card-soft on-table p-5 sm:p-6">
                    <p className="stat-label text-muted-foreground">This week · resets in 2d 6h</p>
                    <h1 className="font-display font-black text-2xl sm:text-3xl leading-tight mt-1 text-chart-3">
                        40 points off Anon #4f21
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1.5">
                        That is 20 more minutes of counted study, or one solid quiz.
                    </p>
                    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mt-5">
                        {[["Compete score", "561", "/ 1000"], ["Position", "4th", "of 9"],
                          ["XP this week", "1,840", null],
                          ["Monday pays",
                           grantForLeague({ position: 4, groupSize: LEAGUE_ROWS.length, tiered: false })
                               .toLocaleString(),
                           "credits"]].map(
                            ([label, big, suffix]) => (
                                <div key={label}>
                                    <p className="stat-label text-muted-foreground">{label}</p>
                                    <p className="font-display font-black text-3xl text-foreground tabular-nums">
                                        {big}
                                        {suffix && (
                                            <span className="text-base font-bold text-muted-foreground ml-1">
                                                {suffix}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            ))}
                    </div>
                    {pod && (
                        <div className="flex items-start gap-2 mt-4 pt-4 border-t border-border">
                            <Crest podium={pod.crest} className="mt-0.5" />
                            <p className="text-sm text-foreground">
                                <span className="font-bold">
                                    {pod.in ? `On the podium in ${ordinal(pod.position)}`
                                            : `${pod.gap} points off the podium`}
                                </span>
                                {" — "}
                                <span className="text-muted-foreground">
                                    {pod.in
                                        ? `${pod.margin} points clear of ${pod.chaser}, who is first in line for it.`
                                        : `${pod.holder} holds 3rd. Top three take a crest and the bigger Monday grant.`}
                                </span>
                            </p>
                        </div>
                    )}
                </section>

                <Podium rows={LEAGUE_ROWS} groupSize={LEAGUE_ROWS.length} tiered={false} />

                <section className="space-y-2">
                    <h2 className="font-display font-extrabold text-foreground text-base">Standings</h2>
                    <WeeklyBoard rows={LEAGUE_ROWS} />
                </section>

                <section className="space-y-2">
                    <h2 className="font-display font-extrabold text-foreground text-base">
                        How the week is scored
                    </h2>
                    <ScoreGuide breakdown={mine.score_breakdown} me={LEAGUE_ME} />
                </section>
            </div>
        </div>
    );
};

/* ── ?v=study — the Active Recall / Blurting setup card ─────────────────────
 *
 * Both pages load their own flashcards, maps, assessments and techniques from
 * the database, so mounting the real component here renders an empty picks
 * list and judges nothing. This draws the CARD — the picks, the handover rule
 * and the source row — against suggestions of every kind, which is the part
 * that changed and the part the complaint was about.
 */
const STUDY_CARDS = [
    ...Array.from({ length: 20 }, (_, i) => ({
        id: `c${i}`, subject_name: "Chemistry", topic: "Summary Unit 1",
        question: `Define term ${i + 1}`, answer: `Answer ${i + 1}`, is_active: true,
    })),
    ...Array.from({ length: 12 }, (_, i) => ({
        id: `l${i}`, subject_name: "Legal Studies", topic: "Slide 3",
        question: `What is remedy ${i + 1}?`, answer: `Remedy ${i + 1}`, is_active: true,
    })),
];

const STUDY_PICKS = [
    {
        kind: { id: "weak", rank: 1, label: "Costing you marks" },
        subject: "Legal Studies", topic: "Legal Studies - Remedies",
        why: "3 cards flagged as a weak spot",
    },
    {
        kind: { id: "assessment", rank: 2, label: "Assessed soon" },
        subject: "Chemistry", topic: "Summary Unit 1",
        why: "In 6 days",
    },
    {
        kind: { id: "slipped", rank: 3, label: "Slipping" },
        subject: "Legal Studies", topic: "Slide 3",
        why: "7 cards already past reliable recall",
    },
    {
        kind: { id: "recent", rank: 4, label: "Picked up again" },
        subject: "Legal Studies", topic: "AOS 2 Unit 2 slides 6,7",
        why: "You studied this recently — test whether it stuck",
    },
];

views.study = () => {
    const [files, setFiles] = React.useState([]);
    return (
        <div className="min-h-screen bg-background p-4 sm:p-6">
            <div className="max-w-3xl mx-auto">
                <div className="card-soft p-5 sm:p-6 overflow-hidden">
                    <WhatToTest picks={STUDY_PICKS} flashcards={STUDY_CARDS} maps={[]}
                        onPick={() => {}} />

                    <div className="flex items-center gap-3 my-5">
                        <span className="h-px flex-1 bg-border" />
                        <span className="stat-label text-muted-foreground">Or set it up yourself</span>
                        <span className="h-px flex-1 bg-border" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-muted-foreground">Subject</p>
                            <div className="h-11 rounded-xl border-2 border-border flex items-center px-3
                                text-sm text-muted-foreground">Choose a subject…</div>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-muted-foreground">
                                Topic <span className="text-muted-foreground/60 font-normal">(optional)</span>
                            </p>
                            <div className="h-11 rounded-xl border-2 border-border flex items-center px-3
                                text-sm text-muted-foreground/60">e.g. Causes of World War II</div>
                        </div>
                    </div>

                    <div className="space-y-1.5 mt-4">
                        <p className="text-sm font-medium text-muted-foreground">How many questions</p>
                        <div className="flex gap-1.5">
                            {[4, 6, 8, 12].map((n) => (
                                <div key={n} className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold text-center
                                    ${n === 6 ? "border-chart-4 bg-chart-4/10 text-foreground"
                                             : "border-border text-muted-foreground"}`}>{n}</div>
                            ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            About 18 minutes at three minutes a question.
                        </p>
                    </div>

                    <div className="mt-5 pt-5 border-t border-border">
                        <SourceRow
                            files={files}
                            have="20 of your cards"
                            hint="Optional. Without notes the questions come from your own cards and mind maps."
                            onPick={() => setFiles([{ name: "chem-unit-1-notes.pdf" }])}
                            onRemove={() => setFiles([])}
                        />
                    </div>

                    <button className="w-full h-12 mt-5 bg-chart-4 text-white font-semibold rounded-xl
                        shadow-soft inline-flex items-center justify-center gap-2">
                        ▸ Start session (6 questions)
                    </button>

                    <div className="mt-4 pt-4 border-t border-border flex justify-center">
                        <span className="text-xs font-bold text-muted-foreground">Previous sessions</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ── ?v=planner — the re-sequenced lower half ───────────────────────────────
 *
 * The page is auth-gated and loads six tables, so this draws the two sections
 * that changed — Upcoming (its form now behind a button) and Marks so far,
 * split out of it — plus the empty state, which is the case the re-sequence
 * most affects: with nothing tracked the old section opened on a five-field
 * form and no list at all.
 */
const PLAN_SACS = [
    { id: "a", subject_name: "Chemistry", title: "Unit 3 AOS1 SAC", due_date: "in 6 days", type: "SAC", pill: "bg-xp/15 text-xp", days: "6 days" },
    { id: "b", subject_name: "Legal Studies", title: "Folio task 2", due_date: "Tue 14 Oct", type: "SAC", pill: "bg-secondary text-muted-foreground", days: "12 days" },
    { id: "c", subject_name: "Methods", title: "Unit 4 Application task", due_date: "Mon 27 Oct", type: "TEST", pill: "bg-secondary text-muted-foreground", days: "25 days" },
];
const PLAN_MARKS = [
    { id: "m1", subject_name: "Chemistry", title: "Unit 2 AOS2 SAC", score: 38, out_of: 45 },
    { id: "m2", subject_name: "Legal Studies", title: "Folio task 1", score: 24, out_of: 30 },
    { id: "m3", subject_name: "Methods", title: "Unit 3 SAC 2", score: 17, out_of: 30 },
];

views.planner = () => {
    const [empty, setEmpty] = React.useState(false);
    const sacs = empty ? [] : PLAN_SACS;
    return (
        <div className="min-h-screen bg-background p-4 sm:p-6">
            <div className="max-w-[1400px] mx-auto space-y-6 lg:space-y-8">
                <button onClick={() => setEmpty((e) => !e)}
                    className="px-3 py-1.5 rounded-xl text-sm font-bold border-2 border-border text-muted-foreground">
                    {empty ? "Show tracked" : "Show empty"}
                </button>

                <section>
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                        <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl flex items-center gap-2">
                            <Flag className="w-5 h-5 text-chart-3" /> Upcoming
                            {sacs.length > 0 && (
                                <span className="text-sm font-bold text-muted-foreground tabular-nums">{sacs.length}</span>
                            )}
                        </h2>
                        <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border-2 border-border
                            text-sm font-bold text-foreground">
                            <Plus className="w-3.5 h-3.5" /> Track a SAC
                        </button>
                    </div>
                    {sacs.length > 0 ? (
                        <div className="space-y-2">
                            {sacs.map((a) => (
                                <div key={a.id} className="card-soft flex items-center gap-3 p-3.5">
                                    <span className="w-6 h-6 rounded-lg border-2 border-border flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-foreground text-sm truncate">
                                            {a.subject_name} — {a.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{a.due_date} · {a.type}</p>
                                    </div>
                                    <span className={`pill flex-shrink-0 ${a.pill}`}>{a.days}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Nothing tracked yet.</p>
                    )}
                </section>

                <section>
                    <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl mb-3 flex items-center gap-2">
                        <Scale className="w-5 h-5 text-chart-4" /> Marks so far
                    </h2>
                    <div className="card-soft divide-y divide-border">
                        {PLAN_MARKS.map((a) => (
                            <div key={a.id} className="flex items-baseline gap-3 px-4 py-2.5">
                                <span className="text-sm text-foreground truncate min-w-0 flex-1">
                                    {a.subject_name} <span className="text-muted-foreground">— {a.title}</span>
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                                    {a.score}/{a.out_of}
                                </span>
                                <span className="font-display font-black text-sm text-foreground
                                    tabular-nums flex-shrink-0 w-11 text-right">
                                    {Math.round((a.score / a.out_of) * 100)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

/* ── ?v=setup — the REAL setup screens, on an account with no history ───────
 *
 * `?v=study` draws the card against fixture picks; this mounts the actual
 * components. Their data loads fail here, so what it shows is the NO-PICKS
 * path — a brand-new account — which is the case the handover rule has to not
 * render into, and the one a fixture cannot reach. It also proves the two
 * rebuilt `renderSetup` trees mount at all.
 */
views.setup = () => (
    <div className="min-h-screen bg-background p-4 sm:p-6 space-y-8">
        <div className="max-w-3xl mx-auto space-y-8">
            <div>
                <p className="stat-label text-muted-foreground mb-2">Active Recall</p>
                <ActiveRecall onSessionComplete={async () => {}} userSubjects={[
                    { id: "s1", subject_name: "Chemistry", color: "#58CC02" },
                    { id: "s2", subject_name: "Legal Studies", color: "#8B5CF6" },
                ]} />
            </div>
            <div>
                <p className="stat-label text-muted-foreground mb-2">Blurting</p>
                <BlurtingMethod onSessionComplete={async () => {}} />
            </div>
        </div>
    </div>
);

/* ── ?v=ranked — the five ATAR components, each with a door ─────────────────
 *
 * Ranked is auth-gated and the panel needs real `atar_components`, so this
 * draws the bars against a fixture through the REAL `liftFor` and
 * `COMPONENT_MOVE` — the figures and the labels are the page's own, only the
 * component values are made up. It carries a MAXED component deliberately:
 * that branch offers no action and prints no figure, and it is the one a
 * fixture of ordinary numbers never reaches.
 */
const RANKED_COMPONENTS = {
    mastery: 68, consistency: 72, effort: 41, breadth: 55, planning: 100,
    quiz_marks: 124, cards_reviewed: 88, study_days: 14, minutes: 247,
    technique_families: 3, technique_target: 5,
};
const RANKED_META = [
    { key: "mastery", label: "Mastery", bar: "bg-chart-4", evidence: "124 quiz marks · 88 cards" },
    { key: "consistency", label: "Consistency", bar: "bg-streak", evidence: "14 of 20 days" },
    { key: "effort", label: "Effort", bar: "bg-xp", evidence: "4h 7m of ~20h" },
    { key: "breadth", label: "Breadth", bar: "bg-chart-3", evidence: "3 of 5 techniques" },
    { key: "planning", label: "Planning", bar: "bg-primary", evidence: "every goal kept" },
];

views.ranked = () => {
    const weakest = { key: "effort", value: 41, action: "Book a focused block. This is minutes, plainly." };
    return (
        <div className="min-h-screen bg-background p-4 sm:p-6">
            <div className="max-w-3xl mx-auto card-soft p-5 sm:p-6 space-y-4">
                <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
                    {RANKED_META.map((c) => {
                        const v = RANKED_COMPONENTS[c.key];
                        const move = COMPONENT_MOVE[c.key];
                        const lift = liftFor(RANKED_COMPONENTS, c.key, 10);
                        const maxed = lift != null && lift.headroom <= 0;
                        const gain = lift && lift.gain >= 0.005 ? lift.gain.toFixed(2) : null;
                        return (
                            <div key={c.key}>
                                <div className="flex items-baseline justify-between mb-1 gap-2">
                                    <span className="text-xs font-bold text-foreground">{c.label}</span>
                                    <span className="text-xs font-bold text-foreground tabular-nums">{v}</span>
                                </div>
                                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${v}%` }} />
                                </div>
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{c.evidence}</p>
                                {move && (maxed ? (
                                    <p className="text-[11px] font-bold text-muted-foreground mt-0.5">
                                        Nothing left to gain here.
                                    </p>
                                ) : (
                                    <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-bold text-foreground">
                                        {move.label}
                                        {gain && <span className="text-primary tabular-nums">+{gain}</span>}
                                        <ArrowRight className="w-3 h-3" />
                                    </span>
                                ))}
                            </div>
                        );
                    })}
                </div>

                <div className="rounded-2xl border-2 border-border bg-secondary/40 p-3
                    flex flex-wrap items-center gap-x-2.5 gap-y-2">
                    <Target className="w-4 h-4 text-foreground flex-shrink-0" />
                    <p className="text-xs text-muted-foreground leading-snug flex-1 min-w-[12rem]">
                        <span className="font-bold text-foreground">Effort is your ceiling right now ({weakest.value}).</span>{" "}
                        {weakest.action}
                    </p>
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl
                        bg-foreground text-background text-xs font-bold flex-shrink-0">
                        {COMPONENT_MOVE[weakest.key].label}
                        <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                </div>
            </div>
        </div>
    );
};


// ─── THE BOARD, AGAINST THE SHAPE OF REAL DATA ─────────────────────────────
// A two-row fixture hides everything that was redesigned: the podium needs
// three, the median gap scale needs a spread, the movement column needs
// climbers AND fallers AND an arrival, and the pinned bar needs the viewer far
// enough down the list to scroll past. The Quizzes shelf learned this the hard
// way — three-quizzes-per-subject hid a layout that fell apart on a real
// account.
const BOARD_NAMES = [
    "Priyanka", "Maya", "Sam", "Tom", "Aisha", "Leo", "you", "Grace",
    "Noah", "Zara", "Ollie", "Mia", "Finn", "Ruby",
];
const BOARD_ROWS = BOARD_NAMES.map((n, i) => ({
    user_email: n === "you" ? "me@acedit.au" : `${n.toLowerCase()}@school.edu.au`,
    user_name: n === "you" ? "You" : n,
    username: n === "you" ? "You" : n,
    // A spread with a long tail, so the median-doubled scale is exercised:
    // tight gaps at the top, then one student 9 points clear further down.
    acedit_atar: [94.2, 91.8, 91.05, 90.9, 88.4, 88.4, 86.15, 85.9,
        85.2, 76.1, 75.4, 74.9, 72.2, 71.8][i],
    total_xp: [41200, 38800, 30100, 29400, 24050, 23980, 18439, 17200,
        16050, 9900, 9400, 8800, 4200, 3900][i],
    total_study_time: [9120, 8400, 7100, 6900, 5200, 5150, 4260, 3980,
        3600, 2100, 1900, 1750, 900, 820][i],
    streak_days: [112, 46, 31, 7, 3, 0, 22, 0, 9, 0, 61, 0, 0, 2][i],
    is_anonymous: n === "Zara",
    band: null,
    crests: i === 0 ? [{ code: "a", name: "Centurion", icon: "Flame", rarity: "legendary" }]
        : i === 6 ? [{ code: "b", name: "Marked", icon: "Target", rarity: "rare" }] : [],
}));

views.board = () => {
    const [scope, setScope] = React.useState("global");
    const [boardId, setBoardId] = React.useState("atar");
    const meta = boardById(boardId);
    const me = "me@acedit.au";

    const field = React.useMemo(
        () => [...BOARD_ROWS].sort((a, b) => (meta.value(b) || 0) - (meta.value(a) || 0)),
        [meta]);
    // A snapshot with every case in it: climbers, fallers, somebody holding,
    // and two rows absent so the NEW badge is drawn.
    const snapshot = {
        "priyanka@school.edu.au": 2, "maya@school.edu.au": 1, "sam@school.edu.au": 3,
        "tom@school.edu.au": 7, "aisha@school.edu.au": 4, "leo@school.edu.au": 5,
        "me@acedit.au": 11, "grace@school.edu.au": 6, "noah@school.edu.au": 8,
        "zara@school.edu.au": 9, "ollie@school.edu.au": 10, "mia@school.edu.au": 12,
    };
    const movement = movementMap(field, snapshot);
    const titles = titlesFor(field);
    const mine = { ...standing(field, me, meta.value), row: field.find(r => r.user_email === me) };
    const nameOf = (r) => (r.user_email === me ? "You"
        : r.is_anonymous ? `Anon #${r.user_email.slice(0, 4)}` : r.user_name);

    return (
        <MemoryRouter>
            <div className="min-h-screen bg-background p-4 lg:px-8 py-6 space-y-5">
                <div className="max-w-[1600px] mx-auto space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                        <div>
                            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-foreground leading-tight">
                                {meta.label}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {meta.window} · you&rsquo;re {ordinal(mine.rank)} of {mine.total}
                            </p>
                        </div>
                        <BoardSwitch boards={[boardById("atar"), ...boardsFor("alltime")]} board={boardId} onBoard={setBoardId} />
                    </div>
                    <ScopeSwitch scope={scope} onScope={setScope} hasSchool={false} />
                    <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
                        <div className="min-w-0">
                            <RankedBoard rows={field} me={me} boardMeta={meta} titles={titles}
                                movement={movement} nameOf={nameOf} myStanding={mine} />
                        </div>
                        <div className="xl:sticky xl:top-6">
                            <StandingRail mine={mine} boardMeta={meta} board={meta.id}
                                nameOf={nameOf} components={RANKED_COMPONENTS}
                                title={titles.get(me)} />
                        </div>
                    </div>
                    {/* Tall filler, so the pinned "your place" bar can be
                        judged — it only appears once the real row is off
                        screen, which a short page can never reach. */}
                    <div className="h-[120vh] rounded-2xl border-2 border-dashed border-border
                        flex items-start justify-center pt-6 text-xs text-muted-foreground">
                        scroll past your row — the pinned bar sits above the bottom nav
                    </div>
                </div>
                <BottomNav />
            </div>
        </MemoryRouter>
    );
};

views.update = () => {
    // The real component, against the real tokens. It only ever renders when a
    // poll says the build changed, so the probe forces it: a fake version
    // endpoint that answers a different id on the second call.
    let n = 0;
    const realFetch = window.fetch.bind(window);
    window.fetch = (url, opts) => (String(url).includes("/local-ai/version")
        ? Promise.resolve(new Response(JSON.stringify({ version: (n++ ? "deploy-2" : "deploy-1") }),
            { headers: { "Content-Type": "application/json" } }))
        : realFetch(url, opts));
    setTimeout(() => window.dispatchEvent(new Event("focus")), 400);
    return (
        <div className="min-h-screen bg-background p-6">
            <h1 className="font-display font-extrabold text-3xl text-foreground">Behind the prompt</h1>
            <p className="text-muted-foreground mt-2">A page the student was looking at.</p>
            <div className="card-soft on-table p-6 mt-6 h-40" />
            <MemoryRouter initialEntries={["/Dashboard"]}>
                <LiveProvider><UpdatePrompt /></LiveProvider>
            </MemoryRouter>
        </div>
    );
};

views.reach = () => (
    // What this CAN draw honestly, and what it cannot.
    //
    // SideRail is not here either: it reads Layout's context, so mounted alone
    // it renders a blank page rather than a nav. WeekStrip is not here because
    // it fetches its own standing through `base44`, which is a PROXY over an
    // axios SDK: assigning `.functions.invoke`, defineProperty and a patched
    // `window.fetch` ALL fail to intercept it, and each one silently lets the
    // real call 404 so the strip renders nothing. Worth knowing before anybody
    // tries again. Its new payout block is `hidden sm:flex`, so it cannot move
    // the phone layout at all, and `reachable.test.mjs` holds where its figure
    // comes from.
    //
    // So this is the three-tab bar and the renamed shelf control — the two
    // things that changed shape and can be judged on their own.
    <MemoryRouter initialEntries={["/Review"]}>
        <div className="min-h-screen bg-background">
            <div className="p-4 sm:p-6 space-y-5">
                <div className="grid w-full sm:w-auto sm:inline-grid grid-cols-3 h-auto p-1.5 rounded-2xl bg-surface border-2 border-border shadow-soft">
                    {/* The ERA tabs. The labels moved with the split — see
                        Ranked.jsx — and the widths have to be rechecked when
                        they do: at 360 this bar is `grid-cols-3`, so each cell
                        is about 105px and a label one word too long wraps the
                        whole bar to two lines. That is what "Leaderboard" did,
                        and `whitespace-nowrap` then turned the wrap into a clip
                        inside the pill. Both render; only the measurement says
                        so. */}
                    {[["My rank", ReachCap], ["League", ReachSwords], ["All time", ReachTrophy]].map(([label, Icon], i) => (
                        <span key={label} className={`flex items-center justify-center gap-1.5 py-2.5 px-3 sm:px-6 rounded-xl text-sm font-bold whitespace-nowrap ${i === 0 ? "bg-foreground text-background" : "text-muted-foreground"}`}>
                            <Icon className="hidden sm:block w-4 h-4" /> {label}
                        </span>
                    ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                    <span className="gap-2 border-2 border-border rounded-xl h-11 px-4 inline-flex items-center text-sm font-bold text-foreground bg-surface">
                        <ReachList className="w-4 h-4" /> Review queue
                        <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-chart-3/15 text-chart-3 text-xs font-extrabold tabular-nums">34</span>
                    </span>
                    <span className="gap-2 border-2 border-border rounded-xl h-11 px-4 inline-flex items-center text-sm font-bold text-foreground bg-surface">
                        <ReachList className="w-4 h-4" /> New Deck
                    </span>
                </div>
            </div>
        </div>
    </MemoryRouter>
);

ReactDOM.createRoot(document.getElementById("root")).render(
    React.createElement(views[which] || views.deal));

