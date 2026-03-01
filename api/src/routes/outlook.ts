import { Router } from "express";
import { getOutlookAuthUrl, exchangeOutlookCode, refreshOutlookToken } from "../providers/outlook/oauth";
import { saveOutlookTokens, getOutlookTokens } from "../store/outlookStore";
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch"; // graph client
import { processEmails } from "../services/email-intelligence";

const router = Router();

// Redirect to Microsoft Login
router.get("/auth/outlook", async (_req, res) => {
    try {
        const url = await getOutlookAuthUrl();
        res.redirect(url);
    } catch (error) {
        console.error("Error generating Outlook auth URL:", error);
        res.status(500).send("Failed to generate auth URL");
    }
});

// Microsoft Callback
router.get("/auth/outlook/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).send("Missing code");

    try {
        const { email, homeAccountId, accessToken, expiresOn } = await exchangeOutlookCode(code);

        saveOutlookTokens(email, {
            email,
            homeAccountId,
            accessToken,
            expiresOn,
        });

        // Redirect to frontend mail page
        res.redirect(
  `${process.env.WEB_BASE_URL}/mail?provider=outlook&email=${encodeURIComponent(email)}`
);
    } catch (err) {
        res.redirect(
  `${process.env.WEB_BASE_URL}?error=outlook_auth_failed`
);
    }
});

// Fetch unread emails using Microsoft Graph
router.get("/outlook/unread", async (req, res) => {
    const email = req.query.email as string;
    if (!email) return res.status(400).send("Missing email param");

    const tokens = getOutlookTokens(email);
    if (!tokens) return res.status(401).send("Outlook not connected");

    try {
        // Attempt to refresh or reuse token (MSAL silent flow handles validity)
        // Note: In a stateless API, checking the cache might fail if the server restarted.
        // for now, ssume the server is running. 
        // If fetching fails, we try to refresh using the homeAccountId.
        let validAccessToken = tokens.accessToken;

        try {
            const freshTokens = await refreshOutlookToken(tokens.homeAccountId);
            if (freshTokens) validAccessToken = freshTokens.accessToken;
        } catch (e) {
            console.warn("Could not refresh token silently", e);
            // Fallback to existing token, it might still be valid
        }

        const client = Client.init({
            authProvider: (done) => {
                done(null, validAccessToken);
            }
        });

        const messages = await client.api('/me/mailFolders/inbox/messages')
            .filter('isRead eq false')
            .top(10)
            .select('id,subject,from,receivedDateTime,bodyPreview,webLink')
            .get();

        const rawEmails = (messages.value ?? []).map((msg: any) => ({
            id: String(msg?.id ?? ""),
            subject: String(msg?.subject ?? ""),
            from: msg?.from?.emailAddress
                ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>`
                : "Unknown",
            date: String(msg?.receivedDateTime ?? ""),
            snippet: String(msg?.bodyPreview ?? ""),
            permalink: typeof msg?.webLink === "string" ? msg.webLink : undefined,
        }));

        const enriched = await processEmails(rawEmails);

        res.json({
            success: true,
            provider: "outlook",
            email,
            count: enriched.length,
            emails: enriched
        });

    } catch (error) {
        console.error("Graph API Error:", error);
        res.status(500).send("Failed to fetch Outlook emails");
    }
});

export default router;
