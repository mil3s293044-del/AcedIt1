/**
 * createGoalCompetition — create a study hours competition from an existing goal
 * Body: { goal_id, invite_emails: string[] }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function generateInviteCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { goal_id, invite_emails = [] } = await req.json();
        if (!goal_id) return Response.json({ error: 'goal_id required' }, { status: 400 });

        const userGoals = await base44.entities.Goal.filter({ created_by: user.email });
        const goal = userGoals.find(g => g.id === goal_id);
        if (!goal) return Response.json({ error: 'Goal not found or not yours' }, { status: 404 });

        const existingComps = await base44.entities.GoalCompetition.filter({ goal_id, creator_email: user.email });
        const activeComp = existingComps.find(c => c.status === 'active' || c.status === 'pending');
        if (activeComp) return Response.json({ error: 'A competition for this goal already exists', competition_id: activeComp.id }, { status: 409 });

        const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
        const profile = profiles[0];

        // Resolve subject from goal or userSubjects
        let subjectName = goal.subject_code || null;
        let subjectCode = goal.subject_code || null;
        if (goal.subject_code) {
            try {
                const userSubjects = await base44.entities.UserSubject.filter({ created_by: user.email });
                const matched = userSubjects.find(s => s.subject_code === goal.subject_code);
                if (matched) {
                    subjectName = matched.subject_name;
                    subjectCode = matched.subject_code;
                }
            } catch (_) {}
        }

        const now = new Date().toISOString();

        const creator = {
            email: user.email,
            name: user.full_name,
            username: profile?.username || '',
            status: 'accepted',
            joined_at: now,
            xp_earned: 0,
            study_minutes: 0,
            sub_goals_completed: (goal.sub_goals || []).filter(sg => sg.completed).length,
            sub_goals_total: (goal.sub_goals || []).length,
            progress_percent: goal.progress || 0,
            bonus_xp_awarded: 0,
            last_activity: now
        };

        const uniqueEmails = [...new Set(invite_emails.map(e => e.toLowerCase()))].filter(e => e !== user.email);
        if (uniqueEmails.length > 9) return Response.json({ error: 'Maximum 9 friends can be invited' }, { status: 400 });

        const invitedParticipants = await Promise.all(uniqueEmails.map(async (email) => {
            let name = email.split('@')[0];
            let username = '';
            try {
                const invitedProfiles = await base44.asServiceRole.entities.UserProfile.filter({ created_by: email });
                if (invitedProfiles[0]) username = invitedProfiles[0].username || '';
                const invitedUsers = await base44.asServiceRole.entities.User.list();
                const invitedUser = invitedUsers.find(u => u.email === email);
                if (invitedUser) name = invitedUser.full_name || name;
            } catch (_) {}
            return {
                email, name, username,
                status: 'invited',
                xp_earned: 0,
                study_minutes: 0,
                sub_goals_completed: 0,
                sub_goals_total: (goal.sub_goals || []).length,
                progress_percent: 0,
                bonus_xp_awarded: 0
            };
        }));

        const competition = await base44.entities.GoalCompetition.create({
            goal_id,
            goal_title: goal.title,
            goal_description: goal.description || '',
            goal_category: goal.category || 'academic',
            goal_target_date: goal.target_date || null,
            subject_name: subjectName,
            subject_code: subjectCode,
            competition_start_date: now,
            creator_email: user.email,
            creator_name: user.full_name,
            status: 'active',
            participants: [creator, ...invitedParticipants],
            invite_code: generateInviteCode(),
            max_participants: 10,
            progress_bets: []
        });

        return Response.json({ success: true, competition });

    } catch (error) {
        console.error('createGoalCompetition error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});