/**
 * Content model for every record rendered on the public site.
 * Records are seeded from /src/content/seed and stored in Postgres (content_items);
 * admins edit them in the ops console. Nothing on a page is hard-coded.
 */

export type Status = "live" | "pilot" | "planned" | "custom";
export type IntegrationStatus = "supported" | "planned" | "custom_assessment";
export type Complexity = "low" | "medium" | "high";
export type RiskClass = "standard" | "elevated" | "high";
export type PublishState = "draft" | "published";

export type DivisionKey =
  | "automate"
  | "converse"
  | "grow"
  | "studio"
  | "relate"
  | "intelligence"
  | "partners";

export interface Division {
  key: DivisionKey;
  name: string; // "Elans Automate"
  short: string; // "Automate"
  tagline: string;
  description: string;
  origin: string;
}

/** A step in a before/after workflow diagram. */
export type FlowKind = "input" | "manual" | "wait" | "ai" | "rule" | "approval" | "action" | "outcome" | "risk";
export interface FlowStep {
  label: string;
  kind: FlowKind;
  note?: string;
}
export type Flow = FlowStep[];

export interface Faq {
  q: string;
  a: string;
}

export interface CategoryGroup {
  key: string;
  name: string;
}

export interface Category {
  slug: string;
  name: string;
  group: string; // CategoryGroup.key
  summary: string;
  intro: string;
  division: DivisionKey;
}

/** Intrinsic Opportunity Score inputs, 0–5. Assessment answers supply the rest. */
export interface OpportunityProfile {
  financialImpact: number;
  dataReadiness: number; // typical readiness of the data this needs
  integrationFeasibility: number;
  regulatoryRisk: number; // higher = riskier (scored inversely)
  implementationEffort: number; // higher = more effort (scored inversely)
  reusability: number;
  strategicFit: number;
}

export interface Solution {
  slug: string;
  name: string;
  category: string;
  division: DivisionKey;
  status: Status;
  summary: string;
  problem: string;
  affected: string[];
  manualFlow: Flow;
  automatedFlow: Flow;
  capabilities: string[];
  dataRequired: string[];
  integrations: string[]; // integration slugs
  benefits: string[]; // qualitative unless sourced
  successIndicators: string[];
  ownerMetric: string;
  approvalPoints: string[];
  complexity: Complexity;
  timeline: string; // "3–5 weeks"
  pricing: { approach: string; package: PackageKey | "quoted" };
  demo?: { kind: "interactive" | "walkthrough"; href: string; label: string };
  faqs: Faq[];
  industries: string[]; // industry slugs
  related: string[]; // solution slugs
  riskClass: RiskClass;
  humanReviewRequired?: string; // exclusion/flag reason shown in reports
  keywords: string[]; // task phrases matched by the assessment
  functions: string[]; // assessment "department" keys
  gapRank?: number; // §2.3 Gap Map rank (1 = highest)
  featured?: boolean;
  profile: OpportunityProfile;
  publishState?: PublishState;
}

export interface Industry {
  slug: string;
  name: string;
  short: string;
  summary: string;
  context: string; // why this sector, Kenya-specific where relevant
  challenges: { title: string; detail: string }[];
  leakage: string[]; // where revenue/time leaks
  repetitiveTasks: string[];
  solutions: string[]; // ordered by fit
  growth: string[]; // growth & marketing opportunities
  architecture: Flow;
  integrations: string[];
  kpis: string[];
  compliance: string[];
  packs: string[];
  assessmentTasks: string[]; // suggestions shown at assessment step 4
  priority?: boolean; // fully written at launch
}

export interface IndustryPack {
  slug: string;
  name: string;
  industry: string;
  status: Status;
  summary: string;
  includes: string[]; // solution slugs
  outcomes: string[];
  package: PackageKey | "quoted";
  idealFor: string;
}

export interface GrowthService {
  slug: string;
  name: string;
  division: DivisionKey;
  status: Status;
  summary: string;
  problem: string;
  approach: { title: string; detail: string }[];
  deliverables: string[];
  kpis: string[];
  guardrails: string[];
  pricing: { approach: string; tier: GrowTierKey | "quoted" | PackageKey };
  faqs: Faq[];
}

export interface FrontierTopic {
  slug: string;
  name: string;
  status: Status;
  summary: string;
  changing: string;
  affects: string[];
  doNow: string[];
  offer: string;
  related: string[]; // solution or growth slugs (prefixed "s:" or "g:")
}

export interface Template {
  slug: string;
  name: string;
  division: DivisionKey;
  industry: string; // industry slug or "cross-industry"
  fn: string; // category slug
  problem: string;
  workflow: string;
  integrations: string[];
  complexity: Complexity;
  prerequisites: string[];
  setupTime: string;
  securityClass: "public" | "internal" | "confidential" | "restricted";
  pricingModel: string;
  version: string;
  maintenance: "active" | "beta" | "planned";
  evalScore?: number; // internal only — never rendered publicly
  solution?: string;
}

export interface Integration {
  slug: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  note: string;
}

export type PackageKey = "launch" | "growth" | "scale" | "enterprise";
export type GrowTierKey = "essentials" | "momentum" | "market_leader";

export interface PricePoint {
  key: string; // e.g. "launch.setup"
  label: string;
  amount: number | null; // major units; null = quoted
  currency: string;
  token: string; // {{PRICE_*}}
  confirmed: boolean;
}

export interface Package {
  key: PackageKey;
  name: string;
  forWho: string;
  summary: string;
  setupKey: string;
  monthlyKey: string;
  scope: string[];
  integrations: string;
  process: string[];
  support: string;
  monitoring: string;
  training: string;
  changeRequests: string;
  allowances: string[];
  exclusions: string[];
  terms: string[];
}

export interface GrowTier {
  key: GrowTierKey;
  name: string;
  forWho: string;
  priceKey: string;
  includes: string[];
}

export interface Resource {
  slug: string;
  title: string;
  kind: "guide" | "comparison" | "industry" | "checklist" | "glossary";
  category: string;
  summary: string;
  readingMinutes: number;
  published: string; // ISO date
  body: string; // lightweight markdown (##, ###, -, 1., **bold**, [link](href))
  related: string[];
  faqs?: Faq[];
}

export interface IllustrativeExample {
  slug: string;
  title: string;
  industry: string;
  solution: string;
  scenario: string;
  before: Flow;
  after: Flow;
  whatWeMeasure: string[];
}

export type ContentType =
  | "solution"
  | "category"
  | "industry"
  | "pack"
  | "growth"
  | "frontier"
  | "template"
  | "integration"
  | "resource"
  | "example";
