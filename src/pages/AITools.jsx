/**
 * AI Tools — a scan, a readout, and the tool that clears each fault.
 *
 * ─── THE PAGE ANSWERS THE QUESTION IT USED TO ASK ───────────────────────────
 * This was nine personas behind a dropdown, then eight verbs on a "bench". Both
 * opened by asking the student the two hardest parts of the job: which tool
 * solves this, and what exactly is wrong. A student who can answer the second
 * rarely needs the first.
 *
 * So it answers it. The work is scanned once against the VCAA conventions for
 * that subject, every fault is located and named, and each one carries the tool
 * that repairs it — `src/lib/diagnostic.js` is the whole model and its header
 * carries the argument.
 *
 * ─── THREE STATES ───────────────────────────────────────────────────────────
 *   INTAKE   what are we checking, and the two optional facts (the question,
 *            the marks) that decide what the scan may report.
 *   READOUT  the faults on the trace, the work underlined where they anchored.
 *   REPAIR   one fault, open as a conversation in the real `UnifiedChat`.
 *
 * ─── THE SCAN IS FREE TO FIND NOTHING ───────────────────────────────────────
 * The most important property on the page. A scan that always finds five faults
 * is a horoscope, and the first good paragraph told it is broken costs every
 * later finding its credibility too. `readScan` returns an empty list happily
 * and the readout has a real screen for it.
 *
 * ─── AND A FAILED SCAN IS NOT A FAULT ───────────────────────────────────────
 * Out of chips, a call that does not come back, a response with nothing usable:
 * each says so and leaves the work on screen to try again. It never invents a
 * finding to fill the readout, which is the refusal `firstWin` already makes
 * about fabricating a question to keep a flow moving.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import UnifiedChat from "@/components/ai_tools/UnifiedChat";
import Readout from "@/components/ai_tools/Readout";
import ScanIntake from "@/components/ai_tools/ScanIntake";
import AceShuffle, { AceLoading } from "@/components/ace/AceShuffle";
import { useToast } from "@/components/ui/use-toast";
import { isPremium } from "@/lib/tierAccess";
import { candidates } from "@/lib/workpieceSources";
import { makeWorkpiece } from "@/lib/workpiece";
import { benches } from "@/lib/bench";
import { loadSavedResults } from "@/lib/saveResult";
import { deckCards, isBankCard } from "@/lib/mistakeBank";
import { isReady, todayISO } from "@/lib/due";
import {
    readScan, applyRescan, setCleared, openKeys, repairSeed,
    SCAN_FEATURE, FAULTS,
} from "@/lib/diagnostic";
import { scanSystem, scanPrompt, SCAN_SCHEMA, rescanPrompt, RESCAN_SCHEMA } from "@/lib/diagnosticPrompt";

export default function AITools() {
    const { toast } = useToast();
    // `undefined` while it loads, so nothing decides before the profile lands.
    const [premium, setPremium] = useState(undefined);
    const [rows, setRows] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [convs, setConvs] = useState([]);

    // The run. None of it is persisted: findings are derived from one call and
    // the REPAIRS are what persist, because they are conversations and
    // `UnifiedChat` already saves those.
    const [work, setWork] = useState(null);
    const [findings, setFindings] = useState(null);
    const [busy, setBusy] = useState(false);
    const [repair, setRepair] = useState(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const u = await base44.auth.me();
                // Each read catches for itself: one unreadable table must not
                // discard the other five and leave the intake looking like an
                // account with no history at all.
                const [profiles, flashcards, attempts, quizzes, assessments, saved, subs] = await Promise.all([
                    base44.entities.UserProfile.filter({ created_by: u.email }).catch(() => []),
                    base44.entities.Flashcard.filter({ created_by: u.email, is_active: true }).catch(() => []),
                    base44.entities.QuizAttempt.filter({ created_by: u.email }).catch(() => []),
                    base44.entities.Quiz.filter({ created_by: u.email }).catch(() => []),
                    base44.entities.SubjectAssessment.filter({ created_by: u.email }).catch(() => []),
                    loadSavedResults(null, u.email).catch(() => []),
                    base44.entities.UserSubject.filter({ created_by: u.email, is_active: true }).catch(() => []),
                ]);
                if (!alive) return;
                setPremium(isPremium(profiles?.[0] ?? null));
                setConvs(saved || []);
                const seen = new Set();
                setSubjects((subs || []).map((s) => s.subject_name)
                    .filter((n) => n && !seen.has(n) && seen.add(n)));
                setRows({
                    cards: deckCards(flashcards || []),
                    bankCards: (flashcards || []).filter(isBankCard),
                    attempts: attempts || [],
                    quizzes: quizzes || [],
                    assessments: assessments || [],
                });
            } catch {
                // A FAILED READ LOCKS. The server refuses the send either way,
                // so an unlocked composer would only produce a refusal the
                // student cannot act on.
                if (alive) { setPremium(false); setRows({}); }
            }
        })();
        return () => { alive = false; };
    }, []);

    // `isReady` IS PASSED WITH ITS DAY, the way /Review passes it — the
    // point-free form is the arity bug due.js records, which renders perfectly
    // and reports every learned card as due.
    const picks = useMemo(() => {
        if (!rows) return [];
        const today = todayISO();
        return candidates({ ...rows, isReady: (c) => isReady(c, today) });
    }, [rows]);

    const recent = useMemo(() => benches(convs), [convs]);

    /* ── The scan ───────────────────────────────────────────────────────── */

    const runScan = useCallback(async ({ body, subject, question, marks }) => {
        const piece = makeWorkpiece({ kind: "question", body, subject: subject || null, source: "typed" });
        if (!piece) return;
        setWork({ ...piece, question: question || null, marks: marks || null });
        setFindings(null);
        setBusy(true);
        try {
            const res = await base44.integrations.Core.InvokeLLM({
                feature: SCAN_FEATURE,
                // `scanSystem` is a SYSTEM block rather than more prompt: it is
                // the subject's examiner profile plus the fault menu, identical
                // for every scan in that subject, so inline it would be
                // re-billed in full on each one. markingPrompt's rule.
                system: scanSystem(subject),
                prompt: scanPrompt(body, { subject, question, marks }),
                response_json_schema: SCAN_SCHEMA,
            });
            const out = readScan(res, { work: body, subject });
            setFindings(out.findings);
        } catch (e) {
            // NOTHING IS INVENTED TO FILL THE SCREEN. The work stays, the
            // intake comes back, and the student can press it again.
            setWork(null);
            setFindings(null);
            toast({
                title: "The scan did not come back",
                description: String(e?.message || "").slice(0, 160) || "Try it again in a moment.",
                variant: "destructive",
            });
        } finally {
            setBusy(false);
        }
    }, [toast]);

    /**
     * The second pass, and it may only CLEAR.
     *
     * `applyRescan` discards anything new, which is what makes the all-clear
     * reachable: left to append, each pass finds new or reshaped faults and a
     * student who worked for an hour sees a readout as red as when they began.
     */
    const runRescan = useCallback(async () => {
        if (!work || !findings?.length) return;
        const open = findings.filter((f) => !f.cleared);
        if (!open.length) return;
        setBusy(true);
        try {
            const res = await base44.integrations.Core.InvokeLLM({
                feature: SCAN_FEATURE,
                system: scanSystem(work.subject),
                prompt: rescanPrompt(work.body, open),
                response_json_schema: RESCAN_SCHEMA,
            });
            const still = Array.isArray(res?.still_present) ? res.still_present
                : Array.isArray(res?.data?.still_present) ? res.data.still_present : null;
            // A pass that answered with nothing usable changes NOTHING. Reading
            // an unparseable reply as "all clear" would hand the student the
            // one outcome this screen exists to make them earn.
            if (!still) {
                toast({ title: "The re-scan did not come back", description: "Nothing was changed." });
                return;
            }
            const before = openKeys(findings).length;
            const next = applyRescan(findings, still);
            setFindings(next);
            const closed = before - openKeys(next).length;
            toast({
                title: closed > 0 ? `${closed} cleared` : "Still open",
                description: closed > 0
                    ? "Re-checked against your revised work."
                    : "The re-scan still sees these in the current version.",
            });
        } catch {
            toast({ title: "The re-scan did not come back", description: "Nothing was changed." });
        } finally {
            setBusy(false);
        }
    }, [work, findings, toast]);

    /* ── Repairs ────────────────────────────────────────────────────────── */

    const openRepair = useCallback((finding) => {
        setRepair({
            key: finding.key,
            tool: finding.tool,
            seed: repairSeed(finding, work?.body || ""),
        });
    }, [work]);

    const clear = useCallback((key, value) => {
        setFindings((list) => setCleared(list, key, value));
    }, []);

    const reset = useCallback(() => {
        setWork(null); setFindings(null); setRepair(null);
    }, []);

    const openRecent = useCallback((b) => {
        const piece = b.workpiece || b.draft;
        if (!piece?.body) return;
        // A saved run reopens as its WORK with no findings: the scan is not
        // stored, and re-reading it off a stale row would print faults about a
        // version the student has already revised.
        setWork({ ...piece, question: null, marks: null });
        setFindings([]);
        setRepair(null);
    }, []);

    if (premium === undefined) {
        return (
            <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-3rem)] flex items-center justify-center">
                <AceShuffle size="lg" />
            </div>
        );
    }

    // ── A REPAIR TAKES THE WHOLE SCREEN ─────────────────────────────────────
    // It is a conversation, and a conversation in a 300px panel beside a
    // readout is the cramped shape Ranked was split for.
    if (repair) {
        return (
            <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-3rem)] bg-background">
                <div className="h-full max-w-7xl mx-auto px-2 lg:px-4 py-3 flex flex-col min-h-0">
                    <UnifiedChat
                        key={repair.key}
                        locked={!premium}
                        startTool={repair.tool}
                        startSubject={work?.subject || ""}
                        startSeed={repair.seed}
                        workpiece={work}
                        operation={repair.key}
                        onExit={() => setRepair(null)}
                        exitLabel="Readout"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100dvh-8rem)] md:min-h-[calc(100dvh-3rem)] bg-background">
            {busy && !findings ? (
                <div className="py-16">
                    <AceLoading variant="think">Scanning your work…</AceLoading>
                </div>
            ) : work && findings ? (
                <Readout
                    work={work.body}
                    subject={work.subject}
                    findings={findings}
                    busy={busy}
                    onRepair={openRepair}
                    onClear={clear}
                    onRescan={runRescan}
                    onNew={reset}
                />
            ) : (
                <ScanIntake
                    candidates={picks}
                    recent={recent}
                    subjects={subjects}
                    loading={rows === null}
                    busy={busy}
                    onPick={(w) => runScan({ body: w.body, subject: w.subject, question: "", marks: "" })}
                    onOpenRecent={openRecent}
                    onScan={runScan}
                />
            )}
        </div>
    );
}

export { FAULTS };
