import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';

// Static color maps (no dynamic class construction)
const C = {
    emerald: { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', strong: 'text-emerald-800 bg-emerald-50', quote: 'border-emerald-400 bg-emerald-50 text-emerald-900', dot: 'bg-emerald-400' },
    indigo:  { bar: 'bg-indigo-500',  badge: 'bg-indigo-100 text-indigo-700',   strong: 'text-indigo-800 bg-indigo-50',   quote: 'border-indigo-400 bg-indigo-50 text-indigo-900',   dot: 'bg-indigo-400'  },
    purple:  { bar: 'bg-purple-500',  badge: 'bg-purple-100 text-purple-700',   strong: 'text-purple-800 bg-purple-50',   quote: 'border-purple-400 bg-purple-50 text-purple-900',   dot: 'bg-purple-400'  },
    teal:    { bar: 'bg-teal-500',    badge: 'bg-teal-100 text-teal-700',       strong: 'text-teal-800 bg-teal-50',       quote: 'border-teal-400 bg-teal-50 text-teal-900',         dot: 'bg-teal-400'    },
    rose:    { bar: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700',       strong: 'text-rose-800 bg-rose-50',       quote: 'border-rose-400 bg-rose-50 text-rose-900',         dot: 'bg-rose-400'    },
};

/**
 * AIFeedbackModal — a sleek full-height dialog for displaying AI-generated content.
 * Props:
 *   open, onClose          — dialog state
 *   title, subject, badge  — header metadata
 *   content                — markdown string
 *   accentColor            — 'emerald' | 'indigo' | 'purple' | 'teal' | 'rose'
 *   actions                — [{ label, icon, onClick, variant, className }]
 */
export default function AIFeedbackModal({
    open, onClose,
    title, subject, badge,
    content,
    accentColor = 'emerald',
    actions = []
}) {
    const c = C[accentColor] || C.emerald;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[92vh] p-0 overflow-hidden flex flex-col gap-0">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-white flex-shrink-0">
                    <div className={`w-1 h-8 ${c.bar} rounded-full flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm leading-tight truncate">{title}</p>
                        {subject && <p className="text-xs text-gray-400 mt-0.5">{subject}</p>}
                    </div>
                    {badge && <Badge className={`text-xs border-0 flex-shrink-0 ${c.badge}`}>{badge}</Badge>}
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                        {actions.map((action, i) => (
                            <Button key={i} size="sm" variant={action.variant || 'outline'} onClick={action.onClick}
                                className={`h-8 text-xs px-3 ${action.className || ''}`}>
                                {action.icon && <action.icon className="w-3 h-3 mr-1" />}
                                {action.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 px-6 py-5">
                    <ReactMarkdown
                        components={{
                            h1: ({children}) => <h1 className="text-base font-black text-gray-900 mt-4 mb-2 first:mt-0">{children}</h1>,
                            h2: ({children}) => (
                                <div className="flex items-center gap-2.5 mb-2 mt-6 first:mt-0">
                                    <div className={`w-1 h-5 ${c.bar} rounded-full flex-shrink-0`} />
                                    <h2 className="text-sm font-bold text-gray-900 m-0">{children}</h2>
                                </div>
                            ),
                            h3: ({children}) => (
                                <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-1.5 pl-3 border-l-2 border-gray-200">{children}</h3>
                            ),
                            h4: ({children}) => <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-3 mb-1">{children}</h4>,
                            p: ({children}) => <p className="text-sm text-gray-700 leading-relaxed my-2">{children}</p>,
                            strong: ({children}) => <strong className={`font-semibold px-1 py-0.5 rounded text-xs ${c.strong}`}>{children}</strong>,
                            em: ({children}) => <em className="text-gray-600">{children}</em>,
                            blockquote: ({children}) => (
                                <blockquote className={`border-l-4 pl-4 py-2.5 my-3 rounded-r-xl text-sm not-italic ${c.quote}`}>{children}</blockquote>
                            ),
                            ul: ({children}) => <ul className="space-y-1.5 my-2 pl-0 list-none">{children}</ul>,
                            ol: ({children}) => <ol className="space-y-2 my-2 pl-4 list-decimal">{children}</ol>,
                            li: ({children}) => (
                                <li className="flex items-start gap-2 text-sm text-gray-700 list-none">
                                    <span className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${c.dot}`} />
                                    <span className="leading-relaxed">{children}</span>
                                </li>
                            ),
                            code: ({inline, children}) => inline
                                ? <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                                : <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 my-3 overflow-x-auto text-xs font-mono"><code>{children}</code></pre>,
                            table: ({children}) => (
                                <div className="overflow-x-auto my-3 rounded-xl border border-gray-200 shadow-sm">
                                    <table className="w-full text-xs">{children}</table>
                                </div>
                            ),
                            th: ({children}) => <th className="bg-gray-50 px-3 py-2 text-left font-bold text-gray-700 border-b border-gray-200">{children}</th>,
                            td: ({children}) => <td className="px-3 py-2.5 text-gray-700 border-b border-gray-50">{children}</td>,
                            hr: () => <hr className="my-4 border-gray-100" />,
                        }}
                    >
                        {content || ''}
                    </ReactMarkdown>
                </div>
            </DialogContent>
        </Dialog>
    );
}