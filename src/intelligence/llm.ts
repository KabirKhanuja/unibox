import type { EmailSummarizer, LlmConfig } from "../types.js";
import { createGroqSummarizer } from "./groq.js";

// this file provides a generic llm summarizer that can work with multiple providers 
// like openai, gemini and groq

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

  throw new Error("LLM returned invalid JSON");
}

function clampScore(n: unknown) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 5;
  return Math.min(10, Math.max(1, x));
}

// createLlm is a general summarizer  that can work with the following llm providers
export function createLlmSummarizer(llm: LlmConfig): EmailSummarizer {
  if (!llm?.apiKey) {
    throw new Error("intelligence.llm.apiKey is required");
  }

  if (llm.provider === "groq") {
    return createGroqSummarizer({ apiKey: llm.apiKey, model: llm.model });
  }

  if (llm.provider === "openai") {
    const baseUrl = (llm.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const model = llm.model ?? "gpt-4.1-mini";

    return async (subject: string, text: string) => {
      const truncatedText = text.slice(0, 4000);
      const prompt =
        "Return ONLY valid JSON in this exact format: {\"summary\":\"...\", \"importanceScore\": number}.\n" +
        "ImportanceScore must be 1-10.\n" +
        `Subject: ${subject}\nBody: ${truncatedText}`;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${llm.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`OpenAI-compatible LLM request failed (${res.status}): ${body}`);
      }

      const data: any = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new Error("Empty LLM response");
      }

      const parsed = extractJson(content);
      if (typeof parsed.summary !== "string") throw new Error("LLM JSON missing summary");

      return {
        summary: parsed.summary,
        importanceScore: clampScore(parsed.importanceScore),
      };
    };
  }

  if (llm.provider === "gemini") {
    const model = llm.model ?? "gemini-1.5-flash";

    return async (subject: string, text: string) => {
      const truncatedText = text.slice(0, 4000);
      const prompt =
        "Return ONLY valid JSON in this exact format: {\"summary\":\"...\", \"importanceScore\": number}.\n" +
        "ImportanceScore must be 1-10.\n" +
        `Subject: ${subject}\nBody: ${truncatedText}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(llm.apiKey)}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Gemini request failed (${res.status}): ${body}`);
      }

      const data: any = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof content !== "string" || !content.trim()) {
        throw new Error("Empty Gemini response");
      }

      const parsed = extractJson(content);
      if (typeof parsed.summary !== "string") throw new Error("Gemini JSON missing summary");

      return {
        summary: parsed.summary,
        importanceScore: clampScore(parsed.importanceScore),
      };
    };
  }

  // check
  const provider: never = llm.provider;
  throw new Error(`Unsupported LLM provider: ${provider}`);
}
