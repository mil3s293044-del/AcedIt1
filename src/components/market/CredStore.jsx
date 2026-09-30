/**
 * CredStore — where cred goes.
 *
 * ─── A CURRENCY WITH NO SINK STOPS MEANING ANYTHING ─────────────────────────
 * The grant was flat, the cap 3000, and the only way out was a bet. A student
 * who trades well saturates in a fortnight and every Monday after that is a
 * number going up because a clock ticked — the exact failure `PortfolioPanel`'s
 * own header names about the cred figure in the header strip.
 *
 * ─── THE SHELF IS ORDERED BY WHAT THE THING IS, NOT BY PRICE ────────────────
 * Sorting a shop by price teaches somebody to buy the cheapest, which is the
 * one question they should not be answering first. Cosmetics, then the things
 * that DO something, then the money door — so the ordering reads as "what sort
 * of thing is this" and the price is a detail inside the row it belongs to.
 *
 * ─── EVERY REFUSAL SAYS WHICH PROBLEM IT IS ─────────────────────────────────
 * `canBuy` returns a reason and the card prints it, because "earn 300 more
 * cred", "you already own this" and "you have converted all you can this week"
 * have three different fixes and a greyed-out button has none. That is the
 * paper-cut this codebase already records about Active Recall's generate.
 *
 * ─── THE SERVER DECIDES, and this asks it ──────────────────────────────────
 * The verdict per item arrives from `getCredStore` rather than being computed
 * here. A client that works out its own affordability has become a second
 * price list, and the first disagreement is a button that says yes to something
 * the server refuses — megaUpload's rule, on an economy rather than an upload.
 */
import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Coins, Check, Lock, Sparkles, Flame, Zap, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHIPS_BLOCK } from "@/lib/credStore";

const GLYPH = {
    cosmetic: Sparkles,
    utility: Flame,
    chips: Zap,
    market: LineChart,
};

const GROUPS = [
    ["cosmetic", "Looks", "Yours for good, once bought. The room sees them."],
    ["utility", "Useful", "Spent on your behalf the moment it helps."],
    ["chips", "AI", "Trade a good week on the floor for more AI."],
    ["market", "The board", "Put a question of your own up."],
];

export default function CredStore({ store, busy, onBuy }) {
    const reduce = useReducedMotion();
    const [units, setUnits] = useState(CHIPS_BLOCK);

    if (!store) {
        return (
            <p className="text-[13px] text-[var(--floor-dim)] px-1">
                The store is loading.
            </p>
        );
    }

    const items = store.items || [];
    const owned = new Set(store.owned || []);

    return (
        <div className="space-y-6">
            {/* WHAT THE RANK IS WORTH, said plainly and in the one place the
                student is deciding how to spend. The connection between Ranked
                and the floor is the whole point of the grant moving, and a
                number nobody is told about connects nothing. */}
            <div className="rounded-2xl bg-[var(--floor-well)] p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--floor-dim)] mb-1">
                    Your Monday stack
                </p>
                <p className="font-display font-black text-2xl text-[var(--floor-ink)] tabular-nums
                    inline-flex items-center gap-2">
                    <Coins className="w-5 h-5 text-[var(--floor-warn-ink)]" />
                    {store.weekly_grant?.toLocaleString?.() ?? store.weekly_grant}
                </p>
                <p className="text-[13px] text-[var(--floor-muted-2)] mt-1.5 leading-relaxed">
                    Rank {store.tier} of 10 sets that. Climbing Ranked raises it &mdash; your XP is
                    never spent here, it just decides how much arrives.
                </p>
            </div>

            {GROUPS.map(([kind, heading, blurb]) => {
                const rows = items.filter((i) => i.kind === kind);
                if (!rows.length) return null;
                const Glyph = GLYPH[kind];
                return (
                    <section key={kind}>
                        <div className="flex items-baseline gap-2 mb-1">
                            <Glyph className="w-3.5 h-3.5 text-[var(--floor-muted)]" aria-hidden="true" />
                            <h3 className="font-display font-black text-[var(--floor-ink)] text-sm">{heading}</h3>
                            {/* A rule to the end of the row, the same thing that
                                turns the Quizzes shelf from a hole into a shelf. */}
                            <span className="flex-1 h-px bg-[var(--floor-edge)]" />
                        </div>
                        <p className="text-[12px] text-[var(--floor-dim)] mb-2.5">{blurb}</p>

                        <div className="grid sm:grid-cols-2 gap-2.5">
                            {rows.map((item) => {
                                const mine = owned.has(item.id);
                                const perUnit = !!item.perUnit;
                                const cost = perUnit ? item.price * units : item.price;
                                const v = item.verdict || {};
                                // A per-unit row's server verdict was computed for ONE unit, so
                                // the block price is checked here too — against the balance the
                                // server just sent, never against a locally cached one.
                                const affordable = perUnit ? (store.cred ?? 0) >= cost : v.ok;
                                const blocked = perUnit ? (!v.ok && !/more cred/i.test(v.reason || "")) : !v.ok;

                                return (
                                    <motion.div
                                        key={item.id}
                                        layout={!reduce}
                                        className={`rounded-2xl p-3.5 border transition-colors
                                            ${mine
                                                ? "bg-[var(--floor-well)] border-[var(--floor-yes-ink)]/40"
                                                : "bg-[var(--floor-card)] border-[var(--floor-edge)]"}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-display font-black text-[var(--floor-ink)] text-sm leading-tight">
                                                    {item.name}
                                                </p>
                                                <p className="text-[12px] text-[var(--floor-muted-2)] mt-0.5 leading-snug">
                                                    {item.blurb}
                                                </p>
                                            </div>
                                            {mine && (
                                                <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-black
                                                    uppercase tracking-wider text-[var(--floor-yes-ink)]">
                                                    <Check className="w-3 h-3" /> Owned
                                                </span>
                                            )}
                                        </div>

                                        {perUnit && !mine && (
                                            <div className="mt-2.5">
                                                <div className="flex items-center justify-between mb-1">
                                                    <label htmlFor={`u-${item.id}`}
                                                        className="text-[10px] font-black uppercase tracking-widest text-[var(--floor-dim)]">
                                                        How many
                                                    </label>
                                                    <span className="font-display font-black text-sm tabular-nums text-[var(--floor-ink)]">
                                                        {units} chips
                                                    </span>
                                                </div>
                                                <input
                                                    id={`u-${item.id}`}
                                                    type="range"
                                                    min={CHIPS_BLOCK}
                                                    max={Math.max(CHIPS_BLOCK, store.chips_max || CHIPS_BLOCK)}
                                                    step={CHIPS_BLOCK}
                                                    value={units}
                                                    onChange={(e) => setUnits(Number(e.target.value))}
                                                    className="floor-range w-full"
                                                    style={{
                                                        "--range-fill": `${((units - CHIPS_BLOCK) /
                                                            Math.max(1, (store.chips_max || CHIPS_BLOCK) - CHIPS_BLOCK)) * 100}%`,
                                                        "--range-ink": "var(--floor-warn-ink)",
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {!mine && (
                                            <div className="mt-3 flex items-center justify-between gap-2">
                                                <span className="font-display font-black tabular-nums text-[var(--floor-warn-ink)]
                                                    inline-flex items-center gap-1 text-sm">
                                                    <Coins className="w-3.5 h-3.5" />{cost.toLocaleString()}
                                                </span>
                                                <Button
                                                    size="sm"
                                                    className="font-bold"
                                                    disabled={busy || blocked || !affordable}
                                                    onClick={() => onBuy(item.id, perUnit ? units : undefined)}
                                                >
                                                    {blocked ? <Lock className="w-3.5 h-3.5" /> : "Buy"}
                                                </Button>
                                            </div>
                                        )}

                                        {/* THE REASON, because three refusals have three fixes and
                                            a disabled button has none. */}
                                        <AnimatePresence>
                                            {!mine && !affordable && (v.reason || !affordable) && (
                                                <motion.p
                                                    initial={reduce ? false : { opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="text-[11px] text-[var(--floor-dim)] mt-1.5 overflow-hidden"
                                                >
                                                    {v.reason || `You need ${(cost - (store.cred ?? 0)).toLocaleString()} more cred.`}
                                                </motion.p>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
