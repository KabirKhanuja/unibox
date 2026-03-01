import ConnectedClient from "./connected-client";
import { redirect } from "next/navigation";

function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConnectedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const provider = firstParam(params.provider);
  const email = firstParam(params.email);

  if (provider && email) {
    redirect(
      `/mail?provider=${encodeURIComponent(provider)}&email=${encodeURIComponent(email)}`
    );
  }

  return <ConnectedClient provider={provider} email={email} />;
}