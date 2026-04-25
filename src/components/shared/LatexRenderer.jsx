import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

// Parse a string into segments: plain text, inline \(...\) or $...$, display \[...\] or $$...$$
export function processLatexContent(text) {
    if (!text) return [];
    const segments = [];
    const pattern = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$\n]*?\$|\\\([\s\S]*?\\\))/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
        }
        const raw = match[0];
        const isDisplay = raw.startsWith('$$') || raw.startsWith('\\[');
        const content = raw.startsWith('$$')
            ? raw.slice(2, -2)
            : raw.startsWith('\\[')
                ? raw.slice(2, -2)
                : raw.startsWith('$')
                    ? raw.slice(1, -1)
                    : raw.slice(2, -2);
        segments.push({ type: isDisplay ? 'display' : 'inline', content: content.trim() });
        lastIndex = match.index + raw.length;
    }
    if (lastIndex < text.length) {
        segments.push({ type: 'text', content: text.slice(lastIndex) });
    }
    return segments.length ? segments : [{ type: 'text', content: text }];
}

// Renders a single inline KaTeX expression
export function LatexInline({ children }) {
    if (!children) return null;
    return (
        <InlineMath
            math={children.toString().trim()}
            renderError={(err) => <span>{children}</span>}
        />
    );
}

// Renders a single display/block KaTeX expression
export function LatexBlock({ children }) {
    if (!children) return null;
    return (
        <div className="my-3 overflow-x-auto text-center">
            <BlockMath
                math={children.toString().trim()}
                renderError={(err) => <span>{children}</span>}
            />
        </div>
    );
}

// Main reusable MathText component: renders a string with mixed text and LaTeX
export default function MathText({ children, className = '' }) {
    if (!children) return null;
    const segments = processLatexContent(children.toString());
    return (
        <span className={className}>
            {segments.map((seg, i) => {
                if (seg.type === 'display') return <LatexBlock key={i}>{seg.content}</LatexBlock>;
                if (seg.type === 'inline') return <LatexInline key={i}>{seg.content}</LatexInline>;
                return <span key={i}>{seg.content}</span>;
            })}
        </span>
    );
}