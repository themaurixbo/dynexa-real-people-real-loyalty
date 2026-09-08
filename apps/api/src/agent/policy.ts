/**
 * Deterministic policy gate. Plain code, no AI. Every hard rule lives here and
 * the contract enforces the money limits again on its own.
 */

export interface PolicyInput {
  campaignActive: boolean;
  withinDates: boolean;
  evidenceValid: boolean;
  humanVerified: boolean;
  receiptAlreadyUsed: boolean;
  priorClaimsByHuman: number;
  maxUsesPerHuman: number;
  amount: bigint;
  maxPerTx: bigint;
  treasuryBalance: bigint;
  requiresApprovalAbove: bigint | null;
}

export type PolicyDecision =
  | { outcome: "pass"; checks: Check[] }
  | { outcome: "reject"; reason: string; checks: Check[] }
  | { outcome: "needs_approval"; checks: Check[] };

export interface Check {
  code: string;
  ok: boolean;
}

export function evaluatePolicy(i: PolicyInput): PolicyDecision {
  const checks: Check[] = [
    { code: "CAMPAIGN_ACTIVE", ok: i.campaignActive },
    { code: "WITHIN_DATES", ok: i.withinDates },
    { code: "HUMAN_VERIFIED", ok: i.humanVerified },
    { code: "EVIDENCE_VALID", ok: i.evidenceValid },
    { code: "RECEIPT_NOT_REUSED", ok: !i.receiptAlreadyUsed },
    { code: "UNDER_PER_HUMAN_LIMIT", ok: i.priorClaimsByHuman < i.maxUsesPerHuman },
    { code: "UNDER_PER_TX_LIMIT", ok: i.amount <= i.maxPerTx },
    { code: "TREASURY_FUNDED", ok: i.treasuryBalance >= i.amount },
  ];

  const failed = checks.find((c) => !c.ok);
  if (failed) return { outcome: "reject", reason: reasonFor(failed.code), checks };

  if (i.requiresApprovalAbove !== null && i.amount > i.requiresApprovalAbove) {
    return { outcome: "needs_approval", checks };
  }
  return { outcome: "pass", checks };
}

function reasonFor(code: string): string {
  switch (code) {
    case "CAMPAIGN_ACTIVE":
      return "The campaign is not active.";
    case "WITHIN_DATES":
      return "The campaign is outside its dates.";
    case "HUMAN_VERIFIED":
      return "You need to complete the World check first.";
    case "EVIDENCE_VALID":
      return "The proof of purchase is not valid for this campaign.";
    case "RECEIPT_NOT_REUSED":
      return "This receipt was already used.";
    case "UNDER_PER_HUMAN_LIMIT":
      return "You have already claimed this campaign the maximum number of times.";
    case "UNDER_PER_TX_LIMIT":
      return "The reward is above the per-transaction limit.";
    case "TREASURY_FUNDED":
      return "The campaign does not have enough funds right now.";
    default:
      return "The claim did not pass the campaign rules.";
  }
}
