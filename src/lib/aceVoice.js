/**
 * aceVoice — what Ace actually says, and how he says it.
 *
 * Split from aceKnowledge on purpose, and the split is the important bit.
 * A feature's `what` and `when` are reference text: a student reads them to
 * decide something, and a bubbly voice there would be noise in the way of an
 * answer. THIS file is Ace's own chatter — greetings, page reactions,
 * encouragement, the thing he says when you tell him to get lost. That can be
 * warm and daft, because nobody is making a decision off it.
 *
 * So: the definitions stay plain, and the personality lives out here. Getting
 * that the wrong way round gives you an assistant who's cute about the wrong
 * things and vague about the things you needed.
 *
 * Voice rules, from what the app already sounds like:
 *   Australian, seventeen-ish, a friend rather than a teacher.
 *   Short. One or two sentences, and never a paragraph.
 *   Never scolds. Never guilt. A missed day is a fact, not a failing.
 *   No emoji spam — one, occasionally, when it's actually earned.
 */

/**
 * Deterministic pick.
 *
 * A line that changes on every re-render makes the whole thing feel unstable,
 * and it makes the tests unrunnable. Seeded by whatever the caller is keyed on
 * — usually page + day — so Ace says the same thing for the whole time you're
 * standing there, and something different tomorrow.
 */
export function pick(list, seed = "") {
    if (!list?.length) return null;
    let h = 2166136261;
    for (let i = 0; i < String(seed).length; i++) {
        h ^= String(seed).charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return list[Math.abs(h) % list.length];
}

/**
 * What he opens with, by time of day.
 *
 * `{}` is where a first name goes if we have one, and the marker is explicit
 * because inserting it by rule produced "Morning! Miles, Right — what's the
 * plan?". A name dropped into a sentence at a guessed position reads worse
 * than no name at all.
 */
export const HELLO = {
    morning: [
        "Morning{}! Right — what's the plan?",
        "Early start{}, I like it. What are we doing?",
        "Morning{}. Give me the plan and I'll keep up.",
    ],
    afternoon: [
        "Afternoon{}! What's the plan today?",
        "Right{}, what are we tackling?",
        "Hey{}. What's today for?",
    ],
    evening: [
        "Evening{}! What's left to do?",
        "Hey{}. What are we getting through tonight?",
        "Evening{}. What's the plan?",
    ],
    late: [
        "Late one{}. What are we doing — and be honest.",
        "Still up{}? Alright. What's the plan?",
        "Late session{}. Let's make it a short one.",
    ],
};

export function timeBand(hour = new Date().getHours()) {
    if (hour >= 23 || hour < 5) return "late";
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
}

/**
 * The plans he offers.
 *
 * `mode` maps onto the intent the Dashboard already stores, so picking one
 * here writes the same field the old three-choice modal did — this is a new
 * front on an existing thing, not a second parallel one.
 */
export const PLANS = [
    {
        id: "cram", mode: "cramming", label: "Something's due",
        blurb: "SAC or exam coming and I need to cover ground",
        ace: "Right, no messing about. I'll point you at what's actually going to be on it.",
        mood: "alert", pose: "alert",
    },
    {
        id: "homework", mode: "homework", label: "Get work done",
        blurb: "Assignments and tasks to finish",
        ace: "Heads down then. I'll keep out of your way and just flag the useful stuff.",
        mood: "thinking", pose: "think",
    },
    {
        id: "keep", mode: "free", label: "Keep it ticking",
        blurb: "Nothing urgent, just don't want to fall behind",
        ace: "Love this one. Small and often beats a panic later — let's keep the streak honest.",
        mood: "happy", pose: "happy",
    },
    {
        id: "lost", mode: "free", label: "No idea",
        blurb: "Tell me what I should be doing",
        ace: "Perfect, that's my favourite question. Give me a second and I'll read your week.",
        mood: "excited", pose: "cheer",
    },
];

export const PLAN_BY_ID = Object.fromEntries(PLANS.map(p => [p.id, p]));

/**
 * What he says when you arrive somewhere, tuned to the plan you gave him.
 *
 * Deliberately thin. He is not narrating the app — the help drawer and the
 * tips do that properly. This is one friendly line so it feels like someone
 * came with you, and then he shuts up.
 */
export const ON_PAGE = {
    Study: {
        cram: ["Six ways in here. For a SAC that's close, Blurting finds holes fastest.",
               "Pick Blurting or Revision Mode — both show you what you haven't got."],
        homework: ["Pomodoro if you're stalling. It's the one that gets people started.",
                   "Timer's the move when the task is big and boring."],
        keep: ["Spaced Repetition is the low-effort one. Ten minutes here goes a long way.",
               "Cards first — it's the cheapest thing you can do today."],
        lost: ["Not sure which? Spaced Repetition if you've got cards, Pomodoro if you haven't.",
               "Start with the timer. Deciding is harder than doing."],
    },
    Goals: {
        cram: ["Get the SAC on here and everything else plans itself around it."],
        homework: ["Block the work out. Vague plans are the ones that don't happen."],
        keep: ["A planned week beats a motivated one. Ask me to build it if you like."],
        lost: ["Try 'Plan this week for me' — it reads what you've logged and shows its working."],
    },
    Analytics: {
        cram: ["Weak spots first. That's where the marks are hiding."],
        homework: ["Have a quick look then get back to it — this one's for later."],
        keep: ["Cognition tab is the interesting one. It's how you're learning, not how much."],
        lost: ["Start with weak topics. It's the only page here that tells you what to DO."],
    },
    Quizzes: {
        cram: ["Exam-shaped questions. Closest thing to the real feel."],
        homework: ["Quick one now beats a long one never."],
        keep: ["Make one from your notes and future-you gets a free session."],
        lost: ["Generate one from a file you already have. Takes about a minute."],
    },
    Subjects: {
        cram: ["Put the date in. Half of what I can do for you is dark until I know when things are due."],
        homework: ["Dates in here, and the planner stops guessing."],
        keep: ["Add your SAC dates when you get them — I'll do the rest."],
        lost: ["This is the bit everything else hangs off. Worth five minutes."],
    },
    Ranked: {
        cram: ["Don't get lost in here, you've got a SAC. Two minutes then back to it."],
        homework: ["Have a look, then back to the work. It'll still be here."],
        keep: ["Your score's built from the last 28 days, so a quiet week shows. No drama."],
        lost: ["This scores your habits, not your marks. It's the one you can actually move."],
    },
};

/** When there's nothing page-specific worth saying. */
export const ON_PAGE_FALLBACK = [
    "Tap me if you want a hand with anything here.",
    "I'm around if this bit's confusing.",
    "Poke me if you get stuck.",
];

/**
 * The break.
 *
 * Five minutes of nothing on screen, which is the biggest uninterrupted space
 * in the app and currently says "Take a well-deserved break! \u{1F9D8}". These push
 * toward actually leaving the chair, because a break spent looking at the same
 * screen isn't one — that's the entire mechanism the Pomodoro is built on.
 */
export const BREAK = [
    "Off you go. Water, window, anything that isn't a screen.",
    "Stand up. Genuinely — that's the bit that makes this work.",
    "Five minutes. Don't spend them here, I'll still be around.",
    "Look at something more than two metres away. Your eyes will thank you.",
    "Break properly and the next block is twice as good. That's not a slogan, it's the whole point.",
    "I'll hold your spot. Go and move.",
];

/** What he says the moment focus starts — once, then he's gone. */
export const FOCUS_START = [
    "Right. I'm out of your way.",
    "Go on then. See you at the break.",
    "Quiet from me. You've got this.",
];

/**
 * A finished session, graded by how long it actually ran.
 *
 * The modal said "You studied for N minutes using pomodoro!" whether N was
 * twelve or ninety. A student who did a short one already knows it was short,
 * and being congratulated identically is how a product stops being believed.
 * The short lines refuse to sulk about it either — twelve minutes genuinely
 * does beat none.
 */
export const SESSION_DONE = {
    short: [   // under 15 minutes
        "Short one. Still counts — showing up is the hard part.",
        "In and out. That's a session, not a failed one.",
        "Quick hit. Your streak doesn't know the difference.",
    ],
    solid: [   // 15–44
        "That's a proper block. Nicely done.",
        "Long enough to get somewhere, short enough to do again tomorrow.",
        "That's the one that compounds. Good.",
    ],
    long: [    // 45+
        "That's a serious stretch. Go and do nothing for a bit.",
        "Big session. Genuinely — go and eat something.",
        "That's a lot of focus in one go. Rest is part of it now.",
    ],
};

/** Which band a finished session falls into. */
export function sessionBand(minutes) {
    const m = Number(minutes) || 0;
    if (m >= 45) return "long";
    if (m >= 15) return "solid";
    return "short";
}

/**
 * A streak ticked over. Milestones get their own copy from the celebration
 * component, so these are the ordinary days — which are the ones that need a
 * reason to keep going.
 */
export const STREAK_CHEER = [
    "Another one on the pile.",
    "Day after day is the whole trick.",
    "Still going. That's the bit that counts.",
    "You showed up again. Good.",
];

/**
 * How he reacts to a SAC getting closer.
 *
 * The countdown banner already shouts the number. What it never did was have
 * an opinion about it, and the opinion is the useful half: "eleven days" means
 * nothing to a student who doesn't know whether eleven days is fine.
 *
 * The escalation is deliberately NOT panic. He gets more focused as it closes,
 * never more frightened — a mascot that looks scared about your SAC is a
 * mascot that makes the SAC worse. Even the day-before line is calm.
 */
export const SAC_MOOD = [
    { within: 1,  pose: "alert",  lines: [
        "Tomorrow. Deep breath — cover the big stuff, skip the rest.",
        "It's tomorrow. Past this point, sleep beats cramming. Genuinely.",
    ] },
    { within: 3,  pose: "think",  lines: [
        "Three days. Enough, if we start with the weak bits.",
        "Close now. Timed practice beats re-reading from here.",
    ] },
    { within: 7,  pose: "point",  lines: [
        "About a week. This is the good window — the one people waste.",
        "A week out. Everything you do now is worth double what it is on Thursday.",
    ] },
    { within: 14, pose: "happy",  lines: [
        "Two weeks. Loads of room. Small and often, starting today.",
        "Fortnight. Build the habit now and there's no panic later.",
    ] },
    { within: 999, pose: "stand", lines: [
        "Ages away. Nice — a bit each week and it never becomes a thing.",
        "Plenty of time. Which is exactly when it's easiest to get ahead.",
    ] },
];

/** His pose and line for a SAC that's `days` away. */
export function sacMood(days) {
    const d = Number.isFinite(days) ? Math.max(0, days) : 999;
    const band = SAC_MOOD.find(b => d <= b.within) || SAC_MOOD[SAC_MOOD.length - 1];
    return { pose: band.pose, line: pick(band.lines, `sac-${d}`) };
}

/**
 * What he says the moment you finish something.
 *
 * Keyed by how it went rather than by what it was, because "you got 8/10" is
 * already on the screen — his job is the bit the number doesn't say.
 */
export const AFTER = {
    great: [
        "That's the one. Genuinely well done.",
        "Nearly clean. You know this better than you think.",
        "Strong. Bank it and move on to something harder.",
    ],
    good: [
        "Solid. The misses are the useful bit — worth a second look.",
        "Good run. A couple of gaps, nothing structural.",
        "That'll do nicely. Want me to turn the misses into cards?",
    ],
    rough: [
        "Rough one — which means you just found exactly what to study.",
        "That's information, not a verdict. Now you know where the holes are.",
        "Better to find that here than in the SAC. Seriously.",
    ],
    done: [
        "Done. That counts.",
        "Nice — that's on the board.",
        "Logged. Small and often is the whole trick.",
    ],
};

/** Which band a score falls into. `null` score means "no score, just done". */
export function afterBand(pct) {
    if (pct == null || !Number.isFinite(pct)) return "done";
    if (pct >= 85) return "great";
    if (pct >= 60) return "good";
    return "rough";
}

/** He noticed something in the data. Warm, never guilt. */
export const NUDGE = {
    slipping: [
        "Few cards are about to slip. Want to catch them?",
        "Your deck's getting sleepy — quick review would fix it.",
    ],
    deadline: [
        "That SAC's getting close. Want a plan for it?",
        "Something's due soon — shall we sort it out?",
    ],
    streak: [
        "Streak's alive. Nice.",
        "You've shown up again. That's the whole trick, honestly.",
    ],
    quiet: [
        "Nothing logged this week yet. One block is enough to start it moving.",
        "Been a quiet one. No judgement — want the easiest thing to pick up?",
    ],
};

/**
 * Being told to go away.
 *
 * No sulking, no guilt-trip, no "are you sure?". He goes, and he says how to
 * get him back exactly once. Anything else here would earn the annoyance.
 */
export const DISMISS = {
    snooze: [
        "All good — I'll be quiet. Tap me if you want me.",
        "Say no more. I'll be in the corner.",
        "Fair enough. I'll leave you to it.",
    ],
    off: [
        "Done — no more pop-ups. I'm still in the corner if you need me.",
        "Gone quiet for good. Tap the spade any time.",
    ],
    back: [
        "Missed me? Course you did.",
        "Back in. What are we doing?",
    ],
};

/** Phrases that mean "stop talking to me". Checked before anything else. */
const GO_AWAY = /\b(go away|shut up|leave me alone|stop talking|be quiet|not now|piss off|buzz off|get lost|stop it|annoying)\b/i;
/** …and the ones that mean "come back". */
const COME_BACK = /\b(come back|i'?m back|hello again|talk to me|help me again)\b/i;

export function readsAsDismissal(text) {
    return GO_AWAY.test(String(text || ""));
}
export function readsAsRecall(text) {
    return COME_BACK.test(String(text || ""));
}

/** A greeting for the plan prompt, seeded so it holds still. */
export function greeting({ name = "", hour = new Date().getHours(), seed = "" } = {}) {
    const line = pick(HELLO[timeBand(hour)], seed || String(hour)) || "";
    const first = String(name || "").trim().split(/\s+/)[0];
    return line.replace("{}", first ? ` ${first}` : "");
}

/** The line for a page, given the plan. Falls back rather than inventing. */
export function pageLine(page, planId, seed = "") {
    const forPage = ON_PAGE[page];
    const lines = forPage?.[planId] || forPage?.lost;
    return pick(lines || ON_PAGE_FALLBACK, seed || `${page}:${planId}`);
}
