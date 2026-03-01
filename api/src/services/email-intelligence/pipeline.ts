import { RawEmail, EnrichedEmail } from "./types";
import { normalizeEmail } from "./extractContent";
import { summarizeEmail } from "./summarize";

export async function processEmails(
  rawEmails: RawEmail[]
): Promise<EnrichedEmail[]> {
  const normalized = rawEmails.map(normalizeEmail);

  const enriched = await Promise.all(
    normalized.map(async (email) => {
      const { summary, importanceScore } = await summarizeEmail(
        email.subject,
        email.text
      );

      return {
        ...email,
        summary,
        importanceScore,
      };
    })
  );

  // Sort by importance DESC
  enriched.sort((a, b) => b.importanceScore - a.importanceScore);

  return enriched;
}