import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { keccak256, toHex } from "viem";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { payAndRecord, runRewardClaim } from "../agent/reward-agent.js";

const { claims, campaigns, users } = schema;

const claimBody = z.object({
  campaignId: z.string().uuid(),
  contact: z.string().min(3),
  customerAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  evidenceUrl: z.string().url().optional(),
  evidenceText: z.string().optional(),
  receiptRef: z.string().min(1),
  referralCode: z.string().optional(),
});

export async function claimRoutes(app: FastifyInstance) {
  app.post("/claims", async (req, reply) => {
    const body = claimBody.parse(req.body);
    try {
      return await runRewardClaim(body as Parameters<typeof runRewardClaim>[0]);
    } catch (e) {
      req.log.error(e);
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.get("/claims", async (req) => {
    const { campaignId, status } = z
      .object({
        campaignId: z.string().uuid().optional(),
        status: z.enum(["pending", "approved", "rejected", "paid", "failed"]).optional(),
      })
      .parse(req.query);
    const conditions = [
      campaignId ? eq(claims.campaignId, campaignId) : undefined,
      status ? eq(claims.status, status) : undefined,
    ].filter((c): c is NonNullable<typeof c> => Boolean(c));
    const where = conditions.length ? and(...conditions) : undefined;
    return db.select().from(claims).where(where).orderBy(desc(claims.createdAt));
  });

  // Business approves a claim that was over the auto-approval amount.
  app.post("/claims/:id/approve", async (req, reply) => {
    const { id } = req.params as { id: string };
    const claim = await db.query.claims.findFirst({ where: eq(claims.id, id) });
    if (!claim) return reply.code(404).send({ error: "not found" });
    if (claim.status !== "pending") {
      return reply.code(409).send({ error: `claim is ${claim.status}` });
    }
    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, claim.campaignId),
    });
    const user = await db.query.users.findFirst({ where: eq(users.id, claim.userId) });
    if (!campaign || !user) return reply.code(404).send({ error: "not found" });

    const [receipt] = await db
      .select()
      .from(schema.receipts)
      .where(
        and(
          eq(schema.receipts.campaignId, campaign.id),
          eq(schema.receipts.userId, user.id),
        ),
      );
    const [verification] = await db
      .select()
      .from(schema.worldVerifications)
      .where(eq(schema.worldVerifications.userId, user.id));

    const { txHash } = await payAndRecord(claim.id, campaign, user, {
      nullifierHash: keccak256(toHex(verification?.nullifierHash ?? `stub:${user.id}`)),
      receiptHash: receipt?.receiptHash
        ? (receipt.receiptHash as `0x${string}`)
        : keccak256(toHex("manual-approval")),
    });
    return { status: "paid", txHash };
  });

  // Business rejects a claim that was over the auto-approval amount.
  app.post("/claims/:id/reject", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { reason } = z.object({ reason: z.string().default("Rejected by the business.") }).parse(
      req.body ?? {},
    );
    const claim = await db.query.claims.findFirst({ where: eq(claims.id, id) });
    if (!claim) return reply.code(404).send({ error: "not found" });
    if (claim.status !== "pending") {
      return reply.code(409).send({ error: `claim is ${claim.status}` });
    }
    await db
      .update(claims)
      .set({ status: "rejected", rejectionReason: reason, decidedAt: new Date() })
      .where(eq(claims.id, id));
    return { status: "rejected", reason };
  });
}
