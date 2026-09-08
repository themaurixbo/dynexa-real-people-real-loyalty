import { and, count, eq, inArray } from "drizzle-orm";
import { decodeEventLog, keccak256, toHex } from "viem";
import { db, schema } from "../db/client.js";
import { env } from "../lib/env.js";
import { fromUsdc, giftTokenAbi, publicClient, treasuryBalance, usdc } from "../lib/chain.js";
import { evaluatePolicy } from "./policy.js";
import { agentSigner } from "./signer.js";
import { checkEvidence } from "./verifier.js";

const {
  campaigns,
  users,
  wallets,
  worldVerifications,
  receipts,
  claims,
  aiDecisions,
  policyResults,
  payouts,
  giftTokenIssuances,
  blockchainTransactions,
  auditEvents,
} = schema;

export interface ClaimRequest {
  campaignId: string;
  contact: string;
  customerAddress?: `0x${string}`;
  evidenceUrl?: string;
  evidenceText?: string;
  receiptRef: string;
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

export async function runRewardClaim(reqBody: ClaimRequest): Promise<ClaimResult> {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, reqBody.campaignId),
  });
  if (!campaign) throw new Error("campaign not found");
  if (!campaign.treasuryAddress) throw new Error("campaign has no treasury");

  const user = await findOrCreateUser(reqBody.contact, reqBody.customerAddress);
  const nullifierHash = await ensureVerified(user.id);
  const receiptHash = keccak256(toHex(reqBody.receiptRef));

  // --- gather real signals ---
  const [dup] = await db.select().from(receipts).where(eq(receipts.receiptHash, receiptHash));
  const [{ value: priorClaims }] = await db
    .select({ value: count() })
    .from(claims)
    .where(
      and(
        eq(claims.campaignId, campaign.id),
        eq(claims.userId, user.id),
        inArray(claims.status, ["paid", "approved"]),
      ),
    );

  const verdict = await checkEvidence({
    evidenceUrl: reqBody.evidenceUrl,
    evidenceText: reqBody.evidenceText,
    qualifyCondition: campaign.qualifyCondition ?? "",
  });

  const amount = usdc(campaign.rewardPerUserUsdc ?? "0");
  const balance =
    campaign.rewardMode === "usdc"
      ? await treasuryBalance(campaign.treasuryAddress as `0x${string}`)
      : 0n;
  const now = new Date();

  const policy = evaluatePolicy({
    rewardMode: campaign.rewardMode,
    campaignActive: campaign.status === "active",
    withinDates:
      (!campaign.startsAt || campaign.startsAt <= now) &&
      (!campaign.endsAt || campaign.endsAt >= now),
    evidenceValid: verdict.valid,
    humanVerified: true,
    receiptAlreadyUsed: Boolean(dup),
    priorClaimsByHuman: priorClaims,
    maxUsesPerHuman: campaign.maxUsesPerHuman ?? 1,
    amount,
    maxPerTx: usdc(campaign.maxPerTxUsdc ?? "0"),
    treasuryBalance: balance,
    requiresApprovalAbove: campaign.requiresApprovalAboveUsdc
      ? usdc(campaign.requiresApprovalAboveUsdc)
      : null,
  });

  const reasonCodes = policy.checks.filter((c) => c.ok).map((c) => c.code);

  // --- record the claim + the agent's reasoning ---
  const [claim] = await db
    .insert(claims)
    .values({
      campaignId: campaign.id,
      userId: user.id,
      status: "pending",
      cashAmountUsdc: campaign.rewardPerUserUsdc,
    })
    .returning();

  if (!dup && (reqBody.evidenceUrl || reqBody.evidenceText)) {
    await db.insert(receipts).values({
      userId: user.id,
      campaignId: campaign.id,
      receiptHash,
      externalRef: reqBody.receiptRef,
      extracted: { url: reqBody.evidenceUrl, text: reqBody.evidenceText },
    });
  }

  await db.insert(aiDecisions).values({
    claimId: claim.id,
    model: verdict.model,
    promptVersion: "v1",
    provider: verdict.model.startsWith("gpt") ? "openai" : "rule",
    input: { qualifyCondition: campaign.qualifyCondition, receiptRef: reqBody.receiptRef },
    output: verdict,
    eligible: verdict.valid,
    reasonCodes,
    humanExplanation: verdict.reason,
  });
  if (verdict.paymentTx) {
    await audit("agent", "verifier.paid", "claim", claim.id, {
      to: "verifier-agent",
      txHash: verdict.paymentTx,
    });
  }
  await db.insert(policyResults).values({
    claimId: claim.id,
    passed: policy.outcome === "pass",
    checks: policy.checks,
    failureReason: policy.outcome === "reject" ? policy.reason : null,
  });

  if (policy.outcome === "reject") {
    await finish(claim.id, "rejected", policy.reason);
    await audit("agent", "claim.rejected", "claim", claim.id, { reason: policy.reason });
    return { claimId: claim.id, status: "rejected", reason: policy.reason, reasonCodes };
  }

  if (policy.outcome === "needs_approval") {
    await db.update(claims).set({ status: "pending" }).where(eq(claims.id, claim.id));
    await audit("agent", "claim.needs_approval", "claim", claim.id, {});
    return {
      claimId: claim.id,
      status: "needs_approval",
      reason: "The reward is above the amount the business approves automatically.",
      reasonCodes,
    };
  }

  // --- pass: the agent pays the reward ---
  if (campaign.rewardMode === "gift") {
    const minted = await mintGiftAndRecord(claim.id, campaign, user, { nullifierHash, receiptHash });
    return {
      claimId: claim.id,
      status: "paid",
      reason: verdict.reason,
      reasonCodes,
      giftTokenId: minted.tokenId,
      txHash: minted.txHash,
    };
  }

  const paid = await payAndRecord(claim.id, campaign, user, { nullifierHash, receiptHash });
  return {
    claimId: claim.id,
    status: "paid",
    reason: verdict.reason,
    reasonCodes,
    amountUsdc: fromUsdc(amount),
    txHash: paid.txHash,
  };
}

/** Used both by the agent (auto) and by a business approval. */
export async function payAndRecord(
  claimId: string,
  campaign: typeof schema.campaigns.$inferSelect,
  user: typeof schema.users.$inferSelect,
  refs: { nullifierHash: `0x${string}`; receiptHash: `0x${string}` },
) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.ownerId, user.id), eq(wallets.ownerType, "user")));
  if (!wallet) throw new Error("user has no wallet");

  const onchainClaimId = keccak256(toHex(claimId));
  const { txHash } = await agentSigner.payout(campaign.treasuryAddress as `0x${string}`, {
    claimId: onchainClaimId,
    customer: wallet.address as `0x${string}`,
    nullifierHash: refs.nullifierHash,
    receiptHash: refs.receiptHash,
    amount: usdc(campaign.rewardPerUserUsdc ?? "0"),
  });

  const [tx] = await db
    .insert(blockchainTransactions)
    .values({
      chainId: 5042002,
      hash: txHash,
      kind: "payout",
      status: "confirmed",
      toAddress: wallet.address,
      confirmedAt: new Date(),
    })
    .returning();

  await db.insert(payouts).values({
    claimId,
    campaignId: campaign.id,
    toAddress: wallet.address,
    amountUsdc: campaign.rewardPerUserUsdc ?? "0",
    txId: tx.id,
    status: "confirmed",
  });
  await db
    .update(claims)
    .set({ status: "paid", onchainClaimId, decidedAt: new Date() })
    .where(eq(claims.id, claimId));
  await audit("agent", "claim.paid", "claim", claimId, { txHash });

  return { txHash };
}

/** Gift campaigns: the agent mints a GiftToken instead of sending USDC. */
export async function mintGiftAndRecord(
  claimId: string,
  campaign: typeof schema.campaigns.$inferSelect,
  user: typeof schema.users.$inferSelect,
  refs: { nullifierHash: `0x${string}`; receiptHash: `0x${string}` },
) {
  if (!env.giftTokenAddress) throw new Error("GIFT_TOKEN_ADDRESS not set");
  if (!campaign.giftTokenId) throw new Error("campaign has no registered gift");

  const [wallet] = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.ownerId, user.id), eq(wallets.ownerType, "user")));
  if (!wallet) throw new Error("user has no wallet");

  const onchainClaimId = keccak256(toHex(claimId));
  const { txHash } = await agentSigner.mintGift(
    env.giftTokenAddress,
    wallet.address as `0x${string}`,
    BigInt(campaign.giftTokenId),
    onchainClaimId,
  );

  const tokenId = await tokenIdFromReceipt(txHash);

  const [tx] = await db
    .insert(blockchainTransactions)
    .values({
      chainId: 5042002,
      hash: txHash,
      kind: "mint",
      status: "confirmed",
      toAddress: wallet.address,
      confirmedAt: new Date(),
    })
    .returning();

  const code = `GIFT-${randomCode()}`;
  await db.insert(giftTokenIssuances).values({
    claimId,
    campaignId: campaign.id,
    tokenId: tokenId ?? 0,
    toAddress: wallet.address,
    redemptionCode: code,
    txId: tx.id,
    status: "minted",
  });
  await db
    .update(claims)
    .set({ status: "paid", onchainClaimId, giftTokenId: tokenId ?? null, decidedAt: new Date() })
    .where(eq(claims.id, claimId));
  await audit("agent", "claim.gift_minted", "claim", claimId, { txHash, tokenId, code });

  return { txHash, tokenId, code };
}

async function tokenIdFromReceipt(txHash: string): Promise<number | null> {
  if (!txHash.startsWith("0x")) return null;
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
    for (const log of receipt.logs) {
      try {
        const parsed = decodeEventLog({ abi: giftTokenAbi, data: log.data, topics: log.topics });
        if (parsed.eventName === "GiftMinted") return Number((parsed.args as { tokenId: bigint }).tokenId);
      } catch {
        // not our event
      }
    }
  } catch {
    // receipt not available (e.g. Circle returned a tx id)
  }
  return null;
}

function randomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export async function findOrCreateUser(contact: string, addr?: `0x${string}`) {
  const existing = await db.query.users.findFirst({
    where: eq(users.privyUserId, contact),
  });
  if (existing) return existing;

  const [user] = await db.insert(users).values({ privyUserId: contact, email: contact }).returning();

  // A wallet address belongs to one user. If the requested address is already
  // registered (happens in local testing), fall back to a fresh one.
  let address = addr ?? randomAddress();
  if (addr) {
    const [taken] = await db.select().from(wallets).where(eq(wallets.address, addr));
    if (taken) address = randomAddress();
  }
  await db.insert(wallets).values({
    ownerType: "user",
    ownerId: user.id,
    address,
    chainId: 5042002,
    provider: addr && address === addr ? "privy" : "generated",
  });
  return user;
}

/**
 * Day 1 stub: pretend the user did the World check. Day 3 this becomes a real
 * check against a stored World nullifier.
 */
async function ensureVerified(userId: string): Promise<`0x${string}`> {
  const existing = await db.query.worldVerifications.findFirst({
    where: eq(worldVerifications.userId, userId),
  });
  if (existing) return keccak256(toHex(existing.nullifierHash));

  const nullifier = `stub:${userId}`;
  await db.insert(worldVerifications).values({
    userId,
    action: "verify-human-welcome",
    nullifierHash: nullifier,
    credentialType: "stub",
  });
  return keccak256(toHex(nullifier));
}

async function finish(claimId: string, status: "rejected", reason: string) {
  await db
    .update(claims)
    .set({ status, rejectionReason: reason, decidedAt: new Date() })
    .where(eq(claims.id, claimId));
}

async function audit(
  actorType: string,
  action: string,
  subjectType: string,
  subjectId: string,
  data: unknown,
) {
  await db.insert(auditEvents).values({ actorType, action, subjectType, subjectId, data });
}

function randomAddress(): `0x${string}` {
  const hex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `0x${hex}`;
}
