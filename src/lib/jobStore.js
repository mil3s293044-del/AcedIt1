/**
 * jobStore — where a creation lives while it is being made, so that leaving
 * the page does not leave it behind. See aiJobs.js for why.
 *
 * A module, not a provider: a module survives every route change by
 * construction, and the page that started a job is exactly the thing that
 * goes away. Pages and the floating card read it through `useJobs`.
 *
 * ─── HOLD FOR REVIEW ────────────────────────────────────────────────────────
 * A job that finishes while a page is SHOWING it hands straight back to that
 * page (`useJobView`), which does what it always did. One that finishes
 * anywhere else is held: the card turns to "Ready", and the result waits for
 * the student to open it. Nothing new saves itself. A quiz was already saved
 * by its generator and still is; a deck keeps its Save Deck step; an Active
 * Recall set keeps its Start.
 *
 * A held result is kept in sessionStorage, so a reload does not lose it. A job
 * still RUNNING cannot survive a reload — it is a request in this tab — so the
 * card asks before the tab closes.
 *
 * Every job holds the app still while it runs (`BUSY.AI`). `invokeLLM` already
 * claims that around the model call, but a job is longer than its model call:
 * uploading the files before it and saving after it are both work an update
 * reload would destroy.
 */
import { useSyncExternalStore, useEffect, useRef, useState } from "react";
import { globalBusy, BUSY } from "@/lib/liveRefresh";
import { laneOf, runningIn, watchStep } from "@/lib/aiJobs";

const KEY = "acedit.jobs.v1";

let jobs = restore();
// Two different things a page can be doing about a lane, counted separately:
// DRAWING its job's progress where the student can see it (the card stands
// down for a running job), and WATCHING it (it will take the result when it
// settles, so the card must not flash "Ready" for the frame in between).
const counts = { display: new Map(), watch: new Map() };
let lanes = { displayed: [], watched: [] };
const listeners = new Set();

function restore() {
    try {
        const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(KEY) : null;
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list.filter((j) => j && j.status === "ready") : [];
    } catch { return []; }
}

function persist() {
    try {
        if (typeof sessionStorage === "undefined") return;
        const held = jobs.filter((j) => j.status === "ready");
        if (held.length) sessionStorage.setItem(KEY, JSON.stringify(held));
        else sessionStorage.removeItem(KEY);
    } catch { /* blocked storage: the held result lasts this page load */ }
}

function emit() {
    persist();
    listeners.forEach((fn) => fn());
}

function patch(id, changes) {
    let changed = false;
    jobs = jobs.map((j) => {
        if (j.id !== id) return j;
        changed = true;
        return { ...j, ...changes };
    });
    if (changed) emit();
}

function remove(id) {
    const before = jobs.length;
    jobs = jobs.filter((j) => j.id !== id);
    if (jobs.length !== before) emit();
}

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getJobs = () => jobs;
export const getLanes = () => lanes;

/**
 * Starts a job and returns the handle its generator reports through.
 *
 * `spec`: kind, title, email (whose it is), total (how many were asked for,
 * or null), files (how many are being uploaded), openTo (where "Open" goes).
 */
export function startJob(spec) {
    const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const files = Math.max(0, Number(spec.files) || 0);
    const job = {
        id,
        kind: spec.kind,
        title: spec.title,
        email: spec.email || null,
        total: spec.total ?? null,
        files,
        filesDone: 0,
        items: 0,
        stage: files > 0 ? "upload" : "read",
        status: "running",
        openTo: spec.openTo || null,
        startedAt: Date.now(),
    };
    // A finished job of the same lane is replaced: a second deck made while the
    // first waits is the newer answer, and two "Ready" cards for one screen
    // would disagree about which one Open opens.
    jobs = [...jobs.filter((j) => laneOf(j.kind) !== laneOf(spec.kind) || j.status === "running"), job];
    emit();
    const claim = globalBusy.acquire(BUSY.AI);
    let settled = false;
    const settle = () => { if (!settled) { settled = true; globalBusy.release(claim); } };

    return {
        id,
        fileDone() {
            const cur = jobs.find((j) => j.id === id);
            if (cur) patch(id, { filesDone: Math.min(cur.files, cur.filesDone + 1) });
        },
        stage(stage) { patch(id, { stage }); },
        /** What the server reports: a stage, and how many items have closed. */
        progress({ stage, items } = {}) {
            const changes = {};
            if (stage) changes.stage = stage;
            if (Number.isFinite(items)) changes.items = items;
            patch(id, changes);
        },
        /**
         * Finished: held, with `result` kept for whichever page takes it — the
         * one watching it (`useJobView`), or the one Open lands on.
         */
        ready({ note, openTo, items, result } = {}) {
            settle();
            patch(id, {
                status: "ready", stage: "finish",
                note: note || null,
                ...(openTo ? { openTo } : {}),
                ...(Number.isFinite(items) ? { items } : {}),
                result: result ?? null,
                finishedAt: Date.now(),
            });
        },
        /** Failed. Held the same way, so the reason reaches somebody. */
        fail(message) {
            settle();
            patch(id, { status: "failed", error: message || null, finishedAt: Date.now() });
        },
    };
}

export const dismissJob = (id) => remove(id);

/**
 * A page taking a held result back: the job leaves the card and its result is
 * handed over. Null when there is nothing ready in that lane for this student.
 */
export function adoptJob(kind, email) {
    const lane = laneOf(kind);
    const job = jobs.find((j) => j.status === "ready" && laneOf(j.kind) === lane && (!email || !j.email || j.email === email));
    if (!job) return null;
    remove(job.id);
    return job;
}

/** Takes one job by id, whatever its state. */
export function takeJob(id) {
    const job = jobs.find((j) => j.id === id) || null;
    if (job) remove(id);
    return job;
}

/** Every job, live. */
export function useJobs() {
    return useSyncExternalStore(subscribe, getJobs, getJobs);
}

/** Which lanes pages are drawing and watching, live. */
export function useLanes() {
    return useSyncExternalStore(subscribe, getLanes, getLanes);
}

/** The job running in this kind's lane, live — what disables a second generate. */
export function useRunningJob(kind) {
    return runningIn(useJobs(), kind);
}

/**
 * Claims are COUNTED, not a set: two mounts of one page across a route change
 * would otherwise release each other (the Ace stage learned this one).
 * Returns the release.
 */
function claim(which, kind) {
    const lane = laneOf(kind);
    const map = counts[which];
    map.set(lane, (map.get(lane) || 0) + 1);
    syncLanes();
    let released = false;
    return () => {
        if (released) return;
        released = true;
        map.set(lane, Math.max(0, (map.get(lane) || 0) - 1));
        syncLanes();
    };
}

function syncLanes() {
    const live = (map) => [...map.entries()].filter(([, n]) => n > 0).map(([l]) => l);
    lanes = { displayed: live(counts.display), watched: live(counts.watch) };
    emit();
}

/** A bar for this lane's job is on screen: the card stands down while it runs. */
export const claimDisplay = (kind) => claim("display", kind);
/** A page will take this lane's job when it settles. */
export const claimWatch = (kind) => claim("watch", kind);

export function useJobDisplay(kind, active) {
    useEffect(() => (active ? claimDisplay(kind) : undefined), [kind, active]);
}

/**
 * The bar is on screen — not merely mounted. A skeleton below the fold, or
 * scrolled out of a dialog, is a page that LOOKS idle, and standing the card
 * down for it is the failure the card exists to end.
 */
export function useOnScreen(ref) {
    const [on, setOn] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === "undefined") { setOn(!!el); return undefined; }
        const io = new IntersectionObserver(([entry]) => setOn(entry.isIntersecting), { threshold: 0 });
        io.observe(el);
        return () => io.disconnect();
    }, [ref]);
    return on;
}

/**
 * A page that can show a lane's job itself. `show` says whether it is in a
 * state to (a dialog open, a tab mounted) — a boolean, or a function of the
 * running job for a page that shows only one kind in a shared lane. When the
 * job it was showing settles, `onSettled(job)` gets it, ready or failed, and
 * it leaves the store. Whether the card stands down WHILE it runs is a
 * separate question: the page's bar has to be on screen (`JobBar claims`).
 *
 * Returns the running job in the lane, which is what the page's own button and
 * skeleton read.
 */
export function useJobView(kind, { show = true, onSettled } = {}) {
    const jobs = useJobs();
    const running = runningIn(jobs, kind);
    const showing = !!running && (typeof show === "function" ? !!show(running) : !!show);
    const watched = useRef(null);
    const settledRef = useRef(onSettled);
    settledRef.current = onSettled;

    useEffect(() => (showing ? claimWatch(kind) : undefined), [kind, showing]);
    useEffect(() => {
        const step = watchStep({ jobs, watched: watched.current, showing, running });
        watched.current = step.watched;
        if (step.settle && takeJob(step.settle.id)) settledRef.current?.(step.settle);
    }, [jobs, showing, running]);
    return running;
}

/** For tests: back to nothing. */
export function __resetJobs() {
    jobs = [];
    counts.display.clear();
    counts.watch.clear();
    syncLanes();
}
