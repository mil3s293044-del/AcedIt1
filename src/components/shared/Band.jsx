import React from "react";

/**
 * A section heading with a rule to the end of the row — the Quizzes-shelf
 * idiom: the rule terminates the band, so the space beside a short list is
 * margin somebody chose rather than somewhere content failed to reach.
 * Shared by Friends and Study groups, which list a student's people the same
 * way and should not label them differently.
 */
export default function Band({ title, count = null, aside = null, children, className = "" }) {
    return (
        <section className={`space-y-3 ${className}`}>
            <div className="flex items-center gap-3 min-h-9">
                <h2 className="font-display font-extrabold text-foreground text-lg lg:text-xl whitespace-nowrap">
                    {title}{count != null && <span className="text-muted-foreground font-bold"> · {count}</span>}
                </h2>
                <span className="flex-1 h-px bg-border" aria-hidden />
                {aside}
            </div>
            {children}
        </section>
    );
}
