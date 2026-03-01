type Props = {
  provider: string;
  email: string;
  emails: { subject?: string; from?: string }[];
};

export function EmailList({ provider, email, emails }: Props) {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">
          Unread — {provider.toUpperCase()}
        </h1>
        <p className="text-sm text-muted-foreground">{email}</p>
      </header>

      {emails.length === 0 ? (
        <p>No unread emails 🎉</p>
      ) : (
        <ul className="space-y-2">
          {emails.map((mail, i) => (
            <li
              key={i}
              className="border rounded-md p-4 hover:bg-muted transition"
            >
              <div className="font-medium">
                {mail.subject || "(No subject)"}
              </div>
              <div className="text-sm text-muted-foreground">
                {mail.from}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}