import { RawEmail, NormalizedEmail } from "./types";

export function normalizeEmail(email: RawEmail): NormalizedEmail {
  const text =
    email.body && email.body.trim().length > 0
      ? email.body
      : email.snippet ?? "";

  return {
    id: email.id,
    subject: email.subject,
    from: email.from,
    date: email.date,
    text,
    permalink: email.permalink,
  };
}