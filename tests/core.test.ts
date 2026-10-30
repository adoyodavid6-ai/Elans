import { describe, expect, it } from "vitest";
import { masterCore, calculators, sanitiseInputs, defaultsFor, getCalculator } from "@/lib/core/roi";
import { evaluateQuote, maxDiscountForTerm } from "@/lib/core/quote";
import { rankOpportunities, scoreSolution, detectExclusions, DEFAULT_WEIGHTS, recommendPackage } from "@/lib/core/scoring";
import { answersSchema, type AssessmentAnswers } from "@/lib/core/assessment";
import { seed } from "@/content/seed";

describe("ROI master calculator", () => {
  const base = {
    tasksPerMonth: 100, minutesPerTask: 6, hourlyCost: 600, errorRatePct: 10, costPerError: 1000,
    coveragePct: 50, errorReductionPct: 50, reviewMinutesPerTask: 1, implementationFee: 60000,
    monthlyFee: 5000, usageCostPerMonth: 0, maintenancePerYear: 0, incrementalRevenuePerYear: 0,
  };
  it("computes baseline, capacity and cash separately", () => {
    const r = masterCore(base);
    expect(r.baselineHours).toBe(120); // 1200 tasks × 6 min
    expect(r.baselineLabour).toBe(72000);
    expect(r.baselineErrors).toBe(120000); // 1200 × 10% × 1000
    expect(r.hoursSaved).toBe(50); // 600 automated × 5 min
    expect(r.labourCapacity).toBe(30000);
    expect(r.avoidableErrors).toBe(30000); // 120000 × 50% × 50%
    expect(r.firstYearCost).toBe(120000);
    expect(r.netBenefit).toBe(-60000);
    expect(r.cashNet).toBe(-90000);
    expect(r.paybackMonths).toBeNull(); // monthly benefit 5000 − running 5000 = 0
  });
  it("review time can never create negative savings", () => {
    expect(masterCore({ ...base, reviewMinutesPerTask: 20 }).hoursSaved).toBe(0);
  });
  it("produces low ≤ base ≤ high scenarios", () => {
    const res = calculators[0].compute(defaultsFor(calculators[0]), "KES");
    const nb = (n: number) => res.scenarios![n].outputs.find((o) => o.key === "netBenefit")!.value!;
    expect(nb(0)).toBeLessThanOrEqual(nb(1));
    expect(nb(1)).toBeLessThanOrEqual(nb(2));
    expect(res.formulas.length).toBeGreaterThan(5);
  });
  it("every calculator computes on defaults and sanitises input", () => {
    for (const c of calculators) {
      const r = c.compute(defaultsFor(c), "KES");
      expect(r.outputs.length).toBeGreaterThan(0);
      expect(r.formulas.length).toBeGreaterThan(0);
    }
    const c = getCalculator("missed-call-revenue")!;
    const s = sanitiseInputs(c, { callsPerDay: "-5", missedPct: 400 });
    expect(s.callsPerDay).toBe(0);
    expect(s.missedPct).toBe(100);
  });
});

describe("quote rules", () => {
  const lines = [
    { kind: "setup" as const, description: "Setup", amount: 120000, qty: 1, cost: 30000 },
    { kind: "monthly" as const, description: "Run", amount: 24000, qty: 1, cost: 6000 },
  ];
  it("passes a well-formed quote", () => {
    const r = evaluateQuote({ lines, termMonths: 6, discountPct: 0, splitSetup: true, projected90DayValue: 360000, marginFloor: 0.65, minTermMonths: 6 });
    expect(r.canSend).toBe(true);
    expect(r.totals.instalments.reduce((a, b) => a + b, 0)).toBeCloseTo(120000, 2);
    expect(r.totals.contractValue).toBe(264000);
  });
  it("blocks discounts without term and margin breaches", () => {
    const r = evaluateQuote({ lines, termMonths: 6, discountPct: 10, splitSetup: false, projected90DayValue: 360000, marginFloor: 0.65, minTermMonths: 6 });
    expect(r.checks.find((c) => c.key === "discount")!.level).toBe("error");
    const m = evaluateQuote({ lines: [{ ...lines[0], cost: 110000 }, lines[1]], termMonths: 6, discountPct: 0, splitSetup: false, projected90DayValue: 360000, marginFloor: 0.65, minTermMonths: 6 });
    expect(m.checks.find((c) => c.key === "margin")!.level).toBe("error");
    expect(m.canSend).toBe(false);
    expect(maxDiscountForTerm(24)).toBe(15);
  });
});

describe("opportunity scoring", () => {
  const answers: AssessmentAnswers = answersSchema.parse({
    industry: "education", companySize: "51-200", functions: ["payments", "collections"], software: ["mpesa-daraja", "csv-excel"],
    tasks: ["Matching fee payments", "Chasing fee balances"], frequency: "daily", volumePerMonth: 1500, minutesPerTask: 4, people: 2,
    errorFrequency: "often", errorImpact: "medium", customerImpact: ["complaints"], growthGoals: ["retention"], urgency: "now",
  });
  it("ranks the obviously relevant solutions first", () => {
    const fit = seed.industries.find((i) => i.slug === "education")!.solutions;
    const top = rankOpportunities(seed.solutions, answers, DEFAULT_WEIGHTS, 5, fit).map((o) => o.solution);
    expect(top.slice(0, 3)).toEqual(expect.arrayContaining(["school-fee-collection"]));
    expect(top).toEqual(expect.arrayContaining(["mpesa-bank-reconciliation"]));
  });
  it("surfaces digital transformation for a paper- and spreadsheet-based business", () => {
    const a = answersSchema.parse({
      industry: "general-smes", companySize: "21-50", functions: ["transformation", "records"], software: ["paper", "csv-excel"],
      tasks: ["Paper forms for approvals", "Too many spreadsheets that one person knows"], frequency: "daily", volumePerMonth: 400, minutesPerTask: 10, people: 3,
      errorFrequency: "often", errorImpact: "medium", customerImpact: [], growthGoals: [], urgency: "quarter",
    });
    const fit = seed.industries.find((i) => i.slug === "general-smes")!.solutions;
    const top = rankOpportunities(seed.solutions, a, DEFAULT_WEIGHTS, 5, fit).map((o) => o.solution);
    expect(top).toEqual(expect.arrayContaining(["paper-to-digital-processes", "spreadsheet-to-system"]));
  });
  it("scores are bounded, explained and flag high-risk solutions", () => {
    const s = seed.solutions.find((x) => x.slug === "collections-receivables")!;
    const o = scoreSolution(s, answers);
    expect(o.score).toBeGreaterThan(0);
    expect(o.score).toBeLessThanOrEqual(100);
    expect(o.flag).toBe("human_review");
    expect(o.rationale).toMatch(/Scores \d+\/100/);
  });
  it("changing weights changes scores deterministically", () => {
    const s = seed.solutions.find((x) => x.slug === "mpesa-bank-reconciliation")!;
    const a = scoreSolution(s, answers).score;
    const b = scoreSolution(s, answers, { ...DEFAULT_WEIGHTS, strategicFit: 40 }).score;
    expect(a).not.toBe(b);
    expect(scoreSolution(s, answers).score).toBe(a);
  });
  it("detects excluded requests", () => {
    const ex = detectExclusions({ ...answers, outcome: "We want the AI to diagnose patients and approve loans automatically" });
    expect(ex.map((e) => e.topic)).toEqual(expect.arrayContaining(["Clinical decisions", "Automated credit decisions"]));
  });
  it("recommends a package", () => {
    expect(recommendPackage({ ...answers, companySize: "1-5" }, []).key).toBe("launch");
    expect(recommendPackage({ ...answers, companySize: "1000+" }, []).key).toBe("enterprise");
  });
});

describe("database URL resolution", () => {
  it("uses explicit app and admin URLs as given", async () => {
    const { resolveDbUrls } = await import("@/lib/db/urls");
    const r = resolveDbUrls({ DATABASE_URL: "postgres://elans_app:x@h/db", DATABASE_ADMIN_URL: "postgres://owner:y@h/db" } as unknown as NodeJS.ProcessEnv);
    expect(r).toMatchObject({ app: "postgres://elans_app:x@h/db", admin: "postgres://owner:y@h/db", derived: false });
  });
  it("derives a restricted app role from an owner-only URL (Neon integration)", async () => {
    const { resolveDbUrls, derivedAppPassword } = await import("@/lib/db/urls");
    const env = { DATABASE_URL: "postgres://neondb_owner:pw@ep-x-pooler.neon.tech/neondb?sslmode=require", DATABASE_URL_UNPOOLED: "postgres://neondb_owner:pw@ep-x.neon.tech/neondb?sslmode=require", SESSION_SECRET: "s".repeat(40) } as unknown as NodeJS.ProcessEnv;
    const r = resolveDbUrls(env);
    expect(r.derived).toBe(true);
    expect(r.admin).toBe(env.DATABASE_URL_UNPOOLED);
    const app = new URL(r.app!);
    expect(app.username).toBe("elans_app");
    expect(app.password).toBe(derivedAppPassword(env.SESSION_SECRET!));
    expect(app.host).toBe("ep-x-pooler.neon.tech");
    expect(app.searchParams.get("sslmode")).toBe("require");
  });
  it("refuses to run the app as the owner when no secret is available", async () => {
    const { resolveDbUrls } = await import("@/lib/db/urls");
    expect(resolveDbUrls({ DATABASE_URL: "postgres://owner:pw@h/db" } as unknown as NodeJS.ProcessEnv).app).toBeNull();
  });
});
