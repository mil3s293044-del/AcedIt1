import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Persists live progress state for a challenge (called periodically from frontend)
// This ensures progress is not lost on refresh and allows server-side integrity checks.

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { challenge_id, progress } = await req.json();
        if (!challenge_id || !progress) return Response.json({ error: 'challenge_id and progress required' }, { status: 400 });

        const challenges = await base44.entities.GoalChallenge.filter({ id: challenge_id });
        const challenge = challenges?.[0];
        if (!challenge || challenge.created_by !== user.email) {
            return Response.json({ error: 'Not found' }, { status: 404 });
        }
        if (challenge.status === 'completed') {
            return Response.json({ error: 'Already completed' }, { status: 400 });
        }

        // Merge and compute percent_complete
        const merged = { ...(challenge.progress || {}), ...progress, last_active: new Date().toISOString() };

        const type = challenge.challenge_type;
        let pct = 0;
        if (type === 'focus_session') {
            const target = (challenge.time_limit_minutes || 30) * 60;
            pct = Math.min(100, Math.round(((merged.focus_seconds_elapsed || 0) / target) * 100));
        } else if (type === 'practice_questions') {
            const total = challenge.content?.questions?.length || 1;
            const min = Math.ceil(total * 0.8);
            pct = Math.min(100, Math.round(((merged.questions_attempted || 0) / min) * 100));
        } else if (type === 'flashcard_sprint') {
            const total = challenge.content?.cards?.length || 1;
            pct = Math.min(100, Math.round(((merged.cards_reviewed || 0) / total) * 100));
        } else if (type === 'mini_test') {
            pct = merged.mini_test_submitted ? 100 : Math.round(((merged.questions_attempted || 0) / (challenge.content?.questions?.length || 1)) * 100);
        } else if (type === 'revision_schedule') {
            const total = challenge.content?.days?.length || 1;
            pct = Math.min(100, Math.round(((merged.days_marked || 0) / total) * 100));
        }

        merged.percent_complete = pct;

        await base44.entities.GoalChallenge.update(challenge_id, { progress: merged });

        return Response.json({ success: true, percent_complete: pct });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});