import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";

const CHALLENGE_LABELS = {
    forget: "I study for hours but forget everything",
    time: "I never have enough time before SACs",
    weak: "I don't know what I'm actually weak at",
    motivated: "I struggle to stay motivated",
    writing: "I don't know how to write strong responses",
    burnout: "Exam pressure and burnout are getting to me",
};

export default function Step7Summary({ data, onNext, onBack }) {
    const [persona, setPersona] = useState("");
    const [loading, setLoading] = useState(true);

    const challenges = data?.primary_challenge
        ? (Array.isArray(data.primary_challenge) ? data.primary_challenge : [data.primary_challenge])
        : [];
    const challengeLabels = challenges.map(c => CHALLENGE_LABELS[c]).filter(Boolean);
    const name = data?.display_name || "you";
    const firstName = name.split(" ")[0];

    useEffect(() => {
        const generate = async () => {
            try {
                const prompt = `You are an encouraging VCE study coach. Write a single short paragraph (2-3 sentences max) as a personalised study persona summary for a student with these details:
- Name: ${name}
- Year level: ${data?.year_level || "Year 12"}
- Subjects: ${(data?.enrolled_subjects || []).join(", ") || "not specified"}
- Biggest challenges: ${challengeLabels.join(", ") || "general study improvement"}
- Goal: ${data?.qualitative_goal || "achieve their best ATAR"}
- Dream course/career: ${data?.dream_course || "not specified"}

Write it in second person ("You're a..."). Be specific, warm, and motivating. Make it feel like it was written just for them.`;

                const result = await base44.integrations.Core.InvokeLLM({ prompt });
                setPersona(typeof result === "string" ? result : result?.content || "");
            } catch {
                setPersona(`You're a ${data?.year_level || "Year 12"} student ready to take control of your study. AcedIt will personalise every tool around your specific challenges and keep your effort converting into real results.`);
            } finally {
                setLoading(false);
            }
        };
        generate();
    }, []);

    return (
        <div className="max-w-lg mx-auto px-6 py-10">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-6">
                <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-1">{firstName}, here's your AcedIt starting point</h2>
            <p className="text-gray-500 text-sm mb-8">Everything we'll personalise around you.</p>

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="space-y-4 mb-8"
            >
                {/* Subjects */}
                {(data?.enrolled_subjects || []).length > 0 && (
                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Your subjects</p>
                        <div className="flex flex-wrap gap-2">
                            {data.enrolled_subjects.map((s, i) => (
                                <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: "#F0EEFF", color: "#534AB7" }}>{s}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Challenges */}
                {challengeLabels.length > 0 && (
                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Your biggest challenges</p>
                        <div className="space-y-1">
                            {challengeLabels.map((c, i) => (
                                <p key={i} className="text-sm text-gray-700">• {c}</p>
                            ))}
                        </div>
                    </div>
                )}

                {/* Goal */}
                {data?.qualitative_goal && (
                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Your goal</p>
                        <p className="text-sm text-gray-700">{data.qualitative_goal}</p>
                    </div>
                )}

                {/* Dream course */}
                {data?.dream_course && (
                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Dream course / career</p>
                        <p className="text-sm text-gray-700">{data.dream_course}</p>
                    </div>
                )}

                {/* AI persona */}
                <div className="rounded-xl p-4" style={{ backgroundColor: "#F0EEFF" }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#534AB7" }}>Your study persona</p>
                    {loading ? (
                        <div className="flex items-center gap-2 text-purple-600 text-xs">
                            <Loader2 className="w-3 h-3 animate-spin" /> Generating your personalised summary...
                        </div>
                    ) : (
                        <p className="text-sm text-purple-900 leading-relaxed">{persona}</p>
                    )}
                </div>

                <p className="text-center text-sm font-semibold text-gray-500 pt-2">Your personalised study tools are ready.</p>
            </motion.div>

            <Button
                onClick={onNext}
                disabled={loading}
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: "#534AB7" }}
            >
                Show me →
            </Button>
        </div>
    );
}