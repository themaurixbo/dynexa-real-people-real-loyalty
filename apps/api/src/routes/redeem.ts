import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { redeemGift } from "../lib/chain.js";
import { env } from "../lib/env.js";

const { giftTokenIssuances, redemptions, blockchainTransactions, auditEvents } = schema;

export async function redeemRoutes(app: FastifyInstance) {
  // POS: redeem a gift by its code.
  app.post("/redeem", async (req, reply) => {
    const { code } = z.object({ code: z.string().min(3) }).parse(req.body);
    if (!env.giftTokenAddress) return reply.code(500).send({ error: "GIFT_TOKEN_ADDRESS not set" });

    const issuance = await db.query.giftTokenIssuances.findFirst({
      where: eq(giftTokenIssuances.redemptionCode, code),
    });
    if (!issuance) return reply.code(404).send({ error: "Unknown gift code." });
    if (issuance.status === "redeemed") {
      await db.insert(redemptions).values({
        issuanceId: issuance.id,
        code,
        status: "rejected",
        reason: "This gift was already redeemed.",
      });
      return reply.code(409).send({ status: "rejected", reason: "This gift was already redeemed." });
    }

    const txHash = await redeemGift(
      env.giftTokenAddress,
      BigInt(issuance.tokenId),
      issuance.toAddress as `0x${string}`,
    );

    const [tx] = await db
      .insert(blockchainTransactions)
      .values({ chainId: 5042002, hash: txHash, kind: "redeem", status: "confirmed", confirmedAt: new Date() })
      .returning();
    await db
      .update(giftTokenIssuances)
      .set({ status: "redeemed" })
      .where(eq(giftTokenIssuances.id, issuance.id));
    await db.insert(redemptions).values({
      issuanceId: issuance.id,
      code,
      status: "success",
      txId: tx.id,
    });
    await db.insert(auditEvents).values({
      actorType: "pos",
      action: "gift.redeemed",
      subjectType: "gift_issuance",
      subjectId: issuance.id,
      data: { txHash },
    });

    return { status: "success", tokenId: issuance.tokenId, txHash };
  });
}
