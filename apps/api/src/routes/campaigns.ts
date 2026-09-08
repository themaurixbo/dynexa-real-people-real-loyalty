import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import {
  closeTreasury,
  createCampaignOnChain,
  fromUsdc,
  fundTreasury,
  setTreasuryPaused,
  treasuryBalance,
  usdc,
} from "../lib/chain.js";
import { env } from "../lib/env.js";
import { agentSigner } from "../agent/signer.js";

const { businesses, campaigns } = schema;

const createBody = z.object({
  businessName: z.string().min(1).default("Vacafría"),
  name: z.string().min(1),
  rewardType: z.enum(["receipt", "selfie", "referral"]).default("receipt"),
  rewardMode: z.enum(["usdc", "gift"]).default("usdc"),
  rewardPerUserUsdc: z.string(),
  totalBudgetUsdc: z.string(),
  maxPerTxUsdc: z.string(),
  maxUsesPerHuman: z.number().int().positive().default(1),
  requiresApprovalAboveUsdc: z.string().optional(),
  qualifyCondition: z.string().default(""),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export async function campaignRoutes(app: FastifyInstance) {
  app.post("/campaigns", async (req, reply) => {
    const body = createBody.parse(req.body);
    if (!env.factoryAddress) return reply.code(500).send({ error: "FACTORY_ADDRESS not set" });

    const business = await upsertBusiness(body.businessName);

    const { treasury, txHash } = await createCampaignOnChain({
      factory: env.factoryAddress,
      agent: agentSigner.address,
      perTxLimit: usdc(body.maxPerTxUsdc),
      campaignTotalLimit: usdc(body.totalBudgetUsdc),
    });

    const [campaign] = await db
      .insert(campaigns)
      .values({
        businessId: business.id,
        name: body.name,
        status: "active",
        rewardType: body.rewardType,
        rewardMode: body.rewardMode,
        treasuryAddress: treasury,
        agentSignerAddress: agentSigner.address,
        totalBudgetUsdc: body.totalBudgetUsdc,
        rewardPerUserUsdc: body.rewardPerUserUsdc,
        maxPerTxUsdc: body.maxPerTxUsdc,
        maxUsesPerHuman: body.maxUsesPerHuman,
        requiresApprovalAboveUsdc: body.requiresApprovalAboveUsdc ?? null,
        qualifyCondition: body.qualifyCondition,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      })
      .returning();

    return { campaign, treasury, txHash };
  });

  app.get("/campaigns", async () => {
    const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
    return Promise.all(rows.map(withBalance));
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
