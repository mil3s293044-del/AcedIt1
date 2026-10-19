/**
 * neuroPanel — what the science card says, and what it says while you study.
 *
 * The card was five stacked boxes of prose beside the tool: a paragraph, a
 * five-row list, a chart with a paragraph under it, two more boxes and a
 * source list. Every sentence was true and almost nobody read past the brain.
 * It is three beats now — the brain, the evidence, the catch — at one line
 * each, and everything longer is one tap away rather than gone.
 *
 * ─── Every line still names its source ───────────────────────────────────────
 * The old card kept its citations in a list at the bottom, so no claim on it
 * pointed at anything. Each beat now carries footnote numbers into the same
 * `sources`, and `citesFor` refuses a number that resolves to nothing. A
 * footnote that leads nowhere is the anonymous "studies show" this file's
 * neighbour (neuro.js) was written to refuse.
 *
 * ─── Live means the student's own session, never an invented reading ────────
 * The brain reacts to what the student is doing — a running Pomodoro puts a
 * "you are here" on the attention curve, a break lights the daydreaming
 * network, a rated card or a written answer pulses the regions this card
 * already names. It never measures anything. Nothing here claims to know what
 * THIS student's brain is doing; it shows, at the moment they do the thing,
 * which systems the evidence says that thing uses. The schematic note under
 * the brain says so.
 *
 * Pure, so a test can hold it.
 */
import { TECHNIQUE_NEURO, REGIONS } from "./neuro.js";

/** The shortest gap between two pulses. A burst of edits is one pulse, not six. */
export const PULSE_GAP_MS = 1200;
/** How long a pulse's line stays up before the card goes back to the brief. */
export const PULSE_HOLD_MS = 4000;

/** The beats a footnote can sit on. */
export const BEATS = ["brain", "chart", "catch", "caveat"];

/**
 * The sources a beat cites, resolved — never a dangling number. Each comes
 * back with its 1-based number, which is how the card prints it.
 */
export function citesFor(data, beat) {
    const list = Array.isArray(data?.sources) ? data.sources : [];
    const nums = Array.isArray(data?.cites?.[beat]) ? data.cites[beat] : [];
    return nums
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= list.length)
        .map((n) => ({ n, ...list[n - 1] }));
}

/** The source behind the utility badge — only ever Dunlosky's review. */
export function utilityCite(data) {
    if (!data?.utility) return null;
    const list = Array.isArray(data.sources) ? data.sources : [];
    const i = list.findIndex((s) => /Dunlosky/.test(s?.ref || ""));
    return i < 0 ? null : { n: i + 1, ...list[i] };
}

/** The chips under the brain: short name, colour, and the one-line gist. */
export function regionChips(data) {
    return (Array.isArray(data?.regions) ? data.regions : [])
        .filter((r) => REGIONS[r.id])
        .map((r) => ({
            id: r.id,
            tone: r.tone,
            label: REGIONS[r.id].short,
            name: REGIONS[r.id].name,
            gist: r.gist || r.role,
        }));
}

/* ── The Pomodoro, live ─────────────────────────────────────────────────── */

/**
 * Where a running timer sits on the attention curve.
 *
 * `state` is what PomodoroTimer broadcasts (`timerStateChanged`). It needs the
 * block's TOTAL as well as what is left — elapsed is derived, and a total that
 * is missing means there is nothing honest to place, so it is null rather
 * than a guess at 25 minutes. Minutes are FLOORED: "12 min in" at 12:59 is
 * true, "13 min in" is not yet.
 *
 * The chart only runs to its last x, so a block longer than the study's fifty
 * minutes sits at the end of the axis with a "+" rather than off the chart.
 */
export function pomodoroLive(state, chart) {
    if (!state || !state.isActive) return null;
    // `Number(null)` is 0, which would read a missing remainder as a block
    // run to its end. Absent is absent.
    if (state.total == null || state.timeLeft == null) return null;
    const total = Number(state.total);
    const left = Number(state.timeLeft);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(left)) return null;
    const elapsed = Math.max(0, Math.min(total, total - left));
    const minute = Math.floor(elapsed / 60);
    const paused = !state.isRunning;
    if (state.isBreak) {
        return { phase: "break", paused, minute: null, x: null, label: null };
    }
    const xs = Array.isArray(chart?.x) ? chart.x : [];
    const lo = xs.length ? xs[0] : 0;
    const hi = xs.length ? xs[xs.length - 1] : 50;
    const past = minute > hi;
    return {
        phase: "focus",
        paused,
        minute,
        x: Math.max(lo, Math.min(hi, minute)),
        label: past ? `You · ${hi}+ min` : `You · ${minute} min`,
    };
}

/** The line under the brain for a running Pomodoro. */
export function pomodoroLine(live, data) {
    if (!live) return null;
    if (live.phase === "break") return data?.breakLine || null;
    if (live.paused) return `Paused ${live.minute} min into this block.`;
    return live.minute === 0
        ? "Block started. You are on the curve below."
        : `${live.minute} min into this block. Breaks before you fade keep the curve flat.`;
}

/** Which regions the brain shows lit while the timer is on a break. */
export function breakFocus(live, data) {
    if (live?.phase !== "break") return null;
    const ids = (data?.breakRegions || []).filter((id) => REGIONS[id]);
    return ids.length ? ids : null;
}

/* ── Every other technique: a pulse when the work happens ──────────────── */

/**
 * The line a pulse prints, built only from regions this card already names:
 * "Recall · Hippocampus + vlPFC". A technique with no `live` config pulses
 * nothing rather than borrowing another technique's regions.
 */
export function pulseFor(techniqueId, table = TECHNIQUE_NEURO) {
    const data = table?.[techniqueId];
    const live = data?.live;
    if (!live?.line || !Array.isArray(live.regions)) return null;
    const named = new Set((data.regions || []).map((r) => r.id));
    const ids = live.regions.filter((id) => named.has(id) && REGIONS[id]);
    if (!ids.length) return null;
    return { ids, line: `${live.line} · ${ids.map((id) => REGIONS[id].short).join(" + ")}` };
}

/** Whether a signal arriving `now` should pulse, given the last pulse. */
export function shouldPulse(lastAt, now, gap = PULSE_GAP_MS) {
    if (!Number.isFinite(now)) return false;
    if (!Number.isFinite(lastAt)) return true;
    return now - lastAt >= gap;
}

/**
 * What the line under the brain says right now, in priority order: a pulse
 * that is still fresh, then a region the student picked (they asked), then a
 * running timer, then the technique's own brief. Each line carries the beat
 * whose sources back it, so its footnote points at the right paper: the
 * timer's "breaks keep the curve flat" is the CHART's study, everything else
 * is the brain's.
 */
export function brainLine({ data, picked = null, live = null, pulse = null, now = Date.now() } = {}) {
    if (pulse && Number.isFinite(pulse.at) && now - pulse.at < PULSE_HOLD_MS && pulse.line) {
        return { kind: "pulse", text: pulse.line, beat: "brain" };
    }
    if (picked) {
        const chip = regionChips(data).find((c) => c.id === picked);
        if (chip) return { kind: "region", text: chip.gist, label: chip.name, beat: "brain" };
    }
    const timer = pomodoroLine(live, data);
    if (timer) return { kind: "live", text: timer, beat: live.phase === "focus" ? "chart" : "brain" };
    return data?.brief ? { kind: "brief", text: data.brief, beat: "brain" } : null;
}

export default {
    PULSE_GAP_MS, PULSE_HOLD_MS, BEATS, citesFor, utilityCite, regionChips,
    pomodoroLive, pomodoroLine, breakFocus, pulseFor, shouldPulse, brainLine,
};
