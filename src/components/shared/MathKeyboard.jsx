import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MathKeyboard = ({ onInput }) => {
    const [activeTab, setActiveTab] = useState("functions");
    const [shiftActive, setShiftActive] = useState(false);
    const [showLimitDialog, setShowLimitDialog] = useState(false);
    const [showLogDialog, setShowLogDialog] = useState(false);
    const [showSumDialog, setShowSumDialog] = useState(false);
    const [showMatrixDialog, setShowMatrixDialog] = useState(false);
    const [limitVar, setLimitVar] = useState("x");
    const [limitApproach, setLimitApproach] = useState("0");
    const [logBase, setLogBase] = useState("10");
    const [sumVar, setSumVar] = useState("n");
    const [sumStart, setSumStart] = useState("1");
    const [sumEnd, setSumEnd] = useState("n");
    const [matrixRows, setMatrixRows] = useState(2);
    const [matrixCols, setMatrixCols] = useState(2);



    const functionsKeys = {
        operations: [
            { label: "+", value: "+" },
            { label: "−", value: "-" },
            { label: "×", value: "*" },
            { label: "÷", value: "/" },
            { label: "=", value: "=" },
            { label: "±", value: "\\pm" },
            { label: "≈", value: "\\approx" }
        ],
        exponents: [
            { label: "xⁿ", type: "smart_power_n" },
            { label: "x²", type: "smart_power_2" },
            { label: "√x", type: "smart_sqrt" },
            { label: "ⁿ√x", type: "smart_root_n" },
            { label: "a/b", value: "\\frac{a}{b}" }
        ],
        trigonometry: [
            { label: "sin", value: "\\sin(" },
            { label: "cos", value: "\\cos(" },
            { label: "tan", value: "\\tan(" },
            { label: "sin⁻¹", value: "\\sin^{-1}(" },
            { label: "cos⁻¹", value: "\\cos^{-1}(" },
            { label: "tan⁻¹", value: "\\tan^{-1}(" }
        ],
        logs: [
            { label: "ln", value: "\\ln(" },
            { label: "log", type: "log" },
            { label: "e", value: "e" },
            { label: "eˣ", value: "e^{x}" },
            { label: "π", value: "\\pi" }
        ],
        calculus: [
            { label: "∑", type: "sum" },
            { label: "∫", value: "\\int" },
            { label: "∫ₐᵇ", value: "\\int_{a}^{b}" },
            { label: "d/dx", value: "\\frac{d}{dx}" },
            { label: "lim", type: "limit" },
            { label: "|x|", value: "|x|" }
        ],
        linear_algebra: [
            { label: "Matrix", type: "matrix" },
            { label: "a·b", value: "\\vec{a} \\cdot \\vec{b}" },
            { label: "a×b", value: "\\vec{a} \\times \\vec{b}" },
            { label: "det", value: "\\det(" }
        ],
        imaginary: [
            { label: "i", value: "i" },
            { label: "cis(θ)", value: "\\text{cis}(\\theta)" },
            { label: "e^(iθ)", value: "e^{i\\theta}" },
            { label: "Re(z)", value: "\\text{Re}(z)" },
            { label: "Im(z)", value: "\\text{Im}(z)" }
        ]
    };

    const lettersSymbolsKeys = [
        [
            { label: "x", value: "x" },
            { label: "y", value: "y" },
            { label: "z", value: "z" },
            { label: "a", value: "a" },
            { label: "b", value: "b" },
            { label: "c", value: "c" }
        ],
        [
            { label: "n", value: "n" },
            { label: "m", value: "m" },
            { label: "t", value: "t" },
            { label: "d", value: "d" },
            { label: "f", value: "f" },
            { label: "g", value: "g" }
        ],
        [
            { label: "α", value: "\\alpha" },
            { label: "β", value: "\\beta" },
            { label: "γ", value: "\\gamma" },
            { label: "λ", value: "\\lambda" },
            { label: "μ", value: "\\mu" },
            { label: "σ", value: "\\sigma" }
        ],
        [
            { label: "ℝ", value: "\\mathbb{R}" },
            { label: "ℂ", value: "\\mathbb{C}" },
            { label: "ℚ", value: "\\mathbb{Q}" },
            { label: "ℤ", value: "\\mathbb{Z}" },
            { label: "ℕ", value: "\\mathbb{N}" },
            { label: "∅", value: "\\emptyset" }
        ],
        [
            { label: "≤", value: "\\leq" },
            { label: "≥", value: "\\geq" },
            { label: "≠", value: "\\neq" },
            { label: "[", value: "[" },
            { label: "]", value: "]" },
            { label: "{", value: "{" }
        ],
        [
            { label: "}", value: "}" },
            { label: "∈", value: "\\in" },
            { label: "∞", value: "\\infty" },
            { label: "°", value: "^\\circ" },
            { label: "(", value: "(" }
        ],
        [
            { label: ")", value: ")" },
            { label: ",", value: "," },
            { label: ".", value: "." }
        ]
    ];

    // Update function signature to match QuizPlayer expectations
    const enhancedOnInput = (value, options) => {
        if (onInput) {
            onInput(value, options);
        }
    };

    const handleKeyPress = (key) => {
        if (key.type === "limit") {
            setShowLimitDialog(true);
        } else if (key.type === "log") {
            setShowLogDialog(true);
        } else if (key.type === "sum") {
            setShowSumDialog(true);
        } else if (key.type === "matrix") {
            setShowMatrixDialog(true);
        } else if (key.type === "shift") {
            setShiftActive(!shiftActive);
        } else if (key.type === "smart_power_n" || key.type === "smart_power_2" || key.type === "smart_sqrt" || key.type === "smart_root_n") {
            // Smart replacement for powers and roots
            let value = "";
            if (key.type === "smart_power_n") {
                value = "x^{n}";
            } else if (key.type === "smart_power_2") {
                value = "x^{2}";
            } else if (key.type === "smart_sqrt") {
                value = "\\sqrt{x}";
            } else if (key.type === "smart_root_n") {
                value = "\\sqrt[n]{x}";
            }
            enhancedOnInput(value, { replaceLastToken: true });
        } else if (key.value) {
            enhancedOnInput(key.value);
        }
    };

    const renderKeyboard = (sections) => {
        if (Array.isArray(sections)) {
            // Letters tab - keep old rendering
            return (
                <div className="space-y-2">
                    {sections.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex gap-2 justify-center">
                        {row.map((key, keyIndex) => (
                            <Button
                                key={keyIndex}
                                variant="outline"
                                onClick={() => handleKeyPress(key)}
                                className="h-14 min-w-[60px] px-3 font-normal bg-surface hover:bg-secondary/50 text-foreground border-border hover:border-purple-400 active:bg-purple-50 transition-all"
                            >
                                <span className="text-lg font-normal">
                                    {key.label}
                                </span>
                            </Button>
                        ))}
                        </div>
                    ))}
                </div>
            );
        }
        
        // Functions tab - new organized rendering
        return (
            <div className="space-y-5">
                {Object.entries(sections).map(([sectionName, keys]) => (
                    <div key={sectionName} className="space-y-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                            {sectionName === 'operations' ? 'Operations' : 
                             sectionName === 'exponents' ? 'Exponents & Roots' :
                             sectionName === 'trigonometry' ? 'Trigonometry' :
                             sectionName === 'logs' ? 'Logarithms & Constants' :
                             sectionName === 'calculus' ? '∫ Calculus' :
                             sectionName === 'linear_algebra' ? 'Linear Algebra' :
                             sectionName === 'imaginary' ? 'i Complex Numbers' : sectionName}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {keys.map((key, keyIndex) => (
                                <Button
                                    key={keyIndex}
                                    onClick={() => handleKeyPress(key)}
                                    variant="outline"
                                    className="h-12 px-4 text-base font-semibold bg-surface hover:bg-secondary/50 text-foreground border-border hover:border-purple-400 active:bg-purple-50 transition-all shadow-sm"
                                >
                                    {key.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <>
            <Card className="bg-gradient-to-br from-gray-50 via-white to-gray-50 border-border shadow-xl">
                <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setShiftActive(false); }} className="p-4">
                    <TabsList className="grid w-full grid-cols-2 mb-4 bg-secondary/80 p-1.5 h-12 rounded-xl">
                        <TabsTrigger 
                            value="functions" 
                            className="text-base font-bold data-[state=active]:bg-surface data-[state=active]:shadow-md rounded-lg transition-all"
                        >
                            Functions
                        </TabsTrigger>
                        <TabsTrigger 
                            value="letters" 
                            className="text-base font-bold data-[state=active]:bg-surface data-[state=active]:shadow-md rounded-lg transition-all"
                        >
                            Letters
                        </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="functions" className="mt-0">
                        {renderKeyboard(functionsKeys)}
                    </TabsContent>
                    
                    <TabsContent value="letters" className="mt-0">
                        {renderKeyboard(lettersSymbolsKeys)}
                    </TabsContent>
                </Tabs>
            </Card>

            <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Limit Notation</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Variable</label>
                            <Input
                                type="text"
                                value={limitVar}
                                onChange={(e) => setLimitVar(e.target.value)}
                                placeholder="e.g., x, n, t"
                                className="text-base"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Approaches</label>
                            <Input
                                type="text"
                                value={limitApproach}
                                onChange={(e) => setLimitApproach(e.target.value)}
                                placeholder="e.g., 0, ∞, a"
                                className="text-base"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowLimitDialog(false)}>Cancel</Button>
                        <Button onClick={() => {
                            if (limitVar && limitApproach && onInput) {
                                onInput(`\\lim_{${limitVar} \\to ${limitApproach}}`);
                            }
                            setShowLimitDialog(false);
                        }} disabled={!limitVar || !limitApproach}>Insert Limit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Logarithm with Custom Base</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Base</label>
                        <Input
                            type="text"
                            value={logBase}
                            onChange={(e) => setLogBase(e.target.value)}
                            placeholder="e.g., 2, 10, e"
                            className="text-base"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowLogDialog(false)}>Cancel</Button>
                        <Button onClick={() => {
                            if (logBase && onInput) {
                                onInput(`\\log_{${logBase}}(`);
                            }
                            setShowLogDialog(false);
                        }} disabled={!logBase}>Insert Log</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showSumDialog} onOpenChange={setShowSumDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Summation Notation</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Variable</label>
                            <Input
                                type="text"
                                value={sumVar}
                                onChange={(e) => setSumVar(e.target.value)}
                                placeholder="e.g., n, i, k"
                                className="text-base"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Starting Value</label>
                            <Input
                                type="text"
                                value={sumStart}
                                onChange={(e) => setSumStart(e.target.value)}
                                placeholder="e.g., 1, 0"
                                className="text-base"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Ending Value</label>
                            <Input
                                type="text"
                                value={sumEnd}
                                onChange={(e) => setSumEnd(e.target.value)}
                                placeholder="e.g., n, ∞"
                                className="text-base"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSumDialog(false)}>Cancel</Button>
                        <Button onClick={() => {
                            if (sumVar && sumStart && sumEnd) {
                                enhancedOnInput(`\\sum_{${sumVar}=${sumStart}}^{${sumEnd}}`);
                            }
                            setShowSumDialog(false);
                        }} disabled={!sumVar || !sumStart || !sumEnd}>Insert Sum</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showMatrixDialog} onOpenChange={setShowMatrixDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Matrix Dimensions</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Rows</label>
                            <Select value={matrixRows.toString()} onValueChange={(val) => setMatrixRows(parseInt(val))}>
                                <SelectTrigger className="text-base">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Columns</label>
                            <Select value={matrixCols.toString()} onValueChange={(val) => setMatrixCols(parseInt(val))}>
                                <SelectTrigger className="text-base">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-xs text-muted-foreground">Creates a {matrixRows}×{matrixCols} matrix</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowMatrixDialog(false)}>Cancel</Button>
                        <Button onClick={() => {
                            if (matrixRows && matrixCols) {
                                const matrixContent = Array(matrixRows).fill(0).map(() => 
                                    Array(matrixCols).fill("a").join(" & ")
                                ).join(" \\\\ ");
                                enhancedOnInput(`\\begin{bmatrix} ${matrixContent} \\end{bmatrix}`);
                            }
                            setShowMatrixDialog(false);
                        }}>Insert Matrix</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </>
    );
};

export default MathKeyboard;