import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import {
  businessAccount,
  closeTreasury,
  createCampaignOnChain,
  fromUsdc,
  fundTreasury,
  registerGiftCampaign,
  setTreasuryPaused,
  treasuryBalance,
  usdc,
} from "../lib/chain.js";
import { env } from "../lib/env.js";
import { agentSigner } from "../agent/signer.js";
import { findOrCreateUser } from "../agent/reward-agent.js";

const { businesses, campaigns, referralLinks } = schema;

const createBody = z.object({
  businessName: z.string().min(1).default("Vacafría"),
  name: z.string().min(1),
  category: z.enum(["shopping", "food", "events"]).default("shopping"),
  rewardType: z.enum(["receipt", "selfie", "referral"]).default("receipt"),
  rewardMode: z.enum(["usdc", "gift"]).default("usdc"),
  rewardPerUserUsdc: z.string(),
  totalBudgetUsdc: z.string(),
  maxPerTxUsdc: z.string(),
  maxUsesPerHuman: z.number().int().positive().default(1),
  maxParticipants: z.number().int().positive().optional(),
  requiresApprovalAboveUsdc: z.string().optional(),
  qualifyCondition: z.string().default(""),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  referenceImages: z.array(z.string()).max(4).default([]),
  // gift-mode only
  giftName: z.string().default("Free gift"),
  giftMetadataUri: z.string().default(""),
  giftTransferable: z.boolean().default(false),
});

const editBody = z.object({
  qualifyCondition: z.string().optional(),
  maxUsesPerHuman: z.number().int().positive().optional(),
  maxParticipants: z.number().int().positive().nullable().optional(),
  requiresApprovalAboveUsdc: z.string().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  category: z.enum(["shopping", "food", "events"]).optional(),
  referenceImages: z.array(z.string()).max(4).optional(),
});

export async function campaignRoutes(app: FastifyInstance) {
  app.post("/campaigns", async (req, reply) => {
    const body = createBody.parse(req.body);
    if (!env.factoryAddress) return reply.code(500).send({ error: "FACTORY_ADDRESS not set" });

    const business = await upsertBusiness(body.businessName);

    // Always deploy a treasury (holds USDC for usdc campaigns; unused for gift).
    const { treasury, txHash } = await createCampaignOnChain({
      factory: env.factoryAddress,
      agent: agentSigner.address,
      perTxLimit: usdc(body.maxPerTxUsdc),
      campaignTotalLimit: usdc(body.totalBudgetUsdc),
    });

    let giftCampaignId: number | null = null;
    let giftTxHash: string | undefined;
    if (body.rewardMode === "gift") {
      if (!env.giftTokenAddress) return reply.code(500).send({ error: "GIFT_TOKEN_ADDRESS not set" });
      const expiry = body.endsAt ? BigInt(Math.floor(new Date(body.endsAt).getTime() / 1000)) : 0n;
      const r = await registerGiftCampaign({
        giftToken: env.giftTokenAddress,
        metadataUri: body.giftMetadataUri || body.giftName,
        expiry,
        transferable: body.giftTransferable,
        redeemer: businessAccount.address,
      });
      giftCampaignId = Number(r.giftCampaignId);
      giftTxHash = r.txHash;
    }

    const [campaign] = await db
      .insert(campaigns)
      .values({
        businessId: business.id,
        name: body.name,
        status: "active",
        category: body.category,
        rewardType: body.rewardType,
        rewardMode: body.rewardMode,
        treasuryAddress: treasury,
        agentSignerAddress: agentSigner.address,
        totalBudgetUsdc: body.totalBudgetUsdc,
        rewardPerUserUsdc: body.rewardPerUserUsdc,
        maxPerTxUsdc: body.maxPerTxUsdc,
        maxUsesPerHuman: body.maxUsesPerHuman,
        maxParticipants: body.maxParticipants ?? null,
        giftTokenId: giftCampaignId,
        requiresApprovalAboveUsdc: body.requiresApprovalAboveUsdc ?? null,
        qualifyCondition: body.qualifyCondition,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        referenceImages: body.referenceImages,
        giftTransferable: body.giftTransferable,
      })
      .returning();

    return { campaign, treasury, txHash, giftCampaignId, giftTxHash };
  });

  app.get("/campaigns", async () => {
    const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
    return Promise.all(rows.map(withBalance));
  });

  // Multi-tenancy: which businesses exist, so the dashboard can scope to one.
  app.get("/businesses", async () => {
    return db.select().from(businesses).orderBy(desc(businesses.createdAt));
  });

  app.get("/campaigns/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
    if (!row) return reply.code(404).send({ error: "not found" });
    return withBalance(row);
  });

  app.post("/campaigns/:id/fund", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { amountUsdc } = z.object({ amountUsdc: z.string() }).parse(req.body);
    const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
    if (!c?.treasuryAddress) return reply.code(404).send({ error: "not found" });
    const txHash = await fundTreasury(c.treasuryAddress as `0x${string}`, usdc(amountUsdc));
    return { txHash, balance: fromUsdc(await treasuryBalance(c.treasuryAddress as `0x${string}`)) };
  });

  app.post("/campaigns/:id/pause", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { paused } = z.object({ paused: z.boolean() }).parse(req.body);
    const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
    if (!c?.treasuryAddress) return reply.code(404).send({ error: "not found" });
    const txHash = await setTreasuryPaused(c.treasuryAddress as `0x${string}`, paused);
    await db
      .update(campaigns)
      .set({ status: paused ? "paused" : "active" })
      .where(eq(campaigns.id, id));
    return { txHash };
  });

  app.post("/campaigns/:id/close", async (req, reply) => {
    const { id } = req.params as { id: string };
    const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
    if (!c?.treasuryAddress) return reply.code(404).send({ error: "not found" });
    const txHash = await closeTreasury(c.treasuryAddress as `0x${string}`);
    await db.update(campaigns).set({ status: "closed" }).where(eq(campaigns.id, id));
    return { txHash };
  });

  // Edit the off-chain rules of a campaign. The on-chain per-tx/total limits are
  // fixed at deploy time by the contract — those aren't editable here.
  app.patch("/campaigns/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = editBody.parse(req.body);
    const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
    if (!c) return reply.code(404).send({ error: "not found" });

    await db
      .update(campaigns)
      .set({
        ...(body.qualifyCondition !== undefined && { qualifyCondition: body.qualifyCondition }),
        ...(body.maxUsesPerHuman !== undefined && { maxUsesPerHuman: body.maxUsesPerHuman }),
        ...(body.maxParticipants !== undefined && { maxParticipants: body.maxParticipants }),
        ...(body.requiresApprovalAboveUsdc !== undefined && {
          requiresApprovalAboveUsdc: body.requiresApprovalAboveUsdc,
        }),
        ...(body.startsAt !== undefined && { startsAt: body.startsAt ? new Date(body.startsAt) : null }),
        ...(body.endsAt !== undefined && { endsAt: body.endsAt ? new Date(body.endsAt) : null }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.referenceImages !== undefined && { referenceImages: body.referenceImages }),
      })
      .where(eq(campaigns.id, id));

    const updated = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
    return withBalance(updated!);
  });

  // A customer's shareable referral link for one campaign — same one every time they ask.
  app.post("/campaigns/:id/referral-link", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { contact, address } = z
      .object({ contact: z.string().min(3), address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) })
      .parse(req.body);
    const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
    if (!campaign) return reply.code(404).send({ error: "not found" });

    const user = await findOrCreateUser(contact, address as `0x${string}`);
    const existing = await db.query.referralLinks.findFirst({
      where: and(eq(referralLinks.campaignId, id), eq(referralLinks.referrerUserId, user.id)),
    });
    if (existing) return { code: existing.code };

    const code = randomBytes(4).toString("hex").toUpperCase();
    await db.insert(referralLinks).values({ campaignId: id, referrerUserId: user.id, code });
    return { code };
  });

  // Lets a new visitor's ?ref=CODE link show which campaign they were invited to.
  app.get("/referral-links/:code", async (req, reply) => {
    const { code } = req.params as { code: string };
    const link = await db.query.referralLinks.findFirst({
      where: eq(referralLinks.code, code.toUpperCase()),
    });
    if (!link) return reply.code(404).send({ error: "not found" });
    const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, link.campaignId) });
    if (!campaign) return reply.code(404).send({ error: "not found" });
    return { code: link.code, campaignId: campaign.id, campaignName: campaign.name };
  });
}

async function upsertBusiness(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const existing = await db.query.businesses.findFirst({ where: eq(businesses.slug, slug) });
  if (existing) return existing;
  const [b] = await db.insert(businesses).values({ name, slug }).returning();
  return b;
}

async function withBalance(c: typeof schema.campaigns.$inferSelect) {
  const onchainBalance = c.treasuryAddress
    ? fromUsdc(await treasuryBalance(c.treasuryAddress as `0x${string}`))
    : "0";
  return { ...c, onchainBalance };
}
