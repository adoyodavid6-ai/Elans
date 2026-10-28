import type { Solution } from "@/content/types";

/** The §5.2 required fields. A solution missing any of these renders `noindex` (D-015). */
export function completeness(s: Solution) {
  const checks: [string, boolean][] = [
    ["problem", s.problem.length > 40],
    ["affected", s.affected.length > 0],
    ["manualFlow", s.manualFlow.length >= 1],
    ["automatedFlow", s.automatedFlow.length >= 3],
    ["capabilities", s.capabilities.length > 0],
    ["dataRequired", s.dataRequired.length > 0],
    ["integrations", s.integrations.length > 0],
    ["benefits", s.benefits.length > 0],
    ["successIndicators", s.successIndicators.length > 0],
    ["approvalPoints", s.approvalPoints.length > 0],
    ["timeline", s.timeline.length > 0],
    ["pricing", s.pricing.approach.length > 0],
    ["faqs", s.faqs.length > 0],
  ];
  const missing = checks.filter(([, ok]) => !ok).map(([k]) => k);
  return { complete: missing.length === 0, missing, score: Math.round(((checks.length - missing.length) / checks.length) * 100) };
}
