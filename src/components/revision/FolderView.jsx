/**
 * FolderView — one SAC (or one exam), and everything in it.
 *
 * ─── The hero is the answer, the tabs are the work ──────────────────────────
 * The question a student opens a folder with is "where am I with this?", so the
 * hero answers it before anything else: the countdown, the readiness bar in two
 * layers, the one sentence, and one primary button that drills whatever is
 * ready across BOTH banks. Everything under it is a tab per kind of work —
 * labelled with the thing you DO, the Progress page's rule — with its count, so
 * nothing is behind a control that does not say what is behind it.
 *
 * ─── Nothing in here is a copy ──────────────────────────────────────────────
 * The mistakes are the bank's own rows, drilled through the bank's own run; the
 * answers are the answer bank's; the re-sits are `redoQueue`'s; the mock is the
 * existing mock exam with a scope. A folder is a LENS on things that already
 * exist, which is why it can never disagree with the screens they came from.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Play, Target, GraduationCap, Tags, BookOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import BankBand from "@/components/mistakes/BankBand";
import { RedoTab } from "@/pages/MistakeBank";
import { bankBands } from "@/lib/bankRun";
import { isReady } from "@/lib/due";
import { folderLead, drillQueue, checkCandidates, CHECK_MAX } from "@/lib/revision";
import ReadinessBar from "@/components/revision/ReadinessBar";
import { Countdown } from "@/components/revision/FolderCard";
import KeyKnowledge from "@/components/revision/KeyKnowledge";
import AnswerList from "@/components/revision/AnswerList";

const fmtDue = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const at = new Date(y, m - 1, d);
    return Number.isNaN(at.getTime()) ? "" : at.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

/** A quiet empty state for a tab: one line, and the way to fill it. */
function Empty({ children, action }) {
    return (
        <div className="rounded-2xl border-2 border-dashed border-border px-5 py-6 text-center" data-tab-empty>
            <p className="text-sm text-muted-foreground leading-snug max-w-md mx-auto">{children}</p>
            {action && <div className="mt-3">{action}</div>}
        </div>
    );
}

/** The redo rows grouped by quiz, the shape RedoTab already draws. */
function redoGroups(rows = []) {
    const groups = new Map();
    for (const row of rows) {
        if (!groups.has(row.quizId)) groups.set(row.quizId, { quiz: row.quiz, title: row.title, subject: row.subject, rows: [] });
        groups.get(row.quizId).rows.push(row);
    }
    return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length);
}

export default function FolderView({
    folder, tone, contents, r, proof, profile, attempts = [], cases = [], checkJob,
    tab = "knowledge", onTab, onSavePoints, onTest, onScope, onDrill, onClear, onRetire, onDeleteAnswer,
    onMoveLegacy, movingId, onSitRedo, onMock, mockCount = 0,
}) {
    const reduce = useReducedMotion();
    const [testNonce, setTestNonce] = useState(0);
    const ready = useMemo(() => drillQueue(contents), [contents]);
    const bands = useMemo(() => bankBands(contents.mistakes, { attempts, isReady }), [contents.mistakes, attempts]);
    const redo = useMemo(() => redoGroups(contents.redo), [contents.redo]);
    const toTest = useMemo(() => checkCandidates(folder.points, proof, CHECK_MAX).length, [folder.points, proof]);
    const lead = folderLead(folder, r);

    // The tab strip scrolls on a phone (five tabs do not fit 390px at a size
    // anybody can read). Two things make that a strip rather than a clipped
    // row: the edge that has more FADES rather than cutting a word in half,
    // and the selected tab is always scrolled into view — a ?tab= link to
    // "Mock exam" must not land on a tab the student cannot see is selected.
    const strip = useRef(null);
    const [edges, setEdges] = useState({ left: false, right: false });
    const measure = () => {
        const s = strip.current;
        if (!s) return;
        const left = s.scrollLeft > 2;
        const right = s.scrollLeft + s.clientWidth < s.scrollWidth - 2;
        setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
    };
    useEffect(() => {
        const s = strip.current;
        const b = s?.querySelector('[aria-selected="true"]');
        if (s && b) {
            // Scrolled by hand rather than scrollIntoView, which would also
            // move the PAGE when the strip is off screen.
            const lo = b.offsetLeft - 24;
            const hi = b.offsetLeft + b.offsetWidth - s.clientWidth + 24;
            if (s.scrollLeft > lo) s.scrollLeft = Math.max(0, lo);
            else if (s.scrollLeft < hi) s.scrollLeft = hi;
        }
        measure();
    }, [tab]);
    useEffect(() => {
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, []);
    const fade = edges.left && edges.right
        ? "linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent)"
        : edges.right ? "linear-gradient(to right, black calc(100% - 28px), transparent)"
        : edges.left ? "linear-gradient(to left, black calc(100% - 28px), transparent)"
        : undefined;

    // Weak deck cards, by the deck they sit in, each with a door to that deck.
    const weakDecks = useMemo(() => {
        const m = new Map();
        for (const c of contents.cards) {
            const k = c.topic || "Untitled deck";
            if (!m.has(k)) m.set(k, { topic: k, total: 0, weak: 0, ready: 0 });
            const d = m.get(k);
            d.total += 1;
            if (contents.weak.includes(c)) d.weak += 1;
            if (isReady(c)) d.ready += 1;
        }
        return [...m.values()].sort((a, b) => b.weak - a.weak || b.ready - a.ready || a.topic.localeCompare(b.topic));
    }, [contents.cards, contents.weak]);

    const TABS = [
        { id: "knowledge", label: "Key knowledge", n: folder.points.length },
        { id: "mistakes", label: "Mistakes", n: contents.mistakes.length + contents.redo.length },
        { id: "answers", label: "Answers", n: contents.answers.length + contents.legacy.length },
        { id: "cards", label: "Weak cards", n: contents.weak.length },
        { id: "mock", label: "Mock exam", n: null },
    ];
    const reviewHref = (topic) => `${createPageUrl("Study")}?tab=spaced_repetition&subject=${encodeURIComponent(folder.subject)}${topic ? `&topic=${encodeURIComponent(topic)}` : ""}`;

    return (
        <div className="space-y-6" data-folder-view={folder.key}>
            <Link to={createPageUrl("Revision")} data-folder-back
                className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" /> Revision
            </Link>

            {/* ── THE HERO ──────────────────────────────────────────────── */}
            <motion.header initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="relative card-soft on-table border-2 border-border rounded-3xl overflow-hidden">
                <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: tone }} />
                <div className="pl-6 pr-5 py-5 sm:pl-8 sm:pr-7 sm:py-7">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="stat-label text-muted-foreground">
                                {folder.subject}{folder.kind === "sac" && folder.type && folder.type !== folder.title ? ` · ${folder.type}` : ""}
                                {/* The date is one unit: a phone wrapped "Thu, Oct" and "29" onto two lines. */}
                                {folder.due ? <> · <span className="whitespace-nowrap">{fmtDue(folder.due)}</span></> : folder.kind === "exam" ? " · the whole course" : ""}
                            </p>
                            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1] mt-1.5">
                                {folder.title}
                            </h1>
                            {lead && <p className="text-sm text-muted-foreground mt-2 leading-snug max-w-xl" data-folder-lead>{lead}</p>}
                        </div>
                        <Countdown days={folder.daysAway} size="lg" />
                    </div>

                    <ReadinessBar r={r} size="lg" legend={r.total > 0} className="mt-5" />

                    {/* A folder with nothing in it shows no drill button at all —
                        a disabled one above the three ways to start is a dead
                        control. Once something is tracked, "nothing ready" is
                        information and the button stays to say it. */}
                    {(r.total > 0 || toTest > 0) && (
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                        <Button onClick={() => onDrill(ready, `Drilling ${folder.title}`)} disabled={!ready.length} data-folder-drill
                            className="btn-3d bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-2">
                            <Play className="w-4 h-4" />
                            {ready.length ? `Drill ${ready.length} ready` : "Nothing ready to drill"}
                        </Button>
                        {/* Offered here only when the checklist is not already
                            on screen with its own Test me under it — two buttons
                            for one sheet, one above the other, is the duplication
                            this app keeps deleting. The mock is a tab, not a
                            button: the tab bar is one row down. */}
                        {toTest > 0 && tab !== "knowledge" && (
                            <Button variant="outline" onClick={() => { onTab("knowledge"); setTestNonce((n) => n + 1); }} disabled={!!checkJob} data-folder-test
                                className="border-2 border-border rounded-xl gap-2 font-bold">
                                <Target className="w-4 h-4" /> Test me on {toTest}
                            </Button>
                        )}
                    </div>
                    )}

                    {folder.kind === "sac" && (
                        <button type="button" onClick={onScope} data-folder-scope
                            className="mt-4 w-full text-left flex items-center gap-2 rounded-xl bg-secondary/60 hover:bg-secondary px-3 py-2 transition-colors">
                            <Tags className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-muted-foreground min-w-0 flex-1 truncate">
                                {folder.topics.length
                                    ? <>Covers <span className="font-bold text-foreground">{folder.topics.join(", ")}</span></>
                                    : <>Covers all of {folder.subject} — <span className="font-bold text-foreground">choose its topics</span></>}
                            </span>
                            <span className="text-xs font-bold text-primary flex-shrink-0">Change</span>
                        </button>
                    )}
                </div>
            </motion.header>

            {/* ── THE TABS: what you do, with what is in each ──────────── */}
            <div ref={strip} onScroll={measure} data-folder-tabs
                style={fade ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
                className="relative -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div role="tablist" className="inline-flex rounded-2xl bg-surface border-2 border-border shadow-soft p-1.5 gap-1 min-w-max">
                    {TABS.map((t) => (
                        <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}
                            data-folder-tab={t.id}
                            className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                                tab === t.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                            {t.label}
                            {t.n > 0 && <span className="tabular-nums opacity-70">{t.n}</span>}
                        </button>
                    ))}
                </div>
            </div>

            {tab === "knowledge" && (
                <KeyKnowledge folder={folder} points={folder.points} proof={proof} profile={profile}
                    readiness={r} checkJob={checkJob} onSave={onSavePoints} onTest={onTest} openTest={testNonce} />
            )}

            {tab === "mistakes" && (
                <div className="space-y-8">
                    {bands.length > 0
                        ? bands.map((band) => (
                            <BankBand key={band.subject} band={band} attempts={attempts}
                                onDrill={(list) => onDrill(list, `Drilling ${folder.title}`)} onClear={onClear} />
                        ))
                        : <Empty>No mistakes banked in {folder.topics.length ? "these topics" : folder.subject} yet. Every mark you drop on a marked quiz can be saved from the marking, and it lands here.</Empty>}
                    {redo.length > 0 && (
                        <section aria-label="Sit again" className="space-y-3">
                            <div className="flex items-center gap-2.5">
                                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                                <h2 className="font-display font-extrabold text-foreground">Sit again</h2>
                                <span className="flex-1 h-px bg-border" aria-hidden="true" />
                            </div>
                            <RedoTab groups={redo} cases={cases} onSit={onSitRedo} />
                        </section>
                    )}
                </div>
            )}

            {tab === "answers" && (
                <AnswerList answers={contents.answers} legacy={contents.legacy} ready={contents.ready.answers}
                    onDrill={(list) => onDrill(list, `Learning ${folder.title}`)} onRetire={onRetire} onDelete={onDeleteAnswer}
                    onMoveLegacy={onMoveLegacy} movingId={movingId}
                    empty={<Empty>No answers saved here yet. When a quiz is marked, save your full-mark answers — or the model answer to one you dropped marks on — and learn them word for word.</Empty>} />
            )}

            {tab === "cards" && (
                weakDecks.length ? (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            <span className="font-bold text-foreground tabular-nums">{contents.weak.length}</span> card{contents.weak.length === 1 ? "" : "s"} slipping
                            across <span className="tabular-nums">{weakDecks.length}</span> deck{weakDecks.length === 1 ? "" : "s"} in this folder.
                        </p>
                        <ul className="space-y-2">
                            {weakDecks.map((d) => (
                                <li key={d.topic} className="rounded-2xl border-2 border-border bg-surface px-3.5 py-3 flex items-center gap-3" data-weak-deck={d.topic}>
                                    <BookOpen className="w-4 h-4 text-chart-3 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-foreground truncate">{d.topic}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {d.weak > 0 ? <span className="text-streak font-bold">{d.weak} slipping</span> : "holding"}
                                            {" · "}{d.total} card{d.total === 1 ? "" : "s"}{d.ready ? ` · ${d.ready} ready` : ""}
                                        </p>
                                    </div>
                                    <Link to={reviewHref(d.topic)} className="text-xs font-bold text-primary hover:underline flex-shrink-0">Review</Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : <Empty>No decks in {folder.topics.length ? "these topics" : folder.subject} yet.</Empty>
            )}

            {tab === "mock" && (
                <div className="card-soft on-table border-2 border-border rounded-2xl p-5 sm:p-6" data-mock>
                    <p className="font-display font-extrabold text-lg text-foreground">A timed paper from this folder</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-snug max-w-lg">
                        Questions drawn from your quizzes, decks and recall sessions in {folder.topics.length ? folder.topics.join(", ") : folder.subject},
                        weighted toward what you keep getting wrong.
                    </p>
                    <p className="text-sm text-foreground mt-3">
                        <span className="font-bold tabular-nums">{mockCount}</span> question{mockCount === 1 ? "" : "s"} to draw from
                    </p>
                    <Button onClick={onMock} disabled={!mockCount} data-mock-start
                        className="btn-3d mt-4 bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-2">
                        <GraduationCap className="w-4 h-4" /> {mockCount ? "Set up the mock" : "Nothing to draw from yet"}
                    </Button>
                </div>
            )}
        </div>
    );
}
