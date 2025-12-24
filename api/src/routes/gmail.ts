import { Router } from "express";
import { getGmailAuthUrl, getGmailTokens } from "../providers/gmail/oauth";
import { fetchUnreadGmail } from "../providers/gmail/fetch";

const router = Router();

router.get("/connect/gmail", (_req, res) => {
  const url = getGmailAuthUrl();
  res.redirect(url);
});

router.get("/callback/gmail", async (req, res) => {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).send("Missing code");
  }

  try {
    const tokens = await getGmailTokens(code);

    if (!tokens.access_token) {
      throw new Error("No access token received");
    }

    const emails = await fetchUnreadGmail(tokens.access_token);

    res.json({
      success: true,
      count: emails.length,
      emails,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to fetch Gmail emails");
  }
});

export default router;