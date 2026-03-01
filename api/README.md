# Auth Service API

Local authentication and mail-read integration for Gmail and Zoho.
Designed as a reusable service that can be consumed by multiple applications.

## Overview

This service provides:

- OAuth-based authentication for Gmail and Zoho
- Retrieval of unread emails after successful OAuth
- A provider-agnostic structure that can be extended (Outlook, Yahoo, etc.)
- Environment-driven configuration (no hardcoded credentials)

Note: Token storage is currently dev-focused (in-memory + local cache). For production, tokens should be encrypted and stored in a database.

## Prerequisites

- Node.js (v18+ recommended)
- npm
- Access to:
  - Google Cloud Console (for Gmail)
  - Zoho API Console (for Zoho)

## Project Setup

From the repository root:

```bash
cd api
npm install
```

## Environment Variables

Create `api/.env` (already ignored via `.gitignore`):

```bash
PORT=4000

# Used for redirects back to the frontend (optional)
WEB_BASE_URL=http://localhost:3000

# Gmail
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/gmail/callback

# Zoho
ZOHO_CLIENT_ID=your-zoho-client-id
ZOHO_CLIENT_SECRET=your-zoho-client-secret
ZOHO_REDIRECT_URI=http://localhost:4000/auth/zoho/callback

# Outlook (Microsoft)
OUTLOOK_CLIENT_ID=your-azure-app-client-id
OUTLOOK_CLIENT_SECRET=your-azure-app-client-secret
OUTLOOK_REDIRECT_URI=http://localhost:4000/auth/outlook/callback

# Groq (for email summaries)
GROQ_API_KEY=your-groq-api-key
```

Notes:

- Redirect URIs must exactly match what is configured in the provider console
- For production, always use HTTPS redirect URIs
- Zoho tokens are cached locally during development to survive restarts
- Outlook uses Microsoft Entra ID (Azure AD) App Registration credentials
- `GROQ_API_KEY` is required for the email summarization step

## Running the API

```bash
cd api
npm run dev
```

Server starts at:

- `http://localhost:4000`

## Gmail OAuth Setup (Google Cloud Console)

### 1) Create or Select a Google Cloud Project

- Go to Google Cloud Console
- Create a new project (e.g., "PineVox Auth Service") or select an existing one

### 2) Enable Gmail API

- APIs & Services → Library
- Search "Gmail API"
- Click Enable

### 3) Configure OAuth Consent Screen

- APIs & Services → OAuth consent screen
- User Type: External (unless Workspace)
- Fill required fields (app name, support email, developer email)
- Add scopes:
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/userinfo.email`
- Add test users if the app is in Testing mode

### 4) Create OAuth Credentials

- APIs & Services → Credentials
- Create OAuth Client ID
- Application type: Web application
- Authorized redirect URI:
  - `http://localhost:4000/auth/gmail/callback`
- Copy Client ID and Client Secret into `.env`

### 5) Publish App (Optional)

- Required for unrestricted production access
- For development, Testing mode + test users is sufficient

## Gmail API Endpoints

- Start Gmail OAuth:
  - `GET /auth/gmail`
- Fetch unread Gmail emails (after OAuth):
  - `GET /gmail/unread?email=EMAIL_RETURNED_BY_OAUTH`

## Outlook OAuth Setup (Microsoft Entra ID / Azure Portal)

Outlook integration uses Microsoft Graph via an Entra ID (Azure AD) App Registration.

### 1) Create an App Registration

- Go to Azure Portal → Microsoft Entra ID → App registrations → New registration
- Name: anything (e.g., "PineVox Auth Service")
- Supported account types: typically **Accounts in any organizational directory and personal Microsoft accounts**
- Redirect URI:
  - Platform: **Web**
  - URI: `http://localhost:4000/auth/outlook/callback`

### 2) Create a Client Secret

- App registrations → (your app) → Certificates & secrets → New client secret
- Copy the **Value** (not the Secret ID)
- Set it as `OUTLOOK_CLIENT_SECRET` in `api/.env`

### 3) Copy the Client ID

- App registrations → (your app) → Overview
- Copy **Application (client) ID**
- Set it as `OUTLOOK_CLIENT_ID` in `api/.env`

### 4) Configure API Permissions (Microsoft Graph)

- App registrations → (your app) → API permissions → Add a permission
- Microsoft Graph → Delegated permissions
- Add (minimum):
  - `Mail.Read`
  - `User.Read`

Notes:

- This service requests `offline_access` to obtain refresh capability.
- If your tenant requires admin consent, grant consent after adding permissions.

## Outlook API Endpoints

- Start Outlook OAuth:
  - `GET /auth/outlook`
- OAuth callback (must match redirect URI):
  - `GET /auth/outlook/callback`
- Fetch unread Outlook emails (after OAuth):
  - `GET /outlook/unread?email=EMAIL_RETURNED_BY_OAUTH`

## Zoho OAuth Setup (Zoho API Console)

Zoho OAuth credentials are created in the Zoho API Console.
This service supports multiple Zoho regions.

### 1) Create Zoho API Client

- Go to Zoho API Console
- Create a new client
- Client type: Server-based / Web
- Redirect URI:
  - `http://localhost:4000/auth/zoho/callback`
- Copy Client ID and Client Secret into `.env`

### 2) Required Scopes

Ensure the following scopes are enabled:

- `ZohoMail.messages.READ`
- `ZohoMail.accounts.READ`

If API calls fail, verify scope approval in the Zoho console.

## Zoho API Endpoints

- Start Zoho OAuth (auto / smart):
  - `GET /auth/zoho?email=YOUR_EMAIL`
- India region:
  - `GET /auth/zoho/in?email=YOUR_EMAIL`
- US / Global region:
  - `GET /auth/zoho/com?email=YOUR_EMAIL`
- If email is omitted, a small prompt page is shown:
  - `GET /auth/zoho/in`
- Check token status:
  - `GET /zoho/status?email=YOUR_EMAIL`
- Fetch unread Zoho emails (after OAuth):
  - `GET /zoho/unread?email=YOUR_EMAIL`

## Dependencies

Core dependencies used by this service:

```bash
npm install google-auth-library axios
```

- `google-auth-library` – Gmail OAuth
- `axios` – Zoho API requests

## Important Notes

- OAuth tokens are dev-only in-memory + local cache
- Restarting the server clears in-memory tokens
- For production:
  - Encrypt tokens
  - Store them in a database
  - Use HTTPS redirect URIs
- Google OAuth in Testing mode only allows added test users
- Published Google apps require verification for public access

## Groq API (Email Summaries)

This service enriches fetched emails with a short summary and an importance score using Groq's OpenAI-compatible Chat Completions endpoint.

### 1) Get a Groq API Key

- Create an API key from the Groq console
- Set it in `api/.env` as `GROQ_API_KEY`

### 2) How it’s used

- The summarizer calls `https://api.groq.com/openai/v1/chat/completions`
- Default model is `llama-3.1-8b-instant` (see `src/services/email-intelligence/summarize.ts`)

If `GROQ_API_KEY` is missing/invalid, the summarization step will fail and email enrichment may error.

