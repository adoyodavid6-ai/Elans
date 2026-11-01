import { requireStaff } from "@/lib/auth";
import { createLead } from "@/app/ops/console-actions";
import { PageTitle, Panel } from "@/components/app/AppShell";
import { Field, Input, Select, SubmitButton, Textarea } from "@/components/app/Form";
import { getCatalogue } from "@/lib/content";

export default async function NewLead() {
  await requireStaff(["admin", "consultant", "support"]);
  const cat = await getCatalogue();
  return (
    <>
      <PageTitle crumbs={[{ href: "/ops/leads", label: "Leads" }]} title="Add a lead" description="For enquiries that came in by phone, in person, by referral or at an event. Website enquiries are added automatically." />
      <form action={createLead} className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Panel title="Who is it?">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name *"><Input name="name" required minLength={2} autoComplete="off" /></Field>
            <Field label="Organisation"><Input name="organisation" autoComplete="off" /></Field>
            <Field label="Email" hint="Email or phone is required."><Input name="email" type="email" autoComplete="off" /></Field>
            <Field label="Phone / WhatsApp"><Input name="phone" type="tel" placeholder="07XX XXX XXX" autoComplete="off" /></Field>
            <Field label="Industry">
              <Select name="industry" defaultValue=""><option value="">Not sure yet</option>{cat.industries.map((i) => <option key={i.slug} value={i.slug}>{i.name}</option>)}</Select>
            </Field>
            <Field label="How did they reach us? *">
              <Select name="channel" defaultValue="phone">
                <option value="phone">Phone call</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="walk_in">Walk-in / meeting</option><option value="referral">Referral</option><option value="event">Event</option><option value="other">Other</option>
              </Select>
            </Field>
            <Field label="What do they need?" className="sm:col-span-2"><Textarea name="message" placeholder="The problem in their words, volumes, systems they use, urgency…" /></Field>
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel title="Next step">
            <div className="space-y-4">
              <Field label="Follow-up" hint="Shows on the dashboard when it's due."><Input name="nextAction" placeholder="e.g. Call back with pricing" /></Field>
              <Field label="Due date"><Input name="nextActionDue" type="date" /></Field>
            </div>
          </Panel>
          <Panel title="Consent">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="consentContact" defaultChecked className="mt-0.5 h-4 w-4 accent-brown" />
              <span>They agreed to be contacted about this enquiry.</span>
            </label>
            <p className="mt-2 text-xs text-muted">Marketing consent can only be given by the contact themselves (e.g. via a form), so it is not recorded here.</p>
          </Panel>
          <SubmitButton className="w-full" pendingText="Adding…">Add lead</SubmitButton>
        </div>
      </form>
    </>
  );
}
