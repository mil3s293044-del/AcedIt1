import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import 'katex/dist/katex.min.css'
import '@/api/_dualRunDevTools.js'
import { applyConsent } from '@/lib/analytics'
import { captureAttribution } from '@/lib/attribution'

// NO PIXEL LOADS HERE ANY MORE. This used to be `initAnalytics()`, which fired
// Meta and TikTok on every page load — before React rendered, before login and
// before anything could have been agreed to — on an app whose users are mostly
// under 18. `applyConsent()` loads nothing unless a choice is already stored as
// granted, so a returning visitor who accepted is not asked twice and a new one
// is not tracked before they answer. The banner is what asks.
applyConsent()
// Record first-touch UTM + campaign pillar before any navigation strips them.
// This is FIRST-PARTY and stays: it writes to this origin's own storage, sends
// nothing to a third party, and is what makes a signup attributable at all.
captureAttribution()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)