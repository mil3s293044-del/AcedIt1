/**
 * updateCompetitionProgress — sync current user's study hours for the competition subject
 * Counts all study sessions since competition_start_date for the competition's subject
 * Body: { competition_id }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { competition_id } = await req.json();
        if (!competition_id) return Response.json({ error: 'competition_id required' }, { status: 400 });

        // Load competition
        const comps = await base44.entities.GoalCompetition.filter({ id: competition_id });
        const comp = comps[0];
        if (!comp) return Response.json({ error: 'Competition not found' }, { status: 404 });

        const me = (comp.participants || []).find(p => p.email === user.email);
        if (!me) return Response.json({ error: 'You are not in this competition' }, { status: 403 });

        const startDate = comp.competition_start_date ? new Date(comp.competition_start_date) : new Date(comp.created_date);
        const subjectFilter = comp.subject_name || comp.subject_code || null;

        const matchesSubject = (record) => {
            if (!subjectFilter) return true;
            const f = subjectFilter.toLowerCase();
            return (record.subject || '').toLowerCase().includes(f) ||
                   (record.subject_name || '').toLowerCase().includes(f);
        };

        const afterStart = (record) => {
            const d = record.created_date ? new Date(record.created_date) : null;
            return d ? d >= startDate : false;
        };

        // Fetch all study activity since competition start
        const [studyTechniques, studySessions] = await Promise.all([
            base44.entities.StudyTechnique.filter({ created_by: user.email }),
            base44.entities.StudySession.filter({ created_by: user.email }),
        ]);

        const techMinutes = studyTechniques
            .filter(afterStart)
            .filter(matchesSubject)
            .reduce((sum, s) => sum + (s.session_duration || 0), 0);

        const sessMinutes = studySessions
            .filter(afterStart)
            .filter(matchesSubject)
            .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

        const totalMinutes = techMinutes + sessMinutes;

        // Update participant's study_minutes in the competition
        const updatedParticipants = (comp.participants || []).map(p =>
            p.email === user.email
                ? { ...p, study_minutes: totalMinutes, last_hours_sync: new Date().toISOString(), last_activity: new Date().toISOString() }
                : p
        );

        await base44.entities.GoalCompetition.update(competition_id, { participants: updatedParticipants });

        return Response.json({
            success: true,
            study_minutes: totalMinutes,
            study_hours: (totalMinutes / 60).toFixed(1),
            subject: subjectFilter,
            since: startDate.toISOString()
        });

    } catch (error) {
        console.error('updateCompetitionProgress error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});