/**
 * settleHoursCompetition — award XP based on final study hours ranking
 * XP rate: 1st=75/hr, 2nd=50/hr, 3rd=30/hr, 4th+=15/hr
 * Body: { competition_id }
 * Only callable by competition creator
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const XP_RATES = [75, 50, 30, 15]; // per hour by rank

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { competition_id } = await req.json();
        if (!competition_id) return Response.json({ error: 'competition_id required' }, { status: 400 });

        const comps = await base44.entities.GoalCompetition.filter({ id: competition_id });
        const comp = comps[0];
        if (!comp) return Response.json({ error: 'Competition not found' }, { status: 404 });
        if (comp.creator_email !== user.email) return Response.json({ error: 'Only the creator can settle' }, { status: 403 });
        if (comp.status === 'completed') return Response.json({ error: 'Already settled' }, { status: 400 });

        // Rank participants by study_minutes (descending)
        const accepted = (comp.participants || [])
            .filter(p => p.status === 'accepted' || p.status === 'completed')
            .sort((a, b) => (b.study_minutes || 0) - (a.study_minutes || 0));

        const results = [];

        for (let i = 0; i < accepted.length; i++) {
            const p = accepted[i];
            const rank = i + 1;
            const xpRate = XP_RATES[Math.min(i, XP_RATES.length - 1)];
            const hours = (p.study_minutes || 0) / 60;
            const bonusXP = Math.round(hours * xpRate);

            results.push({ email: p.email, name: p.name, rank, hours, xpRate, bonusXP });

            if (bonusXP > 0) {
                try {
                    // Award XP via competition_bonus (flat XP path)
                    await base44.functions.invoke('awardXP', {
                        source: 'competition_bonus',
                        event_key: `hours_comp_${competition_id}_${p.email}`,
                        flat_xp: bonusXP,
                    });
                } catch (e) {
                    console.error(`XP award error for ${p.email}:`, e.message);
                }
            }
        }

        // Update competition to completed with final ranks
        const winner = results[0];
        const updatedParticipants = (comp.participants || []).map(p => {
            const result = results.find(r => r.email === p.email);
            if (!result) return p;
            return { ...p, final_rank: result.rank, bonus_xp_awarded: result.bonusXP, status: 'completed' };
        });

        await base44.entities.GoalCompetition.update(competition_id, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            winner_email: winner?.email || '',
            winner_name: winner?.name || '',
            participants: updatedParticipants
        });

        return Response.json({ success: true, results, winner });

    } catch (error) {
        console.error('settleHoursCompetition error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});