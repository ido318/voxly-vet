export type GreenInvoiceEnv = "sandbox" | "live";

export type GreenInvoiceConfig = {
  apiKeyId: string;
  apiKeySecret: string;
  env: GreenInvoiceEnv;
};

const TOKEN_ENDPOINTS: Record<GreenInvoiceEnv, string> = {
  live: "https://api.morning.co/idp/v1/oauth/token",
  sandbox: "https://api.sandbox.morning.dev/idp/v1/oauth/token",
};

const API_BASE_URLS: Record<GreenInvoiceEnv, string> = {
  live: "https://api.greeninvoice.co.il/api/v1",
  sandbox: "https://sandbox.d.greeninvoice.co.il/api/v1",
};

export function getGreenInvoiceConfig(): GreenInvoiceConfig | null {
  const apiKeyId = process.env.GREEN_INVOICE_API_KEY_ID?.trim();
  const apiKeySecret = process.env.GREEN_INVOICE_API_KEY_SECRET?.trim();
  if (!apiKeyId || !apiKeySecret) return null;

  const env = process.env.GREEN_INVOICE_ENV?.trim() === "live" ? "live" : "sandbox";
  return { apiKeyId, apiKeySecret, env };
}

export function tokenEndpoint(env: GreenInvoiceEnv): string {
  return TOKEN_ENDPOINTS[env];
}

export function apiBaseUrl(env: GreenInvoiceEnv): string {
  return API_BASE_URLS[env];
}
