import type { Flow, FlowKind, OpportunityProfile, Solution } from "../types";

const KIND: Record<string, FlowKind> = {
  i: "input",
  m: "manual",
  w: "wait",
  a: "ai",
  r: "rule",
  p: "approval",
  x: "action",
  o: "outcome",
  k: "risk",
};

/**
 * Compact flow notation used in seed files: "a:Extract fields|confidence per field".
 * Prefix = step kind, text after "|" = note.
 */
export function flow(steps: string[]): Flow {
  return steps.map((s) => {
    const [prefix, rest] = s.includes(":") ? [s.slice(0, s.indexOf(":")), s.slice(s.indexOf(":") + 1)] : ["m", s];
    const [label, note] = rest.split("|");
    return { kind: KIND[prefix] ?? "manual", label: label.trim(), ...(note ? { note: note.trim() } : {}) };
  });
}

export type SolutionInput = Omit<Solution, "manualFlow" | "automatedFlow" | "profile"> & {
  manual: string[];
  automated: string[];
  profile?: Partial<OpportunityProfile>;
};

/** Default intrinsic profile derived from complexity and risk; seed records override where known. */
function defaultProfile(s: SolutionInput): OpportunityProfile {
  const effort = s.complexity === "low" ? 1.5 : s.complexity === "medium" ? 3 : 4.5;
  const risk = s.riskClass === "standard" ? 1 : s.riskClass === "elevated" ? 3 : 4.5;
  const fit = s.gapRank ? Math.max(3, 5.2 - s.gapRank * 0.2) : s.status === "custom" ? 2.5 : 3;
  return {
    financialImpact: 3,
    dataReadiness: 3,
    integrationFeasibility: 3,
    regulatoryRisk: risk,
    implementationEffort: effort,
    reusability: s.status === "custom" ? 1.5 : 3.5,
    strategicFit: Number(fit.toFixed(1)),
  };
}

export function solution(input: SolutionInput): Solution {
  const { manual, automated, profile, ...rest } = input;
  return {
    ...rest,
    manualFlow: flow(manual),
    automatedFlow: flow(automated),
    profile: { ...defaultProfile(input), ...profile },
  };
}
