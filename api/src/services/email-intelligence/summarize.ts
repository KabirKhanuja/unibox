import axios from "axios";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";

function extractJson(text: string): any {

  // for removing the markdown formatting
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // for direct parsing
  try {
    return JSON.parse(cleaned);
  } catch {}

  //to extract json object directly 
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  throw new Error("Groq returned invalid JSON");
}

export async function summarizeEmail(
  subject: string,
  text: string
): Promise<{ summary: string; importanceScore: number }> {
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
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const content = res.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty Groq response");
  }

  const parsed = extractJson(content);

  if (
    typeof parsed.summary !== "string" ||
    typeof parsed.importanceScore !== "number"
  ) {
    throw new Error("Groq JSON missing required fields");
  }

  return {
    summary: parsed.summary,
    importanceScore: Math.min(10, Math.max(1, parsed.importanceScore)),
  };
}