import { ConfidentialClientApplication, AuthorizationUrlRequest, Configuration } from "@azure/msal-node";
import { env } from "../../config/env";

const msalConfig: Configuration = {
    auth: {
        clientId: env.OUTLOOK_CLIENT_ID,
        authority: "https://login.microsoftonline.com/common",
        clientSecret: env.OUTLOOK_CLIENT_SECRET,
    },
};

const msalClient = new ConfidentialClientApplication(msalConfig);

const SCOPES = ["User.Read", "Mail.Read", "offline_access"];

export async function getOutlookAuthUrl() {
    const authCodeUrlParameters: AuthorizationUrlRequest = {
        scopes: SCOPES,
        redirectUri: env.OUTLOOK_REDIRECT_URI,
    };

    return await msalClient.getAuthCodeUrl(authCodeUrlParameters);
}

export async function exchangeOutlookCode(code: string) {
    const tokenRequest = {
        code,
        scopes: SCOPES,
        redirectUri: env.OUTLOOK_REDIRECT_URI,
    };

    const response = await msalClient.acquireTokenByCode(tokenRequest);

    if (!response.account?.username) {
        throw new Error("No account information found in Outlook response");
    }

    return {
        homeAccountId: response.account.homeAccountId,
        email: response.account.username,
        accessToken: response.accessToken,
        expiresOn: response.expiresOn || undefined,
    };
}

export async function refreshOutlookToken(homeAccountId: string) {
    // for DB
    // msalClient.getTokenCache().serialize() -> DB

    try {
        const account = await msalClient.getTokenCache().getAccountByHomeId(homeAccountId);

        if (!account) {
            throw new Error("Account not found in cache. Re-authentication required.");
        }

        const silentRequest = {
            account: account,
            scopes: SCOPES,
        };

        const response = await msalClient.acquireTokenSilent(silentRequest);
        return {
            accessToken: response.accessToken,
            expiresOn: response.expiresOn || undefined
        };
    } catch (error) {
        console.error("Silent token acquisition failed", error);
        throw error;
    }
}
