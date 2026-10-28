import { round2 } from "./money";

/** Commercial rules (§11.3), encoded so the quote builder enforces them rather than relying on memory. */

export type QuoteLineKind = "setup" | "monthly" | "usage" | "one_off";
export interface QuoteLine {
  kind: QuoteLineKind;
  description: string;
  amount: number; // per unit, major units
  qty: number;
  solution?: string;
  /** Elans' own estimated delivery cost for this line (internal only). */
  cost: number;
}

export interface QuoteInput {
  lines: QuoteLine[];
  termMonths: number;
  discountPct: number; // applied to monthly fees only
  splitSetup: boolean;
  projected90DayValue: number; // client value estimate from the Diagnostic
  marginFloor: number; // fraction, e.g. 0.65
  minTermMonths: number;
}

export type CheckLevel = "ok" | "warn" | "error";
export interface QuoteCheck {
  key: string;
  label: string;
  level: CheckLevel;
  detail: string;
}

export function maxDiscountForTerm(termMonths: number) {
  if (termMonths >= 24) return 15;
  if (termMonths >= 12) return 10;
  return 0;
}

export function evaluateQuote(q: QuoteInput) {
  const sum = (k: QuoteLineKind, field: "amount" | "cost") =>
    round2(q.lines.filter((l) => l.kind === k).reduce((s, l) => s + l[field] * l.qty, 0));
  const setup = sum("setup", "amount") + sum("one_off", "amount");
  const monthlyGross = sum("monthly", "amount");
  const discount = round2(monthlyGross * (q.discountPct / 100));
  const monthly = round2(monthlyGross - discount);
  const usageEstimate = sum("usage", "amount");
  const contractValue = round2(setup + (monthly + usageEstimate) * q.termMonths);
  const cost = round2(sum("setup", "cost") + sum("one_off", "cost") + (sum("monthly", "cost") + sum("usage", "cost")) * q.termMonths);
  const grossMargin = contractValue > 0 ? (contractValue - cost) / contractValue : 0;
  const instalments = q.splitSetup ? [0, 1, 2].map((i) => round2(i < 2 ? Math.floor((setup / 3) * 100) / 100 : setup - 2 * (Math.floor((setup / 3) * 100) / 100))) : [setup];

  const checks: QuoteCheck[] = [];
  const ratioSetup = q.projected90DayValue > 0 ? setup / q.projected90DayValue : null;
  checks.push(
    ratioSetup === null
      ? { key: "setup_value", label: "Setup vs projected 90-day value", level: "warn", detail: "No 90-day value estimate recorded. Capture it in the Diagnostic before sending." }
      : {
          key: "setup_value",
          label: "Setup vs projected 90-day value",
          level: ratioSetup > 0.5 || ratioSetup < 0.2 ? "warn" : "ok",
          detail: `Setup is ${(ratioSetup * 100).toFixed(0)}% of projected 90-day value (guide ≈ 33%).`,
        },
  );
  const ratioMonthly = setup > 0 ? monthly / setup : null;
  checks.push({
    key: "monthly_setup",
    label: "Monthly vs setup",
    level: ratioMonthly === null ? "warn" : ratioMonthly < 0.15 || ratioMonthly > 0.25 ? "warn" : "ok",
    detail: ratioMonthly === null ? "No setup fee." : `Monthly is ${(ratioMonthly * 100).toFixed(0)}% of setup (guide 15–25%).`,
  });
  checks.push({
    key: "margin",
    label: "Gross margin",
    level: grossMargin < q.marginFloor ? "error" : "ok",
    detail: `Gross margin ${(grossMargin * 100).toFixed(1)}% against a floor of ${(q.marginFloor * 100).toFixed(0)}%.`,
  });
  checks.push({
    key: "term",
    label: "Minimum term",
    level: q.termMonths < q.minTermMonths ? "error" : "ok",
    detail: `Term ${q.termMonths} months; minimum ${q.minTermMonths}.`,
  });
  const maxDisc = maxDiscountForTerm(q.termMonths);
  checks.push({
    key: "discount",
    label: "Discount only for term",
    level: q.discountPct > maxDisc ? "error" : "ok",
    detail: q.discountPct > maxDisc ? `A ${q.termMonths}-month term allows up to ${maxDisc}% discount.` : `Discount ${q.discountPct}% (max ${maxDisc}% for this term).`,
  });
  const blocking = checks.some((c) => c.level === "error");
  return {
    totals: { setup, monthlyGross, discount, monthly, usageEstimate, contractValue, cost, grossMargin: Number(grossMargin.toFixed(4)), instalments },
    checks,
    canSend: !blocking,
  };
}
