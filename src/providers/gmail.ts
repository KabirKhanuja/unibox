import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import type { GmailTokenRecord, UnifiedEmail } from "../types.js";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

export type GmailProviderConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

// gmail uses oauth2 client from google auth library 
// it gets refresh tokens on inital auth 
// need to configure through google cloud console for every user manually

function createOAuthClient(cfg: GmailProviderConfig) {
  return new OAuth2Client(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

export function getGmailAuthUrl(cfg: GmailProviderConfig) {
  return createOAuthClient(cfg).generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
  });
}

export async function exchangeGmailCode(cfg: GmailProviderConfig, code: string) {
  const client = createOAuthClient(cfg);
  const { tokens } = await client.getToken(code);

  if (!tokens.id_token) {
    throw new Error("Missing id_token");
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: cfg.clientId,
  });

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new Error("Email not found in ID token");
  }

  return {
    email: payload.email,
    tokens,
  };
}

export async function refreshGmailAccessToken(cfg: GmailProviderConfig, refreshToken: string) {
  const client = createOAuthClient(cfg);
  client.setCredentials({ refresh_token: refreshToken });

  // google auth library still exposes this method
  // tho types may mark it deprecated
  const { credentials } = await client.refreshAccessToken();

  return {
    accessToken: credentials.access_token!,
    expiryDate: credentials.expiry_date ?? undefined,
  };
}

function isExpired(tokens: GmailTokenRecord) {
  return typeof tokens.expiryDate === "number" && Date.now() >= tokens.expiryDate - 60_000;
}

export async function getValidGmailAccessToken(cfg: GmailProviderConfig, tokens: GmailTokenRecord) {
  if (!isExpired(tokens)) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    throw new Error("Gmail access token expired and no refreshToken is available");
  }

  const refreshed = await refreshGmailAccessToken(cfg, tokens.refreshToken);
  return refreshed.accessToken;
}

export async function fetchUnreadGmail(accessToken: string, opts?: { maxResults?: number }) {
  const listRes = await axios.get(`${GMAIL_API_BASE}/users/me/messages`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    params: {
      q: "is:unread",
      maxResults: opts?.maxResults ?? 10,
    },
  });

  const messages = listRes.data.messages || [];

  const detailedEmails = await Promise.all(
    messages.map(async (msg: { id: string }) => {
      const msgRes = await axios.get(`${GMAIL_API_BASE}/users/me/messages/${msg.id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = msgRes.data.payload;
      const headers = payload.headers;

      const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || "";

      return {
        id: msg.id,
        from: getHeader("From"),
        subject: getHeader("Subject"),
        snippet: msgRes.data.snippet,
        internalDate: msgRes.data.internalDate,
      };
    })
  );

  return detailedEmails as Array<{
    id: string;
    from: string;
    subject: string;
    snippet?: string;
    internalDate?: string;
  }>;
}

export function normalizeGmailEmails(params: {
  mailboxEmail: string;
  emails: Array<{ id: string; from: string; subject: string; snippet?: string; internalDate?: string }>;
}): UnifiedEmail[] {
  return params.emails.map((e) => {
    const ts = typeof e.internalDate === "string" ? Number(e.internalDate) : NaN;
    const date = Number.isFinite(ts) ? new Date(ts).toISOString() : "";

    return {
      provider: "gmail",
      mailboxEmail: params.mailboxEmail,
      id: e.id,
      subject: e.subject,
      from: e.from,
      date,
      snippet: e.snippet,
    };
  });
}
