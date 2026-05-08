// ════════════════════════════════════════════════════════════════════════════
// Backward-compatible re-export — every existing tool that does
//   import { invokeLLMStream } from '@/lib/streamingAI'
// keeps working. The actual implementation lives in src/lib/aiClient.js,
// which auto-attaches the Supabase JWT and forwards the `feature` tag for
// tier-limit enforcement.
//
// To gate a streaming tool with a specific tier-feature, pass `feature` in
// the params:
//   invokeLLMStream(
//     { prompt: '...', feature: FEATURES.AI_TOOL },
//     onText,
//   );
//
// If `feature` is omitted, the server defaults to `ai_tool` (15/day premium
// cap, blocked for free).
// ════════════════════════════════════════════════════════════════════════════

export { invokeLLMStream, invokeLLM, FEATURES, TierBlockedError } from './aiClient.js';
