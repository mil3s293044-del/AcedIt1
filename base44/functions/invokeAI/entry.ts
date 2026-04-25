import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Blocked domains ───────────────────────────────────────────────────────────
const BLOCKED_DOMAINS = ['edny.net'];

// ─── Threat detection patterns ────────────────────────────────────────────────
const THREAT_PATTERNS = [
    /ignore\s+(previous|prior|all)\s+instructions?/i,
    /forget\s+(previous|prior|all|your)\s+instructions?/i,
    /pretend\s+(you\s+have\s+no\s+rules|you\s+are\s+|to\s+be\s+)/i,
    /act\s+as\s+(dan|jailbreak|a\s+different|an?\s+unrestricted|an?\s+unfiltered)/i,
    /you\s+are\s+now\s+(dan|a\s+different\s+ai|free|unrestricted)/i,
    /do\s+anything\s+now/i,
    /jailbreak/i,
    /\bdan\b.*\bmode\b/i,
    /override\s+(your\s+)?(system|safety|security|content)\s+(prompt|instructions?|rules?|filter)/i,
    /bypass\s+(your\s+)?(safety|security|content|filter|restrict)/i,
    /disable\s+(your\s+)?(safety|security|content|filter|restrict)/i,
    /api[\s_-]?key/i,
    /system\s+prompt/i,
    /internal\s+(config|configuration|settings?|credentials?)/i,
    /admin\s+(access|override|password|credentials?)/i,
    /user\s+data\s+(export|dump|extract|list)/i,
    /reveal\s+(your\s+)?(instructions?|prompt|rules?|config)/i,
    /show\s+(me\s+)?(your\s+)?(system\s+)?(prompt|instructions?|rules?)/i,
    /print\s+(your\s+)?(system\s+)?(prompt|instructions?)/i,
    /what\s+are\s+your\s+(instructions?|rules?|system\s+prompt)/i,
    /injection/i,
    /\bscrap[ei]\b.*\b(all|every|mass|bulk)\b/i,
    /generate\s+(millions?|thousands?|hundreds?)\s+of/i,
    /mass\s+(generat|creat|extract|export)/i,
    /i\s+am\s+(an?\s+)?(admin|developer|engineer|owner|staff|employee)\s+/i,
    /this\s+is\s+(an?\s+)?(admin|developer|official)\s+(request|override|command)/i,
    /stress[\s-]?test/i,
    /exploit/i,
    /i\s+have\s+special\s+permission/i,
    /i\s+am\s+authorized\s+to/i,
    /unlimited\s+(access|requests?|usage)/i,
];

function detectThreat(text) {
    if (!text || typeof text !== 'string') return false;
    return THREAT_PATTERNS.some(p => p.test(text));
}

function simpleHash(str) {
    if (!str) return '';
    const s = str.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h |= 0;
    }
    return h.toString();
}

function isSimilarHash(a, b) {
    return a === b;
}

// Normalise email: strip + alias (e.g. foo+bar@example.com → foo@example.com)
function normaliseEmail(email) {
    if (!email) return email;
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const baseLocal = local.split('+')[0];
    return `${baseLocal}@${domain}`.toLowerCase();
}

// Get client IP from request headers
function getClientIP(req) {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.headers.get('x-real-ip') || 'unknown';
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userEmail = user.email;
        const normalised = normaliseEmail(userEmail);
        const emailDomain = normalised.split('@')[1] || '';

        // ── Block banned domains ───────────────────────────────────────────────
        if (BLOCKED_DOMAINS.includes(emailDomain)) {
            return Response.json({
                blocked: true,
                message: "🔒 Your account has been suspended. Please contact support."
            });
        }

        const params = await req.json();
        const now = Date.now();
        const clientIP = getClientIP(req);

        // ── IP-based checks ───────────────────────────────────────────────────
        const HOUR_MS = 60 * 60 * 1000;
        const IP_HOURLY_LIMIT = 60;

        // Check if IP is permanently blocked
        const blockedIPRecords = await base44.asServiceRole.entities.BlockedIPs.filter({ ip_address: clientIP });
        const blockedIPRecord = blockedIPRecords[0];
        if (blockedIPRecord?.is_blocked_ip) {
            // For non-permanent blocks, check if an hour has passed
            if (blockedIPRecord.is_permanent) {
                return Response.json({ blocked: true, message: "🔒 Access denied." });
            }
            const blockedAt = new Date(blockedIPRecord.blocked_at).getTime();
            if (now - blockedAt < HOUR_MS) {
                return Response.json({ blocked: true, message: "🔒 Too many requests from your network. Please try again later." });
            } else {
                // Unblock after an hour
                await base44.asServiceRole.entities.BlockedIPs.update(blockedIPRecord.id, { is_blocked_ip: false });
            }
        }

        // Log this IP call and count calls in the last hour
        await base44.asServiceRole.entities.IPCallLog.create({
            ip_address: clientIP,
            timestamp: now,
            user_id: userEmail,
            function_name: 'invokeAI'
        });

        // Count recent calls from this IP (last hour) — use list and filter client-side to avoid complex queries
        const recentIPLogs = await base44.asServiceRole.entities.IPCallLog.filter({ ip_address: clientIP });
        const ipCallsThisHour = recentIPLogs.filter(log => now - log.timestamp < HOUR_MS).length;

        if (ipCallsThisHour > IP_HOURLY_LIMIT) {
            // Block this IP for the remainder of the hour
            if (!blockedIPRecord) {
                await base44.asServiceRole.entities.BlockedIPs.create({
                    ip_address: clientIP,
                    is_blocked_ip: true,
                    blocked_at: new Date().toISOString(),
                    block_reason: 'rate_limit_exceeded',
                    is_permanent: false
                });
            } else {
                await base44.asServiceRole.entities.BlockedIPs.update(blockedIPRecord.id, {
                    is_blocked_ip: true,
                    blocked_at: new Date().toISOString(),
                    block_reason: 'rate_limit_exceeded'
                });
            }
            return Response.json({ blocked: true, message: "🔒 Too many requests from your network. Please try again later." });
        }

        // ── Load or create rate limit record (keyed on NORMALISED email) ──────
        let records = await base44.asServiceRole.entities.AIRateLimit.filter({ user_email: normalised });
        let record = records[0];

        if (!record) {
            record = await base44.asServiceRole.entities.AIRateLimit.create({
                user_email: normalised,
                request_timestamps: [],
                consecutive_flags: 0,
                session_request_count: 0,
                recent_prompts: [],
                is_frozen: false,
            });
        }

        // ── Check frozen / banned ──────────────────────────────────────────────
        if (record.is_frozen) {
            return Response.json({
                blocked: true,
                message: "🔒 Your account has been temporarily frozen due to unusual activity. This is an automated security measure. Please contact support to appeal or verify your account."
            });
        }

        const promptText = typeof params.prompt === 'string' ? params.prompt : JSON.stringify(params.prompt || '');

        // ── Threat detection ──────────────────────────────────────────────────
        const isThreat = detectThreat(promptText);
        let newConsecutiveFlags = record.consecutive_flags || 0;

        if (isThreat) {
            newConsecutiveFlags += 1;
            let shouldFreeze = newConsecutiveFlags >= 3;

            await base44.asServiceRole.entities.AIRateLimit.update(record.id, {
                consecutive_flags: newConsecutiveFlags,
                is_frozen: shouldFreeze,
                frozen_at: shouldFreeze ? new Date().toISOString() : record.frozen_at,
                freeze_reason: shouldFreeze ? 'consecutive_flags' : record.freeze_reason,
            });

            if (shouldFreeze) {
                return Response.json({
                    blocked: true,
                    message: "🔒 Your account has been temporarily frozen due to unusual activity. This is an automated security measure. Please contact support to appeal or verify your account."
                });
            }

            return Response.json({
                blocked: true,
                message: "🚫 This request has been flagged as potentially malicious and cannot be processed. Repeated violations may result in account suspension. If you believe this is an error, please contact support."
            });
        }

        // ── Rate limiting ─────────────────────────────────────────────────────
        const MINUTE_MS = 60 * 1000;
        const timestamps = (record.request_timestamps || []).filter(t => now - t < HOUR_MS);
        const last60s = timestamps.filter(t => now - t < 60 * 1000);
        const last5min = timestamps.filter(t => now - t < 5 * MINUTE_MS);
        const sessionCount = (record.session_request_count || 0) + 1;
        const promptHash = simpleHash(promptText);
        const recentPrompts = (record.recent_prompts || []).slice(-5);

        const duplicateCount = recentPrompts.filter(h => isSimilarHash(h, promptHash)).length;

        let freezeReason = null;
        if (last60s.length >= 10) freezeReason = 'rapid_requests_60s';
        else if (last5min.length >= 20) freezeReason = 'rapid_requests_5min';
        else if (sessionCount > 50) freezeReason = 'session_limit_exceeded';
        else if (duplicateCount >= 4) freezeReason = 'duplicate_prompts';

        if (freezeReason) {
            await base44.asServiceRole.entities.AIRateLimit.update(record.id, {
                is_frozen: true,
                frozen_at: new Date().toISOString(),
                freeze_reason: freezeReason,
                request_timestamps: [...timestamps, now],
                session_request_count: sessionCount,
                recent_prompts: [...recentPrompts, promptHash].slice(-5),
                last_request_at: new Date().toISOString(),
            });
            return Response.json({
                blocked: true,
                message: "🔒 Your account has been temporarily frozen due to unusual activity. This is an automated security measure. Please contact support to appeal or verify your account."
            });
        }

        if (timestamps.length >= 15) {
            const oldestInWindow = Math.min(...timestamps);
            const resetInMs = HOUR_MS - (now - oldestInWindow);
            const resetInMin = Math.ceil(resetInMs / MINUTE_MS);
            await base44.asServiceRole.entities.AIRateLimit.update(record.id, {
                request_timestamps: timestamps,
                session_request_count: sessionCount,
                last_request_at: new Date().toISOString(),
            });
            return Response.json({
                blocked: true,
                message: `⚠️ Rate limit reached. You have used your 15 AI interactions for this hour. Please wait before trying again.`
            });
        }

        // ── Update tracking record ────────────────────────────────────────────
        await base44.asServiceRole.entities.AIRateLimit.update(record.id, {
            request_timestamps: [...timestamps, now],
            consecutive_flags: 0,
            session_request_count: sessionCount,
            recent_prompts: [...recentPrompts, promptHash].slice(-5),
            last_request_at: new Date().toISOString(),
        });

        // ── Proxy to InvokeLLM ────────────────────────────────────────────────
        const result = await base44.asServiceRole.integrations.Core.InvokeLLM(params);
        return Response.json({ result });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});