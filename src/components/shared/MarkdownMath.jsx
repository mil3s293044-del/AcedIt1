import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import useStreamedText from "@/lib/useStreamedText";
import { cleanText } from "@/lib/questionText";

// Render a string that may contain markdown (lists, bold, headings, GFM tables)
// and LaTeX math segments wrapped in $...$ or $$...$$.
//
//   • remark-math parses math as part of the markdown AST.
//   • rehype-katex renders the math.
//   • remark-gfm enables GitHub Flavored Markdown — tables, strikethrough,
//     task lists, autolinks. Without this, AI-generated tables show up as raw
//     pipe-and-dash text in the page.
//   • remarkSoftBreaks draws a single line break as a break. A model writes
//     "(a) … (1 mark)\n(b) …" meaning two lines, and CommonMark folds a lone
//     line ending into a space, so a five-part question read as one paragraph.
//   • Everything is run through `cleanText` first (questionText.js): a model
//     that doubled its newline escape along with its LaTeX backslashes wrote
//     the two characters `\n`, and a student saw them.

/**
 * A soft line ending inside a paragraph becomes a hard break. Written here
 * rather than added as `remark-breaks`, which is twenty lines and a dependency.
 * Only TEXT is split: maths, inline code and code blocks are other node types,
 * so a line break inside them is untouched.
 */
function remarkSoftBreaks() {
    const walk = (node) => {
        if (!Array.isArray(node.children)) return;
        const next = [];
        for (const child of node.children) {
            if (child.type === "text" && child.value.includes("\n")) {
                child.value.split("\n").forEach((piece, i) => {
                    if (i > 0) next.push({ type: "break" });
                    if (piece) next.push({ type: "text", value: piece });
                });
            } else {
                walk(child);
                next.push(child);
            }
        }
        node.children = next;
    };
    return (tree) => walk(tree);
}

const MD_COMPONENTS = {
    p:   ({ node: _node, ...props }) => <p   className="mb-2 last:mb-0 leading-relaxed" {...props} />,
    ul:  ({ node: _node, ...props }) => <ul  className="list-disc pl-5 space-y-1 mb-3 last:mb-0" {...props} />,
    ol:  ({ node: _node, ...props }) => <ol  className="list-decimal pl-5 space-y-1 mb-3 last:mb-0" {...props} />,
    li:  ({ node: _node, ...props }) => <li  className="leading-relaxed" {...props} />,
    h1:  ({ node: _node, ...props }) => <h2  className="font-display font-extrabold text-foreground text-lg mt-5 first:mt-0 mb-2" {...props} />,
    h2:  ({ node: _node, ...props }) => (
        <div className="flex items-center gap-2.5 mt-5 first:mt-0 mb-2">
            <div className="w-1 h-5 bg-primary rounded-full flex-shrink-0" />
            <h3 className="font-display font-extrabold text-foreground text-base m-0" {...props} />
        </div>
    ),
    h3:  ({ node: _node, ...props }) => <h4 className="font-display font-extrabold text-foreground text-sm mt-4 first:mt-0 mb-1.5" {...props} />,
    h4:  ({ node: _node, ...props }) => <h5 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider mt-3 first:mt-0 mb-1" {...props} />,
    blockquote: ({ node: _node, ...props }) => (
        <blockquote className="border-l-4 border-primary pl-4 py-2 my-3 rounded-r-xl bg-primary/5 text-foreground italic" {...props} />
    ),
    strong: ({ node: _node, ...props }) => <strong className="font-extrabold text-foreground" {...props} />,
    em: ({ node: _node, ...props }) => <em className="italic text-foreground/90" {...props} />,
    a:  ({ node: _node, ...props }) => <a className="text-primary font-bold hover:underline" {...props} />,
    hr: () => <hr className="my-4 border-border" />,
    code: ({ node: _node, inline, ...props }) => inline
        ? <code className="px-1.5 py-0.5 rounded bg-secondary text-foreground font-mono text-[0.9em]" {...props} />
        : <code className="block p-3 rounded-xl bg-secondary text-foreground font-mono text-xs overflow-x-auto" {...props} />,
    table: ({ node: _node, ...props }) => (
        <div className="overflow-x-auto my-3 rounded-xl border border-border">
            <table className="w-full text-xs" {...props} />
        </div>
    ),
    th: ({ node: _node, ...props }) => <th className="bg-secondary px-3 py-2 text-left font-bold text-foreground border-b border-border" {...props} />,
    td: ({ node: _node, ...props }) => <td className="px-3 py-2 text-foreground border-b border-border" {...props} />,
};

/**
 * A full stop after inline maths may not wrap onto a line of its own. KaTeX
 * draws a formula as inline-blocks, a line may break after an inline-block, and
 * Chrome takes that break even past a word joiner — so "…is
 * $29.6\ \text{kJ g}^{-1}$." ended a question stem with a lone "." on the
 * next line. The formula and the punctuation go in one `nowrap` span.
 *
 * ONLY A SHORT FORMULA. `nowrap` makes the pair unbreakable, and a long inline
 * equation that cannot wrap is an overflow on a phone — far worse than a
 * stray full stop. A unit or a value (the case this is for) is well under
 * `GLUE_MAX` visible characters; anything longer keeps its line breaks.
 */
const GLUE_MAX = 24;
const LEADING_PUNCT = /^[.,;:!?)\]]+/;
const classes = (n) => (n?.type === "element" ? n.properties?.className || [] : []);
const visibleText = (n) => {
    if (n.type === "text") return n.value;
    // The MathML copy is for screen readers, and is not what takes up the line.
    if (classes(n).includes("katex-mathml")) return "";
    return (n.children || []).map(visibleText).join("");
};
function rehypeGluePunctuation() {
    const walk = (node) => {
        if (!Array.isArray(node.children)) return;
        node.children = node.children.map((child, i) => {
            if (!classes(child).includes("katex")) { walk(child); return child; }
            const next = node.children[i + 1];
            const punct = next?.type === "text" && next.value.match(LEADING_PUNCT);
            if (!punct || visibleText(child).length > GLUE_MAX) return child;
            next.value = next.value.slice(punct[0].length);
            return {
                type: "element", tagName: "span",
                properties: { className: ["whitespace-nowrap"] },
                children: [child, { type: "text", value: punct[0] }],
            };
        });
    };
    return (tree) => walk(tree);
}

export default function MarkdownMath({ children, className = "", isStreaming = false }) {
    // Cleaned BEFORE streaming, so a chunk boundary can never show a repair
    // half-made.
    const target = cleanText(children);
    // When streaming, smooth bursty network deliveries into a steady typewriter
    // feel. When not streaming, the hook flushes the full text immediately, so
    // saved/static content renders as-is with no animation cost.
    const visible = useStreamedText(target, isStreaming);
    if (!visible) return null;
    return (
        <div className={`prose-none break-words ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath, remarkSoftBreaks]}
                rehypePlugins={[rehypeKatex, rehypeGluePunctuation]}
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
