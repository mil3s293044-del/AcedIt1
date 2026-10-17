/**
 * SubjectGuide — how one subject is marked, drawn the same way everywhere.
 *
 * It is the body of the subject's page on /Guides and the "How it's marked"
 * section of that subject's hub. ONE component for both, because the two
 * answer the same question about the same exam, and two drawings of it are
 * two places a convention can be worded differently.
 *
 * `place="hub"` leaves out what the hub already draws above it — the mark
 * split, the course and the study tips — rather than printing them twice on
 * one screen, and it trims the long list of terms behind a "show all".
 *
 * Every section draws only when the guide has it (`subjectGuide` returns null
 * or an empty list for a source with nothing in it), and prose goes through
 * MarkdownMath because the maths and science profiles carry LaTeX.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkdownMath from "@/components/shared/MarkdownMath";
import Band from "@/components/shared/Band";
import MarkSplitList from "@/components/subjects/MarkSplitList";
import { TERMS_KEY } from "@/lib/guides";

const HUB_TERMS = 12;

function Block({ title, place, children, className = "" }) {
    if (place === "hub") {
        return (
            <div className={className}>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
                {children}
            </div>
        );
    }
    return <Band title={title} className={className}>{children}</Band>;
}

/** A term chip. Only a term that carries maths goes through KaTeX. */
function Term({ text }) {
    return (
        <li className="pill bg-secondary text-foreground text-[12px] font-bold">
            {text.includes("$") ? <MarkdownMath className="[&_p]:m-0">{text}</MarkdownMath> : text}
        </li>
    );
}

export function GuideDoors({ doors = [], skip = [] }) {
    const shown = doors.filter((d) => !skip.includes(d.id));
    if (!shown.length) return null;
    return (
        <div className="flex flex-wrap gap-2" data-guide-doors>
            {shown.map((d) => (
                // A door may WRAP: "Work a question the way it is marked" is
                // wider than a hub card on a phone, and a button that cannot
                // wrap pushes the page sideways.
                <Link key={d.id} to={d.to} className="max-w-full">
                    <Button variant={d.primary ? "default" : "outline"}
                        className="gap-1.5 max-w-full h-auto min-h-10 py-2 whitespace-normal text-left">
                        {d.label}{d.primary && <ArrowRight className="w-4 h-4" />}
                    </Button>
                </Link>
            ))}
        </div>
    );
}

export default function SubjectGuide({ guide, place = "page", hex }) {
    const [allTerms, setAllTerms] = useState(false);
    if (!guide) return null;
    const hub = place === "hub";
    const terms = hub && !allTerms ? guide.terms.slice(0, HUB_TERMS) : guide.terms;
    const prose = "text-[14px] text-foreground leading-relaxed";

    const lost = guide.lost.length > 0 && (
        <Block title="How marks are lost" place={place}>
            <ol className={hub ? "space-y-2" : "divide-y divide-border border-y border-border"}>
                {guide.lost.map((item, i) => (
                    <li key={i} className={`flex gap-3 ${hub ? "" : "py-2.5"}`}>
                        <span className="font-display font-extrabold tabular-nums text-muted-foreground w-5 text-right flex-shrink-0">
                            {i + 1}
                        </span>
                        <MarkdownMath className={`min-w-0 ${prose} [&_p]:m-0`}>{item}</MarkdownMath>
                    </li>
                ))}
            </ol>
        </Block>
    );

    return (
        <div className={hub ? "space-y-5" : "space-y-8 lg:space-y-10"} data-subject-guide={place}>
            {!hub && guide.marks && (
                <Block title="Where the marks are" place={place}>
                    <MarkSplitList split={guide.marks} hex={hex} />
                </Block>
            )}

            <div className={`grid gap-6 ${hub ? "lg:grid-cols-2 lg:gap-8" : "lg:grid-cols-2 lg:gap-10"} items-start`}>
                <div className={hub ? "space-y-5" : "space-y-8"}>
                    {guide.exam && (
                        <Block title="The exam" place={place}>
                            <MarkdownMath className={prose}>{guide.exam}</MarkdownMath>
                        </Block>
                    )}
                    {guide.rewarded && (
                        <Block title="What examiners reward" place={place}>
                            <MarkdownMath className={prose}>{guide.rewarded}</MarkdownMath>
                        </Block>
                    )}
                </div>
                {lost}
            </div>

            {guide.terms.length > 0 && (
                <Block title="Words examiners want" place={place}>
                    <ul className="flex flex-wrap gap-1.5">
                        {terms.map((t) => <Term key={t} text={t} />)}
                    </ul>
                    {hub && guide.terms.length > HUB_TERMS && (
                        <button type="button" onClick={() => setAllTerms((v) => !v)}
                            className="mt-2 text-xs font-bold text-muted-foreground hover:text-foreground">
                            {allTerms ? "Show fewer" : `Show all ${guide.terms.length}`}
                        </button>
                    )}
                </Block>
            )}

            {!hub && guide.course && (
                <Block title="What the course covers" place={place}>
                    <MarkdownMath className={`${prose} max-w-3xl`}>{guide.course}</MarkdownMath>
                </Block>
            )}

            {!hub && guide.tips.length > 0 && (
                <Block title="What works" place={place}>
                    <ul className="space-y-2">
                        {guide.tips.map((t, i) => (
                            <li key={i} className="flex gap-2.5 text-[14px] text-foreground leading-relaxed">
                                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: hex }} />
                                <span>{t}</span>
                            </li>
                        ))}
                    </ul>
                </Block>
            )}

            {/* Every guide ends in a door — reading how a subject is marked and
                then having nowhere to practise it is a diagnosis with no way
                through. On the hub the hub door is the page you are on. */}
            <div className={hub ? "flex flex-wrap items-center gap-x-4 gap-y-3 pt-1" : "space-y-3"}>
                {!hub && <p className="font-display font-extrabold text-foreground text-lg lg:text-xl">Try it</p>}
                <GuideDoors doors={guide.doors} skip={hub ? ["hub", "read"] : []} />
                <Link to={`/Guides?ref=${TERMS_KEY}`} className="inline-block text-sm font-bold text-primary hover:underline underline-offset-2">
                    What each command term asks for
                </Link>
                {hub && (
                    <Link to={guide.href} className="text-sm font-bold text-muted-foreground hover:text-foreground">
                        The full guide
                    </Link>
                )}
            </div>
        </div>
    );
}
