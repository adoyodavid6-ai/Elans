import { describe, expect, it } from "vitest";
import { seed } from "@/content/seed";
import { completeness } from "@/lib/content/completeness";

const solutionSlugs = new Set(seed.solutions.map((s) => s.slug));
const growthSlugs = new Set(seed.growthServices.map((g) => g.slug));
const packSlugs = new Set(seed.packs.map((p) => p.slug));
const industrySlugs = new Set(seed.industries.map((i) => i.slug));
const integrationSlugs = new Set(seed.integrations.map((i) => i.slug));
const categorySlugs = new Set(seed.categories.map((c) => c.slug));

describe("catalogue integrity", () => {
  it("has unique slugs", () => {
    expect(solutionSlugs.size).toBe(seed.solutions.length);
    expect(industrySlugs.size).toBe(seed.industries.length);
  });

  it("covers every category with at least 3 solutions", () => {
    for (const c of seed.categories) {
      const n = seed.solutions.filter((s) => s.category === c.slug).length;
      expect(n, c.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it("references resolve", () => {
    const problems: string[] = [];
    for (const s of seed.solutions) {
      if (!categorySlugs.has(s.category)) problems.push(`${s.slug}: category ${s.category}`);
      for (const i of s.industries) if (!industrySlugs.has(i)) problems.push(`${s.slug}: industry ${i}`);
      for (const i of s.integrations) if (!integrationSlugs.has(i)) problems.push(`${s.slug}: integration ${i}`);
      for (const r of s.related)
        if (!solutionSlugs.has(r) && !growthSlugs.has(r) && !packSlugs.has(r)) problems.push(`${s.slug}: related ${r}`);
    }
    for (const ind of seed.industries) {
      for (const s of ind.solutions) if (!solutionSlugs.has(s)) problems.push(`${ind.slug}: solution ${s}`);
      for (const i of ind.integrations) if (!integrationSlugs.has(i)) problems.push(`${ind.slug}: integration ${i}`);
      for (const p of ind.packs) if (!packSlugs.has(p)) problems.push(`${ind.slug}: pack ${p}`);
    }
    for (const p of seed.packs) {
      if (!industrySlugs.has(p.industry)) problems.push(`${p.slug}: industry ${p.industry}`);
      for (const s of p.includes) if (!solutionSlugs.has(s)) problems.push(`${p.slug}: includes ${s}`);
    }
    for (const t of seed.templates) {
      for (const i of t.integrations) if (!integrationSlugs.has(i)) problems.push(`template ${t.slug}: integration ${i}`);
      if (t.solution && !solutionSlugs.has(t.solution)) problems.push(`template ${t.slug}: solution ${t.solution}`);
    }
    for (const f of seed.frontierTopics)
      for (const r of f.related) {
        const [kind, slug] = r.split(":");
        if (kind === "s" ? !solutionSlugs.has(slug) : !growthSlugs.has(slug)) problems.push(`frontier ${f.slug}: ${r}`);
      }
    for (const r of seed.resources) for (const s of r.related) if (!solutionSlugs.has(s)) problems.push(`resource ${r.slug}: ${s}`);
    for (const e of seed.examples) if (!solutionSlugs.has(e.solution)) problems.push(`example ${e.slug}: ${e.solution}`);
    expect(problems).toEqual([]);
  });

  it("has 21 industries, 11 packs, 10 frontier topics and 29 categories (28 + digital transformation)", () => {
    expect(seed.industries.length).toBe(21);
    expect(seed.packs.length).toBe(11);
    expect(seed.frontierTopics.length).toBe(10);
    expect(seed.categories.length).toBe(29);
  });

  it("every solution meets the completeness gate", () => {
    const incomplete = seed.solutions.filter((s) => !completeness(s).complete).map((s) => `${s.slug}: ${completeness(s).missing.join(",")}`);
    expect(incomplete).toEqual([]);
  });

  it("contains no fabricated certification or partnership claims", () => {
    const text = JSON.stringify(seed).toLowerCase();
    for (const banned of ["soc 2", "iso 27001", "certified partner", "trusted by", "official partner"]) {
      expect(text.includes(banned), banned).toBe(false);
    }
  });
});
