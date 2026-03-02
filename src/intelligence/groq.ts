import axios from "axios";
import type { EmailSummarizer } from "../types.js";

// we implemented a custom wrapper to handle their unique response format 
// and ensure robust json parsing

export type GroqSummarizerOptions = {
  apiKey: string;
  model?: string;
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.1-8b-instant";

function extractJson(text: string): any {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  throw new Error("Groq returned invalid JSON");
}

// this groq summarizer is designed to work with the groq api
// it's a template for users who want to use groq without implementing their own wrapper
// otherwise checkout llm.ts which has a more generic summarizer 

export function createGroqSummarizer(opts: GroqSummarizerOptions): EmailSummarizer {
  const model = opts.model ?? DEFAULT_MODEL;

  return async (subject: string, text: string) => {
    const truncatedText = text.slice(0, 4000);

    const prompt = `
You are an email assistant.

Summarize the following email concisely (1–2 sentences) and assign an importance score from 1 to 10.

Return ONLY valid JSON in this exact format:
{"summary":"...", "importanceScore": number}

Scoring rules:
- 1–3: spam, ads, newsletters
- 4–5: notifications, updates
- 6–7: work, meetings, assignments
- 8–10: urgent, deadlines, critical

Subject: ${subject}
Body: ${truncatedText}
`;

    const res = await axios.post(
      GROQ_API_URL,
      {
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = res.data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty Groq response");
    }

    const parsed = extractJson(content);

    if (typeof parsed.summary !== "string" || typeof parsed.importanceScore !== "number") {
      throw new Error("Groq JSON missing required fields");
    }

    return {
      summary: parsed.summary,
      importanceScore: Math.min(10, Math.max(1, parsed.importanceScore)),
    };
  };
}
