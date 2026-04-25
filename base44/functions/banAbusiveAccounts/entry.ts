import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ABUSER_EMAILS = [
    '2055gates@edny.net',
    '2055gates+3@edny.net',
    '2055gates+4@edny.net',
    '2055gates+22@edny.net',
    'mil3s@edny.net',
    'miles@edny.net',
];

// Normalise: strip + alias
function normaliseEmail(email) {
    if (!email) return email;
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return `${local.split('+')[0]}@${domain}`.toLowerCase();
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        const results = [];

        // Ban each abuser by their normalised email
        const normalisedSet = new Set(ABUSER_EMAILS.map(normaliseEmail));

        for (const normEmail of normalisedSet) {
            // Find or create rate limit record
            let records = await base44.asServiceRole.entities.AIRateLimit.filter({ user_email: normEmail });
            if (records.length > 0) {
                await base44.asServiceRole.entities.AIRateLimit.update(records[0].id, {
                    is_frozen: true,
                    frozen_at: new Date().toISOString(),
                    freeze_reason: 'banned_account',
                });
                results.push({ email: normEmail, action: 'updated', id: records[0].id });
            } else {
                const created = await base44.asServiceRole.entities.AIRateLimit.create({
                    user_email: normEmail,
                    request_timestamps: [],
                    consecutive_flags: 0,
                    session_request_count: 0,
                    recent_prompts: [],
                    is_frozen: true,
                    frozen_at: new Date().toISOString(),
                    freeze_reason: 'banned_account',
                });
                results.push({ email: normEmail, action: 'created_banned', id: created.id });
            }
        }

        return Response.json({ success: true, results });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});