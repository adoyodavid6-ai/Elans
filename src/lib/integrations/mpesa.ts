import "server-only";

/**
 * M-Pesa Daraja adaptor (STK Push). Modes:
 *  - mock:       no network; payments complete via an explicit, clearly labelled test action
 *  - sandbox:    Safaricom sandbox (requires sandbox credentials)
 *  - production: requires Safaricom Go-Live approval
 * Status shown in the integration directory: "Planned" until production credentials exist.
 */
export type MpesaMode = "mock" | "sandbox" | "production";
export const mpesaMode = (): MpesaMode => {
  const m = process.env.MPESA_ENV as MpesaMode | undefined;
  if (m === "sandbox" || m === "production") return process.env.MPESA_CONSUMER_KEY ? m : "mock";
  return "mock";
};
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

function timestamp(d = new Date()) {
  // Daraja expects EAT (UTC+3) in yyyyMMddHHmmss
  const eat = new Date(d.getTime() + 3 * 3600_000);
  return eat.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

async function token(): Promise<string> {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { authorization: `Basic ${auth}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Daraja auth failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
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
  const ts = timestamp();
  const password = Buffer.from(`${shortcode}${process.env.MPESA_PASSKEY}${ts}`).toString("base64");
  try {
    const res = await fetch(`${base()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(p.amount),
        PartyA: p.phone,
        PartyB: shortcode,
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
