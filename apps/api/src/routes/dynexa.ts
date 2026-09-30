import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { findOrCreateUser } from "../agent/reward-agent.js";

const { posCharges, businesses, users, wallets, dynexaLedger } = schema;

/**
 * DYNEXA points: an off-chain loyalty balance (not USDC, no blockchain calls).
 * Earned from percentage-reward campaigns (see reward-agent.ts), spent at a
 * business's POS through a one-time "Cobrar" QR charge.
 */
export async function dynexaRoutes(app: FastifyInstance) {
  app.get("/dynexa/balance", async (req, reply) => {
    const { address } = z.object({ address: z.string() }).parse(req.query);
    const [wallet] = await db.select().from(wallets).where(eq(wallets.address, address));
    if (!wallet) return { balance: "0" };
    const [user] = await db.select().from(users).where(eq(users.id, wallet.ownerId));
    return { balance: user?.dynexaBalance ?? "0" };
  });

  // POS: "Cobrar" — pick an amount, get a one-time QR the customer scans.
  app.post("/dynexa/charges", async (req, reply) => {
    const { businessId, amountDynexa } = z
      .object({ businessId: z.string().uuid(), amountDynexa: z.string() })
      .parse(req.body);
    const business = await db.query.businesses.findFirst({ where: eq(businesses.id, businessId) });
    if (!business) return reply.code(404).send({ error: "business not found" });

    const code = `POS-${randomBytes(4).toString("hex").toUpperCase()}`;
    const [charge] = await db
      .insert(posCharges)
      .values({ businessId, code, amountDynexa })
      .returning();
    return { code: charge.code, amountDynexa: charge.amountDynexa, businessName: business.name };
  });

  // Customer app: look up a scanned charge before showing the confirm dialog.
  app.get("/dynexa/charges/:code", async (req, reply) => {
    const { code } = req.params as { code: string };
    const charge = await db.query.posCharges.findFirst({ where: eq(posCharges.code, code) });
    if (!charge) return reply.code(404).send({ error: "not found" });
    const business = await db.query.businesses.findFirst({ where: eq(businesses.id, charge.businessId) });
    return {
      code: charge.code,
      amountDynexa: charge.amountDynexa,
      status: charge.status,
      businessName: business?.name ?? "Business",
    };
  });

  // Customer confirms "Sí" — moves the amount off their balance, no chain call.
  app.post("/dynexa/charges/:code/pay", async (req, reply) => {
    const { code } = req.params as { code: string };
    const { contact, address } = z
      .object({ contact: z.string().min(3), address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) })
      .parse(req.body);
    const charge = await db.query.posCharges.findFirst({ where: eq(posCharges.code, code) });
    if (!charge) return reply.code(404).send({ error: "not found" });
    if (charge.status !== "pending") {
      return reply.code(409).send({ error: `This charge was already ${charge.status}.` });
    }

    const user = await findOrCreateUser(contact, address as `0x${string}`);
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
    const balance = Number(dbUser?.dynexaBalance ?? "0");
    const amount = Number(charge.amountDynexa);
    if (balance < amount) {
      return reply.code(400).send({ error: `Not enough DYNEXA — you have ${balance}.` });
    }

    await db.insert(dynexaLedger).values({
      userId: user.id,
      delta: String(-amount),
      reason: "pos_redeem",
      chargeId: charge.id,
    });
    await db
      .update(users)
      .set({ dynexaBalance: sql`${users.dynexaBalance} - ${String(amount)}::numeric` })
      .where(eq(users.id, user.id));
    await db
      .update(posCharges)
      .set({ status: "paid", payerUserId: user.id, paidAt: new Date() })
      .where(eq(posCharges.id, charge.id));

    return { status: "paid", amountDynexa: charge.amountDynexa };
  });
}
