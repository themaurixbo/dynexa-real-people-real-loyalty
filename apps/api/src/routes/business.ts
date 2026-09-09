import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { businessSendRaw, businessSendUsdc, createBusinessWallet, privyConfigured } from "../lib/privy.js";

const { businesses, campaigns } = schema;

async function getBusiness(slug: string) {
  let b = await db.query.businesses.findFirst({ where: eq(businesses.slug, slug) });
  if (!b) {
    [b] = await db.insert(businesses).values({ name: slug, slug }).returning();
  }
  return b;
}

export async function businessRoutes(app: FastifyInstance) {
  // Create (once) the Privy server wallet for the business, with the policy attached.
  app.post("/business/wallet", async (req, reply) => {
    if (!privyConfigured()) return reply.code(503).send({ error: "Privy not configured" });
    const { slug } = z.object({ slug: z.string().default("vacafria") }).parse(req.body ?? {});
    const b = await getBusiness(slug);
    if (b.privyWalletId) {
      return { walletId: b.privyWalletId, address: b.walletAddress, existed: true };
    }
    const w = await createBusinessWallet();
    await db
      .update(businesses)
      .set({ privyWalletId: w.id, walletAddress: w.address })
      .where(eq(businesses.id, b.id));
    return { walletId: w.id, address: w.address, existed: false };
  });

  app.get("/business/wallet", async (req) => {
    const { slug } = z.object({ slug: z.string().default("vacafria") }).parse(req.query);
    const b = await getBusiness(slug);
    return { walletId: b.privyWalletId, address: b.walletAddress };
  });

  // B2B treasury operation: the business Privy wallet funds a campaign treasury.
  app.post("/business/fund", async (req, reply) => {
    const { campaignId, amountUsdc, slug } = z
      .object({
        campaignId: z.string().uuid(),
        amountUsdc: z.string(),
        slug: z.string().default("vacafria"),
      })
      .parse(req.body);
    const b = await getBusiness(slug);
    if (!b.privyWalletId) return reply.code(400).send({ error: "no business wallet" });
    const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
    if (!c?.treasuryAddress) return reply.code(404).send({ error: "campaign not found" });

    try {
      const { hash } = await businessSendUsdc(
        b.privyWalletId,
        c.treasuryAddress as `0x${string}`,
        amountUsdc,
      );
      return { hash };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  // Demo: the business wallet tries to send to a non-allowlisted address -> Privy denies.
  app.post("/business/policy-test", async (req, reply) => {
    const { to, slug } = z
      .object({
        to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        slug: z.string().default("vacafria"),
      })
      .parse(req.body);
    const b = await getBusiness(slug);
    if (!b.privyWalletId) return reply.code(400).send({ error: "no business wallet" });
    try {
      const { hash } = await businessSendRaw(b.privyWalletId, to as `0x${string}`, 1n);
      return { blocked: false, hash };
    } catch (e) {
      return { blocked: true, reason: (e as Error).message };
    }
  });
}
