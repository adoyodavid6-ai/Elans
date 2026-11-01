import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { createInvoice, setInvoiceStatus } from "@/app/ops/console-actions";
import { formatMoney } from "@/lib/core/money";
import { Badge, Kpi, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { Field, Input, Select, SubmitButton } from "@/components/app/Form";

type Props = { searchParams: Promise<{ status?: string; client?: string }> };
const STATUSES = ["issued", "overdue", "paid", "void"] as const;

export default async function Billing({ searchParams }: Props) {
  const sp = await searchParams;
  const u = await requireStaff(["admin", "consultant", "engineer", "support"]);
  const canBill = u.staffRole === "admin" || u.staffRole === "consultant";
  const status = STATUSES.includes(sp.status as never) ? sp.status! : null;
  const d = await asStaff(u, async (tx) => ({
    invoices: await tx<{ id: string; tenant_id: string; tenant_name: string; number: string; status: string; amount: number; currency: string; description: string; issued_at: string; due_date: string; paid_at: Date | null }[]>`
      select id, tenant_id, tenant_name, number, status, amount, currency, description, issued_at::text, due_date::text, paid_at from ops_invoice_queue()`,
    clients: await tx<{ id: string; name: string; kind: string }[]>`select id, name, kind from ops_client_list()`,
  }));
  const rows = d.invoices.filter((i) => (!status || i.status === status) && (!sp.client || i.tenant_id === sp.client));
  const sum = (s: string) => d.invoices.filter((i) => i.status === s).reduce((a, i) => a + Number(i.amount), 0);
  const month = new Date().toISOString().slice(0, 7);
  const paidThisMonth = d.invoices.filter((i) => i.status === "paid" && i.paid_at && i.paid_at.toISOString().slice(0, 7) === month).reduce((a, i) => a + Number(i.amount), 0);
  const due = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const q = (k: Record<string, string | null | undefined>) => { const p = new URLSearchParams(); for (const [a, b] of Object.entries({ status, client: sp.client, ...k })) if (b) p.set(a, b); const s = p.toString(); return `/ops/billing${s ? `?${s}` : ""}`; };
  return (
    <>
      <PageTitle title="Billing" description="Invoices across all clients. Clients see their invoices in the portal (Usage & Billing) and can pay by M-Pesa. While M-Pesa is in test mode a portal payment marks the invoice paid immediately; otherwise confirm the receipt here with Mark paid." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Outstanding" value={formatMoney(sum("issued") + sum("overdue"), "KES", { compact: true })} hint={`${d.invoices.filter((i) => i.status === "issued" || i.status === "overdue").length} invoices`} href={q({ status: "issued" })} />
        <Kpi label="Overdue" value={formatMoney(sum("overdue"), "KES", { compact: true })} tone={sum("overdue") > 0 ? "bad" : "good"} href={q({ status: "overdue" })} />
        <Kpi label="Paid this month" value={formatMoney(paidThisMonth, "KES", { compact: true })} tone="good" />
        <Kpi label="Clients" value={d.clients.filter((c) => c.kind === "client").length} href="/ops/clients" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Panel title="Invoices">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Link href={q({ status: null })} className={`rounded-full px-3 py-1.5 text-sm font-medium ${!status ? "bg-brown text-white" : "bg-surface-2"}`}>All</Link>
            {STATUSES.map((s) => <Link key={s} href={q({ status: s })} className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${status === s ? "bg-brown text-white" : "bg-surface-2"}`}>{s} <span className="opacity-70">{d.invoices.filter((i) => i.status === s).length}</span></Link>)}
            <form className="ml-auto flex items-center gap-2">
              {status && <input type="hidden" name="status" value={status} />}
              <label htmlFor="client-filter" className="sr-only">Client</label>
              <Select id="client-filter" name="client" defaultValue={sp.client ?? ""} className="h-9 w-48"><option value="">All clients</option>{d.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
              <button className="h-9 rounded-lg px-3 text-sm font-semibold ring-1 ring-line">Filter</button>
            </form>
          </div>
          <Table head={["Invoice", "Client", "Amount", "Issued", "Due", "Status", ""]} empty="No invoices match.">
            {rows.map((i) => (
              <tr key={i.id} className="hover:bg-surface-2">
                <td className="px-3 py-2.5"><p className="font-medium">{i.number}</p><p className="max-w-[14rem] truncate text-xs text-muted">{i.description}</p></td>
                <td className="px-3 py-2.5"><Link href={`/ops/clients/${i.tenant_id}`} className="hover:underline">{i.tenant_name}</Link></td>
                <td className="whitespace-nowrap px-3 py-2.5">{formatMoney(Number(i.amount), i.currency)}</td>
                <td className="px-3 py-2.5 text-xs text-muted">{i.issued_at}</td>
                <td className="px-3 py-2.5 text-xs">{i.due_date}</td>
                <td className="px-3 py-2.5"><Badge tone={i.status === "paid" ? "good" : i.status === "overdue" ? "bad" : i.status === "void" ? "neutral" : "warn"}>{i.status}</Badge>{i.paid_at && <p className="text-xs text-muted">paid {i.paid_at.toLocaleDateString("en-GB")}</p>}</td>
                <td className="px-3 py-2.5">
                  {canBill && (
                    <span className="flex gap-1">
                      {(i.status === "issued" || i.status === "overdue") && <form action={setInvoiceStatus.bind(null, i.id, "paid")}><SubmitButton tone="secondary" className="h-7 px-2 text-xs" pendingText="…">Mark paid</SubmitButton></form>}
                      {i.status !== "void" && i.status !== "paid" && <form action={setInvoiceStatus.bind(null, i.id, "void")}><SubmitButton tone="secondary" className="h-7 px-2 text-xs" pendingText="…">Void</SubmitButton></form>}
                      {i.status === "paid" && <a href={`/ops/documents/new?kind=receipt&from=invoice:${i.id}`} className="inline-flex h-7 items-center rounded-lg px-2 text-xs font-semibold ring-1 ring-line hover:bg-surface-2">Receipt</a>}
                      {(i.status === "void" || i.status === "paid") && <form action={setInvoiceStatus.bind(null, i.id, "issued")}><SubmitButton tone="secondary" className="h-7 px-2 text-xs" pendingText="…">Reopen</SubmitButton></form>}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Panel>
        {canBill ? (
          <Panel title="Issue an invoice" className="h-fit">
            <form id="new" action={createInvoice} className="space-y-3">
              <Field label="Client *"><Select name="tenantId" required defaultValue={sp.client ?? ""}><option value="" disabled>Choose a client</option>{d.clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.kind !== "client" ? ` (${c.kind})` : ""}</option>)}</Select></Field>
              <Field label="Description *" hint="Shown on the client's invoice."><Input name="description" required minLength={3} placeholder="e.g. Growth retainer, December 2026" /></Field>
              <Field label="Amount (KES) *"><Input name="amount" type="number" min={1} step="0.01" required /></Field>
              <Field label="Due date *"><Input name="dueDate" type="date" required defaultValue={due} /></Field>
              <SubmitButton className="w-full" pendingText="Issuing…">Issue invoice</SubmitButton>
              <p className="text-xs text-muted">Numbers are assigned automatically (ELN-YYYY-####). The client is notified in their portal, and the action is recorded in their audit log.</p>
            </form>
          </Panel>
        ) : <Panel title="Issuing invoices" className="h-fit"><p className="text-sm text-muted">Admins and consultants can issue and update invoices.</p></Panel>}
      </div>
    </>
  );
}
