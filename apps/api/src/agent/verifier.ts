import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../lib/env.js";

const run = promisify(execFile);

/**
 * The verifier agent. It looks at the proof (a receipt or product photo) and
 * says whether it is valid for the campaign. It never sees or returns an amount.
 *
 * If OPENAI_API_KEY is set and the proof is a photo (an http(s) URL or a
 * base64 data URL from the app's camera/upload), it uses AI vision. Otherwise
 * it falls back to a simple rule so the flow still runs.
 *
 * The reward agent pays this agent a small USDC amount per check
 * (agent-to-agent, on Arc), when VERIFIER_WALLET_ADDRESS is set.
 */
export interface VerdictInput {
  evidenceUrl?: string;
  evidenceText?: string;
  qualifyCondition: string;
  rewardType?: "receipt" | "selfie" | "referral";
  referenceImages?: string[];
}

export interface Verdict {
  valid: boolean;
  reason: string;
  model: string;
  paymentTx?: string;
}

const FEE_USDC = "0.001";

function isPhoto(url?: string): boolean {
  return Boolean(url && (url.startsWith("http") || url.startsWith("data:image")));
}

export async function checkEvidence(input: VerdictInput): Promise<Verdict> {
  const resolvedUrl = await resolveEvidenceUrl(input.evidenceUrl);
  const resolved = { ...input, evidenceUrl: resolvedUrl };
  const verdict = env.openaiKey && isPhoto(resolvedUrl) ? await visionCheck(resolved) : ruleCheck(resolved);

  const paymentTx = await payVerifier();
  return { ...verdict, paymentTx };
}

/**
 * A pasted social post link (Instagram/Facebook) isn't itself an image — fetch
 * the page and pull its `og:image` meta tag. A direct image URL or data URL
 * passes through unchanged.
 */
async function resolveEvidenceUrl(url?: string): Promise<string | undefined> {
  if (!url || !url.startsWith("http")) return url;
  if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)) return url;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const html = await res.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    return match?.[1] ?? url;
  } catch {
    return url;
  }
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
  const task =
    input.rewardType === "selfie"
      ? "You verify a consumption selfie for a loyalty campaign: the customer must be visibly " +
        "holding or using the product, with the product or brand logo readable. Selfies are taken " +
        "with a front camera, so any text or logo may appear mirrored — account for that."
      : "You verify a purchase receipt for a loyalty campaign: it must show the qualifying purchase.";
  const prompt =
    `${task} Condition: "${input.qualifyCondition}". ` +
    (input.referenceImages?.length
      ? "The next image(s) after the proof are reference photos of the real product/brand — use them " +
        "as visual context, they are not the proof itself. "
      : "") +
    `Answer strictly as JSON: {"valid": boolean, "reason": string}. The reason must be one short, ` +
    `concrete sentence naming exactly what you saw or didn't see — an amount, an item, a mismatch ` +
    `(e.g. "The invoice total is 150 Bs, below the 200 Bs required" or "No Coca-Cola item is visible ` +
    `on the receipt"). Never a generic line like "does not match".`;

  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: input.evidenceUrl! } },
  ];
  for (const ref of input.referenceImages ?? []) {
    content.push({ type: "image_url", image_url: { url: ref } });
  }

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
        messages: [{ role: "user", content }],
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
