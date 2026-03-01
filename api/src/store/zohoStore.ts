import fs from "node:fs";
import path from "node:path";
import { refreshZohoAccessToken } from "../providers/zoho/oauth";
import type { ZohoRegion } from "../providers/zoho/oauth";

type ZohoToken = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  api_domain?: string;
  expires_at?: number;
  region?: ZohoRegion;
};

const zohoTokenStore = new Map<string, ZohoToken>();

const ZOHO_TOKEN_STORE_PATH =
  process.env.ZOHO_TOKEN_STORE_PATH ??
  path.join(process.cwd(), ".zoho-tokens.json");

function persistZohoStore() {
  try {
    const obj = Object.fromEntries(zohoTokenStore.entries());
    fs.writeFileSync(ZOHO_TOKEN_STORE_PATH, JSON.stringify(obj, null, 2), {
      encoding: "utf-8",
    });
  } catch {
  }
}

function hydrateZohoStore() {
  try {
    if (!fs.existsSync(ZOHO_TOKEN_STORE_PATH)) return;
    const raw = fs.readFileSync(ZOHO_TOKEN_STORE_PATH, { encoding: "utf-8" });
    const parsed = JSON.parse(raw) as Record<string, ZohoToken>;
    if (!parsed || typeof parsed !== "object") return;

    for (const [email, tokens] of Object.entries(parsed)) {
      if (tokens && typeof tokens === "object" && (tokens as any).access_token) {
        zohoTokenStore.set(email, tokens);
      }
    }
  } catch {
  }
}

hydrateZohoStore();

function normalizeEmailKey(email: string) {
  return email.trim().toLowerCase();
}

export function saveZohoTokens(email: string, tokens: ZohoToken) {
  const key = normalizeEmailKey(email);
  const existing = zohoTokenStore.get(key);

  const merged: ZohoToken = {
    ...existing,
    ...tokens,
  };

  // preserving refresh_token if zoho doesnt return it on refresh
  if (!merged.refresh_token && existing?.refresh_token) {
    merged.refresh_token = existing.refresh_token;
  }

  if (!merged.access_token) {
    throw new Error("Zoho token missing access_token");
  }

  if (typeof tokens.expires_in === "number" && Number.isFinite(tokens.expires_in)) {
    merged.expires_at = Date.now() + tokens.expires_in * 1000 - 60_000;
  }

  zohoTokenStore.set(key, merged);
  persistZohoStore();
}

export function getZohoTokens(email: string): ZohoToken {
  const tokens = zohoTokenStore.get(normalizeEmailKey(email));
  if (!tokens) {
    throw new Error(
      `Zoho not connected for ${email}. Connect first via /auth/zoho/in?email=${encodeURIComponent(
        email
      )} (or /auth/zoho/com?email=...)`
    );
  }
  return tokens;
}

export function isZohoConnected(email: string) {
  return zohoTokenStore.has(normalizeEmailKey(email));
}

function isExpired(tokens: ZohoToken) {
  return typeof tokens.expires_at === "number" && Date.now() >= tokens.expires_at;
}

export async function getZohoAccessToken(email: string) {
  const tokens = getZohoTokens(email);
  if (!isExpired(tokens)) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    throw new Error(
      `Zoho access token expired and no refresh_token is available for ${email}. Reconnect via /auth/zoho/in?email=${encodeURIComponent(
        email
      )} (or /auth/zoho/com?email=...)`
    );
  }

  const refreshed = await refreshZohoAccessToken(
    tokens.refresh_token,
    tokens.region
  );
  saveZohoTokens(email, refreshed);
  return getZohoTokens(email).access_token;
}

export async function forceRefreshZohoAccessToken(email: string) {
  const tokens = getZohoTokens(email);
  if (!tokens.refresh_token) {
    throw new Error(
      `Zoho refresh_token missing for ${email}. Reconnect via /auth/zoho/in?email=${encodeURIComponent(
        email
      )} (or /auth/zoho/com?email=...)`
    );
  }
  const refreshed = await refreshZohoAccessToken(tokens.refresh_token);
  saveZohoTokens(email, refreshed);
  return getZohoTokens(email).access_token;
}