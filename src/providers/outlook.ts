import { ConfidentialClientApplication, type AuthorizationUrlRequest, type Configuration } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";
import type { OutlookTokenRecord, UnifiedEmail } from "../types.js";

export type OutlookProviderConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authority?: string;
};

const SCOPES = ["User.Read", "Mail.Read", "offline_access"];

export function createMsalClient(cfg: OutlookProviderConfig) {
  const msalConfig: Configuration = {
    auth: {
      clientId: cfg.clientId,
      authority: cfg.authority ?? "https://login.microsoftonline.com/common",
      clientSecret: cfg.clientSecret,
    },
  };

  return new ConfidentialClientApplication(msalConfig);
}

export async function getOutlookAuthUrl(msalClient: ConfidentialClientApplication, cfg: OutlookProviderConfig) {
  const authCodeUrlParameters: AuthorizationUrlRequest = {
    scopes: SCOPES,
    redirectUri: cfg.redirectUri,
  };

  return await msalClient.getAuthCodeUrl(authCodeUrlParameters);
}

export async function exchangeOutlookCode(msalClient: ConfidentialClientApplication, cfg: OutlookProviderConfig, code: string) {
  const tokenRequest = {
    code,
    scopes: SCOPES,
    redirectUri: cfg.redirectUri,
  };

  // can get the outlook tokens using entra or msal

  const response = await msalClient.acquireTokenByCode(tokenRequest);

  if (!response.account?.username) {
    throw new Error("No account information found in Outlook response");
  }

  const record: OutlookTokenRecord = {
    homeAccountId: response.account.homeAccountId,
    email: response.account.username,
    accessToken: response.accessToken,
    expiresOn: response.expiresOn || undefined,
  };

  return record;
}

export async function refreshOutlookToken(msalClient: ConfidentialClientApplication, homeAccountId: string) {
  const account = await msalClient.getTokenCache().getAccountByHomeId(homeAccountId);
  if (!account) {
    throw new Error("Account not found in MSAL cache. Re-authentication required.");
  }

  const silentRequest = {
    account,
    scopes: SCOPES,
  };

  const response = await msalClient.acquireTokenSilent(silentRequest);
  return {
    accessToken: response.accessToken,
    expiresOn: response.expiresOn || undefined,
  };
}

export async function fetchUnreadOutlook(accessToken: string, opts?: { maxResults?: number }) {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  const messages = await client
    .api("/me/mailFolders/inbox/messages")
    .filter("isRead eq false")
    .top(opts?.maxResults ?? 10)
    .select("id,subject,from,receivedDateTime,bodyPreview,webLink")
    .get();

  return (messages.value ?? []) as any[];
}

export function normalizeOutlookEmails(params: { mailboxEmail: string; emails: any[] }): UnifiedEmail[] {
  return (params.emails ?? []).map((msg: any) => ({
    provider: "outlook",
    mailboxEmail: params.mailboxEmail,
    id: String(msg?.id ?? ""),
    subject: String(msg?.subject ?? ""),
    from: msg?.from?.emailAddress
      ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>`
      : "Unknown",
    date: String(msg?.receivedDateTime ?? ""),
    snippet: String(msg?.bodyPreview ?? ""),
    permalink: typeof msg?.webLink === "string" ? msg.webLink : undefined,
  }));
}
