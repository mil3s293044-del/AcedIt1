/**
 * CosmeticsContext — the equipped look, read once and consumed everywhere.
 *
 * `CardBack` draws on nineteen surfaces. Threading an equipped skin into each
 * one is nineteen chances to forget, and a half-worn cosmetic is worse than an
 * unworn one: the student sees their gilt back on the flashcard shelf and the
 * default on the quiz player and concludes the app is broken rather than that
 * one call site was missed. So the profile is read ONCE, here, and the drawing
 * components consume it.
 *
 * IT DEFAULTS TO NOTHING EQUIPPED, so every surface outside the provider — the
 * landing page, the probe harness, a test — renders exactly as it did before
 * this existed. A context whose absence changes the drawing is a context that
 * breaks the screens nobody remembered to wrap.
 */
import React, { createContext, useContext, useMemo } from "react";
import { backSkin, crestOf } from "@/lib/cosmetics";

const EMPTY = { back: null, crest: null };
const CosmeticsContext = createContext(EMPTY);

export function CosmeticsProvider({ profile, children }) {
    const value = useMemo(() => ({
        back: backSkin(profile),
        crest: crestOf(profile),
    }), [profile]);
    return <CosmeticsContext.Provider value={value}>{children}</CosmeticsContext.Provider>;
}

/** What the viewer is wearing. Never throws outside a provider — see above. */
export function useCosmetics() {
    return useContext(CosmeticsContext) || EMPTY;
}

export default CosmeticsProvider;
