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
import { TrendingUp, Coins, Plus, X } from "lucide-react";
import AceDeal from "@/components/market/AceDeal";
import { base44 } from "@/api/base44Client";
import { useLiveTick } from "@/lib/LiveContext";
import { takeFn } from "@/lib/fnResult";
import { createPageUrl } from "@/utils";
import MarketCard from "@/components/market/MarketCard";
import PortfolioPanel from "@/components/market/PortfolioPanel";
import Room from "@/components/market/Room";
import SettlementReveal from "@/components/market/SettlementReveal";
import AceShuffle from "@/components/ace/AceShuffle";
import {
    readMarket, sortBoard, isOpen, sideOf, YES, KINDS, featuredOf, inRoom, roomsFor, ROOMS,
    unseenSettlements, markSettlementsSeen,
    markPercent, priorForLine, priceLabel, MARK_MIN_OBS, selfLine, selfRecord,
} from "@/lib/market";

/** A SAC's date, the way a planner prints one. */
const sacDate = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    if (!Number.isFinite(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

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

/**
 * LineDialog — call a SAC that is already on your planner.
 *
 * ═══ THE SUBJECT IS NOT SOMETHING TO TYPE ═══════════════════════════════════
 * This asked for a subject, a target and a date, in three free inputs, none of
 * which the app checked against anything it already knew. So "Chem" and
 * "Chemistry" were two subjects to every screen that groups by one, the date
 * was whatever got typed, and the SAC the student was actually thinking about
 * was sitting on their planner two pages away with its real name and real date
 * on it. Asking somebody to retype what the app already holds is how two
 * screens start disagreeing about one thing.
 *
 * It lists assessments now. Everything but the number comes off the row, the
 * row is what settles the market, and calling a SAC is one tap and one drag.
 *
 * ═══ AND THE LINE IS PRICED AGAINST THEIR OWN RECORD ════════════════════════
 * The server opens it at `priorForLine` rather than at even money, so the
 * dialog says what that will be built from — "pricing off your last 4
 * Chemistry marks, which average 74%". A student setting a line deserves to
 * know the room is about to be handed their average, and it is the single most
 * useful thing this screen can tell them before they choose a number.
 *
 * ═══ NOTHING ON THE PLANNER IS NOTHING TO CALL ══════════════════════════════
 * An empty list is not an empty state here — it is a different action, on a
 * different page. It says so and links there, rather than rendering a dead
 * dialog with a disabled button, which is the shape this file already records
 * about a feature gated behind an optional-looking step.
 */
// Exported for `scripts/_floorProbe.jsx`, which renders it against fixture
// assessments — this page is auth-gated, so there is no other way to look at
// the dialog. Not an unused symbol; see that file before removing the export.
export function LineDialog({ onClose, onOpen, busy, taken, email }) {
    const [sacs, setSacs] = useState(null);
    const [picked, setPicked] = useState(null);
    const [target, setTarget] = useState(80);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const rows = await base44.entities.SubjectAssessment.filter(
                    { created_by: email, is_completed: false }, "due_date", 30);
                const today = new Date().toISOString().slice(0, 10);
                if (alive) {
                    setSacs((rows || []).filter((a) => a.due_date && a.due_date > today
                        && !taken.has(a.id)));
                }
            } catch { if (alive) setSacs([]); }
        })();
        return () => { alive = false; };
    }, [email, taken]);

    // Their own marks in the picked subject, which is what the server will
    // price the opening line off. Loaded here so the number on screen and the
    // number the market opens at come from the same rows.
    const [past, setPast] = useState(null);
    useEffect(() => {
        if (!picked) { setPast(null); return undefined; }
        let alive = true;
        (async () => {
            try {
                const rows = await base44.entities.SubjectAssessment.filter(
                    { created_by: email, subject_name: picked.subject_name }, "-due_date", 40);
                const pcts = (rows || [])
                    .map((a) => markPercent(a.score, a.out_of)).filter((v) => v !== null);
                if (alive) setPast(pcts);
            } catch { if (alive) setPast([]); }
        })();
        return () => { alive = false; };
    }, [picked, email]);

    const priced = past ? priorForLine(past, target) : null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: "rgba(4,8,15,0.8)" }} onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl border-2 border-[#233247] bg-[#121C2E] p-5
                    max-h-[85vh] overflow-y-auto">
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
                    You state the line and everyone else trades it. You can&apos;t back your own — you
                    enter the mark — but you&apos;ll see exactly who believes you.
                </p>

                {sacs === null && (
                    <p className="text-[12px] text-[#6F86A8] inline-flex items-center gap-2">
                        <AceShuffle size="sm" label="Reading your planner" ink="floor" /> Reading your planner…
                    </p>
                )}

                {/* Not an empty state — a different action, on another page. */}
                {sacs !== null && sacs.length === 0 && (
                    <div className="text-[12px] text-[#6F86A8] leading-snug space-y-3">
                        <p>
                            Nothing on your planner to call yet. Put the SAC in with its date and
                            it&apos;ll show up here — the planner is also where you enter the mark
                            that settles it.
                        </p>
                        <a href={createPageUrl("Goals")}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl
                                bg-[#E8F0FB] text-[#0A121F] font-display font-black text-sm
                                hover:bg-white transition-colors">
                            Open your planner
                        </a>
                    </div>
                )}

                {sacs !== null && sacs.length > 0 && (
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            {sacs.map((a) => {
                                const on = picked?.id === a.id;
                                return (
                                    <button key={a.id} type="button" onClick={() => setPicked(a)}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl border-2
                                            transition-colors ${on
                                            ? "border-[#FFC800] bg-[#FFC800]/10"
                                            : "border-[#2C3E57] hover:border-[#FFC800]/50"}`}>
                                        <span className="block text-sm font-bold text-[#E8F0FB] truncate">
                                            {a.subject_name} · {a.title}
                                        </span>
                                        <span className="block text-[11px] text-[#6F86A8] tabular-nums">
                                            {sacDate(a.due_date)}
                                            {a.out_of ? ` · out of ${a.out_of}` : ""}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {picked && (
                            <>
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wide text-[#6F86A8]">
                                        The line — you&apos;ll score at least
                                    </label>
                                    <div className="flex items-center gap-3 mt-1">
                                        <input type="range" min="40" max="100" value={target}
                                            onChange={(e) => setTarget(Number(e.target.value))}
                                            className="flex-1 accent-[#FFC800]" />
                                        <span className="font-display font-black text-[#E8F0FB] text-xl
                                            tabular-nums w-14 text-right">
                                            {target}%
                                        </span>
                                    </div>
                                </div>

                                {/* What the room is about to be handed. Stated
                                    before the line is set rather than after. */}
                                {priced && (
                                    <p className="text-[11px] text-[#8FA3BF] leading-snug">
                                        {priced.thin
                                            ? `The room prices this from scratch — you've got ${priced.seen} `
                                                + `past ${picked.subject_name} mark${priced.seen === 1 ? "" : "s"} `
                                                + `on your planner, and it takes ${MARK_MIN_OBS}.`
                                            : <>
                                                Opening at{" "}
                                                <span className="font-bold tabular-nums text-[#E8F0FB]">
                                                    {priceLabel(priced.prior)}</span>
                                                {" "}— off your last {priced.seen} {picked.subject_name}{" "}
                                                mark{priced.seen === 1 ? "" : "s"}, averaging{" "}
                                                <span className="font-bold tabular-nums text-[#E8F0FB]">
                                                    {priced.average}%</span>.
                                            </>}
                                    </p>
                                )}
                            </>
                        )}

                        <button type="button" disabled={!picked || busy}
                            onClick={() => onOpen({ assessment_id: picked.id, target })}
                            className="w-full py-2.5 rounded-xl bg-[#E8F0FB] text-[#0A121F]
                                font-display font-black text-sm disabled:opacity-40 inline-flex
                                items-center justify-center gap-2 hover:bg-white transition-colors">
                            {busy && <AceShuffle size="sm" />} Open the line
                        </button>
                    </div>
                )}
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
    // WHICH ROOM, which is a VIEW of one floor and never a floor of its own.
    // Everybody trades the same market at the same price; this only decides
    // which of them are listed — see the ROOMS block in market.js for why that
    // distinction is the whole thing.
    const [room, setRoom] = useState(ROOMS.all.id);
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

    // The room narrows first, then the kind chips narrow within it — so the
    // chips only ever offer kinds that are actually in the room you are in.
    const roomed = useMemo(
        () => board.filter((m) => inRoom(m, room, me.email)),
        [board, room, me.email]);

    const shown = useMemo(
        () => (filter === "all" ? roomed : roomed.filter((m) => m.kind === filter)),
        [roomed, filter]);

    const filters = useMemo(() => filtersFor(roomed), [roomed]);

    // A room is OFFERED only once it holds something. A student with no
    // friends yet never meets an empty Friends tab on their first visit —
    // a tab that is always empty teaches that the feature is broken.
    const { rooms, counts } = useMemo(() => roomsFor(board, me.email), [board, me.email]);

    // A room that empties underneath you (the last friend's question closed)
    // must not strand the view on a tab that no longer exists.
    useEffect(() => {
        if (!rooms.some((r) => r.id === room)) setRoom(ROOMS.all.id);
    }, [rooms, room]);

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
        () => (filter === "all" ? featuredOf(roomed, me.email, 4) : []),
        [roomed, me.email, filter]);
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

    // ── Your own lines ───────────────────────────────────────────────────
    // A SAC you have already called must not be offered again — the dedupe
    // index would refuse it, and a dialog whose list produces a 409 is a list
    // that lied. Open and settled both, so the record below can be drawn from
    // the same read.
    const myLines = useMemo(
        () => [...board, ...settledBoard]
            .filter((m) => m.kind === "sac" && m.subject_is_me)
            .map(selfLine).filter(Boolean),
        [board, settledBoard]);
    // How well they call their OWN marks — the mirror of the calibration curve
    // the book draws for their calls on everybody else.
    const record = useMemo(
        () => selfRecord([...board, ...settledBoard], me.email),
        [board, settledBoard, me.email]);
    const takenSacs = useMemo(
        () => new Set(board
            .filter((m) => m.kind === "sac" && m.subject_is_me)
            .map((m) => m.meta?.assessment_id).filter(Boolean)),
        [board]);

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

    // ── THE MARK IS ENTERED ONCE, WHERE THE SAC LIVES ────────────────────
    // This was a `window.prompt` asking for a number out of 100 — which was
    // both the least gamified surface in the app and a SECOND place to type a
    // mark, while `subject_assessments.score` sat null on every row. It is one
    // entry on the planner now: it fills the column, and settling reads it
    // back. So the button goes there rather than opening a box here.
    const report = useCallback((market) => {
        const id = market?.meta?.assessment_id;
        window.location.href = createPageUrl("Goals")
            + (id ? `?mark=${encodeURIComponent(id)}` : "");
    }, []);

    if (loading) {
        // Ace deals the board onto the grid the real cards are about to fill.
        // The wait IS the deal, and the dealt cards ARE the skeleton — an
        // animation that plays and then hands over to a loading state makes a
        // student wait twice. See AceDeal.
        return <Room><AceDeal /></Room>;
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
                        {/* ── WHICH ROOM ───────────────────────────────
                            A view of one floor, never a floor of its own:
                            every room lists markets from the same pool at the
                            same price. Rendered only when there is more than
                            one to choose between, because a single tab is
                            chrome pretending to be navigation — the rule the
                            Quizzes shelf already records. */}
                        {rooms.length > 1 && (
                            <div className="flex items-center gap-1.5 mb-2.5">
                                {rooms.map((r) => (
                                    <button key={r.id} type="button"
                                        onClick={() => { setRoom(r.id); setFilter("all"); }}
                                        className={`px-3 py-1.5 rounded-lg text-[12px] font-bold
                                            border-2 transition-colors inline-flex items-center gap-1.5
                                            ${room === r.id
                                                ? "bg-[#FFC800] border-[#FFC800] text-[#0A121F]"
                                                : "border-[#233247] text-[#6F86A8] hover:text-[#E8F0FB]"}`}>
                                        {r.label}
                                        <span className="tabular-nums opacity-70">{counts[r.id]}</span>
                                    </button>
                                ))}
                            </div>
                        )}

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
                                    {filter !== "all"
                                        ? "Nothing of that kind is open here. Try another filter."
                                        : room === ROOMS.all.id
                                            ? "No open questions right now. New ones are minted every Monday."
                                            // Naming the room matters: "nothing open" on a
                                            // floor that plainly has questions on it reads
                                            // as broken rather than as filtered.
                                            : "Nothing open in this room. The Everyone tab has the rest."}
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

                        {/* ── YOUR OWN LINES ───────────────────────────── */}
                        {/* The subject of a market cannot hold a position on
                            it, so the floor used to tell the one person the
                            whole board was trading absolutely nothing. This is
                            what they get instead, and it is the better payoff:
                            how many people are reading you, and which way. */}
                        {myLines.length > 0 && (
                            <section className="rounded-2xl border-2 border-[#FFC800]/25 bg-[#121C2E] p-4">
                                <h2 className="text-[10px] font-black uppercase tracking-widest
                                    text-[#4E6484] mb-2.5">Your lines</h2>
                                <div className="space-y-2.5">
                                    {myLines.map((l) => (
                                        <div key={l.id}>
                                            <p className="text-[12px] text-[#8FA3BF] leading-snug">
                                                <span className="font-bold text-[#E8F0FB]">{l.subject}</span>
                                                {" — you called "}
                                                <span className="font-bold tabular-nums text-[#E8F0FB]">
                                                    {l.called}%</span>
                                            </p>
                                            <p className="text-[11px] text-[#4E6484] tabular-nums">
                                                {l.traders === 0
                                                    ? "nobody's taken a side yet"
                                                    : `${l.traders} trading · room ${l.room}¢ · `
                                                        + `${l.backed} backing, ${l.faded} fading`}
                                                {l.actual !== null && ` · you got ${l.actual}%`}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                {/* REFUSES to grade somebody on two SACs — the
                                    same floor TREND_MIN and CALIBRATION_MIN keep. */}
                                {record.enough && (
                                    <p className="text-[11px] text-[#6F86A8] mt-3 pt-3
                                        border-t border-[#233247] leading-snug">
                                        You&apos;ve called {record.closed} and cleared {record.cleared}
                                        {record.drift !== null && (record.drift >= 0
                                            ? `, usually beating your own line by ${record.drift}.`
                                            : `, usually landing ${Math.abs(record.drift)} under it.`)}
                                    </p>
                                )}
                            </section>
                        )}

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
                    <LineDialog onClose={() => setLineOpen(false)} onOpen={openLine} busy={busy}
                        taken={takenSacs} email={me.email} />
                )}
            </AnimatePresence>

            {/* Everything else on this page pays out visibly; the one place
                with a real result was a line on the tape. */}
            <SettlementReveal items={reveals} onSeen={markSettlementsSeen} />
        </Room>
    );
}
