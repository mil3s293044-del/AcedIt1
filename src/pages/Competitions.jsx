/**
 * Compete — the floor. Rebuilt from nothing on ONE object.
 *
 * ═══ What this replaces ═════════════════════════════════════════════════════
 * Seven nouns that all meant "a thing you can win" — battles, duels, call-outs,
 * forecasts, progress bets, back-yourself bets and the weekly league — spread
 * over 24 components and a 1,087-line page. A student had to learn all seven
 * before they could do anything, which is why the page read as confusing
 * however it was styled. Restyling seven objects gives you seven prettier
 * objects.
 *
 * Everything here is a MARKET: a question, a price, a side, a resolution.
 *
 * ═══ IT IS A DIFFERENT ROOM, ON PURPOSE ═════════════════════════════════════
 * The rest of AcedIt is cream, playing cards and soft panels, and it works. A
 * trading floor is a different kind of place and walking into one should feel
 * like it. The ink is LITERAL rather than tokenised — the focus-mode lesson,
 * arrived at from the same direction: a token that flips underneath a
 * deliberate inversion is the bug, not the fix, and this room must look the
 * same in both themes because the room is the point.
 *
 * The brand green stays YES and the streak red stays NO, so the two colours a
 * student already reads as good and bad mean the same things here.
 *
 * ═══ Three zones, in the order somebody actually uses them ══════════════════
 * THE BOARD — what is worth an opinion, sorted by heat, yours first.
 * YOUR BOOK — what you are holding and what it is worth.
 * THE TAPE  — what just happened, to whom.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Loader2, Coins, Plus, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLiveTick } from "@/lib/LiveContext";
import { takeFn } from "@/lib/fnResult";
import { createPageUrl } from "@/utils";
import MarketCard from "@/components/market/MarketCard";
import PortfolioPanel from "@/components/market/PortfolioPanel";
import Room from "@/components/market/Room";
import SettlementReveal from "@/components/market/SettlementReveal";
import {
    readMarket, sortBoard, isOpen, sideOf, YES, KINDS, featuredOf,
    unseenSettlements, markSettlementsSeen,
} from "@/lib/market";

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "Someone";

/** Relative time that REFUSES a bad date rather than printing "20705d ago". */
function ago(iso) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t) || t < Date.UTC(2020, 0, 1)) return null;
    const mins = Math.floor((Date.now() - t) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

// ─── The tape ───────────────────────────────────────────────────────────────

/**
 * Every position taken and every market resolved, newest first.
 *
 * Derived from rows already loaded rather than stored as events — the rule
 * `redoQueue` and `subjectHub` both follow, so the tape cannot go stale,
 * double up, or disagree with the board above it. An entry with no usable
 * timestamp is DROPPED, because it has no place on a timeline.
 */
function buildTape(markets = [], recent = []) {
    const rows = [];
    for (const m of markets) {
        for (const pos of m.positions || []) {
            if (!ago(pos.created_date)) continue;
            rows.push({
                id: `pos:${pos.id}`, at: pos.created_date,
                who: firstName(pos.user_name), side: sideOf(pos.p),
                text: `backed ${sideOf(pos.p) === YES ? "YES" : "NO"} on`,
                subject: m.title, stake: pos.stake,
            });
        }
    }
    for (const m of recent) {
        if (!ago(m.resolved_at)) continue;
        rows.push({
            id: `res:${m.id}`, at: m.resolved_at, resolved: true,
            outcome: m.status === "void" ? null : m.outcome,
            text: m.status === "void" ? "was voided —" : `resolved ${m.outcome ? "YES" : "NO"} —`,
            subject: m.title,
        });
    }
    return rows.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 40);
}

function Tape({ rows }) {
    if (!rows.length) {
        return (
            <p className="text-[13px] text-[#4E6484] px-1">
                Nothing has happened yet this week. Take a side and you'll be the first line on it.
            </p>
        );
    }
    return (
        <div className="space-y-1">
            {rows.map((r) => (
                <div key={r.id}
                    className="flex items-baseline gap-2 py-1.5 border-b border-[#1B2839] last:border-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 translate-y-[-2px]
                        ${r.resolved
                            ? (r.outcome === null ? "bg-[#4E6484]" : r.outcome ? "bg-[#58CC02]" : "bg-[#FF5A5F]")
                            : r.side === YES ? "bg-[#58CC02]" : "bg-[#FF5A5F]"}`} />
                    <p className="text-[12px] leading-snug min-w-0 flex-1">
                        {r.who && <span className="font-bold text-[#E8F0FB]">{r.who} </span>}
                        <span className="text-[#6F86A8]">{r.text} </span>
                        <span className="text-[#8FA3BF]">{r.subject}</span>
                        {r.stake ? <span className="text-[#4E6484]"> · {r.stake}</span> : null}
                    </p>
                    <span className="text-[10px] text-[#3D5273] flex-shrink-0 tabular-nums">
                        {ago(r.at)}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Open a line on your own mark ───────────────────────────────────────────

function LineDialog({ onClose, onOpen, busy }) {
    const [subject, setSubject] = useState("");
    const [target, setTarget] = useState(80);
    const [date, setDate] = useState("");
    const ok = subject.trim() && target > 0 && date;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: "rgba(4,8,15,0.8)" }} onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl border-2 border-[#233247] bg-[#121C2E] p-5">
                <div className="flex items-start justify-between gap-3 mb-1">
                    <h2 className="font-display font-black text-[#E8F0FB] text-lg leading-tight">
                        Call your own SAC
                    </h2>
                    <button type="button" onClick={onClose} className="text-[#6F86A8] hover:text-[#E8F0FB]">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                {/* Says plainly why you can't back it. The rule is more
                    motivating stated than hidden: being read by the room is
                    the draw, not the payout you are giving up. */}
                <p className="text-[12px] text-[#6F86A8] leading-snug mb-4">
                    You state the line and everyone else trades it. You can't back your own — you're
                    the one who reports the mark — but you'll see exactly who believes you.
                </p>
                <div className="space-y-3">
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wide text-[#6F86A8]">
                            Subject
                        </label>
                        <input value={subject} onChange={(e) => setSubject(e.target.value)}
                            placeholder="Chemistry"
                            className="w-full mt-1 rounded-xl bg-[#0E1929] border-2 border-[#2C3E57]
                                px-3 py-2 text-[#E8F0FB] text-sm outline-none focus:border-[#1CB0F6]" />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wide text-[#6F86A8]">
                            The line — you'll score at least
                        </label>
                        <div className="flex items-center gap-3 mt-1">
                            <input type="range" min="40" max="100" value={target}
                                onChange={(e) => setTarget(Number(e.target.value))}
                                className="flex-1 accent-[#1CB0F6]" />
                            <span className="font-display font-black text-[#E8F0FB] text-xl tabular-nums w-12 text-right">
                                {target}
                            </span>
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wide text-[#6F86A8]">
                            SAC date
                        </label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                            className="w-full mt-1 rounded-xl bg-[#0E1929] border-2 border-[#2C3E57]
                                px-3 py-2 text-[#E8F0FB] text-sm outline-none focus:border-[#1CB0F6]" />
                    </div>
                </div>
                <button type="button" disabled={!ok || busy}
                    onClick={() => onOpen({ subject: subject.trim(), target,
                        closes_at: new Date(`${date}T23:59:00`).toISOString() })}
                    className="w-full mt-4 py-2.5 rounded-xl bg-[#E8F0FB] text-[#0A121F]
                        font-display font-black text-sm disabled:opacity-40 inline-flex
                        items-center justify-center gap-2 hover:bg-white transition-colors">
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />} Open the line
                </button>
            </div>
        </div>
    );
}

// ─── The page ───────────────────────────────────────────────────────────────

/**
 * THE CHIPS ARE WHAT IS ON THE BOARD, not what the model can express.
 *
 * Built from KIND_LIST this was ten chips, three of which (quiz, call-out,
 * battle) are legacy kinds that no longer mint — so a third of the filter row
 * led to an empty board and read as a broken page. Computed off the markets
 * actually present, a chip cannot promise something that is not there. Same
 * rule Browse keeps about its area chips, arrived at from the other side.
 */
function filtersFor(markets) {
    const seen = [];
    markets.forEach((m) => { if (!seen.includes(m.kind)) seen.push(m.kind); });
    return [
        { id: "all", label: "All" },
        ...seen.map((id) => ({ id, label: KINDS[id]?.label || id })),
    ];
}

/**
 * A band heading that ends in a rule to the end of the row.
 *
 * The same device the Quizzes shelf uses, for the same reason: it TERMINATES
 * the band, so the space beside two cards reads as margin somebody chose
 * rather than somewhere content failed to reach.
 */
function BoardHeading({ label, note }) {
    return (
        <div className="flex items-center gap-3 mb-2.5">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-[#8FA3BF]">
                {label}
            </h2>
            {note && <span className="text-[11px] font-bold text-[#4E6484]">{note}</span>}
            <span className="flex-1 h-px bg-[#233247]" aria-hidden="true" />
        </div>
    );
}

export default function Competitions() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [filter, setFilter] = useState("all");
    // Floor or book. Two tabs and no more: the floor is what you can do and the
    // book is what you have done, which is the whole split. A third tab here
    // would be a second answer to one of those two questions.
    const [tab, setTab] = useState("floor");
    const [lineOpen, setLineOpen] = useState(false);
    const liveTick = useLiveTick();

    // Declared BEFORE any hook naming it in a dependency array. A deps array is
    // evaluated DURING render, so a const below its own hook is a temporal-dead-
    // zone ReferenceError and a white screen — the crash that took the old
    // Compete down, then Study, in two slightly different shapes.
    const load = useCallback(async () => {
        try {
            // takeFn, NOT the raw result: invoke returns { data, error } and
            // reading the envelope as the payload renders an empty board with
            // no error — see fnResult.js.
            setData(takeFn(await base44.functions.invoke("getMarkets", {})));
            setError(null);
        } catch (e) {
            setError(e?.message || "Couldn't open the floor.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load, liveTick]);

    const me = data?.me || {};
    const board = useMemo(() => {
        const rows = (data?.markets || [])
            .map((m) => readMarket(m, m.positions || [], me.email))
            .filter((m) => isOpen(m));
        return sortBoard(rows, me.email);
    }, [data, me.email]);

    const shown = useMemo(
        () => (filter === "all" ? board : board.filter((m) => m.kind === filter)),
        [board, filter]);

    const filters = useMemo(() => filtersFor(board), [board]);

    // ── FEATURED: the questions the whole room can argue about ───────────
    // A board of solo markets is a board of private facts — "will Maya study
    // five days" is a question maybe four people have a view on. The lines up
    // here are cohort totals, rivalries, longshots and a SAC on Friday, and
    // anybody can hold an opinion on one without knowing the person. That is
    // what makes a market board feel busy at thirty students.
    //
    // Only on the unfiltered board: a student who asked for one kind has asked
    // for one ranking, and chopping that into a featured strip and a remainder
    // breaks the very order they requested — the lesson Browse's sections
    // record about sorting.
    const featured = useMemo(
        () => (filter === "all" ? featuredOf(board, me.email, 4) : []),
        [board, me.email, filter]);
    const rest = useMemo(() => {
        if (!featured.length) return shown;
        const up = new Set(featured.map((m) => m.id));
        return shown.filter((m) => !up.has(m.id));
    }, [shown, featured]);

    const book = useMemo(() => board.filter((m) => m.mine), [board]);

    // Resolved markets, read through the same lens as the open ones so `mine`
    // is found the same way. `recent` arrives raw from the server.
    const settledBoard = useMemo(
        () => (data?.recent || []).map((m) => readMarket(m, m.positions || [], me.email)),
        [data, me.email]);
    const tape = useMemo(() => buildTape(board, settledBoard), [board, settledBoard]);

    // ── The payoff moment ────────────────────────────────────────────────
    // Derived from rows already loaded — nothing new is stored, so the reveal
    // cannot disagree with the tape line for the same result. The seen-set
    // lives in the model, not here.
    const reveals = useMemo(
        () => unseenSettlements(settledBoard, me.email), [settledBoard, me.email]);

    // One place a market is opened from, because two would drift: the board
    // card and the book row must land on the same screen or a student learns
    // that tapping something here does different things depending where.
    const openMarket = useCallback((id) => {
        if (id) window.location.href = `${createPageUrl("Market")}?id=${encodeURIComponent(id)}`;
    }, []);

    const atStake = book.reduce((s, m) => s + (m.mine?.stake || 0), 0);

    const take = async (market, pick) => {
        setBusy(true);
        try {
            takeFn(await base44.functions.invoke("takePosition", {
                market_id: market.id, side: pick.side,
                conviction: pick.conviction, stake: pick.stake,
            }));
            await load();
        } catch (e) {
            setError(e?.message || "That didn't go through.");
        }
        setBusy(false);
    };

    const openLine = async (payload) => {
        setBusy(true);
        try {
            takeFn(await base44.functions.invoke("openMarkMarket", payload));
            setLineOpen(false);
            await load();
        } catch (e) {
            setError(e?.message || "Couldn't open that line.");
        }
        setBusy(false);
    };

    const report = async (market) => {
        const raw = window.prompt(`What did you get? (out of 100)\n\n${market.title}`);
        if (raw == null) return;
        const score = Math.round(Number(raw));
        if (!Number.isFinite(score) || score < 0 || score > 100) return;
        setBusy(true);
        try {
            takeFn(await base44.functions.invoke("reportMark", { market_id: market.id, score }));
            await load();
        } catch (e) {
            setError(e?.message || "Couldn't report that.");
        }
        setBusy(false);
    };

    if (loading) {
        return (
            <Room>
                <div className="flex items-center justify-center py-32 text-[#6F86A8] gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Opening the floor…
                </div>
            </Room>
        );
    }

    // The tables may not exist yet. Say so plainly rather than rendering an
    // empty board that looks like nobody is playing — the posture call-outs
    // and reactions already take.
    if (data && data.available === false) {
        return (
            <Room>
                <div className="max-w-md mx-auto text-center py-24">
                    <TrendingUp className="w-8 h-8 text-[#33486A] mx-auto mb-3" />
                    <h1 className="font-display font-black text-[#E8F0FB] text-xl">
                        The floor isn't open yet
                    </h1>
                    <p className="text-sm text-[#6F86A8] mt-2">
                        {data.reason || "One database migration to run."}
                    </p>
                </div>
            </Room>
        );
    }

    return (
        <Room>
            <div className="max-w-6xl mx-auto">

                {/* ── The strip: who you are on this floor ──────────── */}
                <header className="flex flex-wrap items-end justify-between gap-4 mb-5">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#4E6484]">
                            The floor
                        </p>
                        <h1 className="font-display font-black text-[#E8F0FB] text-2xl sm:text-3xl leading-tight">
                            {book.length > 0
                                ? `You're holding ${book.length} ${book.length === 1 ? "position" : "positions"}`
                                : "Read the room, take a side"}
                        </h1>
                    </div>
                    <div className="flex items-end gap-5">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#4E6484]">
                                Cred
                            </p>
                            <p className="font-display font-black text-[#FFC800] text-2xl tabular-nums
                                inline-flex items-center gap-1.5">
                                <Coins className="w-4 h-4" />{(me.cred ?? 0).toLocaleString()}
                            </p>
                        </div>
                        {atStake > 0 && (
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#4E6484]">
                                    At stake
                                </p>
                                {/* The mark-to-market figure used to sit here as a
                                    small signed number beside this one, and "100
                                    -1" read as a subtraction rather than as two
                                    facts. What a student can act on is per
                                    position — "+17 if right" — and that is
                                    already on the card. */}
                                <p className="font-display font-black text-[#E8F0FB] text-2xl tabular-nums">
                                    {atStake.toLocaleString()}
                                </p>
                            </div>
                        )}
                    </div>
                </header>

                {error && (
                    <div className="mb-4 rounded-xl border-2 border-[#FF5A5F]/40 bg-[#FF5A5F]/10
                        px-4 py-2.5 text-[13px] text-[#FF9296]">{error}</div>
                )}

                {/* ── Floor or book ────────────────────────────────── */}
                <div className="flex items-center gap-1.5 mb-4" role="tablist">
                    {[["floor", "The floor"], ["book", "Your book"]].map(([id, label]) => (
                        <button key={id} type="button" role="tab" aria-selected={tab === id}
                            onClick={() => setTab(id)}
                            className={`px-3.5 py-2 rounded-xl text-[13px] font-display font-black
                                border-2 transition-colors
                                ${tab === id
                                    ? "bg-[#E8F0FB] border-[#E8F0FB] text-[#0A121F]"
                                    : "border-[#233247] text-[#6F86A8] hover:text-[#E8F0FB]"}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {tab === "book" ? (
                    <PortfolioPanel onOpenMarket={openMarket} />
                ) : (
                <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">

                    {/* ── THE BOARD ────────────────────────────────── */}
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
                            {filters.map((f) => (
                                <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold
                                        border-2 transition-colors
                                        ${filter === f.id
                                            ? "bg-[#E8F0FB] border-[#E8F0FB] text-[#0A121F]"
                                            : "border-[#233247] text-[#6F86A8] hover:text-[#E8F0FB]"}`}>
                                    {f.label}
                                </button>
                            ))}
                            <button type="button" onClick={() => setLineOpen(true)}
                                className="flex-shrink-0 ml-auto px-3 py-1.5 rounded-lg text-[12px]
                                    font-bold border-2 border-[#FFC800]/40 text-[#FFC800]
                                    hover:bg-[#FFC800]/10 transition-colors inline-flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5" /> Call a SAC
                            </button>
                        </div>

                        {shown.length === 0 ? (
                            <div className="rounded-2xl border-2 border-[#233247] bg-[#121C2E] p-8 text-center">
                                <p className="text-sm text-[#6F86A8]">
                                    {filter === "all"
                                        ? "No open questions right now. New ones are minted every Monday."
                                        : "Nothing of that kind is open. Try another filter."}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {featured.length > 0 && (
                                    <section>
                                        <BoardHeading label="Featured"
                                            note="questions the whole room can call" />
                                        <motion.div layout className="grid sm:grid-cols-2 gap-3">
                                            <AnimatePresence initial={false}>
                                                {featured.map((m) => (
                                                    <MarketCard key={m.id} market={m} balance={me.cred ?? 0}
                                                        busy={busy} onTake={take} onReport={report} />
                                                ))}
                                            </AnimatePresence>
                                        </motion.div>
                                    </section>
                                )}

                                {rest.length > 0 && (
                                    <section>
                                        {featured.length > 0 && (
                                            <BoardHeading label="The floor"
                                                note={`${rest.length} open`} />
                                        )}
                                        <motion.div layout className="grid sm:grid-cols-2 gap-3">
                                            <AnimatePresence initial={false}>
                                                {rest.map((m) => (
                                                    <MarketCard key={m.id} market={m} balance={me.cred ?? 0}
                                                        busy={busy} onTake={take} onReport={report} />
                                                ))}
                                            </AnimatePresence>
                                        </motion.div>
                                    </section>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── THE TAPE ─────────────────────────────────── */}
                    <aside className="lg:sticky lg:top-6 space-y-4">
                        <section className="rounded-2xl border-2 border-[#233247] bg-[#121C2E] p-4">
                            <h2 className="text-[10px] font-black uppercase tracking-widest
                                text-[#4E6484] mb-2.5">The tape</h2>
                            {/* Scrolls rather than growing. On a quiet board six
                                cards sat beside twenty tape rows and the sidebar
                                became the page. */}
                            <div className="max-h-[26rem] overflow-y-auto pr-1">
                                <Tape rows={tape} />
                            </div>
                        </section>

                        {book.length > 0 && (
                            <section className="rounded-2xl border-2 border-[#233247] bg-[#121C2E] p-4">
                                <h2 className="text-[10px] font-black uppercase tracking-widest
                                    text-[#4E6484] mb-2.5">Your book</h2>
                                <div className="space-y-2">
                                    {book.map((m) => (
                                        <div key={m.id} className="flex items-baseline justify-between gap-2">
                                            <span className="text-[12px] text-[#8FA3BF] truncate min-w-0">
                                                {m.title}
                                            </span>
                                            <span className={`text-[11px] font-black tabular-nums flex-shrink-0
                                                ${sideOf(m.mine.p) === YES ? "text-[#58CC02]" : "text-[#FF5A5F]"}`}>
                                                {sideOf(m.mine.p) === YES ? "YES" : "NO"} {m.mine.stake}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <p className="text-[11px] text-[#3D5273] leading-snug px-1">
                            Cred is not XP — losing a call can't touch your level, rank or ATAR.
                            You get {(me.weekly_grant ?? 1000).toLocaleString()} a week.
                            Agreeing with the price pays nothing; you earn by disagreeing and being right.
                        </p>
                    </aside>
                </div>
                )}
            </div>

            <AnimatePresence>
                {lineOpen && (
                    <LineDialog onClose={() => setLineOpen(false)} onOpen={openLine} busy={busy} />
                )}
            </AnimatePresence>

            {/* Everything else on this page pays out visibly; the one place
                with a real result was a line on the tape. */}
            <SettlementReveal items={reveals} onSeen={markSettlementsSeen} />
        </Room>
    );
}
