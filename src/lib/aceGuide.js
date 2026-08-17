/**
 * aceGuide — the half of Ace that doesn't need a model.
 *
 * Ace was premium-only, which meant the one thing built to explain AcedIt
 * couldn't explain it to anybody who hadn't already paid for it. That's the
 * wrong way round: a student who doesn't understand the product is not a
 * student who is about to buy it.
 *
 * So Ace splits in two. Most of what a confused student actually asks —
 * "what is this", "where is it", "what should I do now", "show me" — needs
 * no language model at all. It needs the app to know its own features and to
 * be able to read the student's data, both of which we have. That half is
 * this file: rules, instant, free, and it cannot hallucinate a feature that
 * doesn't exist because it can only name things in the knowledge map.
 *
 * The LLM keeps the half it's actually needed for — explaining photosynthesis,
 * marking an essay, talking someone off a ledge at 11pm.
 */
import { FEATURES, BY_ID, findFeatures, readiness, blockedBy, NEEDS, tokens } from "@/lib/aceKnowledge";
import { retentionOutlook, reviewMinutes } from "@/lib/retention";
import { weakTopicsFrom } from "@/lib/weakTopics";
import { bestLever } from "@/lib/atarLift";

const DAY = 86400000;

/**
 * The five things the AcedIt ATAR is built from, each mapped to the one place
 * a student can actually go and move it. A weakest-component readout with no
 * door attached to it is a diagnosis, not advice.
 */
const LEVER = {
    mastery:     { label: "Mastery",     feature: "spaced_repetition" },
    consistency: { label: "Consistency", feature: "pomodoro" },
    effort:      { label: "Effort",      feature: "pomodoro" },
    breadth:     { label: "Breadth",     feature: "subjects" },
    planning:    { label: "Planning",    feature: "week_plan" },
};

/**
 * A card Ace can deal.
 *
 * `why` is not decoration and is never optional. A suggestion whose reason
 * can't be stated is a suggestion the student is right to ignore, and this
 * app already has enough places that tell you to do something without saying
 * how it decided.
 */
const card = ({ id, title, why, to, cta, tone = "primary", weight, feature = null, meta = null }) =>
    ({ id, title, why, to, cta, tone, weight, feature, meta });

/**
 * The whole point of the thing: what's worth doing right now, from real data.
 *
 * Almost none of this is new logic. `retentionOutlook`, `weakTopicsFrom` and
 * `bestLever` were all built for panels that live on pages a student may never
 * open — the Dashboard, the Analytics Cognition tab, the Planner dialog. The
 * work here is collecting them into one place that comes to the student
 * instead of waiting to be found.
 *
 * Ordered by what it costs to skip, and capped, because a hand of nine cards
 * is a list, and a list is the thing they were already ignoring.
 */
export function dealHand({
    subjects = [], flashcards = [], assessments = [], techniques = [], maps = [],
    friends = [], plans = [], profile = null, atarComponents = null,
    now = Date.now(), limit = 3,
} = {}) {
    const ready = readiness({ subjects, flashcards, assessments, techniques, maps, friends });
    const out = [];

    // ── Setup first. Everything downstream is empty without it, and a tip
    //    about spaced repetition to someone with no subjects is noise.
    if (!ready.subjects) {
        return {
            ready,
            stage: "setup",
            cards: [card({
                id: "add-subjects",
                title: "Add your subjects",
                why: "Nearly everything here is organised by subject, so the app stays mostly empty until it knows what you're taking.",
                to: "/Subjects", cta: "Add subjects", tone: "primary", weight: 100,
                feature: "subjects",
            })],
        };
    }

    // ── Something due, dated, and close. Nothing outranks a deadline.
    const soon = assessments
        .filter(a => a && !a.is_completed && a.due_date)
        .map(a => ({ ...a, days: Math.round((Date.parse(a.due_date) - now) / DAY) }))
        .filter(a => Number.isFinite(a.days) && a.days >= 0 && a.days <= 14)
        .sort((a, b) => a.days - b.days);
    if (soon.length) {
        const a = soon[0];
        const when = a.days === 0 ? "today" : a.days === 1 ? "tomorrow" : `in ${a.days} days`;
        // Planned or not changes the advice completely, so it's checked rather
        // than assumed.
        const planned = plans.some(p => {
            const d = Math.round((Date.parse(p?.date) - now) / DAY);
            return Number.isFinite(d) && d >= 0 && d <= a.days
                && (!a.subject_name || p?.subject_name === a.subject_name);
        });
        out.push(planned
            ? card({
                id: `sac-${a.id || a.due_date}`,
                title: `${a.subject_name || "Assessment"} ${when}`,
                why: `${a.title || "It"} is ${when} and you've got sessions planned. Blurting finds the gaps while there's still time to close them.`,
                to: "/Study?tab=blurting", cta: "Find the gaps", tone: "streak", weight: 90,
                feature: "blurting",
            })
            : card({
                id: `sac-${a.id || a.due_date}`,
                title: `${a.subject_name || "Assessment"} ${when}, nothing planned`,
                why: `${a.title || "It"} is ${when} and there's nothing in your week for it.`,
                to: "/Goals", cta: "Plan around it", tone: "streak", weight: 95,
                feature: "week_plan",
            }));
    }

    // ── Cards about to fall out of reach. This is the one piece of advice the
    //    app can give that has a deadline attached to it and a cost in minutes.
    if (ready.reviewed) {
        const o = retentionOutlook(flashcards, { days: 7, now });
        if (o.atRisk >= 3) {
            const mins = reviewMinutes(o.atRisk);
            out.push(card({
                id: "retention",
                title: `${o.atRisk} card${o.atRisk === 1 ? "" : "s"} slipping this week`,
                why: o.slipping > 0
                    ? `${o.slipping} ${o.slipping === 1 ? "is" : "are"} already past reliable recall, and the rest drop out over the next few days. About ${mins} minutes to hold the lot.`
                    : `They drop below reliable recall over the next seven days. About ${mins} minutes to hold them.`,
                to: "/Study?tab=spaced_repetition", cta: `Review — ~${mins} min`,
                tone: "chart-3", weight: 80, feature: "spaced_repetition",
                meta: { minutes: mins, count: o.atRisk },
            }));
        }
    }

    // ── Topics that keep costing marks. Different from "slipping": these were
    //    never solid in the first place.
    const weak = weakTopicsFrom(flashcards);
    if (weak.length) {
        const t = weak[0];
        out.push(card({
            id: `weak-${t.subject}-${t.topic}`,
            title: `${t.topic} keeps not landing`,
            why: t.missRate != null
                ? `${t.missRate}% of your reviews on this missed. Re-reading it won't show you why — being asked will.`
                : `${t.weakCards} card${t.weakCards === 1 ? "" : "s"} here are flagged as weak spots.`,
            to: "/Study?tab=active_recall", cta: "Test this topic",
            tone: "chart-4", weight: 70, feature: "active_recall",
            meta: { subject: t.subject, topic: t.topic },
        }));
    }

    // ── The ATAR lever. Already computed for the Dashboard; the student has
    //    to be on the Dashboard and know what a "component" is to see it.
    if (atarComponents) {
        const lever = bestLever(atarComponents);
        // `stepGain` is what a realistic ten-point nudge on that component is
        // worth, not what closing the whole gap would be. Quoting `maxGain`
        // here would promise a number nobody reaches in a week.
        if (lever?.key && lever.stepGain >= 0.3) {
            const L = LEVER[lever.key];
            const f = L && BY_ID[L.feature];
            if (f) {
                out.push(card({
                    id: `lever-${lever.key}`,
                    title: `${L.label} is what's holding your score down`,
                    why: `It's the weakest of the five parts of your AcedIt ATAR. Ten points on it is worth about ${lever.stepGain.toFixed(1)} — more than the same move anywhere else.`,
                    to: f.to, cta: `Open ${f.name}`, tone: "xp", weight: 50, feature: L.feature,
                }));
            }
        }
    }

    // ── Nothing logged yet this week. Said plainly rather than dressed up.
    const weekAgo = now - 7 * DAY;
    const recent = techniques.filter(t => {
        const d = Date.parse(t?.date || t?.created_date || "");
        return Number.isFinite(d) && d >= weekAgo;
    });
    if (!recent.length) {
        out.push(card({
            id: "cold-start",
            title: techniques.length ? "Nothing logged this week" : "Start with one 25-minute block",
            why: techniques.length
                ? "Your streak and four of the five parts of your AcedIt ATAR are built from sessions. One block today puts it back in motion."
                : "The rest of the app fills in from what you do. A single focused block is enough to switch it on.",
            to: "/Study?tab=pomodoro", cta: "Start a session", tone: "primary", weight: 60,
            feature: "pomodoro",
        }));
    }

    // ── Good features they've simply never opened. This is the discovery half
    //    of the job: nothing is wrong, there's just a thing that would help.
    if (out.length < limit) {
        for (const f of unusedWorth({ subjects, flashcards, assessments, techniques, maps, friends })) {
            out.push(card({
                id: `try-${f.id}`,
                title: `You haven't tried ${f.name}`,
                why: `${f.what} Worth it when: ${lower(f.when)}`,
                to: f.to, cta: `Open ${f.name}`, tone: "map", weight: 20, feature: f.id,
            }));
            if (out.length >= limit + 1) break;
        }
    }

    return {
        ready,
        stage: out.length ? "active" : "quiet",
        cards: out.sort((a, b) => b.weight - a.weight).slice(0, limit),
    };
}

const lower = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/**
 * Features whose prerequisites are met and which the student has no trace of
 * having used.
 *
 * "Used" is inferred from data they'd have left behind, because the app never
 * recorded feature visits. That makes it conservative in one direction only —
 * it can suggest something you tried once and abandoned, which is a far better
 * failure than hiding something you've never seen.
 */
export function unusedWorth({ subjects = [], flashcards = [], assessments = [], techniques = [], maps = [], friends = [] } = {}) {
    const ready = readiness({ subjects, flashcards, assessments, techniques, maps, friends });
    const used = new Set(techniques.map(t => String(t?.technique_name || "").toLowerCase()));
    const touched = (id) => {
        switch (id) {
            case "spaced_repetition": return flashcards.length > 0;
            case "mind_map": case "mindmap_layers": case "mindmap_recall": return maps.length > 0;
            case "assessments": return assessments.length > 0;
            case "friends": return friends.length > 0;
            case "subjects": return subjects.length > 0;
            default: return used.has(id);
        }
    };
    return FEATURES.filter(f =>
        // Sub-features are for tips, not for "you should try this" — you can't
        // open Map layers, you open Mind Maps and find them.
        !f.parent
        // Premium features are a legitimate suggestion, but not the FIRST thing
        // a free user is shown; those are filtered by the caller.
        && !blockedBy(f, ready)
        && !touched(f.id));
}

// ── Answering a question ────────────────────────────────────────────────────

// Order matters and the specific ones come first: "what should I do now"
// contains "what", so a generic question-word test placed above it swallows
// the one intent that has a real answer.
const INTENTS = [
    { id: "next",    test: /\b(what (should|do|can) i (do|study|work on)|what next|help me start|i'?m stuck|nothing to do)\b/i },
    { id: "cost",    test: /\b(free|premium|cost|price|pay|subscri|upgrade)\b/i },
    { id: "where",   test: /\b(where|find|how do i (get|go)|take me|open|navigate)\b/i },
    { id: "how",     test: /\b(how (do|does|can|should)|steps?)\b/i },
    { id: "what",    test: /\b(what('s| is| are)?|meaning|means|tell me about)\b/i },
];

function intentOf(q) {
    for (const i of INTENTS) if (i.test.test(q)) return i.id;
    return null;
}

// ── Is this a question about the app, or a student talking about their life? ──
//
// The guide matches on keywords, and several features claim a single common
// word — English Mentor lists "english" among its aka, which alone scores over
// the confidence bar. That is right for "where's the english marker" and badly
// wrong for "I have an English SAC for Ransom in a week and I don't know the
// book at all", which is a real question from a frightened student that used to
// come back as a card advertising a marking tool.
//
// The discriminator is COVERAGE, not keywords: how much of what they wrote does
// the matched feature actually account for? A lookup is mostly the feature's
// own words. A message about their week mentions a feature in passing. Nothing
// here needs a list of school nouns to keep up to date — a message that is
// mostly about something else fails on its own shape.
const LOOKUP_MAX_TOKENS = 10;   // beyond this it reads as a message, not a query
const LOOKUP_MIN_COVERAGE = 0.25;
const DOMINANT_COVERAGE = 0.5;  // a long question can still BE the feature

function coverageOf(q, f) {
    const qt = tokens(q);
    if (!qt.length) return 0;
    const own = new Set([...tokens(f.name), ...(f.aka || []).flatMap(a => tokens(a))]);
    return qt.filter(t => own.has(t)).length / qt.length;
}

/**
 * True when the message is short enough to BE a query rather than contain one.
 *
 * The `next` intent matches the phrase "what should I do", which is the whole
 * question in "what should I do right now" and a fragment in "I have an English
 * essay about Ransom in a week and I don't know anything about Ransom, what
 * should I do". The second is a student asking for help and used to be answered
 * with the first-open screen — the hand of cards plus the opener buttons —
 * pasted into the conversation as if it were a reply.
 *
 * The hand and the openers are the EMPTY state. Once someone is typing
 * sentences at Ace, they are in a conversation, and a conversation is answered
 * with words.
 */
function readsAsShortQuery(q) {
    return tokens(q).length <= LOOKUP_MAX_TOKENS;
}

/** True when the feature is the subject of the question rather than a word in it. */
function readsAsLookup(q, f) {
    const qt = tokens(q);
    if (!qt.length) return false;
    const coverage = coverageOf(q, f);
    if (qt.length <= LOOKUP_MAX_TOKENS) return coverage >= LOOKUP_MIN_COVERAGE;
    return coverage >= DOMINANT_COVERAGE;
}

/**
 * Answer a question about the app, with no model call.
 *
 * Returns null when it genuinely doesn't know, which is the important case —
 * this is the signal the caller uses to hand over to the LLM (or, for a free
 * user, to say plainly that this is the part that needs Premium). Guessing
 * here would be worse than the improvising the LLM was already doing, because
 * it would guess with the app's own voice.
 */
export function answer(query, { ready = null, premium = false } = {}) {
    const q = String(query || "").trim();
    if (!q) return null;
    const intent = intentOf(q);

    // "what should I do" as the entire question deserves the hand. Buried in a
    // paragraph about an essay due next week, it's a fragment, and the answer
    // is a reply rather than the opening screen.
    if (intent === "next") {
        if (readsAsShortQuery(q)) return { kind: "hand" };
        return null;
    }

    const hits = findFeatures(q, 3);
    if (!hits.length) return null;

    const f = hits[0];
    // Matched a feature, but only in passing — this is a question for the
    // model, not a card. Returning null is the established handover signal.
    if (!readsAsLookup(q, f)) return null;
    const blocked = ready ? blockedBy(f, ready) : null;
    const locked = f.premium && !premium;

    return {
        kind: "feature",
        intent: intent || "what",
        feature: f,
        also: hits.slice(1),
        blocked,
        locked,
        // What Ace says, assembled from the map rather than written per
        // question — so it can't drift from what the tips and the walkthroughs
        // say about the same feature.
        lines: [
            f.what,
            intent === "where" ? null : `Worth opening when: ${lower(f.when)}`,
            f.proof ? `Why it works: ${f.proof}` : null,
            blocked ? `You'll need ${blocked.label} first.` : null,
            locked ? "This one's part of Premium." : null,
        ].filter(Boolean),
        actions: [
            blocked
                ? { label: `${blocked.verb} ${blocked.label}`, to: blocked.fix }
                : { label: `Open ${f.name}`, to: f.to },
            ...hits.slice(1, 3).map(x => ({ label: x.name, to: x.to, secondary: true })),
        ],
    };
}

/**
 * The openers offered when the panel is empty.
 *
 * Deliberately the questions a lost student actually has, rather than the
 * questions that show off the model. The old set led with "How do I write a
 * better essay intro?", which is a good question and not one anybody asks in
 * the first five minutes.
 */
export function openers(ready) {
    const list = [
        { q: "What should I do right now?", kind: "hand" },
        { q: "What's in this app?", kind: "tour" },
    ];
    if (ready && !ready.subjects) list.push({ q: "How do I set this up?", kind: "ask" });
    else if (ready && !ready.flashcards) list.push({ q: "What is spaced repetition?", kind: "ask" });
    else list.push({ q: "What's the difference between recall and blurting?", kind: "ask" });
    return list;
}

export { NEEDS };
