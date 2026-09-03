import React, { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import BrandMark from "@/components/shared/BrandMark";

/**
 * Shared shell for the public legal pages (Privacy, Terms). Plain, readable,
 * on-brand. Public — rendered for logged-out visitors and ad-network crawlers,
 * so it must not depend on auth/session state.
 */
export default function LegalLayout({ title, lastUpdated, children }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-black/5">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 cursor-pointer">
            <BrandMark size="sm" />
          </a>
          <a
            href="/"
            className="flex items-center gap-1.5 text-sm text-[#0D1626]/55 hover:text-[#0D1626] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </a>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display font-extrabold text-3xl md:text-4xl mb-2">{title}</h1>
        <p className="text-sm text-[#0D1626]/50 mb-10">Last updated: {lastUpdated}</p>

        <div className="legal-prose space-y-6 text-[15px] leading-relaxed text-[#0D1626]/80">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/5 py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-[#0D1626]/50">
          <span>© {new Date().getFullYear()} AcedIt. Made for VCE.</span>
          <div className="flex items-center gap-5">
            <a href="/privacy" className="hover:text-[#0D1626] cursor-pointer">Privacy</a>
            <a href="/terms" className="hover:text-[#0D1626] cursor-pointer">Terms</a>
            <a href="mailto:support@acedit.au" className="hover:text-[#0D1626] cursor-pointer">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Section heading helper for consistent styling inside the prose body. */
export function LegalSection({ heading, children }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display font-bold text-xl text-[#0D1626] pt-2">{heading}</h2>
      {children}
    </section>
  );
}
