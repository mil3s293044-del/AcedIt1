import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * EmptyState — one consistent layout for every "you don't have any X yet"
 * surface across the app (Goals, Friends, Quizzes, Subjects, Support history…).
 *
 * Usage:
 *   <EmptyState
 *     icon={Trophy}
 *     title="No goals yet"
 *     description="Set your first study goal to start tracking progress."
 *     actionLabel="Create your first goal"
 *     onAction={() => setOpen(true)}
 *     // or pass `actionHref` to link instead of onClick:
 *     // actionHref={createPageUrl("Goals")}
 *   />
 *
 * Variants:
 *   - tone="primary" (default) — green icon halo, primary CTA
 *   - tone="muted"             — neutral icon halo, secondary CTA
 *
 * Sizing:
 *   - size="md" (default) for full-page empty states
 *   - size="sm" for in-card / tab-pane empty states
 */
export default function EmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    actionHref,
    tone = "primary",
    size = "md",
    className = "",
}) {
    const iconWrapClass = tone === "primary"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";

    const iconSize     = size === "sm" ? "w-10 h-10" : "w-16 h-16";
    const iconInner    = size === "sm" ? "w-5 h-5"   : "w-8 h-8";
    const titleSize    = size === "sm" ? "text-base" : "text-xl";
    const descSize     = size === "sm" ? "text-xs"   : "text-sm";
    const verticalPad  = size === "sm" ? "py-8"      : "py-16";

    const ActionInner = actionLabel
        ? <Button onClick={onAction} className="btn-3d bg-primary text-primary-foreground hover:bg-primary">{actionLabel}</Button>
        : null;

    return (
        <div className={`flex flex-col items-center justify-center text-center ${verticalPad} px-6 ${className}`}>
            {Icon && (
                <div className={`${iconSize} rounded-full ${iconWrapClass} flex items-center justify-center mb-4`}>
                    <Icon className={iconInner} strokeWidth={2.5} />
                </div>
            )}
            {title && (
                <h3 className={`font-display font-extrabold text-foreground ${titleSize} mb-1.5`}>
                    {title}
                </h3>
            )}
            {description && (
                <p className={`text-muted-foreground ${descSize} max-w-sm leading-relaxed`}>
                    {description}
                </p>
            )}
            {actionLabel && (
                <div className="mt-5">
                    {actionHref
                        ? <Link to={actionHref}>{ActionInner}</Link>
                        : ActionInner}
                </div>
            )}
        </div>
    );
}
