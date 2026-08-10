/**
 * mindmap — the graph model, outline parser, layout engine and exports.
 *
 * A map is a spine tree plus free edges. That split is doing real work:
 *
 *   • The tree is what the outline editor produces and what auto-layout can
 *     position. Typing an indented list is still the fastest way to get
 *     thirty nodes onto a page, and nothing about dragging replaces it.
 *   • The free edges are any-to-any and drawn by hand. Real understanding is
 *     full of links that aren't parent-child — a cause three branches over
 *     driving an effect here — and a pure tree can't hold those.
 *
 * Positions work the same way. Nodes the student hasn't touched are laid out
 * automatically; a node they drag becomes `pinned` and keeps its coordinates
 * forever after. So the map tidies itself until you disagree with it, and
 * then it stops arguing.
 *
 * Coordinates are NOT normalised to a positive box. They used to be, and that
 * was a bug waiting to happen: the normalising shift changes every time a node
 * is added, so a dragged node's stored x/y would silently drift relative to
 * everything else. Positions are absolute with the root at (0,0), and the
 * caller gets the bounds separately to build a viewBox from.
 *
 * On the learning side, the constraint that shapes the exports: Karpicke &
 * Blunt (2011, Science) put concept mapping head to head with retrieval
 * practice and mapping lost — on recall, on inference, and even when the final
 * test was itself a concept map. Blunt & Karpicke (2014) found what rescues
 * it: mapping done *as a retrieval task*. So the map is worth most when it
 * feeds retrieval elsewhere, which is what the typed export is for.
 */

let seq = 0;
export const nodeId = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;

/** How sure the student is about a node. Drives colour, and weak-spot export. */
export const CONFIDENCE = [
    { v: 0, label: "Not marked", tone: "muted" },
    { v: 1, label: "Shaky",      tone: "streak" },
    { v: 2, label: "Getting it", tone: "xp" },
    { v: 3, label: "Solid",      tone: "primary" },
];

/**
 * What kind of thing a node is.
 *
 * These are not decoration. Type is what lets the map export itself as useful
 * practice rather than as a pile of nouns: a `term` with a note becomes a
 * definition card, a `question` becomes a recall prompt, a cause→effect edge
 * becomes "what does this lead to". An untyped map exports almost nothing,
 * which is the honest outcome — there's nothing in it to make a question from.
 *
 * Eight types, because a palette of twenty is a palette nobody reads. Colour
 * groups the family (blue = structure, orange/purple = causal, green =
 * support, red = unresolved) and the icon separates members within it.
 */
export const NODE_TYPES = [
    { id: "idea",     label: "Main idea", hint: "The thing this branch is about",      tone: "map",     icon: "Lightbulb" },
    { id: "cause",    label: "Cause",     hint: "What drives it",                      tone: "xp",      icon: "Zap" },
    { id: "effect",   label: "Effect",    hint: "What follows from it",                tone: "chart-4", icon: "Target" },
    { id: "step",     label: "Step",      hint: "One stage in a process",              tone: "chart-3", icon: "ListOrdered" },
    { id: "term",     label: "Term",      hint: "A word you have to be able to define", tone: "chart-3", icon: "BookMarked" },
    { id: "example",  label: "Example",   hint: "A concrete case",                     tone: "primary", icon: "Quote" },
    { id: "evidence", label: "Evidence",  hint: "Data, a study, a case",               tone: "primary", icon: "FlaskConical" },
    { id: "question", label: "Open question", hint: "Something you can't answer yet",  tone: "streak",  icon: "HelpCircle" },
];
export const TYPE_BY_ID = Object.fromEntries(NODE_TYPES.map(t => [t.id, t]));

export const emptyMap = (title = "Untitled map", type = "idea") => ({
    title,
    subject: null,
    topic: "",
    phase: "blind",                 // blind → checked
    nodes: [{ id: nodeId(), parent: null, text: title, link: "", confidence: 0, type, note: "" }],
    crossLinks: [],                 // [{ id, from, to, label }] — the hand-drawn graph edges
});

export const newNode = (text, { parent = null, type = "idea", x, y } = {}) => ({
    id: nodeId(), parent, text, link: "", confidence: 0, type, note: "",
    ...(Number.isFinite(x) && Number.isFinite(y) ? { x, y, pinned: true } : {}),
});

// ─── Outline ↔ tree ─────────────────────────────────────────────────────────
// Typing stays the fast path. Dragging is for arranging a map you already
// have; it is a bad way to get the first thirty nodes down.

/** Edge labels are written inline: "Krebs cycle :: follows on from". */
const splitLabel = (line) => {
    const i = line.indexOf("::");
    if (i < 0) return { text: line.trim(), link: "" };
    return { text: line.slice(0, i).trim(), link: line.slice(i + 2).trim() };
};

/** Types can be written inline too: "Surface area [cause]". */
const TYPE_TAG = new RegExp(`\\s*\\[(${NODE_TYPES.map(t => t.id).join("|")})\\]\\s*$`, "i");
const splitType = (text) => {
    const m = text.match(TYPE_TAG);
    if (!m) return { text, type: null };
    return { text: text.replace(TYPE_TAG, "").trim(), type: m[1].toLowerCase() };
};

/**
 * Indented text → nodes. Indentation is counted in leading whitespace, with a
 * tab worth four spaces, and each distinct depth seen becomes one level — so a
 * student who indents by 2, 3 or 4 spaces all get the same tree.
 *
 * `previous` carries forward everything the outline can't express — position,
 * notes, confidence, pinning — matched on text, so re-parsing after an edit
 * doesn't throw away work done on the canvas.
 */
export function parseOutline(text, previous = []) {
    const lines = String(text || "").split("\n").filter(l => l.trim());
    if (!lines.length) return [];

    const measured = lines.map(l => {
        const ws = l.match(/^[\t ]*/)[0];
        const indent = ws.replace(/\t/g, "    ").length;
        const split = splitLabel(l.replace(/^[\t ]*[-*•]?\s*/, ""));
        const typed = splitType(split.text);
        return { indent, text: typed.text, type: typed.type, link: split.link };
    }).filter(m => m.text);

    // Anything the student did on the canvas that the outline can't carry.
    const carried = new Map();
    for (const p of previous) {
        const k = norm(p.text);
        if (k && !carried.has(k)) carried.set(k, p);
    }

    const nodes = [];
    const stack = [];        // [{ indent, id }]
    for (const m of measured) {
        while (stack.length && stack[stack.length - 1].indent >= m.indent) stack.pop();
        const parent = stack.length ? stack[stack.length - 1].id : null;
        // Only one root: anything at top level after the first becomes its
        // child, because a "mind map" with five roots is a list in a costume.
        const id = nodeId();
        const realParent = parent || (nodes.length ? nodes[0].id : null);
        const old = carried.get(norm(m.text));
        nodes.push({
            id, parent: realParent, text: m.text, link: m.link,
            confidence: old?.confidence ?? 0,
            type: m.type || old?.type || (realParent ? "idea" : "idea"),
            note: old?.note || "",
            ...(old?.pinned ? { x: old.x, y: old.y, pinned: true } : {}),
        });
        stack.push({ indent: m.indent, id });
    }
    return nodes;
}

/** Tree → indented text, preserving edge labels and non-default types. */
export function toOutline(nodes) {
    const roots = nodes.filter(n => !n.parent);
    const kidsOf = (id) => nodes.filter(n => n.parent === id);
    const out = [];
    const walk = (n, depth) => {
        const type = n.type && n.type !== "idea" ? ` [${n.type}]` : "";
        out.push(`${"  ".repeat(depth)}${n.text}${type}${n.link ? ` :: ${n.link}` : ""}`);
        kidsOf(n.id).forEach(k => walk(k, depth + 1));
    };
    roots.forEach(r => walk(r, 0));
    return out.join("\n");
}

// ─── Tree helpers ───────────────────────────────────────────────────────────

/** Depth of each node, and the tree grouped by parent. */
export function indexTree(nodes) {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const children = new Map();
    for (const n of nodes) {
        if (!children.has(n.parent)) children.set(n.parent, []);
        children.get(n.parent).push(n);
    }
    const root = nodes.find(n => !n.parent || !byId.has(n.parent)) || nodes[0];
    return { byId, children, root };
}

/** Leaves under each node — the weight each subtree needs in the layout. */
function leafCounts(nodes) {
    const { children } = indexTree(nodes);
    const memo = new Map();
    const count = (n) => {
        if (memo.has(n.id)) return memo.get(n.id);
        const kids = children.get(n.id) || [];
        const c = kids.length ? kids.reduce((s, k) => s + count(k), 0) : 1;
        memo.set(n.id, c);
        return c;
    };
    nodes.forEach(count);
    return memo;
}

/** Every id at or under `id`, so a drag can move a whole branch. */
export function subtreeIds(nodes, id) {
    const { children } = indexTree(nodes);
    const out = [];
    const walk = (n) => { out.push(n.id); (children.get(n.id) || []).forEach(walk); };
    const start = nodes.find(n => n.id === id);
    if (start) walk(start);
    return out;
}

/** Removing a node takes its branch and any edge touching it. */
export function removeNode(map, id) {
    const doomed = new Set(subtreeIds(map.nodes, id));
    return {
        ...map,
        nodes: map.nodes.filter(n => !doomed.has(n.id)),
        crossLinks: (map.crossLinks || []).filter(e => !doomed.has(e.from) && !doomed.has(e.to)),
    };
}

// ─── Layout ─────────────────────────────────────────────────────────────────

/**
 * Two-sided horizontal tree — the classic mind map shape. Root in the middle,
 * branches fanning out left and right, depth reading outwards.
 *
 * This replaced a radial layout that looked right on paper and degenerated in
 * practice. Radial gives each subtree an angular slice, so a root with two
 * branches puts them at 0° and 180° — every node in the map lands on the same
 * y, the picture collapses into a one-pixel-tall strip, and the edge labels
 * end up underneath the node boxes. Two children is the most ordinary map
 * there is.
 *
 * Here overlap is impossible by construction rather than by luck: every leaf
 * gets its own row, an internal node sits at the midpoint of its children's
 * rows, and a subtree owns a contiguous block of rows. Two nodes at the same
 * depth are always in different blocks; two nodes in the same row are always
 * at different depths.
 *
 * Pinned nodes opt out entirely and keep the coordinates the student dragged
 * them to. Their positions still count towards the bounds, or half the map
 * would sit outside the viewBox.
 *
 * Returns { positions: Map<id,{x,y,depth,pinned}>, minX, minY, width, height }
 * in ABSOLUTE coordinates with the root at (0,0) — see the file header.
 */
// colGap has to leave room for a link chip BETWEEN two nodes, not just for
// the nodes: colGap - nodeW is the whole gap, and a chip for "limits the
// rate" is about 100px. At 250 with 170-wide nodes it had 80 and clipped
// the parent.
export function layout(nodes, { colGap = 290, rowGap = 88, nodeW = 170, nodeH = 58 } = {}) {
    if (!nodes?.length) return { positions: new Map(), minX: 0, minY: 0, width: 0, height: 0 };
    const { children, root } = indexTree(nodes);
    const leaves = leafCounts(nodes);
    const positions = new Map();
    const depthOf = new Map([[root.id, 0]]);
    positions.set(root.id, { x: 0, y: 0, depth: 0 });

    // Split the root's branches across the two sides by leaf weight, so a
    // branch with nine children doesn't stack up against one with a single
    // child and drag the whole map off-centre.
    const sides = [[], []], weight = [0, 0];
    for (const k of children.get(root.id) || []) {
        const i = weight[0] <= weight[1] ? 0 : 1;
        sides[i].push(k);
        weight[i] += leaves.get(k.id) || 1;
    }

    sides.forEach((branches, side) => {
        if (!branches.length) return;
        const dir = side === 0 ? 1 : -1;
        const rowOf = new Map();
        let cursor = 0;
        const assign = (n) => {
            const kids = children.get(n.id) || [];
            if (!kids.length) { rowOf.set(n.id, cursor++); return cursor - 1; }
            const rows = kids.map(assign);
            const r = (rows[0] + rows[rows.length - 1]) / 2;
            rowOf.set(n.id, r);
            return r;
        };
        branches.forEach(assign);

        // Centre each side on the root, so the map balances rather than
        // hanging off one corner.
        const rows = [...rowOf.values()];
        const mid = (Math.min(...rows) + Math.max(...rows)) / 2;
        const place = (n, depth) => {
            depthOf.set(n.id, depth);
            positions.set(n.id, { x: dir * depth * colGap, y: (rowOf.get(n.id) - mid) * rowGap, depth });
            (children.get(n.id) || []).forEach(k => place(k, depth + 1));
        };
        branches.forEach(bn => place(bn, 1));
    });

    // A dragged node keeps where it was dropped.
    for (const n of nodes) {
        if (!n.pinned || !Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
        positions.set(n.id, { x: n.x, y: n.y, depth: depthOf.get(n.id) ?? 1, pinned: true });
    }

    const xs = [...positions.values()].map(p => p.x);
    const ys = [...positions.values()].map(p => p.y);
    const minX = Math.min(...xs) - nodeW, maxX = Math.max(...xs) + nodeW;
    const minY = Math.min(...ys) - nodeH, maxY = Math.max(...ys) + nodeH;
    return { positions, minX, minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Branch colours.
 *
 * A mind map's colour has to carry STRUCTURE, not category: every branch off
 * the root owns a colour and everything hanging off it inherits. That's what
 * lets you see at a glance that four boxes belong together, and it's the thing
 * that most separates a mind map from a flowchart.
 *
 * Node TYPE used to own the colour instead, which meant a single branch could
 * be four different colours and two unrelated branches could match — the
 * palette was fighting the structure rather than showing it. Type now reads
 * from a small marker on the node instead.
 */
export const BRANCH_TONES = ["map", "chart-3", "chart-4", "xp", "primary", "streak"];

export function branchTones(nodes) {
    const out = new Map();
    if (!nodes?.length) return out;
    const { children, root } = indexTree(nodes);
    if (!root) return out;
    out.set(root.id, "root");
    (children.get(root.id) || []).forEach((branch, i) => {
        const tone = BRANCH_TONES[i % BRANCH_TONES.length];
        const walk = (n) => {
            out.set(n.id, tone);
            (children.get(n.id) || []).forEach(walk);
        };
        walk(branch);
    });
    // Anything orphaned by a bad parent ref still needs a colour.
    for (const n of nodes) if (!out.has(n.id)) out.set(n.id, BRANCH_TONES[0]);
    return out;
}

/** Where a brand-new node should land when there's nothing selected. */
export function freeSpotNear(nodes, anchorId, opts = {}) {
    const { positions } = layout(nodes, opts);
    const a = positions.get(anchorId) || { x: 0, y: 0 };
    const taken = [...positions.values()];
    // Walk outwards until nothing is within a node's width — dropping a new
    // node on top of an existing one reads as "it didn't work". The clearance
    // is a node plus a margin, not exactly a node: landing 2px clear of the
    // root still looks like a collision.
    const { nodeW = 170, nodeH = 58 } = opts;
    const clearX = nodeW + 24, clearY = nodeH + 20;
    for (let ring = 1; ring < 40; ring++) {
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const x = a.x + dx * ring * 110, y = a.y + dy * ring * 96;
            if (!taken.some(p => Math.abs(p.x - x) < clearX && Math.abs(p.y - y) < clearY)) return { x, y };
        }
    }
    return { x: a.x + nodeW + 120, y: a.y };
}

// ─── Reading a map ──────────────────────────────────────────────────────────

/** Flat stats a card can show without walking the tree itself. */
export function mapStats(map) {
    const nodes = map?.nodes || [];
    const { children } = indexTree(nodes.length ? nodes : [{ id: "x", parent: null }]);
    const depth = (() => {
        if (!nodes.length) return 0;
        const { root } = indexTree(nodes);
        const walk = (n, d) => Math.max(d, ...(children.get(n.id) || []).map(k => walk(k, d + 1)));
        return walk(root, 1);
    })();
    return {
        nodes: nodes.length,
        depth,
        linked: nodes.filter(n => n.link).length,
        shaky: nodes.filter(n => n.confidence === 1).length,
        typed: nodes.filter(n => n.type && n.type !== "idea").length,
        noted: nodes.filter(n => n.note?.trim()).length,
        crossLinks: (map?.crossLinks || []).length,
    };
}

/**
 * Turn part of a map into retrieval practice.
 *
 * Every card comes from something the student actually wrote — a label they
 * typed, a note they added, children they nested. Nothing is invented, and a
 * node with no answer material is skipped rather than turned into a card whose
 * back is blank. That's why an untyped, un-noted map exports almost nothing:
 * there is genuinely nothing in it to be tested on yet, and saying so is more
 * useful than manufacturing forty cards that all read "X → ?".
 *
 * `ids` limits it to a selection; omit for the whole map.
 */
export function exportCards(map, ids = null) {
    const nodes = map?.nodes || [];
    const scope = ids ? new Set(ids) : null;
    const inScope = (n) => !scope || scope.has(n.id);
    const byId = new Map(nodes.map(n => [n.id, n]));
    const { children } = indexTree(nodes.length ? nodes : [{ id: "x", parent: null }]);
    const kidText = (n) => (children.get(n.id) || []).map(k => k.text).join("; ");
    const topic = map?.topic || map?.title;
    const cards = [];
    const seen = new Set();
    const push = (question, answer, why) => {
        const key = question.toLowerCase();
        if (!answer?.trim() || seen.has(key)) return;
        seen.add(key);
        cards.push({ question, answer: answer.trim(), topic, why });
    };

    for (const n of nodes) {
        if (!inScope(n)) continue;
        const parent = n.parent ? byId.get(n.parent) : null;

        // A labelled link is a relationship the student named — the single
        // highest-value thing on a map, so it always makes a card.
        if (parent && n.link) {
            push(`How does "${parent.text}" relate to "${n.text}"?`, n.link, "labelled link");
        }
        // A term is a definition card if there's anything to define it with.
        if (n.type === "term") {
            push(`What does "${n.text}" mean?`, n.note || kidText(n), "term");
        }
        // An open question is already a retrieval prompt; it just needs the
        // answer the student eventually found.
        if (n.type === "question") {
            push(n.text.replace(/\?*$/, "?"), n.note || kidText(n), "open question");
        }
        // An example is worth testing in the direction that's hard: given the
        // idea, produce the case — not given the case, name the idea.
        if (n.type === "example" && parent) {
            push(`Give an example of "${parent.text}".`, n.text, "example");
        }
        if (n.type === "evidence" && parent) {
            push(`What evidence supports "${parent.text}"?`, n.note || n.text, "evidence");
        }
        // Causal structure, taken from the tree.
        if (n.type === "effect" && parent) {
            push(`What does "${parent.text}" lead to?`, n.note || n.text, "effect");
        }
        if (n.type === "cause" && parent) {
            push(`What causes "${parent.text}"?`, n.note || n.text, "cause");
        }
        // A node with a note and no other rule still holds real content.
        if (n.note?.trim() && !["term", "question", "evidence", "effect", "cause"].includes(n.type)) {
            push(`What do you know about "${n.text}"?`, n.note, "note");
        }
    }

    // Hand-drawn edges are the links a tree couldn't hold, so they're worth
    // more than the average branch, not less.
    for (const e of map?.crossLinks || []) {
        const a = byId.get(e.from), b = byId.get(e.to);
        if (!a || !b || !e.label) continue;
        if (scope && !scope.has(a.id) && !scope.has(b.id)) continue;
        push(`How does "${a.text}" relate to "${b.text}"?`, e.label, "connection");
    }
    return cards;
}

/** Prompts for a Blurting / Active Recall session — questions, no answers. */
export function exportPrompts(map, ids = null) {
    const nodes = map?.nodes || [];
    const scope = ids ? new Set(ids) : null;
    return nodes
        .filter(n => (!scope || scope.has(n.id)) && n.text?.trim())
        .filter(n => n.type === "question" || n.confidence === 1 || n.type === "term")
        .map(n => (n.type === "question" ? n.text.replace(/\?*$/, "?") : `Everything you know about ${n.text}`));
}

/**
 * Compare two versions of the same map, built from memory a week apart.
 * Matching is on normalised text — a student rebuilding from memory will type
 * "Krebs cycle" and "the Krebs Cycle" and mean the same node.
 */
const norm = (s) => String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/^(the|a|an) /, "")     // "the Krebs Cycle" and "Krebs cycle" are one node
    .replace(/\s+/g, " ")
    .trim();

export function diffMaps(before, after) {
    const a = new Map((before?.nodes || []).map(n => [norm(n.text), n]));
    const b = new Map((after?.nodes || []).map(n => [norm(n.text), n]));
    const kept = [...b.keys()].filter(k => a.has(k));
    const lost = [...a.keys()].filter(k => !b.has(k));
    const gained = [...b.keys()].filter(k => !a.has(k));
    const retention = a.size ? Math.round((kept.length / a.size) * 100) : 0;
    return {
        retention,
        kept: kept.map(k => b.get(k).text),
        lost: lost.map(k => a.get(k).text),
        gained: gained.map(k => b.get(k).text),
    };
}
