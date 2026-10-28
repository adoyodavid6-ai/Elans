import "server-only";
import { seed } from "@/content/seed";
import type { SiteSettings } from "@/content/seed/settings";
import type {
  Category, Division, FrontierTopic, GrowthService, GrowTier, IllustrativeExample, Industry, IndustryPack,
  Integration, Package, PricePoint, Resource, Solution, Template,
} from "@/content/types";
import { dbConfigured, withDb } from "@/lib/db";
import { DEFAULT_WEIGHTS, type Weights } from "@/lib/core/scoring";

/**
 * The content repository. Postgres (content_items, price_points, site_settings,
 * score_weight_versions) is the source of truth once seeded; the typed seed is the
 * fallback so the public site still renders if the database is unreachable.
 */
export interface Catalogue {
  source: "database" | "seed";
  divisions: Division[];
  categoryGroups: typeof seed.categoryGroups;
  categories: Category[];
  solutions: Solution[];
  industries: Industry[];
  packs: IndustryPack[];
  growthServices: GrowthService[];
  frontierTopics: FrontierTopic[];
  templates: Template[];
  integrations: Integration[];
  resources: Resource[];
  examples: IllustrativeExample[];
  packages: Package[];
  growTiers: GrowTier[];
  pricePoints: PricePoint[];
  settings: SiteSettings;
  weights: { id: number | null; weights: Weights };
}

export const CONTENT_TYPES = {
  solution: "solutions",
  category: "categories",
  industry: "industries",
  pack: "packs",
  growth: "growthServices",
  frontier: "frontierTopics",
  template: "templates",
  integration: "integrations",
  resource: "resources",
  example: "examples",
  package: "packages",
  grow_tier: "growTiers",
  division: "divisions",
} as const;
export type ContentTypeKey = keyof typeof CONTENT_TYPES;

type CacheEntry = { at: number; publicData: Catalogue; allData: Catalogue };
declare global {
  // eslint-disable-next-line no-var
  var __elansContent: CacheEntry | undefined;
}
const TTL_MS = 30_000;

function fromSeed(): Catalogue {
  return {
    source: "seed",
    divisions: seed.divisions,
    categoryGroups: seed.categoryGroups,
    categories: seed.categories,
    solutions: seed.solutions,
    industries: seed.industries,
    packs: seed.packs,
    growthServices: seed.growthServices,
    frontierTopics: seed.frontierTopics,
    templates: seed.templates,
    integrations: seed.integrations,
    resources: seed.resources,
    examples: seed.examples,
    packages: seed.packages,
    growTiers: seed.growTiers,
    pricePoints: seed.pricePoints,
    settings: seed.settings,
    weights: { id: null, weights: DEFAULT_WEIGHTS },
  };
}

async function fromDatabase(): Promise<{ publicData: Catalogue; allData: Catalogue } | null> {
  const result = await withDb({}, async (tx) => {
    const items = await tx<{ type: string; slug: string; data: unknown; publish_state: string }[]>`
      select type, slug, data, publish_state from content_items`;
    const prices = await tx<{ key: string; label: string; amount: number | null; currency: string; token: string; confirmed: boolean }[]>`
      select key, label, amount, currency, token, confirmed from price_points`;
    const settings = await tx<{ data: SiteSettings }[]>`select data from site_settings where key = 'site'`;
    const weights = await tx<{ id: number; weights: Weights }[]>`
      select id, weights from score_weight_versions where active order by id desc limit 1`;
    return { items, prices, settings, weights };
  });
  if (!result.items.length) return null;

  const build = (includeDrafts: boolean): Catalogue => {
    const base = fromSeed();
    const out: Catalogue = { ...base, source: "database" };
    for (const [type, field] of Object.entries(CONTENT_TYPES)) {
      const seedList = (base as unknown as Record<string, { slug?: string; key?: string }[]>)[field];
      const rows = result.items.filter((r) => r.type === type && (includeDrafts || r.publish_state === "published"));
      const bySlug = new Map(rows.map((r) => [r.slug, r.data]));
      const seedOrder = seedList.map((x) => x.slug ?? x.key ?? "");
      const ordered = [
        ...seedOrder.filter((s) => bySlug.has(s)).map((s) => bySlug.get(s)),
        ...rows.filter((r) => !seedOrder.includes(r.slug)).map((r) => r.data),
      ];
      (out as unknown as Record<string, unknown>)[field] = ordered;
    }
    if (result.prices.length) out.pricePoints = result.prices.map((p) => ({ ...p, amount: p.amount === null ? null : Number(p.amount) }));
    if (result.settings[0]) out.settings = { ...base.settings, ...result.settings[0].data };
    if (result.weights[0]) out.weights = { id: result.weights[0].id, weights: { ...DEFAULT_WEIGHTS, ...result.weights[0].weights } };
    return out;
  };
  return { publicData: build(false), allData: build(true) };
}

async function load(): Promise<CacheEntry> {
  const now = Date.now();
  const c = globalThis.__elansContent;
  if (c && now - c.at < TTL_MS) return c;
  let entry: CacheEntry;
  try {
    const db = dbConfigured() ? await fromDatabase() : null;
    entry = db ? { at: now, ...db } : { at: now, publicData: fromSeed(), allData: fromSeed() };
  } catch (e) {
    console.error("[content] falling back to seed:", (e as Error).message);
    entry = { at: now - TTL_MS + 5000, publicData: fromSeed(), allData: fromSeed() };
  }
  globalThis.__elansContent = entry;
  return entry;
}

export async function getCatalogue(opts: { includeDrafts?: boolean } = {}): Promise<Catalogue> {
  const e = await load();
  return opts.includeDrafts ? e.allData : e.publicData;
}

export function invalidateContent() {
  globalThis.__elansContent = undefined;
}

// ───────────── convenience lookups ─────────────
export async function getSolution(slug: string) {
  return (await getCatalogue()).solutions.find((s) => s.slug === slug);
}
export function price(cat: Catalogue, key: string) {
  return cat.pricePoints.find((p) => p.key === key);
}
export function packageFor(cat: Catalogue, key: string) {
  return cat.packages.find((p) => p.key === key);
}
