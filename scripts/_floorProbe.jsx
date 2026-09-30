/**
 * A fixture harness for the floor's three new surfaces. Lives under scripts/
 * so it is never an entry point of the production build.
 */
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
import SideRail from "@/components/layout/SideRail";
import ConsentBanner from "@/components/legal/ConsentBanner";
import AgeGate from "@/components/legal/AgeGate";
import CredStore from "@/components/market/CredStore";
import PriceTick from "@/components/market/PriceTick";
import { CATALOGUE, grantForTier, CHIPS_WEEKLY_MAX } from "@/lib/credStore";
import BottomNav from "@/components/layout/BottomNav";

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
                            71¢ with 300 cred
                        </p>
                        <p className="text-[12px] text-[var(--floor-muted)]">
                            Ben took <span className="font-black text-[var(--floor-no-ink)]">no</span> at
                            29¢ with 150 cred
                        </p>
                        <p className="text-[11px] text-[var(--floor-dimmest)] mt-2">
                            Cred is not XP — losing a call can&apos;t touch your level.
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
            <h1 className="font-display font-black text-2xl text-[var(--floor-ink)] mb-1">Cred store</h1>
            <p className="text-sm text-[var(--floor-muted-2)] mb-6">
                Fixture profile: tier 6, 2,400 cred, owns the felt back.
            </p>
            <TickDemo />
            <CredStore
                busy={false}
                onBuy={(id, u) => console.log("buy", id, u)}
                store={{
                    cred: 2400,
                    tier: 6,
                    weekly_grant: grantForTier(6),
                    owned: ["back-felt"],
                    held: {},
                    equipped: {},
                    chips_max: CHIPS_WEEKLY_MAX,
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

ReactDOM.createRoot(document.getElementById("root")).render(
    React.createElement(views[which] || views.deal));
