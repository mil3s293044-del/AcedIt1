/**
 * mindmap — the data model, outline parser and layout engine.
 *
 * The design constraint that shapes all of this: Karpicke & Blunt (2011,
 * Science) put concept mapping head to head with retrieval practice and
 * mapping lost — on recall, on inference, and even when the final test was
 * itself a concept map. Students expected the opposite. What rescued it was
 * the follow-up (Blunt & Karpicke, 2014): mapping done *as a retrieval task*,
 * closed book and from memory, works about as well as any other retrieval
 * format.
 *
 * So a mind map built by dragging your notes into boxes is note-taking with
 * extra steps, and by that evidence it's worse than what the student would
 * otherwise have done with the hour. The whole feature is built around
 * building blind first — hence `phase` on a map, and hence the outline being
 * the primary input rather than the canvas.
 *
 * A map is a tree, not a general graph. That's a deliberate limit: it makes
 * outline-first typing possible (which is the entire ease-of-use story), it
 * makes layout solvable, and in practice students' maps are trees with a
 * handful of cross-links, which are carried separately.
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

export const emptyMap = (title = "Untitled map") => ({
    title,
    subject: null,
    topic: "",
    phase: "blind",                 // blind → checked
    nodes: [{ id: nodeId(), parent: null, text: title, link: "", confidence: 0 }],
    crossLinks: [],                 // [{ from, to, label }] — the few real graph edges
});

// ─── Outline ↔ tree ─────────────────────────────────────────────────────────
// Typing is the fast path. Tab nests, Enter makes a sibling, and the canvas
// draws itself — most students will never touch a node with a mouse, which is
// exactly why mind-map tools usually fail.

/** Edge labels are written inline: "Krebs cycle :: follows on from". */
const splitLabel = (line) => {
    const i = line.indexOf("::");
    if (i < 0) return { text: line.trim(), link: "" };
    return { text: line.slice(0, i).trim(), link: line.slice(i + 2).trim() };
};

/**
 * Indented text → nodes. Indentation is counted in leading whitespace, with a
 * tab worth four spaces, and each distinct depth seen becomes one level — so
 * a student who indents by 2, 3 or 4 spaces all get the same tree.
 */
export function parseOutline(text) {
    const lines = String(text || "").split("\n").filter(l => l.trim());
    if (!lines.length) return [];

    const measured = lines.map(l => {
        const ws = l.match(/^[\t ]*/)[0];
        const indent = ws.replace(/\t/g, "    ").length;
        return { indent, ...splitLabel(l.replace(/^[\t ]*[-*•]?\s*/, "")) };
    }).filter(m => m.text);

    const nodes = [];
    const stack = [];        // [{ indent, id }]
    for (const m of measured) {
        while (stack.length && stack[stack.length - 1].indent >= m.indent) stack.pop();
        const parent = stack.length ? stack[stack.length - 1].id : null;
        // Only one root: anything at top level after the first becomes its child,
        // because a "mind map" with five roots is a list wearing a costume.
        const id = nodeId();
        const realParent = parent || (nodes.length ? nodes[0].id : null);
        nodes.push({ id, parent: realParent, text: m.text, link: m.link, confidence: 0 });
        stack.push({ indent: m.indent, id });
    }
    return nodes;
}

/** Tree → indented text, preserving edge labels. */
export function toOutline(nodes) {
    const roots = nodes.filter(n => !n.parent);
    const kidsOf = (id) => nodes.filter(n => n.parent === id);
    const out = [];
    const walk = (n, depth) => {
        out.push(`${"  ".repeat(depth)}${n.text}${n.link ? ` :: ${n.link}` : ""}`);
        kidsOf(n.id).forEach(k => walk(k, depth + 1));
    };
    roots.forEach(r => walk(r, 0));
    return out.join("\n");
}

// ─── Layout ─────────────────────────────────────────────────────────────────

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

/**
 * Two-sided horizontal tree — the classic mind map shape. Root in the middle,
 * branches fanning out left and right, depth reading outwards.
 *
 * This replaced a radial layout that looked right on paper and degenerated in
 * practice. Radial gives each subtree an angular slice, so a root with two
 * branches puts them at 0° and 180° — every node in the map lands on the same
 * y, the picture collapses into a one-pixel-tall strip, and the edge labels end
 * up underneath the node boxes. Two children is the most ordinary map there is.
 *
 * Here overlap is impossible by construction rather than by luck: every leaf
 * gets its own row, an internal node sits at the midpoint of its children's
 * rows, and a subtree owns a contiguous block of rows. Two nodes at the same
 * depth are always in different blocks; two nodes in the same row are always at
 * different depths.
 *
 * Returns { positions: Map<id, {x,y,depth}>, width, height } in a 0-origin box.
 */
export function layout(nodes, { colGap = 250, rowGap = 78, nodeW = 150, nodeH = 50 } = {}) {
    if (!nodes?.length) return { positions: new Map(), width: 0, height: 0 };
    const { children, root } = indexTree(nodes);
    const leaves = leafCounts(nodes);
    const positions = new Map();
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
            positions.set(n.id, { x: dir * depth * colGap, y: (rowOf.get(n.id) - mid) * rowGap, depth });
            (children.get(n.id) || []).forEach(k => place(k, depth + 1));
        };
        branches.forEach(bn => place(bn, 1));
    });

    // Normalise into a positive box with room for the node boxes themselves.
    const xs = [...positions.values()].map(p => p.x);
    const ys = [...positions.values()].map(p => p.y);
    const minX = Math.min(...xs) - nodeW, maxX = Math.max(...xs) + nodeW;
    const minY = Math.min(...ys) - nodeH, maxY = Math.max(...ys) + nodeH;
    for (const [, p] of positions) { p.x -= minX; p.y -= minY; }
    return { positions, width: maxX - minX, height: maxY - minY };
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
        crossLinks: (map?.crossLinks || []).length,
    };
}

/**
 * Every labelled edge as a cloze item — the export into Spaced Repetition.
 * An unlabelled edge is skipped on purpose: "X → Y" with no relationship is
 * exactly the vague link the feature is trying to push students past.
 */
export function edgesAsCards(map) {
    const nodes = map?.nodes || [];
    const byId = new Map(nodes.map(n => [n.id, n]));
    const cards = [];
    for (const n of nodes) {
        if (!n.parent || !n.link) continue;
        const parent = byId.get(n.parent);
        if (!parent) continue;
        cards.push({
            question: `How does "${parent.text}" relate to "${n.text}"?`,
            answer: n.link,
            topic: map.topic || map.title,
        });
    }
    for (const c of map?.crossLinks || []) {
        const a = byId.get(c.from), b = byId.get(c.to);
        if (a && b && c.label) {
            cards.push({ question: `How does "${a.text}" relate to "${b.text}"?`, answer: c.label,
                topic: map.topic || map.title });
        }
    }
    return cards;
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
