/**
 * neuro — what the evidence actually says about each study technique.
 *
 * This exists to earn trust, which means it can only contain things that are
 * true. Three rules it follows, because "neuroscience-flavoured" claims are
 * the fastest way to lose a teacher or a parent:
 *
 *   1. Every claim names its source. No anonymous "studies show".
 *   2. Where a number is reproduced from a published result it is marked
 *      `approx: true` and the UI says so. Where only the SHAPE of a finding is
 *      being drawn, the chart is labelled a schematic. Neither is presented as
 *      a precise reproduction of someone's dataset.
 *   3. Where the evidence is thin or the popular version overstates it, the
 *      `caveat` says so out loud. The 25-minute Pomodoro is the clearest case:
 *      scheduled breaks have support, that specific number came off a kitchen
 *      timer.
 *
 * On the brain regions: fMRI localisation is coarse and "region X lights up"
 * is a simplification of a distributed, overlapping process. These are the
 * areas consistently implicated in imaging studies of each activity, drawn
 * schematically. `REGION_NOTE` says that to the student rather than letting
 * the picture imply more precision than exists.
 *
 * Coordinates are a normalised brain space: x = right, y = up, z = front.
 * They're anatomically approximate — enough to put a glow in the right lobe,
 * not a stereotaxic atlas.
 */

export const REGION_NOTE =
    "Schematic. Brain imaging shows these areas are consistently involved. It does not mean thinking happens in one spot.";

export const REGIONS = {
    dlpfc:      { name: "Dorsolateral prefrontal cortex", short: "dlPFC",       xyz: [0.52, 0.34, 0.72] },
    vlpfc:      { name: "Ventrolateral prefrontal cortex", short: "vlPFC",      xyz: [0.66, -0.02, 0.66] },
    acc:        { name: "Anterior cingulate cortex",      short: "ACC",         xyz: [0.06, 0.34, 0.42] },
    mpfc:       { name: "Medial prefrontal cortex",       short: "mPFC",        xyz: [0.05, 0.18, 0.86] },
    hippocampus:{ name: "Hippocampus",                    short: "Hippocampus", xyz: [0.34, -0.30, 0.02] },
    mtl:        { name: "Medial temporal lobe",           short: "MTL",         xyz: [0.56, -0.36, 0.18] },
    temporal:   { name: "Lateral temporal cortex",        short: "Temporal",    xyz: [0.78, -0.22, 0.10] },
    pcc:        { name: "Posterior cingulate / precuneus", short: "PCC",        xyz: [0.05, 0.30, -0.48] },
    parietal:   { name: "Parietal cortex (angular gyrus)", short: "Parietal",   xyz: [0.60, 0.42, -0.44] },
    occipital:  { name: "Occipital cortex",               short: "Occipital",   xyz: [0.05, 0.02, -0.92] },
    motor:      { name: "Motor cortex",                   short: "Motor",       xyz: [0.42, 0.76, 0.06] },
    cerebellum: { name: "Cerebellum",                     short: "Cerebellum",  xyz: [0.10, -0.62, -0.66] },
    lc:         { name: "Locus coeruleus (brainstem)",    short: "Locus coeruleus", xyz: [0.04, -0.52, -0.12] },
};

/**
 * Dunlosky et al. (2013) reviewed ten common study techniques and rated each
 * for practical utility. It is the single most useful thing to show a student,
 * because the two techniques that came out HIGH are the two almost nobody
 * uses, and the two that came out LOW are the two everybody does.
 */
export const UTILITY = {
    high:     { label: "High utility",     tone: "primary", blurb: "Top rating in Dunlosky's review of ten study techniques." },
    moderate: { label: "Moderate utility", tone: "xp",      blurb: "Works, with more conditions attached." },
    low:      { label: "Low utility",      tone: "streak",  blurb: "Popular, and much weaker than it feels." },
};

const DUNLOSKY = {
    ref: "Dunlosky, Rawson, Marsh, Nathan & Willingham (2013), Psychological Science in the Public Interest 14(1)",
    note: "Rated ten study techniques for practical utility. Practice testing and distributed practice were the only two rated high; rereading and highlighting were rated low.",
};

export const TECHNIQUE_NEURO = {
    pomodoro: {
        headline: "Focus is a resource that drains. Breaks are how it comes back.",
        network:
            "Holding one goal steady is your prefrontal cortex suppressing everything else that wants attention. The default mode network, the daydreaming circuit, has to stay quiet for that, and it gets harder to keep quiet the longer you sit there.",
        regions: [
            { id: "dlpfc", tone: "primary", role: "Holds the goal in mind and blocks the competition" },
            { id: "acc",   tone: "xp",      role: "Notices the moment you've drifted off task" },
            { id: "mpfc",  tone: "chart-4", role: "Default mode network. Quiet when locked in, loud when mind-wandering" },
            { id: "pcc",   tone: "chart-4", role: "The other half of that network" },
            { id: "lc",    tone: "chart-3", role: "Noradrenaline, the arousal system vigilance runs on" },
        ],
        chart: {
            kind: "line",
            title: "Sustained-attention accuracy over 50 minutes",
            schematic: true,
            xLabel: "Minutes on task",
            yLabel: "Accuracy",
            yMax: 100,
            x: [0, 10, 20, 30, 40, 50],
            series: [
                { name: "Straight through", tone: "streak",  values: [100, 97, 93, 90, 87, 85] },
                { name: "With short breaks", tone: "primary", values: [100, 99, 99, 98, 99, 98] },
            ],
            caption: "Ariga & Lleras found performance on a 50-minute task declined steadily, unless participants were given brief breaks, in which case it didn't decline at all.",
        },
        feelsLike:
            "The drop is invisible from the inside. You don't feel yourself getting worse; you just quietly stop noticing things.",
        caveat:
            "Twenty-five minutes is not a research finding. Francesco Cirillo picked it with a kitchen tomato timer in the 1980s. What's actually supported is taking scheduled breaks before you fade, the length is yours to tune.",
        utility: null,
        sources: [
            { ref: "Ariga & Lleras (2011), Cognition 118(3)", note: "Brief breaks from a prolonged task prevented the usual decline in performance." },
            { ref: "Christoff, Gordon, Smallwood, Smith & Schooler (2009), PNAS 106(21)", note: "Mind-wandering recruits the default mode network, most strongly when you don't notice you're doing it." },
        ],
    },

    spaced_repetition: {
        headline: "Forgetting a bit before you review is what makes the review work.",
        network:
            "A memory isn't stored once. Every retrieval pulls it through the hippocampus again and hands a little more of it to the cortex, which is where it ends up living. Spacing gives that transfer time to happen.",
        regions: [
            { id: "hippocampus", tone: "primary", role: "Binds the memory and replays it during consolidation" },
            { id: "mtl",         tone: "primary", role: "Feeds the hippocampus and holds the trace early on" },
            { id: "temporal",    tone: "chart-3", role: "Where the memory gradually ends up living" },
            { id: "vlpfc",       tone: "xp",      role: "Does the searching when the memory isn't immediately there" },
        ],
        chart: {
            kind: "line",
            title: "How much you still have, days later",
            schematic: true,
            xLabel: "Days after learning",
            yLabel: "Retained",
            yMax: 100,
            x: [0, 1, 2, 4, 7, 14, 30],
            series: [
                { name: "Crammed in one go", tone: "streak",  values: [100, 58, 44, 34, 26, 20, 14] },
                { name: "Spaced reviews",    tone: "primary", values: [100, 84, 80, 78, 76, 74, 72] },
            ],
            caption: "The classic forgetting curve, and what spacing does to it. Each review flattens the drop that follows.",
        },
        effect: { g: 0.40, label: "spacing vs cramming", approx: true,
            source: "Cepeda et al. (2006) meta-analysis of 254 studies" },
        feelsLike:
            "Cramming feels better because everything is right there while you're doing it. That fluency is the problem, because it's a reading of how available the material is now, not of how much you'll have on the day.",
        utility: "high",
        sources: [
            { ref: "Cepeda, Pashler, Vul, Wixted & Rohrer (2006), Psychological Bulletin 132(3)", note: "254 studies: spacing beat massing in the large majority of comparisons." },
            { ref: "Cepeda, Vul, Rohrer, Wixted & Pashler (2008), Psychological Science 19(11)", note: "The best gap scales with how long you need to remember, roughly 10–20% of the retention interval." },
            { ref: "Xue et al. (2011), Journal of Neuroscience 31(21)", note: "Spaced repetitions produced more variable neural patterns than massed ones, and that variability predicted better later memory." },
            DUNLOSKY,
        ],
    },

    active_recall: {
        headline: "Pulling it out of your head changes the memory. Putting it in again doesn't.",
        network:
            "Retrieval is not a read operation. Each time you drag something out without the notes, the trace gets rebuilt slightly stronger and slightly easier to find next time. Rereading skips that entirely.",
        regions: [
            { id: "hippocampus", tone: "primary", role: "Reconstructs the memory each time you pull on it" },
            { id: "vlpfc",       tone: "xp",      role: "Runs the search when it doesn't come straight away" },
            { id: "temporal",    tone: "chart-3", role: "Holds the content being retrieved" },
            { id: "parietal",    tone: "chart-4", role: "Signals recollection, the feeling of actually having it" },
        ],
        chart: {
            kind: "bars",
            title: "Recall after repeated study vs repeated testing",
            approx: true,
            yLabel: "Recalled",
            yMax: 100,
            groups: [
                { name: "After 5 minutes", values: [{ name: "Reread it", tone: "streak", value: 81 }, { name: "Tested yourself", tone: "primary", value: 75 }] },
                { name: "After 1 week",    values: [{ name: "Reread it", tone: "streak", value: 40 }, { name: "Tested yourself", tone: "primary", value: 61 }] },
            ],
            caption: "Rereading wins on the day and loses badly a week later. This crossover is the single most important graph in study science, and it's why the technique that feels worse is the one to use.",
        },
        effect: { g: 0.50, label: "testing vs restudying", approx: true,
            source: "Rowland (2014) meta-analysis" },
        feelsLike:
            "Testing yourself feels worse than rereading, and students consistently predict it will work less well. It's one of Bjork's desirable difficulties: the effort is the mechanism, not a sign it isn't working.",
        utility: "high",
        sources: [
            { ref: "Roediger & Karpicke (2006), Psychological Science 17(3)", note: "Repeated study beat repeated testing after five minutes and lost heavily after a week." },
            { ref: "Rowland (2014), Psychological Bulletin 140(6)", note: "Meta-analysis of the testing effect across a wide range of materials and delays." },
            { ref: "Wing, Marsh & Cabeza (2013), Neuropsychologia 51(12)", note: "The benefit of retrieval practice tracked activity in the hippocampus and lateral temporal cortex during the practice test itself." },
            DUNLOSKY,
        ],
    },

    blurting: {
        headline: "An empty page is the most honest feedback you can get.",
        network:
            "Free recall with nothing to cue you is the hardest version of retrieval, which is what makes it the most informative. Where the page stays blank is exactly where the gap is, and unlike rereading, you can't talk yourself out of it.",
        regions: [
            { id: "hippocampus", tone: "primary", role: "Reconstructs each item as you dig it out" },
            { id: "vlpfc",       tone: "xp",      role: "Searches when there's no prompt to work from" },
            { id: "dlpfc",       tone: "chart-3", role: "Tracks what you've already written and what's still missing" },
            { id: "motor",       tone: "chart-4", role: "Writing it by hand adds a second trace to the same content" },
        ],
        chart: {
            kind: "bars",
            title: "What students predict vs what they get",
            schematic: true,
            yLabel: "Score",
            yMax: 100,
            groups: [
                { name: "What they expect", values: [{ name: "Reread it", tone: "streak", value: 68 }, { name: "Recalled it", tone: "primary", value: 55 }] },
                { name: "What happens",     values: [{ name: "Reread it", tone: "streak", value: 40 }, { name: "Recalled it", tone: "primary", value: 61 }] },
            ],
            caption: "Students rate rereading higher than retrieval and then do worse with it. The confidence and the result point in opposite directions, which is why 'it feels like it's working' is not a usable signal.",
        },
        feelsLike:
            "Blurting feels like failing, because you're staring at what you can't do rather than at a page of things you can. That's the information. Rereading hides it.",
        utility: "high",
        sources: [
            { ref: "Roediger & Karpicke (2006), Psychological Science 17(3)", note: "Students predicted repeated study would serve them better, and it didn't." },
            { ref: "Slamecka & Graf (1978), Journal of Experimental Psychology 4(6)", note: "The generation effect, material you produce yourself is remembered better than material you read." },
            DUNLOSKY,
        ],
    },

    exam: {
        headline: "Practise the thing you'll actually be asked to do.",
        network:
            "Memory is picky about context. A trace laid down while reading is not the trace you need while answering a question under time pressure, which is why the closer practice looks to the real thing, the more of it transfers.",
        regions: [
            { id: "vlpfc",       tone: "xp",      role: "Retrieval under load, with a clock running" },
            { id: "dlpfc",       tone: "primary", role: "Planning an answer and budgeting the time" },
            { id: "hippocampus", tone: "chart-3", role: "Pulling the content out cold" },
            { id: "acc",         tone: "chart-4", role: "Monitors errors and time pressure, the part that settles with familiarity" },
        ],
        chart: {
            kind: "bars",
            title: "Blocked practice vs mixed practice, one week later",
            approx: true,
            yLabel: "Correct",
            yMax: 100,
            groups: [
                { name: "Practice session", values: [{ name: "One topic at a time", tone: "streak", value: 89 }, { name: "Topics mixed up", tone: "primary", value: 60 }] },
                { name: "Test a week later", values: [{ name: "One topic at a time", tone: "streak", value: 20 }, { name: "Topics mixed up", tone: "primary", value: 63 }] },
            ],
            caption: "Doing one topic at a time looks far better during the session and collapses on the delayed test. Mixing topics is worse practice and better learning, the same trade as retrieval.",
        },
        feelsLike:
            "A mixed paper feels messier because you have to work out what kind of question it is before you can answer it. On the day, that step is the exam.",
        utility: "moderate",
        sources: [
            { ref: "Rohrer & Taylor (2007), Applied Cognitive Psychology 21(9)", note: "Mixed practice was worse during the session and far better on a delayed test. Figures shown are approximate." },
            { ref: "Morris, Bransford & Franks (1977), Journal of Verbal Learning and Verbal Behavior 16(5)", note: "Transfer-appropriate processing, practice helps most when it matches the demands of the final test." },
            DUNLOSKY,
        ],
        caveat:
            "Interleaving is well supported for maths and for categories that get confused with each other. It's less studied for essay subjects, so treat it as a strong default rather than a law.",
    },

    mind_map: {
        headline: "Drawing it from memory works. Drawing it from your notes doesn't.",
        network:
            "Building a map is only useful while the notes are shut. Done closed-book it's a retrieval task with a picture attached; done open-book it's copying, and copying leaves almost nothing behind.",
        regions: [
            { id: "hippocampus", tone: "primary", role: "Reconstructs each node as you place it" },
            { id: "parietal",    tone: "chart-4", role: "Spatial layout, where things sit relative to each other" },
            { id: "dlpfc",       tone: "chart-3", role: "Holds the structure together while you build it" },
            { id: "temporal",    tone: "xp",      role: "Supplies the meaning of what you're connecting" },
        ],
        chart: {
            kind: "bars",
            title: "Concept mapping vs retrieval practice, one week later",
            schematic: true,
            yLabel: "Score",
            yMax: 100,
            groups: [
                { name: "Facts recalled",    values: [{ name: "Mapped from notes", tone: "streak", value: 45 }, { name: "Retrieval practice", tone: "primary", value: 67 }] },
                { name: "Inference questions", values: [{ name: "Mapped from notes", tone: "streak", value: 44 }, { name: "Retrieval practice", tone: "primary", value: 62 }] },
            ],
            caption: "Karpicke & Blunt put concept mapping head to head with retrieval practice and mapping lost, on facts, on inference, and even when the final test was itself a concept map. Which is exactly why AcedIt asks you to build it blind.",
        },
        feelsLike:
            "A map built with your notes open looks fantastic and teaches you almost nothing. The good-looking version and the useful version are not the same artefact.",
        utility: "moderate",
        sources: [
            { ref: "Karpicke & Blunt (2011), Science 331(6018)", note: "Concept mapping lost to retrieval practice on every measure they tested. Figures shown are approximate." },
            { ref: "Blunt & Karpicke (2014), Journal of Educational Psychology 106(3)", note: "Mapping done as a closed-book retrieval task performed about as well as other retrieval formats, the version AcedIt implements." },
        ],
        caveat:
            "This is the one technique where the popular version and the evidence disagree outright. Mapping is worth doing; mapping while looking at your notes is not.",
    },
};

/** Every region the app can highlight, deduplicated, for the 3D model. */
export const allRegionIds = () =>
    [...new Set(Object.values(TECHNIQUE_NEURO).flatMap(t => t.regions.map(r => r.id)))];

/** Highest value a chart needs to plot, so axes don't clip a bar. */
export function chartMax(chart) {
    if (!chart) return 100;
    const vals = chart.kind === "bars"
        ? chart.groups.flatMap(g => g.values.map(v => v.value))
        : chart.series.flatMap(s => s.values);
    return Math.max(chart.yMax || 0, ...vals);
}
