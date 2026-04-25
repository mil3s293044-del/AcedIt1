import { base44 } from "@/api/base44Client";

/**
 * Moderates user-generated content using AI to detect inappropriate profanity
 * while allowing contextually relevant content (e.g., academic discussions)
 * 
 * @param {string} content - The text content to moderate
 * @param {string} context - Additional context about where/how the content is used
 * @returns {Promise<{isAllowed: boolean, reason?: string}>}
 */
export const moderateContent = async (content, context = "") => {
    if (!content || typeof content !== 'string') {
        return { isAllowed: true };
    }

    // Quick check - if content is very short and doesn't contain common profanity patterns, skip API call
    const commonProfanityPatterns = /\b(fuck|shit|ass|bitch|damn|hell|cunt|cock|dick|pussy)\b/i;
    if (content.length < 20 && !commonProfanityPatterns.test(content)) {
        return { isAllowed: true };
    }

    try {
        const response = await base44.integrations.Core.InvokeLLM({
            prompt: `You are a content moderation system for an educational VCE study app used by Year 12 students.

**Content to moderate:**
"${content}"

**Context:** ${context || "General user input"}

**Your task:**
Determine if this content contains inappropriate profanity or offensive language.

**Important rules:**
1. ALLOW profanity if it's:
   - Part of an academic discussion (e.g., analyzing literature, historical quotes)
   - Medical/scientific terminology
   - Properly used in an educational context
   - Part of a direct quote for study purposes

2. BLOCK profanity if it's:
   - Used as insults or harassment
   - Gratuitous or unnecessary
   - Offensive slurs or hate speech
   - Not related to educational content

**Remember:** This is an educational environment. Be strict about inappropriate content but understanding of academic necessity.`,
            response_json_schema: {
                type: "object",
                properties: {
                    is_appropriate: { 
                        type: "boolean",
                        description: "true if content is appropriate, false if it should be blocked"
                    },
                    contains_profanity: { 
                        type: "boolean",
                        description: "true if any profanity is detected"
                    },
                    is_contextually_relevant: { 
                        type: "boolean",
                        description: "true if profanity is academically/contextually relevant"
                    },
                    reason: { 
                        type: "string",
                        description: "Brief explanation of the decision"
                    }
                },
                required: ["is_appropriate", "contains_profanity", "reason"]
            }
        });

        return {
            isAllowed: response.is_appropriate,
            reason: response.reason,
            details: {
                containsProfanity: response.contains_profanity,
                isContextuallyRelevant: response.is_contextually_relevant
            }
        };

    } catch (error) {
        console.error("Content moderation error:", error);
        // On error, allow content to avoid blocking legitimate users
        // but log the error for review
        return { 
            isAllowed: true,
            reason: "Moderation service unavailable" 
        };
    }
};

/**
 * Moderates multiple content fields at once
 * 
 * @param {Object} fields - Object with field names as keys and content as values
 * @param {string} context - Context for all fields
 * @returns {Promise<{isAllowed: boolean, blockedFields: string[], reason?: string}>}
 */
export const moderateMultipleFields = async (fields, context = "") => {
    const contentToCheck = Object.entries(fields)
        .filter(([_, value]) => value && typeof value === 'string')
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

    if (!contentToCheck) {
        return { isAllowed: true, blockedFields: [] };
    }

    const result = await moderateContent(contentToCheck, context);
    
    return {
        isAllowed: result.isAllowed,
        blockedFields: result.isAllowed ? [] : Object.keys(fields),
        reason: result.reason,
        details: result.details
    };
};

/**
 * Pre-configured moderation for common scenarios
 */
export const moderationPresets = {
    flashcard: (question, answer) => 
        moderateMultipleFields(
            { question, answer }, 
            "Flashcard for educational study purposes"
        ),
    
    quiz: (question, options, explanation) => 
        moderateMultipleFields(
            { question, options: JSON.stringify(options), explanation }, 
            "Quiz question for educational assessment"
        ),
    
    note: (content) => 
        moderateContent(content, "Student notes for academic study"),
    
    message: (message) => 
        moderateContent(message, "Message in study group chat"),
    
    goal: (title, description) => 
        moderateMultipleFields(
            { title, description }, 
            "Academic goal or objective"
        ),
    
    aiPrompt: (prompt) => 
        moderateContent(prompt, "Input for AI educational tool")
};