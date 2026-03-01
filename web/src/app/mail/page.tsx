import MailClient from "./mail-client";

function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const provider = firstParam(params.provider);
  const email = firstParam(params.email);

  return <MailClient provider={provider} email={email} />;
}