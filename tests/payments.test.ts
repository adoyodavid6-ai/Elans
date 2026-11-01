import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { verifyWebhookSignature, toSubunit } from "@/lib/integrations/paystack";
import { darajaTimestamp, normaliseMsisdn, parseC2b, parseStkCallback } from "@/lib/integrations/mpesa";

describe("Paystack", () => {
  const secret = "sk_test_example_secret";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "00000000-0000-4000-8000-000000000abc" } });
  const sig = crypto.createHmac("sha512", secret).update(body).digest("hex");
  it("accepts a correctly signed webhook", () => expect(verifyWebhookSignature(body, sig, secret)).toBe(true));
  it("rejects tampered bodies, wrong secrets and missing signatures", () => {
    expect(verifyWebhookSignature(body.replace("success", "failed"), sig, secret)).toBe(false);
    expect(verifyWebhookSignature(body, sig, "sk_test_other")).toBe(false);
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body, "zz", secret)).toBe(false);
  });
  it("sends amounts in subunits", () => expect(toSubunit(15000.5)).toBe(1500050));
});

describe("M-Pesa", () => {
  it("normalises Kenyan numbers", () => {
    expect(normaliseMsisdn("0712 345 678")).toBe("254712345678");
    expect(normaliseMsisdn("+254 110 000 000")).toBe("254110000000");
    expect(normaliseMsisdn("12345")).toBeNull();
  });
  it("formats the Daraja timestamp in EAT", () => expect(darajaTimestamp(new Date("2026-11-01T09:05:07Z"))).toBe("20261101120507"));
  it("parses a successful STK callback", () => {
    const cb = parseStkCallback({ Body: { stkCallback: { MerchantRequestID: "m", CheckoutRequestID: "ws_CO_1", ResultCode: 0, ResultDesc: "The service request is processed successfully.", CallbackMetadata: { Item: [{ Name: "Amount", Value: 15000 }, { Name: "MpesaReceiptNumber", Value: "TJK4X81QZP" }, { Name: "PhoneNumber", Value: 254712345678 }] } } } });
    expect(cb).toMatchObject({ checkoutRequestId: "ws_CO_1", resultCode: 0, receipt: "TJK4X81QZP", amount: 15000 });
  });
  it("parses a cancelled STK callback", () => {
    expect(parseStkCallback({ Body: { stkCallback: { CheckoutRequestID: "ws_CO_2", ResultCode: 1032, ResultDesc: "Request cancelled by user" } } })?.resultCode).toBe(1032);
    expect(parseStkCallback({ nonsense: true })).toBeNull();
  });
  it("parses C2B confirmations and masks the phone number", () => {
    const c = parseC2b({ TransactionType: "Pay Bill", TransID: "TJK9ABC123", TransTime: "20261101120000", TransAmount: "60000.00", BusinessShortCode: "600000", BillRefNumber: "ELN-2026-1001", MSISDN: "254712345678", FirstName: "Jane", LastName: "Wanjiru" });
    expect(c).toEqual({ transId: "TJK9ABC123", amount: 60000, billRef: "ELN-2026-1001", payer: "Jane Wanjiru 25471•••678" });
  });
});
