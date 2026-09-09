import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { env } from "../lib/env.js";
import { createWorldSession, verifyWorldProof } from "../lib/world.js";
import { findOrCreateUser } from "../agent/reward-agent.js";

const { worldVerifications, wallets } = schema;

export async function worldRoutes(app: FastifyInstance) {
  // The widget needs a fresh RP signature scoped to our action.
  app.get("/world/session", async (_req, reply) => {
    if (!env.world.signingKey || !env.world.rpId) {
      return reply.code(503).send({ error: "World not configured" });
    }
    try {
      return createWorldSession();
    } catch (e) {
      return reply.code(500).send({ error: (e as Error).message });
    }
  });

  // Verify the proof from the widget and store the nullifier.
  app.post("/world/verify", async (req, reply) => {
    const { contact, address, proof } = z
      .object({
        contact: z.string().min(3),
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        proof: z.record(z.string(), z.unknown()),
      })
      .parse(req.body);

    const result = await verifyWorldProof(proof);
    if (!result.ok || !result.nullifierHash) {
      return reply.code(400).send({ verified: false, error: result.error ?? "no nullifier" });
    }

    const user = await findOrCreateUser(contact, address as `0x${string}`);

    // one nullifier per action; upsert to this user
    const existing = await db.query.worldVerifications.findFirst({
      where: and(
        eq(worldVerifications.action, env.world.action),
        eq(worldVerifications.nullifierHash, result.nullifierHash),
      ),
    });
    if (!existing) {
      await db.insert(worldVerifications).values({
        userId: user.id,
        action: env.world.action,
        nullifierHash: result.nullifierHash,
        credentialType: "selfie",
      });
    }
    return { verified: true };
  });

  // Has this wallet's user completed the World check?
  app.get("/world/status", async (req) => {
    const { address } = z.object({ address: z.string() }).parse(req.query);
    const [wallet] = await db.select().from(wallets).where(eq(wallets.address, address));
    if (!wallet) return { verified: false };
    const v = await db.query.worldVerifications.findFirst({
      where: eq(worldVerifications.userId, wallet.ownerId),
    });
    return { verified: Boolean(v) };
  });
}
