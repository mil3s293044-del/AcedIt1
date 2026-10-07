/**
 * QuizSetupFields — what the generator is actually asked for.
 *
 * ─── IT WAS SIX STACKED DROPDOWNS AND ONE FLAT MARK FIGURE ──────────────────
 * The richest setup screen in the app asked its questions as a 2×3 grid of
 * `<Select>`s, which is a form rather than a screen — the shape this codebase
 * already names about the old quiz list ("a grid of those is precisely what
 * makes an app look generated"). A dropdown hides its options until you open
 * it, so for a closed set of three or four it is strictly worse than a row that
 * shows all of them. The subject picker keeps its input, because that list is
 * long; everything with four answers or fewer is a segmented row now, and the
 * two quantities are sliders.
 *
 * ─── IT LIVES HERE SO IT CAN BE DRAWN ───────────────────────────────────────
 * It was 200 lines inline in a 2,200-line auth-gated page, which means the one
 * thing that settles a layout — looking at it — needed a login and a file. As a
 * component `scripts/_floorProbe.jsx?v=quizsetup` mounts the REAL controls at
 * both themes and at 390, and the guards in `quizSetup.test.mjs` scan one file
 * rather than hunting a span inside a page.
 *
 * Two exports rather than one, because the two blocks answer different
 * questions and the dialog numbers them separately: `PaperFields` is the shape
 * of the paper and every control in it changes the arithmetic under the button;
 * `EmphasisFields` is all optional and every control in it changes the PROMPT
 * and nothing else.
 */
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Field, Segmented, StepSlider, RangeSlider, ChipToggle, Stepper } from "@/components/shared/SetupControls";
import { COUNT_MIN, COUNT_MAX, MARK_MIN, MARK_MAX, TERM_MAX,
    QUESTION_KINDS, pickedKinds, maxFor } from "@/lib/quizSetup";
import { COMMAND_TERMS } from "@/lib/subjectExaminerPrompts";

/** The shape of the paper. `paper` is the live `paperShape` the footer prints. */
export function PaperFields({ settings, paper, onChange }) {
    /* Catalogue order, not tap order — the LAST kind absorbs the remainder, so
       "last" has to mean the same thing on every render. */
    const picked = pickedKinds(settings.kinds);
    return (
        <>
            {/* ── THE KINDS ARE A SET ──────────────────────────────────────
                Not a one-of-four row with "Mixed" pretending to be a fourth
                kind. Tap any combination; the counts below say how many of
                each. The last kind cannot be untapped, because a paper of no
                questions is not a paper and a disabled chip says why better
                than a toast after the fact. */}
            <Field label="Question types" tone="chart4"
                hint="Any combination. Tap one to add it to the paper.">
                <div className="flex flex-wrap gap-1.5">
                    {QUESTION_KINDS.map(k => {
                        const on = picked.includes(k.id);
                        return (
                            <ChipToggle key={k.id} tone="chart4" active={on}
                                disabled={on && picked.length === 1}
                                onClick={() => onChange({
                                    kinds: on ? picked.filter(x => x !== k.id) : [...picked, k.id],
                                })}>
                                {k.label}
                            </ChipToggle>
                        );
                    })}
                </div>
            </Field>

            <Field label="How many questions" tone="chart4" value={`${settings.num_questions}`}>
                <StepSlider tone="chart4" min={COUNT_MIN} max={COUNT_MAX}
                    value={settings.num_questions}
                    onChange={(v) => onChange({ num_questions: v })} />
            </Field>

            {/* ── HOW MANY OF EACH ─────────────────────────────────────────
                One row per picked kind. THE LAST ROW IS THE REMAINDER and has
                no stepper: the counts have to sum to the total, and letting
                all three be set by hand means either a sum that disagrees with
                the slider above it or a silent correction the student did not
                make. The word "the rest" is what says which one gives way. */}
            {picked.length > 1 && (
                <Field label="How many of each" tone="chart4"
                    hint="The last one takes whatever is left, so these always add up to the total.">
                    <div className="rounded-xl border-2 border-border divide-y divide-border">
                        {picked.map((id, i) => {
                            const kind = QUESTION_KINDS.find(k => k.id === id);
                            const last = i === picked.length - 1;
                            const n = paper.alloc[id] || 0;
                            return (
                                <div key={id} className="flex items-center gap-3 px-3 py-2">
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-bold text-foreground truncate">
                                            {kind.label}
                                        </span>
                                        <span className="block text-[11px] text-muted-foreground">
                                            {last ? "the rest" : kind.sub}
                                        </span>
                                    </span>
                                    {last ? (
                                        <span className="w-[86px] text-center font-display font-extrabold
                                            tabular-nums text-chart-4">{n}</span>
                                    ) : (
                                        <Stepper tone="chart4" value={n} label={kind.label}
                                            min={1}
                                            max={maxFor(id, {
                                                kinds: picked,
                                                counts: settings.kind_counts,
                                                count: settings.num_questions,
                                            })}
                                            onChange={(v) => onChange({
                                                kind_counts: { ...settings.kind_counts, [id]: v },
                                            })} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Field>
            )}

            {/* ── MARKS ARE A RANGE ───────────────────────────────────────
                One figure for the whole quiz made a one-line definition worth
                exactly what a four-mark explain was worth, on a screen whose
                score is a percentage of marks AVAILABLE. Both handles on one
                value is still allowed: that is the old setting, and a control
                that cannot express what it replaced is a downgrade. */}
            {paper.short > 0 && (
                <Field tone="chart4"
                    label={picked.length === 1 && picked[0] === "multipart"
                        ? "Marks per extended question" : "Marks per written question"}
                    value={paper.markLo === paper.markHi
                        ? `${paper.markLo} mark${paper.markLo === 1 ? "" : "s"}`
                        : `${paper.markLo} to ${paper.markHi} marks`}
                    hint={paper.markLo === paper.markHi
                        ? "Every written question the same. Drag the handles apart for a paper that varies."
                        : "Allocations vary across this range, weighted toward the low end the way a real paper is."}>
                    <RangeSlider tone="chart4" min={MARK_MIN} max={MARK_MAX}
                        value={[settings.mark_lo, settings.mark_hi]}
                        onChange={([lo, hi]) => onChange({ mark_lo: lo, mark_hi: hi })} />
                </Field>
            )}

            {/* NOT a two-column row. Side by side, Style's four cells get a
                quarter of half a dialog — about 55px of text each at `sm`,
                where "Standard" and "Revision" both clipped mid-word. A
                segmented control's whole advantage over the dropdown it
                replaced is that you can read the options. */}
            <div className="space-y-4">
                <Field label="Difficulty" tone="chart4">
                    <Segmented tone="chart4" size="sm" value={settings.difficulty}
                        onChange={(v) => onChange({ difficulty: v })}
                        options={[
                            { value: "Easy",   label: "Easy",   sub: "recall" },
                            { value: "Medium", label: "Medium", sub: "application" },
                            { value: "Hard",   label: "Hard",   sub: "exam level" },
                        ]} />
                </Field>
                <Field label="Style" tone="chart4">
                    <Segmented tone="chart4" size="sm" value={settings.quiz_style}
                        onChange={(v) => onChange({ quiz_style: v })}
                        options={[
                            { value: "standard",      label: "Standard", sub: "VCE style" },
                            { value: "exam_practice", label: "Exam",     sub: "past paper" },
                            { value: "revision",      label: "Revision", sub: "quick" },
                            { value: "challenge",     label: "Stretch",  sub: "beyond" },
                        ]} />
                </Field>
            </div>
        </>
    );
}

/** Everything optional. All of it changes the PROMPT and none of it the shape. */
export function EmphasisFields({ settings, paper, onChange }) {
    return (
        <div className="space-y-4">
            <Label className="text-base font-semibold">
                3. Emphasis <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>

            {/* ── THE COMMAND TERMS WERE IN THE REPO AND THE GENERATOR HAD
                NEVER SEEN THEM. `subjectExaminerPrompts.js` carries the VCAA
                table and six surfaces import it; the thing that WRITES the
                questions was not one of them — the same gap that was closed on
                the marker a release ago. Capped, because leaning on all fifteen
                is no emphasis at all. */}
            {paper.short > 0 && (
                <Field label="Command terms to lean on" tone="chart4" optional
                    hint={`What the questions ask you to DO. Pick up to ${TERM_MAX} — leave it empty and the material decides.`}>
                    <div className="flex flex-wrap gap-1.5">
                        {COMMAND_TERMS.map(t => {
                            const on = settings.command_terms.includes(t.id);
                            const full = !on && settings.command_terms.length >= TERM_MAX;
                            return (
                                <ChipToggle key={t.id} tone="chart4" active={on} disabled={full}
                                    onClick={() => onChange({
                                        command_terms: on
                                            ? settings.command_terms.filter(x => x !== t.id)
                                            : [...settings.command_terms, t.id],
                                    })}>
                                    {t.term}
                                </ChipToggle>
                            );
                        })}
                    </div>
                </Field>
            )}

            <div className="space-y-2.5">
                {/* The stimulus ASK. `STIMULUS_RULE` goes on every generate
                    whatever this says — it is what stops a question pointing at
                    material it does not carry — so this only ever ADDS a
                    request and never relaxes the rule. See quizSetup.js. */}
                <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox className="mt-0.5" checked={settings.include_stimulus}
                        onCheckedChange={(v) => onChange({ include_stimulus: !!v })} />
                    <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">Build some questions from source material</span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">
                            An extract, a data table or a short case study, reproduced in full on the question — the way VCAA sets them.
                        </span>
                    </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox className="mt-0.5" checked={settings.include_explanations}
                        onCheckedChange={(v) => onChange({ include_explanations: !!v })} />
                    <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">Include answer explanations</span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">
                            Why the right answer is right, shown after you have answered.
                        </span>
                    </span>
                </label>
            </div>

            <Field label="Focus areas" tone="chart4" optional
                hint="Which parts of the material to work from — separate with commas.">
                <Input
                    value={settings.focus_areas}
                    onChange={(e) => onChange({ focus_areas: e.target.value })}
                    placeholder="e.g., mitosis, genetics, cell division"
                />
            </Field>

            <Field label="Anything else" tone="chart4" optional
                hint="Said in your own words — it goes straight into the brief.">
                <Textarea
                    value={settings.ai_instructions}
                    onChange={(e) => onChange({ ai_instructions: e.target.value })}
                    placeholder="e.g., 'Make the MCQ options tricky', 'Use the same style as my teacher's tests'"
                    rows={3}
                />
            </Field>
        </div>
    );
}

export default { PaperFields, EmphasisFields };
