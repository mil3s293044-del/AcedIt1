import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// Note: AI calls are intercepted at the Vite middleware layer (see
// vite.config.js → interceptInvokeLLM plugin). We can't patch the SDK
// in-place because base44.integrations is a Proxy whose `get` trap returns a
// fresh function on every access, ignoring direct property assignment.