import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify admin access
        const user = await base44.auth.me();
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Get all user profiles
        const allProfiles = await base44.asServiceRole.entities.UserProfile.list();
        
        // Calculate renewal date: 2 weeks from now (Jan 14, 2026)
        const renewalDate = new Date();
        renewalDate.setDate(renewalDate.getDate() + 14);
        
        // Update all profiles
        const updates = [];
        for (const profile of allProfiles) {
            // Only update free users (premium users have unlimited credits)
            if (profile.subscription_tier !== 'premium') {
                updates.push(
                    base44.asServiceRole.entities.UserProfile.update(profile.id, {
                        ai_credits: 500,
                        credits_reset_date: renewalDate.toISOString()
                    })
                );
            }
        }
        
        await Promise.all(updates);
        
        return Response.json({
            success: true,
            message: `Reset credits for ${updates.length} users`,
            renewal_date: renewalDate.toISOString(),
            total_profiles: allProfiles.length
        });
        
    } catch (error) {
        console.error("Error resetting credits:", error);
        return Response.json({ 
            error: error.message,
            details: error.toString()
        }, { status: 500 });
    }
});