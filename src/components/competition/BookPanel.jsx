/**
 * BookPanel — your whole position, in one number and one line.
 *
 * The page opened with six identical stat tiles: record, win rate, live,
 * leading, points, XP. Six numbers of equal weight is a table, not a
 * dashboard — nothing on it was the number, so the eye had nowhere to land
 * and none of it answered the question a student actually arrives with.
 *
 * A market answers that question with a price and a chart, and the smaller
 * facts sit under it. So: the book (stake-weighted win probability across
 * every live battle), how far it has moved today, and the line it moved
 * along. Exposure and the old counters live below as supporting text.
 *
 * The chart is deliberately the widest element on the page. A sparkline in a
 * stat tile is decoration; at this size the shape is readable, and the shape
 * is the whole point — a book at 61% that has been falling all week is a
 * different morning from a book at 61% that has been climbing.
 */
import React, { useId } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Coins, Swords, Trophy } from "lucide-react";

/**
 * The book's line. Area fill, because a position has weight.
 *
 * `preserveAspectRatio="none"` is what lets the line stretch to any card
 * width, and it is also why there is no dot on the end: a circle in a stretched
 * viewBox renders as an ellipse, and at this aspect the "now" marker came out a
 * forty-pixel blob. The last price is an HTML tag pinned at the line's height
 * instead — which is what a market chart does anyway.
 */
function BookChart({ series, rising, price }) {
    const gid = useId();
    if (!series || series.length < 3) return null;
    const W = 100, H = 40;
    const clamp = (p) => Math.max(0, Math.min(100, p));
    const line = series.map((d, i) =>
        `${((i / (series.length - 1)) * W).toFixed(2)},${(H - (clamp(d.p) / 100) * H).toFixed(2)}`).join(" ");
    // The tag shows the SAME number as the headline. It used to show the last
    // grid sample, which is stepped to the last recorded point and so could sit
    // a few points off the live price — two numbers for one thing, on the one
    // panel whose whole job is to be the price.
    const last = clamp(price ?? series[series.length - 1].p);
    const tone = rising ? "text-primary" : "text-streak";

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                className="w-full h-28 sm:h-32 block" aria-hidden="true">
                <defs>
                    <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${gid})`} className={tone} />
                {/* Even odds, drawn over the fill so it stays readable. */}
                <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="currentColor" strokeWidth="1"
                    strokeDasharray="3 3" className="text-muted-foreground/35"
                    vectorEffect="non-scaling-stroke" />
                <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinejoin="round" strokeLinecap="round" className={tone}
                    vectorEffect="non-scaling-stroke" />
            </svg>
            {/* The last price, at the height it closed. */}
            <span className={`absolute right-2 -translate-y-1/2 pointer-events-none
                pill text-[10px] font-black tabular-nums bg-surface border border-border ${tone}`}
                style={{ top: `${100 - last}%` }}>
                {last}%
            </span>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none
                text-[10px] font-bold text-muted-foreground/70">even</span>
        </div>
    );
}

export default function BookPanel({ odds, delta, series, exposure, liveCount, record, winRate }) {
    const flat = delta == null || Math.abs(delta) < 1;
    const rising = (delta ?? 0) >= 0;
    const tone = odds == null ? "text-muted-foreground"
        : odds >= 60 ? "text-primary" : odds >= 40 ? "text-xp" : "text-streak";
    const MoveIcon = flat ? Minus : rising ? TrendingUp : TrendingDown;

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-surface border border-border shadow-soft overflow-hidden">
            <div className="p-5 sm:p-6 pb-0 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                    <p className="stat-label text-muted-foreground">Your book</p>
                    {odds == null ? (
                        <>
                            <p className="font-display font-black text-foreground leading-none mt-1
                                text-3xl sm:text-4xl">No position</p>
                            <p className="text-sm text-muted-foreground mt-1.5">
                                Start a battle and this becomes your price.
                            </p>
                        </>
                    ) : (
                        <>
                            <p className={`font-display font-black leading-none tabular-nums mt-1 ${tone}`}
                                style={{ fontSize: "clamp(2.5rem, 8vw, 3.5rem)" }}>
                                {odds}<span className="text-[0.45em] align-super ml-0.5">%</span>
                            </p>
                            <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-flex items-center gap-1 font-bold ${
                                    flat ? "text-muted-foreground" : rising ? "text-primary" : "text-streak"}`}>
                                    <MoveIcon className="w-3.5 h-3.5" />
                                    {flat ? "level" : `${rising ? "+" : ""}${delta}`} today
                                </span>
                                <span aria-hidden>·</span>
                                <span>weighted across {liveCount} live battle{liveCount === 1 ? "" : "s"}</span>
                            </p>
                        </>
                    )}
                </div>

                {/* The facts that used to be tiles, at the weight they deserve. */}
                <dl className="flex items-start gap-5 sm:gap-6 flex-shrink-0">
                    {[
                        { k: "At stake", v: `${(exposure?.atStake || 0).toLocaleString()}`, sub: "XP", icon: Coins, tone: "text-streak" },
                        { k: "Expected", v: `${(exposure?.expected || 0).toLocaleString()}`, sub: "XP", icon: TrendingUp, tone: "text-primary" },
                        { k: "Record", v: record, sub: winRate != null ? `${winRate}%` : null, icon: Trophy, tone: "text-foreground" },
                    ].map(({ k, v, sub, icon: Icon, tone: t }) => (
                        <div key={k}>
                            <dt className="stat-label text-muted-foreground flex items-center gap-1">
                                <Icon className="w-3 h-3" /> {k}
                            </dt>
                            <dd className={`font-display font-extrabold text-lg leading-none tabular-nums mt-1 ${t}`}>
                                {v}{sub && <span className="text-muted-foreground font-bold text-xs ml-1">{sub}</span>}
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>

            <div className="px-1 sm:px-2 mt-3">
                <BookChart series={series} rising={rising} price={odds} />
            </div>
            {series?.length > 2 && (
                <div className="px-5 sm:px-6 pb-4 flex justify-between text-[11px] font-bold text-muted-foreground">
                    <span>since your first battle opened</span>
                    <span className="inline-flex items-center gap-1"><Swords className="w-3 h-3" /> now</span>
                </div>
            )}
        </motion.section>
    );
}
