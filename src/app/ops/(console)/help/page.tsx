import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { PageTitle, Panel } from "@/components/app/AppShell";

const GUIDE: { title: string; href: string; steps: string[] }[] = [
  { title: "Start your day", href: "/ops", steps: ["The Dashboard's Today section lists only what needs action: new leads, follow-ups due, chats waiting, sessions, reviews near their deadline, urgent tickets, stale quotes and overdue invoices.", "Click any line to go straight to it. When a queue is empty it moves to the 'Clear' line."] },
  { title: "Find anything", href: "/ops", steps: ["Press Ctrl+K (⌘K on Mac) or / anywhere, or use the Search box at the top of the menu.", "Type a company, person, email, phone, quote number or page name; use ↑ ↓ and Enter."] },
  { title: "Work a lead", href: "/ops/leads", steps: ["Website enquiries arrive automatically with their source and consent. Use 'Add a lead' for phone, walk-in, referral or event enquiries.", "On the lead: set the stage and owner, add notes after each call, and schedule a follow-up with a due date so it appears on the Dashboard.", "When there is a real opportunity, use 'Create opportunity' to move it into the Pipeline.", "Only market to contacts whose marketing consent shows 'opted in'. Export CSV is recorded in the audit log."] },
  { title: "From opportunity to signed client", href: "/ops/pipeline", steps: ["Move deals across the Pipeline board. Capture the Diagnostic (volumes, baseline, risks) on the opportunity.", "Create a quote: the builder checks the margin floor, minimum term and discount rules and blocks sending a quote that breaks them.", "Send the quote: the client gets a link, can accept online, and their workspace, onboarding project and invitation are created automatically.", "For deals agreed offline, use Clients → New client."] },
  { title: "Quotations, contracts and receipts", href: "/ops/documents", steps: ["Documents & templates → Templates: design each type. Change colours, header style, typeface and paper size; company and M-Pesa/bank details; numbering and VAT; and the sections (add, edit, reorder, hide or delete). Use '+ Insert field' to drop in details like the client's name or the total. The preview updates as you type, and every save keeps an earlier version you can restore.", "To create a document, use New quotation, New contract or New receipt, or start from a quote (Create quotation document), a lead, a quotation (Turn into a contract) or a paid invoice in Billing (Receipt), so nothing is retyped.", "Save as draft as often as you like. Issue gives it the next number (e.g. QUO-2026-0007) and locks it; later template changes never alter an issued document.", "Print / save as PDF opens a clean A4 page. Send or copy the client link: clients can view and download it, and accept quotations and contracts online (name, time and IP are recorded).", "The standard contract is a starting skeleton, not legal advice: have your advocate review it before use."] },
  { title: "Run sessions and chat", href: "/ops/bookings", steps: ["Sessions lists paid Strategy Sessions and free Discovery Calls. Mark each completed, no-show or cancelled afterwards.", "Live chat inbox shows website chats the AI agent handed to a person. Reply, then close it or hand it back to the agent."] },
  { title: "Look after clients", href: "/ops/clients", steps: ["Client data is private. To open a client, state a reason: you get 4 hours of access and the client can see it in their audit log.", "Inside a client: work the review queue, reply to tickets, resolve incidents, invite their team, issue invoices, and pause or stop an automation (engineers and admins).", "Reviews, support & incidents shows the queues across all clients without personal data."] },
  { title: "Bill clients", href: "/ops/billing", steps: ["Billing lists every client invoice with outstanding and overdue totals.", "Issue an invoice with a description, amount and due date; numbers are assigned automatically. Mark it paid when the money arrives, or void it if it was raised in error."] },
  { title: "Partners", href: "/ops/partners", steps: ["Applications from the website's Partners page arrive as 'Applied'. Move them through In review → Approved → Active and keep notes.", "For approved white-label partners, an admin can create their partner workspace, which emails them an invitation."] },
  { title: "Edit the website", href: "/ops/content", steps: ["Content CMS edits solutions, industries, packs, growth services, templates and resources. Every save keeps a revision you can restore.", "A solution page missing required sections is hidden from search engines until complete; the editor shows what is missing.", "Prices (admins) shows 'Indicative' on the site until you tick 'confirmed'. Scoring weights changes how the assessment ranks opportunities.", "Sources: statistics can only appear on the site once their source is marked verified."] },
  { title: "Team and security", href: "/ops/team", steps: ["Every staff account needs two-step sign-in. There are two levels: Super Admin (everything: read, edit, approve and configure) and Admin (read and contribute: leads, sessions, quotes, documents, invoices, content drafts, client support).", "When an Admin needs something beyond their access (mark an invoice paid, void a document, publish website changes, change prices or settings, add staff), they press “Ask Super Admin”. The Super Admin sees it under Requests to approve and on the dashboard, and can approve and carry it out in one click, do it by hand and mark it done, or decline with a reply.", "Audit log (Super Admin) shows who did what on the internal account. Message log shows every email, WhatsApp and SMS the system sends."] },
];

export default async function Help() {
  await requireStaff();
  return (
    <>
      <PageTitle title="How to use the console" description="Short guides for each part of the Elans console. Press Ctrl+K at any time to search." />
      <div className="grid gap-4 lg:grid-cols-2">
        {GUIDE.map((g) => (
          <Panel key={g.title} title={g.title} actions={<Link href={g.href} className="text-sm text-copper-ink hover:underline">Open</Link>}>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          </Panel>
        ))}
      </div>
    </>
  );
}
