import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../lib/env.js";

const run = promisify(execFile);

/**
 * The verifier agent. It looks at the proof (a receipt or product photo) and
 * says whether it is valid for the campaign. It never sees or returns an amount.
 *
 * If OPENAI_API_KEY is set and the proof is an image URL, it uses AI vision.
 * Otherwise it falls back to a simple rule so the flow still runs.
 *
 * The reward agent pays this agent a small USDC amount per check
 * (agent-to-agent, on Arc), when VERIFIER_WALLET_ADDRESS is set.
 */
export interface VerdictInput {
  evidenceUrl?: string;
  evidenceText?: string;
  qualifyCondition: string;
}

export interface Verdict {
  valid: boolean;
  reason: string;
  model: string;
  paymentTx?: string;
}

const FEE_USDC = "0.001";

export async function checkEvidence(input: VerdictInput): Promise<Verdict> {
  const verdict = env.openaiKey && input.evidenceUrl?.startsWith("http")
    ? await visionCheck(input)
    : ruleCheck(input);

  const paymentTx = await payVerifier();
  return { ...verdict, paymentTx };
}

function ruleCheck(input: VerdictInput): Omit<Verdict, "paymentTx"> {
  const text = (input.evidenceText ?? "").trim().toLowerCase();
  if (text === "reject" || text.includes("fake")) {
    return { valid: false, reason: "The proof does not match the campaign condition.", model: "rule-v0" };
  }
  if (!input.evidenceUrl && !input.evidenceText) {
    return { valid: false, reason: "No proof of purchase was provided.", model: "rule-v0" };
  }
  return {
    valid: true,
    reason: `Proof matches the condition: "${input.qualifyCondition}".`,
    model: "rule-v0",
  };
}

async function visionCheck(input: VerdictInput): Promise<Omit<Verdict, "paymentTx">> {
  const model = "gpt-4o-mini";
  const prompt =
    `You verify proof of purchase for a loyalty campaign. Condition: "${input.qualifyCondition}". ` +
    `Look at the image. Selfies may show text mirrored. Answer strictly as JSON: ` +
    `{"valid": boolean, "reason": string (one short sentence)}.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.openaiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: input.evidenceUrl } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    const parsed = JSON.parse(data.choices[0].message.content) as { valid: boolean; reason: string };
    return { valid: Boolean(parsed.valid), reason: String(parsed.reason ?? ""), model };
  } catch (e) {
    // safe fallback: do not auto-approve on an AI error
    return {
      valid: false,
      reason: "Could not verify the proof automatically. Please try again.",
      model: `${model}-error`,
    };
  }
}

async function payVerifier(): Promise<string | undefined> {
  if (env.agentSigner !== "circle" || !env.verifierWallet || !env.agentWallet) return undefined;
  try {
    const { stdout } = await run("circle", [
      "wallet",
      "transfer",
      env.verifierWallet,
      "--amount",
      FEE_USDC,
      "--token",
      env.arcUsdc,
      "--address",
      env.agentWallet,
      "--chain",
      env.circleChain,
      "--output",
      "json",
    ]);
    const res = JSON.parse(stdout);
    return res?.data?.txHash ?? res?.data?.transactionId ?? undefined;
  } catch {
    return undefined;
  }
}
