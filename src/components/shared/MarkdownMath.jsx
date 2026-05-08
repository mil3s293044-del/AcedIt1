import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import useStreamedText from "@/lib/useStreamedText";

// Render a string that may contain markdown (lists, bold, headings, GFM tables)
// and LaTeX math segments wrapped in $...$ or $$...$$.
//
//   • remark-math parses math as part of the markdown AST.
//   • rehype-katex renders the math.
//   • remark-gfm enables GitHub Flavored Markdown — tables, strikethrough,
//     task lists, autolinks. Without this, AI-generated tables show up as raw
//     pipe-and-dash text in the page.

const MD_COMPONENTS = {
    p:   ({ node, ...props }) => <p   className="mb-2 last:mb-0 leading-relaxed" {...props} />,
    ul:  ({ node, ...props }) => <ul  className="list-disc pl-5 space-y-1 mb-3 last:mb-0" {...props} />,
    ol:  ({ node, ...props }) => <ol  className="list-decimal pl-5 space-y-1 mb-3 last:mb-0" {...props} />,
    li:  ({ node, ...props }) => <li  className="leading-relaxed" {...props} />,
    h1:  ({ node, ...props }) => <h2  className="font-display font-extrabold text-foreground text-lg mt-5 first:mt-0 mb-2" {...props} />,
    h2:  ({ node, ...props }) => (
        <div className="flex items-center gap-2.5 mt-5 first:mt-0 mb-2">
            <div className="w-1 h-5 bg-primary rounded-full flex-shrink-0" />
            <h3 className="font-display font-extrabold text-foreground text-base m-0" {...props} />
        </div>
    ),
    h3:  ({ node, ...props }) => <h4 className="font-display font-extrabold text-foreground text-sm mt-4 first:mt-0 mb-1.5" {...props} />,
    h4:  ({ node, ...props }) => <h5 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider mt-3 first:mt-0 mb-1" {...props} />,
    blockquote: ({ node, ...props }) => (
        <blockquote className="border-l-4 border-primary pl-4 py-2 my-3 rounded-r-xl bg-primary/5 text-foreground italic" {...props} />
    ),
    strong: ({ node, ...props }) => <strong className="font-extrabold text-foreground" {...props} />,
    em: ({ node, ...props }) => <em className="italic text-foreground/90" {...props} />,
    a:  ({ node, ...props }) => <a className="text-primary font-bold hover:underline" {...props} />,
    hr: () => <hr className="my-4 border-border" />,
    code: ({ node, inline, ...props }) => inline
        ? <code className="px-1.5 py-0.5 rounded bg-secondary text-foreground font-mono text-[0.9em]" {...props} />
        : <code className="block p-3 rounded-xl bg-secondary text-foreground font-mono text-xs overflow-x-auto" {...props} />,
    table: ({ node, ...props }) => (
        <div className="overflow-x-auto my-3 rounded-xl border border-border">
            <table className="w-full text-xs" {...props} />
        </div>
    ),
    th: ({ node, ...props }) => <th className="bg-secondary px-3 py-2 text-left font-bold text-foreground border-b border-border" {...props} />,
    td: ({ node, ...props }) => <td className="px-3 py-2 text-foreground border-b border-border" {...props} />,
};

export default function MarkdownMath({ children, className = "", isStreaming = false }) {
    const target = children ? children.toString() : "";
    // When streaming, smooth bursty network deliveries into a steady typewriter
    // feel. When not streaming, the hook flushes the full text immediately, so
    // saved/static content renders as-is with no animation cost.
    const visible = useStreamedText(target, isStreaming);
    if (!visible) return null;
    return (
        <div className={`prose-none break-words ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={MD_COMPONENTS}
            >
                {visible}
            </ReactMarkdown>
            {isStreaming && (
                <span
                    aria-hidden="true"
                    className="inline-block w-[6px] h-[1em] -mb-[2px] bg-foreground/80 align-middle ml-[2px] animate-pulse"
                />
            )}
        </div>
    );
}
