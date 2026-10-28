import { portal } from "@/lib/portal";
import { getCatalogue } from "@/lib/content";
import { Badge, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { IntegrationBadge } from "@/components/ui/Status";

export default async function Integrations() {
  const c = await portal();
  const [conns, cat] = await Promise.all([
    c.db((tx) => tx<{ id: string; integration_slug: string; mode: string; status: string; created_at: Date }[]>`select id, integration_slug, mode, status, created_at from connections order by created_at`),
    getCatalogue(),
  ]);
  const name = (slug: string) => cat.integrations.find((i) => i.slug === slug)?.name ?? slug;
  return (
    <>
      <PageTitle title="Integrations" description="The systems your automations are connected to, and in which mode. Credentials are held in Elans' secrets store, never in this page or in prompts." />
      <Panel title="Your connections">
        <Table head={["System", "Mode", "Status", "Connected"]} empty="No connections yet">
          {conns.map((x) => (
            <tr key={x.id}>
              <td className="px-3 py-2 font-medium">{name(x.integration_slug)}</td>
              <td className="px-3 py-2"><Badge tone={x.mode === "live" ? "good" : x.mode === "sandbox" ? "info" : "warn"}>{x.mode === "mock" ? "test (mock)" : x.mode}</Badge></td>
              <td className="px-3 py-2"><Badge tone={x.status === "connected" ? "good" : "bad"}>{x.status}</Badge></td>
              <td className="px-3 py-2 text-xs text-muted">{x.created_at.toLocaleDateString("en-GB")}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-3 text-xs text-muted">Test (mock) mode returns realistic responses without touching the real system. Moving to live needs the provider&apos;s credentials and a sign-off from you. Ask in Support.</p>
      </Panel>
      <Panel title="Available integrations" className="mt-6">
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {cat.integrations.map((i) => (
            <li key={i.slug} className="rounded-xl border border-line p-3"><div className="flex items-start justify-between gap-2"><p className="font-medium">{i.name}</p><IntegrationBadge status={i.status} /></div><p className="mt-1 text-xs text-muted">{i.note}</p></li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
