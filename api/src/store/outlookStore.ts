export type OutlookTokenRecord = {
    homeAccountId: string; // Critical for MSAL silent flow
    accessToken: string;
    refreshToken?: string;
    expiresOn?: Date;
    email: string;
};

// In-memory store for Outlook tokens
// Key: email address
const outlookTokenStore = new Map<string, OutlookTokenRecord>();

export function saveOutlookTokens(email: string, tokens: OutlookTokenRecord) {
    outlookTokenStore.set(email, tokens);
}

export function getOutlookTokens(email: string) {
    return outlookTokenStore.get(email);
}
