/**
 * chatActions — follow-up actions offered under an assistant reply.
 *
 * Not everything the old standalone tools did was a *render*. Several of them
 * ended by writing something into the rest of the app: the Concept Explainer
 * and Teach It Back turned a session into a real Quiz, the Note Summariser
 * turned notes into real Flashcards for Spaced Repetition. Those survived the
 * move to one chatbot only as text that looked like a quiz.
 *
 * Each action makes ONE non-streaming schema call over the conversation so far,
 * then writes real entities. Kept separate from chatTools.js so that file stays
 * pure persona config with no entity access.
 */
import { base44 } from "@/api/base44Client";

const MAX_CHARS = 8000;

const transcript = (messages) =>
    messages
        .map((m) => `${m.role === "user" ? "Student" : "AI"}: ${m.content}`)
        .join("\n\n")
        .slice(-MAX_CHARS);

export const CHAT_ACTIONS = {
    // ── Concept Explainer / Teach It Back — session becomes a real quiz ──────
    make_quiz: {
        label: "Make a quiz from this",
        busy: "Building your quiz…",
        feature: "ai_tool",
        schema: {
            type: "object",
            properties: {
                title: { type: "string" },
                questions: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["mcq", "short_answer"] },
                            question: { type: "string" },
                            options: { type: "array", items: { type: "string" } },
                            correct_answer: { type: "number" },
                            model_answer: { type: "string" },
                            marks: { type: "number" },
                            explanation: { type: "string" },
                        },
                        required: ["type", "question"],
                    },
                },
            },
            required: ["questions"],
        },
        prompt: (messages, subject) => `From the study session below, write 5 questions that test whether the student actually understood it${subject ? ` (VCE ${subject})` : ""}.

Mix multiple choice and short answer. For MCQ give 4 options and the zero-based index of the correct one. For short answer give a model answer and a mark allocation. Every question gets a one-line explanation. Test understanding, not recall of the exact wording used.

Also return a short "title" for the quiz.

SESSION:
${transcript(messages)}`,
        apply: async (res, { subject }) => {
            const cleaned = (res.questions || []).map((q) =>
                q.type === "mcq"
                    ? { type: "mcq", question: q.question, options: q.options || [], correct_answer: q.correct_answer ?? 0, explanation: q.explanation }
                    : { type: "short_answer", question: q.question, model_answer: q.model_answer, marks: q.marks, explanation: q.explanation },
            );
            if (!cleaned.length) throw new Error("No questions came back.");
            await base44.entities.Quiz.create({
                title: res.title || `${subject || "VCE"} — quiz`,
                subject,
                questions: cleaned,
                difficulty: "intermediate",
                category: "subject_content",
            });
            return { title: "Quiz created", description: "Find it on your Quizzes page." };
        },
    },

    // ── Note Summariser — recall pairs become real flashcards ───────────────
    make_flashcards: {
        label: "Save as flashcards",
        busy: "Creating flashcards…",
        feature: "ai_tool",
        schema: {
            type: "object",
            properties: {
                topic: { type: "string" },
                flashcards: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: { question: { type: "string" }, answer: { type: "string" } },
                        required: ["question", "answer"],
                    },
                },
            },
            required: ["flashcards"],
        },
        prompt: (messages, subject) => `Turn the material below into flashcards for spaced repetition${subject ? ` (VCE ${subject})` : ""}.

One idea per card. Questions short and specific — never "explain X" where X is a whole topic. Answers tight enough to check yourself against in a couple of seconds. Keep any LaTeX intact.

Also return a short "topic" label for the deck.

MATERIAL:
${transcript(messages)}`,
        apply: async (res, { subject }) => {
            const cards = (res.flashcards || []).filter((c) => c.question && c.answer);
            if (!cards.length) throw new Error("No cards came back.");
            await Promise.all(cards.map((fc) =>
                base44.entities.Flashcard.create({
                    subject_name: subject,
                    topic: res.topic || "From chat",
                    question: fc.question,
                    answer: fc.answer,
                    unit: "General",
                }),
            ));
            return { title: `${cards.length} flashcards created`, description: "Find them in Spaced Repetition." };
        },
    },
};

export const actionById = (id) => CHAT_ACTIONS[id] || null;
