/**
 * StorePreview — the thing you are about to buy, drawn.
 *
 * ─── THE SHELF SOLD NINE TEXT ROWS ──────────────────────────────────────────
 * Name, blurb, price, Buy. A gilt card back costs a fortnight of earning and
 * the only thing on screen was the words "Gilt back"; three card backs and
 * three crests were six rows that looked identical. The student could not tell
 * what any of them were until the money had gone.
 *
 * That is the store release's own rule — "owned has to be worn somewhere a
 * person can see it" — arriving one step too late. Before you buy is exactly
 * when seeing it matters, and there was nothing to build: `CardBack`, `Crest`
 * and `PrankOverlay` all already render. The shelf simply never called them.
 *
 * ─── IT DRAWS THE REAL COMPONENT, NEVER A PICTURE OF ONE ────────────────────
 * No artwork, no thumbnails, no second copy of a design. Every preview here is
 * the same component the app draws when the thing is actually worn, in the
 * place it is actually worn — a back at the gauge a pack deals it, a crest on a
 * board row beside a name. A still image would be one more mirror to drift, and
 * this codebase has deleted enough of those; worse, it would go stale silently,
 * which is the whole class `dbColumns` and `mirrors` exist for.
 *
 * ─── A PREVIEW IS NOT AN ADVERT ─────────────────────────────────────────────
 * It shows the object at the size and in the context it will really appear,
 * rather than blown up on a hero. A crest is 14px beside a username on a board
 * row and nothing can change that, so a crest shown 60px tall would be selling
 * something that does not exist. `CardBack`'s own lattice note records the same
 * lesson from the other direction.
 *
 * ─── AND IT IS INKED IN FLOOR TOKENS ────────────────────────────────────────
 * This renders inside `Room`, so every surface here is `--floor-*` and no
 * literal hex may appear — `floorInk.test.mjs` fails one, correctly. The
 * EXCEPTION is a skin's own colours, which are literal by design and come out
 * of `BACK_SKINS` rather than being written here: a gilt back is gilt in both
 * themes because it is a physical object somebody paid for.
 */
import React from "react";
import { Snowflake, TrendingUp } from "lucide-react";
import { CardBack } from "@/components/cards/PlayingCard";
import Crest from "@/components/shared/Crest";
import { BACK_SKINS, CRESTS } from "@/lib/cosmetics";

/* A CREST IS NOT RE-INKED HERE, and an earlier draft tried to. `Crest` sets
   `text-muted-foreground` itself and says in its own header that colour rides
   on the surface rather than on the crest — so a `text-[...]` passed through
   `className` is two utilities for the same property, resolved by STYLESHEET
   ORDER rather than by the order they appear in the attribute, and it silently
   did nothing. That is the `divide-y` trap the Ranked board already records,
   and a class that renders no differently is worse than none: the next person
   reads it as the decision. */

/** The well every preview sits on, so the shelf reads as one rhythm. */
function Stage({ children, className = "" }) {
    return (
        <div
            className={`h-[104px] rounded-xl bg-[var(--floor-well)] border border-[var(--floor-edge)]
                flex items-center justify-center overflow-hidden ${className}`}
        >
            {children}
        </div>
    );
}

/**
 * A card back at the gauge a pack deals it.
 *
 * `skin` is passed EXPLICITLY rather than left to context: inside the store the
 * student is looking at an item, not at what they are wearing, and a shelf that
 * drew the equipped back on every row would show the same card three times.
 * That is the `skin={null}` opt-out in CardBack's own header, used the other
 * way round.
 */
function BackPreview({ id }) {
    const skin = BACK_SKINS[id];
    if (!skin) return null;
    return (
        <Stage>
            <span className="flex items-end gap-1.5">
                <CardBack skin={skin} flat className="w-[46px] aspect-[2.5/3.5] rounded-md opacity-70" />
                <CardBack skin={skin} className="w-[58px] aspect-[2.5/3.5] rounded-lg" />
                <CardBack skin={skin} flat className="w-[46px] aspect-[2.5/3.5] rounded-md opacity-70" />
            </span>
        </Stage>
    );
}

/**
 * A crest where a crest actually goes: beside a name, on a board row.
 *
 * The row is deliberately a MOCK and deliberately says so by using a dash for
 * the figure — inventing a plausible score here would put a number on screen
 * that is about nobody, on a floor whose whole argument is that its numbers
 * mean something.
 */
function CrestPreview({ id }) {
    const skin = CRESTS[id];
    if (!skin) return null;
    // ── TWO SIZES, AND BOTH ARE TRUE ───────────────────────────────────────
    // A crest IS 14px beside a username and nothing can change that, so the row
    // on the right is the honest one. But three crests drawn only at 14px are
    // three identical smudges on a shelf whose whole job is telling them apart
    // — the first draft of this was exactly that, and ring, bolt and laurel
    // were indistinguishable in the screenshot. So the mark is ALSO drawn large
    // enough to choose between. The big one is what you are picking; the row is
    // where it ends up.
    return (
        <Stage>
            <div className="w-full px-3 flex items-center justify-center gap-3">
                <Crest skin={skin} className="!w-9 !h-9 flex-shrink-0" />
                <div className="min-w-0 max-w-[150px]">
                    <div className="rounded-lg bg-[var(--floor-card)] border border-[var(--floor-edge)]
                        px-2 py-1.5 flex items-center gap-1.5">
                        <span className="font-display font-black text-[var(--floor-muted)] text-[11px] tabular-nums">
                            4
                        </span>
                        <span className="w-4 h-4 rounded-full bg-[var(--floor-edge-strong)] flex-shrink-0" />
                        <span className="text-[11px] font-bold text-[var(--floor-ink)] truncate">You</span>
                        <Crest skin={skin} />
                    </div>
                    <p className="text-[10px] text-[var(--floor-dim)] mt-1 leading-tight">
                        Actual size, beside your name
                    </p>
                </div>
            </div>
        </Stage>
    );
}

/**
 * The shield, and HOW MANY YOU HOLD.
 *
 * The count is the useful half: a consumable cannot be stockpiled (one is
 * insurance, five is an exemption), so a student about to buy a second needs
 * to see the first. It reads the real `streak_shields` column the purchase
 * increments — the item's own `column`, not a second number.
 */
function ShieldPreview({ held = 0, max = null }) {
    return (
        <Stage>
            <div className="text-center">
                <Snowflake className="w-8 h-8 mx-auto text-[var(--floor-ink)]" aria-hidden="true" />
                <p className="text-[11px] font-bold text-[var(--floor-muted-2)] mt-1.5 tabular-nums">
                    {held > 0
                        ? `You hold ${held}${max ? ` of ${max}` : ""}`
                        : "You hold none"}
                </p>
            </div>
        </Stage>
    );
}

/** A question on the board, in the shape the board draws one. */
function LinePreview() {
    return (
        <Stage>
            <div className="w-full max-w-[220px] px-3">
                <div className="rounded-lg bg-[var(--floor-card)] border border-[var(--floor-edge)] px-2.5 py-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--floor-dim)]
                        inline-flex items-center gap-1">
                        <TrendingUp className="w-2.5 h-2.5" aria-hidden="true" /> Your line
                    </span>
                    <p className="text-[11px] font-bold text-[var(--floor-ink)] leading-tight mt-1 truncate">
                        A question of your own
                    </p>
                    {/* The split, drawn the way PriceBar draws one. */}
                    <div className="mt-1.5 h-1.5 rounded-full overflow-hidden flex">
                        <span className="h-full bg-[var(--floor-yes)]" style={{ width: "50%" }} />
                        <span className="h-full bg-[var(--floor-no)]" style={{ width: "50%" }} />
                    </div>
                </div>
                <p className="text-[10px] text-[var(--floor-dim)] mt-1.5 text-center">
                    The whole room trades it
                </p>
            </div>
        </Stage>
    );
}

/**
 * The one entry point. Returns NULL for an item with nothing honest to draw,
 * and the card then renders exactly as it did — a placeholder box reading
 * "preview" would be the empty-state-for-its-own-sake this codebase keeps
 * deleting.
 */
export default function StorePreview({ item, held = 0 }) {
    if (!item) return null;
    if (BACK_SKINS[item.id]) return <BackPreview id={item.id} />;
    if (CRESTS[item.id]) return <CrestPreview id={item.id} />;
    if (item.effect === "streak_shield") return <ShieldPreview held={held} max={item.max ?? null} />;
    if (item.effect === "open_market") return <LinePreview />;
    return null;
}
