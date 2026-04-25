/**
 * Incremental XP Award — called during ongoing activities (not just on completion).
 * Used for: pomodoro timer (per minute), flashcard reviews (per card).
 * Uses a time-windowed event_key to prevent double-awarding within the same minute/card.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DIFF_MULT = { foundation: 0.7, developing: 0.9, proficient: 1.0, advanced: 1.3, exam_ready: 1.6 };

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { type, event_key, metadata = {} } = body;
        // type: 'focus_minute' | 'flashcard_card'

        if (!event_key) return Response.json({ error: 'event_key required' }, { status: 400 });

        // Idempotency check
        const existing = await base44.asServiceRole.entities.XPEvent.filter({ event_key, user_email: user.email });
        if (existing.length > 0) {
            return Response.json({ success: true, xp_awarded: existing[0].xp_awarded, deduplicated: true });
        }

        // Calculate XP
        let xp = 0;
        let source = 'study_session';

        if (type === 'focus_minute') {
            // Spec: Focus sessions = 1.6–96 XP/hr → ~1.6 XP/min base at low difficulty, up to ~8 XP/min at exam_ready
            // We use a base rate of 1.6 XP/min * difficulty multiplier
            const tabAway = metadata.tab_away_count || 0;
            const tabPenalty = tabAway > 5 ? 0.4 : tabAway > 2 ? 0.7 : 1.0;
            const diff = metadata.difficulty || 'proficient';
            const diffMult = DIFF_MULT[diff] || 1.0;
            xp = Math.max(1, Math.round(1.6 * diffMult * tabPenalty));
            source = 'study_session';
        } else if (type === 'flashcard_card') {
            // Spec: Flashcards = 0.6–1.5 XP/card; correct cards get max
            const correct = metadata.correct ? 1 : 0;
            // 0.6 base + up to 0.9 bonus for correct = 1.5 max
            xp = correct ? 2 : 1; // rounds to 1.5 → 2 for correct, 0.6 → 1 for wrong
            source = 'flashcard';
        } else {
            return Response.json({ error: 'Unknown type' }, { status: 400 });
        }

        if (xp <= 0) {
            return Response.json({ success: true, xp_awarded: 0 });
        }

        // Load profile
        const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
        let profile = profiles[0];
        if (!profile) {
            profile = await base44.entities.UserProfile.create({ created_by: user.email, total_xp: 0, current_level: 1 });
        }

        // Daily cap check (incremental)
        const todayKey = new Date().toISOString().split('T')[0];
        const dailyCaps = profile.daily_xp_caps || {};
        const todayCaps = dailyCaps[todayKey] || {};
        const CAP = type === 'focus_minute' ? 160 : 80;
        const usedToday = todayCaps[source] || 0;
        const allowed = Math.max(0, CAP - usedToday);
        const finalXP = Math.min(xp, allowed);

        if (finalXP <= 0) {
            return Response.json({ success: true, xp_awarded: 0, message: 'Daily cap reached' });
        }

        // Velocity check
        const velocityLog = profile.xp_velocity_log || [];
        const oneHourAgo = Date.now() - 3600000;
        const recentXP = velocityLog.filter(e => e.ts > oneHourAgo).reduce((s, e) => s + e.xp, 0);
        if (recentXP >= 600) {
            return Response.json({ success: true, xp_awarded: 0, message: 'Velocity cap reached' });
        }

        const newTotalXP = (profile.total_xp || 0) + finalXP;
        const newSeasonXP = (profile.season_xp || 0) + finalXP;

        // Write audit event
        await base44.asServiceRole.entities.XPEvent.create({
            event_key,
            user_email: user.email,
            source,
            xp_awarded: finalXP,
            raw_xp: xp,
            capped: finalXP < xp,
            integrity_flags: [],
            total_xp_after: newTotalXP,
            season_xp_after: newSeasonXP,
            level_before: profile.current_level || 1,
            level_after: profile.current_level || 1,
            leveled_up: false,
            metadata: { type, ...metadata },
        });

        // Update profile
        const updatedCaps = { ...dailyCaps, [todayKey]: { ...todayCaps, [source]: usedToday + finalXP } };
        const updatedVelocity = [
            ...velocityLog.filter(e => e.ts > Date.now() - 7200000),
            { ts: Date.now(), xp: finalXP, source }
        ].slice(-100);

        await base44.entities.UserProfile.update(profile.id, {
            total_xp: newTotalXP,
            season_xp: newSeasonXP,
            daily_xp_caps: updatedCaps,
            xp_velocity_log: updatedVelocity,
        });

        return Response.json({ success: true, xp_awarded: finalXP, total_xp: newTotalXP });

    } catch (error) {
        console.error('awardXPIncremental error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});