import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import 'katex/dist/katex.min.css'
import '@/api/_dualRunDevTools.js'
import { initAnalytics } from '@/lib/analytics'
import { captureAttribution } from '@/lib/attribution'

// Load marketing pixels (Meta / TikTok / GA4) if their IDs are configured.
// No-op when no IDs are set, so dev is unaffected.
initAnalytics()
// Record first-touch UTM + campaign pillar before any navigation strips them.
captureAttribution()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)