/** Money is formatted here only; arithmetic happens on plain numbers in major units, rounded at the edges. */
export function formatMoney(amount: number | null | undefined, currency = "KES", opts: { compact?: boolean } = {}): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "Quoted";
  const abs = Math.abs(amount);
  if (opts.compact && abs >= 1_000_000) {
    return `${currency} ${(amount / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`;
  }
  return `${currency} ${Math.round(amount).toLocaleString("en-GB")}`;
}

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatPct(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
