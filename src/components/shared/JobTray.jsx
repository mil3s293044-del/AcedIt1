/**
 * JobTray — the card that follows a student around while a quiz, a deck or a
 * set of questions is being made, so leaving the page does not mean losing
 * track of it. The model is aiJobs.js; the jobs live in jobStore.js.
 *
 * ─── WHERE IT SITS ──────────────────────────────────────────────────────────
 * Bottom LEFT on a laptop, clear of the side rail, because the right-hand
 * corner is Ace's launcher and the toasts'. On a phone it sits on the bottom
 * nav and stops short of Ace's corner (`right-4 bottom-24`, 64px wide), the
 * clearance MyRowDock already learned. The floating pomodoro starts top right.
 *
 * ─── WHAT IT SAYS ───────────────────────────────────────────────────────────
 * The title (what is being made), a bar that fills on a COUNT, and one line:
 * the stage, the count, and — once it is ready — the action. Nothing here is
 * timed. Before there is anything to count the bar holds still and a sheen
 * passes over it, and the line says which wait it is.
 *
 * A finished job is HELD, never saved behind the student's back: "Ready", and
 * Open takes them to the page that shows it. The page adopts the job from the
 * store when it gets there.
 */
import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Layers, ListChecks, Brain, X, ChevronRight, AlertCircle } from "lucide-react";
import { jobFill, jobLine, trayJobs } from "@/lib/aiJobs";
import { useJobs, useLanes, dismissJob, useJobDisplay, useOnScreen } from "@/lib/jobStore";

const GLYPH = { quiz: ListChecks, reshuffle: ListChecks, check: ListChecks, flashcards: Layers, recall: Brain };

/**
 * The bar and its line, shared with the page's own skeleton so the two can
 * never say different things about one job.
 *
 * `claims`: a page's own bar stands the floating card down — but only while it
 * is ON SCREEN. The deck screen's skeleton sat under a warm-up quiz, below the
 * fold at a laptop's height, and a mounted-but-unseen bar hiding the card left
 * a student looking at a page that seemed to be doing nothing.
 */
export function JobBar({ job, className = "", claims = false }) {
    const reduce = useReducedMotion();
    const ref = useRef(null);
    const onScreen = useOnScreen(ref);
    useJobDisplay(job?.kind || "quiz", claims && onScreen && job?.status === "running");
    const { fill, counting } = jobFill(job);
    const failed = job?.status === "failed";
    return (
        <div ref={ref} className={`relative h-1.5 w-full rounded-full bg-secondary overflow-hidden ${className}`}
            role="progressbar" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(fill * 100)} aria-valuetext={jobLine(job).detail || jobLine(job).status}>
            <motion.div
                className={`absolute inset-y-0 left-0 w-full origin-left rounded-full ${failed ? "bg-streak" : "bg-primary"}`}
                initial={false}
                animate={{ scaleX: fill }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 26 }}
            />
            {!counting && !failed && job?.status === "running" && <span className="job-sheen" aria-hidden />}
        </div>
    );
}

/** One job, as the floating card draws it. Exported for the probe. */
export function JobCard({ job, onOpen }) {
    const reduce = useReducedMotion();
    const line = jobLine(job);
    const Glyph = job.status === "failed" ? AlertCircle : (GLYPH[job.kind] || ListChecks);
    const ready = job.status === "ready";
    const failed = job.status === "failed";
    const finished = ready || failed;

    return (
        <motion.div
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="pointer-events-auto card-soft on-table bg-surface border-2 border-border rounded-2xl px-3.5 py-3 w-full"
            role="status" aria-live="polite" data-job={job.kind} data-job-status={job.status}
        >
            <div className="flex items-center gap-2 min-w-0">
                <Glyph className={`w-4 h-4 flex-shrink-0 ${failed ? "text-streak" : "text-primary"}`} aria-hidden />
                <span className="flex-1 min-w-0 truncate font-display font-extrabold text-sm text-foreground">
                    {line.title}
                </span>
                {finished && (
                    <button type="button" onClick={() => dismissJob(job.id)}
                        className="-mr-1 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        aria-label={ready ? "Hide this — it stays where it was made" : "Dismiss"}>
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* A failure has nothing to measure, so it draws no bar: an empty
                track under "Couldn't finish" reads as a job about to start. */}
            {!failed && (
                <div className="flex items-center gap-2.5 mt-2">
                    <JobBar job={job} className="flex-1" />
                    {line.detail && (
                        <span className="text-xs font-bold text-foreground tabular-nums whitespace-nowrap">{line.detail}</span>
                    )}
                </div>
            )}

            <div className={`flex items-center gap-1.5 text-xs min-w-0 ${failed ? "mt-1" : "mt-1.5"}`}>
                <span className={`min-w-0 ${failed ? "text-streak font-bold" : ready ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {line.status}
                </span>
                {ready && line.action && job.openTo && (
                    <>
                        <span className="text-muted-foreground" aria-hidden>·</span>
                        <button type="button" onClick={() => onOpen(job)}
                            className="inline-flex items-center gap-0.5 font-bold text-foreground hover:text-primary transition-colors"
                            data-job-open>
                            {line.action}<ChevronRight className="w-3.5 h-3.5" aria-hidden />
                        </button>
                    </>
                )}
            </div>
            {/* A failure's reason gets its own lines: it is the one thing on the
                card a student needs to read in full to know what to do next. */}
            {failed && line.detail && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{line.detail}</p>
            )}
            {ready && line.note && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{line.note}</p>
            )}
        </motion.div>
    );
}

export default function JobTray({ email }) {
    const navigate = useNavigate();
    const jobs = useJobs();
    const { displayed, watched } = useLanes();
    const shown = trayJobs(jobs, { email, displayed, watched });
    const running = jobs.some((j) => j.status === "running" && (!email || !j.email || j.email === email));

    // A job still RUNNING is a request in this tab: a reload or a closed tab
    // ends it, and the card cannot follow anybody there. So the browser asks
    // first. A held result does not need this — it is kept across a reload.
    useEffect(() => {
        if (!running) return undefined;
        const warn = (e) => { e.preventDefault(); e.returnValue = ""; return ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [running]);

    const open = (job) => navigate(job.openTo);

    return (
        <div className="fixed z-30 pointer-events-none flex flex-col-reverse gap-2
            left-4 right-24 bottom-[5.25rem]
            md:right-auto md:left-[5.5rem] md:bottom-6 md:w-80"
            data-job-tray>
            <AnimatePresence initial={false}>
                {shown.map((job) => <JobCard key={job.id} job={job} onOpen={open} />)}
            </AnimatePresence>
        </div>
    );
}
