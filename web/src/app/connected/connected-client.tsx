"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/utils";

type Props = {
  provider?: string;
  email?: string;
};

type EmailItem = {
  subject?: string;
  from?: string;
};

export default function ConnectedClient({ provider, email }: Props) {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingParams = !provider || !email;

  useEffect(() => {
    if (missingParams) return;

    Promise.resolve().then(() => {
      setLoading(true);
      setError(null);
    });

    let cancelled = false;
    fetch(`${API_BASE}/${provider}/unread?email=${encodeURIComponent(email)}`) // api for fetching unread emails
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.success) {
          throw new Error("Failed to fetch emails");
        }
        setEmails((data.emails || []) as EmailItem[]);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not fetch emails");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [missingParams, provider, email]);

  if (missingParams) {
    return <div className="p-6 text-red-500">Missing provider or email</div>;
  }

  if (loading) return <div className="p-6">Fetching emails…</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  const providerLabel = (provider ?? "").toUpperCase();

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Connected to {providerLabel}</h1>

      <p className="text-sm text-gray-600">{email}</p>

      {emails.length === 0 ? (
        <p>No unread emails</p>
      ) : (
        <ul className="space-y-3">
          {emails.map((mail, i) => (
            <li key={i} className="border rounded p-3">
              <div className="font-medium">{mail.subject}</div>
              <div className="text-sm text-gray-600">{mail.from}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
