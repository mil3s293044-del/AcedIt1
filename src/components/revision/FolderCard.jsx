/**
 * FolderCard — one SAC on the Revision shelf; ExamTile, a subject's exam;
 * BankTile, everything saved across them.
 *
 * A card because each one is a door: the whole thing opens the folder. The
 * subject's colour is a SPINE, the way the Quizzes shelf and Subjects already
 * identify a subject, and the countdown is the only figure that leads — the
 * deadline is the reason a student is on this screen at all.
 */
import React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { createPageUrl } from "@/utils";
import { revisionQuery } from "@/lib/revision";
import { shortSubject } from "@/lib/subjectShort";
import ReadinessBar from "@/components/revision/ReadinessBar";

/** Urgency by days, as static classes. */
const URGENCY = {
    now:  { box: "bg-streak/10 text-streak", sub: "text-streak/80" },
    soon: { box: "bg-xp/10 text-xp", sub: "text-xp/80" },
    far:  { box: "bg-secondary text-foreground", sub: "text-muted-foreground" },
};
export const urgencyOf = (days) => (days == null ? "far" : days <= 3 ? "now" : days <= 14 ? "soon" : "far");

/** The countdown: the number leads, the unit sits under it. */
export function Countdown({ days, size = "md" }) {
    if (days == null) return null;
    const u = URGENCY[urgencyOf(days)];
    const big = size === "lg";
    const word = days === 0 ? "today" : days === 1 ? "day" : "days";
    return (
        <span className={`flex flex-col items-center justify-center rounded-2xl flex-shrink-0 ${u.box} ${big ? "w-20 h-20" : "w-14 h-14"}`}
            data-countdown={days}>
            {days === 0
                ? <span className={`font-display font-black leading-none ${big ? "text-xl" : "text-sm"}`}>Today</span>
                : <span className={`font-display font-black tabular-nums leading-none ${big ? "text-3xl" : "text-xl"}`}>{days}</span>}
            {days !== 0 && <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${u.sub}`}>{word}</span>}
        </span>
    );
}

/** What is in the folder, said once and small. Kinds with nothing are left out. */
export function Inventory({ points = 0, mistakes = 0, answers = 0, className = "" }) {
    const parts = [
        points ? `${points} point${points === 1 ? "" : "s"}` : null,
        mistakes ? `${mistakes} mistake${mistakes === 1 ? "" : "s"}` : null,
        answers ? `${answers} answer${answers === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    if (!parts.length) return null;
    return <span className={`text-xs text-muted-foreground ${className}`}>{parts.join(" · ")}</span>;
}

const hrefFor = (key) => `${createPageUrl("Revision")}${revisionQuery({ folder: key })}`;

export default function FolderCard({ folder, r, tone, index = 0 }) {
    const reduce = useReducedMotion();
    return (
        <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(index * 0.06, 0.3) }} className="h-full">
            <Link to={hrefFor(folder.key)} data-folder={folder.key}
                className="group relative block h-full card-soft on-table border-2 border-border rounded-2xl pl-5 pr-4 py-4 sm:pl-6 sm:pr-5 sm:py-5
                    overflow-hidden transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5">
                <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: tone }} />
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="stat-label text-muted-foreground truncate">
                            {shortSubject(folder.subject)}{folder.type && folder.type !== folder.title ? ` · ${folder.type}` : ""}
                        </p>
                        <h3 className="font-display font-extrabold text-lg sm:text-xl text-foreground leading-tight mt-1">
                            {folder.title}
                        </h3>
                    </div>
                    <Countdown days={folder.daysAway} />
                </div>
                <ReadinessBar r={r} className="mt-4" />
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-xs font-bold text-foreground">
                        {r.total
                            ? <><span className="tabular-nums">{r.ready}</span> of <span className="tabular-nums">{r.total}</span> ready</>
                            : "Nothing tracked yet"}
                    </span>
                    <Inventory points={r.points.total} mistakes={r.mistakes.total} answers={r.answers.total} />
                </div>
                {folder.kind === "sac" && folder.topics.length === 0 && (
                    <p className="mt-2 text-[11px] font-bold text-xp" data-folder-unscoped>
                        Covers the whole subject until you pick its topics
                    </p>
                )}
                <ChevronRight aria-hidden="true"
                    className="absolute right-3 bottom-3 w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
        </motion.div>
    );
}

/** An exam folder: the whole course, quieter than a SAC because it has no date. */
export function ExamTile({ folder, r, tone, index = 0 }) {
    const reduce = useReducedMotion();
    return (
        <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}>
            <Link to={hrefFor(folder.key)} data-folder={folder.key}
                className="relative block rounded-2xl border-2 border-border bg-surface pl-4 pr-3.5 py-3 overflow-hidden
                    hover:border-foreground/25 transition-colors">
                <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: tone }} />
                <div className="flex items-center justify-between gap-2">
                    <p className="font-display font-extrabold text-foreground truncate">{folder.subject}</p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                </div>
                <ReadinessBar r={r} size="sm" className="mt-2.5" />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {r.total
                        ? <><span className="font-bold text-foreground tabular-nums">{r.ready}</span> of <span className="tabular-nums">{r.total}</span> ready · the whole course</>
                        : "The whole course"}
                </p>
            </Link>
        </motion.div>
    );
}

/** The two banks, across every folder. */
export function BankTile({ to, icon: Icon, title, line, tone = "primary" }) {
    const TONE = {
        primary: "bg-primary/10 text-primary",
        streak: "bg-streak/10 text-streak",
        chart3: "bg-chart-3/10 text-chart-3",
    };
    return (
        <Link to={to} className="group flex items-center gap-3 rounded-2xl border-2 border-border bg-surface px-4 py-3.5
            hover:border-foreground/25 transition-colors" data-bank-tile>
            <span className={`w-10 h-10 rounded-xl grid place-items-center flex-shrink-0 ${TONE[tone] || TONE.primary}`}>
                <Icon className="w-5 h-5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-display font-extrabold text-foreground">{title}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{line}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
        </Link>
    );
}
