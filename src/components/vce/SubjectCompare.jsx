/**
 * SubjectCompare — two subjects, the same facts, side by side.
 *
 * ─── It names no winner ─────────────────────────────────────────────────────
 * A higher scaling number is not a better subject and a smaller exam share is
 * not an easier one, so nothing here is ticked, starred or coloured as the
 * stronger side. The rows are `compareRows`, which carries no verdict field at
 * all, and the test asserts that absence. A student weighs it; the page lays
 * it out.
 *
 * ─── The bars stack, they do not sit side by side ───────────────────────────
 * A year bar needs the width to be read, and two of them at half a phone each
 * are two smudges. Stacked, the two years line up segment for segment, which
 * is the comparison somebody actually makes ("this one is 60% exam, that one
 * is 40%").
 *
 * Switching the right-hand subject re-deals its bar, keyed on the subject,
 * because a bar that keeps its old segments while its numbers change is
 * drawing the previous subject.
 */
import React, { useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import YearBar from "@/components/vce/YearBar";
import { alpha } from "@/components/cards/PlayingCard";
import { colorFor } from "@/components/cards/cardIdentity";
import { yearBar, compareRows, overlap } from "@/lib/subjectInfo";

/**
 * A column's name. No scaling mark here: the first row of the table is
 * scaling, and printing it in the header as well squeezed the right-hand
 * picker to "Mathematic" on a phone.
 */
function Head({ subject, hex, children }) {
    return (
        <div className="relative min-w-0 rounded-xl pl-3.5 pr-2.5 py-2.5"
            style={{ background: alpha(hex, 0.08) }}>
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ background: hex }} />
            {children || (
                <p className="font-display font-extrabold text-sm sm:text-base text-foreground leading-tight">
                    {subject.name}
                </p>
            )}
        </div>
    );
}

/** One value cell. A fact the catalogue lacks is a dash, never a zero. */
function Cell({ value }) {
    return value == null
        ? <span className="text-muted-foreground/60">—</span>
        : <span className="text-foreground">{value}</span>;
}

export default function SubjectCompare({ open, a, b, catalogue = [], hexA, onChangeB, onClose, onOpen }) {
    const reduce = useReducedMotion();
    const hA = hexA || colorFor(a?.name);
    const hB = colorFor(b?.name);
    const choices = useMemo(() => catalogue
        .filter((s) => s && !s.is_private && s.id !== a?.id)
        .sort((x, y) => String(x.name).localeCompare(String(y.name))), [catalogue, a?.id]);
    const barA = useMemo(() => yearBar(a), [a]);
    const barB = useMemo(() => yearBar(b), [b]);
    const rows = useMemo(() => compareRows(a, b), [a, b]);
    const careers = useMemo(() => overlap(a?.career_pathways || [], b?.career_pathways || []), [a, b]);
    const sharedSkills = useMemo(() => overlap(a?.key_skills || [], b?.key_skills || []).both, [a, b]);

    if (!a) return null;
    const fade = reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

    return (
        <Dialog open={open && !!b} onOpenChange={(v) => { if (!v) onClose?.(); }}>
            <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl p-5 sm:p-6" data-subject-compare>
                <DialogHeader>
                    <DialogTitle className="font-display font-extrabold text-xl">Side by side</DialogTitle>
                    <DialogDescription className="text-[13px]">
                        The same facts for both. Neither column is the better choice — that depends on you.
                    </DialogDescription>
                </DialogHeader>

                {b && (
                    <div className="space-y-6">
                        {/* ── Who is being compared ───────────────────────── */}
                        <div className="grid grid-cols-2 gap-2.5">
                            <Head subject={a} hex={hA} />
                            <Head subject={b} hex={hB}>
                                <Select value={b.id} onValueChange={(id) => {
                                    const next = choices.find((s) => s.id === id);
                                    if (next) onChangeB?.(next);
                                }}>
                                    <SelectTrigger data-compare-pick aria-label="Compare with"
                                        className="h-auto min-h-0 p-0 border-0 bg-transparent shadow-none text-left
                                            font-display font-extrabold text-sm sm:text-base text-foreground leading-tight
                                            focus:ring-0 focus:ring-offset-0 [&>span]:line-clamp-2 [&>span]:whitespace-normal gap-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-72">
                                        {choices.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Head>
                        </div>

                        {/* ── How each is marked ──────────────────────────── */}
                        <section>
                            <p className="stat-label mb-2.5">How it's marked</p>
                            <div className="space-y-3">
                                {[[a, barA, hA], [b, barB, hB]].map(([s, bar, hex]) => (
                                    <div key={s.id}>
                                        <p className="text-[12px] font-bold text-muted-foreground mb-1.5 truncate">{s.name}</p>
                                        {bar
                                            ? <YearBar key={s.id} bar={bar} hex={hex} rows={false} compact />
                                            : <p className="text-[12px] text-muted-foreground">No assessment breakdown in the catalogue.</p>}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* ── The facts, row by row ───────────────────────── */}
                        <dl className="divide-y divide-border/70 border-y border-border/70" data-compare-rows>
                            {rows.map((r) => (
                                <div key={r.key} className="py-2.5" data-compare-row={r.key}>
                                    <dt className="stat-label mb-1">{r.label}</dt>
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.dd key={`${r.key}-${b.id}`} {...fade} transition={{ duration: 0.15 }}
                                            className="grid grid-cols-2 gap-2.5 text-[13px] sm:text-sm font-bold tabular-nums leading-snug">
                                            <Cell value={r.a} />
                                            <Cell value={r.b} />
                                        </motion.dd>
                                    </AnimatePresence>
                                </div>
                            ))}
                        </dl>

                        {/* ── What they share ─────────────────────────────── */}
                        {sharedSkills.length > 0 && (
                            <section>
                                <p className="stat-label mb-2">Studied in both</p>
                                <ul className="flex flex-wrap gap-1.5">
                                    {sharedSkills.map((s) => (
                                        <li key={s} className="pill bg-secondary text-foreground text-[12px]">{s}</li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {(careers.both.length + careers.onlyA.length + careers.onlyB.length) > 0 && (
                            <section data-compare-careers>
                                <p className="stat-label mb-2">Where they lead</p>
                                {careers.both.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-[12px] text-muted-foreground mb-1.5">Both</p>
                                        <ul className="flex flex-wrap gap-1.5">
                                            {careers.both.map((c) => (
                                                <li key={c} className="pill bg-secondary text-foreground text-[12px]">{c}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2.5">
                                    {[[careers.onlyA, hA, a], [careers.onlyB, hB, b]].map(([list, hex, s]) => (
                                        <div key={s.id} className="min-w-0">
                                            <p className="text-[12px] text-muted-foreground mb-1.5 truncate">Only {s.name}</p>
                                            {list.length ? (
                                                <ul className="space-y-1">
                                                    {list.map((c) => (
                                                        <li key={c} className="text-[13px] text-foreground pl-2 border-l-2 leading-snug"
                                                            style={{ borderColor: alpha(hex, 0.6) }}>{c}</li>
                                                    ))}
                                                </ul>
                                            ) : <p className="text-[12px] text-muted-foreground/70">—</p>}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                            <p className="text-[12px] text-muted-foreground leading-snug">
                                Scaling reflects who takes a subject, not how hard it is to do well in.
                            </p>
                            <Button onClick={() => onOpen?.(b)} data-compare-open
                                className="btn-3d gap-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl flex-shrink-0">
                                Open {b.name} <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
