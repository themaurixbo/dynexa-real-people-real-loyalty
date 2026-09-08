import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { keccak256, toHex } from "viem";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { businessAccount, registerGiftCampaign } from "../lib/chain.js";
import { env } from "../lib/env.js";
import { findOrCreateUser, mintGiftAndRecord } from "../agent/reward-agent.js";

const { campaigns, businesses, claims, giftTokenIssuances, wallets } = schema;

const WELCOME_NAME = "DYNEXA Welcome";

export async function giftRoutes(app: FastifyInstance) {
  // Gifts held by a wallet.
  app.get("/gifts", async (req) => {
    const { address } = z.object({ address: z.string() }).parse(req.query);
    const rows = await db
      .select({
        id: giftTokenIssuances.id,
        tokenId: giftTokenIssuances.tokenId,
        code: giftTokenIssuances.redemptionCode,
        status: giftTokenIssuances.status,
        campaignId: giftTokenIssuances.campaignId,
      })
      .from(giftTokenIssuances)
      .where(eq(giftTokenIssuances.toAddress, address))
      .orderBy(desc(giftTokenIssuances.createdAt));

    const withNames = await Promise.all(
      rows.map(async (r) => {
        const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, r.campaignId) });
        return { ...r, campaignName: c?.name ?? "Gift" };
      }),
    );
    return withNames;
  });

  // Grant the one-time welcome gift on first sign-in.
  app.post("/welcome", async (req, reply) => {
    if (!env.giftTokenAddress) return reply.code(500).send({ error: "GIFT_TOKEN_ADDRESS not set" });
    const { contact, address } = z
      .object({ contact: z.string().min(3), address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) })
      .parse(req.body);

    const user = await findOrCreateUser(contact, address as `0x${string}`);
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.ownerId, user.id), eq(wallets.ownerType, "user")));

    const campaign = await ensureWelcomeCampaign();

    const existing = await db.query.claims.findFirst({
      where: and(eq(claims.campaignId, campaign.id), eq(claims.userId, user.id)),
    });
    if (existing) return { alreadyGranted: true };

    const [claim] = await db
      .insert(claims)
      .values({ campaignId: campaign.id, userId: user.id, status: "pending" })
      .returning();

    const minted = await mintGiftAndRecord(claim.id, campaign, user, {
      nullifierHash: keccak256(toHex(`welcome:${user.id}`)),
      receiptHash: keccak256(toHex(`welcome:${user.id}`)),
    });
    return { granted: true, tokenId: minted.tokenId, code: minted.code, txHash: minted.txHash };
  });
}

async function ensureWelcomeCampaign() {
  const existing = await db.query.campaigns.findFirst({ where: eq(campaigns.name, WELCOME_NAME) });
  if (existing?.giftTokenId) return existing;

  let business = await db.query.businesses.findFirst({ where: eq(businesses.slug, "dynexa") });
  if (!business) {
    [business] = await db.insert(businesses).values({ name: "DYNEXA", slug: "dynexa" }).returning();
  }

  const r = await registerGiftCampaign({
    giftToken: env.giftTokenAddress!,
    metadataUri: "DYNEXA Welcome — a free coffee to get started",
    expiry: 0n,
    transferable: true,
    redeemer: businessAccount.address,
  });

  const [campaign] = await db
    .insert(campaigns)
    .values({
      businessId: business.id,
      name: WELCOME_NAME,
      status: "active",
      rewardType: "selfie",
      rewardMode: "gift",
      totalBudgetUsdc: "0",
      rewardPerUserUsdc: "0",
      maxPerTxUsdc: "0",
      maxUsesPerHuman: 1,
      giftTokenId: Number(r.giftCampaignId),
      qualifyCondition: "Welcome gift on sign-up",
    })
    .returning();
  return campaign;
}
