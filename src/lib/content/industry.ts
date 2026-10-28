import type { Industry } from "@/content/types";
import type { Catalogue } from ".";

/** Industry solutions in their editorial order, followed by any other solutions tagged with the industry. */
export function rankBySeedFit(cat: Catalogue, ind: Industry) {
  const listed = ind.solutions.map((s) => cat.solutions.find((x) => x.slug === s)).filter(Boolean) as Catalogue["solutions"];
  const extra = cat.solutions.filter((s) => s.industries.includes(ind.slug) && !ind.solutions.includes(s.slug)).sort((a, b) => b.profile.strategicFit - a.profile.strategicFit);
  return [...listed, ...extra].slice(0, 10);
}
