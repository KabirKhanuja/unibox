"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/utils";

type Props = {
  provider?: string;
  email?: string;
};

type EmailItem = {
  id?: string;
  date?: string;
  from?: string;
  subject?: string;
  summary?: string;
  importanceScore?: number;
  permalink?: string;
};

export default function MailClient({ provider, email }: Props) {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectPath, setConnectPath] = useState<
    string | { in: string; com: string } | null
  >(null);

  const missingParams = !provider || !email;

  useEffect(() => {
    if (missingParams) return;

    setLoading(true);
    setError(null);
    setConnectPath(null);

    let cancelled = false;

    fetch(
      `${API_BASE}/${provider}/unread?email=${encodeURIComponent(email)}`
    )
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        return { ok: res.ok, data };
      })
      .then(({ ok, data }) => {
        if (cancelled) return;

        if (!ok || !data?.success) {
          setConnectPath(data?.connect ?? null);
          throw new Error(
            typeof data?.error === "string"
              ? data.error
              : "Failed to fetch emails"
          );
        }

        setEmails((data.emails ?? []) as EmailItem[]);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Failed to load inbox"
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [missingParams, provider, email]);

  if (missingParams) {
    return <div className="p-6 text-red-500">Missing provider or email</div>;
  }

  if (loading) return <div className="p-6">Loading inbox…</div>;

  if (error) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-red-500">{error}</div>

        {connectPath ? (
          typeof connectPath === "string" ? (
            <Button
              onClick={() =>
                (window.location.href = `${API_BASE}${connectPath}`)
              }
            >
              Reconnect {provider?.toUpperCase()}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  (window.location.href = `${API_BASE}${connectPath.in}`)
                }
              >
                Reconnect ZOHO.IN
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  (window.location.href = `${API_BASE}${connectPath.com}`)
                }
              >
                Reconnect ZOHO.COM
              </Button>
            </div>
          )
        ) : null}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">
        Inbox ({provider?.toUpperCase()})
      </h1>

      <p className="text-sm text-muted-foreground">{email}</p>

      {emails.length === 0 ? (
        <p>No unread emails</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted">
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Sender</th>
                <th className="p-2 text-left">Subject</th>
                <th className="p-2 text-left">Summary</th>
                <th className="p-2 text-center">Importance</th>
                <th className="p-2 text-center">Link</th>
              </tr>
            </thead>

            <tbody>
              {emails.map((mail, i) => (
                <tr
                  key={mail.id ?? i}
                  className="border-b hover:bg-muted/50"
                >
                  <td className="p-2 whitespace-nowrap">
                    {mail.date
                      ? new Date(mail.date).toLocaleString()
                      : "-"}
                  </td>

                  <td className="p-2">{mail.from ?? "-"}</td>

                  <td className="p-2 font-medium">
                    {mail.subject ?? "-"}
                  </td>

                  <td className="p-2 text-muted-foreground">
                    {mail.summary ?? "-"}
                  </td>

                  <td className="p-2 text-center font-semibold">
                    {mail.importanceScore ?? "-"}
                  </td>

                  <td className="p-2 text-center">
                    {mail.permalink ? (
                      <a
                        href={mail.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Open
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}