import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import heicConvert from "heic-convert";
import mammoth from "mammoth";
import JSZip from "jszip";

// dotenv looks for .env by default; explicitly load .env.local too.
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local", override: true });

const PORT = Number(process.env.LOCAL_AI_PORT || 3001);
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "[local-ai] ANTHROPIC_API_KEY is not set. Add it to .env.local and restart.",
  );
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Same prompt-injection patterns the original Base44 invokeAI used.
const THREAT_PATTERNS = [
  /ignore\s+(previous|prior|all)\s+instructions?/i,
  /forget\s+(previous|prior|all|your)\s+instructions?/i,
  /pretend\s+(you\s+have\s+no\s+rules|you\s+are\s+|to\s+be\s+)/i,
  /act\s+as\s+(dan|jailbreak|a\s+different|an?\s+unrestricted|an?\s+unfiltered)/i,
  /you\s+are\s+now\s+(dan|a\s+different\s+ai|free|unrestricted)/i,
  /do\s+anything\s+now/i,
  /jailbreak/i,
  /\bdan\b.*\bmode\b/i,
  /override\s+(your\s+)?(system|safety|security|content)\s+(prompt|instructions?|rules?|filter)/i,
  /bypass\s+(your\s+)?(safety|security|content|filter|restrict)/i,
  /disable\s+(your\s+)?(safety|security|content|filter|restrict)/i,
  /api[\s_-]?key/i,
  /system\s+prompt/i,
  /reveal\s+(your\s+)?(instructions?|prompt|rules?|config)/i,
  /show\s+(me\s+)?(your\s+)?(system\s+)?(prompt|instructions?|rules?)/i,
  /print\s+(your\s+)?(system\s+)?(prompt|instructions?)/i,
];

function detectThreat(text) {
  if (!text || typeof text !== "string") return false;
  return THREAT_PATTERNS.some((p) => p.test(text));
}

// Mirror of VCE_EXPERT_SYSTEM_PROMPT from src/components/shared/vceExpertPrompt.jsx.
// When the client prompt starts with this, we hoist it to a cached system block.
const VCE_EXPERT_SYSTEM_PROMPT = `You are the "AcedIt VCE Expert," a specialized AI tutor designed exclusively for the Victorian Certificate of Education (VCE) curriculum. Your primary goal is to assist students in achieving high Study Scores by enforcing VCAA (Victorian Curriculum and Assessment Authority) standards.

CRITICAL: You must strictly apply the VCAA Glossary of Command Terms in all interactions:

- IDENTIFY/STATE: Brief name or fact only
- DESCRIBE/OUTLINE: Detailed account of features and characteristics
- EXPLAIN: Cause-and-effect links using phrases like "This leads to... because..."
- COMPARE: Identify both similarities AND differences
- EVALUATE/DISCUSS: Provide balanced argument of pros/cons with a concluding judgment
- JUSTIFY: Provide evidence to support a choice

When generating questions or marking student work, if a student provides a correct fact but misses the specific link required by the command term, you MUST explain exactly why they would lose marks in a real VCAA exam.

ENGLISH MENTOR MODE (2024-2027 VCE English Study Design):
- Section A: Focus on authorial intent and thematic analysis
- Section B: Focus on "Framework of Ideas" and mentor text links
- Section C: Focus on "What, How, Why" of persuasive techniques and tone shifts
- Always suggest high-level metalanguage (e.g., "juxtaposition," "appeals to authority," "subtext")

TONE: Professional, academic, yet encouraging. Use VCE-specific terminology like "Study Design," "AOS," "SAC prep," and "VCAA Exam Reports."

NEVER give general advice; always ensure advice is applicable to the specific requirements of the Victorian curriculum.

CRITICAL MATH FORMATTING RULES — ALWAYS FOLLOW:
- ALWAYS use LaTeX notation for every mathematical expression, equation, formula, fraction, integral, derivative, matrix, vector, or symbol.
- Use inline delimiters \\( and \\) for inline expressions — e.g. \\( f(x) = 3x - 4 \\)
- Use display delimiters \\[ and \\] for standalone/block expressions — e.g. \\[ \\int_0^1 x^2 \\, dx \\]
- NEVER write maths in plain text format. This applies to every part of your response: questions, explanations, model answers, options, marking criteria, and feedback.
- Examples of correct formatting:
  * Fractions: \\( \\frac{3}{4} \\) or \\( \\frac{x+1}{x-2} \\)
  * Exponents: \\( x^2 \\), \\( e^{2x} \\), \\( 10^3 \\)
  * Square roots: \\( \\sqrt{x} \\)
  * Integrals: \\[ \\int_0^1 x^2 \\, dx \\]
  * Derivatives: \\( \\frac{d}{dx} f(x) \\) or \\( f'(x) \\)
  * Greek letters: \\( \\theta \\), \\( \\pi \\), \\( \\delta \\), \\( \\lambda \\)
  * Vectors/matrices: \\( \\vec{v} \\), \\( \\begin{pmatrix} a \\\\ b \\end{pmatrix} \\)`;

// If the prompt is the VCE-expert prompt + "\n\n" + user content, split them
// so we can cache the long system prompt across requests (~90% cheaper after first hit).
function splitSystemAndUser(prompt) {
  if (typeof prompt !== "string") return { system: null, user: String(prompt ?? "") };
  const prefix = VCE_EXPERT_SYSTEM_PROMPT + "\n\n";
  if (prompt.startsWith(prefix)) {
    return { system: VCE_EXPERT_SYSTEM_PROMPT, user: prompt.slice(prefix.length) };
  }
  return { system: null, user: prompt };
}

// In-memory file store for uploads. Keyed by UUID, value is {buffer, mimeType, originalName}.
// Files live for the lifetime of the server process — fine for dev. For production
// we'd swap this for real storage (Supabase Storage, S3, etc.).
const fileStore = new Map();

// Cap memory: keep at most 50 files; evict oldest first.
const MAX_FILES = 50;
function storeFile(buffer, mimeType, originalName) {
  if (fileStore.size >= MAX_FILES) {
    const oldestKey = fileStore.keys().next().value;
    if (oldestKey) fileStore.delete(oldestKey);
  }
  const id = randomUUID();
  fileStore.set(id, { buffer, mimeType, originalName, uploadedAt: Date.now() });
  return id;
}

// Anthropic only accepts these image media types. HEIC (iPhone default) needs
// transcoding to JPEG before Claude will read it.
const CLAUDE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

async function convertFileForClaude(file) {
  const mt = file.mimeType || "application/octet-stream";

  // HEIC / HEIF → JPEG.
  if (mt === "image/heic" || mt === "image/heif") {
    const jpegBuffer = await heicConvert({ buffer: file.buffer, format: "JPEG", quality: 0.92 });
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: Buffer.from(jpegBuffer).toString("base64"),
      },
    };
  }

  // Native Claude-compatible images.
  if (CLAUDE_IMAGE_TYPES.has(mt)) {
    return {
      type: "image",
      source: { type: "base64", media_type: mt, data: file.buffer.toString("base64") },
    };
  }

  // PDFs — Claude reads natively.
  if (mt === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: file.buffer.toString("base64") },
    };
  }

  // DOCX → extract text via mammoth, embed as plain text. Loses formatting but
  // gives Claude the actual content to read.
  if (mt === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    console.log(`[local-ai] extracting DOCX text from ${file.originalName} (${file.buffer.length} bytes)`);
    const { value: text } = await mammoth.extractRawText({ buffer: file.buffer });
    console.log(`[local-ai] DOCX extracted: ${text.length} chars`);
    return {
      type: "text",
      text: `Contents of file "${file.originalName}":\n\n${text}`,
    };
  }

  // Plain text → just include directly.
  if (mt.startsWith("text/")) {
    return {
      type: "text",
      text: `Contents of file "${file.originalName}":\n\n${file.buffer.toString("utf8")}`,
    };
  }

  console.warn(`[local-ai] unsupported file type for Claude: ${mt} (${file.originalName})`);
  return null;
}

// Convert file_urls → Anthropic content blocks. Three URL shapes are supported:
//   1. local-file://<uuid>  — file we just uploaded; pulled from in-memory store
//   2. https://...pdf       — pass through as document URL source
//   3. https://...           — pass through as image URL source
async function buildFileContentBlocks(fileUrls) {
  if (!Array.isArray(fileUrls) || fileUrls.length === 0) return [];
  const blocks = await Promise.all(
    fileUrls
      .filter((u) => typeof u === "string" && u.length > 0)
      .map(async (url) => {
        // Local upload — base64-encode the cached bytes (transcoding if needed).
        if (url.startsWith("local-file://")) {
          const id = url.slice("local-file://".length);
          const file = fileStore.get(id);
          if (!file) {
            console.warn(`[local-ai] missing local file for ${url}`);
            return null;
          }
          try {
            return await convertFileForClaude(file);
          } catch (err) {
            console.error(`[local-ai] file conversion failed for ${file.originalName}:`, err);
            return null;
          }
        }

        // External URL — Claude fetches it directly.
        const lower = url.toLowerCase();
        if (lower.endsWith(".pdf")) {
          return { type: "document", source: { type: "url", url } };
        }
        return { type: "image", source: { type: "url", url } };
      }),
  );
  return blocks.filter(Boolean);
}

// Anthropic structured outputs require `additionalProperties: false` on every
// object schema. Walk the schema tree and add it where missing. Also recurse
// into properties / items / anyOf / oneOf / allOf so nested schemas comply.
function sanitizeSchemaForAnthropic(schema) {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeSchemaForAnthropic);

  const out = { ...schema };
  if (out.type === "object") {
    if (!("additionalProperties" in out)) {
      out.additionalProperties = false;
    }
    if (out.properties && typeof out.properties === "object") {
      out.properties = Object.fromEntries(
        Object.entries(out.properties).map(([k, v]) => [k, sanitizeSchemaForAnthropic(v)]),
      );
    }
  }
  if (out.items) out.items = sanitizeSchemaForAnthropic(out.items);
  if (out.anyOf) out.anyOf = out.anyOf.map(sanitizeSchemaForAnthropic);
  if (out.oneOf) out.oneOf = out.oneOf.map(sanitizeSchemaForAnthropic);
  if (out.allOf) out.allOf = out.allOf.map(sanitizeSchemaForAnthropic);
  return out;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

// Mirrors Base44's Core/UploadFile integration. The Base44 SDK sends
// multipart/form-data with the file under whatever field name the caller
// chose (usually "file"). We accept any field, stash the bytes, and return
// the same response shape Base44 returns: { file_url: "..." }.
//
// The returned URL uses our `local-file://` scheme so we can recognize it
// later in InvokeLLM and serve the cached bytes inline as base64.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});
// Mirrors Base44's `extractDocumentText` server function. Quizzes calls this
// for DOCX/PPTX files (it asks Base44 to convert them to text before passing
// the text into the AI prompt). Original function fetches the file_url; we
// just look up the file from our in-memory store.
app.post("/local-ai/extractDocumentText", async (req, res) => {
  try {
    const { file_url, file_extension } = req.body || {};
    if (!file_url) return res.status(400).json({ error: "file_url is required" });
    if (!file_url.startsWith("local-file://")) {
      return res.status(400).json({ error: "Only local-file:// URLs are supported by the local server" });
    }

    const id = file_url.slice("local-file://".length);
    const file = fileStore.get(id);
    if (!file) return res.status(404).json({ error: "File not found in local store" });

    // Prefer explicit file_extension param; fall back to mime-based detection.
    const ext =
      (file_extension || "").toLowerCase() ||
      (file.mimeType?.includes("wordprocessingml") ? "docx" :
       file.mimeType?.includes("presentationml") ? "pptx" :
       file.mimeType === "text/plain" ? "txt" : "");

    let text = "";
    if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      text = result.value;
    } else if (ext === "pptx") {
      const zip = await JSZip.loadAsync(file.buffer);
      const slideFiles = Object.keys(zip.files)
        .filter((name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"))
        .sort();
      const slideTexts = [];
      for (const slidePath of slideFiles) {
        const slideXml = await zip.files[slidePath].async("text");
        const matches = slideXml.match(/<a:t>([^<]+)<\/a:t>/g) || [];
        const slideText = matches.map((m) => m.replace(/<\/?a:t>/g, "")).join(" ");
        if (slideText.trim()) slideTexts.push(slideText.trim());
      }
      text = slideTexts.join("\n\n");
    } else if (ext === "txt") {
      text = file.buffer.toString("utf8");
    } else if (ext === "pdf") {
      return res.status(400).json({ error: "PDF files should be processed directly by the AI" });
    } else if (ext === "doc" || ext === "ppt") {
      return res.status(400).json({ error: `${ext.toUpperCase()} files are not supported. Convert to ${ext}x or PDF first.` });
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    console.log(`[local-ai] extracted ${text.length} chars from ${file.originalName} (${ext})`);
    return res.json({ text });
  } catch (err) {
    console.error("[local-ai] extractDocumentText error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

app.post("/local-ai/uploadFile", upload.any(), (req, res) => {
  try {
    const file = req.files?.[0];
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const id = storeFile(file.buffer, file.mimetype, file.originalname);
    console.log(
      `[local-ai] upload: ${file.originalname} (${file.size} bytes, ${file.mimetype}) -> local-file://${id}`,
    );
    return res.json({ file_url: `local-file://${id}` });
  } catch (err) {
    console.error("[local-ai] upload error:", err);
    return res.status(500).json({ message: err?.message || String(err) });
  }
});

app.post("/local-ai/invokeAI", async (req, res) => {
  console.log(`[local-ai] invokeAI received (file_urls=${(req.body?.file_urls || []).length}, has_schema=${!!req.body?.response_json_schema})`);
  try {
    const params = req.body || {};
    const promptText =
      typeof params.prompt === "string" ? params.prompt : JSON.stringify(params.prompt ?? "");

    if (detectThreat(promptText)) {
      return res.status(403).json({
        message:
          "🚫 This request has been flagged as potentially malicious and cannot be processed. If you believe this is an error, please contact support.",
      });
    }

    const { system, user } = splitSystemAndUser(promptText);
    const fileBlocks = await buildFileContentBlocks(params.file_urls);

    // Compose the user message: any image/PDF blocks first, then the text.
    const userContent = [
      ...fileBlocks,
      { type: "text", text: user },
    ];

    // Build the request. Cache the VCE expert system prompt when present.
    const request = {
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: "user", content: userContent }],
    };

    if (system) {
      request.system = [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" },
        },
      ];
    }

    // Optional: web search when the caller asks for fresh internet context.
    if (params.add_context_from_internet) {
      request.tools = [
        { type: "web_search_20260209", name: "web_search", max_uses: 5 },
      ];
    }

    // Structured output via JSON schema when the caller passes one.
    if (params.response_json_schema && typeof params.response_json_schema === "object") {
      request.output_config = {
        format: {
          type: "json_schema",
          schema: sanitizeSchemaForAnthropic(params.response_json_schema),
        },
      };
    }

    // Use streaming internally to avoid HTTP timeouts on long generations
    // (large PDFs, big essays, etc.). We still return a single JSON response
    // to the caller — the streaming is purely for connection-level reliability.
    const stream = anthropic.messages.stream(request);
    const response = await stream.finalMessage();

    // Concatenate text blocks (Claude may emit multiple).
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // If structured output was requested, parse and return the object.
    let result;
    if (params.response_json_schema) {
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error("[local-ai] Failed to parse JSON response:", text.slice(0, 500));
        result = text;
      }
    } else {
      result = text;
    }

    if (response.usage) {
      console.log(
        `[local-ai] in=${response.usage.input_tokens} cache_read=${response.usage.cache_read_input_tokens ?? 0} cache_write=${response.usage.cache_creation_input_tokens ?? 0} out=${response.usage.output_tokens}`,
      );
    }

    // Base44's HTTP integration endpoint returns the bare result (string for
    // text prompts, object for response_json_schema). The SDK's axios
    // interceptor returns `response.data` to the caller, so what we send here
    // becomes what the AI tool sees directly.
    return res.json(result);
  } catch (err) {
    console.error("[local-ai] error:", err);
    const message = err?.message || String(err);
    // SDK's error interceptor reads error.response.data.message — give it that
    // shape so AI tools see a useful message.
    return res.status(500).json({ message });
  }
});

app.listen(PORT, () => {
  console.log(`[local-ai] listening on http://localhost:${PORT} (model: ${MODEL})`);
});
