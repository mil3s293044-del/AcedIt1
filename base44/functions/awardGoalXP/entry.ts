/**
 * DEPRECATED: Legacy goal XP function — now delegates to awardXP.
 * Kept for backward compatibility.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { goal_id, sub_goal_id, is_full_goal } = await req.json();

        // Get the goal
        const goal = await base44.entities.Goal.get(goal_id);
        
        if (!goal || goal.created_by !== user.email) {
            return Response.json({ error: 'Goal not found' }, { status: 404 });
        }

        let xpAwarded = 0;

        if (is_full_goal) {
            // Award XP for completing the entire goal
            xpAwarded = goal.total_xp_reward || 0;
        } else if (sub_goal_id) {
            // Award XP for completing a sub-goal
            const subGoal = goal.sub_goals?.find(sg => sg.id === sub_goal_id);
            if (!subGoal) {
                return Response.json({ error: 'Sub-goal not found' }, { status: 404 });
            }
            xpAwarded = subGoal.xp_reward || 0;
        }

        if (xpAwarded === 0) {
            return Response.json({ xp_awarded: 0, message: 'No XP to award' });
        }

        // Get or create user profile
        const profiles = await base44.entities.UserProfile.filter({ 
            created_by: user.email 
        });
        
        let userProfile = profiles[0];
        const currentXP = (userProfile?.total_xp || 0) + xpAwarded;
        
        // Calculate level (100 XP per level, starting at level 1)
        const newLevel = Math.floor(currentXP / 100) + 1;

        if (userProfile) {
            await base44.entities.UserProfile.update(userProfile.id, {
                total_xp: currentXP,
                current_level: newLevel
            });
        } else {
            await base44.entities.UserProfile.create({
                created_by: user.email,
                total_xp: currentXP,
                current_level: newLevel
            });
        }

        // Update leaderboard
        const leaderboardEntries = await base44.asServiceRole.entities.Leaderboard.filter({
            user_email: user.email
        });

        const leaderboardData = {
            total_xp: currentXP,
            level: newLevel
        };

        if (leaderboardEntries.length > 0) {
            await base44.asServiceRole.entities.Leaderboard.update(
                leaderboardEntries[0].id,
                leaderboardData
            );
        }

        return Response.json({
            success: true,
            xp_awarded: xpAwarded,
            total_xp: currentXP,
            current_level: newLevel,
            level_up: userProfile && newLevel > (userProfile.current_level || 1)
        });

    } catch (error) {
        console.error('Error awarding XP:', error);
        return Response.json({ 
            error: error.message || 'Failed to award XP' 
        }, { status: 500 });
    }
});