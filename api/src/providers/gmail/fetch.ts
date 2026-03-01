import axios from "axios";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

export async function fetchUnreadGmail(accessToken: string) {
  // for unread
  const listRes = await axios.get(
    `${GMAIL_API_BASE}/users/me/messages`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        q: "is:unread",
        maxResults: 10, // temp limit rn
      },
    }
  );

  const messages = listRes.data.messages || [];

  const detailedEmails = await Promise.all(
    messages.map(async (msg: { id: string }) => {
      const msgRes = await axios.get(
        `${GMAIL_API_BASE}/users/me/messages/${msg.id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const payload = msgRes.data.payload;
      const headers = payload.headers;

      const getHeader = (name: string) =>
        headers.find((h: any) => h.name === name)?.value || "";

      return {
        id: msg.id,
        from: getHeader("From"),
        subject: getHeader("Subject"),
        snippet: msgRes.data.snippet,
        internalDate: msgRes.data.internalDate,
      };
    })
  );

  return detailedEmails;
}