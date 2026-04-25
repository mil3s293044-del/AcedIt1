// CRITICAL: All subscription checks MUST use database subscription_tier field
// Never rely on frontend state alone - always verify against UserProfile entity

export const SUBSCRIPTION_TIERS = {
    FREE: 'free',
    PREMIUM: 'premium'
};

export const USER_ROLES = {
    FREE_USER: 'free_user',
    PREMIUM_USER: 'premium_user'
};

// Premium-locked features - extensible for future tiers
export const FEATURE_LIMITS = {
    [SUBSCRIPTION_TIERS.FREE]: {
        ai_credits: 500,
        canShareContent: true,
        aiTools: false,
        goals: false,
        studyPlanner: false,
        pomodoro: true,
        spacedRepetition: false,
        activeRecall: true,
        blurting: true,
        aiTestMarker: false,
        analytics: false,
    },
    [SUBSCRIPTION_TIERS.PREMIUM]: {
        ai_credits: Infinity,
        canShareContent: true,
        aiTools: true,
        goals: true,
        studyPlanner: true,
        pomodoro: true,
        spacedRepetition: true,
        activeRecall: true,
        blurting: true,
        aiTestMarker: true,
        analytics: true,
    }
};

// CRITICAL: Verify subscription tier from database
export function getUserTier(userProfile) {
    if (!userProfile) return SUBSCRIPTION_TIERS.FREE;
    return userProfile.subscription_tier || SUBSCRIPTION_TIERS.FREE;
}

export function getUserRole(userProfile) {
    if (!userProfile) return USER_ROLES.FREE_USER;
    return userProfile.user_role || USER_ROLES.FREE_USER;
}

// CRITICAL: Primary access check - always use this for feature gating
export function isPremium(userProfile) {
    if (!userProfile) return false;
    const tier = getUserTier(userProfile);
    const role = getUserRole(userProfile);
    return tier === SUBSCRIPTION_TIERS.PREMIUM || role === USER_ROLES.PREMIUM_USER;
}

// Check if user has access to a specific feature
export function hasAccess(userProfile, feature) {
    if (!userProfile) return false;
    
    const tier = getUserTier(userProfile);
    const limits = FEATURE_LIMITS[tier];
    
    return limits[feature] === true || limits[feature] === Infinity;
}

export function getFeatureLimit(userProfile, feature) {
    if (!userProfile) return FEATURE_LIMITS[SUBSCRIPTION_TIERS.FREE][feature];
    
    const tier = getUserTier(userProfile);
    return FEATURE_LIMITS[tier][feature];
}

// Verify subscription hasn't expired
export function isSubscriptionActive(userProfile) {
    if (!userProfile) return false;
    if (!userProfile.subscription_expires_at) return false;
    
    const expiryDate = new Date(userProfile.subscription_expires_at);
    return expiryDate > new Date();
}

export function getRequiredTier(feature) {
    if (FEATURE_LIMITS[SUBSCRIPTION_TIERS.FREE][feature]) return SUBSCRIPTION_TIERS.FREE;
    return SUBSCRIPTION_TIERS.PREMIUM;
}

// CRITICAL: Credit deduction with database validation
export async function checkAndDeductCredit(userProfile, creditType) {
    if (!userProfile) {
        return { allowed: false, newCredits: 0, reason: 'No user profile' };
    }
    
    // Premium users have unlimited credits
    if (isPremium(userProfile)) {
        return { allowed: true, newCredits: Infinity };
    }
    
    // Free tier - check credits from database
    const currentCredits = userProfile[creditType] || 0;
    
    if (currentCredits <= 0) {
        return { allowed: false, newCredits: 0, reason: 'No credits remaining' };
    }
    
    return { allowed: true, newCredits: currentCredits - 1 };
}

// CRITICAL: Enforce access with clear error messaging
export function enforceAccess(userProfile, feature) {
    if (!hasAccess(userProfile, feature)) {
        throw new Error(`Premium subscription required for ${feature}`);
    }
}