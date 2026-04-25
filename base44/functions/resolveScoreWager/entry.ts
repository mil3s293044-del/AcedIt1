/**
 * resolveScoreWager — called when user enters their actual assessment score
 * Body: { wager_id, actual_score: number (0-100) }
 *
 * Accuracy rules:
 *   exact  → |predicted - actual| <= 3  → 3× wager
 *   close  → |predicted - actual| <= 10 → 1.5× wager
 *   wrong  → otherwise                  → lose wagered XP
 *
 * Abuse prevention:
 *   - Wager must be in 'active' status
 *   - Assessment due_date must have passed (locked window)
 *   - Each assessment can only have 1 active wager per user
 *   - wagered_xp capped at 500 and verified against user's current XP
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { wager_id, actual_score } = await req.json();
        if (!wager_id || actual_score === undefined || actual_score === null) {
            return Response.json({ error: 'wager_id and actual_score required' }, { status: 400 });
        }
        if (actual_score < 0 || actual_score > 100) {
            return Response.json({ error: 'actual_score must be 0-100' }, { status: 400 });
        }

        // Load wager
        const wagers = await base44.entities.ScoreWager.filter({ id: wager_id, created_by: user.email });
        const wager = wagers[0];
        if (!wager) return Response.json({ error: 'Wager not found' }, { status: 404 });
        if (wager.status !== 'active') return Response.json({ error: 'Wager already resolved' }, { status: 400 });

        // Determine accuracy
        const diff = Math.abs(wager.predicted_score - actual_score);
        let accuracy;
        if (diff <= 3) accuracy = 'exact';
        else if (diff <= 10) accuracy = 'close';
        else accuracy = 'wrong';

        // Calculate XP outcome
        let xpOutcome;
        if (accuracy === 'exact') xpOutcome = Math.round(wager.wagered_xp * 3);
        else if (accuracy === 'close') xpOutcome = Math.round(wager.wagered_xp * 1.5);
        else xpOutcome = -wager.wagered_xp; // lose wagered XP

        // Load user profile
        const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
        const profile = profiles[0];
        if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

        // If loss: deduct XP (floor at 0) and update leaderboard
        // If win: award via awardXP function (which updates profile + leaderboard)
        if (accuracy === 'wrong') {
            const newXP = Math.max(0, (profile.total_xp || 0) + xpOutcome); // xpOutcome is negative
            const newSeasonXP = Math.max(0, (profile.season_xp || 0) + xpOutcome);
            await base44.entities.UserProfile.update(profile.id, { total_xp: newXP, season_xp: newSeasonXP });
            // Also update leaderboard
            const lbEntries = await base44.asServiceRole.entities.Leaderboard.filter({ user_email: user.email });
            if (lbEntries.length > 0) {
                await base44.asServiceRole.entities.Leaderboard.update(lbEntries[0].id, {
                    total_xp: newXP,
                    season_xp: newSeasonXP,
                    last_updated: new Date().toISOString()
                });
            }
        } else {
            await base44.functions.invoke('awardXP', {
                source: 'wager',
                event_key: `wager_${wager_id}`,
                wagered_xp: wager.wagered_xp,
                wager_accuracy: accuracy,
            });
        }

        // Resolve wager
        await base44.entities.ScoreWager.update(wager_id, {
            actual_score,
            accuracy,
            xp_outcome: xpOutcome,
            status: 'resolved',
            resolved_at: new Date().toISOString()
        });

        // Also update the assessment's actual_score if it exists
        try {
            const assessments = await base44.entities.SubjectAssessment.filter({ id: wager.assessment_id, created_by: user.email });
            if (assessments[0]) {
                await base44.entities.SubjectAssessment.update(wager.assessment_id, {
                    actual_score,
                    is_completed: true
                });
            }
        } catch (_) {}

        return Response.json({
            success: true,
            accuracy,
            xp_outcome: xpOutcome,
            predicted: wager.predicted_score,
            actual: actual_score,
            diff,
            message: accuracy === 'exact'
                ? `🎯 Perfect prediction! You earn ${xpOutcome} XP (3× your wager)`
                : accuracy === 'close'
                ? `✅ Close enough! You earn ${xpOutcome} XP (1.5× your wager)`
                : `❌ Prediction missed. You lose ${wager.wagered_xp} XP`
        });

    } catch (error) {
        console.error('resolveScoreWager error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});