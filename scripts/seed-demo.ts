import type postgres from "postgres";
import { withDb, type Tx } from "@/lib/db";
import type { EngineInstance } from "@/lib/runtime/engine";
import { processInvoice } from "@/lib/solutions/etims/workflow";
import { DEMO_BUYER_PIN, generateInvoices } from "@/lib/solutions/etims/samples";
import { importStatement, type StatementRow } from "@/lib/solutions/recon/workflow";
import { converseRespond, type ConverseConfig } from "@/lib/solutions/converse/agent";
import { applyApprovalDecision, applyReviewDecision } from "@/lib/runtime/review";

/**
 * Illustrative demo tenant ("Demo Hardware & Supplies Ltd"). Rebuilt on every seed.
 * Everything is synthetic and every portal page shows an "Illustrative data" banner.
 * Workflows are driven through the real runtime (rules mode, mock eTIMS, mock M-Pesa),
 * so runs, steps, reviews and approvals in the demo are genuine outputs of the code.
 */
const BUSINESS = "Demo Hardware & Supplies Ltd";

export const CONVERSE_CONFIG: ConverseConfig = {
  businessName: BUSINESS,
  hours: "Mon–Sat 7:30am–6:30pm, closed Sundays and public holidays",
  location: "Kitengela, along Namanga Road, opposite the stage",
  paybill: "123456 (demo)",
  account: "your phone number",
  catalogue: [
    { sku: "CEM-50", name: "Cement 50kg bag", aliases: ["cement", "simiti", "saruji"], price: 780, unit: "bags", stock: 340 },
    { sku: "MAB-G30", name: "Iron sheets gauge 30 (3m)", aliases: ["mabati", "iron sheets", "roofing sheets"], price: 950, unit: "sheets", stock: 120 },
    { sku: "Y12", name: "Steel bar Y12 (12m)", aliases: ["y12", "rebar", "steel bar", "nondo"], price: 1150, unit: "bars", stock: 200 },
    { sku: "PNT-4L", name: "Emulsion paint 4L", aliases: ["paint", "rangi", "emulsion"], price: 2400, unit: "tins", stock: 45 },
    { sku: "NAIL-1", name: "Roofing nails 1kg", aliases: ["nails", "misumari", "roofing nails"], price: 260, unit: "kg", stock: 90 },
    { sku: "PVC-4", name: 'PVC pipe 4" (6m)', aliases: ["pvc", "pipe", "bomba"], price: 1450, unit: "pipes", stock: 8 },
  ],
  faqs: [
    { q: "Do you deliver to Kitengela, Athi River, Isinya or Rongai?", a: "Yes. Delivery within Kitengela is free for orders over KES 20,000; Athi River, Isinya and Rongai are KES 1,500 per trip. Same-day if you order before 2pm." },
    { q: "Do you give credit or accept cheques?", a: "Credit accounts are for registered contractors only. I'll pass you to the team if you'd like to apply." },
    { q: "Can I return goods or exchange?", a: "Unopened items can be returned within 7 days with the receipt. Cement and cut items cannot be returned." },
  ],
};

const CHATS: string[][] = [
  ["Habari, bei ya cement ni ngapi?", "Nataka cement 20 tafadhali", "TJL7Q2M4XA"],
  ["Hi, how much are mabati?", "I want 30 iron sheets delivered"],
  ["Do you deliver to Kitengela?"],
  ["Hello", "I want 12 PVC pipes"],
  ["Can I get a discount for 200 bags? I'd like to speak to a manager"],
  ["Where are you located?"],
  ["Nataka nondo 40", "TJL9ZZZ001"],
];

const STATEMENT: StatementRow[] = [
  { txnRef: "TJL7Q2M4XA", txnAt: "2026-10-26T11:20:00+03:00", amount: 15600, payerName: "SAMUEL KIPROTICH", payerPhone: "254700111222", reference: "0700111222" },
  { txnRef: "TJL8R3N5YB", txnAt: "2026-10-27T15:02:00+03:00", amount: 15600, payerName: "WALK-IN CUSTOMER", payerPhone: "254700999888", reference: "cement" },
  { txnRef: "TJK1A2B3C4", txnAt: "2026-10-21T09:05:00+03:00", amount: 48000, payerName: "MOSES NJOROGE", payerPhone: "254711300400", reference: "INV-1031" },
  { txnRef: "TJK1A2B3C5", txnAt: "2026-10-21T13:44:00+03:00", amount: 23500, payerName: "AMINA HASSAN", payerPhone: "254722500600", reference: "ACC-2207" },
  { txnRef: "TJK2D3E4F5", txnAt: "2026-10-22T08:30:00+03:00", amount: 9750, payerName: "GRACE AKINYI", payerPhone: "254733700800", reference: "INV-1034" },
  { txnRef: "TJK2D3E4F6", txnAt: "2026-10-22T16:12:00+03:00", amount: 30000, payerName: "BENSON MUTUA", payerPhone: "254744900100", reference: "benson mutua site" },
  { txnRef: "TJK3G4H5I6", txnAt: "2026-10-23T10:01:00+03:00", amount: 61200, payerName: "KARIUKI BUILDERS LTD", payerPhone: "254755100200", reference: "ACC-2210" },
  { txnRef: "TJK3G4H5I7", txnAt: "2026-10-23T12:15:00+03:00", amount: 5000, payerName: "JOHN DOE", payerPhone: "254766300400", reference: "deposit" },
  { txnRef: "TJK4J5K6L7", txnAt: "2026-10-24T09:40:00+03:00", amount: 18400, payerName: "FAITH CHEBET", payerPhone: "254777500600", reference: "INV-1037" },
  { txnRef: "TJK4J5K6L8", txnAt: "2026-10-24T15:55:00+03:00", amount: 12000, payerName: "OCHIENG HARDWARE", payerPhone: "254788700800", reference: "ochieng part payment" },
  { txnRef: "TJK5M6N7O8", txnAt: "2026-10-25T11:11:00+03:00", amount: 27300, payerName: "MARY WAMBUI", payerPhone: "254799900100", reference: "INV-1039" },
  { txnRef: "TJK5M6N7O9", txnAt: "2026-10-25T17:30:00+03:00", amount: 7600, payerName: "ALI OMAR", payerPhone: "254701010101", reference: "" },
  { txnRef: "TJK6P7Q8R9", txnAt: "2026-10-26T08:20:00+03:00", amount: 42000, payerName: "NYAMBURA CONSTRUCTION", payerPhone: "254702020202", reference: "ACC-2215" },
];

const RECEIVABLES = [
  ["INV-1031", "Moses Njoroge", "254711300400", "ACC-2201", 48000],
  ["INV-1032", "Amina Hassan", "254722500600", "ACC-2207", 23500],
  ["INV-1034", "Grace Akinyi", "254733700800", "ACC-2203", 9750],
  ["INV-1035", "Benson Mutua", "254744900100", "ACC-2204", 30000],
  ["INV-1036", "Kariuki Builders Ltd", "254755100200", "ACC-2210", 61200],
  ["INV-1037", "Faith Chebet", "254777500600", "ACC-2206", 18400],
  ["INV-1038", "Ochieng Hardware", "254788700800", "ACC-2208", 36000],
  ["INV-1039", "Mary Wambui", "254799900100", "ACC-2209", 27300],
  ["INV-1040", "Nyambura Construction", "254702020202", "ACC-2215", 42000],
  ["INV-1041", "Samuel Kiprotich", "254700111222", "ACC-2216", 15600],
  ["INV-1042", "Jane Wanjiru", "254712000111", "ACC-2217", 12500],
  ["INV-1043", "Peter Otieno", "254722000222", "ACC-2218", 8000],
  ["INV-1044", "Omondi & Sons", "254703030303", "ACC-2219", 54000],
] as const;

async function chat(tx: Tx, inst: EngineInstance, tenantId: string, lines: string[], i: number) {
  const [conv] = await tx<{ id: string }[]>`insert into conversations (tenant_id, engine_instance_id, channel, visitor_ref, meta, created_at, updated_at)
    values (${tenantId}, ${inst.id}, 'whatsapp', ${`+2547${String(10000000 + i * 1234567).slice(0, 8)}`}, ${tx.json({ simulated: true })}, now() - ${`${(7 - i) * 9} hours`}::interval, now() - ${`${(7 - i) * 9} hours`}::interval) returning id`;
  await tx`insert into usage_events (tenant_id, meter, quantity, cost) values (${tenantId}, 'wa_conversation', 1, 0)`;
  for (const line of lines) {
    await tx`insert into messages (tenant_id, conversation_id, direction, author, body, meta) values (${tenantId}, ${conv.id}, 'in', 'customer', ${line}, ${tx.json({ untrusted: true })})`;
    const r = await converseRespond(tx, inst, conv.id, line);
    await tx`insert into messages (tenant_id, conversation_id, direction, author, body, meta) values (${tenantId}, ${conv.id}, 'out', 'agent', ${r.body}, ${tx.json({ intent: r.intent })})`;
    if (r.pendingOrder !== undefined) await tx`update conversations set meta = meta || jsonb_build_object('pendingOrder', ${tx.json((r.pendingOrder ?? null) as never)}::jsonb) where id = ${conv.id}`;
    if (r.handover) {
      await tx`update conversations set status = 'handed_off', resolution = 'handed_off' where id = ${conv.id}`;
      await tx`insert into handoffs (tenant_id, conversation_id, reason) values (${tenantId}, ${conv.id}, ${r.intent})`;
      break;
    }
    if (r.resolved) {
      await tx`update conversations set status = 'closed', resolution = 'resolved' where id = ${conv.id}`;
      await tx`insert into usage_events (tenant_id, meter, quantity, cost) values (${tenantId}, 'resolved_conversation', 1, 0)`;
    }
  }
  // Informational answers with no further question count as resolved for the demo.
  await tx`update conversations set status = 'closed', resolution = 'resolved' where id = ${conv.id} and status = 'open' and ${lines.length === 1}`;
}

export async function seedDemoTenant(db: postgres.Sql, tenantId: string) {
  delete process.env.ANTHROPIC_API_KEY; // the demo is built in rules mode: deterministic and free
  await db.begin(async (tx) => {
    await tx`select set_config('app.tenant_id', ${tenantId}, true)`;
    for (const t of ["follow_ups", "relationship_profiles", "studio_items", "campaigns", "recon_transactions", "recon_receivables",
      "etims_suppliers", "etims_invoices", "incidents", "approvals", "review_items", "run_steps", "runs", "connections", "engine_instances",
      "ticket_messages", "tickets", "documents", "invoices", "usage_events", "subscriptions", "onboarding_tasks", "projects", "dpa_requests",
      "messages", "handoffs", "conversations", "outbox", "audit_log", "invites"]) {
      await tx.unsafe(`delete from ${t} where tenant_id = '${tenantId}'`);
    }
  });

  await withDb({ tenantId }, async (tx) => {
    await tx`insert into subscriptions (tenant_id, package_key, monthly_amount, allowances, started_at)
      values (${tenantId}, 'growth', 60000, ${tx.json({ document_pages: 1500, wa_conversations: 1000, transactions: 3000 })}, '2026-08-01')`;

    const ins = async (slug: string, name: string, metric: string, baseline: number | null, note: string | null, config: object, autonomy: object, status = "live") =>
      (await tx<EngineInstance[]>`insert into engine_instances (tenant_id, solution_slug, name, status, autonomy, owner_metric, baseline_value, baseline_note, config, monthly_budget)
        values (${tenantId}, ${slug}, ${name}, ${status}, ${tx.json(autonomy as never)}, ${metric}, ${baseline}, ${note}, ${tx.json(config as never)}, 15000) returning *`)[0];

    const etims = await ins("etims-compliance-reconciliation", "eTIMS Compliance & Reconciliation", "% of claimed input VAT value supported by valid eTIMS invoices", 62, "Sept 2026 manual sample of 40 invoices",
      { buyerPin: DEMO_BUYER_PIN, period: "2026-10", threshold: 0.85, businessName: BUSINESS }, { "etims.supplier_request": "approve" }, "proving");
    const recon = await ins("mpesa-bank-reconciliation", "M-Pesa & Bank Reconciliation", "% of incoming payments matched without manual work", 0, "all matching done by hand in Sept 2026",
      { autoApplyThreshold: 0.9 }, { "recon.send_receipt": "auto" });
    const agent = await ins("whatsapp-sales-support-agent", "WhatsApp Sales & Support Agent", "% of WhatsApp enquiries resolved without a person", null, null, CONVERSE_CONFIG, { "converse.reply": "auto" });

    // eTIMS: 26 synthetic invoices through the real workflow.
    const { invoices } = generateInvoices();
    for (const inv of invoices.slice(0, 26)) await processInvoice(tx, etims, { source: inv.id.charCodeAt(inv.id.length - 1) % 2 ? "whatsapp" : "email", filename: `${inv.id}.txt (synthetic)`, text: inv.text });

    // Recon: receivables then a statement import.
    for (const [number, name, phone, acct, amount] of RECEIVABLES) {
      await tx`insert into recon_receivables (tenant_id, engine_instance_id, number, customer_name, customer_phone, account_ref, amount, balance, due_date)
        values (${tenantId}, ${recon.id}, ${number}, ${name}, ${phone}, ${acct}, ${amount}, ${amount}, '2026-10-31')`;
    }
    await importStatement(tx, recon, STATEMENT, "mpesa_statement");

    // Converse: scripted customer chats answered by the real agent.
    for (const [i, lines] of CHATS.entries()) await chat(tx, agent, tenantId, lines, i);

    // A few decisions already taken, so history and audit are populated.
    const [firstApproval] = await tx<{ id: string }[]>`select id from approvals where status = 'pending' order by created_at limit 1`;
    if (firstApproval) await applyApprovalDecision(tx, firstApproval.id, { approve: true, by: "Demo Client (demo)" });
    const [extraction] = await tx<{ id: string }[]>`select id from review_items where status = 'open' and kind = 'etims.extraction' order by created_at limit 1`;
    if (extraction) await applyReviewDecision(tx, extraction.id, { decision: "accept", by: "Elans reviewer (demo)" });

    // Spread run times over the last ten days so history reads naturally.
    await tx`update runs set started_at = now() - (random() * interval '10 days'), finished_at = case when finished_at is null then null else now() - (random() * interval '2 hours') end`;
    await tx`update runs set finished_at = started_at + interval '4 seconds' where finished_at is not null and finished_at < started_at`;
    await tx`update etims_invoices i set created_at = r.started_at from runs r where r.id = i.run_id`;
    await tx`update review_items i set created_at = r.started_at, sla_due_at = r.started_at + interval '8 hours' from runs r where r.id = i.run_id and i.queue = 'elans'`;
    await tx`update approvals a set created_at = r.started_at from runs r where r.id = a.run_id`;

    await tx`insert into connections (tenant_id, integration_slug, mode, status) values
      (${tenantId}, 'etims', 'mock', 'connected'), (${tenantId}, 'mpesa-daraja', 'mock', 'connected'), (${tenantId}, 'whatsapp-business', 'mock', 'connected'), (${tenantId}, 'email-intake', 'mock', 'connected'), (${tenantId}, 'csv-excel', 'live', 'connected')`;

    // Project & onboarding
    const [proj] = await tx<{ id: string }[]>`insert into projects (tenant_id, name, solution_slug, stage, status, accountable_engineer, start_date, target_date)
      values (${tenantId}, 'eTIMS proof, then reconciliation & WhatsApp', 'etims-compliance-reconciliation', 'prove', 'on_track', 'Elans engineer (illustrative)', '2026-09-15', '2026-11-30') returning id`;
    const tasks: [string, "client" | "elans", "todo" | "done", string | null][] = [
      ["Sign SOW and data processing agreement", "client", "done", "2026-09-16"],
      ["Kick-off call and owner metric agreed", "elans", "done", "2026-09-18"],
      ["Share 40 September purchase invoices for the baseline", "client", "done", "2026-09-22"],
      ["Configure intake (WhatsApp number and email address)", "elans", "done", "2026-09-29"],
      ["Confirm eTIMS integration route with your tax adviser", "client", "todo", "2026-11-07"],
      ["Upload October purchase ledger export (CSV)", "client", "todo", "2026-11-05"],
      ["Two-week parallel run and accuracy review", "elans", "todo", "2026-11-14"],
      ["Go/no-go: switch on supplier requests", "client", "todo", "2026-11-21"],
    ];
    for (const [i, [title, owner, status, due]] of tasks.entries()) await tx`insert into onboarding_tasks (tenant_id, project_id, title, owner, status, due_date, sort) values (${tenantId}, ${proj.id}, ${title}, ${owner}, ${status}, ${due}, ${i})`;

    // Billing
    await tx`insert into invoices (tenant_id, number, status, amount, lines, issued_at, due_date, paid_at) values
      (${tenantId}, 'ELN-DEMO-0001', 'paid', 175000, ${tx.json([{ description: "Growth setup, instalment 1 of 2" }])}, '2026-09-15', '2026-09-22', '2026-09-20'),
      (${tenantId}, 'ELN-DEMO-0002', 'paid', 60000, ${tx.json([{ description: "Growth retainer, October 2026" }])}, '2026-10-01', '2026-10-08', '2026-10-06'),
      (${tenantId}, 'ELN-DEMO-0003', 'issued', 175000, ${tx.json([{ description: "Growth setup, instalment 2 of 2" }])}, '2026-10-15', '2026-11-15', null),
      (${tenantId}, 'ELN-DEMO-0004', 'issued', 60000, ${tx.json([{ description: "Growth retainer, November 2026" }])}, '2026-10-28', '2026-11-08', null)`;

    // Campaigns & Studio
    const [cp] = await tx<{ id: string }[]>`insert into campaigns (tenant_id, name, channel, status, start_date, end_date, kpis)
      values (${tenantId}, 'Kitengela contractors: rainy-season roofing', 'WhatsApp + Meta ads', 'active', '2026-10-05', '2026-11-30', ${tx.json({ enquiries: 84, orders: 19, cost_per_enquiry_kes: 310 })}) returning id`;
    await tx`insert into campaigns (tenant_id, name, channel, status, start_date, end_date, kpis) values (${tenantId}, 'Google Business Profile refresh', 'Local search', 'planned', '2026-11-10', '2026-12-10', '{}')`;
    const items: [string, string, string, string][] = [
      ["post", "Mabati price list post (Swahili)", "Mabati mpya zimefika! Gauge 30, 3m kwa KES 950. Agiza kwa WhatsApp, tunaleta Kitengela bure kwa oda zaidi ya KES 20,000.", "awaiting_client"],
      ["ad_variant", "Meta ad variant B: 'Before the rains'", "Roof before the rains. Iron sheets, nails and gutters in stock in Kitengela. Order on WhatsApp, same-day delivery before 2pm.", "awaiting_client"],
      ["copy", "Contractor credit account explainer", "Registered contractors can apply for a 30-day credit account. Ask our team on WhatsApp.", "approved"],
      ["image", "Delivery truck photo, cropped for Status", null as unknown as string, "published"],
      ["post", "Cement price post", "Cement 50kg kwa KES 780 tu. Agiza leo!", "changes_requested"],
    ];
    for (const [kind, title, body, status] of items) await tx`insert into studio_items (tenant_id, campaign_id, kind, title, body, status, feedback) values (${tenantId}, ${cp.id}, ${kind}, ${title}, ${body}, ${status}, ${status === "changes_requested" ? "Please add the delivery offer and our location." : null})`;

    // Support
    const [t1] = await tx<{ id: string }[]>`insert into tickets (tenant_id, subject, priority, status, sla_due_at, created_label, created_at) values (${tenantId}, 'Supplier says their invoice is valid in eTIMS', 'normal', 'pending', now() + interval '6 hours', 'Demo Client (demo)', now() - interval '18 hours') returning id`;
    await tx`insert into ticket_messages (tenant_id, ticket_id, author_label, is_staff, body, created_at) values
      (${tenantId}, ${t1.id}, 'Demo Client (demo)', false, 'Mlima Hardware says their invoice was issued through eTIMS but it shows as not found. Can you check?', now() - interval '18 hours'),
      (${tenantId}, ${t1.id}, 'Elans support', true, 'Thanks. The CU number on the copy you received has a missing character, which is why the check failed. We have asked the supplier for a clean copy through the approvals flow. We will confirm here once the re-check passes.', now() - interval '16 hours')`;
    const [t2] = await tx<{ id: string }[]>`insert into tickets (tenant_id, subject, priority, status, created_label, created_at) values (${tenantId}, 'Add our new Athi River branch to the WhatsApp agent', 'low', 'resolved', 'Demo Client (demo)', now() - interval '6 days') returning id`;
    await tx`insert into ticket_messages (tenant_id, ticket_id, author_label, is_staff, body, created_at) values
      (${tenantId}, ${t2.id}, 'Demo Client (demo)', false, 'We opened a branch in Athi River. Can the agent mention it?', now() - interval '6 days'),
      (${tenantId}, ${t2.id}, 'Elans support', true, 'Done: the agent now gives both locations. Change logged as a minor configuration update.', now() - interval '5 days')`;

    // Documents (synthetic, labelled)
    const docs: [string, string, string][] = [
      ["Statement of work (illustrative).txt", "contract", "ILLUSTRATIVE EXAMPLE. Statement of work: eTIMS Compliance & Reconciliation proof, then M-Pesa reconciliation and WhatsApp agent. Owner metric, baseline and acceptance criteria as agreed in the Diagnostic."],
      ["Data processing agreement (illustrative).txt", "dpa", "ILLUSTRATIVE EXAMPLE. Elans acts as data processor for Demo Hardware & Supplies Ltd under the Kenya Data Protection Act 2019."],
      ["September baseline sample (synthetic).csv", "report", "invoice_no,supplier_pin,status\nSAMPLE-1,P051111111A,valid\n"],
    ];
    for (const [name, kind, content] of docs) await tx`insert into documents (tenant_id, name, kind, mime, size_bytes, content, uploaded_by) values (${tenantId}, ${name}, ${kind}, ${name.endsWith(".csv") ? "text/csv" : "text/plain"}, ${Buffer.byteLength(content)}, ${Buffer.from(content)}, 'Elans')`;

    await tx`insert into dpa_requests (tenant_id, subject_ref, type, status, received_at, due_at, notes) values (${tenantId}, 'WhatsApp customer +2547••••4410', 'erasure', 'in_progress', now() - interval '2 days', now() + interval '12 days', 'Customer asked us to delete their chat history (illustrative).')`;
    await tx`insert into incidents (tenant_id, engine_instance_id, severity, title, detail, status, opened_at, resolved_at) values (${tenantId}, ${agent.id}, 'sev4', 'WhatsApp webhook delayed (mock provider)', 'Messages arrived up to 3 minutes late for 20 minutes. No messages lost. (Illustrative.)', 'resolved', now() - interval '4 days', now() - interval '4 days' + interval '25 minutes')`;
    await tx`insert into audit_log (tenant_id, actor_label, action, entity, created_at) values
      (${tenantId}, 'Elans engineer (illustrative)', 'access_grant.used', 'tenant', now() - interval '3 days'),
      (${tenantId}, 'Demo Client (demo)', 'automation.autonomy_changed', 'engine_instance', now() - interval '2 days'),
      (${tenantId}, 'Demo Client (demo)', 'document.downloaded', 'document', now() - interval '1 day')`;
  });
}
