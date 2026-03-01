let gmailTokens: any = null;

export function saveGmailTokens(tokens: any) {
  gmailTokens = tokens;
}

export function getGmailTokens() {
  if (!gmailTokens) {
    throw new Error("Gmail not authenticated");
  }
  return gmailTokens;
}

type ZohoTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  api_domain?: string;
};

const zohoTokenStore = new Map<string, ZohoTokens>();

export function saveZohoTokens(email: string, tokens: ZohoTokens) {
  zohoTokenStore.set(email, tokens);
}

export function getZohoTokens(email: string): ZohoTokens {
  const tokens = zohoTokenStore.get(email);

  if (!tokens) {
    throw new Error("Zoho not authenticated");
  }

  return tokens;
}