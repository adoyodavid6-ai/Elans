import { requireStaff } from "@/lib/auth";
import { createClient } from "@/app/ops/console-actions";
import { getCatalogue, price } from "@/lib/content";
import { PageTitle, Panel } from "@/components/app/AppShell";
import { Field, Input, Select, SubmitButton } from "@/components/app/Form";

export default async function NewClient() {
  await requireStaff(["admin", "consultant"]);
  const cat = await getCatalogue();
  const ready = cat.solutions.filter((s) => s.status === "live" || s.status === "pilot");
  const monthly = (k: string) => price(cat, `${k}.monthly`)?.amount ?? "";
  return (
    <>
      <PageTitle crumbs={[{ href: "/ops/clients", label: "Clients" }]} title="New client" description="Creates the client's workspace, an onboarding project with tasks, their subscription, and emails an invitation to their admin. Most clients are created automatically when they accept a quote; use this for deals agreed offline." />
      <form action={createClient} className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Panel title="Client">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organisation name *"><Input name="name" required minLength={2} /></Field>
            <Field label="Admin email *" hint="They receive the invitation and become the workspace owner."><Input name="adminEmail" type="email" required /></Field>
            <Field label="Package">
              <Select name="package" defaultValue="launch">{cat.packages.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</Select>
            </Field>
            <Field label="Monthly retainer (KES)" hint={`Indicative: Launch ${monthly("launch")}, Growth ${monthly("growth")}, Scale ${monthly("scale")}`}><Input name="monthly" type="number" min={0} step={500} defaultValue={String(monthly("launch") || "")} /></Field>
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel title="First automations">
            <p className="mb-3 text-xs text-muted">Optional. Sets up the onboarding project around these. Engines are configured by an engineer afterwards.</p>
            <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {ready.map((s) => (
                <li key={s.slug}><label className="flex items-start gap-2 text-sm"><input type="checkbox" name="solutions" value={s.slug} className="mt-0.5 h-4 w-4 accent-brown" /><span>{s.name} <span className="text-xs text-muted">({s.status})</span></span></label></li>
              ))}
            </ul>
          </Panel>
          <SubmitButton className="w-full" pendingText="Creating workspace…">Create client &amp; send invitation</SubmitButton>
        </div>
      </form>
    </>
  );
}
