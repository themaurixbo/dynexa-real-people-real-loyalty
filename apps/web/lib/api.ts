const BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined" && window.location.hostname === "realloyalty.dynexa.us"
    ? "https://apirealloyalty.dynexa.us"
    : "http://localhost:4000");

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `${res.status}`);
  return body as T;
}

export interface Campaign {
  id: string;
  name: string;
  rewardMode: "usdc" | "gift";
  rewardType: string;
  status: string;
  treasuryAddress: string | null;
  rewardPerUserUsdc: string;
  totalBudgetUsdc: string;
  maxPerTxUsdc: string;
  maxUsesPerHuman: number;
  qualifyCondition: string | null;
  onchainBalance?: string;
}

export interface ClaimResult {
  claimId: string;
  status: "paid" | "rejected" | "needs_approval";
  reason: string;
  reasonCodes: string[];
  amountUsdc?: string;
  giftTokenId?: number | null;
  txHash?: string;
}

export const api = {
  health: () => req<{ ok: boolean; agent: string }>("/health"),
  campaigns: () => req<Campaign[]>("/campaigns"),
  createCampaign: (body: Record<string, unknown>) =>
    req<{ campaign: Campaign; treasury: string; txHash: string }>("/campaigns", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  fund: (id: string, amountUsdc: string) =>
    req<{ txHash: string; balance: string }>(`/campaigns/${id}/fund`, {
      method: "POST",
      body: JSON.stringify({ amountUsdc }),
    }),
  pause: (id: string, paused: boolean) =>
    req<{ txHash: string }>(`/campaigns/${id}/pause`, {
      method: "POST",
      body: JSON.stringify({ paused }),
    }),
  close: (id: string) => req<{ txHash: string }>(`/campaigns/${id}/close`, { method: "POST" }),
  claim: (body: Record<string, unknown>) =>
    req<ClaimResult>("/claims", { method: "POST", body: JSON.stringify(body) }),
  claims: (campaignId?: string) =>
    req<Record<string, unknown>[]>(`/claims${campaignId ? `?campaignId=${campaignId}` : ""}`),
  redeem: (code: string) =>
    req<{ status: string; reason?: string; txHash?: string }>("/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
};

export const explorerTx = (hash: string) => `https://testnet.arcscan.app/tx/${hash}`;
