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
import { LineDialog } from "@/pages/Competitions";
import CalibrationCurve from "@/components/market/CalibrationCurve";
import PortfolioPanel from "@/components/market/PortfolioPanel";
import { readMarket } from "@/lib/market";
import AceShuffle, { AceLoading } from "@/components/ace/AceShuffle";
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
};

ReactDOM.createRoot(document.getElementById("root")).render(
    React.createElement(views[which] || views.deal));
