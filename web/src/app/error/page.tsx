import Link from "next/link";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function ErrorPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const provider = firstParam(searchParams.provider) ?? "unknown";

  return (
    <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-zinc-50 to-zinc-100 p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-xl space-y-3">
        <h1 className="text-xl font-semibold">Connection failed</h1>
        <p className="text-sm text-zinc-600">
          We couldn’t connect {provider.toUpperCase()}. Please try again.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
