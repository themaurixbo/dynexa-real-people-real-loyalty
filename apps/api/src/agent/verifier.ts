/**
 * The verifier agent. It looks at the proof (a receipt or product photo) and
 * says whether it is valid for the campaign. It never sees or returns an amount.
 *
 * Day 1: a stub so the flow runs end to end. Day 2: real AI vision, and the
 * reward agent pays this agent per check (Circle Nanopayments).
 */
export interface VerdictInput {
  evidenceUrl?: string;
  evidenceText?: string;
  qualifyCondition: string;
}

export interface Verdict {
  valid: boolean;
  reason: string;
}

export async function checkEvidence(input: VerdictInput): Promise<Verdict> {
  const text = (input.evidenceText ?? "").trim().toLowerCase();

  // lets us demo a rejection without real vision yet
  if (text === "reject" || text.includes("fake")) {
    return { valid: false, reason: "The proof does not match the campaign condition." };
  }
  if (!input.evidenceUrl && !input.evidenceText) {
    return { valid: false, reason: "No proof of purchase was provided." };
  }
  return {
    valid: true,
    reason: `Proof matches the condition: "${input.qualifyCondition}".`,
  };
}
