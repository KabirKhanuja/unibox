import axios from "axios";

export async function fetchZohoAccountId(
  accessToken: string,
  mailBase: string = "https://mail.zoho.com"
) {
  const res = await axios.get(`${mailBase}/api/accounts`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  });

  const accountId = res.data?.data?.[0]?.accountId;
  if (!accountId) {
    throw new Error("Zoho accountId not found");
  }

  return accountId;
}