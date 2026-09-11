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
  businessId: string;
  name: string;
  category: "shopping" | "food" | "events";
  rewardMode: "usdc" | "gift";
  rewardType: "receipt" | "selfie" | "referral";
  status: string;
  treasuryAddress: string | null;
  rewardPerUserUsdc: string;
  totalBudgetUsdc: string;
  maxPerTxUsdc: string;
  maxUsesPerHuman: number;
  maxParticipants: number | null;
  requiresApprovalAboveUsdc: string | null;
  qualifyCondition: string | null;
  startsAt: string | null;
  endsAt: string | null;
  referenceImages: string[];
  giftTransferable: boolean;
  onchainBalance?: string;
}

export interface Claim {
  id: string;
  campaignId: string;
  userId: string;
  status: "pending" | "approved" | "rejected" | "paid" | "failed";
  rejectionReason: string | null;
  cashAmountUsdc: string | null;
  createdAt: string;
  decidedAt: string | null;
  txHash?: string;
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

export interface TransferInfo {
  code: string;
  amountUsdc: string;
  note?: string | null;
  status: "pending" | "claimed" | "canceled";
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  walletAddress: string | null;
}

export const api = {
  health: () => req<{ ok: boolean; agent: string; escrow: string; giftToken: string | null }>("/health"),
  campaigns: () => req<Campaign[]>("/campaigns"),
  businesses: () => req<Business[]>("/businesses"),
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
  editCampaign: (id: string, body: Record<string, unknown>) =>
    req<Campaign>(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  referralLink: (campaignId: string, contact: string, address: string) =>
    req<{ code: string }>(`/campaigns/${campaignId}/referral-link`, {
      method: "POST",
      body: JSON.stringify({ contact, address }),
    }),
  referralLinkInfo: (code: string) =>
    req<{ code: string; campaignId: string; campaignName: string }>(`/referral-links/${code}`),
  claim: (body: Record<string, unknown>) =>
    req<ClaimResult>("/claims", { method: "POST", body: JSON.stringify(body) }),
  claims: (params?: { campaignId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.campaignId) q.set("campaignId", params.campaignId);
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return req<Claim[]>(`/claims${qs ? `?${qs}` : ""}`);
  },
  approveClaim: (id: string) => req<{ status: string; txHash: string }>(`/claims/${id}/approve`, { method: "POST" }),
  rejectClaim: (id: string, reason?: string) =>
    req<{ status: string; reason: string }>(`/claims/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  killSwitch: () => req<{ paused: boolean }>("/admin/kill-switch"),
  setKillSwitch: (paused: boolean) =>
    req<{ paused: boolean }>("/admin/kill-switch", { method: "POST", body: JSON.stringify({ paused }) }),
  redeem: (code: string) =>
    req<{ status: string; reason?: string; txHash?: string }>("/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  gifts: (address: string) =>
    req<
      {
        id: string;
        tokenId: number;
        code: string;
        status: string;
        campaignId: string;
        campaignName: string;
        transferable: boolean;
      }[]
    >(`/gifts?address=${address}`),
  welcome: (contact: string, address: string) =>
    req<{
      granted?: boolean;
      alreadyGranted?: boolean;
      needsVerification?: boolean;
      tokenId?: number;
      code?: string;
      txHash?: string;
    }>("/welcome", { method: "POST", body: JSON.stringify({ contact, address }) }),
  worldSession: () =>
    req<{
      appId: string;
      action: string;
      environment: string;
      rpContext: {
        rp_id: string;
        nonce: string;
        created_at: number;
        expires_at: number;
        signature: string;
      };
    }>("/world/session"),
  worldStatus: (address: string) =>
    req<{ verified: boolean }>(`/world/status?address=${address}`),
  worldVerify: (contact: string, address: string, proof: unknown) =>
    req<{ verified: boolean; error?: string }>("/world/verify", {
      method: "POST",
      body: JSON.stringify({ contact, address, proof }),
    }),
  createTransfer: (body: {
    fromAddress: string;
    fromContact?: string;
    amountUsdc: string;
    fromTxHash: string;
    note?: string;
  }) =>
    req<{ code: string; amountUsdc: string }>("/transfers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getTransfer: (code: string) => req<TransferInfo>(`/transfers/${code}`),
  claimTransfer: (code: string, address: string, contact?: string) =>
    req<{ status: string; amountUsdc: string; txHash: string }>(`/transfers/${code}/claim`, {
      method: "POST",
      body: JSON.stringify({ address, contact }),
    }),
  createGiftTransfer: (body: {
    issuanceId: string;
    fromAddress: string;
    fromContact?: string;
    fromTxHash: string;
    toContact?: string;
    note?: string;
  }) =>
    req<{ code: string; autoDelivered?: { toAddress: string; txHash: string } }>("/gift-transfers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getGiftTransfer: (code: string) =>
    req<{ code: string; note?: string; status: string; campaignName: string }>(`/gift-transfers/${code}`),
  claimGiftTransfer: (code: string, address: string, contact?: string) =>
    req<{ status: string; txHash: string }>(`/gift-transfers/${code}/claim`, {
      method: "POST",
      body: JSON.stringify({ address, contact }),
    }),
};

export const explorerTx = (hash: string) => `https://testnet.arcscan.app/tx/${hash}`;
