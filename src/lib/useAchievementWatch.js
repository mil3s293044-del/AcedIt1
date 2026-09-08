/**
 * useAchievementWatch — notice an unlock, wherever the student is.
 *
 * ─── Why a watcher rather than the award response ───────────────────────────
 * `awardXP` fires the achievement check FIRE-AND-FORGET, deliberately: the
 * check runs a dozen count queries and the award response must not wait on
 * them. So the response cannot carry the codes, and the client has to ask.
 *
 * It asks on the same signal everything else does — the `xp_awarded` window
 * event — debounced past the grant it is chasing. `useStakes` established this
 * shape and it is the right one here too: the interesting moment is the one
 * just after XP lands, and nothing else on the page needs polling for.
 *
 * `getAchievements` SELF-HEALS, so this both learns about unlocks and repairs
 * any the fire-and-forget hook missed. That is why it is not in
 * `READ_ONLY_FUNCTIONS`: it grants rows and pays XP.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getAchievements } from "@/api/functionsShim";

/** Long enough for the fire-and-forget grant to land, short enough to feel immediate. */
const SETTLE_MS = 2600;

export function useAchievementWatch(enabled = true) {
    const [codes, setCodes] = useState([]);
    const inflight = useRef(false);

    const look = useCallback(async () => {
        // One at a time. Three XP awards inside a second is one question.
        if (inflight.current) return;
        inflight.current = true;
        try {
            const res = await getAchievements();
            const data = res?.data ?? res;
            const fresh = data?.newly_unlocked || [];
            // Every unlocked code is offered, not just the freshly granted
            // ones: AchievementUnlock keeps its own seen-set, so a student who
            // earned something on another device still gets the moment here,
            // and one who has already seen it gets nothing.
            const all = (data?.items || []).filter((i) => i.unlocked).map((i) => i.code);
            const next = [...new Set([...fresh, ...all])];
            if (next.length) setCodes(next);
        } catch { /* an unlock nobody heard about is not worth an error toast */ }
        finally { inflight.current = false; }
    }, []);

    useEffect(() => {
        if (!enabled) return undefined;
        // Once on mount, so anything granted while they were away still lands.
        const first = setTimeout(look, 1200);
        let debounce = null;
        const onXP = () => {
            clearTimeout(debounce);
            debounce = setTimeout(look, SETTLE_MS);
        };
        window.addEventListener("xp_awarded", onXP);
        return () => {
            clearTimeout(first);
            clearTimeout(debounce);
            window.removeEventListener("xp_awarded", onXP);
        };
    }, [enabled, look]);

    return codes;
}

export default useAchievementWatch;
