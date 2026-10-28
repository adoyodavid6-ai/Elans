import "server-only";
import { z } from "zod";
import type { Catalogue } from "@/lib/content";
import {
  BUDGETS, COMPANY_SIZES, CUSTOMER_IMPACTS, ERROR_FREQUENCIES, ERROR_IMPACTS, FREQUENCIES, FUNCTIONS, GROWTH_GOALS, SOFTWARE, URGENCY,
  type AssessmentAnswers,
} from "@/lib/core/assessment";
import { detectExclusions, rankOpportunities, recommendPackage, CRITERIA, type ScoredOpportunity } from "@/lib/core/scoring";
import { formatMoney, formatNumber } from "@/lib/core/money";
import { generateStructured, MODELS } from "@/lib/ai";

/** The preliminary report. Every statement is typed as something the visitor told us, a calculated estimate, or a hypothesis. */
export interface ReportOpportunity {
  slug: string;
  name: string;
  href: string;
  status: string;
  score: number;
  flag: ScoredOpportunity["flag"];
  flagReason?: string;
  rationale: string;
  topCriteria: { label: string; points: number }[];
  complexity: string;
  timeline: string;
  integrations: { name: string; status: string }[];
  risks: string[];
  dependencies: string[];
  hypothesis: string;
  ownerMetric: string;
  roiHref: string;
}
export interface ReportSections {
  toldUs: { label: string; value: string }[];
  estimates: { label: string; value: string; formula: string }[];
  opportunities: ReportOpportunity[];
  growth: { slug: string; name: string; href: string; hypothesis: string }[];
  exclusions: { topic: string; reason: string }[];
  package: { key: string; name: string; reason: string };
  nextSteps: string[];
  summaryHypothesis: string;
  weightVersion: number | null;
  generator: string;
  organisation: string;
  industryName: string;
  createdAt: string;
}

const label = <T extends readonly { key: string; label: string }[]>(arr: T, key: string) => arr.find((a) => a.key === key)?.label ?? key;

/** Default fully loaded hourly cost by company size (KES) — an assumption, labelled as such in the report. */
const HOURLY_BY_SIZE: Record<string, number> = { "1-5": 450, "6-20": 550, "21-50": 650, "51-200": 750, "201-1000": 900, "1000+": 1100 };

const hypothesisSchema = z.object({
  summary: z.string().describe("Two or three sentences: the overall picture for this business, phrased as hypotheses to validate."),
  opportunities: z.array(z.object({ slug: z.string(), hypothesis: z.string().describe("One or two sentences on why this could help THIS business and what must be validated. No numbers that were not provided.") })),
  growth: z.array(z.object({ slug: z.string(), hypothesis: z.string() })),
});

function rulesHypothesis(a: AssessmentAnswers, o: ReportOpportunity, catSolution?: Catalogue["solutions"][number]) {
  const task = a.tasks[0] ?? a.tasksOther.split(/[.;\n]/)[0] ?? "the process you described";
  const cap = catSolution?.capabilities[0]?.toLowerCase() ?? "automating the routine steps";
  const freq = label(FREQUENCIES, a.frequency).toLowerCase();
  const data = catSolution?.dataRequired[0]?.toLowerCase() ?? "the data involved";
  return `Because "${task}" happens ${freq} and you reported ${label(ERROR_FREQUENCIES, a.errorFrequency).split(".")[0].toLowerCase()} errors, ${o.name} could plausibly reduce manual effort through ${cap}. To validate: the quality and availability of ${data}, and the real volume of exceptions.`;
}

export async function buildReport(
  cat: Catalogue,
  a: AssessmentAnswers,
  organisation: string,
  opts: { useAi: boolean },
): Promise<ReportSections> {
  const industry = cat.industries.find((i) => i.slug === a.industry);
  const ranked = rankOpportunities(cat.solutions, a, cat.weights.weights, 5, industry?.solutions ?? []);
  const exclusions = detectExclusions(a);
  const pkg = recommendPackage(a, ranked);
  const pkgObj = cat.packages.find((p) => p.key === pkg.key)!;

  const hourly = HOURLY_BY_SIZE[a.companySize] ?? 650;
  const hoursYear = (a.volumePerMonth * a.minutesPerTask * 12) / 60;

  const opportunities: ReportOpportunity[] = ranked.map((o) => {
    const s = cat.solutions.find((x) => x.slug === o.solution)!;
    const top = [...CRITERIA]
      .map((c) => ({ label: c.label.replace(" (lower is better)", ""), points: o.contributions[c.key] }))
      .sort((x, y) => y.points - x.points)
      .slice(0, 3);
    const integrations = s.integrations.slice(0, 5).map((slug) => {
      const i = cat.integrations.find((x) => x.slug === slug);
      return { name: i?.name.replace(/ \(.*\)$/, "") ?? slug, status: i?.status ?? "planned" };
    });
    const risks: string[] = [];
    if (s.riskClass !== "standard") risks.push(s.riskClass === "high" ? "High-impact decisions: a person must decide" : "Financial or customer-facing actions need approval gates");
    if (integrations.some((i) => i.status !== "supported")) risks.push("Some integrations are planned or need assessment; first delivery may use file exports");
    if (a.software.includes("paper")) risks.push("Paper-based records reduce data readiness; a digitisation step may be needed");
    const dependencies = s.dataRequired.slice(0, 3);
    const roiCalc = { "mpesa-bank-reconciliation": "reconciliation-hours", "ai-voice-receptionist": "missed-call-revenue", "whatsapp-sales-support-agent": "whatsapp-after-hours", "etims-compliance-reconciliation": "etims-deduction-at-risk", "sha-claims-scrubber": "sha-rejection-recovery", "collections-receivables": "collections-uplift" }[s.slug];
    const base = {
      slug: s.slug,
      name: s.name,
      href: `/solutions/${s.category}/${s.slug}`,
      status: s.status,
      score: o.score,
      flag: o.flag,
      flagReason: o.flagReason,
      rationale: o.rationale,
      topCriteria: top,
      complexity: s.complexity,
      timeline: s.timeline,
      integrations,
      risks,
      dependencies,
      ownerMetric: s.ownerMetric,
      roiHref: roiCalc ? `/roi/${roiCalc}` : `/roi/master?tasksPerMonth=${a.volumePerMonth}&minutesPerTask=${a.minutesPerTask}&hourlyCost=${hourly}`,
      hypothesis: "",
    };
    return { ...base, hypothesis: rulesHypothesis(a, base, s) };
  });

  const growth = a.growthGoals
    .map((g) => GROWTH_GOALS.find((x) => x.key === g))
    .filter(Boolean)
    .slice(0, 3)
    .map((g) => {
      const svc = cat.growthServices.find((s) => s.slug === g!.service)!;
      return { slug: svc.slug, name: svc.name, href: `/growth/${svc.slug}`, hypothesis: `You want to ${g!.label.toLowerCase()}. ${svc.summary} To validate: your current channels, budget and baseline numbers.` };
    });

  let summary = `Your answers point to ${opportunities.length ? `${opportunities[0].name} as the strongest starting point` : "no single catalogue solution as a clear fit, which usually means a custom design"}. These are hypotheses based on your answers. A Strategy Session or Automation Diagnostic would confirm volumes, data quality and the right owner metric.`;
  let generator = "rules";

  if (opts.useAi && opportunities.length) {
    const ai = await generateStructured({
      promptKey: "assessment.hypotheses",
      promptVersion: "1",
      budgetScope: "public",
      model: "fast",
      maxTokens: 2500,
      instructions:
        "You write short, careful hypotheses for a preliminary automation report for a business in Kenya/East Africa. Use UK English. Never invent figures, savings or guarantees. Phrase everything as a hypothesis to validate. Do not give legal, tax, clinical or credit advice. Keep each hypothesis under 60 words.",
      task: `Write a summary and one hypothesis for each listed opportunity and growth service. Opportunities: ${JSON.stringify(opportunities.map((o) => ({ slug: o.slug, name: o.name, rationale: o.rationale })))}. Growth services: ${JSON.stringify(growth.map((g) => ({ slug: g.slug, name: g.name })))}.`,
      untrusted: { industry: industry?.name, companySize: a.companySize, functions: a.functions, tasks: a.tasks, tasksOther: a.tasksOther, frequency: a.frequency, volumePerMonth: a.volumePerMonth, minutesPerTask: a.minutesPerTask, errorFrequency: a.errorFrequency, errorImpact: a.errorImpact, customerImpact: a.customerImpact, outcome: a.outcome },
      schema: hypothesisSchema,
    });
    if (ai.ok) {
      summary = ai.data.summary;
      for (const h of ai.data.opportunities) {
        const o = opportunities.find((x) => x.slug === h.slug);
        if (o && h.hypothesis.length > 20) o.hypothesis = h.hypothesis;
      }
      for (const h of ai.data.growth) {
        const g = growth.find((x) => x.slug === h.slug);
        if (g && h.hypothesis.length > 20) g.hypothesis = h.hypothesis;
      }
      generator = `${ai.meta.model} · ${ai.meta.promptKey}@${ai.meta.promptVersion}`;
    }
  }

  const toldUs = [
    { label: "Industry", value: industry?.name ?? a.industry },
    { label: "Company size", value: label(COMPANY_SIZES, a.companySize) },
    { label: "Location", value: [a.county, a.country].filter(Boolean).join(", ") },
    { label: "Functions to explore", value: a.functions.map((f) => label(FUNCTIONS, f)).join(", ") },
    { label: "Current software", value: a.software.map((s) => label(SOFTWARE, s)).concat(a.softwareOther ? [a.softwareOther] : []).join(", ") || "Not specified" },
    { label: "Most repetitive tasks", value: [...a.tasks, a.tasksOther].filter(Boolean).join("; ") || "Not specified" },
    { label: "How often", value: `${label(FREQUENCIES, a.frequency)}, about ${formatNumber(a.volumePerMonth)} times a month, ${a.minutesPerTask} minutes each, ${a.people} people involved` },
    { label: "Errors and rework", value: `${label(ERROR_FREQUENCIES, a.errorFrequency)}; impact: ${label(ERROR_IMPACTS, a.errorImpact)}` },
    { label: "Customer impact", value: a.customerImpact.map((c) => label(CUSTOMER_IMPACTS, c)).join(", ") || "None reported" },
    { label: "Growth goals", value: a.growthGoals.map((g) => label(GROWTH_GOALS, g)).join(", ") || "None selected" },
    { label: "Urgency and budget", value: `${label(URGENCY, a.urgency)}; ${label(BUDGETS, a.budget)}` },
    ...(a.outcome ? [{ label: "Desired outcome", value: a.outcome }] : []),
  ];

  const estimates = [
    { label: "Time spent on the main task", value: `${formatNumber(hoursYear)} hours a year`, formula: `${formatNumber(a.volumePerMonth)} times/month × ${a.minutesPerTask} min × 12 ÷ 60` },
    { label: "Value of that time (labour capacity, not cash)", value: formatMoney(hoursYear * hourly), formula: `${formatNumber(hoursYear)} h × ${formatMoney(hourly)}/h (assumed fully loaded cost for your company size; change it in the calculator)` },
    { label: "If 60–80% of it were automated", value: `${formatNumber(hoursYear * 0.6)}–${formatNumber(hoursYear * 0.8)} hours freed a year`, formula: "Hours × 60% (low) to 80% (high) coverage, before review time" },
  ];

  return {
    toldUs,
    estimates,
    opportunities,
    growth,
    exclusions,
    package: { key: pkg.key, name: pkgObj.name, reason: pkg.reason },
    nextSteps: [
      "Check the opportunity scores and their reasons below. Disagree with something? Tell us.",
      "Open the ROI calculator link on your top opportunity and adjust the assumptions to match your business.",
      a.urgency === "now" ? "Book a Strategy Session to turn the top opportunity into a fixed-scope plan." : "Book a free Discovery Call when you are ready to discuss priorities.",
      "If you go ahead, the Automation Diagnostic measures the real baseline, and its fee is credited against your build.",
    ],
    summaryHypothesis: summary,
    weightVersion: cat.weights.id,
    generator: generator === "rules" ? "rules" : generator,
    organisation,
    industryName: industry?.name ?? a.industry,
    createdAt: new Date().toISOString(),
  };
}

export const ASSESSMENT_MODEL = MODELS.fast;
