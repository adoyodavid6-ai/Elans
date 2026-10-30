import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { internal } from "@/lib/db";
import { formatMoney } from "@/lib/core/money";
import type { QuoteLine } from "@/lib/core/quote";
import { acceptQuote } from "@/app/actions/quote";
import { Callout, Container, Section } from "@/components/ui/primitives";
import { TreeMark } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Your proposal", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ accepted?: string; error?: string }> };

export default async function QuoteView({ params, searchParams }: Props) {
  const { token } = await params;
  const sp = await searchParams;
  const q = await internal(async (tx) => {
    const [row] = await tx<{ number: string; status: string; lines: QuoteLine[]; term_months: number; split_setup: boolean; totals: { setup: number; monthly: number; usageEstimate: number; contractValue: number; discountPct?: number; instalments: number[] }; sent_at: Date; accepted_name: string | null; opportunity_id: string }[]>`select * from quotes where public_token = ${token}`;
    if (!row) return null;
    const [o] = await tx<{ name: string; organisation: string | null; email: string | null }[]>`select o.name, c.organisation, c.email from opportunities o left join leads l on l.id = o.lead_id left join contacts c on c.id = l.contact_id where o.id = ${row.opportunity_id}`;
    return { ...row, o };
  }).catch(() => null);
  if (!q || q.status === "draft") notFound();
  const t = q.totals;
  const kindLabel: Record<string, string> = { setup: "One-off setup", one_off: "One-off", monthly: "Monthly", usage: "Usage (estimate, monthly)" };
  return (
    <Section>
      <Container className="max-w-3xl">
        <div className="rounded-[2rem] border border-line bg-white p-6 sm:p-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><TreeMark size={36} /><span className="font-display text-xl font-bold">Elans</span></div>
            <span className="text-sm text-muted">Proposal {q.number}</span>
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold">{q.o?.organisation ?? q.o?.name}</h1>
          <p className="text-muted">{q.o?.name} · sent {new Date(q.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
          {sp.accepted && <Callout tone="success" className="mt-6" title="Proposal accepted">Thank you. We have sent an invitation to activate your client portal, and your accountable engineer will be in touch to book the kick-off.</Callout>}
          <table className="mt-8 w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><tr><th className="py-2">Item</th><th>Type</th><th className="text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-line">
              {q.lines.map((l, i) => <tr key={i}><td className="py-2.5">{l.description}{l.qty !== 1 ? ` × ${l.qty}` : ""}</td><td className="text-muted">{kindLabel[l.kind]}</td><td className="text-right font-medium">{formatMoney(l.amount * l.qty)}</td></tr>)}
            </tbody>
          </table>
          <dl className="mt-6 space-y-1.5 rounded-2xl bg-teal-50 p-4 text-sm">
            <div className="flex justify-between"><dt>Setup{q.split_setup ? " (in 3 instalments)" : ""}</dt><dd className="font-semibold">{formatMoney(t.setup)}</dd></div>
            <div className="flex justify-between"><dt>Monthly{t.discountPct ? ` (incl. ${t.discountPct}% term discount)` : ""}</dt><dd className="font-semibold">{formatMoney(t.monthly)}</dd></div>
            {t.usageEstimate > 0 && <div className="flex justify-between"><dt>Estimated usage per month</dt><dd>{formatMoney(t.usageEstimate)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-2"><dt>Total over the {q.term_months}-month term</dt><dd className="font-semibold">{formatMoney(t.contractValue)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted">Prices exclude VAT. Fixed scope; changes are quoted as change orders before work starts. Minimum term {q.term_months} months. Usage beyond allowances is billed at published unit rates.</p>
          {q.status === "sent" && !sp.accepted && (
            <form action={acceptQuote.bind(null, token)} className="rule-blend mt-8 space-y-4 border-t pt-6">
              <h2 className="font-display text-xl font-bold">Accept this proposal</h2>
              {sp.error && <Callout tone="danger">Please enter your name, an email for your portal administrator, and agree to the terms.</Callout>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm"><span className="mb-1 block font-semibold">Full name</span><input name="name" required className="h-11 w-full rounded-xl border border-line px-3" /></label>
                <label className="text-sm"><span className="mb-1 block font-semibold">Job title</span><input name="title" className="h-11 w-full rounded-xl border border-line px-3" /></label>
                <label className="text-sm sm:col-span-2"><span className="mb-1 block font-semibold">Portal administrator email</span><input name="adminEmail" type="email" defaultValue={q.o?.email ?? ""} required className="h-11 w-full rounded-xl border border-line px-3" /></label>
              </div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="agree" className="mt-0.5 h-5 w-5 accent-[#6B4936]" /> <span>I am authorised to accept on behalf of my organisation and agree to the Elans terms and data processing terms.</span></label>
              <button className="h-12 rounded-full bg-brown px-6 font-semibold text-white">Accept proposal</button>
            </form>
          )}
          {q.status === "accepted" && !sp.accepted && <Callout tone="success" className="mt-6">Accepted by {q.accepted_name}.</Callout>}
        </div>
      </Container>
    </Section>
  );
}
