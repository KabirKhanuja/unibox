import type { ConnectUrlOptions } from "./types.js";

export function connectUrl(options: ConnectUrlOptions): string {
  const authBaseUrl = (options.authBaseUrl ?? "/auth").replace(/\/$/, "");

  if (options.provider === "zoho") {
    const email = options.email?.trim();
    if (!email) {
      throw new Error("connectUrl(): `email` is required for provider=zoho");
    }

    if (options.zohoRegion === "in" || options.zohoRegion === "com") {
      return `${authBaseUrl}/zoho/${options.zohoRegion}?email=${encodeURIComponent(email)}`;
    }

    return `${authBaseUrl}/zoho?email=${encodeURIComponent(email)}`;
  }

  return `${authBaseUrl}/${options.provider}`;
}
