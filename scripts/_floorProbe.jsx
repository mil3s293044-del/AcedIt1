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
import { readMarket } from "@/lib/market";
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
    line: () => (
        <Room>
            <LineDialog onClose={() => {}} onOpen={() => {}} busy={false}
                taken={new Set()} email="me@x.com" />
        </Room>
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
