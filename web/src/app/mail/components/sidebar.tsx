"use client";

import { Button } from "@/components/ui/button";

export type MailAccount = {
  provider: "gmail" | "zoho";
  email: string;
};

type Props = {
  accounts: MailAccount[];
  active?: { provider: string; email: string } | null;
  onSelect: (provider: string, email: string) => void;
};

export function Sidebar({ accounts, active, onSelect }: Props) {
  const grouped = accounts.reduce<Record<string, MailAccount[]>>(
    (acc, account) => {
      acc[account.provider] ||= [];
      acc[account.provider].push(account);
      return acc;
    },
    {}
  );

  return (
    <aside className="w-64 border-r p-4 space-y-6">
      <h2 className="text-lg font-semibold">📬 Mail</h2>

      <div className="space-y-4">
        {Object.entries(grouped).map(([provider, items]) => (
          <Section
            key={provider}
            title={provider.toUpperCase()}
          >
            {items.map((account) => (
              <AccountButton
                key={account.email}
                label={account.email}
                active={
                  active?.provider === account.provider &&
                  active?.email === account.email
                }
                onClick={() =>
                  onSelect(account.provider, account.email)
                }
              />
            ))}
          </Section>
        ))}

        <Section title="Coming Soon">
          <DisabledButton label="Yahoo" />
          <DisabledButton label="Outlook" />
        </Section>
      </div>
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-muted-foreground mb-2">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function AccountButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      className="w-full justify-start"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function DisabledButton({ label }: { label: string }) {
  return (
    <Button variant="ghost" disabled className="w-full justify-start">
      {label}
    </Button>
  );
}