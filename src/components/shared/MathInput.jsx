import React, { useRef, useState } from "react";
import { LatexBlock, processLatexContent } from "./LatexRenderer";
import ReactMarkdown from "react-markdown";

// Convert input to LaTeX format for display
const convertToLatex = (text) => {
    if (!text) return "";
    
    // Split by newlines and process each line
    const lines = text.split('\n');
    const processedLines = lines.map(line => {
        let result = line;
        
        // Convert powers: x^2 -> x^{2}, x^-2 -> x^{-2}
        result = result.replace(/\^(-?\w+|\{[^}]+\})/g, (match, exp) => {
            if (exp.startsWith('{')) return `^${exp}`;
            return `^{${exp}}`;
        });
        
        // Convert subscripts: x_n -> x_{n}
        result = result.replace(/_(\w+|\{[^}]+\})/g, (match, sub) => {
            if (sub.startsWith('{')) return `_${sub}`;
            return `_{${sub}}`;
        });
        
        // Detect fractions: a/b -> \frac{a}{b}
        result = result.replace(/(\d+|[a-z])\/(\d+|[a-z])/gi, (match, num, den) => {
            return `\\frac{${num}}{${den}}`;
        });
        
        // Convert roots: √(x) -> \sqrt{x}, ³√(x) -> \sqrt[3]{x}
        result = result.replace(/([²³⁴⁵⁶⁷⁸⁹ⁿ])√\(([^)]+)\)/g, (match, index, content) => {
            const indexMap = {'²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','ⁿ':'n'};
            return `\\sqrt[${indexMap[index] || index}]{${content}}`;
        });
        result = result.replace(/√\(([^)]+)\)/g, '\\sqrt{$1}');
        
        return result;
    });
    
    // Join with LaTeX line breaks and wrap in display math mode
    return `$$${processedLines.join(' \\\\ ')}$$`;
};

export default function MathInput({ value, onChange, className, placeholder, rows = 8, onCursorPositionChange, textareaRef: externalRef }) {
    const internalRef = useRef(null);
    const textareaRef = externalRef || internalRef;
    const [focused, setFocused] = useState(false);
    const [isEditingPreview, setIsEditingPreview] = useState(false);
    const [previewEditValue, setPreviewEditValue] = useState("");
    const previewEditRef = useRef(null);
    
    const handleChange = (e) => {
        onChange?.(e.target.value);
        if (textareaRef.current && onCursorPositionChange) {
            onCursorPositionChange(textareaRef.current.selectionStart);
        }
    };
    
    const handleSelect = () => {
        if (textareaRef.current && onCursorPositionChange) {
            onCursorPositionChange(textareaRef.current.selectionStart);
        }
    };
    
    return (
        <div className="relative space-y-2">
            {/* LaTeX formatted display */}
            <div
                className={`w-full overflow-auto border rounded-lg p-4 bg-white min-h-[200px] ${
                    focused ? 'ring-2 ring-purple-500 border-purple-500' : 'border-gray-300'
                } ${className}`}
            >
                {value ? (
                    <div className="text-lg">
                        {processLatexContent(convertToLatex(value)).map((part, idx) => {
                            if (part.type === 'display') {
                                return <LatexBlock key={idx}>{part.content}</LatexBlock>;
                            } else if (part.type === 'text') {
                                return (
                                    <ReactMarkdown key={idx} components={{
                                        p: ({children}) => <p className="my-1">{children}</p>
                                    }}>
                                        {part.content}
                                    </ReactMarkdown>
                                );
                            }
                            return null;
                        })}
                    </div>
                ) : (
                    <span className="text-gray-400 text-lg">{placeholder || "Your equation appears here"}</span>
                )}
            </div>
            
            {/* Input textarea */}
            <textarea
                ref={textareaRef}
                value={value || ""}
                onChange={handleChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSelect={handleSelect}
                onClick={handleSelect}
                onKeyUp={handleSelect}
                placeholder="Type here (e.g., x^2, a/b, √(x)) or edit LaTeX above"
                rows={rows}
                className="w-full border rounded-lg p-3 font-mono text-base focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
        </div>
    );
}