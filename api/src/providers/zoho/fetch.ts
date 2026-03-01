import axios from "axios";

export async function fetchUnreadZohoEmails(
  accessToken: string,
  accountId: string,
  mailBase: string = "https://mail.zoho.com"
) {
  const res = await axios.get(
    `${mailBase}/api/accounts/${accountId}/messages/view`,
    {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
      params: {
        status: "unread",
        limit: 10,
      },
    }
  );

  return res.data?.data ?? [];
}