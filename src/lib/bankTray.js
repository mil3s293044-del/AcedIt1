/**
 * bankTray — every mark a marked quiz dropped, laid out to be saved in one go.
 *
 * Banking a mistake used to take a tour. The verdict said "save the ones worth
 * rehearsing from the marks below" and offered one button, which LEFT for the
 * mistake bank, where nothing from this quiz had been saved yet. To actually
 * save one, a student went through the questions one at a time, opened each
 * mark and pressed a button at the bottom of it — for every mark, on every
 * question. Four dropped marks on a paper was four trips, and "Save all" on a
 * question fired one toast per card.
 *
 * The verdict now carries the tray: every bankable mark on the paper, grouped
 * by question, with the ones that COST a mark already ticked, and one button.
 *
 * WHAT IS TICKED IS A DECISION, AND IT IS THREE RULES:
 *
 *   - A mark that cost something is ticked. That is why the student is here.
 *   - A note on the wording that cost nothing is listed and NOT ticked. It is
 *     worth having and it is not a dropped mark; ticking it would fill the bank
 *     with things that never cost a point.
 *   - A question LEFT BLANK is listed and NOT ticked. Every criterion on it is
 *     "lost", so ticking them would turn one unanswered question into four
 *     drill cards — and an unanswered question is a SIT, not a phrase-sized
 *     mistake. /MistakeBank's "Sit again" already derives those from the
 *     attempt history; `autoBankRows` was deleted for confusing the two.
 *
 * Keys are `bankKey(mod, qIndex)` — the same key the per-question panel uses —
 * so a mark saved from the tray reads as saved when the student goes through
 * the questions afterwards, and the other way round. Pure, so a test can hold
 * it.
 */
import { markLedger } from "@/lib/quizMarking";
import { bankKey, mistakeMeta, isBankCard, isRetired } from "@/lib/mistakeBank";

/**
 * `items` is one entry per question: `{ qIndex, mark, blank }`, where `mark` is
 * the normalised mark (`aiFeedback[i].mark`) and `blank` is quizScore's.
 *
 * Returns the groups in question order, each with its rows lost-first (the
 * ledger's own order). A question with nothing bankable is not a group.
 */
export function trayGroups(items = []) {
    const groups = [];
    for (const it of items) {
        const mark = it?.mark;
        if (!mark?.itemised) continue;
        const ledger = markLedger(mark);
        const blank = it.blank === true;
        const rows = ledger.bankable
            .map((mod) => ({
                key: bankKey(mod, it.qIndex),
                qIndex: it.qIndex,
                mod,
                cost: mod.cost || 0,
                quote: mod.evidence?.[0]?.quote || null,
                pick: mod.status === "lost" && !blank,
            }))
            .filter((r) => r.key);
        if (!rows.length) continue;
        groups.push({ qIndex: it.qIndex, label: `Q${it.qIndex + 1}`, blank, lost: ledger.lost, outOf: mark.outOf, rows });
    }
    return groups;
}

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Rows whose mistake is ALREADY in the bank, from an earlier sit.
 *
 * Banked keys used to live only in the player's state, so they lasted one
 * sit. A re-sit from /MistakeBank is made of questions that are in the bank by
 * construction — drop the same criterion again and the tray would offer to
 * save it a second time, and so would the next sit, and the bank would grow a
 * copy per attempt of one mistake. A row is already banked when a live bank
 * card came from the same question of the same quiz and names the same
 * criterion. `sourceOf` maps a question's position in THIS paper to its index
 * in the quiz it came from, which differs on a re-sit.
 *
 * A CLEARED card does not count: clearing is "I have fixed this", and
 * dropping it again is the one piece of evidence that says otherwise, so it
 * may be banked afresh.
 */
export function alreadyBanked(groups = [], cards = [], { quizId, sourceOf = (i) => i } = {}) {
    if (quizId == null) return new Set();
    const have = new Set();
    for (const c of cards) {
        if (!isBankCard(c) || isRetired(c) || c?.is_active === false) continue;
        const m = mistakeMeta(c);
        if (!m.source || m.source.quizId !== String(quizId)) continue;
        have.add(`${m.source.qIndex}|${norm(m.criterion)}`);
    }
    const out = new Set();
    if (!have.size) return out;
    for (const g of groups) {
        const src = sourceOf(g.qIndex);
        for (const r of g.rows) if (have.has(`${src}|${norm(r.mod.text)}`)) out.add(r.key);
    }
    return out;
}

/** What starts ticked: the rows that cost a mark, minus anything already saved. */
export function trayPicks(groups = [], banked = new Set()) {
    const out = new Set();
    for (const g of groups) for (const r of g.rows) if (r.pick && !banked.has(r.key)) out.add(r.key);
    return out;
}

/** Every row still savable, in tray order. */
export const trayOpen = (groups = [], banked = new Set()) =>
    groups.flatMap((g) => g.rows.filter((r) => !banked.has(r.key)));

/** The button, in the student's words. */
export function trayButton(n) {
    if (!n) return "Tick a mark to save it";
    return `Save ${n} to my mistake bank`;
}

/** The one toast a batch earns — and only the first save of a sit names the place. */
export function savedLine(ok, failed = 0) {
    if (!ok && failed) return { title: "Couldn't save those", tone: "error" };
    const title = ok === 1 ? "Saved to your mistake bank" : `Saved ${ok} to your mistake bank`;
    return { title, tone: failed ? "partial" : "ok", failed };
}

export default { trayGroups, alreadyBanked, trayPicks, trayOpen, trayButton, savedLine };
