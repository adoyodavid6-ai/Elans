import { clamp, formatMoney, formatNumber, formatPct } from "./money";

/**
 * ROI calculators (§10). Every output is traceable to a formula shown to the user.
 * Labour capacity (time freed) is always reported separately from cash effects.
 */
export const ROI_FORMULA_VERSION = "2026.10-1";

export type FieldUnit = "count" | "minutes" | "money" | "percent" | "days" | "hours";
export interface RoiField {
  key: string;
  label: string;
  unit: FieldUnit;
  default: number;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
  group?: string;
  optional?: boolean;
}
export type OutputKind = "capacity" | "cash" | "cost" | "ratio" | "info" | "time";
export interface RoiOutput {
  key: string;
  label: string;
  value: number | null;
  display: string;
  kind: OutputKind;
  emphasis?: boolean;
}
export interface RoiScenario {
  name: "Low" | "Base" | "High";
  note: string;
  outputs: RoiOutput[];
}
export interface RoiResult {
  outputs: RoiOutput[];
  scenarios?: RoiScenario[];
  formulas: string[];
  assumptions: string[];
  disclaimer: string;
}
export interface RoiCalculator {
  slug: string;
  name: string;
  short: string;
  summary: string;
  solution?: string;
  fields: RoiField[];
  compute: (inputs: Record<string, number>, currency: string) => RoiResult;
}

const DISCLAIMER =
  "Estimates only, based on the figures you entered and the assumptions shown. Not a guarantee of savings or revenue. Labour capacity is time freed, not cash, unless that time is redeployed or avoids future hiring.";

const pct = (v: number) => clamp(v, 0, 100) / 100;

// ───────────────────────────── Master calculator ─────────────────────────────
export interface MasterInputs {
  tasksPerMonth: number;
  minutesPerTask: number;
  hourlyCost: number;
  errorRatePct: number;
  costPerError: number;
  coveragePct: number;
  errorReductionPct: number;
  reviewMinutesPerTask: number;
  implementationFee: number;
  monthlyFee: number;
  usageCostPerMonth: number;
  maintenancePerYear: number;
  incrementalRevenuePerYear: number;
}

export function masterCore(i: MasterInputs) {
  const tasksYear = i.tasksPerMonth * 12;
  const baselineHours = (tasksYear * i.minutesPerTask) / 60;
  const baselineLabour = baselineHours * i.hourlyCost;
  const baselineErrors = tasksYear * pct(i.errorRatePct) * i.costPerError;
  const baselineTotal = baselineLabour + baselineErrors;
  const automatedTasks = tasksYear * pct(i.coveragePct);
  const minutesSavedPerTask = Math.max(0, i.minutesPerTask - i.reviewMinutesPerTask);
  const hoursSaved = (automatedTasks * minutesSavedPerTask) / 60;
  const labourCapacity = hoursSaved * i.hourlyCost;
  const avoidableErrors = baselineErrors * pct(i.coveragePct) * pct(i.errorReductionPct);
  const firstYearCost = i.implementationFee + i.monthlyFee * 12 + i.usageCostPerMonth * 12 + i.maintenancePerYear;
  const grossBenefit = labourCapacity + avoidableErrors + i.incrementalRevenuePerYear;
  const netBenefit = grossBenefit - firstYearCost;
  const cashNet = avoidableErrors + i.incrementalRevenuePerYear - firstYearCost;
  const monthlyBenefit = grossBenefit / 12;
  const monthlyRunning = i.monthlyFee + i.usageCostPerMonth + i.maintenancePerYear / 12;
  const monthlyNet = monthlyBenefit - monthlyRunning;
  const paybackMonths = monthlyNet > 0 ? i.implementationFee / monthlyNet : null;
  const bcr = firstYearCost > 0 ? grossBenefit / firstYearCost : null;
  return { baselineHours, baselineLabour, baselineErrors, baselineTotal, hoursSaved, labourCapacity, avoidableErrors, firstYearCost, grossBenefit, netBenefit, cashNet, paybackMonths, bcr };
}

function masterOutputs(r: ReturnType<typeof masterCore>, cur: string): RoiOutput[] {
  return [
    { key: "baselineTotal", label: "Baseline annual process cost", value: r.baselineTotal, display: formatMoney(r.baselineTotal, cur), kind: "info" },
    { key: "hoursSaved", label: "Hours freed per year", value: r.hoursSaved, display: `${formatNumber(r.hoursSaved)} h`, kind: "time" },
    { key: "labourCapacity", label: "Labour-capacity value (time, not cash)", value: r.labourCapacity, display: formatMoney(r.labourCapacity, cur), kind: "capacity" },
    { key: "avoidableErrors", label: "Avoidable error cost (cash)", value: r.avoidableErrors, display: formatMoney(r.avoidableErrors, cur), kind: "cash" },
    { key: "firstYearCost", label: "First-year solution cost", value: r.firstYearCost, display: formatMoney(r.firstYearCost, cur), kind: "cost" },
    { key: "netBenefit", label: "Net economic benefit, year one", value: r.netBenefit, display: formatMoney(r.netBenefit, cur), kind: r.netBenefit >= 0 ? "cash" : "cost", emphasis: true },
    { key: "cashNet", label: "Net cash effect, year one (excludes labour capacity)", value: r.cashNet, display: formatMoney(r.cashNet, cur), kind: r.cashNet >= 0 ? "cash" : "cost" },
    { key: "payback", label: "Payback period", value: r.paybackMonths, display: r.paybackMonths === null ? "Not reached on these inputs" : `${formatNumber(r.paybackMonths, 1)} months`, kind: "time", emphasis: true },
    { key: "bcr", label: "Benefit-to-cost ratio", value: r.bcr, display: r.bcr === null ? "n/a" : `${formatNumber(r.bcr, 2)} : 1`, kind: "ratio" },
  ];
}

export const masterCalculator: RoiCalculator = {
  slug: "master",
  name: "Automation ROI calculator",
  short: "Master calculator",
  summary: "Model any workflow: baseline cost, hours freed, avoidable errors, solution cost, payback and low/base/high scenarios.",
  fields: [
    { key: "tasksPerMonth", label: "How many times does the task happen per month?", unit: "count", default: 800, min: 0, step: 10, group: "The process today" },
    { key: "minutesPerTask", label: "Minutes per task (all people involved)", unit: "minutes", default: 6, min: 0, step: 1, group: "The process today" },
    { key: "hourlyCost", label: "Fully loaded cost of one staff hour", unit: "money", default: 700, min: 0, step: 50, group: "The process today", help: "Salary plus statutory deductions, benefits and overheads, divided by productive hours." },
    { key: "errorRatePct", label: "Share of tasks with an error or rework", unit: "percent", default: 4, min: 0, max: 100, step: 0.5, group: "The process today" },
    { key: "costPerError", label: "Average cost of one error", unit: "money", default: 1500, min: 0, step: 100, group: "The process today", help: "Rework time, write-offs, penalties or customer compensation." },
    { key: "coveragePct", label: "Share of tasks the automation handles", unit: "percent", default: 70, min: 0, max: 100, step: 5, group: "With automation", help: "Be conservative. Exceptions still need people." },
    { key: "errorReductionPct", label: "Reduction in errors on automated tasks", unit: "percent", default: 60, min: 0, max: 100, step: 5, group: "With automation" },
    { key: "reviewMinutesPerTask", label: "Human review minutes per automated task", unit: "minutes", default: 1, min: 0, step: 0.5, group: "With automation" },
    { key: "implementationFee", label: "Implementation (setup) fee", unit: "money", default: 120000, min: 0, step: 10000, group: "Solution cost" },
    { key: "monthlyFee", label: "Monthly management fee", unit: "money", default: 20000, min: 0, step: 1000, group: "Solution cost" },
    { key: "usageCostPerMonth", label: "Third-party usage costs per month", unit: "money", default: 3000, min: 0, step: 500, group: "Solution cost", help: "Messaging, telephony, AI tokens or document pages beyond the allowance." },
    { key: "maintenancePerYear", label: "Other maintenance costs per year", unit: "money", default: 0, min: 0, step: 1000, group: "Solution cost" },
    { key: "incrementalRevenuePerYear", label: "Verified incremental revenue per year (optional)", unit: "money", default: 0, min: 0, step: 10000, group: "Revenue (optional)", optional: true, help: "Only include revenue you can measure against a baseline." },
  ],
  compute(raw, cur) {
    const i = raw as unknown as MasterInputs;
    const base = masterCore(i);
    const low = masterCore({ ...i, coveragePct: i.coveragePct * 0.6, errorReductionPct: i.errorReductionPct * 0.6, reviewMinutesPerTask: i.reviewMinutesPerTask * 1.5, incrementalRevenuePerYear: i.incrementalRevenuePerYear * 0.5 });
    const high = masterCore({ ...i, coveragePct: Math.min(95, i.coveragePct * 1.15), errorReductionPct: Math.min(95, i.errorReductionPct * 1.15), incrementalRevenuePerYear: i.incrementalRevenuePerYear * 1.2 });
    return {
      outputs: masterOutputs(base, cur),
      scenarios: [
        { name: "Low", note: "Coverage and error reduction at 60% of your estimate; review time +50%; revenue halved.", outputs: masterOutputs(low, cur) },
        { name: "Base", note: "Your inputs as entered.", outputs: masterOutputs(base, cur) },
        { name: "High", note: "Coverage and error reduction +15% (capped at 95%); revenue +20%.", outputs: masterOutputs(high, cur) },
      ],
      formulas: [
        "Baseline hours = tasks per month × 12 × minutes per task ÷ 60",
        "Baseline labour cost = baseline hours × hourly cost",
        "Baseline error cost = tasks per month × 12 × error rate × cost per error",
        "Hours freed = tasks per month × 12 × coverage × (minutes per task − review minutes) ÷ 60",
        "Labour-capacity value = hours freed × hourly cost",
        "Avoidable error cost = baseline error cost × coverage × error reduction",
        "First-year cost = setup + 12 × (monthly fee + usage) + maintenance",
        "Net economic benefit = labour capacity + avoidable errors + incremental revenue − first-year cost",
        "Payback = setup ÷ (monthly benefit − monthly running cost)",
        "Benefit-to-cost ratio = (labour capacity + avoidable errors + incremental revenue) ÷ first-year cost",
      ],
      assumptions: [
        `Coverage ${formatPct(pct(i.coveragePct))} and error reduction ${formatPct(pct(i.errorReductionPct))} are your estimates; Elans measures the real figures during the Prove period.`,
        "Labour capacity becomes a cash saving only if the time is redeployed or avoids hiring.",
        "Incremental revenue should be counted only with a clean baseline.",
      ],
      disclaimer: DISCLAIMER,
    };
  },
};

// ───────────────────────────── Specialist calculators ─────────────────────────────
function simple(outputs: RoiOutput[], formulas: string[], assumptions: string[]): RoiResult {
  return { outputs, formulas, assumptions, disclaimer: DISCLAIMER };
}

export const specialistCalculators: RoiCalculator[] = [
  {
    slug: "missed-call-revenue",
    name: "Missed-call revenue estimator",
    short: "Missed calls",
    summary: "What unanswered calls may be worth, and how much an AI receptionist could recover.",
    solution: "ai-voice-receptionist",
    fields: [
      { key: "callsPerDay", label: "Inbound calls per day", unit: "count", default: 40, min: 0 },
      { key: "missedPct", label: "Share of calls missed or sent to voicemail", unit: "percent", default: 25, min: 0, max: 100 },
      { key: "bookingPct", label: "Share of answered calls that become a booking or sale", unit: "percent", default: 30, min: 0, max: 100 },
      { key: "avgValue", label: "Average value of a booking or sale", unit: "money", default: 2500, min: 0, step: 100 },
      { key: "daysPerMonth", label: "Trading days per month", unit: "days", default: 26, min: 1, max: 31 },
      { key: "resolvePct", label: "Share of missed calls the AI receptionist could resolve or book", unit: "percent", default: 60, min: 0, max: 100, help: "Measured on your call types during the Prove period." },
    ],
    compute: (i, cur) => {
      const missed = i.callsPerDay * pct(i.missedPct) * i.daysPerMonth;
      const atRisk = missed * pct(i.bookingPct) * i.avgValue;
      const recoverable = atRisk * pct(i.resolvePct);
      return simple(
        [
          { key: "missed", label: "Missed calls per month", value: missed, display: formatNumber(missed), kind: "info" },
          { key: "atRisk", label: "Revenue potentially lost per month", value: atRisk, display: formatMoney(atRisk, cur), kind: "cash" },
          { key: "recoverable", label: "Estimated recoverable per month", value: recoverable, display: formatMoney(recoverable, cur), kind: "cash", emphasis: true },
          { key: "recoverableYear", label: "Estimated recoverable per year", value: recoverable * 12, display: formatMoney(recoverable * 12, cur), kind: "cash" },
        ],
        ["Missed calls = calls per day × missed share × trading days", "Revenue at risk = missed calls × booking rate × average value", "Recoverable = revenue at risk × share the AI resolves"],
        ["Assumes missed callers convert at the same rate as answered callers. Many will not call back at all.", "Not every recovered call is new revenue; some callers would have tried again."],
      );
    },
  },
  {
    slug: "whatsapp-after-hours",
    name: "WhatsApp after-hours leakage",
    short: "WhatsApp after hours",
    summary: "Estimate sales lost when WhatsApp enquiries wait until morning.",
    solution: "whatsapp-sales-support-agent",
    fields: [
      { key: "enquiriesPerWeek", label: "WhatsApp enquiries per week", unit: "count", default: 150, min: 0 },
      { key: "afterHoursPct", label: "Share arriving outside working hours", unit: "percent", default: 35, min: 0, max: 100 },
      { key: "lostPct", label: "Share of after-hours enquirers who buy elsewhere before you reply", unit: "percent", default: 30, min: 0, max: 100 },
      { key: "conversionPct", label: "Normal enquiry-to-sale conversion", unit: "percent", default: 20, min: 0, max: 100 },
      { key: "avgOrder", label: "Average order value", unit: "money", default: 3500, min: 0, step: 100 },
    ],
    compute: (i, cur) => {
      const afterHours = i.enquiriesPerWeek * pct(i.afterHoursPct) * 4.33;
      const lost = afterHours * pct(i.lostPct);
      const leakage = lost * pct(i.conversionPct) * i.avgOrder;
      return simple(
        [
          { key: "afterHours", label: "After-hours enquiries per month", value: afterHours, display: formatNumber(afterHours), kind: "info" },
          { key: "lost", label: "Enquiries lost to slow replies per month", value: lost, display: formatNumber(lost), kind: "info" },
          { key: "leakage", label: "Estimated monthly revenue leakage", value: leakage, display: formatMoney(leakage, cur), kind: "cash", emphasis: true },
          { key: "leakageYear", label: "Estimated annual revenue leakage", value: leakage * 12, display: formatMoney(leakage * 12, cur), kind: "cash" },
        ],
        ["After-hours enquiries = weekly enquiries × after-hours share × 4.33", "Lost enquiries = after-hours enquiries × share lost", "Leakage = lost enquiries × conversion × average order"],
        ["The 'share lost' figure is your estimate; track it by comparing reply times with conversion."],
      );
    },
  },
  {
    slug: "reconciliation-hours",
    name: "Reconciliation hours calculator",
    short: "Reconciliation hours",
    summary: "How many hours matching M-Pesa and bank payments costs you each month.",
    solution: "mpesa-bank-reconciliation",
    fields: [
      { key: "txnsPerMonth", label: "Payments received per month", unit: "count", default: 1200, min: 0, step: 50 },
      { key: "minutesPerTxn", label: "Minutes to match and receipt one payment", unit: "minutes", default: 3, min: 0, step: 0.5 },
      { key: "exceptionPct", label: "Share needing investigation (wrong reference etc.)", unit: "percent", default: 15, min: 0, max: 100 },
      { key: "minutesPerException", label: "Minutes per investigation", unit: "minutes", default: 12, min: 0 },
      { key: "hourlyCost", label: "Fully loaded cost of one staff hour", unit: "money", default: 650, min: 0, step: 50 },
      { key: "autoMatchPct", label: "Share matched automatically after setup", unit: "percent", default: 80, min: 0, max: 100, help: "Measured during the Prove period." },
    ],
    compute: (i, cur) => {
      const hours = (i.txnsPerMonth * i.minutesPerTxn + i.txnsPerMonth * pct(i.exceptionPct) * i.minutesPerException) / 60;
      const cost = hours * i.hourlyCost;
      const remainingHours = hours * (1 - pct(i.autoMatchPct)) + (i.txnsPerMonth * pct(i.autoMatchPct) * 0.1) / 60;
      const freed = Math.max(0, hours - remainingHours);
      return simple(
        [
          { key: "hours", label: "Hours spent per month today", value: hours, display: `${formatNumber(hours, 1)} h`, kind: "time" },
          { key: "cost", label: "Monthly cost of that time", value: cost, display: formatMoney(cost, cur), kind: "capacity" },
          { key: "freed", label: "Hours freed per month (estimate)", value: freed, display: `${formatNumber(freed, 1)} h`, kind: "time", emphasis: true },
          { key: "capacity", label: "Labour-capacity value per year", value: freed * i.hourlyCost * 12, display: formatMoney(freed * i.hourlyCost * 12, cur), kind: "capacity" },
        ],
        ["Hours today = (payments × minutes each + payments × exception share × minutes per exception) ÷ 60", "Remaining hours = hours today × (1 − auto-match share) + 6 seconds of review per auto-matched payment", "Hours freed = hours today − remaining hours"],
        ["Auto-match share depends on how consistently customers use account references."],
      );
    },
  },
  {
    slug: "etims-deduction-at-risk",
    name: "eTIMS deduction-at-risk explainer",
    short: "eTIMS at risk",
    summary: "An educational illustration of how unsupported purchase invoices could affect your tax position. Not tax advice.",
    solution: "etims-compliance-reconciliation",
    fields: [
      { key: "monthlyPurchases", label: "Monthly deductible purchases (excl. VAT)", unit: "money", default: 2_000_000, min: 0, step: 50000 },
      { key: "unsupportedPct", label: "Share without valid eTIMS support (your estimate)", unit: "percent", default: 10, min: 0, max: 100 },
      { key: "taxRatePct", label: "Income tax rate to illustrate with", unit: "percent", default: 30, min: 0, max: 100, help: "Illustrative only. Confirm the rate that applies to you with your tax adviser ({{STATUTORY_RATES}})." },
      { key: "vatRatePct", label: "VAT rate on those purchases (input VAT)", unit: "percent", default: 16, min: 0, max: 100, help: "Illustrative. Confirm with your tax adviser." },
    ],
    compute: (i, cur) => {
      const atRiskYear = i.monthlyPurchases * pct(i.unsupportedPct) * 12;
      const incomeTax = atRiskYear * pct(i.taxRatePct);
      const inputVat = atRiskYear * pct(i.vatRatePct);
      return simple(
        [
          { key: "atRisk", label: "Expenses potentially at risk per year", value: atRiskYear, display: formatMoney(atRiskYear, cur), kind: "info", emphasis: true },
          { key: "incomeTax", label: "Illustrative additional income tax if disallowed", value: incomeTax, display: formatMoney(incomeTax, cur), kind: "cost" },
          { key: "inputVat", label: "Illustrative input VAT that may not be claimable", value: inputVat, display: formatMoney(inputVat, cur), kind: "cost" },
        ],
        ["Expenses at risk = monthly purchases × unsupported share × 12", "Illustrative income tax = expenses at risk × tax rate", "Illustrative input VAT = expenses at risk × VAT rate"],
        ["Excludes penalties and interest, which can be significant.", "Rules, exemptions and transitional provisions vary. This is not tax advice; speak to your tax adviser."],
      );
    },
  },
  {
    slug: "sha-rejection-recovery",
    name: "SHA claims recovery estimator",
    short: "SHA claims",
    summary: "Estimate the value tied up in returned or rejected claims and what earlier checks could recover.",
    solution: "sha-claims-scrubber",
    fields: [
      { key: "claimsPerMonth", label: "Claims submitted per month", unit: "count", default: 900, min: 0, step: 10 },
      { key: "avgClaim", label: "Average claim value", unit: "money", default: 6500, min: 0, step: 100 },
      { key: "returnPct", label: "Share returned or rejected", unit: "percent", default: 20, min: 0, max: 100, help: "Use your own data where possible." },
      { key: "avoidablePct", label: "Share of returns with an administrative cause", unit: "percent", default: 70, min: 0, max: 100 },
      { key: "preventPct", label: "Share of administrative returns that pre-submission checks could prevent", unit: "percent", default: 50, min: 0, max: 100 },
      { key: "delayDays", label: "Average delay for a returned claim (days)", unit: "days", default: 60, min: 0 },
      { key: "capitalCostPct", label: "Annual cost of capital / overdraft rate", unit: "percent", default: 16, min: 0, max: 100 },
    ],
    compute: (i, cur) => {
      const returnedValue = i.claimsPerMonth * i.avgClaim * pct(i.returnPct);
      const preventable = returnedValue * pct(i.avoidablePct) * pct(i.preventPct);
      const delayCost = preventable * pct(i.capitalCostPct) * (i.delayDays / 365);
      return simple(
        [
          { key: "returned", label: "Claim value returned or rejected per month", value: returnedValue, display: formatMoney(returnedValue, cur), kind: "info" },
          { key: "preventable", label: "Value pre-submission checks could keep on track per month", value: preventable, display: formatMoney(preventable, cur), kind: "cash", emphasis: true },
          { key: "delayCost", label: "Monthly financing cost of those delays", value: delayCost, display: formatMoney(delayCost, cur), kind: "cash" },
          { key: "preventableYear", label: "Value kept on track per year", value: preventable * 12, display: formatMoney(preventable * 12, cur), kind: "cash" },
        ],
        ["Returned value = claims × average value × return rate", "Preventable = returned value × administrative share × prevention rate", "Delay cost = preventable × cost of capital × delay days ÷ 365"],
        ["Some returned claims are eventually paid; the benefit is mostly faster cash and fewer write-offs.", "Administrative checks only. Clinical and coding decisions remain with qualified staff."],
      );
    },
  },
  {
    slug: "collections-uplift",
    name: "Collections uplift estimator",
    short: "Collections uplift",
    summary: "Model what consistent, automated follow-up could add to monthly recoveries.",
    solution: "collections-receivables",
    fields: [
      { key: "overdue", label: "Total overdue balance", unit: "money", default: 5_000_000, min: 0, step: 100000 },
      { key: "currentRecoveryPct", label: "Share of overdue balance recovered per month today", unit: "percent", default: 12, min: 0, max: 100 },
      { key: "upliftPts", label: "Uplift in monthly recovery rate (percentage points)", unit: "percent", default: 3, min: 0, max: 50, help: "Agree a baseline before treating any uplift as real." },
      { key: "officerHours", label: "Officer hours per month spent on routine reminders", unit: "hours", default: 120, min: 0 },
      { key: "hourlyCost", label: "Fully loaded cost of one officer hour", unit: "money", default: 600, min: 0 },
    ],
    compute: (i, cur) => {
      const today = i.overdue * pct(i.currentRecoveryPct);
      const extra = i.overdue * pct(i.upliftPts);
      const capacity = i.officerHours * 0.7 * i.hourlyCost;
      return simple(
        [
          { key: "today", label: "Recovered per month today", value: today, display: formatMoney(today, cur), kind: "info" },
          { key: "extra", label: "Additional recovery per month (scenario)", value: extra, display: formatMoney(extra, cur), kind: "cash", emphasis: true },
          { key: "capacity", label: "Officer capacity freed per month", value: capacity, display: formatMoney(capacity, cur), kind: "capacity" },
        ],
        ["Recovered today = overdue × current monthly recovery rate", "Additional recovery = overdue × uplift points", "Capacity freed = officer reminder hours × 70% × hourly cost"],
        ["The 70% assumes officers keep handling escalations and hardship cases.", "Uplift varies by portfolio; treat it as a scenario until measured."],
      );
    },
  },
  {
    slug: "content-production-cost",
    name: "Content production cost comparison",
    short: "Content cost",
    summary: "Compare the cost of producing content in-house with an Elans Studio bundle.",
    fields: [
      { key: "pieces", label: "Content pieces per month", unit: "count", default: 20, min: 0 },
      { key: "hoursPerPiece", label: "In-house hours per piece", unit: "hours", default: 3, min: 0, step: 0.5 },
      { key: "hourlyCost", label: "Fully loaded cost per hour", unit: "money", default: 800, min: 0 },
      { key: "externalPerPiece", label: "External costs per piece (shoots, freelancers)", unit: "money", default: 1500, min: 0 },
      { key: "studioMonthly", label: "Studio bundle per month", unit: "money", default: 75000, min: 0, help: "Indicative; see pricing." },
      { key: "approvalHours", label: "Your review and approval hours per month", unit: "hours", default: 4, min: 0 },
    ],
    compute: (i, cur) => {
      const inHouse = i.pieces * (i.hoursPerPiece * i.hourlyCost + i.externalPerPiece);
      const studio = i.studioMonthly + i.approvalHours * i.hourlyCost;
      const diff = inHouse - studio;
      return simple(
        [
          { key: "inHouse", label: "In-house cost per month", value: inHouse, display: formatMoney(inHouse, cur), kind: "cost" },
          { key: "studio", label: "Studio cost per month (incl. your approval time)", value: studio, display: formatMoney(studio, cur), kind: "cost" },
          { key: "diff", label: diff >= 0 ? "Monthly difference in favour of Studio" : "Monthly difference in favour of in-house", value: Math.abs(diff), display: formatMoney(Math.abs(diff), cur), kind: diff >= 0 ? "cash" : "cost", emphasis: true },
        ],
        ["In-house = pieces × (hours × hourly cost + external cost)", "Studio = bundle + approval hours × hourly cost"],
        ["Quality and brand fit matter more than unit cost; compare samples, not just prices."],
      );
    },
  },
  {
    slug: "ai-visibility-opportunity",
    name: "AI-visibility opportunity (qualitative)",
    short: "AI visibility",
    summary: "A quick self-assessment of how ready your business is to be recommended by AI assistants.",
    fields: [
      { key: "napConsistent", label: "Is your business name, address and phone identical everywhere online? (0 = no, 100 = yes)", unit: "percent", default: 50, min: 0, max: 100, step: 50 },
      { key: "faqContent", label: "Does your website answer common customer questions directly? (0–100)", unit: "percent", default: 25, min: 0, max: 100, step: 25 },
      { key: "schema", label: "Do you have structured data (Organization/Service/Product)? (0 = no, 100 = yes)", unit: "percent", default: 0, min: 0, max: 100, step: 100 },
      { key: "reviews", label: "Do you have recent reviews on major platforms? (0–100)", unit: "percent", default: 50, min: 0, max: 100, step: 25 },
      { key: "mentions", label: "Are you mentioned by independent sites (press, directories, associations)? (0–100)", unit: "percent", default: 25, min: 0, max: 100, step: 25 },
    ],
    compute: (i) => {
      const score = (i.napConsistent * 0.2 + i.faqContent * 0.25 + i.schema * 0.15 + i.reviews * 0.15 + i.mentions * 0.25);
      const band = score >= 75 ? "Strong foundations" : score >= 45 ? "Partial foundations" : "Weak foundations";
      return {
        outputs: [
          { key: "score", label: "AI-visibility readiness (self-assessed)", value: score, display: `${formatNumber(score)} / 100`, kind: "info", emphasis: true },
          { key: "band", label: "Assessment", value: null, display: band, kind: "info" },
        ],
        formulas: ["Readiness = 20% consistency + 25% answer content + 15% structured data + 15% reviews + 25% independent mentions"],
        assumptions: ["A qualitative readiness indicator, not a measurement of how AI assistants describe you. Run the AI Visibility Check for a sample snapshot."],
        disclaimer: "Qualitative self-assessment. AI assistant behaviour varies and cannot be guaranteed.",
      };
    },
  },
];

export const calculators: RoiCalculator[] = [masterCalculator, ...specialistCalculators];
export const getCalculator = (slug: string) => calculators.find((c) => c.slug === slug);

export function defaultsFor(calc: RoiCalculator): Record<string, number> {
  return Object.fromEntries(calc.fields.map((f) => [f.key, f.default]));
}

export function sanitiseInputs(calc: RoiCalculator, raw: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of calc.fields) {
    const n = Number(raw[f.key]);
    let v = Number.isFinite(n) ? n : f.default;
    if (f.min !== undefined) v = Math.max(f.min, v);
    if (f.max !== undefined) v = Math.min(f.max, v);
    out[f.key] = v;
  }
  return out;
}
