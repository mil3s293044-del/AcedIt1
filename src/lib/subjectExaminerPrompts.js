// VCAA examiner prompt fragments per VCE subject.
//
// Each profile injects specific, study-design-accurate guidance into AI tool
// prompts so the model writes like a real VCAA assessor — using the exact
// terminology, mark allocation conventions, command terms, and exam paper
// structure for that subject.
//
// Sources: VCAA Study Designs (current cycle) + recent Examiner's Reports.
// Math-heavy subjects also get the standalone LaTeX rendering rules so the
// front-end MathText / MarkdownMath renderer can format equations properly.
//
// Profiles cover the major VCE subjects students actually take. Anything not
// listed falls back to a sensible default profile.

const SHARED_LATEX_RULES = `MATHEMATICAL NOTATION (REQUIRED):
- Wrap inline math in single dollars: $f(x) = x^2 + 2x - 3$, $\\frac{1}{2}$, $\\sqrt{x}$, $e^{i\\pi}$
- Wrap display equations in double dollars on their own lines: $$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$
- Use proper LaTeX: \\frac{a}{b} not a/b, ^{} for superscripts, _{} for subscripts, \\sqrt{} for roots, \\cdot for multiplication
- Greek letters: \\pi, \\theta, \\alpha, \\beta, \\Delta, \\sigma, \\mu, \\lambda, \\omega
- Sets/logic: \\in, \\notin, \\subseteq, \\cup, \\cap, \\forall, \\exists, \\implies
- Functions: \\sin, \\cos, \\tan, \\log, \\ln, \\lim, \\exp
- Vectors: \\vec{v}, \\hat{i}, \\overrightarrow{AB}
- Statistics: \\bar{x}, \\hat{p}, \\sigma^2
- NEVER write math as plain text like "x^2" or "1/4" — always use LaTeX delimiters.`;

const VCAA_FRAMING = `You are a senior VCAA assessor. Write exactly as you would for a real VCE study design and exam paper. Use the exact terminology, mark allocation conventions, and command terms from VCAA examiner's reports. Be precise, formal, and technically correct. Never add disclaimers, hedge, or use casual language. Treat the student as a Year 12 candidate aiming for an A+ grade.`;

const COMMAND_TERMS = `VCAA COMMAND TERMS — match the exact behaviour expected:
- DEFINE: give a precise meaning, no examples needed.
- DESCRIBE: state the features/characteristics with relevant detail.
- EXPLAIN: give reasons why or how something happens, showing causation.
- ANALYSE: identify components and the relationships between them.
- COMPARE: identify similarities AND differences.
- DISTINGUISH: identify the differences only.
- EVALUATE: weigh evidence for and against, then make a judgement.
- JUSTIFY: support a position with reasoned argument and evidence.
- DISCUSS: present multiple perspectives, then synthesise a view.
- OUTLINE: give the main features in brief.
- IDENTIFY: name or recognise.
- STATE: give without elaboration.
- CALCULATE: work out using mathematics, showing all steps.
- DETERMINE: arrive at a final answer through reasoning or calculation.
- HENCE: use the previous result to derive the next.`;

// ─── Subject-specific examiner profiles ───────────────────────────────────────
const PROFILES = {
    // ╔══ MATHEMATICS ═══════════════════════════════════════════════════════╗

    "Mathematical Methods": {
        mathHeavy: true,
        examFormat: "Two written exams. Exam 1 (1 hour, technology-free, 40 marks): short-answer questions only. Exam 2 (2 hours, CAS-allowed, 80 marks): 20 multiple-choice + extended-response. SACs: Application Task (Unit 3, ~20%) + Modelling/Problem-solving Tasks (Unit 4, ~14%). Total study score split: SACs 34% / Exam 1 22% / Exam 2 44%.",
        markConventions: "Mark allocation follows M (method)/A (accuracy)/C (consequential) convention. Show every step of working — answers without working get the answer mark only. Method marks can be earned even with arithmetic errors. Always state exact answers (in surd, fraction, or pi form) unless the question specifies decimal places. Always include units where physical context applies. Probability answers as exact fractions unless told otherwise.",
        keyTerms: ["domain", "range", "co-domain", "stationary point", "point of inflection", "anti-derivative", "Riemann sum", "rule of a function", "implied domain", "transformation matrix", "average value of a function", "definite integral", "indefinite integral", "rate of change", "marginal distribution", "binomial distribution", "normal distribution", "standardised score", "sample proportion", "confidence interval"],
        examplePromptStyle: "Use phrasing students see on real exams: 'Hence, find...', 'Show that...', 'Determine the exact value of...', 'State the rule for the inverse function...', 'Sketch the graph of $f$, labelling all axis intercepts and asymptotes.', 'For the rule found in part (a), state the implied domain and corresponding range.'",
        commonMistakes: "Students lose marks by: (1) giving decimals when exact form was required; (2) failing to test endpoints when finding maximum/minimum on a closed interval; (3) forgetting +c for indefinite integrals; (4) confusing marginal and conditional probability; (5) using calculator notation in tech-free exam; (6) not labelling axes when sketching graphs; (7) treating $\\frac{0}{0}$ as 0 rather than indeterminate.",
        topicCoverage: "Unit 3-4: Functions, relations and graphs (polynomial, exponential, log, trig, hybrid); Algebra (transformations, inverses, simultaneous equations); Calculus (differentiation, anti-differentiation, applications, area/integration); Probability and Statistics (discrete and continuous random variables, normal distribution, sampling distributions, confidence intervals).",
    },

    "Specialist Mathematics": {
        mathHeavy: true,
        examFormat: "Two written exams. Exam 1 (1 hour tech-free, 40 marks). Exam 2 (2 hours CAS-allowed, 80 marks). Both more rigorous than Methods. Includes proof-based questions. SACs Unit 3 + Unit 4 (~17% each). Total: SACs 34% / Exam 1 22% / Exam 2 44%.",
        markConventions: "Same M/A/C marking as Methods, but Specialist questions chain more concepts and proofs are expected to be rigorous and complete. Algebraic proofs require justification at each step. Vector calculations need all working visible. Specialist often deducts heavily for unjustified leaps in proof.",
        keyTerms: ["argument", "modulus", "Argand diagram", "polar form", "Cartesian form", "scalar product", "vector resolute", "linear dependence", "differential equation", "slope field", "implicit differentiation", "kinematics", "uniform motion", "non-uniform motion", "statistical inference", "mean of sample means", "central limit theorem"],
        examplePromptStyle: "Use VCAA Specialist phrasing: 'Show that for all real $x$...', 'Use mathematical induction to prove...', 'Sketch and label the locus of points satisfying $|z - 2 + i| = 3$...', 'Hence solve the differential equation...', 'Express the position vector of $P$ relative to $O$ in terms of $\\vec{i}$ and $\\vec{j}$...'",
        commonMistakes: "(1) Forgetting both branches when squaring an equation; (2) Wrong direction for cross product (right-hand rule); (3) Confusing $\\arg(z)$ branches; (4) Missing the constant of integration in ODEs; (5) Not justifying convergence in induction proofs; (6) Treating differential equations as algebraic equations.",
        topicCoverage: "Unit 3-4: Functions and graphs (rational, hybrid); Algebra (complex numbers in detail, polar form, De Moivre); Calculus (implicit, related rates, integration techniques, ODEs, slope fields); Vectors (scalar and vector products, vector equations of lines/planes); Mechanics (Newton's laws, momentum, equilibrium); Statistical inference (CLT, sampling distributions, hypothesis tests).",
    },

    "General Mathematics": {
        mathHeavy: true,
        examFormat: "Two written exams, both CAS-allowed. Exam 1 (1.5 hours, multiple choice, 40 marks) — 40 MCQ. Exam 2 (1.5 hours, extended response, 60 marks) — written response, structured by Area of Study. SACs Unit 3 (24%) + Unit 4 (16%). Total: SACs 40% / Exam 1 24% / Exam 2 36%.",
        markConventions: "Most questions worth 1-3 marks. CAS expected throughout — include calculator outputs in written response. Show enough setup so the marker can follow your method. Final answers usually rounded to specified decimal places.",
        keyTerms: ["recurrence relation", "first-order linear recurrence", "geometric recurrence", "common ratio", "least-squares regression", "Pearson correlation coefficient", "residual plot", "transition matrix", "steady state", "Eulerian trail", "Hamiltonian path", "minimum spanning tree", "critical path"],
        examplePromptStyle: "Real-world contexts: finance, networks, statistics, recurrence/matrices. Use: 'Write the recurrence relation that models...', 'Use the least-squares regression line to predict...', 'State the Pearson correlation coefficient correct to 2 decimal places...', 'Identify the critical path and state its duration...'",
        commonMistakes: "(1) Using $r = 1.05$ instead of $r = 1.05$ as a multiplier (interest rate vs growth factor); (2) Misreading scatterplot axes; (3) Forgetting that residuals should sum to zero; (4) Confusing correlation and causation; (5) Not labelling activity-on-node networks correctly.",
        topicCoverage: "Unit 3 Data Analysis (univariate/bivariate, time series, smoothing); Recursion and Financial Modelling (loans, annuities, depreciation). Unit 4 Matrices (transition matrices, Markov chains) AND Networks and Decision Mathematics (Eulerian/Hamiltonian, MST, project planning, critical path).",
    },

    "Foundation Mathematics": {
        mathHeavy: true,
        examFormat: "One end-of-year written exam (2 hours, CAS-allowed). Mostly application-based — banking, measurement, statistics in real-world contexts. SACs make up 60% of the study score, exam 40%.",
        markConventions: "Standard maths conventions but with everyday vocabulary. Always include units. Show enough working that the marker can follow.",
        keyTerms: ["interest rate per period", "depreciation", "GST", "compound interest", "perimeter", "surface area", "cylinder", "Pythagoras"],
        examplePromptStyle: "Practical scenarios: 'Calculate the cost of fencing this paddock...', 'Find the value of the investment after 5 years...', 'Compare the two phone plans and state which is cheaper for a user who...'",
        commonMistakes: "Unit conversions, GST application (×1.1 vs ×0.1), confusing diameter and radius, applying interest formulas to wrong period.",
        topicCoverage: "Algebra and Number; Data Analysis, Probability and Statistics; Discrete Mathematics; Space, Measurement and Applications.",
    },

    // ╔══ ENGLISH ════════════════════════════════════════════════════════════╗

    "English": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 3 hours, three sections (Reading & Responding 25 marks; Creating Texts 25 marks; Analysing Argument 25 marks). 60 minutes per section recommended. SACs Unit 3 (25%) + Unit 4 (25%). Total: SACs 50% / Exam 50%.",
        markConventions: "Essays scored holistically against four published criteria: knowledge and understanding of texts/arguments; analysis of language, persuasive technique and authorial choices; sustained, coherent argument; sophistication of expression and metalanguage. Top-band essays demonstrate conceptual sophistication, original interpretation, sustained voice, and consistent use of subject-specific terminology.",
        keyTerms: ["contention", "metalanguage", "rhetorical device", "tone", "register", "authorial intent", "views and values", "characterisation", "narrative voice", "structural shifts", "TEEL/PETAL", "implied audience", "appeal to authority", "appeal to fear", "inclusive language", "loaded language", "anaphora", "hyperbole", "juxtaposition", "symbolism", "subtext"],
        examplePromptStyle: "Section A prompts always centre on a key idea or quote: 'How does Miller use Proctor's transformation to explore the dangers of ideological extremism in The Crucible?'. Section B requires Frameworks of Ideas integration. Section C: 'Analyse the ways in which the author of [X article] uses written and visual language to position the reader.'",
        commonMistakes: "(1) Plot summary instead of analysis — examiners' #1 complaint; (2) Generic terms like 'shows' or 'makes the reader feel'; (3) Quoting without integrating into argument; (4) Ignoring authorial intent — treating texts as if events 'just happen'; (5) Section C: identifying techniques without explaining their purpose; (6) Memorised paragraphs that don't address the prompt.",
        topicCoverage: "Section A (Reading & Responding): one set text in detail, exploring authorial views and values. Section B (Creating Texts): four Frameworks of Ideas (Country, Protest, Personal Journeys, Play) + Reflective Commentary + 2026 mentor texts. Section C (Analysing Argument): persuasive techniques, audience positioning, tone, visual elements.",
    },

    "English Language": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours. Section A: short-answer (~15 marks). Section B: analytical commentary on an unseen text (~30 marks). Section C: essay on contemporary language issue (~30 marks). SACs Unit 3 (25%) + Unit 4 (25%). Total: SACs 50% / Exam 50%.",
        markConventions: "Linguistic accuracy is non-negotiable. Use precise metalanguage from each subsystem. Always link examples to social purpose, contextual factors and identity. Generic comments lose marks fast — 'the speaker uses informal language' is not enough; specify register, mode, function, social purpose.",
        keyTerms: ["Standard Australian English", "non-Standard varieties", "lect (idiolect, sociolect, ethnolect)", "register (formal/informal)", "mode (spoken/written)", "domain", "tenor", "field", "phonology (vowel, consonant, intonation, prosody, allophonic variation)", "morphology (affixation, compounding, conversion)", "lexicology (semantic field, jargon, slang, taboo)", "syntax (clause structure, ellipsis, fronting, theme)", "discourse (cohesion, coherence, deixis, anaphora)", "social purpose (build rapport, mitigate face threat, encode identity, reinforce in-group)", "face needs (positive and negative)", "Grice's maxims"],
        examplePromptStyle: "'Identify and analyse the syntactic features used to build solidarity in lines 8-15.' 'Discuss how this text reflects the changing role of Standard Australian English in contemporary Australian society.' Stimulus is always a real text excerpt — students must reference specific linguistic features at every level.",
        commonMistakes: "(1) Listing features without linking to social purpose; (2) Imprecise metalanguage ('uses jargon' without naming the lexical field); (3) Treating dialect as 'incorrect' rather than rule-governed; (4) Section C essays without contemporary examples; (5) Ignoring contextual factors (audience, setting, relationship).",
        topicCoverage: "Unit 3: Language variation in Australia (Standard vs non-Standard). Unit 4: Language and identity, language and social purpose. All five subsystems are examinable across both units.",
    },

    "Literature": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours. Section A: passage analysis (close analysis of three passages from one text, 20 marks). Section B: literary perspectives essay (20 marks). SACs Unit 3 (25%) + Unit 4 (25%). Total: SACs 50% / Exam 50%.",
        markConventions: "Top responses show original interpretation grounded in specific textual evidence and engagement with literary craft (form, structure, voice, narrative perspective). Argument must be sustained, layered, and aware of multiple readings. Examiners reward students who notice subtle textual features and resist easy interpretations.",
        keyTerms: ["close textual analysis", "literary perspective (feminist, Marxist, post-colonial, psychoanalytic)", "form and structure", "voice", "narrative perspective", "free indirect discourse", "interiority", "subtext", "motif", "trope", "intertextuality", "irony (dramatic, situational, verbal)", "ambiguity", "resonance", "implied reader", "construction of character"],
        examplePromptStyle: "'How do the views and values in [text] emerge through the construction of [character/idea] across the passages provided?' 'Analyse the ways the form and structure of [text] shape its meaning.' 'Discuss how a feminist reading of [text] differs from a more traditional reading.'",
        commonMistakes: "(1) Treating texts as if they were transparent reports of events rather than constructed artefacts; (2) Reciting one literary perspective without close engagement with text; (3) Ignoring form, structure, narrative perspective; (4) Failing to engage with the specific passages provided in Section A.",
        topicCoverage: "Unit 3: Adaptations and transformations + creative response. Unit 4: Literary perspectives + close passage analysis.",
    },

    "English (EAL)": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 3 hours, includes a listening component (Section A part 1: notes on a spoken text, ~15 marks) plus the standard three written sections. SACs Unit 3 (25%) + Unit 4 (25%). Total: SACs 50% / Exam 50%.",
        markConventions: "Same essay criteria as English, with adapted assessments allowing for EAL-eligible students. Listening section requires note-taking accuracy and synthesis. Writing must demonstrate range of vocabulary and grammatical structures.",
        keyTerms: ["Listening for gist", "listening for detail", "note-taking", "summarising", "synonymy", "register-appropriate vocabulary", "complex sentence structures"],
        examplePromptStyle: "Same patterns as mainstream English, with the addition of: 'Listen to the recording. Identify the speaker's main argument and three pieces of supporting evidence.'",
        commonMistakes: "(1) Translating word-for-word from first language; (2) Article errors (a/an/the); (3) Subject-verb agreement in complex sentences; (4) Insufficient evidence integration in essays; (5) Vague vocabulary where precise terms exist.",
        topicCoverage: "Same content as English, with listening skills examined and EAL-specific assessment adaptations.",
    },

    // ╔══ SCIENCES ═══════════════════════════════════════════════════════════╗

    "Biology": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2.5 hours, 120 marks. Section A: 40 multiple choice (40 marks). Section B: short and extended response (80 marks). SACs Unit 3 (30%) + Unit 4 (20%, includes Scientific Investigation poster). Total: SACs 50% / Exam 50%.",
        markConventions: "Mark per piece of correct biological detail. Use precise terminology — 'organism' not 'animal', 'population' not 'group', 'allele' not 'gene' when referring to variants. Diagrams must be labelled. For experimental design questions, mark per variable identified, hypothesis stated, control element. State BOTH cause and effect when explaining mechanisms.",
        keyTerms: ["DNA replication", "transcription", "translation", "post-translational modification", "operon", "epigenetics (methylation, histone modification)", "gene expression", "gene regulation", "homeostasis (negative feedback)", "signal transduction", "immune response (innate vs adaptive)", "MHC", "cytokine", "natural selection", "genetic drift", "founder effect", "speciation (allopatric, sympatric)", "mass extinction", "biodiversity"],
        examplePromptStyle: "VCAA command terms used precisely: 'Describe the role of...' 'Explain how...' 'Compare X and Y, identifying two similarities and one difference.' 'With reference to the diagram, justify why...' 'Predict, with reasoning, the effect on...'",
        commonMistakes: "(1) Confusing DNA, gene, and chromosome; (2) Saying 'genes turn on' without mechanism; (3) Conflating evolution and natural selection (the latter is a mechanism of the former); (4) Identifying primary/secondary immune response by timing only; (5) Saying 'a mutation causes adaptation' without mentioning selective pressure; (6) Using everyday rather than scientific language.",
        topicCoverage: "Unit 3: How do cells maintain life? (cells, signalling, regulating cell function, DNA, gene expression). Unit 4: How does life change and respond to challenges? (genetic changes, change over time, scientific investigation).",
    },

    "Chemistry": {
        mathHeavy: true,
        examFormat: "End-of-year exam: 2.5 hours, 120 marks. Section A: 30 multiple choice (30 marks). Section B: short + extended response (90 marks). Data book and CAS provided. SACs Unit 3 (30%) + Unit 4 (20%, includes Scientific Investigation). Total: SACs 50% / Exam 50%.",
        markConventions: "Stoichiometry calculations: mark for balanced equation, mark for $n = m/M$, mark for ratio, mark for final answer with units. Show all working including units throughout. Final answers to 3 significant figures unless otherwise specified. Sign conventions matter for $\\Delta H$. Equations must be balanced, including charges in redox.",
        keyTerms: ["enthalpy change", "entropy", "spontaneity", "equilibrium constant ($K_c$)", "Le Chatelier's principle", "stoichiometric coefficient", "limiting reagent", "yield", "redox", "oxidation number", "anode/cathode", "electrolyte", "galvanic cell", "fuel cell", "specific heat capacity", "calorimetry", "rate of reaction", "activation energy", "enzyme", "structural isomer", "stereoisomer", "carbonyl group", "amide linkage", "esterification", "infrared spectrum", "NMR", "mass spectrum", "biofuel", "biodiesel"],
        examplePromptStyle: "'Calculate the mass of CO2 produced when 2.50 g of methane combusts completely.' 'Identify the limiting reagent and justify with calculation.' 'Predict the effect of increasing temperature on the equilibrium position, with reference to Le Chatelier's principle.' 'Use the IR and NMR spectra to determine the structure of the unknown compound.'",
        commonMistakes: "(1) Forgetting to balance equations before stoichiometry; (2) Wrong sign for $\\Delta H$; (3) Confusing $K_c$ change with reaction quotient $Q$; (4) Misreading IR functional group regions; (5) Missing the H+ or e- in half-equations; (6) Reporting answers to wrong significant figures; (7) Stating temperature change moves equilibrium without referencing endo/exothermic nature.",
        topicCoverage: "Unit 3: How can chemical processes be designed to optimise efficiency? (chemical thermodynamics; equilibrium and Le Chatelier; redox; galvanic and electrolytic cells; fuel cells). Unit 4: How are organic compounds categorised, analysed and used? (structure, naming, properties, reactions of organic families; spectroscopy; biofuels and biopolymers).",
    },

    "Physics": {
        mathHeavy: true,
        examFormat: "End-of-year exam: 2.5 hours, 120 marks. Section A: ~20 multiple choice. Section B: short + extended response. Formula sheet and CAS provided. SACs Unit 3 (30%) + Unit 4 (20%, includes Scientific Investigation). Total: SACs 50% / Exam 50%.",
        markConventions: "Show all working: 1 mark for correct formula, 1 mark for substitution with units, 1 mark for answer with correct units and 3 sig figs. Always specify direction for vector quantities. Free body diagrams must include all forces. Electric and magnetic field directions matter. Sign conventions in motion (positive direction defined).",
        keyTerms: ["resultant force", "impulse $\\vec{J} = \\vec{F}\\Delta t$", "momentum $\\vec{p} = m\\vec{v}$", "elastic vs inelastic collision", "centripetal force", "gravitational field strength", "EMF", "back EMF", "rms current", "rms voltage", "transformer ratio", "wave-particle duality", "photon energy $E = hf$", "work function", "threshold frequency", "de Broglie wavelength", "time dilation $\\Delta t = \\gamma \\Delta t_0$", "length contraction", "mass-energy equivalence $E = mc^2$"],
        examplePromptStyle: "'Calculate the magnitude and direction of the net force on the object.' 'Sketch a fully labelled velocity-time graph for the motion described.' 'Apply the conservation of momentum to find the velocity of the combined mass after the collision.' 'Explain, with reference to the photoelectric effect, why a particle model of light is required to explain the observation.'",
        commonMistakes: "(1) Treating vectors as scalars (sign errors); (2) Forgetting the negative sign in Faraday's law; (3) Using $g = 10$ instead of $9.8 \\text{ m/s}^2$ when not specified; (4) Mixing rms and peak values in AC; (5) Wrong transformer turns ratio direction; (6) Quoting de Broglie wavelength in wrong order of magnitude; (7) Forgetting the proper time vs observer time distinction in special relativity.",
        topicCoverage: "Unit 3: How do fields explain motion and electricity? (gravitational, electric, magnetic fields; circular motion and projectile motion; electromagnetic induction; transformers; transmission of electricity). Unit 4: How have theories of light and matter changed? (waves, light, photoelectric effect, special relativity, scientific investigation).",
    },

    "Psychology": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2.5 hours, 120 marks. Section A: 50 multiple choice (50 marks). Section B: short + extended response (70 marks). SACs Unit 3 (30%) + Unit 4 (20%, includes Empirical Investigation). Total: SACs 50% / Exam 50%.",
        markConventions: "Studies referenced by name, year, and findings (not memorised verbatim). For experimental design: identify IV, DV, controlled variables, hypothesis (operationalised). Mark per piece of evidence. Mental health questions require clinical accuracy and sensitivity.",
        keyTerms: ["independent variable", "dependent variable", "controlled variable", "extraneous variable", "confounding variable", "operationalised", "hypothesis", "experimental design (within-subjects, between-subjects, mixed)", "random allocation", "counterbalancing", "reliability", "validity (internal, external, construct)", "ethical principles (informed consent, withdrawal rights, confidentiality, debriefing)", "neuron", "synaptic transmission", "autonomic nervous system (sympathetic/parasympathetic)", "fight-flight-freeze", "GAS (alarm-resistance-exhaustion)", "cognitive behaviour therapy", "biopsychosocial model"],
        examplePromptStyle: "'Identify the independent variable in the study described.' 'Distinguish between sensitisation and habituation, providing one example of each.' 'Suggest one ethical issue arising from this study and explain how it could be addressed in line with VCAA ethical principles.' 'Apply the biopsychosocial model to explain the development of [condition].'",
        commonMistakes: "(1) Memorising studies instead of understanding what they show; (2) Imprecise IV/DV (must be operationalised and measurable); (3) Confusing reliability and validity; (4) Stating ethical principle without explaining how it applies; (5) Using lay terms instead of technical ones; (6) Confusing classical vs operant conditioning components.",
        topicCoverage: "Unit 3: How does experience affect behaviour and mental processes? (nervous system, stress, learning, memory). Unit 4: How is mental wellbeing supported and maintained? (consciousness, sleep, mental wellbeing, scientific investigation).",
    },

    "Environmental Science": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours, structured response. SACs Unit 3 (30%) + Unit 4 (20%). Total: SACs 50% / Exam 50%.",
        markConventions: "Use specific Australian case studies. Quantify where possible (population numbers, hectares, % change). Reference scientific data sources. For systems questions, identify input/process/output relationships clearly.",
        keyTerms: ["biogeochemical cycle (carbon, nitrogen, phosphorus, water)", "ecosystem services", "biodiversity (genetic, species, ecosystem)", "ecological footprint", "trophic cascade", "indicator species", "bioaccumulation", "biomagnification", "anthropogenic", "albedo", "greenhouse effect (enhanced)", "feedback loop (positive/negative)", "tipping point", "in-situ vs ex-situ conservation", "stewardship"],
        examplePromptStyle: "'Outline two anthropogenic factors contributing to soil salinity in Victoria.' 'Discuss the effectiveness of [policy/intervention] in reducing greenhouse gas emissions.' 'Predict the consequence of removing apex predators on the trophic structure of this ecosystem.'",
        commonMistakes: "(1) Vague phrases like 'humans cause pollution'; (2) Missing the time scale of consequences; (3) Confusing weather and climate; (4) Treating biogeochemical cycles as one-way; (5) Failing to use specific case studies.",
        topicCoverage: "Unit 3: How can biodiversity and development be sustained? Unit 4: How can the impacts of human energy use be reduced?",
    },

    // ╔══ HUMANITIES ════════════════════════════════════════════════════════╗

    "History: Revolutions": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours. For each of two studied revolutions: a document analysis question (10 marks) + an extended-response essay (20 marks). 80 marks total. SACs Unit 3 (25%) + Unit 4 (25%). Total: SACs 50% / Exam 50%.",
        markConventions: "Use specific evidence: dates, statistics, named individuals, primary source quotations. Reference at least two historians by name in essays (Christopher Hill, Sheila Fitzpatrick, Lynn Hunt, Jonathan Spence, etc.). For document analysis: identify origin, purpose, message, limitations and corroborate with knowledge.",
        keyTerms: ["proximate cause", "long-term cause", "trigger", "ideology (liberal, conservative, radical)", "old regime", "revolutionary leadership", "consolidation", "reaction", "counter-revolution", "Terror", "Thermidorian reaction", "historiographical school (Whig, Marxist, revisionist, post-revisionist)", "agency vs structure"],
        examplePromptStyle: "'To what extent were economic factors responsible for the outbreak of the [Russian] Revolution?' 'Evaluate the role of [Robespierre/Lenin/Mao] in the consolidation of revolutionary power.' 'Analyse the impact of revolutionary ideology on the experience of [peasants/women/the bourgeoisie] in the new regime.'",
        commonMistakes: "(1) Narrative chronology instead of analytical argument; (2) Lists of events without causal links; (3) Vague historians ('historians say...'); (4) Ignoring the prompt's specific terms; (5) Failing to engage with both 'cause' and 'consequence'; (6) Missing nuance — treating revolutions as inevitable or purely good/bad.",
        topicCoverage: "Two of: American (1754-89), French (1774-95), Russian (1896-1927), Chinese (1898-1976). Each covered across causes, course, and consequences/regime change.",
    },

    "Australian History": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours. Source analysis + essays. SACs Unit 3 (25%) + Unit 4 (25%). Total: SACs 50% / Exam 50%.",
        markConventions: "Use specific dates, legislation, named individuals, and primary sources. Engage with First Nations histories accurately and respectfully. Reference Australian historians (Henry Reynolds, Marilyn Lake, Stuart Macintyre).",
        keyTerms: ["frontier", "dispossession", "terra nullius", "Mabo", "Native Title Act 1993", "Stolen Generations", "Bringing Them Home report", "assimilation", "self-determination", "reconciliation", "Federation", "White Australia Policy", "post-war migration", "multiculturalism"],
        examplePromptStyle: "'To what extent did the policies of assimilation harm First Nations peoples between 1937-1967?' 'Analyse the impact of post-war migration on the construction of Australian national identity.' 'Evaluate the legacies of the 1967 Referendum.'",
        commonMistakes: "(1) Generic statements about 'European settlers'; (2) Failing to centre First Nations perspectives; (3) Conflating Aboriginal and Torres Strait Islander peoples; (4) Vague references to 'discrimination' without policy specificity; (5) Treating contested history as settled.",
        topicCoverage: "Various depending on school choice — typically Federation to Reconciliation, with deep dives into specific decades.",
    },

    "Geography": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours, structured response. Photograph/map/data interpretation throughout. SACs Unit 3 (30%, includes fieldwork) + Unit 4 (20%). Total: SACs 50% / Exam 50%.",
        markConventions: "Memorise 2-3 specific case studies per topic with names, dates, and statistics. Annotated map sketches gain marks. Always specify location precisely (use latitude/longitude or named place). Use topographic terminology (escarpment, alluvial, riparian, etc.).",
        keyTerms: ["spatial association", "spatial change", "interconnection", "scale (local, regional, national, global)", "land cover change", "land use change", "geomorphic process", "anthropogenic", "land degradation", "remote sensing", "GIS", "fieldwork methods (transect, quadrat, sampling)", "case study"],
        examplePromptStyle: "'With reference to a chosen case study, analyse the human and physical factors contributing to land cover change.' 'Describe the spatial distribution of [phenomenon] shown in Figure 1.' 'Evaluate the effectiveness of one strategy to manage [issue].'",
        commonMistakes: "(1) Using one case study where two are required; (2) Generic statements without location specifics; (3) Misreading scale or grid references; (4) Ignoring the verb (describe vs analyse vs evaluate); (5) Failing to link physical and human geography in integrated questions.",
        topicCoverage: "Unit 3: Changing the land. Unit 4: Human population — trends and issues.",
    },

    "Legal Studies": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours, 80 marks, structured + extended response. SACs Unit 3 (25%) + Unit 4 (25%). Total: SACs 50% / Exam 50%.",
        markConventions: "Define legal terms precisely. Use real cases and recent reforms (last 5 years preferred). Always link to the principles of justice (fairness, equality, access) when evaluating legal mechanisms. Discuss strengths AND limitations.",
        keyTerms: ["doctrine of precedent (binding, persuasive, ratio decidendi, obiter dictum)", "burden of proof / standard of proof (beyond reasonable doubt vs balance of probabilities)", "jurisdiction (original, appellate)", "statutory interpretation", "principles of justice (fairness, equality, access)", "Royal Commission", "Law Reform Commission", "alternative dispute resolution", "victim impact statement", "sanctions (imprisonment, community correction order, fine)", "rights of the accused", "rights of the victim", "Bill of Rights debate", "constitutional limits"],
        examplePromptStyle: "'Distinguish between summary and indictable offences, providing one example of each.' 'Evaluate the ability of the Victorian court hierarchy to achieve the principles of justice.' 'Suggest one reform that would improve the criminal justice system and explain its likely effectiveness.'",
        commonMistakes: "(1) Vague principles of justice — must be specific to mechanism evaluated; (2) Outdated cases when recent reforms exist; (3) Confusing criminal and civil burdens of proof; (4) Treating ADR as universally suitable; (5) Generic strengths/limitations without concrete examples.",
        topicCoverage: "Unit 3: Rights and justice (criminal and civil). Unit 4: The people, the constitution and the law.",
    },

    "Australian and Global Politics": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours, structured + essay. SACs Unit 3 (25%) + Unit 4 (25%). Total: SACs 50% / Exam 50%.",
        markConventions: "Use contemporary case studies (last 5 years). Reference specific actors, treaties, events with dates. Critically evaluate, don't just describe. Use political-science terminology accurately.",
        keyTerms: ["state sovereignty", "soft power", "hard power", "smart power", "national interest", "global actor", "intergovernmental organisation (UN, WTO, ASEAN)", "non-state actor", "transnational", "globalisation", "humanitarian intervention", "responsibility to protect (R2P)", "treaty-based vs customary international law", "realism vs liberalism vs constructivism"],
        examplePromptStyle: "'Analyse the extent to which [Australia/China/USA] has achieved its national interest in [the Indo-Pacific] over the past five years.' 'Discuss the effectiveness of the United Nations in addressing [climate change/conflict]. Refer to specific cases.'",
        commonMistakes: "(1) Outdated case studies (5+ years old); (2) Generalised global actor descriptions; (3) Conflating national interest with foreign policy; (4) Missing actor perspectives; (5) Asserting effectiveness without measurable criteria.",
        topicCoverage: "Unit 3: Global cooperation and conflict. Unit 4: Global challenges (chosen from human rights, ethnic and religious tensions, economic issues, environmental issues).",
    },

    "Philosophy": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours, two essays. SACs Unit 3 (25%) + Unit 4 (25%). Total: SACs 50% / Exam 50%.",
        markConventions: "Engage with primary texts (Plato, Descartes, Kant, Mill, etc.) — quote and reference accurately. Construct arguments validly: state premises, derive conclusion. Steel-man opposing views. Use philosophical terminology precisely.",
        keyTerms: ["validity vs soundness", "deductive vs inductive", "necessary vs sufficient conditions", "a priori vs a posteriori", "analytic vs synthetic", "epistemology", "ontology", "metaphysics", "consequentialism", "deontology", "virtue ethics", "qualia", "physicalism", "dualism", "functionalism", "free will (libertarian, compatibilist, hard determinist)"],
        examplePromptStyle: "'Critically evaluate the Cartesian argument for mind-body dualism.' 'Is the trolley problem a useful tool for adjudicating between consequentialist and deontological ethical frameworks?'",
        commonMistakes: "(1) Restating philosopher's view without analysis; (2) Confusing validity with soundness; (3) Missing the strongest version of the opposing argument; (4) Vague use of terms like 'subjective' or 'objective'.",
        topicCoverage: "Unit 3: Minds, bodies and persons. Unit 4: The good life (ethics, politics, society).",
    },

    // ╔══ BUSINESS ═════════════════════════════════════════════════════════╗

    "Economics": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours, structured + extended response. SACs Unit 3 (25%) + Unit 4 (25%). Total: SACs 50% / Exam 50%.",
        markConventions: "Use current statistics with date attached (e.g. 'unemployment 4.2% September 2024'). Diagrams must be fully labelled with axes, curves, equilibrium, shifts. Link cause → effect → impact in a chain. Always discuss both AD and AS effects where relevant.",
        keyTerms: ["aggregate demand (C + I + G + X − M)", "aggregate supply", "supply-side policy", "discretionary fiscal policy", "automatic stabiliser", "RBA cash rate", "monetary policy stance (expansionary/contractionary)", "terms of trade", "exchange rate (TWI)", "current account deficit", "budget balance (primary, headline)", "structural budget", "non-accelerating inflation rate of unemployment (NAIRU)", "inflation target band (2-3%)", "external stability"],
        examplePromptStyle: "'Analyse how a contractionary monetary policy stance might affect economic growth and the rate of inflation. Refer to a relevant aggregate demand and supply diagram in your answer.' 'Discuss two factors that have influenced Australia's terms of trade since 2020.'",
        commonMistakes: "(1) Outdated statistics; (2) Diagrams without axis labels or shift arrows; (3) Confusing fiscal and monetary policy effects; (4) Missing the time lag of policy effects; (5) Treating exchange rate as cause rather than transmission channel; (6) Failing to define key terms before applying them.",
        topicCoverage: "Unit 3: Australia's living standards (living standards, AD/AS, microeconomic and macroeconomic factors, government intervention). Unit 4: Managing the economy (monetary policy, fiscal policy, aggregate supply policies).",
    },

    "Business Management": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours, case-study based. ~50 marks total. SACs Unit 3 (25%) + Unit 4 (25%). Total: SACs 50% / Exam 50%.",
        markConventions: "Use ASX-listed or well-known company case studies. Apply theory to context — never just define. State the management theorist (Maslow, Locke, Lewin, Mintzberg, Porter, Senge) where relevant. Higher-mark questions need both context AND theoretical reasoning.",
        keyTerms: ["managerial style (autocratic, persuasive, consultative, participative, laissez-faire)", "strategic management model", "Lewin's Three-Step Change Model", "Senge's learning organisation", "low-risk vs high-risk strategies", "tangible vs intangible benefits", "stakeholders (internal vs external)", "key performance indicators", "human resource management cycle"],
        examplePromptStyle: "'With reference to the case study, evaluate the management style of [executive] in implementing change at [company].' 'Analyse two corporate culture strategies that could improve performance at [company].'",
        commonMistakes: "(1) Definitions without application; (2) Generic management theory; (3) Ignoring the case-study constraints; (4) Inventing facts about the company; (5) Recommending strategies without considering trade-offs.",
        topicCoverage: "Unit 3: Managing a business. Unit 4: Transforming a business.",
    },

    "Accounting": {
        mathHeavy: true,
        examFormat: "End-of-year exam: 2 hours, structured response with calculations. SACs Unit 3 (25%) + Unit 4 (25%). Total: SACs 50% / Exam 50%.",
        markConventions: "Show all working. Use double-entry conventions: every debit needs its credit. Reports must be correctly headed and dated. Accounting principles (entity, going concern, accrual, consistency, materiality, faithful representation, relevance) should be referenced when justifying decisions.",
        keyTerms: ["double-entry bookkeeping", "accounts receivable / payable", "accrual basis", "matching principle", "depreciation (straight-line, reducing balance)", "stock card", "cost of sales", "GST", "owner's equity", "income statement", "balance sheet", "cash flow statement", "qualitative characteristics (relevance, faithful representation, comparability, verifiability, timeliness, understandability)"],
        examplePromptStyle: "'Prepare the Income Statement for the year ending 30 June 2025.' 'Explain why depreciation is recorded as an expense, with reference to one accounting principle.' 'Calculate the cost of sales using the perpetual inventory method.'",
        commonMistakes: "(1) Missing the GST component; (2) Wrong sign on depreciation entries; (3) Confusing prepaid and accrued expenses; (4) Not heading reports correctly (entity name, report title, date); (5) Stating principle without explaining its application.",
        topicCoverage: "Unit 3: Financial accounting for a trading business. Unit 4: Recording, reporting, budgeting and decision-making.",
    },

    // ╔══ ARTS & DESIGN ═════════════════════════════════════════════════════╗

    "Visual Communication Design": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 1.5 hours, written analysis of design works. SAT (folio): 60% of study score. SACs Unit 3 (5%) + Unit 4 (5%). Total: SAT 60% / SACs 10% / Exam 30%.",
        markConventions: "Folio judged on the design process: research, ideation, refinement, presentation. Annotated visuals with specific design terminology. Exam: identify design elements/principles, apply VCD design thinking framework, reference cultural/historical contexts.",
        keyTerms: ["design elements (point, line, shape, form, texture, tone, colour, type, space)", "design principles (figure-ground, balance, contrast, scale, hierarchy, repetition, unity)", "design thinking (Empathise, Define, Ideate, Prototype, Test, Develop, Deliver)", "design field (environmental, communication, industrial)", "audience and context", "iteration", "refinement"],
        examplePromptStyle: "Folio prompts: 'Develop a brand identity for a sustainable Melbourne café targeting Gen Z.' Exam: 'Compare and contrast the use of design elements and principles in Figure A and Figure B. State the design intention of each.'",
        commonMistakes: "(1) Skipping early design-process stages; (2) Vague annotations ('I changed the colour'); (3) Limited research/ideation pages; (4) Not iterating between ideation and refinement; (5) Generic exam analysis without specific element references.",
        topicCoverage: "Unit 3: Designing to communicate. Unit 4: Designing to engage and persuade.",
    },

    "Art Making and Exhibiting": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 1.5 hours, written. SAT (folio): 60%. SACs Unit 3 (8%) + Unit 4 (7%). Total: SAT 60% / SACs 15% / Exam 25%.",
        markConventions: "Folio: visual diary documents process, references artists, demonstrates risk-taking and refinement. Exam: analyse artworks using specific art terminology, reference art historians and curators.",
        keyTerms: ["medium", "technique", "process", "form (line, shape, colour, tone, texture, space)", "composition", "subject matter", "iconography", "art movement (Impressionism, Cubism, Surrealism, etc.)", "curatorial framework", "exhibition design", "audience interpretation"],
        examplePromptStyle: "Visual diary entries showing artists studied (with annotated influences), experiments with media, reflection on creative decisions. Exam: 'Discuss how the artist's choice of materials contributes to the meaning of the artwork.'",
        commonMistakes: "(1) Insufficient artist research; (2) Vague reflection; (3) Missing the curatorial component (Unit 4); (4) Generic comments on technique; (5) Limited experimentation in early stages.",
        topicCoverage: "Unit 3: Making artworks (exploration, experimentation, reflection). Unit 4: Curatorial practices and presentation.",
    },

    "Media": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours, written analysis + theory. SAT (production): 30%. Unit 3 SAC (design plan + theory): 30%. Unit 4 SAC: 10%. Total: SAT 30% / SACs 40% / Exam 30%.",
        markConventions: "Production must demonstrate technical proficiency and storytelling. Theory questions require specific media examples with media institution and producer named. Use media-specific terminology (mise-en-scène, diegetic sound, montage, narrative structure).",
        keyTerms: ["mise-en-scène", "diegetic vs non-diegetic sound", "montage", "continuity editing", "narrative structure (linear, non-linear, three-act, fabula/syuzhet)", "genre conventions", "audience theory (active, passive)", "ideology", "representation", "regulation", "convergence", "platform", "media institution"],
        examplePromptStyle: "Design plan: clear narrative concept, target audience, distribution platform, production schedule. Exam: 'Analyse how mise-en-scène constructs meaning in a media product you have studied.'",
        commonMistakes: "(1) Production without clear narrative arc; (2) Generic genre comments; (3) Audience reception without theory framework; (4) Missing institutional context (who made it, why, for whom); (5) Vague terms ('the camera angle is interesting').",
        topicCoverage: "Unit 3: Narrative across media forms. Unit 4: Media production design and engagement.",
    },

    "Music Repertoire Performance": {
        mathHeavy: false,
        examFormat: "Performance exam (40%, 25-min recital + technical work). Written exam (30%, 2 hours). SACs Unit 3 (10%) + Unit 4 (20%). Total: Performance 40% / SACs 30% / Written exam 30%.",
        markConventions: "Performance graded on technical fluency, musicality, interpretation, ensemble (if applicable), repertoire choice. Written exam tests aural skills, music theory, and analysis of performance.",
        keyTerms: ["dynamics", "articulation (legato, staccato, marcato)", "ornamentation", "rubato", "intonation", "timbre", "tempo (allegro, andante, etc.)", "form (binary, ternary, sonata, rondo)", "modulation", "cadence (perfect, plagal, imperfect, deceptive)", "harmonic analysis (I-IV-V-I)", "interval (major, minor, perfect, augmented, diminished)"],
        examplePromptStyle: "'Identify the form of the work performed and justify with reference to the score.' 'Compare two different performance interpretations of the same work.'",
        commonMistakes: "(1) Memorising notes without phrasing; (2) Inconsistent intonation; (3) Wrong tempo for the period style; (4) Limited dynamic range; (5) Misidentifying cadences in written exam.",
        topicCoverage: "Performance + theory + aural + analysis.",
    },

    "Drama": {
        mathHeavy: false,
        examFormat: "Solo performance exam (35%, 7-min solo + statement of intent). Ensemble performance (30%). SACs Unit 3-4 (15% combined). End-of-year written exam (1.5 hours, 20%). Total: Performance 65% / SACs 15% / Exam 20%.",
        markConventions: "Performance: clarity of intent, dramatic technique, characterisation, transformation, audience engagement. Statement of intent must articulate stimulus, dramatic purpose, audience. Written exam: analysis of one's own performance + others' performance.",
        keyTerms: ["dramatic intent", "stimulus", "transformation of character/place/time", "stagecraft (lighting, sound, costume, set, makeup, props)", "performance style (naturalism, non-naturalism, epic, physical, postmodern)", "dramatic element (focus, tension, mood, climax, rhythm, contrast, conflict)", "convention (chorus, song, direct address, freeze)", "performance space"],
        examplePromptStyle: "Statement of intent: clear stimulus → idea → audience response goal. Written exam: 'Analyse how the performer transformed character in your studied performance.'",
        commonMistakes: "(1) Multiple unconnected characters with no transformation; (2) Statement of intent without clear audience response; (3) Stagecraft listed without dramatic purpose; (4) Generic performance style references.",
        topicCoverage: "Unit 3: Devised solo. Unit 4: Devised ensemble. Plus analysis of contemporary professional theatre.",
    },

    // ╔══ TECH ═════════════════════════════════════════════════════════════╗

    "Software Development": {
        mathHeavy: false,
        examFormat: "SAT (software product, Unit 3-4): 30%. Unit 3 SAC: 20%. Unit 4 SAC: 20%. End-of-year written exam (2 hours): 30%.",
        markConventions: "SAT: judged on software development life cycle (analysis → design → development → testing → evaluation). Pseudocode and UML diagrams must follow VCAA conventions. Written exam: theory questions require specific terminology, problem-solving questions require pseudocode or actual code with comments.",
        keyTerms: ["software development life cycle (analysis, design, development, evaluation)", "data structure (array, list, dictionary, stack, queue, tree)", "algorithm complexity (O(n), O(log n), O(n²))", "pseudocode", "context diagram", "data flow diagram", "Gantt chart", "use-case diagram", "object-oriented programming (class, object, attribute, method, encapsulation, inheritance, polymorphism)", "validation (existence, type, range, format, length)", "testing (alpha, beta, unit, integration, acceptance)"],
        examplePromptStyle: "'Write a pseudocode algorithm to find the maximum value in an array.' 'Identify two methods of validating a date input field.' 'Explain the purpose of a data flow diagram in software development.'",
        commonMistakes: "(1) Pseudocode using language-specific syntax; (2) Missing validation cases; (3) UML diagrams without correct cardinality; (4) Skipping testing documentation; (5) Confusing functional and non-functional requirements.",
        topicCoverage: "Unit 3: Programming. Unit 4: Software development and quality.",
    },

    "Data Analytics": {
        mathHeavy: false,
        examFormat: "SAT (database / visualisation product): 30%. Unit 3 SAC: 20%. Unit 4 SAC: 20%. Exam (2 hours): 30%.",
        markConventions: "SAT: judged on problem-solving methodology — data acquisition → cleaning → transformation → analysis → visualisation. SQL syntax must be correct. Visualisations must be appropriate for the data type and message.",
        keyTerms: ["data dictionary", "primary key", "foreign key", "normalisation (1NF, 2NF, 3NF)", "relational database", "SQL (SELECT, FROM, WHERE, JOIN, GROUP BY, HAVING, ORDER BY)", "data integrity (entity, referential)", "data visualisation (chart appropriate to data type)", "data validation", "data wrangling/cleaning"],
        examplePromptStyle: "'Write an SQL query to retrieve the top 10 customers by total purchase value.' 'Describe one strategy to ensure data integrity in a relational database.' 'Justify your choice of chart type for representing this data.'",
        commonMistakes: "(1) Using AVG without GROUP BY; (2) Pie charts for too many categories; (3) Missing JOIN conditions causing Cartesian products; (4) Inappropriate axis scales hiding patterns; (5) Skipping data cleaning documentation.",
        topicCoverage: "Unit 3: Data analytics. Unit 4: Solving problems using data analytics.",
    },

    // ╔══ HEALTH & PE ═══════════════════════════════════════════════════════╗

    "Health and Human Development": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours, structured response. SACs Unit 3 (20%) + Unit 4 (30%, includes investigation). Total: SACs 50% / Exam 50%.",
        markConventions: "Use specific case studies and statistics (Australian Bureau of Statistics, AIHW data). Apply frameworks (dimensions of health, biopsychosocial, sustainability, Sustainable Development Goals). Distinguish health status (current measure) from determinants (causes).",
        keyTerms: ["dimensions of health (physical, social, mental, emotional, spiritual)", "health status indicators (life expectancy, HALE, mortality, morbidity, incidence, prevalence)", "burden of disease (DALY, YLL, YLD)", "biological, sociocultural, environmental and commercial determinants of health", "health promotion", "Ottawa Charter for Health Promotion", "Old vs New Public Health", "Sustainable Development Goals", "human development", "Human Development Index", "health system (Medicare, PBS, NDIS)"],
        examplePromptStyle: "'Outline two sociocultural determinants of health that contribute to differences in life expectancy between Indigenous and non-Indigenous Australians.' 'Apply the Ottawa Charter to evaluate the effectiveness of one health promotion campaign.'",
        commonMistakes: "(1) Confusing dimensions of health (e.g. social vs emotional); (2) Health status with determinants; (3) Vague references to 'lifestyle'; (4) Missing the difference between Old and New Public Health; (5) Not citing specific data.",
        topicCoverage: "Unit 3: Australia's health in a globalised world. Unit 4: Health and human development in a global context.",
    },

    "Physical Education": {
        mathHeavy: false,
        examFormat: "End-of-year exam: 2 hours, structured response. SACs Unit 3 (25%) + Unit 4 (25%). Total: SACs 50% / Exam 50%.",
        markConventions: "Apply biomechanical and physiological theory to specific sports/movement scenarios. Use exact anatomical terminology. Show calculations for power, work, energy where applicable.",
        keyTerms: ["energy systems (ATP-CP, anaerobic glycolysis, aerobic)", "fuel sources (creatine phosphate, glucose, glycogen, fats)", "VO2 max", "lactate inflection point", "skill acquisition (cognitive, associative, autonomous stages)", "feedback (intrinsic, extrinsic, knowledge of results, knowledge of performance)", "training methods (continuous, fartlek, interval, resistance, plyometric, flexibility)", "training principles (FITT, intensity, duration, frequency, overload, specificity, progression, reversibility, individuality, diminishing returns)", "biomechanical principles (Newton's laws, levers, projectile motion, force-time, impulse)"],
        examplePromptStyle: "'Identify the predominant energy system used in a 200m sprint and justify with reference to fuel sources and duration.' 'Analyse the biomechanical principles applied in a tennis serve to maximise racquet head velocity.'",
        commonMistakes: "(1) Confusing the three energy systems and their thresholds; (2) Wrong fuel for the energy system; (3) Vague training principles; (4) Misidentifying lever classes (1st, 2nd, 3rd); (5) Not relating theory to a specific sport.",
        topicCoverage: "Unit 3: Movement skills and energy for physical activity. Unit 4: Training to improve performance.",
    },

    // ╔══ LANGUAGES ═════════════════════════════════════════════════════════╗

    "French": {
        mathHeavy: false,
        examFormat: "Oral exam: 10 min interview + presentation (50 marks). End-of-year written exam: 2 hours, 75 marks (Section 1: listening; Section 2: reading; Section 3: writing). SACs Unit 3 + 4. Total: Oral 25% / Written exam 50% / SACs 25%.",
        markConventions: "Marks for grammatical accuracy, range of vocabulary, communication of ideas, sociocultural awareness. Higher marks for complex sentence structures (subjunctive, conditional, complex tenses) and idiomatic expression. In oral exam, examiners reward attempts at complex structures even if imperfect.",
        keyTerms: ["temps composés (passé composé, plus-que-parfait, futur antérieur)", "subjonctif (présent et passé)", "conditionnel (présent et passé)", "concordance des temps", "francophonie", "discours direct/indirect", "pronoms relatifs (qui, que, dont, où)", "pronoms COD/COI", "accord du participe passé"],
        examplePromptStyle: "Provide questions in French. Use: 'Décrivez votre meilleur ami.', 'Comparez la vie à la campagne et à la ville.', 'À votre avis, quel est le rôle de la famille dans la société moderne?', 'Imaginez que vous écriviez à votre correspondant français...'",
        commonMistakes: "(1) Wrong gender for nouns; (2) Confusion être/avoir with passé composé; (3) Missing accord with reflexive verbs; (4) Anglicism in vocabulary; (5) Using tu when vous is required; (6) Limited use of subjunctive when context requires it.",
        topicCoverage: "Three prescribed sub-themes (chosen by school): The individual, The French-speaking world, The world around us.",
    },

    "Japanese (Second Language)": {
        mathHeavy: false,
        examFormat: "Oral exam: 10 min (50 marks). Written exam: 2 hours, 75 marks. SACs Unit 3 + 4 (25%).",
        markConventions: "Kanji accuracy and range matter. Particle accuracy (は vs が, を, に, で) is critical. Honorific/humble forms expected in formal contexts. Higher marks for complex sentence patterns (て-form, conditional, passive, causative).",
        keyTerms: ["hiragana", "katakana", "kanji", "particle (は, が, を, に, で, と, から, まで, へ, の, も)", "te-form", "potential form", "conditional (たら, ば, と, なら)", "passive (受身)", "causative (使役)", "honorific (尊敬語) and humble (謙譲語) forms", "polite vs plain form (です/ます vs だ/る)"],
        examplePromptStyle: "Provide prompts in Japanese with English translation. 'あなたの趣味について話してください。' (Tell me about your hobby.) Cultural references to Japanese seasonal events, etiquette, history.",
        commonMistakes: "(1) Wrong particle (especially は vs が); (2) Mismatched register (mixing polite and plain); (3) Wrong kanji or stroke order; (4) Unnatural word order from English thinking; (5) Wrong counter for objects.",
        topicCoverage: "Three prescribed sub-themes covering Japanese language, culture, and contemporary society.",
    },

    "Chinese (Second Language)": {
        mathHeavy: false,
        examFormat: "Oral exam: 10 min (50 marks). Written exam: 2 hours, 75 marks. SACs Unit 3 + 4 (25%).",
        markConventions: "Characters must be written correctly with proper stroke order in handwritten exam. Tones critical in oral. Higher marks for complex grammar (把-construction, 被-passive, complement structures).",
        keyTerms: ["pinyin", "tone (1-4 + neutral)", "measure word (量词)", "把 construction", "被 passive", "complement (potential, directional, resultative)", "aspect particle (了, 着, 过)", "modal particles (吗, 呢, 吧)"],
        examplePromptStyle: "Provide questions in Chinese. '请介绍你的家庭。' (Please introduce your family.) Cultural references to Chinese festivals, regional differences, modern life.",
        commonMistakes: "(1) Wrong measure word; (2) 了 placement and meaning (perfective vs change of state); (3) Wrong tones in oral; (4) Mixing simplified and traditional characters; (5) Word-for-word translation from English.",
        topicCoverage: "Three prescribed sub-themes covering Chinese language, culture, and society.",
    },

    // ╔══ DEFAULT ═══════════════════════════════════════════════════════════╗

    "_default": {
        mathHeavy: false,
        examFormat: "End-of-year written exam (typically 2 hours). SACs across Unit 3 and Unit 4. Most subjects split: SACs 50% / Exam 50% (sciences and English). Folio-based subjects vary.",
        markConventions: "1 mark per piece of correct evidence/reasoning. Always justify with relevant detail or example. Use subject-specific terminology. Show all working where calculations are involved.",
        keyTerms: [],
        examplePromptStyle: "Use VCAA command terms (Describe, Explain, Analyse, Compare, Justify, Evaluate, Outline, Discuss). Be specific about scope and context. Refer to set texts, case studies, or examples where relevant.",
        commonMistakes: "Generic responses without specific evidence; failing to address the verb of the question; missing application step (theory without context).",
        topicCoverage: "Refer to current VCAA Study Design.",
    },
};

/**
 * Build the subject-specific examiner prompt block. Injects this at the top of
 * any AI tool prompt to force VCAA-aligned output.
 */
export function getExaminerPrompt(subjectName) {
    const profile = PROFILES[subjectName] || PROFILES._default;
    const sections = [
        VCAA_FRAMING,
        `\nSUBJECT: ${subjectName}`,
        profile.examFormat ? `\nEXAM FORMAT: ${profile.examFormat}` : "",
        profile.markConventions ? `\nMARK ALLOCATION CONVENTIONS: ${profile.markConventions}` : "",
        profile.topicCoverage ? `\nTOPIC COVERAGE: ${profile.topicCoverage}` : "",
        profile.keyTerms?.length ? `\nKEY VCAA TERMINOLOGY (use these accurately): ${profile.keyTerms.join(", ")}` : "",
        profile.examplePromptStyle ? `\nQUESTION STYLE: ${profile.examplePromptStyle}` : "",
        profile.commonMistakes ? `\nCOMMON STUDENT ERRORS TO AVOID/CALL OUT: ${profile.commonMistakes}` : "",
        `\n${COMMAND_TERMS}`,
        profile.mathHeavy ? `\n${SHARED_LATEX_RULES}` : "",
    ].filter(Boolean);
    return sections.join("\n");
}

/** True if this subject typically uses heavy mathematical notation. */
export function subjectIsMathHeavy(subjectName) {
    return !!(PROFILES[subjectName]?.mathHeavy);
}

/**
 * Standalone LaTeX formatting rules. Inject into any AI prompt that MIGHT
 * produce mathematical notation, even without subject context.
 */
export function getLatexRules() {
    return SHARED_LATEX_RULES;
}

/** All subjects with explicit examiner profiles (for sanity checks/admin). */
export function getProfiledSubjects() {
    return Object.keys(PROFILES).filter(k => k !== "_default");
}

export default { getExaminerPrompt, subjectIsMathHeavy, getLatexRules, getProfiledSubjects };
