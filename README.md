# @kabiraa/unibox

Plug-and-play Node.js SDK for multi-provider email OAuth (Gmail, Zoho, Outlook), unified unread-email fetching, and optional AI-powered inbox intelligence.

## Install

```bash
npm install @kabiraa/unibox
```

## Usage (Express)

```ts
import express from "express";
import { createUnibox } from "@kabiraa/unibox";

const app = express();

const unibox = createUnibox({
 // where your frontend is served for oauth redirect
  webBaseUrl: "http://localhost:3000",
  providers: {
    gmail: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: process.env.GOOGLE_REDIRECT_URI!,
    },
    zoho: {
      clientId: process.env.ZOHO_CLIENT_ID!,
      clientSecret: process.env.ZOHO_CLIENT_SECRET!,
      redirectUri: process.env.ZOHO_REDIRECT_URI!,
    },
    outlook: {
      clientId: process.env.OUTLOOK_CLIENT_ID!,
      clientSecret: process.env.OUTLOOK_CLIENT_SECRET!,
      redirectUri: process.env.OUTLOOK_REDIRECT_URI!,
    },
  },
  intelligence: {
    enabled: true,
    // generic llm config is recommended cause it supports other providers as well depending on your use
    // and pricing needs
    llm: {
      provider: "groq", // or openai"or gemini
      apiKey: process.env.GROQ_API_KEY!,
    //model: ,
    },
    //summarizer: async (subject, text) => ({ summary: "...", importanceScore: 5 }),
    //or can bring your own summarizer logic
  },
});

// this creates /auth/gmail, /auth/gmail/callback, /auth/gmail/unread etc routes for all providers based on 
// your config
app.use("/auth", unibox.router());

app.listen(4000);
```

## Routes

When mounted at `/auth`:

- `GET /auth/gmail`
- `GET /auth/gmail/callback`
- `GET /auth/gmail/unread?email=...`
- `GET /auth/zoho?email=...` (automatic region picker based on the email domain)
- `GET /auth/zoho/in?email=...`
- `GET /auth/zoho/com?email=...`
- `GET /auth/zoho/callback`
- `GET /auth/zoho/unread?email=...`
- `GET /auth/outlook`
- `GET /auth/outlook/callback`
- `GET /auth/outlook/unread?email=...`

## Token storage

By default, Unibox uses an in-memory token store (good for local dev). For production, pass your own `tokenStore` implementing the exported `TokenStore` interface.

## Intelligence (Groq / GPT / Gemini / custom)

Unibox’s intelligence layer is **dynamic**:

- Use `intelligence.llm` to pick a built-in provider (`groq`, `openai`, `gemini`)
- Or pass `intelligence.summarizer` to bring your own implementation

Precedence: `summarizer` → `llm` → legacy `groq`.

### Built-in LLM config examples

```ts
createUnibox({
  providers: { /* ... */ },
  intelligence: {
    enabled: true,
    llm: { provider: "openai", apiKey: process.env.OPENAI_API_KEY!, model: "gpt-4.1-mini" },
  },
});

createUnibox({
  providers: { /* ... */ },
  intelligence: {
    enabled: true,
    llm: { provider: "gemini", apiKey: process.env.GEMINI_API_KEY!, model: "gemini-1.5-flash" },
  },
});
```

### Legacy Groq config (still supported)

```ts
createUnibox({
  providers: { /* ... */ },
  intelligence: {
    enabled: true,
    groq: { apiKey: process.env.GROQ_API_KEY! },
  },
});
```

### Custom summarizer (example: OpenAI-compatible)

```ts
import type { EmailSummarizer } from "@kabiraa/unibox";

const summarizer: EmailSummarizer = async (subject, text) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content:
            `Return ONLY JSON: {"summary":"...","importanceScore":number}.\n` +
            `Subject: ${subject}\nBody: ${text.slice(0, 4000)}`,
        },
      ],
      temperature: 0.1,
    }),
  });

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(content);
  return { summary: parsed.summary, importanceScore: parsed.importanceScore };
};

createUnibox({
  providers: { /* ... */ },
  intelligence: { enabled: true, summarizer },
});
```

### Custom summarizer (example: Gemini)

Same idea: call Gemini from inside `summarizer` and return `{ summary, importanceScore }`.

## Next.js buttons (optional)

Your frontend buttons should only *start* OAuth by redirecting the browser to your backend routes (the ones created by `unibox.router()`). They do not contain OAuth logic.

### Next.js App Router component

```tsx
"use client";

import type { Provider } from "@kabiraa/unibox";

type UniboxConnectButtonProps = {
  provider: Provider;
  /** where your backend mounted `unibox.router()`, e.g. "https://api.example.com/auth" or "/auth" */
  authBaseUrl?: string;
  children?: React.ReactNode;
};

export function UniboxConnectButton({ provider, authBaseUrl = "/auth", children }: UniboxConnectButtonProps) {
  const href = `${authBaseUrl.replace(/\/$/, "")}/${provider}`;

  return (
    <button type="button" onClick={() => (window.location.href = href)}>
      {children ?? `Sign in with ${provider}`}
    </button>
  );
}
```

### Usage example

```tsx
import { UniboxConnectButton } from "./UniboxConnectButton";

export default function ConnectPage() {
  return (
    <div>
      <UniboxConnectButton provider="gmail" authBaseUrl={process.env.NEXT_PUBLIC_API_AUTH_BASE_URL} />
      <UniboxConnectButton provider="zoho" authBaseUrl={process.env.NEXT_PUBLIC_API_AUTH_BASE_URL} />
      <UniboxConnectButton provider="outlook" authBaseUrl={process.env.NEXT_PUBLIC_API_AUTH_BASE_URL} />
    </div>
  );
}
```
