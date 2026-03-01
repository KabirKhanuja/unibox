type GmailTokenRecord = {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
};

const gmailTokenStore = new Map<string, GmailTokenRecord>();

export function saveGmailTokens(
  email: string,
  tokens: GmailTokenRecord
) {
  gmailTokenStore.set(email, tokens);
}

export function getGmailTokens(email: string) {
  return gmailTokenStore.get(email);
}