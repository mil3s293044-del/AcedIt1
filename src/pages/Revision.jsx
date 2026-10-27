/**
 * Revision — one place for every SAC, every exam, and everything you need for
 * them.
 *
 * ─── What it is ─────────────────────────────────────────────────────────────
 * A shelf of FOLDERS. Every SAC on the planner is one, and every subject has an
 * exam folder covering the whole course. Opening a folder gathers, off rows the
 * app already holds, every banked mistake, every saved answer, every slipping
 * card and every question to sit again in that SAC's topics — plus the one
 * thing only this screen keeps: the key-knowledge checklist, with what the
 * student says they know and what a marked check has proved.
 *
 * It absorbed two screens rather than sitting beside them. The Mistake Bank is
 * "All mistakes" here (the same screen, embedded; /MistakeBank redirects), and
 * Revision Mode is a folder's Mock exam (the same mock, scoped). A third copy
 * of either would be the mirror this codebase keeps deleting.
 *
 * ─── The address ────────────────────────────────────────────────────────────
 *   /Revision                            the shelf
 *   /Revision?folder=sac:<id>&tab=…      one folder, on one tab
 *   /Revision?folder=…&sit=<quizId>      that folder, with a check on the table
 *   /Revision?view=mistakes[&tab=redo]   all mistakes
 *   /Revision?view=answers               all saved answers
 * `revisionQuery` is the one builder for every link in.
 *
 * ─── Nothing is written because the page opened ─────────────────────────────
 * Old saved answers move into the bank with a tap; a scope is the student's
 * tick; a point is theirs. The only rows this page creates are ones somebody
 * asked for.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { X, Bookmark, BookMarked, ChevronLeft, CalendarPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import AceSpot from "@/components/ace/AceSpot";
import SitScreen from "@/components/shared/SitScreen";
import QuizPlayer from "@/components/quizzes/QuizPlayer";
import PreSit from "@/components/quizzes/PreSit";
import DrillRun from "@/components/mistakes/DrillRun";
import useBankActions from "@/components/mistakes/useBankActions";
import ExamMode from "@/components/study/ExamMode";
import { MistakeBankView } from "@/pages/MistakeBank";
import FolderCard, { ExamTile, BankTile } from "@/components/revision/FolderCard";
import FolderView from "@/components/revision/FolderView";
import ScopeSheet from "@/components/revision/ScopeSheet";
import AnswerList from "@/components/revision/AnswerList";
import { subjectColor } from "@/components/cards/cardIdentity";
import { isReady } from "@/lib/due";
import { deckCards, isBankCard, casesFor, fixState } from "@/lib/mistakeBank";
import { isAnswerCard, isLegacySaved, cardFromSaved, answerState } from "@/lib/answerBank";
import { redoQueue } from "@/lib/quizInsight";
import { FEATURES, checkLiveTier } from "@/lib/tierAccess";
import { getExaminerPrompt } from "@/lib/subjectExaminerPrompts";
import { STIMULUS_RULE, STIMULUS_SCHEMA } from "@/lib/quizSchema";
import { cleanQuestion } from "@/lib/questionText";
import { startJob, getJobs, useJobView, adoptJob } from "@/lib/jobStore";
import { runningIn } from "@/lib/aiJobs";
import useSacTags, { patchSac, useSacTagRows } from "@/hooks/useSacTags";
import { folderStats, historyOf, historyPatch } from "@/lib/sacTags";
import { chatRows } from "@/lib/aiChats";
import { loadSavedResults } from "@/lib/saveResult";
import { itemsOf } from "@/components/revision/MaterialTab";
import {
    foldersFor, findFolder, folderContents, readiness, pointProof, normTopic, topicOptions,
    suggestedTopics, revisionPatch, revisionQuery, checkQuiz, alignCheck, FOLDER_TABS,
} from "@/lib/revision";

const REVISION = createPageUrl("Revision");

/** A section heading with a rule to the end of the row — the shelf idiom. */
function Shelf({ title, aside, children }) {
    return (
        <section className="space-y-3" aria-label={title}>
            <div className="flex items-center gap-2.5">
                <h2 className="font-display font-extrabold text-foreground">{title}</h2>
                {aside}
                <span className="flex-1 h-px bg-border" aria-hidden="true" />
            </div>
            {children}
        </section>
    );
}

export default function Revision() {
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const reduce = useReducedMotion();
    const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const view = params.get("view");
    const folderKey = params.get("folder");
    const sitId = params.get("sit");
    const tabParam = params.get("tab");

    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [assessments, setAssessments] = useState([]);
    const [userSubjects, setUserSubjects] = useState([]);
    const [cards, setCards] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [attempts, setAttempts] = useState([]);
    const [saved, setSaved] = useState([]);
    // What a folder can also hold since tagging: the student's maps and chats,
    // and the study log its run-up is counted from.
    const [maps, setMaps] = useState([]);
    const [chats, setChats] = useState([]);
    const [studySessions, setStudySessions] = useState([]);
    const [techniques, setTechniques] = useState([]);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const tags = useSacTags(user?.email);

    const [run, setRun] = useState(null);
    const [pendingSit, setPendingSit] = useState(null);
    const [sitting, setSitting] = useState(null);
    const [mock, setMock] = useState(null);
    const [leavingMock, setLeavingMock] = useState(false);
    const [scoping, setScoping] = useState(false);
    const [movingId, setMovingId] = useState(null);

    const putCards = useCallback((next) => setCards((prev) => (typeof next === "function" ? next(prev) : next)), []);
    const { onGraded, clearFixed } = useBankActions({ putCards, toast });

    const load = useCallback(async () => {
        try {
            const me = await base44.auth.me();
            setUser(me);
            const by = { created_by: me.email };
            const fail = () => [];
            const [profiles, sacs, subjects, rows, quizRows, attemptRows, savedRows, mapRows, convRows, sessionRows, techniqueRows, planRows] = await Promise.all([
                base44.entities.UserProfile.filter(by).catch(fail),
                base44.entities.SubjectAssessment.filter(by).catch(fail),
                base44.entities.UserSubject.filter({ ...by, is_active: true }).catch(fail),
                base44.entities.Flashcard.filter({ ...by, is_active: true }).catch(fail),
                base44.entities.Quiz.filter(by).catch(fail),
                base44.entities.QuizAttempt.filter(by).catch(fail),
                base44.entities.AISavedResult.filter({ ...by, tool_type: "saved_answer" }).catch(fail),
                base44.entities.MindMap.filter(by).catch(fail),
                loadSavedResults(null, me.email).catch(fail),
                base44.entities.StudySession.filter(by).catch(fail),
                base44.entities.StudyTechnique.filter(by).catch(fail),
                base44.entities.StudyPlan.filter(by).catch(fail),
            ]);
            setProfile(profiles?.[0] || null);
            setAssessments(sacs || []);
            setUserSubjects(subjects || []);
            setCards(rows || []);
            setQuizzes(quizRows || []);
            setAttempts(attemptRows || []);
            setSaved(savedRows || []);
            setMaps(mapRows || []);
            setChats(chatRows(convRows || []));
            setStudySessions(sessionRows || []);
            setTechniques(techniqueRows || []);
            setPlans(planRows || []);
        } catch {
            setCards([]);
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    // A tag written anywhere (a chip on this page, or the Add sheet) is a write
    // to a SAC's row. Taking the saved row keeps this page's copy current, so
    // the next points edit is not built off a copy that predates the tag.
    const takeSac = useCallback((row) => setAssessments((prev) => prev.map((a) => (a.id === row.id ? row : a))), []);
    useSacTagRows(takeSac);

    // ── Everything below is DERIVED. Nothing here is stored. ───────────────
    const deck = useMemo(() => deckCards(cards), [cards]);
    const bank = useMemo(() => cards.filter(isBankCard), [cards]);
    const answers = useMemo(() => cards.filter(isAnswerCard), [cards]);
    const legacy = useMemo(() => saved.filter(isLegacySaved), [saved]);
    const folders = useMemo(() => foldersFor({ assessments, userSubjects }), [assessments, userSubjects]);
    const redo = useMemo(() => redoQueue(quizzes, attempts, bank), [quizzes, attempts, bank]);
    const proof = useMemo(() => pointProof(quizzes, attempts), [quizzes, attempts]);
    const cases = useMemo(() => casesFor(bank, attempts, quizzes), [bank, attempts, quizzes]);
    const toneOf = useCallback((subject) => {
        const row = userSubjects.find((u) => normTopic(u.subject_name) === normTopic(subject));
        return subjectColor(row || null, subject);
    }, [userSubjects]);

    const sources = useMemo(() => ({
        flashcards: deck, bankCards: bank, answerCards: answers, quizzes, attempts, redo, legacySaved: legacy, isReady,
        maps, chats, sessions: studySessions, techniques, plans,
    }), [deck, bank, answers, quizzes, attempts, redo, legacy, maps, chats, studySessions, techniques, plans]);

    // Everything the student owns, as the Add sheet lists it.
    const allMaterial = useMemo(() => ({
        decks: itemsOf("decks", deck),
        quizzes: itemsOf("quizzes", quizzes.filter((q) => !q?.extra?.revision_check)),
        maps: itemsOf("maps", maps),
        chats: itemsOf("chats", chats),
    }), [deck, quizzes, maps, chats]);

    const measured = useMemo(() => {
        const m = new Map();
        for (const f of folders.all) {
            const contents = folderContents(f, sources);
            m.set(f.key, {
                contents,
                r: readiness({ points: f.points, proof, mistakes: contents.mistakes, answers: contents.answers, attempts }),
            });
        }
        return m;
    }, [folders, sources, proof, attempts]);

    const folder = folderKey ? findFolder(folders, folderKey) : null;
    const tab = FOLDER_TABS.includes(tabParam) ? tabParam : "knowledge";

    // ── The check job: "Test me" is a quiz being made, and follows you. ───
    const checkJob = useJobView("check", {
        show: (j) => !!folder && j.kind === "check" && String(j.openTo || "").includes(encodeURIComponent(folder.key)),
        onSettled: (job) => {
            if (job.status === "failed") {
                toast({ title: "Couldn't build the check", description: job.error || "Try again in a moment.", variant: "destructive" });
                return;
            }
            const quiz = job.result?.quiz;
            if (!quiz?.id) return;
            setQuizzes((prev) => (prev.some((q) => q.id === quiz.id) ? prev : [...prev, quiz]));
            setPendingSit(quiz);
        },
    });

    // Landing on `?sit=` — the job card's Open, or a link — lays that quiz on
    // the table once the rows are in, and takes the held job off the card.
    useEffect(() => {
        if (loading || !sitId) return;
        const quiz = quizzes.find((q) => q.id === sitId);
        adoptJob("check", user?.email);
        if (quiz) setPendingSit(quiz);
        navigate(`${REVISION}${revisionQuery({ folder: folderKey, tab })}`, { replace: true });
    }, [loading, sitId, quizzes, user, navigate, folderKey, tab]);

    const goTab = (t) => navigate(`${REVISION}${revisionQuery({ folder: folderKey, tab: t })}`, { replace: true });

    // ── Writes ────────────────────────────────────────────────────────────
    // A SAC's revision goes through `patchSac`, the same queue the tags use:
    // they share one `extra.revision`, and a points edit built off a copy read
    // before a tag landed would write the old claims straight back.
    const writeRevision = async (f, next) => {
        const patch = revisionPatch(f.row, next);
        const apply = (rows) => rows.map((x) => (x.id === f.id ? { ...x, ...patch } : x));
        if (f.kind === "sac") setAssessments(apply); else setUserSubjects(apply);
        try {
            if (f.kind === "sac") await patchSac(f.id, (row) => revisionPatch(row, next));
            else await base44.entities.UserSubject.update(f.id, patch);
        } catch {
            toast({ title: "That didn't save", description: "Give it another go in a moment.", variant: "destructive" });
            load();
        }
    };

    // ── Readiness, recorded once a day the folder is opened ──────────────
    // The one figure nothing else records. `historyPatch` is null when today
    // already reads the same, so re-opening a folder costs nothing; the ref
    // stops a second write for the same reading while the first is in flight.
    const recorded = useRef("");
    useEffect(() => {
        if (loading || !folder) return;
        const m = measured.get(folder.key);
        if (!m) return;
        const patch = historyPatch(folder.row, m.r);
        const sig = `${folder.key}:${m.r.proved}/${m.r.said}/${m.r.total}`;
        if (!patch || recorded.current === sig) return;
        recorded.current = sig;
        const apply = (rows) => rows.map((x) => (x.id === folder.id ? { ...x, ...patch } : x));
        if (folder.kind === "sac") {
            setAssessments(apply);
            patchSac(folder.id, (row) => historyPatch(row, m.r)).catch(() => { recorded.current = ""; });
        } else if (folder.id) {
            setUserSubjects(apply);
            base44.entities.UserSubject.update(folder.id, patch).catch(() => { recorded.current = ""; });
        }
    }, [loading, folder, measured]);
    const savePoints = (points) => folder && writeRevision(folder, { points });
    const saveTopics = (topics) => folder && writeRevision(folder, { topics });

    const moveLegacy = async (row) => {
        const card = cardFromSaved(row);
        if (!card) {
            toast({ title: "Nothing to learn in that one", description: "It has no answer saved with it.", variant: "destructive" });
            return;
        }
        setMovingId(row.id);
        try {
            const created = await base44.entities.Flashcard.create(card);
            setCards((prev) => [...prev, created || { ...card, id: `tmp-${row.id}` }]);
            const extra = { ...(row.extra || {}), moved_to: created?.id || true };
            setSaved((prev) => prev.map((x) => (x.id === row.id ? { ...x, extra } : x)));
            base44.entities.AISavedResult.update(row.id, { extra }).catch(() => {});
            toast({ title: "In your answer bank", description: "It comes back on its own schedule until you have it word for word." });
        } catch (e) {
            toast({ title: "Couldn't move it", description: e?.message || "Try again in a moment.", variant: "destructive" });
        } finally { setMovingId(null); }
    };

    const deleteAnswer = async (card) => {
        putCards((prev) => prev.filter((c) => c.id !== card.id));
        try { await base44.entities.Flashcard.update(card.id, { is_active: false }); }
        catch { toast({ title: "That didn't delete", variant: "destructive" }); load(); }
    };

    const sitRedo = (group) => {
        const questions = group.rows.map((r) => ({ ...r.question, _sourceIndex: r.qIndex })).filter((q) => q.question);
        if (!questions.length) return;
        setPendingSit({ ...group.quiz, _isRetry: true, _parentTitle: group.title, title: `${group.title} — sit again`, questions });
    };

    // ── Test me: one question per point, through the real quiz player ────
    const buildCheck = async (points) => {
        if (!folder || !points.length) return;
        if (runningIn(getJobs(), "check")) return;
        const access = await checkLiveTier(FEATURES.QUIZ_AI_GEN);
        if (!access.allowed) {
            toast({ title: access.upgradeRequired ? "Premium feature" : "Not enough chips", description: access.reason, variant: "destructive" });
            return;
        }
        const f = folder;
        const job = startJob({
            kind: "check",
            title: `${f.title} · knowledge check`,
            email: user?.email,
            total: points.length,
            files: 0,
            openTo: `${REVISION}${revisionQuery({ folder: f.key })}`,
        });
        try {
            const res = await base44.integrations.Core.InvokeLLM({
                feature: FEATURES.QUIZ_AI_GEN,
                prompt: `${getExaminerPrompt(f.subject)}

Write ONE VCE ${f.subject} exam-style question for EACH key-knowledge point below — ${points.length} questions in total. It is a check on whether the student really knows each point, so:
- Each question tests its point and nothing else. Set "point" to that point's number.
- Use the command term the point calls for. Worth 2 to 4 marks, matched to the work.
- Give a model answer that would earn every mark, detailed enough to mark against.
- Never invent content outside the VCAA study design.

${points.map((p, i) => `${i + 1}. ${p.text}`).join("\n")}

${STIMULUS_RULE}`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        questions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    point: { type: "number" },
                                    question: { type: "string" },
                                    stimulus: STIMULUS_SCHEMA,
                                    model_answer: { type: "string" },
                                    marks: { type: "number" },
                                },
                                required: ["point", "question", "model_answer"],
                            },
                        },
                    },
                    required: ["questions"],
                },
            }, { onProgress: job.progress });
            job.stage("finish");
            const raw = (res?.questions || []).filter((q) => q?.question && q?.model_answer);
            const aligned = alignCheck(points, raw);
            const questions = aligned.questions.map((q) => cleanQuestion({
                type: "short_answer",
                question: q.question,
                ...(q.stimulus ? { stimulus: q.stimulus } : {}),
                model_answer: q.model_answer,
                marks: Math.min(6, Math.max(1, Math.round(Number(q.marks) || 3))),
            }));
            if (!questions.length) throw new Error("No questions came back. Try again in a moment.");
            const created = await base44.entities.Quiz.create(checkQuiz({ folder: f, points: aligned.points, questions }));
            if (!created?.id) throw new Error("The check didn't save.");
            job.ready({
                items: questions.length,
                openTo: `${REVISION}${revisionQuery({ folder: f.key, sit: created.id })}`,
                result: { quiz: created },
            });
        } catch (e) {
            job.fail(e?.message || "Couldn't build the check");
        }
    };

    // ── Full-screen states ────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-4" data-revision-loading>
                <div className="h-10 w-2/3 rounded-xl bg-secondary animate-pulse" />
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="h-44 rounded-2xl bg-secondary animate-pulse" />
                    <div className="h-44 rounded-2xl bg-secondary animate-pulse" />
                </div>
            </div>
        );
    }
    if (run) {
        return (
            <DrillRun queue={run.queue} attempts={attempts} label={run.label} closeLabel="Back to the folder"
                onGraded={onGraded} onClear={clearFixed}
                onClose={() => { setRun(null); load(); }} />
        );
    }
    if (sitting) {
        return (
            <SitScreen label={sitting.quiz.title}>
                <QuizPlayer quiz={sitting.quiz} mode={sitting.mode} timeLimitMs={sitting.timeLimitMs}
                    onExit={() => { setSitting(null); load(); }} />
            </SitScreen>
        );
    }
    if (mock) {
        return (
            <SitScreen label={`Mock exam — ${mock.title}`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                    <button type="button" onClick={() => setLeavingMock(true)} aria-label="Leave the mock exam" data-mock-exit
                        className="w-8 h-8 rounded-xl border-2 border-border text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center">
                        <X className="w-4 h-4" />
                    </button>
                    {leavingMock && (
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Leave? Answers on this paper aren't kept.</span>
                            <Button size="sm" variant="outline" onClick={() => setLeavingMock(false)} className="h-7 rounded-lg text-xs">Stay</Button>
                            <Button size="sm" onClick={() => { setMock(null); setLeavingMock(false); load(); }} className="h-7 rounded-lg text-xs bg-streak text-white hover:bg-streak">Leave</Button>
                        </div>
                    )}
                </div>
                <ExamMode userSubjects={userSubjects} scope={{ subject: mock.subject, topics: mock.topics, label: mock.title }} />
            </SitScreen>
        );
    }

    const preSit = (
        <PreSit open={!!pendingSit} quiz={pendingSit} attempts={attempts}
            onCancel={() => setPendingSit(null)}
            onStart={({ mode, timeLimitMs }) => { setSitting({ quiz: pendingSit, mode, timeLimitMs }); setPendingSit(null); }} />
    );

    // ── All mistakes: the Mistake Bank, as it was, inside Revision ────────
    if (view === "mistakes") {
        return (
            <div data-revision-view="mistakes">
                <div className="px-4 sm:px-6 pt-4 sm:pt-6 max-w-3xl mx-auto">
                    <Link to={REVISION} className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="w-3.5 h-3.5" /> Revision
                    </Link>
                </div>
                <MistakeBankView tags={tags} />
            </div>
        );
    }

    // ── All saved answers, by subject ─────────────────────────────────────
    if (view === "answers") {
        const live = answers.filter((c) => !c.retired_at);
        const subjects = [...new Set([...live.map((c) => c.subject_name || "No subject"), ...legacy.map((r) => r.subject_name || "No subject")])].sort();
        return (
            <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6" data-revision-view="answers">
                <Link to={REVISION} className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="w-3.5 h-3.5" /> Revision
                </Link>
                <header>
                    <p className="stat-label text-muted-foreground">Answer bank</p>
                    <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground leading-tight mt-1">
                        {live.length
                            ? <>You have learned <span className="text-primary tabular-nums">{live.filter((c) => answerState(c) === "learned").length}</span> of <span className="tabular-nums">{live.length}</span>.</>
                            : "Answers worth learning, word for word."}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                        Full-mark answers you wrote, and model answers to questions you dropped marks on. Each one climbs
                        from reading it to writing it from the question alone.
                    </p>
                </header>
                {subjects.length === 0 && (
                    <div className="card-soft border-2 border-border p-6 text-center">
                        <AceSpot pose="think" className="w-20 h-20 mx-auto" />
                        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                            When a quiz is marked, save the answers worth keeping from the marking. They land here.
                        </p>
                    </div>
                )}
                {subjects.map((s) => {
                    const a = live.filter((c) => (c.subject_name || "No subject") === s);
                    return (
                        <Shelf key={s} title={s} aside={<span className="w-1.5 h-5 rounded-full order-first" style={{ backgroundColor: toneOf(s) }} aria-hidden="true" />}>
                            <AnswerList answers={a} legacy={legacy.filter((r) => (r.subject_name || "No subject") === s)} tags={tags}
                                ready={a.filter(isReady)} onDrill={(list) => setRun({ queue: list, label: `Learning ${s}` })}
                                onRetire={clearFixed} onDelete={deleteAnswer} onMoveLegacy={moveLegacy} movingId={movingId} />
                        </Shelf>
                    );
                })}
            </div>
        );
    }

    // ── One folder ────────────────────────────────────────────────────────
    if (folderKey) {
        if (!folder) {
            return (
                <div className="p-4 sm:p-6 max-w-2xl mx-auto">
                    <div className="card-soft border-2 border-border p-6 text-center">
                        <p className="font-display font-extrabold text-lg text-foreground">That folder isn't here any more</p>
                        <p className="text-sm text-muted-foreground mt-1">The SAC may have been removed from the planner.</p>
                        <Link to={REVISION}><Button className="mt-4 rounded-xl">Back to Revision</Button></Link>
                    </div>
                </div>
            );
        }
        const m = measured.get(folder.key);
        const options = topicOptions(folder.subject, {
            flashcards: deck, quizzes, bankCards: bank, answerCards: answers,
        });
        const mockCount = m.contents.cards.filter((c) => c.question && c.answer).length
            + m.contents.quizzes.reduce((n, q) => n + (q.questions?.length || 0), 0);
        return (
            <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
                {preSit}
                <FolderView folder={folder} tone={toneOf(folder.subject)} contents={m.contents} r={m.r} proof={proof}
                    profile={profile} attempts={attempts} cases={cases} checkJob={checkJob}
                    tab={tab} onTab={goTab}
                    onSavePoints={savePoints} onTest={buildCheck} onScope={() => setScoping(true)}
                    onDrill={(queue, label) => queue?.length && setRun({ queue, label })}
                    onClear={clearFixed} onRetire={clearFixed} onDeleteAnswer={deleteAnswer}
                    onMoveLegacy={moveLegacy} movingId={movingId} onSitRedo={sitRedo}
                    onMock={() => setMock(folder)} mockCount={mockCount}
                    stats={folderStats(m.contents, folder)} history={historyOf(folder.row)}
                    tags={tags} allMaterial={allMaterial} />
                {scoping && (
                    <ScopeSheet open={scoping} onOpenChange={setScoping} folder={folder} options={options}
                        suggested={suggestedTopics(folder, options)} onSave={saveTopics} />
                )}
            </div>
        );
    }

    // ── The shelf ─────────────────────────────────────────────────────────
    const next = folders.sacs[0] || null;
    const nextR = next ? measured.get(next.key).r : null;
    const when = !next ? "" : next.daysAway === 0 ? "is today" : next.daysAway === 1 ? "is tomorrow" : `is in ${next.daysAway} days`;
    const openMistakes = bank.filter((c) => !c.retired_at && fixState(c, attempts) !== "fixed").length;
    const liveAnswers = answers.filter((c) => !c.retired_at);
    const learned = liveAnswers.filter((c) => answerState(c) === "learned").length;
    const nothing = !folders.sacs.length && !folders.exams.length;

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8" data-revision-shelf>
            {preSit}
            <motion.header initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <p className="stat-label text-muted-foreground">Revision</p>
                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-[1.1] mt-1 max-w-3xl">
                    {next ? <>{next.title} {when}.</> : "Every SAC, every exam, and everything you need for them."}
                </h1>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-snug" data-shelf-lead>
                    {next
                        ? (nextR.total
                            ? <><span className="font-bold text-foreground tabular-nums">{nextR.ready}</span> of <span className="tabular-nums">{nextR.total}</span> things in it are ready{nextR.proved ? <>, <span className="tabular-nums">{nextR.proved}</span> of them proved</> : null}. Open it and work from the top.</>
                            : "Its folder is empty. Open it, add what the SAC covers, and it fills itself.")
                        : "Each SAC gets a folder: its key knowledge, your mistakes, your best answers and the cards that are slipping, in one place."}
                </p>
            </motion.header>

            {nothing && (
                <div className="card-soft on-table border-2 border-border rounded-2xl p-6 text-center" data-revision-empty>
                    <AceSpot pose="think" className="w-24 h-24 mx-auto" />
                    <p className="font-display font-extrabold text-lg text-foreground mt-2">Revision starts with a SAC</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                        Add your subjects and put a SAC on the planner. It gets a folder here, and so does each subject's exam.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Link to={createPageUrl("Goals")}><Button className="btn-3d bg-primary hover:bg-primary text-primary-foreground rounded-xl gap-2"><CalendarPlus className="w-4 h-4" /> Add a SAC</Button></Link>
                        <Link to={createPageUrl("Subjects")}><Button variant="outline" className="border-2 border-border rounded-xl">Your subjects</Button></Link>
                    </div>
                </div>
            )}

            {folders.sacs.length > 0 && (
                <Shelf title="Coming up" aside={<span className="text-xs font-bold text-muted-foreground tabular-nums">{folders.sacs.length}</span>}>
                    <div className="grid md:grid-cols-2 gap-4">
                        {folders.sacs.map((f, i) => (
                            <FolderCard key={f.key} folder={f} r={measured.get(f.key).r} tone={toneOf(f.subject)} index={i} />
                        ))}
                    </div>
                </Shelf>
            )}
            {!nothing && folders.sacs.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-border px-5 py-4 flex flex-wrap items-center gap-3" data-no-sacs>
                    <p className="text-sm text-muted-foreground flex-1 min-w-[12rem]">No SACs on your planner yet. Add one and it gets its own folder.</p>
                    <Link to={createPageUrl("Goals")}><Button size="sm" variant="outline" className="border-2 border-border rounded-xl gap-1.5"><CalendarPlus className="w-3.5 h-3.5" /> Add a SAC</Button></Link>
                </div>
            )}

            {folders.exams.length > 0 && (
                <Shelf title="Exams">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {folders.exams.map((f, i) => (
                            <ExamTile key={f.key} folder={f} r={measured.get(f.key).r} tone={toneOf(f.subject)} index={i} />
                        ))}
                    </div>
                </Shelf>
            )}

            <Shelf title="Everything you've saved">
                <div className="grid sm:grid-cols-2 gap-3">
                    <BankTile to={`${REVISION}${revisionQuery({ view: "mistakes" })}`} icon={Bookmark} tone="streak"
                        title="All mistakes" line={openMistakes ? `${openMistakes} still costing marks` : bank.length ? "All fixed" : "Saved from marked quizzes"} />
                    <BankTile to={`${REVISION}${revisionQuery({ view: "answers" })}`} icon={BookMarked} tone="chart3"
                        title="All answers" line={liveAnswers.length ? `${learned} of ${liveAnswers.length} learned` : legacy.length ? `${legacy.length} saved, ready to move in` : "Full-mark and model answers"} />
                </div>
            </Shelf>

            {folders.past.length > 0 && (
                <details className="rounded-2xl border-2 border-border bg-surface overflow-hidden" data-past>
                    <summary className="px-4 py-3 cursor-pointer text-sm font-bold text-foreground">
                        Past SACs <span className="text-muted-foreground tabular-nums font-normal">· {folders.past.length}</span>
                    </summary>
                    <ul className="border-t border-border/60 divide-y divide-border/60">
                        {folders.past.map((f) => {
                            const r = measured.get(f.key).r;
                            return (
                                <li key={f.key}>
                                    <Link to={`${REVISION}${revisionQuery({ folder: f.key })}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60">
                                        <span className="w-1 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: toneOf(f.subject) }} aria-hidden="true" />
                                        <span className="min-w-0 flex-1 text-sm font-bold text-foreground truncate">{f.title}</span>
                                        <span className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0">
                                            {r.total ? `${r.ready} of ${r.total} ready` : f.subject}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </details>
            )}
        </div>
    );
}
