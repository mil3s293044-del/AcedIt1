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
import AceWalker, { AceBubble } from "@/components/ace/AceWalker";
import { STOPS } from "@/lib/aceTour";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const which = new URLSearchParams(location.search).get("v") || "deal";

const sac = readMarket({
    id: "m-sac", kind: "sac", status: "open", prior: 0.38,
    title: "Will Miles score 85%+ on Chemistry Unit 3 SAC 2?",
    resolves_note: "On the mark Miles enters on their planner. They can't back it — you can.",
    closes_at: new Date(Date.now() + 5 * 864e5).toISOString(),
    subject_is_me: true, subject_email: "me@x.com",
    meta: { target: 85, subject: "Chemistry", thin: false, seen: 4, average: 74 },
}, [
    { id: "a", p: 0.72, stake: 100, price_at_entry: 0.38, user_name: "Ava", user_email: "ava@x.com" },
    { id: "b", p: 0.3, stake: 150, price_at_entry: 0.5, user_name: "Ben", user_email: "ben@x.com" },
    { id: "c", p: 0.25, stake: 50, price_at_entry: 0.55, user_name: "Cat", user_email: "cat@x.com" },
], "me@x.com");

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
    card: () => (
        <Room>
            <div className="max-w-sm mx-auto grid gap-3">
                <MarketCard market={sac} balance={1000} onTake={() => {}} onReport={() => {}} />
                <MarketCard market={{ ...sac, id: "t", meta: { ...sac.meta, thin: true } }}
                    balance={1000} onTake={() => {}} onReport={() => {}} />
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
                    <MarketCard market={{ ...sac, id: "b", kind: "streak", subject_is_me: false,
                        title: "Will Ava study 5+ days this week?",
                        meta: { target: 5 } }} balance={1000} onTake={() => {}} />
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

    /* Every pose sequence the onboarding asks Ace to play, running for real.
       A still cannot show an animation, so what this is FOR is the thing a
       still shows perfectly: `data-ace-pose` on each figure, which says what
       he is holding right now. Shoot it at a second and again at five and the
       first frame is mid-gesture while the second is a resting pose — or he
       is frozen, which is the bug the whole change is about. */
    acepose: () => {
        const POSE = {
            subject: ["wave", "happy"], problem: ["think", "stand"],
            build: ["point", "stand"], quiz: ["alert", "offer"],
            close: ["cheer", "proud", "happy"],
        };
        const Row = ({ name, pose }) => (
            <div className="flex items-end gap-3 min-h-[7rem]">
                <span className="stat-label w-28 flex-none">{name}</span>
                <AceWalker trip={name} pose={pose} size="w-20">
                    <AceBubble className="w-44">
                        <p className="text-xs font-bold text-foreground">
                            {(Array.isArray(pose) ? pose : [pose]).join(" → ")}
                        </p>
                    </AceBubble>
                </AceWalker>
            </div>
        );
        return (
            <div className="min-h-screen bg-background p-8">
                <p className="text-sm text-muted-foreground mb-5">
                    First run, then the tour. The last pose in each row must be one he
                    fidgets out of, or he freezes there for as long as the beat is read.
                </p>
                <div className="grid sm:grid-cols-2 gap-x-10">
                    <div>
                        {Object.entries(POSE).map(([k, v]) => <Row key={k} name={k} pose={v} />)}
                    </div>
                    <div>
                        {STOPS.map((st) => <Row key={st.id} name={st.id} pose={st.pose} />)}
                    </div>
                </div>
            </div>
        );
    },
};

ReactDOM.createRoot(document.getElementById("root")).render(
    React.createElement(views[which] || views.deal));
