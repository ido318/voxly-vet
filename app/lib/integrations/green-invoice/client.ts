import { AppError } from "@/lib/errors/app-error";
import { apiBaseUrl, getGreenInvoiceConfig, tokenEndpoint } from "@/lib/integrations/green-invoice/config";

// Document type 300 = "חשבון עסקה" (Cheshbon Iska) — an unpaid transaction
// invoice requesting payment, as opposed to 320/400 which represent a
// completed/paid receipt. This is the type that produces a payable document.
const DOCUMENT_TYPE_INVOICE = 300;

// The hosted document URL (`url.he`) only surfaces a "pay now" button when
// the clinic's Green Invoice account has online payments enabled — verify
// this in the account before relying on it in production (see plan notes).

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

const TOKEN_SAFETY_MARGIN_SECONDS = 60;

async function fetchAccessToken(): Promise<string> {
  const config = getGreenInvoiceConfig();
  if (!config) {
    throw AppError.serviceUnavailable("Green Invoice is not configured (missing API credentials)");
  }

  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && now < tokenCache.expiresAt - TOKEN_SAFETY_MARGIN_SECONDS) {
    return tokenCache.accessToken;
  }

  let response: Response;
  try {
    response = await fetch(tokenEndpoint(config.env), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: config.apiKeyId,
        client_secret: config.apiKeySecret,
      }),
    });
  } catch (error) {
    throw AppError.externalProvider("Failed to reach Green Invoice auth endpoint", error);
  }

  const body = (await response.json().catch(() => null)) as
    | { accessToken?: string; expiresAt?: number }
    | null;

  if (!response.ok || !body?.accessToken) {
    throw AppError.externalProvider("Green Invoice authentication failed", {
      status: response.status,
      body,
    });
  }

  tokenCache = {
    accessToken: body.accessToken,
    expiresAt: typeof body.expiresAt === "number" ? body.expiresAt : now + 3600,
  };
  return tokenCache.accessToken;
}

export type GreenInvoiceIncomeItem = {
  description: string;
  quantity: number;
  price: number;
};

export type CreateDocumentInput = {
  client: {
    name: string;
    taxId?: string;
    phone?: string;
    emails?: string[];
  };
  income: GreenInvoiceIncomeItem[];
  remarks?: string;
};

export type CreatedGreenInvoiceDocument = {
  documentId: string;
  number: string | number;
  paymentUrl: string;
};

export async function createInvoiceDocument(
  input: CreateDocumentInput,
): Promise<CreatedGreenInvoiceDocument> {
  const config = getGreenInvoiceConfig();
  if (!config) {
    throw AppError.serviceUnavailable("Green Invoice is not configured (missing API credentials)");
  }

  const accessToken = await fetchAccessToken();

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl(config.env)}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        type: DOCUMENT_TYPE_INVOICE,
        lang: "he",
        currency: "ILS",
        client: {
          name: input.client.name,
          taxId: input.client.taxId,
          phone: input.client.phone,
          emails: input.client.emails,
          self: true,
        },
        income: input.income.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          currency: "ILS",
        })),
        remarks: input.remarks,
      }),
    });
  } catch (error) {
    throw AppError.externalProvider("Failed to reach Green Invoice documents endpoint", error);
  }

  const body = (await response.json().catch(() => null)) as
    | { id?: string; number?: string | number; url?: { he?: string; origin?: string } }
    | null;

  if (!response.ok || !body?.id || !body.url?.he) {
    throw AppError.externalProvider("Green Invoice document creation failed", {
      status: response.status,
      body,
    });
  }

  return {
    documentId: body.id,
    number: body.number ?? "",
    paymentUrl: body.url.he,
  };
}
