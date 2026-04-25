import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import http from 'node:http'

// Custom plugin: intercept the Base44 SDK's HTTP call to Core/InvokeLLM
// (and similar AI integrations) before it leaves the browser, and forward
// it to our local Anthropic-backed Node server on port 3001.
//
// We do this at the middleware layer because the SDK exposes
// `base44.integrations.Core.InvokeLLM` via a Proxy whose `get` trap returns
// a fresh function on every access, so JS-level property overrides are
// silently ignored. Network-layer interception bypasses that entirely.
const INTERCEPT_PATTERNS = [
  // /api/apps/{appId}/integration-endpoints/Core/InvokeLLM
  { regex: /^\/api\/apps\/[^/]+\/integration-endpoints\/Core\/InvokeLLM(?:\?|$)/, target: '/local-ai/invokeAI' },
  // /api/apps/{appId}/integration-endpoints/Core/UploadFile
  { regex: /^\/api\/apps\/[^/]+\/integration-endpoints\/Core\/UploadFile(?:\?|$)/, target: '/local-ai/uploadFile' },
  // /api/apps/{appId}/functions/extractDocumentText (DOCX/PPTX text extraction for Quizzes)
  { regex: /^\/api\/apps\/[^/]+\/functions\/extractDocumentText(?:\?|$)/, target: '/local-ai/extractDocumentText' },
];

const interceptBase44AI = {
  name: 'intercept-base44-ai',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url || '';
      const match = INTERCEPT_PATTERNS.find((p) => p.regex.test(url));
      if (!match) return next();

      // Forward the request body and method to our local AI server.
      const proxyReq = http.request(
        {
          hostname: 'localhost',
          port: 3001,
          path: match.target,
          method: req.method,
          headers: { ...req.headers, host: 'localhost:3001' },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );
      proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: `Local AI server unreachable: ${err.message}` }));
      });
      req.pipe(proxyReq);
    });
  },
};

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  server: {
    proxy: {
      // Direct access to our local AI server (used by future tools / debugging).
      '/local-ai': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    // MUST be registered before the base44 plugin so our middleware runs first
    // and short-circuits the catch-all /api proxy for AI calls.
    interceptBase44AI,
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: true,
      hmrNotifier: true,
      navigationNotifier: true,
      visualEditAgent: true
    }),
    react(),
  ]
});