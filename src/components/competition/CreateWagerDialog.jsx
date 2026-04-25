import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Target, AlertTriangle, Loader2, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, isPast } from "date-fns";

export default function CreateWagerDialog({ open, onClose, onCreated }) {
    const [assessments, setAssessments] = useState([]);
    const [userProfile, setUserProfile] = useState(null);
    const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
    const [predictedScore, setPredictedScore] = useState(75);
    const [wageredXP, setWageredXP] = useState(50);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (open) loadData();
    }, [open]);

    const loadData = async () => {
        setLoading(true);
        try {
            const user = await base44.auth.me();
            const [allAssessments, profiles, existingWagers] = await Promise.all([
                base44.entities.SubjectAssessment.filter({ created_by: user.email }),
                base44.entities.UserProfile.filter({ created_by: user.email }),
                base44.entities.ScoreWager.filter({ created_by: user.email, status: 'active' })
            ]);
            setUserProfile(profiles[0] || null);

            // Filter: not completed, not already wagered
            const wageredIds = new Set(existingWagers.map(w => w.assessment_id));
            const eligible = allAssessments.filter(a => !a.is_completed && !wageredIds.has(a.id));
            setAssessments(eligible);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!selectedAssessmentId) {
            toast({ title: "Select an assessment", variant: "destructive" });
            return;
        }
        const totalXP = userProfile?.total_xp || 0;
        if (wageredXP > totalXP) {
            toast({ title: "Not enough XP", description: `You only have ${totalXP} XP`, variant: "destructive" });
            return;
        }

        const assessment = assessments.find(a => a.id === selectedAssessmentId);
        if (!assessment) return;

        setCreating(true);
        try {
            const isLocked = assessment.due_date && isPast(parseISO(assessment.due_date));
            await base44.entities.ScoreWager.create({
                assessment_id: assessment.id,
                assessment_title: assessment.title,
                subject_name: assessment.subject_name,
                subject_code: assessment.subject_code || '',
                assessment_type: assessment.assessment_type,
                due_date: assessment.due_date,
                predicted_score: predictedScore,
                wagered_xp: wageredXP,
                status: 'active',
                wager_locked: isLocked
            });

            toast({ title: "Wager placed!", description: `Predicted ${predictedScore}% with ${wageredXP} XP wagered.` });
            onCreated?.();
            onClose();
        } catch (e) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setCreating(false);
        }
    };

    const diff = 5; // example diff for preview
    const previewXP = wageredXP * 3;
    const totalXP = userProfile?.total_xp || 0;
    const maxWager = Math.min(500, totalXP);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-600" />
                        Place a Score Wager
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Assessment selector */}
                        <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-2">Assessment</label>
                            {assessments.length === 0 ? (
                                <div className="text-center py-6 bg-gray-50 rounded-xl border text-gray-500 text-sm">
                                    No eligible assessments found.<br />
                                    <span className="text-xs">Add upcoming assessments in Subjects → Assessments</span>
                                </div>
                            ) : (
                                <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select assessment..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {assessments.map(a => (
                                            <SelectItem key={a.id} value={a.id}>
                                                {a.title} — {a.subject_name} ({a.assessment_type})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Predicted score */}
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <label className="font-semibold text-gray-700">Predicted Score</label>
                                <span className="font-black text-purple-700 text-lg">{predictedScore}%</span>
                            </div>
                            <Slider value={[predictedScore]} onValueChange={([v]) => setPredictedScore(v)} min={0} max={100} step={1} />
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>0%</span><span>50%</span><span>100%</span>
                            </div>
                        </div>

                        {/* Wagered XP */}
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <label className="font-semibold text-gray-700">Wager</label>
                                <span className="font-black text-amber-600 text-lg flex items-center gap-1">
                                    <Zap className="w-4 h-4" />{wageredXP} XP
                                </span>
                            </div>
                            <Slider value={[wageredXP]} onValueChange={([v]) => setWageredXP(v)} min={10} max={maxWager || 500} step={10} />
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>10 XP</span>
                                <span className="text-gray-500">You have {totalXP.toLocaleString()} XP</span>
                                <span>500 XP max</span>
                            </div>
                        </div>

                        {/* Payout preview */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                <p className="text-xs font-semibold text-emerald-700 mb-1">🎯 Exact (±3%)</p>
                                <p className="text-sm font-black text-emerald-700">+{wageredXP * 3} XP</p>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                <p className="text-xs font-semibold text-blue-700 mb-1">✅ Close (±10%)</p>
                                <p className="text-sm font-black text-blue-700">+{Math.round(wageredXP * 1.5)} XP</p>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                <p className="text-xs font-semibold text-red-700 mb-1">❌ Wrong</p>
                                <p className="text-sm font-black text-red-700">-{wageredXP} XP</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <span>Prediction locks after the assessment due date. Enter your actual score afterwards to resolve the wager.</span>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleCreate}
                        disabled={creating || !selectedAssessmentId || assessments.length === 0}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600"
                    >
                        {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                        {creating ? 'Placing...' : 'Place Wager'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}