/**
 * useBankActions — grading, clearing and restoring a banked card, once.
 *
 * Written inside /MistakeBank for as long as that was the only screen that
 * drilled anything. Revision drills the same cards — and saved answers beside
 * them — so the write moved here rather than being copied: two copies of the
 * code that PAYS XP for a rating is the copy that rots, and the screen whose
 * copy drifted would quietly become the better or the worse place to work.
 *
 * Every rating goes through the shared scheduler (`sm2.js`) with `reviewPatch`
 * naming the columns, optimistic on the row the page holds, and pays the deck's
 * own per-card XP through the same idempotent event key. Clearing writes
 * `retired_at` — never a delete — and is undoable from the toast.
 */
import { useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { ToastAction } from "@/components/ui/toast";
import { calculateNextReview, reviewPatch } from "@/lib/sm2";
import { retireMistake, restoreMistake } from "@/lib/mistakeBank";
import React from "react";

export default function useBankActions({ putCards, toast, clearedLine = "Out of the bank and out of your review queue. Nothing is deleted." }) {
    // Grades already sent, so a card graded in one run is not re-sent if the
    // student starts another before the reload lands.
    const sentRef = useRef(new Set());

    const onGraded = useCallback(async (card, quality) => {
        const key = `${card.id}:${(card.total_reviews || 0) + 1}`;
        if (sentRef.current.has(key)) return;
        sentRef.current.add(key);
        const updates = calculateNextReview(quality, card);
        const totalReviews = (card.total_reviews || 0) + 1;
        putCards((prev) => prev.map((c) => c.id === card.id
            ? { ...c, ...reviewPatch(updates, quality), total_reviews: totalReviews } : c));
        try {
            await base44.entities.Flashcard.update(card.id, {
                ...reviewPatch(updates, quality), total_reviews: totalReviews,
            });
            base44.functions.invoke("awardXPIncremental", {
                type: "flashcard_card",
                event_key: `fc_${card.id}_r${totalReviews}`,
                metadata: { correct: quality >= 3, card_id: card.id },
            }).then((res) => {
                const xp = (res?.data ?? res)?.xp_awarded || 0;
                if (xp > 0) window.dispatchEvent(new CustomEvent("xp_awarded", { detail: { xp, source: "flashcard" } }));
            }).catch(() => {});
        } catch {
            sentRef.current.delete(key);
            toast({ title: "That rating didn't save", description: "The card will come back around.", variant: "destructive" });
        }
    }, [toast, putCards]);

    const restore = useCallback(async (rows) => {
        const patch = restoreMistake();
        putCards((prev) => prev.map((c) =>
            rows.some((r) => r.id === c.id) ? { ...c, ...patch } : c));
        try { await Promise.all(rows.map((r) => base44.entities.Flashcard.update(r.id, patch))); }
        catch { /* the reload reconciles */ }
    }, [putCards]);

    const clearFixed = useCallback(async (list) => {
        const rows = (list || []).filter(Boolean);
        if (!rows.length) return;
        const patch = retireMistake();
        putCards((prev) => prev.map((c) =>
            rows.some((r) => r.id === c.id) ? { ...c, ...patch } : c));
        try {
            await Promise.all(rows.map((r) => base44.entities.Flashcard.update(r.id, patch)));
            toast({
                title: rows.length === 1 ? "Cleared" : `${rows.length} cleared`,
                description: clearedLine,
                action: React.createElement(ToastAction, { altText: "Undo", onClick: () => restore(rows) }, "Undo"),
            });
        } catch {
            putCards((prev) => prev.map((c) =>
                rows.some((r) => r.id === c.id) ? { ...c, retired_at: null } : c));
            toast({ title: "That didn't save", description: "They're still in the bank.", variant: "destructive" });
        }
    }, [toast, putCards, restore, clearedLine]);

    return { onGraded, clearFixed, restore };
}
