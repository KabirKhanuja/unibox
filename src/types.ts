export type Provider = "gmail" | "zoho" | "outlook";

export type ConnectUrlOptions = {
  provider: Provider;
  authBaseUrl?: string;
  email?: string;
  zohoRegion?: "in" | "com";
};

export type RawEmail = {
  id: string;
  subject: string;
  from: string;
  date: string;
  body?: string;
  snippet?: string;
  permalink?: string;
};

export type UnifiedEmail = RawEmail & {
  provider: Provider;
  // the connected mailbox address for which this email was fetched
  mailboxEmail: string;
};

export type NormalizedEmail = {
  id: string;
  subject: string;
  from: string;
  date: string;
  text: string;
  permalink?: string;
  provider: Provider;
  mailboxEmail: string;
};

export type EnrichedEmail = NormalizedEmail & {
  summary: string;
  importanceScore: number;
};

export type EmailSummarizer = (
  subject: string,
  text: string
) => Promise<{ summary: string; importanceScore: number }>;

export type LlmProvider = "groq" | "openai" | "gemini";

export type LlmConfig = {
  provider: LlmProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string;
};

export type GmailTokenRecord = {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
};

export type ZohoRegion = "in" | "com" | "eu" | "com.au" | "jp";

export type ZohoTokenRecord = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  api_domain?: string;
  expires_at?: number;
  region?: ZohoRegion;
};

export type OutlookTokenRecord = {
  homeAccountId: string;
  accessToken: string;
  expiresOn?: Date;
  email: string;
};

export type TokenRecordByProvider = {
  gmail: GmailTokenRecord;
  zoho: ZohoTokenRecord;
  outlook: OutlookTokenRecord;
};

export interface TokenStore {
  get<P extends Provider>(provider: P, email: string): Promise<TokenRecordByProvider[P] | undefined>;
  set<P extends Provider>(provider: P, email: string, tokens: TokenRecordByProvider[P]): Promise<void>;
  delete(provider: Provider, email: string): Promise<void>;
}

export type UniboxRedirectBuilder = (params: {
  provider: Provider;
  email?: string;
  error?: string;
}) => string;

export type UniboxConfig = {
  webBaseUrl?: string;
  redirects?: {
    onSuccess?: UniboxRedirectBuilder;
    onError?: UniboxRedirectBuilder;
  };

  tokenStore?: TokenStore;

  mail?: {
    maxResults?: number;
  };

  providers: {
    gmail?: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    };
    zoho?: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    };
    outlook?: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      authority?: string; 
    };
  };

  intelligence?: {
    enabled?: boolean;

    summarizer?: EmailSummarizer;

    llm?: LlmConfig;
    /** @deprecated use intelligence.llm instead */
    groq?: {
      apiKey: string;
      model?: string;
    };
  };
};

export type UniboxInstance = {
  router(): import("express").Router;
  fetchUnread(params: { provider: Provider; email: string }): Promise<UnifiedEmail[] | EnrichedEmail[]>;
  connectUrl(options: ConnectUrlOptions): string;
};
