import { Router } from "express";
import {
  getZohoAuthUrlCom,
  getZohoAuthUrlIn,
  exchangeZohoCode,
} from "../providers/zoho/oauth";
import { env } from "../config/env";
import {
  saveZohoTokens,
  getZohoAccessToken,
  forceRefreshZohoAccessToken,
  isZohoConnected,
} from "../store/zohoStore";
import { fetchZohoAccountId } from "../providers/zoho/account";
import { fetchUnreadZohoEmails } from "../providers/zoho/fetch";
import { processEmails } from "../services/email-intelligence";

const router = Router();

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function renderZohoEmailPrompt(region: "in" | "com") {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Connect Zoho</title>
    </head>
    <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px;">
      <h2>Connect Zoho (${region.toUpperCase()})</h2>
      <p>Enter the email you want to connect, then.</p>
      <form method="GET" action="${env.WEB_BASE_URL}/auth/zoho/${region}">
        <input name="email" type="email" placeholder="you@zoho.in" required style="padding: 8px; width: 320px;" />
        <button type="submit" style="padding: 8px 12px;">Continue</button>
      </form>
    </body>
  </html>`;
}

function inferZohoAuthRegionFromEmail(email: string): "in" | "com" {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain.endsWith(".in")) return "in";
  return "com";
}

// You can also force a region: <code>/auth/zoho/in</code> or <code>/auth/zoho/com</code>

function renderZohoSmartEmailPrompt() {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Connect Zoho</title>
    </head>
    <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px;">
      <h2>Connect Zoho</h2>
      <p>Enter the email you want to connect. The API will auto-pick the correct Zoho region.</p>
      <form method="GET" action="${env.WEB_BASE_URL}/auth/zoho">
        <input name="email" type="email" placeholder="you@zoho.in" required style="padding: 8px; width: 320px;" />
        <button type="submit" style="padding: 8px 12px;">Continue</button>
      </form>
      <p style="margin-top: 16px; color: #666;">
      </p>
    </body>
  </html>`;
}

function getZohoMailBaseForEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain.endsWith(".in")) return "https://mail.zoho.in";
  return process.env.ZOHO_MAIL_BASE ?? "https://mail.zoho.com";
}

// auth auto pick region based on email domain
router.get("/auth/zoho", (req, res) => {
  const email = firstQueryValue(req.query.email);
  if (!email) return res.status(200).type("html").send(renderZohoSmartEmailPrompt());

  const region = inferZohoAuthRegionFromEmail(email);
  return res.redirect(`${env.WEB_BASE_URL}/auth/zoho/${region}?email=${encodeURIComponent(email)}`);});

// for .in
router.get("/auth/zoho/in", (req, res) => {
  const email = firstQueryValue(req.query.email);
  if (!email) return res.status(200).type("html").send(renderZohoEmailPrompt("in"));

  const url = new URL(getZohoAuthUrlIn());
  url.searchParams.set("state", email);
  res.redirect(url.toString());
});


// for .com
router.get("/auth/zoho/com", (req, res) => {
  const email = firstQueryValue(req.query.email);
  if (!email) return res.status(200).type("html").send(renderZohoEmailPrompt("com"));

  const url = new URL(getZohoAuthUrlCom());
  url.searchParams.set("state", email);
  res.redirect(url.toString());
});

// zoho oauth callback
router.get("/auth/zoho/callback", async (req, res) => {
  const code = firstQueryValue(req.query.code);
  const email = firstQueryValue(req.query.state);

  if (!code || !email) {
    return res.redirect(`${env.WEB_BASE_URL}/error?provider=zoho`);
  }

  try {
    const tokens = await exchangeZohoCode(code);

    saveZohoTokens(email, {
      ...tokens,
      region: inferZohoAuthRegionFromEmail(email),
    });

    const redirectUrl =
      `${env.WEB_BASE_URL}/mail` +
      `?provider=zoho&email=${encodeURIComponent(email)}`;

    return res.redirect(redirectUrl);
  } catch (err) {
    console.error("Zoho OAuth error:", err);
    return res.redirect(`${env.WEB_BASE_URL}/error?provider=zoho`);
  }
});

router.get("/zoho/status", (req, res) => {
  const email = firstQueryValue(req.query.email);
  if (!email) return res.status(400).send("Missing email");

  res.json({
    success: true,
    provider: "zoho",
    email,
    connected: isZohoConnected(email),
  });
});

 // fetching unread zoho emails
 // /zoho/unread?email=user@zoho.in

router.get("/zoho/unread", async (req, res) => {
  const email = req.query.email as string;

  if (!email) {
    return res.status(400).send("Missing email");
  }

  try {
    // ensuring we've a non expired access token
    let accessToken = await getZohoAccessToken(email);
    const mailBase = getZohoMailBaseForEmail(email);

    try {
      const accountId = await fetchZohoAccountId(accessToken, mailBase);
      const emails = await fetchUnreadZohoEmails(accessToken, accountId, mailBase);

      const rawEmails = (emails ?? []).map((e: any) => ({
        id: String(e?.messageId ?? e?.id ?? e?.messageID ?? ""),
        subject: String(e?.subject ?? e?.Subject ?? ""),
        from: String(
          e?.fromAddress ??
            e?.from ??
            e?.sender ??
            e?.fromEmailAddress ??
            ""
        ),
        date: String(
          e?.receivedTime ??
            e?.sentDateInGMT ??
            e?.date ??
            e?.time ??
            ""
        ),
        snippet: String(e?.summary ?? e?.snippet ?? e?.preview ?? ""),
        body: typeof e?.content === "string" ? e.content : undefined,
        permalink: typeof e?.permalink === "string" ? e.permalink : undefined,
      }));

      const enriched = await processEmails(rawEmails);

      return res.json({
        success: true,
        provider: "zoho",
        email,
        count: enriched.length,
        emails: enriched,
      });
    } catch (err: any) {
      // if zoho rejects the token we'd force refresh
      const status = err?.response?.status;
      if (status === 401) {
        accessToken = await forceRefreshZohoAccessToken(email);
        const accountId = await fetchZohoAccountId(accessToken, mailBase);
        const emails = await fetchUnreadZohoEmails(accessToken, accountId, mailBase);

        const rawEmails = (emails ?? []).map((e: any) => ({
          id: String(e?.messageId ?? e?.id ?? e?.messageID ?? ""),
          subject: String(e?.subject ?? e?.Subject ?? ""),
          from: String(
            e?.fromAddress ??
              e?.from ??
              e?.sender ??
              e?.fromEmailAddress ??
              ""
          ),
          date: String(
            e?.receivedTime ??
              e?.sentDateInGMT ??
              e?.date ??
              e?.time ??
              ""
          ),
          snippet: String(e?.summary ?? e?.snippet ?? e?.preview ?? ""),
          body: typeof e?.content === "string" ? e.content : undefined,
          permalink: typeof e?.permalink === "string" ? e.permalink : undefined,
        }));

        const enriched = await processEmails(rawEmails);

        return res.json({
          success: true,
          provider: "zoho",
          email,
          count: enriched.length,
          emails: enriched,
        });
      }
      throw err;
    }
  } catch (err) {
    console.error("Zoho fetch error:", err);

    const upstreamStatus = (err as any)?.response?.status;
    const upstreamData = (err as any)?.response?.data;

    res.status(401).json({
      success: false,
      provider: "zoho",
      email,
      error: err instanceof Error ? err.message : "Zoho request failed",
      upstreamStatus,
      upstreamData,
      connect: {
        in: `${env.WEB_BASE_URL}/auth/zoho/in?email=${encodeURIComponent(email)}`,
        com: `${env.WEB_BASE_URL}/auth/zoho/com?email=${encodeURIComponent(email)}`,
      },
    });
  }
});

export default router;