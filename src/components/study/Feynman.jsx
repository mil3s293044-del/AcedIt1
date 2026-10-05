/**
 * Feynman — explain it simply, find the holes, say it again.
 *
 * ─── IT IS A LOOP OF PASSES, NOT A CHAT, AND THAT IS THE COST DESIGN ────────
 * `src/lib/feynman.js` carries the whole argument: a conversational teach-back
 * is N model calls and ~80 chips of a 1,000-chip week, and Feynman's actual
 * method is four steps of which exactly one needs a model. So: one paid pass to
 * raise the questions, a cheap pinned-to-Haiku pass to decide which the rewrite
 * answered, and everything else — the jargon ribbon, the reading level, the
 * before/after — computed locally for nothing.
 *
 * ─── FIVE PHASES, AND THE REWRITE RETURNS TO THE SAME BOARD ─────────────────
 *   setup    the shared setup card, exactly as Active Recall and Blurting use
 *   board    the blackboard
 *   gaps     the questions, underlined in place
 *   board    again, with the open questions pinned beside it — the LOOP
 *   close    your first draft against your last, which costs nothing because
 *            both are already in hand
 *
 * ─── THE SESSION LOGS ON THE FIRST PASS ─────────────────────────────────────
 * The same boundary blurting uses and mind maps now use: the moment the student
 * asks to be checked is the moment there is something to measure. A draft
 * written and abandoned logs nothing, because nothing was tested.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AceLoading } from "@/components/ace/AceShuffle";
import WhatToTest from "./WhatToTest";
import FeynmanBoard from "./FeynmanBoard";
import FeynmanGaps from "./FeynmanGaps";
import {
    AUDIENCES, audienceOf, readGaps, applyRecheck, openGaps, progressOf,
    FEYNMAN_FEATURE, RECHECK_FEATURE, WORK_MAX,
} from "@/lib/feynman";
import {
    feynmanSystem, explainPrompt, GAPS_SCHEMA, recheckPrompt, RECHECK_SCHEMA,
} from "@/lib/feynmanPrompt";
import { keyTermsFor } from "@/lib/subjectExaminerPrompts";
import { priceOf } from "@/lib/chips";
import { SESSION_MAX_MINUTES } from "@/lib/integrity";

export default function Feynman({
    // A subject the link arrived on — the brief's slipping card names one, and
    // making the student pick it again would be the half-wired shape this app
    // keeps meeting.
    initialSubject = null,
    onSessionComplete = null,
    userSubjects = [],
    flashcards = [],
    assessments = [],
    techniques = [],
}) {
    const { toast } = useToast();
    const [phase, setPhase] = useState("setup");
    const [subject, setSubject] = useState(initialSubject || "");
    const [topic, setTopic] = useState("");
    const [audience, setAudience] = useState(audienceOf().id);

    const [text, setText] = useState("");
    const [firstDraft, setFirstDraft] = useState("");
    const [gaps, setGaps] = useState(null);
    const [busy, setBusy] = useState(false);
    const [focus, setFocus] = useState(false);
    const [passes, setPasses] = useState(0);

    const started = useRef(null);
    // A pick arrives in the same tick that sets the subject, so a handler
    // reading state would build the session for whatever was selected BEFORE
    // they picked — the trap `startFromSuggestion` records.
    const picked = useRef(null);

    const terms = useMemo(() => keyTermsFor(subject), [subject]);
    // Terms no pass has raised. Empty before the first one, which is the honest
    // state: a term is unproven until something has judged it.
    const cleared = useMemo(() => {
        if (!gaps) return [];
        const flagged = new Set(
            gaps.filter((g) => g.kind === "jargon" && !g.closed)
                .map((g) => g.quote.toLowerCase())
        );
        return terms.filter((t) => !flagged.has(t.toLowerCase()));
    }, [gaps, terms]);

    useEffect(() => {
        if (phase === "board" && started.current == null) started.current = Date.now();
    }, [phase]);

    const begin = useCallback((s, t) => {
        setSubject(s || "");
        setTopic(t || "");
        setText("");
        setFirstDraft("");
        setGaps(null);
        setPasses(0);
        started.current = Date.now();
        setPhase("board");
    }, []);

    const startFromSuggestion = useCallback((pick) => {
        picked.current = pick;
        begin(pick.subject, pick.topic);
    }, [begin]);

    /* ── The paid pass ───────────────────────────────────────────────────── */

    const check = useCallback(async () => {
        if (busy) return;
        setBusy(true);
        setFocus(false);
        const body = text.slice(0, WORK_MAX);
        try {
            const res = await base44.integrations.Core.InvokeLLM({
                feature: FEYNMAN_FEATURE,
                // A SYSTEM BLOCK, shared with the marker, so this reads the
                // cache entry a marking call warmed rather than paying for a
                // preamble of its own. markingPrompt.js's rule.
                system: feynmanSystem(subject),
                prompt: explainPrompt(body, { subject, topic, audience, terms }),
                response_json_schema: GAPS_SCHEMA,
            });
            const out = readGaps(res?.data ?? res, { work: body });
            setGaps(out.gaps);
            if (!firstDraft) setFirstDraft(body);
            setPasses((n) => n + 1);
            setPhase("gaps");
            logSession(body, out.gaps);
        } catch (e) {
            // NOTHING IS INVENTED TO FILL THE SCREEN. The draft stays exactly
            // where it was and they can press again — the refusal `firstWin`
            // makes about fabricating a question to keep a flow moving.
            toast({
                title: "The check did not come back",
                description: String(e?.message || "").slice(0, 160) || "Your explanation is safe — try again in a moment.",
                variant: "destructive",
            });
        } finally { setBusy(false); }
    }, [busy, text, subject, topic, audience, terms, firstDraft, toast]);

    /* ── The cheap pass. It may only CLOSE. ──────────────────────────────── */

    const recheck = useCallback(async () => {
        if (busy || !gaps) return;
        const open = openGaps(gaps);
        if (!open.length) { setPhase("close"); return; }
        setBusy(true);
        try {
            const res = await base44.integrations.Core.InvokeLLM({
                feature: RECHECK_FEATURE,
                system: feynmanSystem(subject),
                prompt: recheckPrompt(text.slice(0, WORK_MAX), open),
                response_json_schema: RECHECK_SCHEMA,
            });
            const data = res?.data ?? res;
            const still = Array.isArray(data?.still_open) ? data.still_open : null;
            // A pass that answered with nothing usable changes NOTHING. Reading
            // an unparseable reply as "all clear" hands the student the one
            // outcome this screen exists to make them earn.
            if (!still) {
                toast({ title: "The re-check did not come back", description: "Nothing was changed." });
                return;
            }
            const before = openGaps(gaps).length;
            const next = applyRecheck(gaps, still);
            setGaps(next);
            setPasses((n) => n + 1);
            const closed = before - openGaps(next).length;
            toast({
                title: closed > 0 ? `${closed} answered` : "Still open",
                description: closed > 0
                    ? "Re-read against your rewrite."
                    : "The rewrite does not answer these yet.",
            });
            setPhase("gaps");
        } catch {
            toast({ title: "The re-check did not come back", description: "Nothing was changed." });
        } finally { setBusy(false); }
    }, [busy, gaps, text, subject, toast]);

    /* ── The session ─────────────────────────────────────────────────────── */

    const logSession = useCallback((body, list) => {
        if (!onSessionComplete || !started.current) return;
        const mins = Math.min(
            SESSION_MAX_MINUTES,
            Math.max(1, Math.floor((Date.now() - started.current) / 60000))
        );
        started.current = Date.now();
        const prog = progressOf(list || []);
        onSessionComplete({
            technique_name: "feynman",
            session_duration: mins,
            subject: subject || null,
            topic: topic || "Feynman",
            notes: `Explained ${(body || "").split(/\s+/).filter(Boolean).length} words to ${
                audienceOf(audience).short}. ${prog.total} question${prog.total === 1 ? "" : "s"} raised.`,
            date: format(new Date(), "yyyy-MM-dd"),
        })?.catch?.(() => {});
    }, [onSessionComplete, subject, topic, audience]);

    const toggleGap = useCallback((id) => {
        setGaps((list) => (list || []).map((g) => (g.id === id ? { ...g, closed: !g.closed } : g)));
    }, []);

    const reset = useCallback(() => {
        setPhase("setup"); setText(""); setFirstDraft(""); setGaps(null); setPasses(0);
        started.current = null; setFocus(false);
    }, []);

    /* ── Screens ─────────────────────────────────────────────────────────── */

    if (phase === "board") {
        return (
            <>
                {busy && (
                    <div className="fixed inset-0 z-[10001] bg-[#0A121F]/80 flex items-center justify-center">
                        <AceLoading variant="think">Reading your explanation…</AceLoading>
                    </div>
                )}
                <FeynmanBoard
                    value={text}
                    onChange={setText}
                    terms={terms}
                    audience={audience}
                    topic={topic || subject}
                    cleared={cleared}
                    pinned={gaps ? gaps : []}
                    onPinnedToggle={toggleGap}
                    focus={focus}
                    onToggleFocus={() => setFocus((f) => !f)}
                    onCheck={gaps ? recheck : check}
                    busy={busy}
                    checkLabel={gaps ? "Check the rewrite" : "Find the gaps"}
                    priceLabel={`${priceOf(gaps ? RECHECK_FEATURE : FEYNMAN_FEATURE)} chips${
                        gaps ? " — the re-check runs on the fast model" : ""}`}
                />
            </>
        );
    }

    if (phase === "gaps" && gaps) {
        return (
            <div className="space-y-4">
                <button type="button" onClick={reset}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-3.5 h-3.5" /> New explanation
                </button>
                <FeynmanGaps
                    work={text}
                    gaps={gaps}
                    onToggle={toggleGap}
                    onRewrite={() => setPhase("board")}
                    onRecheck={passes > 0 && text !== firstDraft ? recheck : null}
                    onFinish={() => setPhase("close")}
                    busy={busy}
                    recheckLabel={`A re-check costs ${priceOf(RECHECK_FEATURE)} chips and runs on the fast model — it can only tick questions off, never add new ones.`}
                />
            </div>
        );
    }

    if (phase === "close") {
        const prog = progressOf(gaps || []);
        return (
            <div className="max-w-4xl mx-auto space-y-4">
                <div className="card-soft p-5 sm:p-6">
                    <p className="stat-label text-muted-foreground">Where it got to</p>
                    <h3 className="font-display font-extrabold text-foreground text-xl sm:text-2xl leading-tight mt-1">
                        {prog.total === 0
                            ? "It held up first time."
                            : `${prog.closed} of ${prog.total} question${prog.total === 1 ? "" : "s"} answered.`}
                    </h3>
                </div>
                {/* ── THE DIFF IS THE PAYOFF, AND IT COSTS NOTHING ──────────
                    Both versions are already in hand. Your own words, before
                    and after — which is far more convincing than a score, and
                    is the one artefact this technique produces that a student
                    would show somebody. */}
                {firstDraft && firstDraft !== text && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[["First go", firstDraft, "border-border"], ["After the questions", text, "border-berry/35"]]
                            .map(([label, body, border]) => (
                                <motion.div key={label}
                                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                    className={`rounded-2xl border-2 ${border} bg-surface p-4`}>
                                    <p className="stat-label text-muted-foreground mb-2">{label}</p>
                                    <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
                                        {body}
                                    </p>
                                </motion.div>
                            ))}
                    </div>
                )}
                <div className="flex flex-wrap gap-2">
                    <Button onClick={reset} className="bg-berry hover:bg-berry/90 text-white font-bold">
                        Explain something else
                    </Button>
                </div>
            </div>
        );
    }

    /* ── Setup: ONE card, the shared one ─────────────────────────────────── */
    return (
        <div className="card-soft p-5 sm:p-6 max-w-3xl mx-auto space-y-5">
            <WhatToTest
                flashcards={flashcards}
                assessments={assessments}
                techniques={techniques}
                onPick={startFromSuggestion}
                verb="Explain"
            />

            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="stat-label text-muted-foreground block mb-1.5">Subject</label>
                        <select
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full h-10 rounded-xl border-2 border-border bg-surface px-3 text-sm"
                        >
                            <option value="">Pick a subject</option>
                            {userSubjects.map((s) => (
                                <option key={s.subject_name} value={s.subject_name}>{s.subject_name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="stat-label text-muted-foreground block mb-1.5">What are you explaining?</label>
                        <Input
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g. why entropy increases"
                            className="h-10 rounded-xl border-2"
                        />
                    </div>
                </div>

                {/* ── THE AUDIENCE IS A REAL INPUT ───────────────────────────
                    It sets the bar the pass judges against, so it changes the
                    exercise rather than decorating it. Three chips with the
                    middle one already chosen, so the common path costs no
                    decision at all. */}
                <div>
                    <label className="stat-label text-muted-foreground block mb-1.5">Explaining it to</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {AUDIENCES.map((a) => (
                            <button
                                key={a.id}
                                type="button"
                                onClick={() => setAudience(a.id)}
                                className={`rounded-xl border-2 p-2.5 text-left transition-colors ${
                                    a.id === audience
                                        ? "border-berry/50 bg-berry/10"
                                        : "border-border bg-surface hover:border-muted-foreground/40"}`}
                            >
                                <span className={`block text-[13px] font-bold ${
                                    a.id === audience ? "text-berry" : "text-foreground"}`}>{a.label}</span>
                                <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">
                                    {a.note}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <Button
                    onClick={() => begin(subject, topic)}
                    disabled={!subject}
                    className="w-full bg-berry hover:bg-berry/90 text-white font-bold gap-2 h-11"
                >
                    <Sparkles className="w-4 h-4" /> Start explaining
                </Button>
                {!subject && (
                    <p className="text-xs text-muted-foreground text-center">
                        Pick a subject — the questions come from its VCAA study design.
                    </p>
                )}
            </div>
        </div>
    );
}
