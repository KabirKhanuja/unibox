import { Router } from "express";
import { getGmailAuthUrl, exchangeGmailCode } from "../providers/gmail/oauth";
import { fetchUnreadGmail } from "../providers/gmail/fetch";
import { saveGmailTokens, getGmailTokens } from "../store/gmailStore";
import { env } from "../config/env";
import { processEmails } from "../services/email-intelligence";


const router = Router();

// redirecting user to google oauth
router.get("/auth/gmail", (_req, res) => {
  const url = getGmailAuthUrl();
  res.redirect(url);
});

// google oauth's response 
router.get("/auth/gmail/callback", async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send("Missing code");

  try {
    const { email, tokens } = await exchangeGmailCode(code);

    saveGmailTokens(email, {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? undefined,
      expiryDate: tokens.expiry_date ?? undefined,
    });

    const redirectUrl =
      `${env.WEB_BASE_URL}/mail` +
      `?provider=gmail&email=${encodeURIComponent(email)}`;

    return res.redirect(redirectUrl);
  } catch (err) {
    console.error(err);
    return res.redirect(`${env.WEB_BASE_URL}/error?provider=gmail`);
  }
});

// for unread emails 
router.get("/gmail/unread", async (req, res) => {
  const email = req.query.email as string;
  if (!email) return res.status(400).send("Missing email");

  try {
    const tokens = getGmailTokens(email);
    if (!tokens) return res.status(401).send("Gmail not connected");

    const emails = await fetchUnreadGmail(tokens.accessToken);
    const enriched = await processEmails(emails);

    res.json({
      success: true,
      provider: "gmail",
      email,
      count: enriched.length,
      emails: enriched,
    });

    // res.json({
    //   success: true,
    //   provider: "gmail",
    //   email,
    //   count: emails.length,
    //   emails,
    // });
    
  } catch (err) {
    console.error("Gmail fetch error:", err);

    res.status(401).json({
      success: false,
      provider: "gmail",
      email,
      error: err instanceof Error ? err.message : "Gmail fetch failed",
      connect: `/auth/gmail`,
    });
  }
});

export default router;