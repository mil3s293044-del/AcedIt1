/**
 * useSacTags — the student's SACs, which of them claim what, and the one way
 * to change a claim.
 *
 * ─── ONE WRITE AT A TIME PER SAC ────────────────────────────────────────────
 * A claim is stored on the SAC's row, so tagging two quizzes in quick
 * succession is two writes to ONE row. Built off the same stale copy, the
 * second write would put back the list the first one replaced, and one of the
 * two tags would silently vanish. So writes to a SAC queue behind each other,
 * and each one re-reads the row first (`latest`), which the entity cache has
 * already dropped because the write before it touched that table.
 *
 * ─── EVERY CHIP ON A PAGE AGREES ────────────────────────────────────────────
 * Two surfaces can show one item — a deck's chip on the shelf and the same
 * deck in a SAC's picker — so a write broadcasts the saved row and every
 * mounted copy of this hook takes it. Without that, untagging in one place
 * left the other still reading "For Chem · SAC 1".
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { foldersFor } from "@/lib/revision";
import { claimPatch, claimingFolders, tagTargets, sacIdOf } from "@/lib/sacTags";

export const SAC_TAGS_EVENT = "acedit:sactags";

const queues = new Map();

async function latest(id) {
    const E = base44.entities.SubjectAssessment;
    try {
        if (typeof E.get === "function") {
            const row = await E.get(id);
            if (row?.id) return row;
        }
    } catch { /* fall through to a filter */ }
    const rows = await E.filter({ id });
    return rows?.[0] || null;
}

/**
 * Write to one SAC's row: the latest copy is read, `build` turns it into a
 * patch, and the saved row is broadcast. EVERY write to a SAC's revision goes
 * through here — the tags, and the folder's own points, topics and history —
 * because they share one `extra.revision` object, and a points edit built off
 * a copy read before a tag landed would write the old claims straight back.
 * A `build` that returns null writes nothing.
 */
export function patchSac(sacId, build) {
    if (!sacId) return Promise.reject(new Error("Only a SAC can be tagged"));
    const before = queues.get(sacId) || Promise.resolve();
    const next = before.catch(() => {}).then(async () => {
        const row = await latest(sacId);
        if (!row) throw new Error("That SAC is no longer on your planner");
        const patch = build(row);
        if (!patch) return row;
        const saved = await base44.entities.SubjectAssessment.update(sacId, patch);
        const out = saved?.id ? saved : { ...row, ...patch };
        window.dispatchEvent(new CustomEvent(SAC_TAGS_EVENT, { detail: { row: out } }));
        return out;
    });
    queues.set(sacId, next);
    return next;
}

/** Add or remove one claim on a SAC. Resolves with the saved row. */
export function setClaim(folderKey, kind, id, on) {
    const sacId = sacIdOf(folderKey);
    if (!sacId) return Promise.reject(new Error("Only a SAC can be tagged"));
    return patchSac(sacId, (row) => claimPatch(row, kind, id, on));
}

/** Take every saved SAC row any surface broadcasts. */
export function useSacTagRows(onRow) {
    useEffect(() => {
        const on = (e) => { if (e.detail?.row?.id) onRow(e.detail.row); };
        window.addEventListener(SAC_TAGS_EVENT, on);
        return () => window.removeEventListener(SAC_TAGS_EVENT, on);
    }, [onRow]);
}

const swap = (row) => (prev) => (prev ? prev.map((r) => (r.id === row.id ? row : r)) : prev);

export default function useSacTags(email) {
    const [rows, setRows] = useState(null);

    useEffect(() => {
        if (!email) return undefined;
        let live = true;
        base44.entities.SubjectAssessment.filter({ created_by: email })
            .then((r) => { if (live) setRows(Array.isArray(r) ? r : []); })
            .catch(() => { if (live) setRows([]); });
        return () => { live = false; };
    }, [email]);

    const take = useCallback((row) => setRows(swap(row)), []);
    useSacTagRows(take);

    const folders = useMemo(() => foldersFor({ assessments: rows || [] }), [rows]);

    const toggle = useCallback((folderKey, kind, id, on) => {
        const sacId = sacIdOf(folderKey);
        const apply = (state) => (prev) => (prev
            ? prev.map((r) => (r.id === sacId ? { ...r, ...claimPatch(r, kind, id, state) } : r))
            : prev);
        // Shown at once, put back if the write fails: a chip reading "tagged"
        // over a row that is not is the screen disagreeing with the database.
        setRows(apply(on));
        return setClaim(folderKey, kind, id, on).catch((err) => {
            setRows(apply(!on));
            throw err;
        });
    }, []);

    return {
        ready: rows !== null,
        folders,
        toggle,
        targets: (q) => tagTargets(folders, q),
        claimedBy: (kind, id) => claimingFolders(folders.all, kind, id),
    };
}
