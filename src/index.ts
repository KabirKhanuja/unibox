export { createUnibox } from "./createUnibox.js";

export { createInMemoryTokenStore } from "./token-store/inMemory.js";

// public provider wrappers
// these are the main public methods for handling auth and token exchange for each provider
export * as gmail from "./providers/gmail.js";
export * as zoho from "./providers/zoho.js";
export * as outlook from "./providers/outlook.js";

//intellgience is totally optional 
// but it's a good feature to have for summarization of emails
// you get it in a package so you can choose to use it or not 

// groq is what i used, you can use other llm providers for which ive provided the templates in the intelligence folder
export { createGroqSummarizer } from "./intelligence/groq.js";
export { createLlmSummarizer } from "./intelligence/llm.js";
export { processEmails } from "./intelligence/pipeline.js";

// types are reexported from the main entry point for easier imports in user code
export type {
  Provider,
  RawEmail,
  UnifiedEmail,
  NormalizedEmail,
  EnrichedEmail,
  EmailSummarizer,
  LlmProvider,
  LlmConfig,
  TokenStore,
  UniboxConfig,
  UniboxInstance,
  GmailTokenRecord,
  ZohoTokenRecord,
  ZohoRegion,
  OutlookTokenRecord,
} from "./types.js";
