import axios from "axios";
import type { UnifiedEmail, ZohoRegion, ZohoTokenRecord } from "../types.js";

export type ZohoProviderConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const ZOHO_ACCOUNTS_BASES: Record<ZohoRegion, string> = {
  com: "https://accounts.zoho.com",
  in: "https://accounts.zoho.in",
  eu: "",
  "com.au": "",
  jp: "",
};

export function inferZohoRegionFromEmail(email: string): "in" | "com" {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain.endsWith(".in")) return "in";
  return "com";
}

export function getZohoMailBaseForEmail(email: string, overrides?: { mailBase?: string }) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain.endsWith(".in")) return "https://mail.zoho.in";
  return overrides?.mailBase ?? "https://mail.zoho.com";
}

function buildZohoAuthUrl(cfg: ZohoProviderConfig, base: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    scope: "ZohoMail.messages.READ ZohoMail.accounts.READ",
    redirect_uri: cfg.redirectUri,
    access_type: "offline",
    prompt: "consent",
  });

  return `${base}/oauth/v2/auth?${params.toString()}`;
}

export function getZohoAuthUrl(cfg: ZohoProviderConfig, region: ZohoRegion = "com") {
  return buildZohoAuthUrl(cfg, ZOHO_ACCOUNTS_BASES[region]);
}

export async function exchangeZohoCode(cfg: ZohoProviderConfig, code: string) {
  const bases: ZohoRegion[] = ["com", "in"];
  let lastError: unknown;

  for (const region of bases) {
    const base = ZOHO_ACCOUNTS_BASES[region];
    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.redirectUri,
        code,
      });

      const res = await axios.post(`${base}/oauth/v2/token`, body.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const data = res.data as any;
      if (data?.access_token) {
        return data as ZohoTokenRecord;
      }

      const errorDescription = data?.error_description ?? data?.error ?? "missing access_token";
      lastError = new Error(`Zoho token exchange failed for region ${region}: ${errorDescription}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Zoho token exchange failed for all regions");
}

export async function refreshZohoAccessToken(
  cfg: ZohoProviderConfig,
  refreshToken: string,
  region?: ZohoRegion
) {
  const bases: ZohoRegion[] = region ? [region] : ["com", "in"];
  let lastError: unknown;

  for (const r of bases) {
    const base = ZOHO_ACCOUNTS_BASES[r];
    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: refreshToken,
      });

      const res = await axios.post(`${base}/oauth/v2/token`, body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (res.data?.access_token) {
        return res.data as ZohoTokenRecord;
      }

      lastError = new Error(`Zoho refresh failed for region ${r}: ${res.data?.error_description ?? "unknown"}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Zoho refresh failed for all regions");
}

export async function fetchZohoAccountId(accessToken: string, mailBase: string) {
  const res = await axios.get(`${mailBase}/api/accounts`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  });

  const accountId = res.data?.data?.[0]?.accountId;
  if (!accountId) {
    throw new Error("Zoho accountId not found");
  }

  return String(accountId);
}

export async function fetchUnreadZohoEmails(accessToken: string, accountId: string, mailBase: string, opts?: { maxResults?: number }) {
  const res = await axios.get(`${mailBase}/api/accounts/${accountId}/messages/view`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    params: {
      status: "unread",
      limit: opts?.maxResults ?? 10,
    },
  });

  return (res.data?.data ?? []) as any[];
}

function isExpired(tokens: ZohoTokenRecord) {
  return typeof tokens.expires_at === "number" && Date.now() >= tokens.expires_at;
}

export async function getValidZohoAccessToken(params: {
  cfg: ZohoProviderConfig;
  email: string;
  tokens: ZohoTokenRecord;
}) {
  if (!isExpired(params.tokens)) return params.tokens.access_token;

  if (!params.tokens.refresh_token) {
    throw new Error(`Zoho access token expired and no refresh_token is available for ${params.email}`);
  }

  const refreshed = await refreshZohoAccessToken(params.cfg, params.tokens.refresh_token, params.tokens.region);
  return refreshed.access_token;
}

export function mergeZohoTokens(existing: ZohoTokenRecord | undefined, incoming: ZohoTokenRecord, region?: ZohoRegion): ZohoTokenRecord {
  const merged: ZohoTokenRecord = {
    ...(existing ?? {}),
    ...incoming,
  };

  if (!merged.refresh_token && existing?.refresh_token) {
    merged.refresh_token = existing.refresh_token;
  }

  if (region) {
    merged.region = region;
  }

  if (!merged.access_token) {
    throw new Error("Zoho token missing access_token");
  }

  if (typeof incoming.expires_in === "number" && Number.isFinite(incoming.expires_in)) {
    merged.expires_at = Date.now() + incoming.expires_in * 1000 - 60_000;
  }

  return merged;
}

export function normalizeZohoEmails(params: { mailboxEmail: string; emails: any[] }): UnifiedEmail[] {
  return (params.emails ?? []).map((e: any) => ({
    provider: "zoho",
    mailboxEmail: params.mailboxEmail,
    id: String(e?.messageId ?? e?.id ?? e?.messageID ?? ""),
    subject: String(e?.subject ?? e?.Subject ?? ""),
    from: String(e?.fromAddress ?? e?.from ?? e?.sender ?? e?.fromEmailAddress ?? ""),
    date: String(e?.receivedTime ?? e?.sentDateInGMT ?? e?.date ?? e?.time ?? ""),
    snippet: String(e?.summary ?? e?.snippet ?? e?.preview ?? ""),
    body: typeof e?.content === "string" ? e.content : undefined,
    permalink: typeof e?.permalink === "string" ? e.permalink : undefined,
  }));
}
