import axios from "axios";

export type ZohoRegion = "in" | "com" | "eu" | "com.au" | "jp"; 

const ZOHO_ACCOUNTS_BASES: Record<ZohoRegion, string> = {
  com: "https://accounts.zoho.com",
  in: "https://accounts.zoho.in",
  eu: "",
  "com.au": "",
  jp: ""
};

function buildZohoAuthUrl(base: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZOHO_CLIENT_ID!,
    scope: "ZohoMail.messages.READ ZohoMail.accounts.READ",
    redirect_uri: process.env.ZOHO_REDIRECT_URI!,
    access_type: "offline",
    prompt: "consent",
  });

  return `${base}/oauth/v2/auth?${params.toString()}`;
}

// the default is going to be for US that is .com but if .in then india
export function getZohoAuthUrl(region: ZohoRegion = "com") {
  return buildZohoAuthUrl(ZOHO_ACCOUNTS_BASES[region]);
}

export const getZohoAuthUrlCom = () => getZohoAuthUrl("com");
export const getZohoAuthUrlIn = () => getZohoAuthUrl("in");

export async function exchangeZohoCode(code: string) {
  const bases: ZohoRegion[] = ["com", "in"];
  let lastError: unknown;

  for (const region of bases) {
    const base = ZOHO_ACCOUNTS_BASES[region];
    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.ZOHO_CLIENT_ID!,
        client_secret: process.env.ZOHO_CLIENT_SECRET!,
        redirect_uri: process.env.ZOHO_REDIRECT_URI!,
        code,
      });

      const res = await axios.post(`${base}/oauth/v2/token`, body.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const data = res.data as any;
      if (data?.access_token) {
        return data;
      }

      const errorDescription =
        data?.error_description ?? data?.error ?? "missing access_token";
      lastError = new Error(
        `Zoho token exchange failed for region ${region}: ${errorDescription}`
      );
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Zoho token exchange failed for all regions");
}

export async function refreshZohoAccessToken(
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
        client_id: process.env.ZOHO_CLIENT_ID!,
        client_secret: process.env.ZOHO_CLIENT_SECRET!,
        refresh_token: refreshToken,
      });

      const res = await axios.post(`${base}/oauth/v2/token`, body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (res.data?.access_token) {
        return res.data;
      }

      lastError = new Error(
        `Zoho refresh failed for region ${r}: ${res.data?.error_description ?? "unknown"}`
      );
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Zoho refresh failed for all regions");
}