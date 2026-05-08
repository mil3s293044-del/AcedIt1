import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MarkdownMath from '@/components/shared/MarkdownMath';

/**
 * AIFeedbackModal — sleek full-height dialog for AI-generated content.
 * Uses the design system tokens (no per-tool color maps). The `accentColor`
 * prop is accepted for backwards compatibility but ignored; everything reads
 * from --primary so a single rebrand updates every tool's result modal.
 */
export default function AIFeedbackModal({
    open, onClose,
    title, subject, badge,
    content,
    isStreaming = false,
    /* accentColor (unused — kept for backwards compatibility) */
    actions = []
}) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[92vh] p-0 overflow-hidden flex flex-col gap-0 bg-surface">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-surface flex-shrink-0">
                    <div className="w-1 h-8 bg-primary rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="font-display font-extrabold text-foreground text-sm leading-tight truncate">{title}</p>
                        {subject && <p className="text-xs text-muted-foreground mt-0.5">{subject}</p>}
                    </div>
                    {badge && (
                        <span className="pill bg-primary/10 text-primary flex-shrink-0">{badge}</span>
                    )}
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                        {actions.map((action, i) => (
                            <Button
                                key={i}
                                size="sm"
                                variant={action.variant || 'outline'}
                                onClick={action.onClick}
                                disabled={action.disabled}
                                className={action.className || ''}
                            >
                                {action.icon && <action.icon className="w-3.5 h-3.5" />}
                                {action.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 px-6 py-5 bg-surface text-sm text-foreground/85 leading-relaxed">
                    <MarkdownMath isStreaming={isStreaming}>{content || ''}</MarkdownMath>
                </div>
            </DialogContent>
        </Dialog>
    );
}
