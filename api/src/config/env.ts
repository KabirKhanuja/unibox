import dotenv from "dotenv";
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function requireEnvAny(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  throw new Error(`Missing required env var: ${keys.join(" | ")}`);
}

export const env = {
  PORT: process.env.PORT || "4000",

  WEB_BASE_URL: process.env.WEB_BASE_URL || "http://localhost:3000",

  // gmail
  GOOGLE_CLIENT_ID: requireEnv("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: requireEnv("GOOGLE_CLIENT_SECRET"),
  GOOGLE_REDIRECT_URI: requireEnv("GOOGLE_REDIRECT_URI"),
 
  // zoho
  ZOHO_CLIENT_ID: requireEnv("ZOHO_CLIENT_ID"),
  ZOHO_CLIENT_SECRET: requireEnv("ZOHO_CLIENT_SECRET"),
  ZOHO_REDIRECT_URI: requireEnv("ZOHO_REDIRECT_URI"),

  // outlook
  OUTLOOK_CLIENT_ID: requireEnv("OUTLOOK_CLIENT_ID"),
  OUTLOOK_CLIENT_SECRET: requireEnvAny([
    "OUTLOOK_CLIENT_SECRET",
    "OUTLOOK_SECRET",
    "OUTLOOK_SECRET_VALUE",
  ]),
  OUTLOOK_REDIRECT_URI: requireEnv("OUTLOOK_REDIRECT_URI"),

};
