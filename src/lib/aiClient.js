// ════════════════════════════════════════════════════════════════════════════
// AI client — single entry point for every AI call from the frontend.
//
// Wraps fetch calls to /local-ai/invokeAI (non-streaming) and
// /local-ai/invokeAIStream (streaming SSE), auto-attaches:
//   • Authorization: Bearer <Supabase JWT>   — so the server can identify you
//   • feature: '<feature_name>'              — so the server can apply tier limits
//
// Replaces direct usage of `base44.integrations.Core.InvokeLLM` in AI tools.
//
// Usage (non-streaming, JSON response):
//   import { invokeLLM, FEATURES } from '@/lib/aiClient';
//   const response = await invokeLLM({
//     feature: FEATURES.AI_TOOL,
//     prompt: '...',
//     response_json_schema: { ... },
//   });
//
// Usage (streaming):
//   import { invokeLLMStream, FEATURES } from '@/lib/aiClient';
//   const text = await invokeLLMStream(
//     { feature: FEATURES.AI_TOOL, prompt: '...' },
//     (delta, soFar) => setText(soFar),
//   );
//
// Error handling: if the server blocks the call (402 = needs premium, 429 =
// daily/monthly cap hit), the error message is the `reason` from the server.
// The AI tool's `catch` block can show a toast + redirect to /Subscription.
// ════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/api/supabaseClient';
import { FEATURES as TIER_FEATURES } from '@/lib/tierAccess';
import { apiUrl } from '@/lib/apiBase';

export const FEATURES = TIER_FEATURES;

// Custom error class so AI tools can detect tier blocks specifically.
export class TierBlockedError extends Error {
  constructor(message, { upgradeRequired = false, status = 402 } = {}) {
    super(message);
    this.name = 'TierBlockedError';
    this.upgradeRequired = upgradeRequired;
    this.status = status;
  }
}

async function getAuthHeader() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

// Non-streaming — returns the parsed result (string or object depending on
// whether response_json_schema was passed).
export async function invokeLLM(params) {
  const authHeaders = await getAuthHeader();
  const r = await fetch(apiUrl('/local-ai/invokeAI'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(params || {}),
  });

  if (!r.ok) {
    let body = {};
    try { body = await r.json(); } catch {}
    if (r.status === 402 || r.status === 403 || r.status === 429) {
      throw new TierBlockedError(body.message || 'Upgrade to Premium to use this feature.', {
        upgradeRequired: !!body.upgradeRequired || r.status === 402,
        status: r.status,
      });
    }
    throw new Error(body.message || `AI request failed (${r.status})`);
  }

  return await r.json();
}

// Streaming — onText fires for each chunk. Returns full text at the end.
// Pass `signal` in options to allow aborting mid-stream.
export async function invokeLLMStream(params, onText, options = {}) {
  const { signal } = options;
  const authHeaders = await getAuthHeader();

  const response = await fetch(apiUrl('/local-ai/invokeAIStream'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(params || {}),
    signal,
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Stream request failed (${response.status}): ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const raw of events) {
      if (!raw.trim()) continue;
      let eventType = 'message';
      let dataStr = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataStr += line.slice(6);
      }
      if (!dataStr) continue;
      let payload;
      try { payload = JSON.parse(dataStr); } catch { continue; }

      if (eventType === 'text' && payload?.text) {
        fullText += payload.text;
        onText?.(payload.text, fullText);
      } else if (eventType === 'error') {
        if (payload?.upgradeRequired) {
          throw new TierBlockedError(payload.message || 'Upgrade to Premium to use this feature.', {
            upgradeRequired: true,
            status: 402,
          });
        }
        throw new Error(payload?.message || 'Stream error');
      } else if (eventType === 'done') {
        return fullText;
      }
    }
  }
  return fullText;
}

// ─── Ace study companion ────────────────────────────────────────────────────
// Streams a reply from the premium-only "Ace" chat (Haiku on the server — the
// cheap tier, since a study buddy doesn't need Sonnet-grade reasoning). Same
// SSE wire format as invokeLLMStream.
//   messages: [{ role: 'user' | 'assistant', content: string }, ...]
//   context:  { name, subjects[], streak, xp, level, goals[], upcomingAssessments[] }
//   onText:   (delta, soFar) => void
// Returns the full assistant reply. Throws TierBlockedError if not premium /
// caps hit (upgradeRequired flag set).
export async function streamAce(messages, context, onText, options = {}) {
  const { signal } = options;
  const authHeaders = await getAuthHeader();

  const response = await fetch(apiUrl('/local-ai/studyCoachChat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ messages: messages || [], context: context || {} }),
    signal,
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Ace request failed (${response.status}): ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const raw of events) {
      if (!raw.trim()) continue;
      let eventType = 'message';
      let dataStr = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataStr += line.slice(6);
      }
      if (!dataStr) continue;
      let payload;
      try { payload = JSON.parse(dataStr); } catch { continue; }

      if (eventType === 'text' && payload?.text) {
        fullText += payload.text;
        onText?.(payload.text, fullText);
      } else if (eventType === 'error') {
        if (payload?.upgradeRequired) {
          throw new TierBlockedError(payload.message || 'Upgrade to Premium to chat with Ace.', {
            upgradeRequired: true,
            status: 402,
          });
        }
        throw new Error(payload?.message || 'Ace stream error');
      } else if (eventType === 'done') {
        return fullText;
      }
    }
  }
  return fullText;
}
