import type { Solution } from "@/content/types";
import { clamp } from "./money";
import { ERROR_FREQUENCIES, FREQUENCIES, type AssessmentAnswers } from "./assessment";

/**
 * Elans Opportunity Score (§9.3). Deterministic, explainable, weight-versioned.
 * Each criterion is valued 0–5; the score is Σ weight × value / 5, on a 0–100 scale.
 */
export const CRITERIA = [
  { key: "frequency", label: "Process frequency", inverse: false },
  { key: "manualHours", label: "Manual hours", inverse: false },
  { key: "financialImpact", label: "Financial impact", inverse: false },
  { key: "errorRate", label: "Error rate", inverse: false },
  { key: "customerImpact", label: "Customer impact", inverse: false },
  { key: "dataReadiness", label: "Data readiness", inverse: false },
  { key: "integrationFeasibility", label: "Integration feasibility", inverse: false },
  { key: "regulatoryRisk", label: "Regulatory risk (lower is better)", inverse: true },
  { key: "implementationEffort", label: "Implementation effort (lower is better)", inverse: true },
  { key: "reusability", label: "Reusability", inverse: false },
  { key: "strategicFit", label: "Fit with the Elans catalogue", inverse: false },
] as const;
export type CriterionKey = (typeof CRITERIA)[number]["key"];
export type Weights = Record<CriterionKey, number>;

export const DEFAULT_WEIGHTS: Weights = {
  frequency: 12,
  manualHours: 12,
  financialImpact: 14,
  errorRate: 8,
  customerImpact: 10,
  dataReadiness: 8,
  integrationFeasibility: 8,
  regulatoryRisk: 7,
  implementationEffort: 7,
  reusability: 6,
  strategicFit: 8,
};

export interface ScoredOpportunity {
  solution: string;
  name: string;
  score: number;
  criteria: Record<CriterionKey, number>; // the 0–5 values used (inverse criteria already flipped)
  contributions: Record<CriterionKey, number>; // points contributed
  relevance: number;
  matchedOn: string[];
  flag: "none" | "human_review" | "excluded";
  flagReason?: string;
  rationale: string;
}

export interface Exclusion {
  topic: string;
  reason: string;
}

const EXCLUSION_RULES: { pattern: RegExp; topic: string; reason: string }[] = [
  { pattern: /\b(diagnos|prescri|treatment plan|clinical decision|triage patients)/i, topic: "Clinical decisions", reason: "Elans does not automate clinical judgement. We can automate the administration around it." },
  { pattern: /\b(legal advice|advise clients on (the )?law)/i, topic: "Legal advice", reason: "Agents never give legal advice to end clients. Intake, drafting support and deadline tracking are possible with professional review." },
  { pattern: /\b(approve|decline|reject)\s+(loans?|credit|applications?)\s+automatic/i, topic: "Automated credit decisions", reason: "Credit decisions stay with people. We can prepare complete, checked credit files." },
  { pattern: /\b(automatic(ally)?\s+(reject|hire|fire|dismiss)|auto[- ]?reject candidates)/i, topic: "Automated hiring or dismissal decisions", reason: "Employment decisions must be made by people (Data Protection Act s.35)." },
  { pattern: /\b(file|submit)\s+(my|our)?\s*(tax )?returns?\s+automatic/i, topic: "Automatic tax filing", reason: "Elans prepares variance reports and evidence; filing stays with you or your tax adviser." },
];

const FREQ = Object.fromEntries(FREQUENCIES.map((f) => [f.key, f.score])) as Record<string, number>;
const ERR = Object.fromEntries(ERROR_FREQUENCIES.map((f) => [f.key, f.score])) as Record<string, number>;
const SIZE_FACTOR: Record<string, number> = { "1-5": -0.75, "6-20": -0.25, "21-50": 0, "51-200": 0.4, "201-1000": 0.7, "1000+": 0.9 };

function hoursScore(hoursPerMonth: number) {
  if (hoursPerMonth >= 160) return 5;
  if (hoursPerMonth >= 80) return 4.2;
  if (hoursPerMonth >= 40) return 3.4;
  if (hoursPerMonth >= 15) return 2.5;
  if (hoursPerMonth >= 5) return 1.5;
  return 0.75;
}

const STOP = new Set(["and", "the", "for", "our", "with", "from", "into", "that", "this", "are", "you", "your", "all"]);
/** Deliberately cheap stemmer: strip common suffixes, then cap at 7 characters ("reconcile" ≈ "reconciliation"). */
const stem = (t: string) =>
  (t.length > 5 ? t.replace(/ed$/, "") : t).replace(/(ings|ing|ies|es|s)$/, (m) => (m === "ies" ? "y" : "")).slice(0, 7);
export function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/m[\s-]?pesa/g, "mpesa")
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOP.has(t))
      .map(stem),
  );
}
/** A keyword matches when all of its tokens (1–2 token keywords) or two-thirds of them (longer) appear in the text. */
export function keywordHit(keyword: string, text: Set<string>) {
  const k = [...tokens(keyword)];
  if (!k.length) return false;
  const hits = k.filter((t) => text.has(t)).length;
  return k.length <= 2 ? hits === k.length : hits / k.length >= 0.66;
}

/** How relevant a solution is to what the respondent told us (0–1), with reasons. */
export function relevance(s: Solution, a: AssessmentAnswers, industryFit: string[] = []) {
  const reasons: string[] = [];
  let r = 0;
  const fnHits = s.functions.filter((f) => a.functions.includes(f as never));
  if (fnHits.length) {
    r += 0.35 + 0.1 * (fnHits.length - 1);
    reasons.push("the functions you selected");
  }
  const fitRank = industryFit.indexOf(s.slug);
  if (fitRank >= 0 && fitRank < 6) {
    r += 0.25 - fitRank * 0.02;
    reasons.push("common needs in your industry");
  } else if (s.industries.includes(a.industry)) {
    r += 0.12;
    reasons.push("your industry");
  }
  const text = tokens([...a.tasks, a.tasksOther, a.errorNotes, a.customerNotes, a.outcome].join(" "));
  const kwHits = s.keywords.filter((k) => keywordHit(k, text));
  if (kwHits.length) {
    r += Math.min(0.45, 0.2 + 0.08 * kwHits.length);
    reasons.push(`tasks you mentioned (${kwHits.slice(0, 3).join(", ")})`);
  }
  const custFacing = s.division === "converse" || s.functions.some((f) => f === "service" || f === "bookings");
  if (custFacing && r > 0 && a.customerImpact.some((c) => c !== "none")) {
    r += 0.1;
    reasons.push("the customer impact you described");
  }
  return { value: clamp(r, 0, 1), reasons };
}

export function scoreSolution(s: Solution, a: AssessmentAnswers, weights: Weights = DEFAULT_WEIGHTS, industryFit: string[] = []): ScoredOpportunity {
  const rel = relevance(s, a, industryFit);
  const hoursPerMonth = (a.volumePerMonth * a.minutesPerTask) / 60;
  const sizeAdj = SIZE_FACTOR[a.companySize] ?? 0;
  const software = new Set(a.software);
  const overlap = s.integrations.filter((i) => software.has(i)).length;
  const paperOnly = software.has("paper") && software.size <= 2;

  const custFacing = s.division === "converse" || s.functions.some((f) => f === "service" || f === "bookings" || f === "sales");
  const impacts = a.customerImpact.filter((c) => c !== "none").length;
  const errImpactBoost = a.errorImpact === "high" ? 0.75 : a.errorImpact === "medium" ? 0.35 : 0;

  // Answer-driven criteria are scaled by relevance: the respondent's process data says little
  // about a solution that does not touch that process.
  const relScale = 0.4 + 0.6 * rel.value;
  const raw: Record<CriterionKey, number> = {
    frequency: (FREQ[a.frequency] ?? 2.5) * relScale,
    manualHours: hoursScore(hoursPerMonth) * relScale,
    financialImpact: clamp(s.profile.financialImpact + sizeAdj + errImpactBoost * 0.5, 0, 5),
    errorRate: clamp((ERR[a.errorFrequency] ?? 2.5) + errImpactBoost, 0, 5) * relScale,
    customerImpact: custFacing ? clamp(1.5 + impacts * 1.1, 0, 5) : clamp(0.5 + impacts * 0.3, 0, 2.5),
    dataReadiness: clamp(s.profile.dataReadiness + (overlap > 0 ? 0.5 : 0) - (paperOnly ? 1.2 : 0), 0, 5),
    integrationFeasibility: clamp(s.profile.integrationFeasibility + Math.min(1, overlap * 0.4), 0, 5),
    regulatoryRisk: s.profile.regulatoryRisk,
    implementationEffort: s.profile.implementationEffort,
    reusability: s.profile.reusability,
    strategicFit: s.profile.strategicFit,
  };

  const criteria = {} as Record<CriterionKey, number>;
  const contributions = {} as Record<CriterionKey, number>;
  let total = 0;
  const weightSum = Object.values(weights).reduce((x, y) => x + y, 0) || 1;
  for (const c of CRITERIA) {
    const v = c.inverse ? 5 - raw[c.key] : raw[c.key];
    criteria[c.key] = Number(v.toFixed(2));
    const pts = (weights[c.key] / weightSum) * 100 * (v / 5);
    contributions[c.key] = Number(pts.toFixed(2));
    total += pts;
  }
  const score = Math.round(clamp(total, 0, 100));

  const flag: ScoredOpportunity["flag"] = s.humanReviewRequired || s.riskClass === "high" ? "human_review" : "none";
  const top = [...CRITERIA]
    .sort((x, y) => contributions[y.key] - contributions[x.key])
    .slice(0, 3)
    .map((c) => c.label.replace(/ \(lower is better\)/, "").toLowerCase());
  const weakest = [...CRITERIA].sort((x, y) => criteria[x.key] - criteria[y.key])[0];
  const rationale =
    `Scores ${score}/100, driven mainly by ${top.join(", ")}.` +
    (rel.reasons.length ? ` Matched on ${rel.reasons.join(" and ")}.` : "") +
    ` Weakest factor: ${weakest.label.replace(/ \(lower is better\)/, "").toLowerCase()}.`;

  return { solution: s.slug, name: s.name, score, criteria, contributions, relevance: rel.value, matchedOn: rel.reasons, flag, flagReason: s.humanReviewRequired, rationale };
}

export function detectExclusions(a: AssessmentAnswers): Exclusion[] {
  const text = [a.tasksOther, a.outcome, a.errorNotes, a.customerNotes, ...a.tasks].join(" ");
  return EXCLUSION_RULES.filter((r) => r.pattern.test(text)).map((r) => ({ topic: r.topic, reason: r.reason }));
}

/** Rank candidate solutions: must be relevant, then by score. */
export function rankOpportunities(solutions: Solution[], a: AssessmentAnswers, weights: Weights = DEFAULT_WEIGHTS, limit = 5, industryFit: string[] = []) {
  const scored = solutions
    .filter((s) => s.publishState !== "draft")
    .map((s) => scoreSolution(s, a, weights, industryFit))
    .filter((o) => o.relevance >= 0.3);
  scored.sort((x, y) => y.score + y.relevance * 30 - (x.score + x.relevance * 30));
  // Prefer variety: at most two from the same category in the top list.
  const out: ScoredOpportunity[] = [];
  const perCat = new Map<string, number>();
  const bySlug = new Map(solutions.map((s) => [s.slug, s]));
  for (const o of scored) {
    const cat = bySlug.get(o.solution)!.category;
    if ((perCat.get(cat) ?? 0) >= 2) continue;
    perCat.set(cat, (perCat.get(cat) ?? 0) + 1);
    out.push(o);
    if (out.length >= limit) break;
  }
  return out;
}

export function recommendPackage(a: AssessmentAnswers, opportunities: ScoredOpportunity[]): { key: "launch" | "growth" | "scale" | "enterprise"; reason: string } {
  const strong = opportunities.filter((o) => o.score >= 55).length;
  if (a.companySize === "1000+") return { key: "enterprise", reason: "Organisations of your size usually need multi-department governance and an SLA." };
  if (a.companySize === "201-1000" || a.budget === "1m_plus") return { key: "scale", reason: "Your size and scope suit departmental automation or an Industry Pack." };
  if (strong >= 2 && a.companySize !== "1-5") return { key: "growth", reason: "You have two or more strong, related opportunities that work better connected." };
  return { key: "launch", reason: "Start with your single highest-scoring workflow, prove it, then expand." };
}
