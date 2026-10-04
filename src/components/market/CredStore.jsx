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
import { Coins, Check, Lock, Sparkles, Flame, LineChart, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { slotOf } from "@/lib/cosmetics";
// THE OBJECT LEADS. Every row here used to be name/blurb/price/Buy, so a gilt
// back costing a fortnight showed a student the words "Gilt back" and three
// card backs were three identical rows. Nothing had to be built — CardBack,
// Crest and PrankOverlay all already render; the shelf simply never called
// them. See StorePreview's header.
import StorePreview from "@/components/market/StorePreview";
// THE LEAGUE'S OWN ORDINAL. A second copy here is how two surfaces start
// spelling a position differently, which is the small disagreement that makes
// a student check which one is right — and the grant is now a league result,
// so it should speak the league's words.
import { ordinal } from "@/lib/league";
import { WEEKLY_RECEIVE_MAX } from "@/lib/pranks";
import { Send, Play } from "lucide-react";
// THE BUTTON OWNS THE CAPABILITY. Threading an `onPreviewPrank` through the
// page and the probe meant two parents had to remember to wire it, and the
// probe forgot — which renders a Preview button that silently does nothing,
// the exact half-wired shape this shelf was just fixed for.
import { usePrankStage } from "@/lib/PrankStage";

const GLYPH = {
    cosmetic: Sparkles,
    utility: Flame,
    market: LineChart,
};

/* NOTHING ON THIS SHELF COSTS REAL MONEY. There was an "AI" group converting
   cred into chips and it is gone — see credStore.js's header. What went with
   it is the only per-unit row here, which is why this component no longer
   holds a quantity at all: a slider is a control for a shelf that has one,
   and keeping it against the day something returns is how a half-wired
   control ends up on a screen. */
const GROUPS = [
    ["cosmetic", "Looks", "Yours for good, once bought. The room sees them."],
    ["utility", "Useful", "Spent on your behalf the moment it helps."],
    ["market", "The board", "Put a question of your own up."],
];

export default function CredStore({ store, busy, onBuy, onConvert, onEquip, onPrank }) {
    const reduce = useReducedMotion();
    // A preview plays through the SAME QUEUE a delivered prank lands in, so
    // what a student sees before spending is what their friend gets by
    // construction. Shake and upside down are entirely the body transform that
    // queue drives; handed straight to the overlay they drew a card and
    // nothing else. See PrankStage.jsx.
    const { play: playPrank } = usePrankStage();
    const [xp, setXp] = useState(0);
    const [prankTo, setPrankTo] = useState("");

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
                {/* THE SENTENCE FOLLOWS THE NUMBER. This said "rank sets that"
                    for exactly as long as rank did set it; the league pays the
                    grant now, and copy that explains the old reason is worse
                    than no copy — a student checks it against their rank, finds
                    it does not move, and stops believing the panel. */}
                <p className="text-[13px] text-[var(--floor-muted-2)] mt-1.5 leading-relaxed">
                    {store.grant_from?.source === "league" ? (
                        <>
                            Finishing {ordinal(store.grant_from.position) || "—"} in your{" "}
                            {String(store.grant_from.tier || "league")} group set that. Place higher
                            next week and more arrives &mdash; your XP is never spent here.
                        </>
                    ) : (
                        <>
                            Your first weeks are granted on rank. Once the league has placed you,
                            where you FINISH sets this &mdash; and your XP is never spent here.
                        </>
                    )}
                </p>
            </div>

            {/* ── XP → CREDITS, and the panel says what it does NOT do ──────
                A student handing over XP needs to know what it costs them, and
                the honest answer is nothing: the ATAR is computed from the
                event log, level and rank read a column this never writes. That
                is the most reassuring true sentence this screen can print, so
                it prints it rather than leaving the student to wonder. */}
            {store.xp && store.xp.convertible > 0 && (
                <div className="rounded-2xl bg-[var(--floor-well)] p-4">
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--floor-dim)]
                            inline-flex items-center gap-1.5">
                            <ArrowRightLeft className="w-3 h-3" /> Turn XP into credits
                        </p>
                        <span className="text-[11px] font-bold tabular-nums text-[var(--floor-muted-2)]">
                            {store.xp.convertible.toLocaleString()} XP available
                        </span>
                    </div>
                    <p className="text-[13px] text-[var(--floor-muted-2)] leading-relaxed mb-3">
                        {store.xp.per_credit} XP makes 1 credit. Your XP total, your level, your rank and
                        your ATAR do not move &mdash; converting spends from what you have earned,
                        it never takes it away.
                    </p>

                    {(() => {
                        const max = Math.min(
                            store.xp.convertible,
                            Math.max(0, store.xp.week_room) * store.xp.per_credit,
                        );
                        const step = store.xp.per_credit * 10;
                        const credits = Math.floor(xp / store.xp.per_credit);
                        if (max < store.xp.per_credit) {
                            return (
                                <p className="text-[12px] text-[var(--floor-dim)]">
                                    You have converted all you can this week. It resets Monday.
                                </p>
                            );
                        }
                        return (
                            <>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-display font-black text-sm tabular-nums
                                        text-[var(--floor-ink)]">
                                        {xp.toLocaleString()} XP
                                    </span>
                                    <span className="font-display font-black text-sm tabular-nums
                                        text-[var(--floor-warn-ink)] inline-flex items-center gap-1">
                                        <Coins className="w-3.5 h-3.5" />{credits.toLocaleString()}
                                    </span>
                                </div>
                                <input
                                    type="range" min={0} max={max} step={step} value={Math.min(xp, max)}
                                    onChange={(e) => setXp(Number(e.target.value))}
                                    className="floor-range w-full"
                                    style={{
                                        "--range-fill": `${max > 0 ? (Math.min(xp, max) / max) * 100 : 0}%`,
                                        "--range-ink": "var(--floor-warn-ink)",
                                    }}
                                />
                                <div className="flex items-center justify-between gap-2 mt-2.5">
                                    <span className="text-[11px] text-[var(--floor-dim)]">
                                        {store.xp.week_room.toLocaleString()} of {store.xp.week_max.toLocaleString()} credits
                                        left this week
                                    </span>
                                    <Button size="sm" className="font-bold"
                                        disabled={busy || credits <= 0}
                                        onClick={() => { onConvert?.(xp); setXp(0); }}>
                                        Convert
                                    </Button>
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}

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
                                const slot = slotOf(item.id);
                                const worn = !!slot && store.equipped?.[slot] === item.id;
                                const cost = item.price;
                                const v = item.verdict || {};
                                // THE SERVER DECIDES. Every price here is fixed now, so there is
                                // nothing for the client to recompute and no way for its answer
                                // to disagree with the one the purchase is checked against.
                                const affordable = !!v.ok;
                                const blocked = !v.ok && !/more credits/i.test(v.reason || "");

                                return (
                                    <motion.div
                                        key={item.id}
                                        layout={!reduce}
                                        className={`rounded-2xl p-3.5 border transition-colors
                                            ${mine
                                                ? "bg-[var(--floor-well)] border-[var(--floor-yes-ink)]/40"
                                                : "bg-[var(--floor-card)] border-[var(--floor-edge)]"}`}
                                    >
                                        <StorePreview
                                            item={item}
                                            held={item.column ? (store.columns?.[item.column] ?? 0) : 0}
                                        />

                                        <div className="flex items-start justify-between gap-2 mt-3">
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
                                                    onClick={() => onBuy(item.id)}
                                                >
                                                    {blocked ? <Lock className="w-3.5 h-3.5" /> : "Buy"}
                                                </Button>
                                            </div>
                                        )}

                                        {/* ── OWNED IS NOT WORN, and the shelf has to let you
                                            put it on. Buying a card back used to end the
                                            interaction: `cred_equipped` was written by nothing,
                                            so every cosmetic on this shelf was permanently in a
                                            drawer. */}
                                        {mine && slotOf(item.id) && (
                                            <div className="mt-3 flex items-center justify-between gap-2">
                                                <span className="text-[11px] font-bold text-[var(--floor-muted-2)]">
                                                    {worn ? "You are wearing this" : "In your collection"}
                                                </span>
                                                <Button
                                                    size="sm" variant={worn ? "outline" : "default"}
                                                    className="font-bold"
                                                    disabled={busy}
                                                    onClick={() => onEquip?.(worn ? null : item.id, slotOf(item.id))}
                                                >
                                                    {worn ? "Take off" : "Wear"}
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
                                                    {v.reason || `You need ${(cost - (store.cred ?? 0)).toLocaleString()} more credits.`}
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
            {/* ── SEND ONE TO A FRIEND ──────────────────────────────────────
                Not a purchase, so not in the catalogue above: a prank needs a
                RECIPIENT before it means anything, and listed as a buyable item
                it would charge, record ownership and deliver to nobody — the
                exact bug the rest of this shelf was just fixed for.

                The picker does NOT say who has opted out or who is at their
                weekly ceiling. Greying somebody out would publish "this person
                turned pranks off" to everyone who opens the shelf. The refusal
                comes at send time and cannot tell the two apart. */}
            {store.pranks && !store.pranks.opted_out && (
                <section>
                    <div className="flex items-baseline gap-2 mb-1">
                        <Send className="w-3.5 h-3.5 text-[var(--floor-muted)]" aria-hidden="true" />
                        <h3 className="font-display font-black text-[var(--floor-ink)] text-sm">Send one</h3>
                        <span className="flex-1 h-px bg-[var(--floor-edge)]" />
                    </div>
                    <p className="text-[12px] text-[var(--floor-dim)] mb-2.5">
                        A few seconds on a friend&apos;s screen, with your name on it. Nothing it does
                        touches their XP, their streak or their marks. Preview plays it on yours
                        &mdash; free, and it reaches nobody.
                    </p>

                    {!store.friends?.length ? (
                        <p className="text-[13px] text-[var(--floor-muted-2)] px-1">
                            These go to friends. Add somebody first.
                        </p>
                    ) : (
                        <>
                            <label htmlFor="prank-to"
                                className="text-[10px] font-black uppercase tracking-widest text-[var(--floor-dim)]">
                                Who
                            </label>
                            <select id="prank-to" value={prankTo}
                                onChange={(e) => setPrankTo(e.target.value)}
                                className="w-full mt-1 mb-3 rounded-xl bg-[var(--floor-card)] border
                                    border-[var(--floor-edge-strong)] text-[var(--floor-ink)]
                                    text-sm font-bold px-3 py-2">
                                <option value="">Pick a friend</option>
                                {store.friends.map((f) => (
                                    <option key={f.email} value={f.email}>{f.name}</option>
                                ))}
                            </select>

                            <div className="grid sm:grid-cols-2 gap-2.5">
                                {store.pranks.kinds.map((k) => {
                                    const afford = (store.cred ?? 0) >= k.price;
                                    const spent = store.pranks.sent_this_week >= store.pranks.send_max;
                                    return (
                                        <div key={k.id}
                                            className="rounded-2xl p-3.5 border bg-[var(--floor-card)]
                                                border-[var(--floor-edge)]">
                                            <p className="font-display font-black text-[var(--floor-ink)] text-sm leading-tight">
                                                {k.label}
                                            </p>
                                            <p className="text-[12px] text-[var(--floor-muted-2)] mt-0.5 leading-snug">
                                                {k.blurb}
                                            </p>
                                            <div className="mt-3 flex items-center justify-between gap-2">
                                                <span className="font-display font-black tabular-nums
                                                    text-[var(--floor-warn-ink)] inline-flex items-center gap-1 text-sm">
                                                    <Coins className="w-3.5 h-3.5" />{k.price.toLocaleString()}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    {/* A PRANK IS PURE MOTION, so it is the one thing on
                                                        this shelf no still picture can sell — and until
                                                        now the only way to find out what one did to a
                                                        friend's screen was to pay for it. Playing it on
                                                        YOUR screen costs nothing to run, sends nothing,
                                                        charges nothing and reaches nobody. */}
                                                    <Button size="sm" variant="ghost"
                                                        className="font-bold text-[var(--floor-muted-2)]"
                                                        onClick={() => playPrank(k.id, store.me_name || "You", { preview: true })}>
                                                        <Play className="w-3.5 h-3.5 mr-1" />Preview
                                                    </Button>
                                                    <Button size="sm" className="font-bold"
                                                        disabled={busy || !prankTo || !afford || spent}
                                                        onClick={() => onPrank?.(k.id, prankTo)}>
                                                        Send
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <p className="text-[11px] text-[var(--floor-dim)] mt-2.5 leading-snug">
                                {store.pranks.send_max - store.pranks.sent_this_week} of {store.pranks.send_max} left
                                to send this week. Nobody can receive more than {WEEKLY_RECEIVE_MAX} in a week,
                                from everyone combined &mdash; and anybody can turn these off in Settings.
                            </p>
                        </>
                    )}
                </section>
            )}
        </div>
    );
}
