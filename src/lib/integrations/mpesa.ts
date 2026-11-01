import "server-only";

/**
 * M-Pesa Daraja adaptor: STK Push (Lipa na M-Pesa Online), STK status query, and C2B URL registration.
 * Modes:
 *  - mock:       no network; payments complete via an explicit, clearly labelled test action
 *  - sandbox:    Safaricom sandbox (sandbox app credentials)
 *  - production: live, after Safaricom Go-Live approval
 *
 * Configuration (environment variables; see README → Payments):
 *  MPESA_ENV=mock|sandbox|production, MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET,
 *  MPESA_SHORTCODE (paybill number, or the store/head-office number for a till), MPESA_PASSKEY,
 *  MPESA_TILL_NUMBER (optional: set for Buy Goods; leave empty for Paybill), MPESA_CALLBACK_URL (optional public base URL).
 */
export type MpesaMode = "mock" | "sandbox" | "production";
const REQUIRED = ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_SHORTCODE", "MPESA_PASSKEY"] as const;

export const mpesaMode = (): MpesaMode => {
  const m = process.env.MPESA_ENV as MpesaMode | undefined;
  if ((m === "sandbox" || m === "production") && REQUIRED.every((k) => process.env[k])) return m;
  return "mock";
};

/** Which settings are present (never their values), for the console's Payments page. */
export function mpesaConfigStatus() {
  const want = process.env.MPESA_ENV ?? "mock";
  return {
    requested: want,
    mode: mpesaMode(),
    vars: [...REQUIRED, "MPESA_TILL_NUMBER", "MPESA_CALLBACK_URL"].map((k) => ({ key: k, set: Boolean(process.env[k]), optional: k === "MPESA_TILL_NUMBER" || k === "MPESA_CALLBACK_URL" })),
    missing: (want === "sandbox" || want === "production") ? REQUIRED.filter((k) => !process.env[k]) : [],
    type: process.env.MPESA_TILL_NUMBER ? "Buy Goods (till)" : "Paybill",
  };
}

const base = () => (mpesaMode() === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke");

/** Normalises Kenyan numbers to 2547XXXXXXXX / 2541XXXXXXXX. Returns null if invalid. */
export function normaliseMsisdn(input: string): string | null {
  const d = input.replace(/[^\d]/g, "");
  let n = d;
  if (/^0[17]\d{8}$/.test(d)) n = `254${d.slice(1)}`;
  else if (/^[17]\d{8}$/.test(d)) n = `254${d}`;
  else if (/^254[17]\d{8}$/.test(d)) n = d;
  else return null;
  return n;
}

export function darajaTimestamp(d = new Date()) {
  // Daraja expects EAT (UTC+3) in yyyyMMddHHmmss
  const eat = new Date(d.getTime() + 3 * 3600_000);
  return eat.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

let cached: { token: string; until: number; mode: MpesaMode } | null = null;
async function token(): Promise<string> {
  if (cached && cached.until > Date.now() && cached.mode === mpesaMode()) return cached.token;
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { authorization: `Basic ${auth}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Daraja authentication failed (${res.status}). Check the consumer key and secret.`);
  const body = (await res.json()) as { access_token: string; expires_in?: string };
  // Tokens last 3600s; refresh a few minutes early.
  cached = { token: body.access_token, until: Date.now() + (Number(body.expires_in ?? 3599) - 300) * 1000, mode: mpesaMode() };
  return body.access_token;
}

function stkPassword(ts: string) {
  return Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${ts}`).toString("base64");
}

export interface StkResult {
  ok: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  message: string;
  mode: MpesaMode;
}

export async function stkPush(p: { phone: string; amount: number; reference: string; description: string; callbackUrl: string }): Promise<StkResult> {
  const mode = mpesaMode();
  if (mode === "mock") return { ok: true, checkoutRequestId: `mock_${Date.now().toString(36)}`, merchantRequestId: "mock", message: "Test mode: no real payment request was sent.", mode };
  const shortcode = process.env.MPESA_SHORTCODE!;
  const till = process.env.MPESA_TILL_NUMBER;
  const ts = darajaTimestamp();
  try {
    const res = await fetch(`${base()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: stkPassword(ts),
        Timestamp: ts,
        TransactionType: till ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
        Amount: Math.max(1, Math.round(p.amount)),
        PartyA: p.phone,
        PartyB: till || shortcode,
        PhoneNumber: p.phone,
        CallBackURL: p.callbackUrl,
        AccountReference: p.reference.slice(0, 12),
        TransactionDesc: p.description.slice(0, 13),
      }),
      cache: "no-store",
    });
    const body = (await res.json()) as { ResponseCode?: string; CheckoutRequestID?: string; MerchantRequestID?: string; CustomerMessage?: string; errorMessage?: string };
    if (body.ResponseCode === "0") return { ok: true, checkoutRequestId: body.CheckoutRequestID, merchantRequestId: body.MerchantRequestID, message: body.CustomerMessage ?? "Check your phone to approve the payment.", mode };
    return { ok: false, message: body.errorMessage ?? "M-Pesa did not accept the request.", mode };
  } catch (e) {
    return { ok: false, message: `M-Pesa is unavailable: ${(e as Error).message}`, mode };
  }
}

/**
 * STK status query: used when a callback has not arrived (callbacks can be lost). ResultCode 0 = paid;
 * 1032 = cancelled by user; 1037 = no response from phone; 1 = insufficient funds; others = failed.
 * Returns null while the request is still being processed.
 */
export async function stkQuery(checkoutRequestId: string): Promise<{ resultCode: number; resultDesc: string } | null> {
  if (mpesaMode() === "mock") return null;
  const ts = darajaTimestamp();
  const res = await fetch(`${base()}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" },
    body: JSON.stringify({ BusinessShortCode: process.env.MPESA_SHORTCODE, Password: stkPassword(ts), Timestamp: ts, CheckoutRequestID: checkoutRequestId }),
    cache: "no-store",
  });
  const body = (await res.json()) as { ResultCode?: string; ResultDesc?: string; errorCode?: string; errorMessage?: string };
  if (body.ResultCode === undefined) return null; // still processing ("The transaction is being processed")
  return { resultCode: Number(body.ResultCode), resultDesc: String(body.ResultDesc ?? "") };
}

/** Registers the C2B confirmation and validation URLs for the shortcode (paybill/till payments made from the phone menu). */
export async function registerC2bUrls(confirmationUrl: string, validationUrl: string): Promise<{ ok: boolean; message: string }> {
  if (mpesaMode() === "mock") return { ok: false, message: "M-Pesa is in test mode. Add the Daraja settings first." };
  try {
    const res = await fetch(`${base()}/mpesa/c2b/v1/registerurl`, {
      method: "POST",
      headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" },
      body: JSON.stringify({ ShortCode: process.env.MPESA_TILL_NUMBER || process.env.MPESA_SHORTCODE, ResponseType: "Completed", ConfirmationURL: confirmationUrl, ValidationURL: validationUrl }),
      cache: "no-store",
    });
    const body = (await res.json()) as { ResponseCode?: string; ResponseDescription?: string; errorMessage?: string };
    return body.ResponseCode === "0" || /success/i.test(body.ResponseDescription ?? "") ? { ok: true, message: body.ResponseDescription ?? "URLs registered." } : { ok: false, message: body.errorMessage ?? body.ResponseDescription ?? `Daraja returned ${res.status}` };
  } catch (e) {
    return { ok: false, message: `M-Pesa is unavailable: ${(e as Error).message}` };
  }
}

/** Checks the credentials by requesting an access token. */
export async function testMpesaConnection(): Promise<{ ok: boolean; message: string }> {
  if (mpesaMode() === "mock") return { ok: false, message: "M-Pesa is in test mode: set MPESA_ENV and the Daraja settings to connect." };
  try {
    cached = null;
    await token();
    return { ok: true, message: `Connected to the Daraja ${mpesaMode()} environment.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export interface StkCallback {
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  receipt?: string;
  amount?: number;
  phone?: string;
}
export function parseStkCallback(body: unknown): StkCallback | null {
  const cb = (body as { Body?: { stkCallback?: Record<string, unknown> } })?.Body?.stkCallback;
  if (!cb || typeof cb.CheckoutRequestID !== "string") return null;
  const items = ((cb.CallbackMetadata as { Item?: { Name: string; Value?: string | number }[] })?.Item ?? []) as { Name: string; Value?: string | number }[];
  const get = (n: string) => items.find((i) => i.Name === n)?.Value;
  return {
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: Number(cb.ResultCode),
    resultDesc: String(cb.ResultDesc ?? ""),
    receipt: get("MpesaReceiptNumber") as string | undefined,
    amount: get("Amount") !== undefined ? Number(get("Amount")) : undefined,
    phone: get("PhoneNumber") !== undefined ? String(get("PhoneNumber")) : undefined,
  };
}

export interface C2bConfirmation {
  transId: string;
  amount: number;
  billRef: string;
  payer: string;
}
/** Parses a C2B confirmation/validation body. The payer's phone is masked before storage (data minimisation). */
export function parseC2b(body: unknown): C2bConfirmation | null {
  const b = body as Record<string, unknown>;
  if (!b || typeof b.TransID !== "string" || b.TransAmount === undefined) return null;
  const name = [b.FirstName, b.MiddleName, b.LastName].filter((x) => typeof x === "string" && x).join(" ");
  const msisdn = String(b.MSISDN ?? "");
  const masked = msisdn.length > 6 ? `${msisdn.slice(0, 5)}•••${msisdn.slice(-3)}` : "";
  return { transId: b.TransID, amount: Number(b.TransAmount), billRef: String(b.BillRefNumber ?? ""), payer: [name, masked].filter(Boolean).join(" ") };
}
