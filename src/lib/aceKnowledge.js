/**
 * aceKnowledge — what Ace knows about AcedIt.
 *
 * The app has roughly fifty distinct things a student can do and, until this
 * file existed, exactly zero places that said what any of them were for. The
 * one component built to explain the app — Ace — was given the student's name,
 * streak and XP and not one word about AcedIt itself, so asked "what's
 * blurting?" it improvised from general knowledge, and asked "where do I make
 * a mind map?" it guessed.
 *
 * This is the single source. The tips, the first-run walkthroughs, the "what
 * should I do now" hand and the LLM's system prompt all read from here, which
 * is the point: a description that goes stale goes stale in every one of those
 * places at once and gets noticed, instead of drifting quietly inside a server
 * prompt nobody opens.
 *
 * Rules for every entry, because a guide that oversells is worse than none:
 *
 *   `what`  — what the thing IS, in one sentence, in the second person.
 *             Not a benefit, not a slogan. If it can't be said plainly it
 *             probably shouldn't ship.
 *   `when`  — the moment it's actually worth opening. This is the field that
 *             does the work; "what" tells you it exists, "when" tells you
 *             whether today is the day.
 *   `needs` — what has to exist first. A feature recommended before its inputs
 *             exist is a dead end with a nice button on it.
 *   `proof` — only where there IS one. Most entries have none, and an empty
 *             field is the honest answer.
 */

/**
 * Four suits, used to group guidance rather than to recolour the app. The
 * existing token palette already carries meaning per feature; these say what
 * KIND of help a card is, which is a different axis.
 */
export const SUITS = {
    spade:   { id: "spade",   label: "Technique",  glyph: "♠", what: "How to study" },
    heart:   { id: "heart",   label: "Motivation", glyph: "♥", what: "Keeping at it" },
    diamond: { id: "diamond", label: "Progress",   glyph: "♦", what: "How it's going" },
    club:    { id: "club",    label: "Together",   glyph: "♣", what: "Other people" },
};

/**
 * Prerequisites, as things we can actually check against loaded state. Each
 * key has a matching test in `readiness()` below — a `needs` value with no
 * test is a promise nothing verifies, so the two lists have to stay in step.
 */
// `label` is a bare noun phrase on purpose. It has to read correctly in two
// different sentences — "You'll need <label> first." and the button "Add
// <label>" — and a participle ("a subject added") only works in one of them.
export const NEEDS = {
    subjects:    { key: "subjects",    label: "a subject",              verb: "Add",   fix: "/Subjects" },
    flashcards:  { key: "flashcards",  label: "some flashcards",        verb: "Make",  fix: "/Study?tab=spaced_repetition" },
    reviewed:    { key: "reviewed",    label: "a few reviewed cards",   verb: "Review", fix: "/Study?tab=spaced_repetition" },
    assessments: { key: "assessments", label: "a SAC or exam date",     verb: "Add",   fix: "/Subjects" },
    sessions:    { key: "sessions",    label: "a logged study session", verb: "Start", fix: "/Study" },
    notes:       { key: "notes",       label: "notes to work from",     verb: "Open",  fix: "/AITools" },
    friends:     { key: "friends",     label: "a friend",               verb: "Add",   fix: "/Friends" },
    maps:        { key: "maps",        label: "a mind map",             verb: "Start", fix: "/Study?tab=mind_map" },
};

/**
 * Every feature worth pointing someone at.
 *
 * Deliberately excludes plumbing — Settings, Checkout, the admin panel. A
 * guide that offers to show you the billing page has misunderstood the job.
 */
export const FEATURES = [
    // ── Study techniques ────────────────────────────────────────────────
    {
        id: "pomodoro", name: "Pomodoro", section: "Study", suit: "spade",
        to: "/Study?tab=pomodoro",
        what: "A timer that runs your study in 25-minute blocks with breaks between them.",
        when: "You keep meaning to start and don't, or you sit down for three hours and take nothing in.",
        needs: null,
        aka: ["timer", "focus", "pomodoro", "25 minutes", "concentrate", "procrastinating", "can't start"],
    },
    {
        id: "spaced_repetition", name: "Spaced Repetition", section: "Study", suit: "spade",
        to: "/Study?tab=spaced_repetition",
        what: "Flashcards that come back at widening intervals, timed to hit just before you'd forget.",
        when: "Anything you need to still know in a month — definitions, dates, formulas, quotes.",
        needs: NEEDS.subjects,
        proof: "Spacing effect — the interval schedule is SM-2.",
        aka: ["flashcards", "cards", "spaced", "revise", "memorise", "deck", "review"],
    },
    {
        id: "active_recall", name: "Active Recall", section: "Study", suit: "spade",
        to: "/Study?tab=active_recall",
        what: "Questions you answer from memory and get marked on, built from your own cards, maps and notes.",
        when: "You've read something twice and want to know whether you actually have it.",
        needs: null,
        proof: "Roediger & Karpicke (2006) — testing beats re-reading.",
        aka: ["recall", "test myself", "quiz me", "questions", "retrieval"],
    },
    {
        id: "blurting", name: "Blurting", section: "Study", suit: "spade",
        to: "/Study?tab=blurting",
        what: "You write down everything you can remember on a topic, then it shows you what you left out.",
        when: "A week or so out from a SAC, to find the gaps while there's still time to close them.",
        needs: null,
        proof: "Free recall — the missing items are the finding.",
        aka: ["blurt", "brain dump", "everything I know", "gaps", "blind spots"],
    },
    {
        id: "exam", name: "Revision Mode", section: "Study", suit: "spade",
        to: "/Study?tab=exam",
        what: "A timed mock exam assembled from your own cards and quizzes, marked at the end.",
        when: "Close to the real thing, when what you need is stamina and timing rather than more content.",
        needs: NEEDS.flashcards,
        aka: ["exam", "mock", "practice exam", "timed", "sac practice", "past paper"],
    },
    {
        id: "mind_map", name: "Mind Maps", section: "Study", suit: "spade",
        to: "/Study?tab=mind_map",
        what: "One growing map per subject, where any node can be opened as a map of its own.",
        when: "A topic has too many moving parts to hold in your head and you need to see how they join up.",
        needs: NEEDS.subjects,
        proof: "Blunt & Karpicke (2014) — mapping works when it's done from memory.",
        aka: ["mind map", "map", "diagram", "connect", "concept map", "branches"],
    },

    // ── Inside the techniques — the parts nothing points at ─────────────
    {
        id: "mindmap_layers", name: "Map layers", section: "Study", suit: "spade",
        to: "/Study?tab=mind_map", parent: "mind_map",
        what: "Opening a node turns it into its own map, so a term that grows into a whole topic gets its own space.",
        when: "A box on your map has more inside it than fits in a box.",
        needs: NEEDS.maps,
        aka: ["layers", "drill down", "nested", "sub map", "inside"],
    },
    {
        id: "mindmap_recall", name: "Rebuild from memory", section: "Study", suit: "spade",
        to: "/Study?tab=mind_map", parent: "mind_map",
        what: "Rebuilds a map from scratch with your notes shut, then scores it against the real one.",
        when: "You've built a map and want to know how much of it stuck. This is the part that makes mapping retrieval practice.",
        needs: NEEDS.maps,
        aka: ["rebuild", "from memory", "closed book", "retention", "how much stuck"],
    },
    {
        id: "calibration", name: "Confidence check", section: "Study", suit: "spade",
        to: "/Study?tab=active_recall", parent: "active_recall",
        what: "You rate how sure you are before each answer is marked, and it shows where your confidence was wrong.",
        when: "Every recall session. Being sure and wrong is the failure that costs marks, and nothing else in the app measures it.",
        needs: null,
        aka: ["confidence", "sure", "calibration", "overconfident", "knew it"],
    },
    {
        id: "weak_spots", name: "Weak spots", section: "Study", suit: "diamond",
        to: "/Analytics", parent: "spaced_repetition",
        what: "The topics your reviews keep failing on, worked out from every card you've rated.",
        when: "You've got limited time and need to spend it where it's actually costing you.",
        needs: NEEDS.reviewed,
        aka: ["weak", "struggling", "bad at", "keep getting wrong", "worst topics"],
    },

    // ── Planning ────────────────────────────────────────────────────────
    {
        id: "planner", name: "Planner", section: "Plan", suit: "heart",
        to: "/Goals",
        what: "Your week as a timetable of study sessions, each one launching straight into the technique it names.",
        when: "Sunday night, or any time the week ahead is a vague sense of dread rather than a plan.",
        needs: NEEDS.subjects,
        aka: ["planner", "timetable", "schedule", "week", "plan", "calendar"],
    },
    {
        id: "week_plan", name: "Plan this week for me", section: "Plan", suit: "heart",
        to: "/Goals", parent: "planner",
        what: "Builds a week of sessions from what you've logged, with the reason it picked each one written on it.",
        when: "You know you should plan and don't know where to start. Nothing saves until you approve it.",
        needs: NEEDS.subjects,
        aka: ["plan for me", "auto plan", "build my week", "what should I study"],
    },
    {
        id: "assessments", name: "SACs and exams", section: "Plan", suit: "heart",
        to: "/Subjects",
        what: "The dates you're working towards, which everything else in the app then plans around.",
        when: "As soon as you get a date. Half of what AcedIt can do for you is dark until it knows when things are due.",
        needs: NEEDS.subjects,
        aka: ["sac", "exam date", "due", "assessment", "test", "deadline"],
    },
    {
        id: "strategise", name: "Strategise", section: "Plan", suit: "heart",
        to: "/Strategise",
        what: "A short daily check-in that turns how you're actually going into the next concrete move.",
        when: "Start of a study session when you don't know what to pick up.",
        needs: null,
        aka: ["strategy", "check in", "what now", "advice", "stuck"],
    },

    // ── Testing yourself ────────────────────────────────────────────────
    {
        id: "quizzes", name: "Quizzes", section: "Test", suit: "spade",
        to: "/Quizzes",
        what: "Multiple-choice and short-answer quizzes you write yourself or generate from your notes, marked by AI.",
        when: "You want exam-shaped questions rather than flashcard-shaped ones.",
        needs: NEEDS.subjects,
        aka: ["quiz", "test", "mcq", "multiple choice", "questions"],
    },

    // ── AI tools ────────────────────────────────────────────────────────
    {
        id: "concept_explainer", name: "Concept Explainer", section: "AI", suit: "spade",
        premium: true, to: "/AITools?tool=concept_explainer",
        what: "Explains a concept in plain English, at the depth you ask for, and can quiz you after.",
        when: "The textbook explanation isn't landing and you want it said a different way.",
        needs: null,
        aka: ["explain", "don't understand", "confused", "what is", "concept"],
    },
    {
        id: "math_tutor", name: "Math Tutor", section: "AI", suit: "spade",
        premium: true, to: "/AITools?tool=math_tutor",
        what: "Works a maths problem through step by step, giving hints before it gives answers.",
        when: "You're stuck on a question and want to get unstuck without being handed the solution.",
        needs: null,
        aka: ["maths", "math", "methods", "specialist", "working", "solve"],
    },
    {
        id: "english_mentor", name: "English Mentor", section: "AI", suit: "spade",
        premium: true, to: "/AITools?tool=english_mentor",
        what: "Marks an English response against the VCAA criteria, section by section.",
        when: "You've written a piece and want it read properly before it's read for marks.",
        needs: null,
        aka: ["english", "essay feedback", "mark my essay", "text response", "language analysis"],
    },
    {
        id: "essay_planner", name: "Essay Planner", section: "AI", suit: "spade",
        premium: true, to: "/AITools?tool=essay_planner",
        what: "Turns a prompt into a contention, a structure and an evidence plan.",
        when: "You have the prompt and a blank page and can't get past the first line.",
        needs: null,
        aka: ["essay", "plan essay", "contention", "structure", "prompt"],
    },
    {
        id: "exam_questions", name: "Exam Questions", section: "AI", suit: "spade",
        premium: true, to: "/AITools?tool=exam_questions",
        what: "Generates VCAA-style questions on a topic, with the marking guide.",
        when: "You've run out of practice questions before you've run out of time.",
        needs: null,
        aka: ["practice questions", "generate questions", "vcaa", "past paper"],
    },
    {
        id: "teaching_assistant", name: "Teach It Back", section: "AI", suit: "spade",
        premium: true, to: "/AITools?tool=teaching_assistant",
        what: "You teach the topic and it plays a curious student, asking the questions you can't answer.",
        when: "You think you understand something. This finds out.",
        needs: null,
        proof: "The protégé effect — teaching exposes what explaining to yourself doesn't.",
        aka: ["teach", "explain to someone", "feynman", "teach it back"],
    },
    {
        id: "note_summariser", name: "Note Summariser", section: "AI", suit: "spade",
        premium: true, to: "/AITools?tool=note_summariser",
        what: "Turns notes or an uploaded file into a summary, a cheat sheet, or question-and-answer pairs.",
        when: "You have forty pages and a week. Ask for the Q&A output and it becomes recall practice instead of reading.",
        needs: NEEDS.notes,
        aka: ["summarise", "summary", "notes", "cheat sheet", "condense", "pdf"],
    },
    {
        id: "line_memoriser", name: "Line Memoriser", section: "AI", suit: "spade",
        premium: true, to: "/AITools?tool=line_memoriser",
        what: "Drills a quote or passage line by line, chaining each onto the last until you can recite it whole.",
        when: "Quotes for English, a poem, a definition you have to reproduce word for word.",
        needs: null,
        proof: "Chaining — each line is cued by the one before it.",
        aka: ["quotes", "memorise", "lines", "passage", "learn by heart", "recite"],
    },

    // ── Progress ────────────────────────────────────────────────────────
    {
        id: "atar", name: "AcedIt ATAR", section: "Progress", suit: "diamond",
        to: "/Dashboard",
        what: "One score out of 99.95 for how well you're studying — mastery, consistency, effort, breadth and planning over your last 28 days.",
        when: "You want a single number for whether the last month was any good. It scores your habits, not your marks — it is not a VCAA prediction.",
        needs: NEEDS.sessions,
        aka: ["atar", "score", "predicted atar", "how am I going", "rank"],
    },
    {
        id: "analytics", name: "Analytics", section: "Progress", suit: "diamond",
        to: "/Analytics",
        what: "Everything the app has measured about your study, broken down by subject, topic and technique.",
        when: "Deciding what to do differently, rather than deciding what to do next.",
        needs: NEEDS.sessions,
        aka: ["analytics", "stats", "progress", "data", "charts", "trends"],
    },
    {
        id: "cognition", name: "Cognition", section: "Progress", suit: "diamond",
        to: "/Analytics?tab=cognition",
        what: "Five axes drawn from how you actually study — retrieval, stability, durability, spread and focus.",
        when: "You want to know how you're learning rather than how much. It's a projection from your own logs, not a scan of anything.",
        needs: NEEDS.reviewed,
        aka: ["brain", "cognition", "memory", "attention", "profile", "how I learn"],
    },
    {
        id: "retention", name: "What you'll lose this week", section: "Progress", suit: "diamond",
        to: "/Dashboard", parent: "spaced_repetition",
        what: "The cards that drop below reliable recall in the next seven days, and the minutes it'd take to hold them.",
        when: "Any day you have twenty minutes and want them to count.",
        needs: NEEDS.reviewed,
        aka: ["forgetting", "losing", "slipping", "decay", "at risk"],
    },
    {
        id: "streak", name: "Streak", section: "Progress", suit: "heart",
        to: "/Dashboard",
        what: "Consecutive days you've studied, and one of the five parts your AcedIt ATAR is built from.",
        when: "Not a thing you open — a thing you keep.",
        needs: null,
        aka: ["streak", "days in a row", "consistency", "flame"],
    },

    // ── Other people ────────────────────────────────────────────────────
    {
        id: "ranked", name: "Ranked", section: "Social", suit: "club",
        to: "/Ranked",
        what: "Three leaderboards — ATAR, XP and study time — against everyone, your friends, or your school.",
        when: "Comparison motivates you. If it doesn't, leave it alone; it isn't load-bearing.",
        needs: null,
        aka: ["ranked", "leaderboard", "rank", "compete", "top", "school"],
    },
    {
        id: "competitions", name: "Compete", section: "Social", suit: "club",
        to: "/Competitions",
        what: "Head-to-head challenges with a friend on a goal or a score.",
        when: "You'll do it for a friend when you won't do it for yourself.",
        needs: NEEDS.friends,
        proof: "Social accountability — a watched commitment gets kept.",
        aka: ["duel", "challenge", "compete", "versus", "bet", "race"],
    },
    {
        id: "friends", name: "Friends", section: "Social", suit: "club",
        to: "/Friends",
        what: "Add classmates to share decks and quizzes with, and to compare against.",
        when: "Before any of the social features do anything at all.",
        needs: null,
        aka: ["friends", "add friend", "classmates", "share"],
    },
    {
        id: "study_groups", name: "Study Groups", section: "Social", suit: "club",
        to: "/StudyGroups",
        what: "A shared space for a class or a group, with shared resources and a chat.",
        when: "You're revising the same subject as people you already know.",
        needs: null,
        aka: ["group", "class", "study group", "team"],
    },

    // ── Setup ───────────────────────────────────────────────────────────
    {
        id: "subjects", name: "Subjects", section: "Setup", suit: "heart",
        to: "/Subjects",
        what: "Your VCE subjects, and the SAC and exam dates inside each one.",
        when: "First. Almost everything else is organised by subject and stays empty until this is filled in.",
        needs: null,
        aka: ["subjects", "add subject", "setup", "classes", "units"],
    },
    {
        id: "guides", name: "Guides", section: "Setup", suit: "spade",
        to: "/Guides",
        what: "Written guides on study technique and VCE specifics.",
        when: "You want to read about how to study rather than be walked through it.",
        needs: null,
        aka: ["guides", "articles", "how to study", "read", "tips"],
    },
];

export const BY_ID = Object.fromEntries(FEATURES.map(f => [f.id, f]));

/**
 * The page-level line for each place that carries a help button, plus the
 * route its features hang off.
 *
 * `HelpButton` is mounted on ten pages and used to carry its own hand-written
 * copy, which had drifted badly: it promised "five powerful study techniques"
 * when there are six, described a Dashboard whose sections had been replaced,
 * and listed AI tools under names none of them have. That is the exact failure
 * this file exists to stop — help kept apart from the thing it describes only
 * ever gets more wrong. Per-feature detail now comes from FEATURES, so there
 * is one place to be wrong in rather than fourteen.
 */
export const PAGES = {
    Dashboard:    { route: "/Dashboard",    title: "Home",         intro: "What's worth doing today, and how the last month has actually gone." },
    Study:        { route: "/Study",        title: "Study",        intro: "Six techniques doing six different jobs. Which tab you want depends on what's going wrong, not on which one you like." },
    Quizzes:      { route: "/Quizzes",      title: "Quizzes",      intro: "Exam-shaped questions, written by you or generated from your notes." },
    AITools:      { route: "/AITools",      title: "AI Tools",     intro: "One chat, several specialists. This page is part of Premium." },
    Planner:      { route: "/Goals",        title: "Planner",      intro: "Your week as sessions, built around the dates you're actually working towards." },
    Goals:        { route: "/Goals",        title: "Planner",      intro: "Your week as sessions, built around the dates you're actually working towards." },
    Analytics:    { route: "/Analytics",    title: "Analytics",    intro: "Everything measured about your study — for deciding what to do differently, rather than what to do next." },
    Ranked:       { route: "/Ranked",       title: "Ranked",       intro: "Where you sit against everyone, your friends, or your school." },
    Friends:      { route: "/Friends",      title: "Friends",      intro: "Classmates to share decks and quizzes with, and to measure yourself against." },
    Competitions: { route: "/Competitions", title: "Compete",      intro: "Head-to-head challenges. Most people will do it for a friend when they won't do it for themselves." },
    Subjects:     { route: "/Subjects",     title: "Subjects",     intro: "Your subjects and the SAC and exam dates inside them. Most of the app is organised by this." },
    Strategise:   { route: "/Strategise",   title: "Strategise",   intro: "A short check-in that turns how you're going into the next concrete move." },
    Guides:       { route: "/Guides",       title: "Guides",       intro: "Written guides on study technique and VCE specifics." },
    StudyGroups:  { route: "/StudyGroups",  title: "Study Groups", intro: "A shared space for a class or a group, with shared resources and a chat." },

    // Plumbing. Deliberately absent from FEATURES — a guide that offers to
    // walk you through the billing page has misunderstood the job — but these
    // pages carried a help button before this rewrite and shouldn't quietly
    // lose it, so they get notes instead of features.
    Settings:     { route: "/Settings",     title: "Settings", intro: "Your account, your targets, and how much the app is allowed to bother you.", notes: [
        "Your weekly study-hour target lives here, and it's what the Dashboard measures your week against.",
        "Turning notifications off doesn't affect your streak — only whether you're reminded about it.",
    ] },
    Subscription: { route: "/Subscription", title: "Subscription", intro: "What's free, what's Premium, and how to change it.", notes: [
        "Everything that explains the app is free: Ace's guide, the help panels, and what to do next.",
        "Premium covers the AI — the tools page, AI marking, and asking Ace real questions about your subjects.",
        "Cancelling stops the renewal; your decks, maps, plans and history stay exactly where they are.",
    ] },
    Support:      { route: "/Support",      title: "Support", intro: "When something's broken rather than confusing.", notes: [
        "If you're not sure what a feature does, the help button on that page will be faster than we are.",
        "Include what you were doing when it went wrong — it's usually the whole diagnosis.",
    ] },
};

/**
 * Everything living on a given page, sub-features included — the help panel is
 * exactly where the parts nothing else points at belong.
 */
export function featuresForPage(page) {
    const p = PAGES[page];
    if (!p) return [];
    return FEATURES.filter(f => f.to.split("?")[0] === p.route);
}

/** Feature ids grouped by the section headings the UI uses. */
export const SECTIONS = FEATURES.reduce((acc, f) => {
    (acc[f.section] ||= []).push(f.id);
    return acc;
}, {});

const norm = (v) => String(v || "").toLowerCase();

/**
 * Words that carry no information about WHICH feature is being asked about.
 *
 * This list is why "explain the krebs cycle to me" doesn't get answered with
 * "have you tried the Concept Explainer?". Before it existed, the verb in the
 * question was matching a feature's own keywords, so a subject-matter question
 * came back as a product tour — the single most annoying thing a built-in
 * assistant can do. Stripped from the query AND from the keywords, so the two
 * sides are always compared on the same terms.
 */
const STOP = new Set([
    "what", "whats", "which", "who", "how", "where", "when", "why", "is", "are", "was", "be",
    "do", "does", "did", "can", "could", "should", "would", "will", "shall",
    "i", "im", "me", "my", "mine", "you", "your", "it", "its", "this", "that", "these", "those",
    "the", "a", "an", "of", "for", "to", "in", "on", "at", "with", "from", "about", "and", "or",
    "explain", "tell", "show", "help", "get", "got", "use", "using", "make", "want", "need",
    "please", "thanks", "hey", "hi", "ace", "app", "acedit", "some", "any", "there", "here",
    "dont", "doesnt", "cant", "wont", "not", "no", "yes", "ok", "okay", "just", "really",
]);

/** Lowercase, drop punctuation, drop the words that don't narrow anything. */
export function tokens(text) {
    return norm(text)
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 1 && !STOP.has(w));
}

/** Below this, Ace doesn't claim to know — which is how questions reach the LLM. */
const CONFIDENT = 18;

/**
 * Which prerequisites this student has met.
 *
 * Every key in NEEDS has to appear here — a prerequisite nothing tests is a
 * claim the guide makes and never checks.
 */
export function readiness({
    subjects = [], flashcards = [], assessments = [], techniques = [], maps = [], friends = [],
} = {}) {
    return {
        subjects: subjects.length > 0,
        flashcards: flashcards.length > 0,
        reviewed: flashcards.some(c => (c?.total_reviews || 0) > 0 || c?.last_reviewed_date),
        assessments: assessments.some(a => a && !a.is_completed && a.due_date),
        sessions: techniques.length > 0,
        // Nothing to check — the tools take a paste as readily as a file, so
        // claiming this is unmet would block a path that actually works.
        notes: true,
        friends: friends.length > 0,
        maps: maps.some(m => (m?.nodes?.length || 0) > 1),
    };
}

/** Is this feature usable right now, and if not, what's missing. */
export function blockedBy(feature, ready) {
    const need = feature?.needs;
    if (!need) return null;
    return ready?.[need.key] ? null : need;
}

/**
 * Find the features a phrase is asking about.
 *
 * Scored rather than first-match: "how do I test myself" hits Active Recall
 * on `aka`, Quizzes on `name`, and Blurting on `when`, and the ranking is the
 * whole answer. Nothing here calls a model — this runs for free users, which
 * is the entire reason it's rules and not a prompt.
 */
export function findFeatures(query, limit = 4) {
    const qt = tokens(query);
    if (!qt.length) return [];
    const has = new Set(qt);
    const joined = qt.join(" ");

    const scored = FEATURES.map(f => {
        let score = 0;
        const nameT = tokens(f.name);
        const nameJoined = nameT.join(" ");
        if (nameJoined && joined === nameJoined) score += 100;
        else if (nameJoined && joined.includes(nameJoined)) score += 60;

        for (const a of f.aka || []) {
            const at = tokens(a);
            if (!at.length) continue;          // the phrase was all stop-words
            // Every token of the keyword has to be present. A whole phrase is
            // worth more than a single word, so "mind map" landing on Mind
            // Maps beats "map" landing on anything else.
            if (at.every(t => has.has(t))) score += at.length > 1 ? 30 : 20;
        }
        for (const w of qt) {
            if (nameT.includes(w)) score += 8;
            if (norm(f.what).includes(w)) score += 3;
            if (norm(f.when).includes(w)) score += 2;
        }
        // A sub-feature shouldn't outrank the thing it lives inside on an
        // equal match — you can't use "Map layers" without opening Mind Maps.
        if (f.parent) score -= 4;
        return { f, score };
    }).filter(x => x.score >= CONFIDENT)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return scored.map(x => x.f);
}

/**
 * The knowledge, compressed for a system prompt.
 *
 * The server used to describe AcedIt to the model in zero words, so every
 * answer about our own product was invented. This is the same text the UI
 * shows, which means the model and the interface can't tell a student two
 * different stories.
 */
export function knowledgeForPrompt({ compact = false } = {}) {
    const lines = [];
    for (const [section, ids] of Object.entries(SECTIONS)) {
        lines.push(`\n${section}:`);
        for (const id of ids) {
            const f = BY_ID[id];
            lines.push(compact
                ? `- ${f.name} (${f.to}) — ${f.what}`
                : `- ${f.name} (${f.to}) — ${f.what} Worth opening when: ${f.when}`);
        }
    }
    return lines.join("\n");
}
