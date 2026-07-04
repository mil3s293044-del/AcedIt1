import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { getAttribution } from "@/lib/attribution";
import { trackLeadMagnet } from "@/lib/analytics";
import { Check, Loader2 } from "lucide-react";

/**
 * Top-of-funnel email capture. Drop it anywhere on the landing page (or a
 * pillar page) and pass the pillar/source so we know which campaign drove the
 * lead. Submits to the public `captureLead` endpoint (no auth) and fires the
 * Lead pixel event.
 *
 * Props:
 *   pillar      — campaign pillar key, e.g. "feedback" (optional)
 *   source      — where this form lives, e.g. "landing_roadmap"
 *   leadMagnet  — which magnet was promised, e.g. "vce_study_roadmap"
 *   headline    — bold prompt above the field
 *   subtext     — supporting line
 *   cta         — button label
 */
export default function EmailCapture({
  pillar = null,
  source = "landing_roadmap",
  leadMagnet = "vce_study_roadmap",
  headline = "Not ready to start? Grab the free VCE study roadmap.",
  subtext = "The weekly rhythm top students use — straight to your inbox.",
  cta = "Send it to me",
}) {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState(""); // honeypot — hidden from real users
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (state === "loading" || state === "done") return;
    setState("loading");
    setError("");
    try {
      const { utm } = getAttribution();
      await base44.functions.invoke("captureLead", {
        email,
        source,
        pillar,
        lead_magnet: leadMagnet,
        utm,
        hp,
      });
      trackLeadMagnet({ pillar: pillar || undefined });
      setState("done");
    } catch (err) {
      setError("Something went wrong — try again in a moment.");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-primary/10 border border-primary/20 px-5 py-4 text-[#0D1626]">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
          <Check className="w-4 h-4 text-white" />
        </div>
        <p className="text-sm font-semibold">Check your inbox — your roadmap is on the way.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {headline && <h3 className="font-display font-extrabold text-lg text-[#0D1626] mb-1">{headline}</h3>}
      {subtext && <p className="text-sm text-[#0D1626]/60 mb-4">{subtext}</p>}
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
        {/* Honeypot: visually hidden, off-screen, not tabbable. Bots fill it. */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          className="hidden"
          aria-hidden="true"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="flex-1 h-12 rounded-2xl border border-black/10 bg-white px-4 text-[#0D1626] text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="h-12 px-6 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-soft-lg disabled:opacity-70 cursor-pointer flex items-center justify-center gap-2"
        >
          {state === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : cta}
        </button>
      </form>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
