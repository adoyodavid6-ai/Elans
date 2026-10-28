import { requireStaff } from "@/lib/auth";
import { getCatalogue } from "@/lib/content";
import { saveSettings } from "@/app/ops/cms-actions";
import { mpesaMode } from "@/lib/integrations/mpesa";
import { aiAvailable, MODELS } from "@/lib/ai";
import { PageTitle, Panel, Badge } from "@/components/app/AppShell";

const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm";

export default async function Settings() {
  const u = await requireStaff();
  const s = (await getCatalogue({ includeDrafts: true })).settings;
  const admin = u.staffRole === "admin";
  return (
    <>
      <PageTitle title="Site settings" description="Company details, commercial rules and placeholders. Empty fields are hidden on the public site rather than shown as tokens." />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Company & commercial">
          <form action={saveSettings} className="grid gap-4 sm:grid-cols-2">
            {([
              ["legalEntity", "Legal entity name", s.legalEntity],
              ["registrationNo", "Registration number", s.registrationNo],
              ["odpcRegistration", "ODPC registration number", s.odpcRegistration],
              ["domain", "Domain", s.domain],
              ["email", "Public email", s.email],
              ["phone", "Public phone", s.phone],
              ["whatsapp", "WhatsApp number", s.whatsapp],
              ["address", "Address", s.address],
              ["supportHours", "Support hours", s.supportHours],
              ["caseStudyDate", "First case studies publish (text)", s.caseStudyDate],
            ] as const).map(([k, l, v]) => (
              <label key={k} className="text-sm"><span className="mb-1 block text-muted">{l}</span><input name={k} defaultValue={v ?? ""} disabled={!admin} className={field} /></label>
            ))}
            <label className="text-sm sm:col-span-2"><span className="mb-1 block text-muted">Market scope statement</span><input name="marketScope" defaultValue={s.marketScope} disabled={!admin} className={field} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted">Gross margin floor (%)</span><input name="marginFloor" type="number" defaultValue={Math.round(s.marginFloor * 100)} disabled={!admin} className={field} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted">Minimum term (months)</span><input name="minTermMonths" type="number" defaultValue={s.minTermMonths} disabled={!admin} className={field} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="discoveryCallFree" defaultChecked={s.discoveryCallFree} disabled={!admin} className="h-4 w-4 accent-[#6B4936]" /> Discovery Call is free</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="supportHoursConfirmed" defaultChecked={s.supportHoursConfirmed} disabled={!admin} className="h-4 w-4 accent-[#6B4936]" /> Support hours confirmed</label>
            {admin && <button className="rounded-lg bg-brown px-5 py-2 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-start">Save settings</button>}
          </form>
        </Panel>
        <Panel title="Integration status (from environment)">
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between"><span>Database</span><Badge tone="good">connected</Badge></li>
            <li className="flex justify-between"><span>AI models</span>{aiAvailable() ? <Badge tone="good">{MODELS.primary} / {MODELS.fast}</Badge> : <Badge tone="warn">no API key: rule-based fallbacks</Badge>}</li>
            <li className="flex justify-between"><span>M-Pesa Daraja</span><Badge tone={mpesaMode() === "production" ? "good" : "warn"}>{mpesaMode()}</Badge></li>
            <li className="flex justify-between"><span>eTIMS</span><Badge tone="warn">mock adaptor</Badge></li>
            <li className="flex justify-between"><span>Email delivery</span><Badge tone={process.env.EMAIL_PROVIDER && process.env.EMAIL_PROVIDER !== "log" ? "good" : "warn"}>{process.env.EMAIL_PROVIDER ?? "log"} (outbox only)</Badge></li>
            <li className="flex justify-between"><span>Bot protection (Turnstile)</span><Badge tone={process.env.TURNSTILE_SECRET_KEY ? "good" : "warn"}>{process.env.TURNSTILE_SECRET_KEY ? "on" : "off"}</Badge></li>
          </ul>
          <p className="mt-4 text-xs text-muted">Credentials are set as environment variables, never in the database. See README → Configuration.</p>
        </Panel>
      </div>
    </>
  );
}
