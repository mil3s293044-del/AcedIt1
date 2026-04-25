/**
 * joinGoalCompetition — accept an invite or join via invite code
 * Body: { competition_id } OR { invite_code }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { competition_id, invite_code, use_own_setup } = await req.json();

        let comp;
        if (competition_id) {
            const comps = await base44.entities.GoalCompetition.filter({ id: competition_id });
            comp = comps[0];
        } else if (invite_code) {
            const comps = await base44.entities.GoalCompetition.filter({ invite_code: invite_code.toUpperCase() });
            comp = comps[0];
        }

        if (!comp) return Response.json({ error: 'Competition not found' }, { status: 404 });
        if (comp.status !== 'active' && comp.status !== 'pending') {
            return Response.json({ error: 'Competition is not open' }, { status: 400 });
        }

        const existing = comp.participants.find(p => p.email === user.email);
        if (existing && existing.status === 'accepted') {
            return Response.json({ error: 'Already joined', competition: comp }, { status: 409 });
        }

        // Load profile
        const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
        const profile = profiles[0];

        const subGoalCount = comp.participants[0]?.sub_goals_total || 0;
        const useOwnSetup = use_own_setup === true;

        const updatedParticipants = existing
            ? comp.participants.map(p => p.email === user.email
                ? { ...p, status: 'accepted', joined_at: new Date().toISOString(), username: profile?.username || p.username, use_own_setup: useOwnSetup }
                : p)
            : [
                ...comp.participants,
                {
                    email: user.email,
                    name: user.full_name,
                    username: profile?.username || '',
                    status: 'accepted',
                    joined_at: new Date().toISOString(),
                    xp_earned: 0, study_minutes: 0,
                    sub_goals_completed: 0,
                    sub_goals_total: subGoalCount,
                    progress_percent: 0,
                    bonus_xp_awarded: 0,
                    last_activity: new Date().toISOString(),
                    use_own_setup: useOwnSetup
                }
            ];

        if (updatedParticipants.length > comp.max_participants) {
            return Response.json({ error: 'Competition is full' }, { status: 400 });
        }

        await base44.entities.GoalCompetition.update(comp.id, { participants: updatedParticipants });
        return Response.json({ success: true, competition_id: comp.id });

    } catch (error) {
        console.error('joinGoalCompetition error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});