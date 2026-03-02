import type { NormalizedEmail, UnifiedEmail } from "../types.js";

export function normalizeEmail(email: UnifiedEmail): NormalizedEmail {
  const text =
    typeof email.body === "string" && email.body.trim().length > 0
      ? email.body
      : email.snippet ?? "";

  return {
    id: email.id,
    subject: email.subject,
    from: email.from,
    date: email.date,
    text,
    permalink: email.permalink,
    provider: email.provider,
    mailboxEmail: email.mailboxEmail,
  };
}
