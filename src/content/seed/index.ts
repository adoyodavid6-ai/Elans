import { categories, categoryGroups, divisions, growTiers, integrations, packages, pricePoints } from "./base";
import { moneySolutions } from "./solutions-money";
import { customerSolutions } from "./solutions-customers";
import { operationsSolutions } from "./solutions-operations";
import { peopleSolutions } from "./solutions-people";
import { sectorSolutions } from "./solutions-sector";
import { platformSolutions } from "./solutions-platform";
import { industries } from "./industries";
import { packs, growthServices, frontierTopics } from "./growth";
import { templates, resources, examples } from "./library";
import { defaultSettings } from "./settings";

export const seed = {
  divisions,
  categoryGroups,
  categories,
  integrations,
  pricePoints,
  packages,
  growTiers,
  solutions: [
    ...moneySolutions,
    ...customerSolutions,
    ...operationsSolutions,
    ...peopleSolutions,
    ...sectorSolutions,
    ...platformSolutions,
  ],
  industries,
  packs,
  growthServices,
  frontierTopics,
  templates,
  resources,
  examples,
  settings: defaultSettings,
};

export type Seed = typeof seed;
