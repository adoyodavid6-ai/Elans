import { z } from "zod";

/** AI Opportunity Assessment (§9.1): question model shared by the wizard, API and report. */

export const FUNCTIONS = [
  { key: "finance", label: "Finance & accounting" },
  { key: "tax", label: "Tax & statutory compliance" },
  { key: "payments", label: "Payments & reconciliation" },
  { key: "collections", label: "Collections & credit" },
  { key: "sales", label: "Sales & lead follow-up" },
  { key: "marketing", label: "Marketing" },
  { key: "service", label: "Customer service" },
  { key: "bookings", label: "Bookings & appointments" },
  { key: "hr", label: "HR & recruitment" },
  { key: "documents", label: "Documents & data entry" },
  { key: "records", label: "Records & filing" },
  { key: "procurement", label: "Procurement & suppliers" },
  { key: "inventory", label: "Inventory & stock" },
  { key: "logistics", label: "Delivery & logistics" },
  { key: "operations", label: "Operations & production" },
  { key: "it", label: "IT support" },
  { key: "reporting", label: "Reporting & dashboards" },
  { key: "compliance", label: "Data protection & compliance" },
  { key: "admin", label: "Executive & admin" },
  { key: "transformation", label: "Digital transformation (paper, spreadsheets, old systems)" },
  { key: "custom", label: "Something else / custom" },
] as const;

export const SOFTWARE = [
  { key: "whatsapp-business", label: "WhatsApp / WhatsApp Business" },
  { key: "mpesa-daraja", label: "M-Pesa paybill or till" },
  { key: "quickbooks", label: "QuickBooks" },
  { key: "xero", label: "Xero" },
  { key: "sage", label: "Sage" },
  { key: "odoo", label: "Odoo" },
  { key: "zoho", label: "Zoho" },
  { key: "sap", label: "SAP" },
  { key: "hubspot", label: "HubSpot" },
  { key: "salesforce", label: "Salesforce" },
  { key: "microsoft-365", label: "Microsoft 365 / Outlook" },
  { key: "google-workspace", label: "Google Workspace / Gmail" },
  { key: "shopify", label: "Shopify" },
  { key: "woocommerce", label: "WooCommerce" },
  { key: "pos", label: "A point-of-sale system" },
  { key: "hmis", label: "Hospital / clinic system (HMIS)" },
  { key: "school-ms", label: "School management system" },
  { key: "core-banking", label: "SACCO / core banking system" },
  { key: "pms", label: "Property or hotel management system" },
  { key: "csv-excel", label: "Excel / spreadsheets" },
  { key: "paper", label: "Mostly paper" },
] as const;

export const COMPANY_SIZES = [
  { key: "1-5", label: "1–5 people" },
  { key: "6-20", label: "6–20 people" },
  { key: "21-50", label: "21–50 people" },
  { key: "51-200", label: "51–200 people" },
  { key: "201-1000", label: "201–1,000 people" },
  { key: "1000+", label: "More than 1,000 people" },
] as const;

export const FREQUENCIES = [
  { key: "daily", label: "Many times a day", score: 5 },
  { key: "several_weekly", label: "Several times a week", score: 4 },
  { key: "weekly", label: "Weekly", score: 3 },
  { key: "monthly", label: "Monthly (e.g. month-end)", score: 2 },
  { key: "rarely", label: "Occasionally", score: 1 },
] as const;

export const ERROR_FREQUENCIES = [
  { key: "often", label: "Often. We fix mistakes every week", score: 5 },
  { key: "sometimes", label: "Sometimes", score: 3 },
  { key: "rarely", label: "Rarely", score: 1 },
  { key: "unknown", label: "We don't really know", score: 2.5 },
] as const;

export const ERROR_IMPACTS = [
  { key: "low", label: "Minor: a little rework" },
  { key: "medium", label: "Noticeable: customer complaints or write-offs" },
  { key: "high", label: "Serious: penalties, lost revenue or regulatory risk" },
] as const;

export const CUSTOMER_IMPACTS = [
  { key: "missed_calls", label: "We miss phone calls" },
  { key: "slow_replies", label: "Replies to messages are slow" },
  { key: "after_hours", label: "Enquiries arrive when we're closed" },
  { key: "complaints", label: "Customers complain about delays or errors" },
  { key: "none", label: "Customers aren't really affected" },
] as const;

export const GROWTH_GOALS = [
  { key: "more_leads", label: "More enquiries and leads", service: "paid-media" },
  { key: "conversion", label: "Convert more enquiries into sales", service: "conversion-optimisation" },
  { key: "retention", label: "More repeat customers", service: "relationship-intelligence" },
  { key: "ai_visibility", label: "Be recommended by AI assistants and Google", service: "ai-visibility-geo" },
  { key: "content", label: "Consistent content and social presence", service: "content-studio" },
  { key: "local", label: "Be found locally (Google Maps, 'near me')", service: "local-seo" },
  { key: "messaging", label: "Market by WhatsApp / email without breaking privacy rules", service: "email-whatsapp-marketing" },
] as const;

export const URGENCY = [
  { key: "now", label: "Now. It's costing us today" },
  { key: "quarter", label: "In the next three months" },
  { key: "exploring", label: "Just exploring" },
] as const;

export const BUDGETS = [
  { key: "unsure", label: "Not sure yet" },
  { key: "under_150k", label: "Under KES 150,000 setup" },
  { key: "150k_500k", label: "KES 150,000 – 500,000" },
  { key: "500k_1m", label: "KES 500,000 – 1 million" },
  { key: "1m_plus", label: "More than KES 1 million" },
] as const;

const keys = <T extends readonly { key: string }[]>(arr: T) => arr.map((a) => a.key) as [T[number]["key"], ...T[number]["key"][]];

export const answersSchema = z.object({
  industry: z.string().min(1).max(60),
  companySize: z.enum(keys(COMPANY_SIZES)),
  country: z.string().min(2).max(60).default("Kenya"),
  county: z.string().max(60).optional().default(""),
  functions: z.array(z.enum(keys(FUNCTIONS))).min(1).max(8),
  software: z.array(z.string().max(40)).max(25).default([]),
  softwareOther: z.string().max(200).optional().default(""),
  tasks: z.array(z.string().max(120)).max(12).default([]),
  tasksOther: z.string().max(600).optional().default(""),
  frequency: z.enum(keys(FREQUENCIES)),
  volumePerMonth: z.coerce.number().min(0).max(1_000_000),
  minutesPerTask: z.coerce.number().min(0).max(600),
  people: z.coerce.number().min(1).max(5000),
  errorFrequency: z.enum(keys(ERROR_FREQUENCIES)),
  errorImpact: z.enum(keys(ERROR_IMPACTS)),
  errorNotes: z.string().max(600).optional().default(""),
  customerImpact: z.array(z.enum(keys(CUSTOMER_IMPACTS))).default([]),
  customerNotes: z.string().max(600).optional().default(""),
  growthGoals: z.array(z.enum(keys(GROWTH_GOALS))).default([]),
  outcome: z.string().max(600).optional().default(""),
  urgency: z.enum(keys(URGENCY)),
  budget: z.enum(keys(BUDGETS)).default("unsure"),
});
export type AssessmentAnswers = z.infer<typeof answersSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(200),
  phone: z.string().trim().max(30).optional().default(""),
  organisation: z.string().trim().min(1).max(160),
  role: z.string().trim().max(120).optional().default(""),
  consentReport: z.literal(true, { error: "Consent is needed to prepare and send your report." }),
  consentMarketing: z.boolean().default(false),
});
export type AssessmentContact = z.infer<typeof contactSchema>;

/** Per-step partial validation used by the wizard's save-and-resume. */
export const STEP_FIELDS: Record<number, (keyof AssessmentAnswers)[]> = {
  1: ["industry", "companySize", "country", "county"],
  2: ["functions"],
  3: ["software", "softwareOther"],
  4: ["tasks", "tasksOther"],
  5: ["frequency", "volumePerMonth", "minutesPerTask", "people"],
  6: ["errorFrequency", "errorImpact", "errorNotes"],
  7: ["customerImpact", "customerNotes"],
  8: ["growthGoals"],
  9: ["outcome", "urgency", "budget"],
};
export const TOTAL_STEPS = 10;
