/**
 * migrateStudyHoursToXP — One-time migration: convert legacy study hours → All-Time XP
 *
 * MIGRATION FORMULA:
 *   Conversion rate: 1 verified study minute = 0.8 XP  (same as live rate)
 *   Cap per user: 5,000 XP max from migration (prevents inflation)
 *   Session minimum: 2 minutes (ignores noise/test records)
 *   Migration XP is added to total_xp ONLY (not season_xp — seasons stay fresh)
 *   Migration is idempotent: event_key "migration_v1_{user_email}" prevents double-run
 *
 * ADMIN ONLY. Call with { user_email } to migrate one user, or {} to migrate all.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const MIGRATION_RATE = 0.8;       // XP per minute (matches live rate)
const MIGRATION_CAP = 5000;       // Max XP any one user gets from migration
const MIN_SESSION_MINUTES = 2;    // Ignore sessions shorter than this

function xpForLevel(n) {
    if (n <= 1) return 0;
    let total = 0;
    for (let i = 1; i < n; i++) total += Math.round(120 * Math.pow(i, 1.6));
    return total;
}

function levelFromXP(totalXP) {
    let level = 1;
    while (xpForLevel(level + 1) <= totalXP) {
        level++;
        if (level > 500) break;
    }
    return level;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin only' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const { user_email: targetEmail, dry_run = false } = body;

        // Fetch all profiles or just one
        let profiles;
        if (targetEmail) {
            profiles = await base44.asServiceRole.entities.UserProfile.filter({ created_by: targetEmail });
        } else {
            profiles = await base44.asServiceRole.entities.UserProfile.list('-created_date', 500);
        }

        const results = [];

        const sleep = (ms) => new Promise(res => setTimeout(res, ms));

        for (const profile of profiles) {
            const email = profile.created_by;
            if (!email) continue;

            const migrationKey = `migration_v1_${email}`;

            // Rate-limit guard: small delay between users to avoid 429s
            await sleep(300);

            // Idempotency check
            const existing = await base44.asServiceRole.entities.XPEvent.filter({
                event_key: migrationKey,
                user_email: email
            });
            if (existing.length > 0) {
                results.push({ email, status: 'already_migrated', xp_awarded: existing[0].xp_awarded });
                continue;
            }

            // Fetch all study sessions
            const [studyTechniques, studySessions] = await Promise.all([
                base44.asServiceRole.entities.StudyTechnique.filter({ created_by: email }),
                base44.asServiceRole.entities.StudySession.filter({ created_by: email }),
            ]);

            let totalMinutes = 0;
            studyTechniques.forEach(s => {
                const mins = s.session_duration || 0;
                if (mins >= MIN_SESSION_MINUTES) totalMinutes += mins;
            });
            studySessions.forEach(s => {
                const mins = s.duration_minutes || 0;
                if (mins >= MIN_SESSION_MINUTES) totalMinutes += mins;
            });

            const rawXP = Math.round(totalMinutes * MIGRATION_RATE);
            const cappedXP = Math.min(rawXP, MIGRATION_CAP);

            if (cappedXP <= 0) {
                results.push({ email, status: 'no_xp', total_minutes: totalMinutes });
                continue;
            }

            if (dry_run) {
                results.push({ email, status: 'dry_run', total_minutes: totalMinutes, raw_xp: rawXP, xp_to_award: cappedXP });
                continue;
            }

            // Apply XP
            const prevXP = profile.total_xp || 0;
            const newXP = prevXP + cappedXP;
            const prevLevel = levelFromXP(prevXP);
            const newLevel = levelFromXP(newXP);

            // Write audit event
            await base44.asServiceRole.entities.XPEvent.create({
                event_key: migrationKey,
                user_email: email,
                source: 'study_session',
                xp_awarded: cappedXP,
                raw_xp: rawXP,
                capped: cappedXP < rawXP,
                integrity_flags: ['migration'],
                total_xp_after: newXP,
                season_xp_after: profile.season_xp || 0,
                level_before: prevLevel,
                level_after: newLevel,
                leveled_up: newLevel > prevLevel,
                metadata: {
                    migration_version: 'v1',
                    total_minutes: totalMinutes,
                    tech_sessions: studyTechniques.length,
                    pomodoro_sessions: studySessions.length,
                    rate: MIGRATION_RATE,
                    cap: MIGRATION_CAP,
                }
            });

            // Update UserProfile — total_xp only, NOT season_xp
            await base44.asServiceRole.entities.UserProfile.update(profile.id, {
                total_xp: newXP,
                current_level: newLevel,
            });

            // Update leaderboard
            try {
                const lbEntries = await base44.asServiceRole.entities.Leaderboard.filter({ user_email: email });
                const lbData = {
                    total_xp: newXP,
                    level: newLevel,
                    last_updated: new Date().toISOString(),
                };
                if (lbEntries.length > 0) {
                    await base44.asServiceRole.entities.Leaderboard.update(lbEntries[0].id, lbData);
                }
            } catch (_) {}

            results.push({
                email,
                status: 'migrated',
                total_minutes: totalMinutes,
                raw_xp: rawXP,
                xp_awarded: cappedXP,
                capped: cappedXP < rawXP,
                prev_total_xp: prevXP,
                new_total_xp: newXP,
                leveled_up: newLevel > prevLevel,
            });
        }

        const summary = {
            total_users: results.length,
            migrated: results.filter(r => r.status === 'migrated').length,
            already_done: results.filter(r => r.status === 'already_migrated').length,
            no_xp: results.filter(r => r.status === 'no_xp').length,
            dry_run,
            total_xp_awarded: results.filter(r => r.status === 'migrated').reduce((s, r) => s + (r.xp_awarded || 0), 0),
        };

        return Response.json({ success: true, summary, results });

    } catch (error) {
        console.error('migrateStudyHoursToXP error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});