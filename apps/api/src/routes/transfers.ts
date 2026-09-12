import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { findOrCreateUser } from "../agent/reward-agent.js";
import {
  sendUsdc,
  transferEscrow,
  transferGiftFromEscrow,
  usdc,
  verifyGiftTransfer,
  verifyUsdcTransfer,
} from "../lib/chain.js";
import { env } from "../lib/env.js";

const { p2pTransfers, giftTokenIssuances, users, wallets } = schema;

function genCode() {
  return randomBytes(5).toString("hex").toUpperCase();
}

/**
 * Send USDC or a GiftToken to a friend by link, no wallet needed on their
 * end yet. The sender's own wallet moves the asset to the escrow first
 * (client-side); this just verifies that transfer and issues a claim code.
 * A friend opens the link, logs in (Privy creates their wallet if they don't
 * have one), and claims — the escrow sends the asset to their new address.
 */
export async function transferRoutes(app: FastifyInstance) {
  app.post("/transfers", async (req, reply) => {
    const body = z
      .object({
        fromAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        fromContact: z.string().optional(),
        toContact: z.string().optional(),
        amountUsdc: z.string(),
        fromTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        note: z.string().max(140).optional(),
      })
      .parse(req.body);

    const existing = await db.query.p2pTransfers.findFirst({
      where: eq(p2pTransfers.fromTxHash, body.fromTxHash),
    });
    if (existing) return { code: existing.code, amountUsdc: existing.amountUsdc };

    const amount = usdc(body.amountUsdc);
    const ok = await verifyUsdcTransfer(body.fromTxHash as `0x${string}`, {
      from: body.fromAddress as `0x${string}`,
      to: transferEscrow,
      amount,
    });
    if (!ok) {
      return reply.code(400).send({ error: "Could not verify that USDC transfer on Arc." });
    }

    const fromUser = body.fromContact
      ? await findOrCreateUser(body.fromContact, body.fromAddress as `0x${string}`)
      : undefined;

    const code = genCode();
    const [row] = await db
      .insert(p2pTransfers)
      .values({
        code,
        kind: "usdc",
        fromUserId: fromUser?.id,
        fromAddress: body.fromAddress,
        toContact: body.toContact,
        amountUsdc: body.amountUsdc,
        note: body.note,
        fromTxHash: body.fromTxHash,
      })
      .returning();

    // Direct send: if the contact already has a real Privy wallet, deliver right away.
    if (body.toContact) {
      const toUser = await db.query.users.findFirst({ where: eq(users.privyUserId, body.toContact) });
      if (toUser) {
        const [w] = await db
          .select()
          .from(wallets)
          .where(
            and(eq(wallets.ownerId, toUser.id), eq(wallets.ownerType, "user"), eq(wallets.provider, "privy")),
          );
        if (w) {
          const txHash = await sendUsdc(w.address as `0x${string}`, amount);
          await db
            .update(p2pTransfers)
            .set({ status: "claimed", toAddress: w.address, toUserId: toUser.id, toTxHash: txHash, claimedAt: new Date() })
            .where(eq(p2pTransfers.id, row.id));
          return { code, amountUsdc: body.amountUsdc, autoDelivered: { toAddress: w.address, txHash } };
        }
      }
    }

    return { code, amountUsdc: body.amountUsdc };
  });

  app.get("/transfers/:code", async (req, reply) => {
    const { code } = req.params as { code: string };
    const t = await db.query.p2pTransfers.findFirst({
      where: eq(p2pTransfers.code, code.toUpperCase()),
    });
    if (!t || t.kind !== "usdc") return reply.code(404).send({ error: "Gift link not found." });
    return { code: t.code, amountUsdc: t.amountUsdc, note: t.note, status: t.status };
  });

  app.post("/transfers/:code/claim", async (req, reply) => {
    const { code } = req.params as { code: string };
    const body = z
      .object({
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        contact: z.string().optional(),
      })
      .parse(req.body);

    const t = await db.query.p2pTransfers.findFirst({
      where: eq(p2pTransfers.code, code.toUpperCase()),
    });
    if (!t || t.kind !== "usdc" || !t.amountUsdc) {
      return reply.code(404).send({ error: "Gift link not found." });
    }
    if (t.status !== "pending") {
      return reply.code(409).send({ error: `This gift link was already ${t.status}.` });
    }

    const txHash = await sendUsdc(body.address as `0x${string}`, usdc(t.amountUsdc));
    const toUser = body.contact
      ? await findOrCreateUser(body.contact, body.address as `0x${string}`)
      : undefined;

    await db
      .update(p2pTransfers)
      .set({
        status: "claimed",
        toAddress: body.address,
        toUserId: toUser?.id,
        toTxHash: txHash,
        claimedAt: new Date(),
      })
      .where(eq(p2pTransfers.id, t.id));

    return { status: "claimed", amountUsdc: t.amountUsdc, txHash };
  });

  // --- gift-token version: same link + claim pattern, moves an ERC-1155 instead of USDC ---

  app.post("/gift-transfers", async (req, reply) => {
    if (!env.giftTokenAddress) return reply.code(500).send({ error: "GIFT_TOKEN_ADDRESS not set" });
    const body = z
      .object({
        issuanceId: z.string().uuid(),
        fromAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        fromContact: z.string().optional(),
        fromTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        toContact: z.string().optional(),
        note: z.string().max(140).optional(),
      })
      .parse(req.body);

    const existing = await db.query.p2pTransfers.findFirst({
      where: eq(p2pTransfers.fromTxHash, body.fromTxHash),
    });
    if (existing) return { code: existing.code };

    const issuance = await db.query.giftTokenIssuances.findFirst({
      where: eq(giftTokenIssuances.id, body.issuanceId),
    });
    if (!issuance || issuance.toAddress.toLowerCase() !== body.fromAddress.toLowerCase()) {
      return reply.code(400).send({ error: "You don't hold that gift." });
    }
    if (issuance.status === "redeemed") {
      return reply.code(409).send({ error: "This gift was already redeemed." });
    }

    const ok = await verifyGiftTransfer(body.fromTxHash as `0x${string}`, env.giftTokenAddress, {
      tokenId: BigInt(issuance.tokenId),
      from: body.fromAddress as `0x${string}`,
      to: transferEscrow,
    });
    if (!ok) return reply.code(400).send({ error: "Could not verify that transfer on Arc." });

    const fromUser = body.fromContact
      ? await findOrCreateUser(body.fromContact, body.fromAddress as `0x${string}`)
      : undefined;

    const code = genCode();
    const [row] = await db
      .insert(p2pTransfers)
      .values({
        code,
        kind: "gift",
        fromUserId: fromUser?.id,
        fromAddress: body.fromAddress,
        toContact: body.toContact,
        giftTokenId: issuance.tokenId,
        giftIssuanceId: issuance.id,
        note: body.note,
        fromTxHash: body.fromTxHash,
      })
      .returning();
    // the token now sits with the escrow, not the sender
    await db
      .update(giftTokenIssuances)
      .set({ toAddress: transferEscrow })
      .where(eq(giftTokenIssuances.id, issuance.id));

    // Direct send: if the contact already has a real Privy wallet, deliver right away.
    if (body.toContact) {
      const toUser = await db.query.users.findFirst({ where: eq(users.privyUserId, body.toContact) });
      if (toUser) {
        const [w] = await db
          .select()
          .from(wallets)
          .where(
            and(eq(wallets.ownerId, toUser.id), eq(wallets.ownerType, "user"), eq(wallets.provider, "privy")),
          );
        if (w) {
          const txHash = await transferGiftFromEscrow(
            env.giftTokenAddress,
            BigInt(issuance.tokenId),
            w.address as `0x${string}`,
          );
          await db
            .update(giftTokenIssuances)
            .set({ toAddress: w.address })
            .where(eq(giftTokenIssuances.id, issuance.id));
          await db
            .update(p2pTransfers)
            .set({ status: "claimed", toAddress: w.address, toUserId: toUser.id, toTxHash: txHash, claimedAt: new Date() })
            .where(eq(p2pTransfers.id, row.id));
          return { code, autoDelivered: { toAddress: w.address, txHash } };
        }
      }
    }

    return { code };
  });

  app.get("/gift-transfers/:code", async (req, reply) => {
    const { code } = req.params as { code: string };
    const t = await db.query.p2pTransfers.findFirst({
      where: eq(p2pTransfers.code, code.toUpperCase()),
    });
    if (!t || t.kind !== "gift") return reply.code(404).send({ error: "Gift link not found." });
    const issuance = t.giftIssuanceId
      ? await db.query.giftTokenIssuances.findFirst({ where: eq(giftTokenIssuances.id, t.giftIssuanceId) })
      : undefined;
    const campaign = issuance
      ? await db.query.campaigns.findFirst({ where: eq(schema.campaigns.id, issuance.campaignId) })
      : undefined;
    return {
      code: t.code,
      note: t.note,
      status: t.status,
      campaignName: campaign?.name ?? "Gift",
    };
  });

  app.post("/gift-transfers/:code/claim", async (req, reply) => {
    if (!env.giftTokenAddress) return reply.code(500).send({ error: "GIFT_TOKEN_ADDRESS not set" });
    const { code } = req.params as { code: string };
    const body = z
      .object({
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        contact: z.string().optional(),
      })
      .parse(req.body);

    const t = await db.query.p2pTransfers.findFirst({
      where: eq(p2pTransfers.code, code.toUpperCase()),
    });
    if (!t || t.kind !== "gift" || !t.giftTokenId) {
      return reply.code(404).send({ error: "Gift link not found." });
    }
    if (t.status !== "pending") {
      return reply.code(409).send({ error: `This gift link was already ${t.status}.` });
    }

    const txHash = await transferGiftFromEscrow(
      env.giftTokenAddress,
      BigInt(t.giftTokenId),
      body.address as `0x${string}`,
    );
    const toUser = body.contact
      ? await findOrCreateUser(body.contact, body.address as `0x${string}`)
      : undefined;

    if (t.giftIssuanceId) {
      await db
        .update(giftTokenIssuances)
        .set({ toAddress: body.address })
        .where(eq(giftTokenIssuances.id, t.giftIssuanceId));
    }
    await db
      .update(p2pTransfers)
      .set({
        status: "claimed",
        toAddress: body.address,
        toUserId: toUser?.id,
        toTxHash: txHash,
        claimedAt: new Date(),
      })
      .where(eq(p2pTransfers.id, t.id));

    return { status: "claimed", txHash };
  });
}
