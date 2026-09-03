/**
 * BrandMark — the AcedIt logo, in one place.
 *
 * ─── What it replaces ───────────────────────────────────────────────────────
 * A green rounded square with a lucide `GraduationCap` in it, hand-rolled at
 * EIGHT call sites — the side rail, the landing header and footer, login,
 * forgot-password, reset-password, the legal pages and the suspended screen —
 * each with its own size, radius and shadow. A logo copy-pasted eight times is
 * a logo that drifts, and it had: three different corner radii and two
 * different icon colours between them.
 *
 * ─── Why a spade ────────────────────────────────────────────────────────────
 * The app's entire visual language is playing cards — `PlayingCard` and
 * `cardIdentity` are on eighteen surfaces, the mascot is called Ace and is
 * drawn as a spade, and rank-is-strength/suit-is-family is the contract those
 * eighteen surfaces share. A mortarboard says "education app" and belongs to
 * every education app; the ace of spades is this one's.
 *
 * ─── One ink, both themes ───────────────────────────────────────────────────
 * `fill-foreground` is near-black on light and near-white on dark, so the mark
 * is drawn once and reads correctly in both without a second asset, a media
 * query or a swap at runtime. That is the same trick `SpadeFace` uses for the
 * mascot's knocked-out eyes, and the reason both can live on any background
 * the app has.
 *
 * The one exception is the side rail, which passes `fill-primary`: in the app
 * the mark sits above a column of nav items already in the brand green, and it
 * is the only place the logo has to read as the app's own rather than as a
 * heading. `rail` is drawn at a 28px pip inside its 40px box — the bare spade at
 * 20px was visibly smaller than the 40px green tile it replaced, because the
 * tile's colour was doing the work the glyph now has to do alone. It cannot go
 * past the box: the collapsed rail is 64px wide with 12px of padding either
 * side.
 */
import React from "react";
import { SpadePip } from "@/components/ace/SpadeMark";

/** Sizes the eight call sites actually used, named rather than passed as classes. */
const SIZE = {
    sm: { box: "w-8 h-8",   pip: "w-4 h-4",   text: "text-base" },
    md: { box: "w-9 h-9",   pip: "w-[1.15rem] h-[1.15rem]", text: "text-xl" },
    lg: { box: "w-10 h-10", pip: "w-5 h-5",   text: "text-xl" },
    // The side rail only. See the note above on why it is bigger.
    rail: { box: "w-10 h-10", pip: "w-7 h-7", text: "text-xl" },
    xl: { box: "w-12 h-12", pip: "w-6 h-6",   text: "text-2xl" },
};

/**
 * The mark alone.
 *
 * `tone` exists for the one place the mark sits on a surface that is dark in
 * BOTH themes — the landing hero's tinted bar — where `fill-foreground` would
 * come out black on black. Everywhere else leave it alone.
 */
export function BrandSpade({ size = "md", tone = "fill-foreground", glow = false, className = "" }) {
    const s = SIZE[size] || SIZE.md;
    return (
        <span className={`grid place-items-center flex-shrink-0 ${s.box} ${className}`}
            // A drop-shadow on the GLYPH, not a box-shadow on the span: the
            // span is a rectangle and a glow around a rectangle behind a spade
            // is a green square. `drop-shadow` follows the alpha of what it is
            // filtering, so the halo is spade-shaped. Two stops — a tight one
            // for the edge and a wide one for the bloom — because a single
            // large radius at a readable strength reads as a smudge.
            style={glow ? {
                filter: "drop-shadow(0 0 2px hsl(var(--primary) / 0.55))"
                    + " drop-shadow(0 0 8px hsl(var(--primary) / 0.35))",
            } : undefined}>
            <SpadePip className={s.pip} tone={tone} />
        </span>
    );
}

/**
 * Mark plus wordmark, which is how the logo appears in every header.
 *
 * The word is set in the display face at the weight the headers already used;
 * `wordClassName` is there for the landing page, which paints its header text
 * a fixed ink because the bar behind it does not follow the theme.
 */
export default function BrandMark({
    size = "md", tone, glow = false,
    wordClassName = "text-foreground", showWord = true, className = "",
}) {
    const s = SIZE[size] || SIZE.md;
    return (
        <span className={`inline-flex items-center gap-2 ${className}`}>
            <BrandSpade size={size} tone={tone} glow={glow} />
            {showWord && (
                <span className={`font-display font-extrabold tracking-tight ${s.text} ${wordClassName}`}>
                    AcedIt
                </span>
            )}
        </span>
    );
}
