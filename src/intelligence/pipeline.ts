import type { EmailSummarizer, EnrichedEmail, UnifiedEmail } from "../types.js";
import { normalizeEmail } from "./normalize.js";

export async function processEmails(
  emails: UnifiedEmail[],
  summarize: EmailSummarizer
): Promise<EnrichedEmail[]> {
  const normalized = emails.map(normalizeEmail);

  const enriched: EnrichedEmail[] = await Promise.all(
    normalized.map(async (email) => {
      const { summary, importanceScore } = await summarize(email.subject, email.text);
      return {
        ...email,
        summary,
        importanceScore,
      };
    })
  );

  enriched.sort((a: EnrichedEmail, b: EnrichedEmail) => b.importanceScore - a.importanceScore);
  return enriched;
}
