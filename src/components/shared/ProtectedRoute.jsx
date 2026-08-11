import React, { useEffect, useState } from 'react';
import { User, UserProfile } from '@/entities/all';
import UpgradeModal from './UpgradeModal';
import { getUserTier } from './subscriptionHelpers';
import AceShuffle from "@/components/ace/AceShuffle";

// CRITICAL: Page access control based on database subscription_tier
// Never allow premium pages to render without database verification
const FEATURE_ACCESS = {
    free: ['Dashboard', 'Study', 'Subjects', 'Settings', 'Subscription', 'Friends', 'Quizzes', 'Ranked'],
    premium: ['Dashboard', 'Study', 'Subjects', 'Settings', 'AITools', 'Goals', 'Friends', 'Analytics', 'Subscription', 'Ranked', 'Quizzes']
};

const FEATURE_REQUIREMENTS = {
    'AITools': 'premium',
    'Goals': 'premium',
    'Analytics': 'premium'
};

export default function ProtectedRoute({ pageName, children }) {
    const [userProfile, setUserProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);

    useEffect(() => {
        const checkAccess = async () => {
            try {
                // CRITICAL: Always fetch fresh profile from database
                const currentUser = await User.me();
                const profiles = await UserProfile.filter({ created_by: currentUser.email });
                const profile = profiles[0] || null;
                setUserProfile(profile);

                // CRITICAL: Verify subscription tier from database
                const tier = getUserTier(profile);
                const allowedPages = FEATURE_ACCESS[tier] || FEATURE_ACCESS.free;

                const pageAllowed = allowedPages.includes(pageName);
                setHasAccess(pageAllowed);
                
                if (!pageAllowed) {
                    setShowUpgrade(true);
                }
            } catch (error) {
                console.error("Access check failed:", error);
                // Fail closed - deny access on error
                setHasAccess(false);
                setShowUpgrade(true);
            } finally {
                setIsLoading(false);
            }
        };

        checkAccess();
    }, [pageName]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <AceShuffle size="lg" />
            </div>
        );
    }

    // CRITICAL: Block access if verification failed or access denied
    if (showUpgrade || !hasAccess) {
        const requiredTier = FEATURE_REQUIREMENTS[pageName] || 'premium';
        return (
            <UpgradeModal
                isOpen={true}
                onClose={() => {}}
                feature={pageName}
                requiredTier={requiredTier}
                userProfile={userProfile}
                isBlocking={true}
            />
        );
    }

    return children;
}