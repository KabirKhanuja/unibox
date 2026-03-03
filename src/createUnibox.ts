import type { Request, Response } from "express";
import { Router } from "express";
import type {
  ConnectUrlOptions,
  EmailSummarizer,
  EnrichedEmail,
  Provider,
  TokenStore,
  UnifiedEmail,
  UniboxConfig,
  UniboxInstance,
} from "./types.js";
import { connectUrl as buildConnectUrl } from "./connectUrl.js";
import { createInMemoryTokenStore } from "./token-store/inMemory.js";
import {
  exchangeGmailCode,
  fetchUnreadGmail,
  getGmailAuthUrl,
  normalizeGmailEmails,
  refreshGmailAccessToken,
} from "./providers/gmail.js";
import {
  exchangeZohoCode,
  fetchUnreadZohoEmails,
  fetchZohoAccountId,
  getZohoAuthUrl,
  getZohoMailBaseForEmail,
  inferZohoRegionFromEmail,
  mergeZohoTokens,
  normalizeZohoEmails,
  refreshZohoAccessToken,
} from "./providers/zoho.js";
import {
  createMsalClient,
  exchangeOutlookCode,
  fetchUnreadOutlook,
  getOutlookAuthUrl,
  normalizeOutlookEmails,
  refreshOutlookToken,
} from "./providers/outlook.js";
import { createGroqSummarizer } from "./intelligence/groq.js";
import { createLlmSummarizer } from "./intelligence/llm.js";
import { processEmails } from "./intelligence/pipeline.js";

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function defaultSuccessRedirect(webBaseUrl: string, provider: Provider, email: string) {
  return `${webBaseUrl.replace(/\/$/, "")}/mail?provider=${provider}&email=${encodeURIComponent(email)}`;
}

function defaultErrorRedirect(webBaseUrl: string, provider: Provider) {
  return `${webBaseUrl.replace(/\/$/, "")}/error?provider=${provider}`;
}

async function requireTokens<P extends Provider>(
  tokenStore: TokenStore,
  provider: P,
  email: string
) {
  const tokens = await tokenStore.get(provider, email);
  if (!tokens) {
    const err = new Error(`${provider} not connected for ${email}`);
    (err as any).status = 401;
    throw err;
  }
  return tokens;
}

export function createUnibox(config: UniboxConfig): UniboxInstance {
  const tokenStore = config.tokenStore ?? createInMemoryTokenStore();
  const maxResults = config.mail?.maxResults ?? 10;

  const intelligenceEnabled = Boolean(config.intelligence?.enabled);
  const llmCfg = config.intelligence?.llm;
  const groqCfg = config.intelligence?.groq; // deprecated alias

  let summarizer: EmailSummarizer | null = null;
  if (intelligenceEnabled) {
    if (typeof config.intelligence?.summarizer === "function") {
      summarizer = config.intelligence.summarizer;
    } else if (llmCfg?.apiKey) {
      summarizer = createLlmSummarizer(llmCfg);
    } else if (groqCfg?.apiKey) {
      summarizer = createGroqSummarizer({ apiKey: groqCfg.apiKey, model: groqCfg.model });
    } else {
      throw new Error(
        "Intelligence enabled but no summarizer configured. Provide config.intelligence.summarizer or config.intelligence.llm (or legacy config.intelligence.groq)"
      );
    }
  }

  const outlookCfg = config.providers.outlook;
  const msalClient = outlookCfg ? createMsalClient(outlookCfg) : null;

  async function maybeEnrich(emails: UnifiedEmail[]): Promise<UnifiedEmail[] | EnrichedEmail[]> {
    if (!intelligenceEnabled || !summarizer) return emails;
    return await processEmails(emails, summarizer);
  }

  async function fetchUnread(params: { provider: Provider; email: string }) {
    const provider = params.provider;

    if (provider === "gmail") {
      const gmailCfg = config.providers.gmail;
      if (!gmailCfg) throw new Error("Gmail provider is not configured");

      const tokens = await requireTokens(tokenStore, "gmail", params.email);

      let accessToken = tokens.accessToken;
      const isExpired = typeof tokens.expiryDate === "number" && Date.now() >= tokens.expiryDate - 60_000;

      if (isExpired) {
        if (!tokens.refreshToken) {
          throw new Error("Gmail token expired and refreshToken is missing");
        }
        const refreshed = await refreshGmailAccessToken(gmailCfg, tokens.refreshToken);
        accessToken = refreshed.accessToken;
        await tokenStore.set("gmail", params.email, {
          ...tokens,
          accessToken,
          expiryDate: refreshed.expiryDate,
        });
      }

      const raw = await fetchUnreadGmail(accessToken, { maxResults });
      const unified = normalizeGmailEmails({ mailboxEmail: params.email, emails: raw });
      return await maybeEnrich(unified);
    }

    if (provider === "zoho") {
      const zohoCfg = config.providers.zoho;
      if (!zohoCfg) throw new Error("Zoho provider is not configured");

      const tokens = await requireTokens(tokenStore, "zoho", params.email);
      const mailBase = getZohoMailBaseForEmail(params.email);

      let accessToken = tokens.access_token;
      const expired = typeof tokens.expires_at === "number" && Date.now() >= tokens.expires_at;

      if (expired) {
        if (!tokens.refresh_token) {
          throw new Error("Zoho token expired and refresh_token is missing");
        }
        const refreshed = await refreshZohoAccessToken(zohoCfg, tokens.refresh_token, tokens.region);
        const merged = mergeZohoTokens(tokens, refreshed, tokens.region);
        await tokenStore.set("zoho", params.email, merged);
        accessToken = merged.access_token;
      }

      const accountId = await fetchZohoAccountId(accessToken, mailBase);

      try {
        const rawEmails = await fetchUnreadZohoEmails(accessToken, accountId, mailBase, { maxResults });
        const unified = normalizeZohoEmails({ mailboxEmail: params.email, emails: rawEmails });
        return await maybeEnrich(unified);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 && tokens.refresh_token) {
          const refreshed = await refreshZohoAccessToken(zohoCfg, tokens.refresh_token, tokens.region);
          const merged = mergeZohoTokens(await tokenStore.get("zoho", params.email), refreshed, tokens.region);
          await tokenStore.set("zoho", params.email, merged);

          const freshAccountId = await fetchZohoAccountId(merged.access_token, mailBase);
          const rawEmails = await fetchUnreadZohoEmails(merged.access_token, freshAccountId, mailBase, { maxResults });
          const unified = normalizeZohoEmails({ mailboxEmail: params.email, emails: rawEmails });
          return await maybeEnrich(unified);
        }

        throw err;
      }
    }

    if (provider === "outlook") {
      if (!outlookCfg || !msalClient) throw new Error("Outlook provider is not configured");

      const tokens = await requireTokens(tokenStore, "outlook", params.email);

      let accessToken = tokens.accessToken;
      try {
        const refreshed = await refreshOutlookToken(msalClient, tokens.homeAccountId);
        if (refreshed?.accessToken) {
          accessToken = refreshed.accessToken;
          await tokenStore.set("outlook", params.email, {
            ...tokens,
            accessToken,
            expiresOn: refreshed.expiresOn,
          });
        }
      } catch {
      }

      const raw = await fetchUnreadOutlook(accessToken, { maxResults });
      const unified = normalizeOutlookEmails({ mailboxEmail: params.email, emails: raw });
      return await maybeEnrich(unified);
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  function router() {
    const router = Router();

    // Gmail
    if (config.providers.gmail) {
      router.get("/gmail", (_req, res) => {
        res.redirect(getGmailAuthUrl(config.providers.gmail!));
      });

      router.get("/gmail/callback", async (req: Request, res: Response) => {
        const code = firstQueryValue(req.query.code);
        if (!code) return res.status(400).send("Missing code");

        try {
          const { email, tokens } = await exchangeGmailCode(config.providers.gmail!, code);

          await tokenStore.set("gmail", email, {
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token ?? undefined,
            expiryDate: tokens.expiry_date ?? undefined,
          });

          if (config.redirects?.onSuccess) {
            return res.redirect(config.redirects.onSuccess({ provider: "gmail", email }));
          }

          if (config.webBaseUrl) {
            return res.redirect(defaultSuccessRedirect(config.webBaseUrl, "gmail", email));
          }

          return res.json({ success: true, provider: "gmail", email });
        } catch (err) {
          const error = err instanceof Error ? err.message : "gmail_auth_failed";
          if (config.redirects?.onError) {
            return res.redirect(config.redirects.onError({ provider: "gmail", error }));
          }
          if (config.webBaseUrl) {
            return res.redirect(defaultErrorRedirect(config.webBaseUrl, "gmail"));
          }
          return res.status(500).json({ success: false, provider: "gmail", error });
        }
      });

      router.get("/gmail/unread", async (req: Request, res: Response) => {
        const email = firstQueryValue(req.query.email);
        if (!email) return res.status(400).send("Missing email");

        try {
          const emails = await fetchUnread({ provider: "gmail", email });
          return res.json({ success: true, provider: "gmail", email, count: emails.length, emails });
        } catch (err) {
          const status = (err as any)?.status ?? 500;
          const message = err instanceof Error ? err.message : "Gmail fetch failed";
          return res.status(status).json({ success: false, provider: "gmail", email, error: message });
        }
      });
    }

    // Zoho
    if (config.providers.zoho) {
      router.get("/zoho", (req: Request, res: Response) => {
        const email = firstQueryValue(req.query.email);
        if (!email) return res.status(400).send("Missing email");

        const region = inferZohoRegionFromEmail(email);
        return res.redirect(`${req.baseUrl}/zoho/${region}?email=${encodeURIComponent(email)}`);
      });

      router.get("/zoho/in", (req: Request, res: Response) => {
        const email = firstQueryValue(req.query.email);
        if (!email) return res.status(400).send("Missing email");

        const url = new URL(getZohoAuthUrl(config.providers.zoho!, "in"));
        url.searchParams.set("state", email);
        return res.redirect(url.toString());
      });

      router.get("/zoho/com", (req: Request, res: Response) => {
        const email = firstQueryValue(req.query.email);
        if (!email) return res.status(400).send("Missing email");

        const url = new URL(getZohoAuthUrl(config.providers.zoho!, "com"));
        url.searchParams.set("state", email);
        return res.redirect(url.toString());
      });

      router.get("/zoho/callback", async (req: Request, res: Response) => {
        const code = firstQueryValue(req.query.code);
        const email = firstQueryValue(req.query.state);

        if (!code || !email) {
          const error = "Missing code or state(email)";
          if (config.redirects?.onError) {
            return res.redirect(config.redirects.onError({ provider: "zoho", error }));
          }
          if (config.webBaseUrl) {
            return res.redirect(defaultErrorRedirect(config.webBaseUrl, "zoho"));
          }
          return res.status(400).json({ success: false, provider: "zoho", error });
        }

        try {
          const region = inferZohoRegionFromEmail(email);
          const incoming = await exchangeZohoCode(config.providers.zoho!, code);

          const existing = await tokenStore.get("zoho", email);
          const merged = mergeZohoTokens(existing, incoming, region);
          await tokenStore.set("zoho", email, merged);

          if (config.redirects?.onSuccess) {
            return res.redirect(config.redirects.onSuccess({ provider: "zoho", email }));
          }

          if (config.webBaseUrl) {
            return res.redirect(defaultSuccessRedirect(config.webBaseUrl, "zoho", email));
          }

          return res.json({ success: true, provider: "zoho", email });
        } catch (err) {
          const error = err instanceof Error ? err.message : "zoho_auth_failed";
          if (config.redirects?.onError) {
            return res.redirect(config.redirects.onError({ provider: "zoho", error }));
          }
          if (config.webBaseUrl) {
            return res.redirect(defaultErrorRedirect(config.webBaseUrl, "zoho"));
          }
          return res.status(500).json({ success: false, provider: "zoho", error });
        }
      });

      router.get("/zoho/unread", async (req: Request, res: Response) => {
        const email = firstQueryValue(req.query.email);
        if (!email) return res.status(400).send("Missing email");

        try {
          const emails = await fetchUnread({ provider: "zoho", email });
          return res.json({ success: true, provider: "zoho", email, count: emails.length, emails });
        } catch (err) {
          const status = (err as any)?.status ?? 500;
          const message = err instanceof Error ? err.message : "Zoho fetch failed";
          return res.status(status).json({ success: false, provider: "zoho", email, error: message });
        }
      });
    }

    // Outlook
    if (config.providers.outlook && outlookCfg && msalClient) {
      router.get("/outlook", async (_req: Request, res: Response) => {
        try {
          const url = await getOutlookAuthUrl(msalClient, outlookCfg);
          return res.redirect(url);
        } catch (err) {
          const error = err instanceof Error ? err.message : "outlook_auth_url_failed";
          return res.status(500).json({ success: false, provider: "outlook", error });
        }
      });

      router.get("/outlook/callback", async (req: Request, res: Response) => {
        const code = firstQueryValue(req.query.code);
        if (!code) return res.status(400).send("Missing code");

        try {
          const record = await exchangeOutlookCode(msalClient, outlookCfg, code);
          await tokenStore.set("outlook", record.email, record);

          if (config.redirects?.onSuccess) {
            return res.redirect(config.redirects.onSuccess({ provider: "outlook", email: record.email }));
          }

          if (config.webBaseUrl) {
            return res.redirect(defaultSuccessRedirect(config.webBaseUrl, "outlook", record.email));
          }

          return res.json({ success: true, provider: "outlook", email: record.email });
        } catch (err) {
          const error = err instanceof Error ? err.message : "outlook_auth_failed";
          if (config.redirects?.onError) {
            return res.redirect(config.redirects.onError({ provider: "outlook", error }));
          }
          if (config.webBaseUrl) {
            return res.redirect(defaultErrorRedirect(config.webBaseUrl, "outlook"));
          }
          return res.status(500).json({ success: false, provider: "outlook", error });
        }
      });

      router.get("/outlook/unread", async (req: Request, res: Response) => {
        const email = firstQueryValue(req.query.email);
        if (!email) return res.status(400).send("Missing email param");

        try {
          const emails = await fetchUnread({ provider: "outlook", email });
          return res.json({ success: true, provider: "outlook", email, count: emails.length, emails });
        } catch (err) {
          const status = (err as any)?.status ?? 500;
          const message = err instanceof Error ? err.message : "Outlook fetch failed";
          return res.status(status).json({ success: false, provider: "outlook", email, error: message });
        }
      });
    }

    return router;
  }

  function connectUrl(options: ConnectUrlOptions): string {
    return buildConnectUrl(options);
  }

  return {
    router,
    fetchUnread,
    connectUrl,
  };
}
