import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Zap, Lock, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';

const FEATURE_DESCRIPTIONS = {
    'Guides': {
        title: 'Study Guides',
        description: 'Access comprehensive VCE study guides covering all subjects and exam techniques.',
        icon: '📚',
        benefits: ['VCE system guides', 'Subject-specific strategies', 'Exam preparation tips', 'Study technique guides']
    },
    'Ranked': {
        title: 'Ranked Leaderboard',
        description: 'Compete with other students and track your progress on the global leaderboard.',
        icon: '👑',
        benefits: ['Global rankings', 'Compare study stats', 'Achievement badges', 'Motivation boost']
    },
    'Quizzes': {
        title: 'AI Quiz Generator',
        description: 'Generate unlimited quizzes from your notes using AI technology.',
        icon: '🧠',
        benefits: ['Unlimited quiz generation', 'Custom practice questions', 'Multiple choice & short answer', 'Progress tracking']
    },
    'AITools': {
        title: 'AI Study Tools',
        description: 'Unlock powerful AI-powered study tools to accelerate your learning.',
        icon: '🤖',
        benefits: ['Essay planner', 'Concept explainer', 'Question generator', 'Note summarizer', 'Line memoriser', 'Mind mapper']
    },
    'Goals': {
        title: 'Goals & Planning',
        description: 'Advanced goal setting, course planning, and study scheduling tools.',
        icon: '🎯',
        benefits: ['ATAR goal planning', 'University course planner', 'Interactive calendar', 'Custom milestones', 'AI planning assistant']
    },
    'ActiveRecall': {
        title: 'Active Recall Technique',
        description: 'Master advanced study techniques to boost your learning efficiency.',
        icon: '🧠',
        benefits: ['AI-powered question generation', 'Personalized feedback', 'Progress tracking', 'Evidence-based learning']
    },
    'Blurting': {
        title: 'Blurting Method',
        description: 'Advanced memory technique for deep learning and retention.',
        icon: '✍️',
        benefits: ['Free-form knowledge testing', 'AI comparison analysis', 'Gap identification', 'Mastery tracking']
    },
    'ContentSharing': {
        title: 'Content Sharing',
        description: 'Share flashcards, quizzes, and study materials with friends.',
        icon: '🤝',
        benefits: ['Share flashcards', 'Share quizzes', 'Collaborate with friends', 'Build study groups']
    },
    'Analytics': {
        title: 'Advanced Analytics',
        description: 'Deep insights into your study patterns and performance.',
        icon: '📊',
        benefits: ['AI performance analysis', 'Study trend tracking', 'Subject performance breakdown', 'Personalized recommendations']
    }
};

export default function UpgradeModal({ isOpen, onClose, feature, requiredTier, userProfile, isBlocking = false }) {
    const navigate = useNavigate();
    const featureInfo = FEATURE_DESCRIPTIONS[feature] || FEATURE_DESCRIPTIONS['AITools'];
    const currentTier = userProfile?.subscription_tier || 'free';

    const handleUpgrade = () => {
        navigate(createPageUrl('Subscription'));
        if (!isBlocking) onClose();
    };

    const handleGoBack = () => {
        navigate(createPageUrl('Dashboard'));
    };

    return (
        <Dialog open={isOpen} onOpenChange={isBlocking ? undefined : onClose}>
            <DialogContent className="max-w-2xl" hideClose={isBlocking}>
                <DialogHeader>
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center text-4xl">
                            {featureInfo.icon}
                        </div>
                    </div>
                    <DialogTitle className="text-2xl text-center">
                        Upgrade to {requiredTier === 'premium' ? 'Premium' : 'Pro'} to Access {featureInfo.title}
                    </DialogTitle>
                    <DialogDescription className="text-center text-lg">
                        {featureInfo.description}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Current vs Required Tier */}
                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Your Current Plan</p>
                                    <div className="flex items-center gap-2">
                                        {currentTier === 'free' && <Lock className="w-4 h-4 text-muted-foreground" />}
                                        {currentTier === 'pro' && <Zap className="w-4 h-4 text-blue-600" />}
                                        {currentTier === 'premium' && <Crown className="w-4 h-4 text-purple-600" />}
                                        <span className="font-semibold capitalize">{currentTier}</span>
                                    </div>
                                </div>
                                <ArrowRight className="w-5 h-5 text-muted-foreground/60" />
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Required Plan</p>
                                    <div className="flex items-center gap-2">
                                        {requiredTier === 'pro' && <Zap className="w-4 h-4 text-blue-600" />}
                                        {requiredTier === 'premium' && <Crown className="w-4 h-4 text-purple-600" />}
                                        <span className="font-semibold capitalize">{requiredTier}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Benefits */}
                    <div>
                        <h3 className="font-semibold text-foreground mb-3">What you'll get:</h3>
                        <div className="grid gap-2">
                            {featureInfo.benefits.map((benefit, index) => (
                                <div key={index} className="flex items-center gap-3 text-muted-foreground">
                                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-green-600 text-xs">✓</span>
                                    </div>
                                    <span>{benefit}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        {isBlocking && (
                            <Button
                                variant="outline"
                                onClick={handleGoBack}
                                className="flex-1"
                            >
                                Go Back to Dashboard
                            </Button>
                        )}
                        <Button
                            onClick={handleUpgrade}
                            className={`${isBlocking ? 'flex-1' : 'w-full'} ${
                                requiredTier === 'premium' 
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700' 
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                            }`}
                        >
                            {requiredTier === 'premium' && <Crown className="w-4 h-4 mr-2" />}
                            {requiredTier === 'pro' && <Zap className="w-4 h-4 mr-2" />}
                            Upgrade to {requiredTier === 'premium' ? 'Premium' : 'Pro'}
                        </Button>
                    </div>

                    {/* Pricing Info */}
                    <div className="text-center text-sm text-muted-foreground">
                        <p>
                            {requiredTier === 'premium' && 'Only $5 AUD/week for full access'}
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}