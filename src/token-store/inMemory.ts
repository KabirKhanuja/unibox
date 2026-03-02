import type { Provider, TokenRecordByProvider, TokenStore } from "../types.js";

function normalizeEmailKey(email: string) {
  return email.trim().toLowerCase();
}

// this is used for storing tokens in memory
// tho not for production use

export function createInMemoryTokenStore(): TokenStore {
  const store = new Map<string, unknown>();

  function key(provider: Provider, email: string) {
    return `${provider}:${normalizeEmailKey(email)}`;
  }

  return {
    async get<P extends Provider>(provider: P, email: string) {
      return store.get(key(provider, email)) as TokenRecordByProvider[P] | undefined;
    },
    async set<P extends Provider>(provider: P, email: string, tokens: TokenRecordByProvider[P]) {
      store.set(key(provider, email), tokens);
    },
    async delete(provider: Provider, email: string) {
      store.delete(key(provider, email));
    },
  };
}
