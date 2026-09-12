import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client.js";

const { wallets, claims, campaigns, giftTokenIssuances, redemptions, p2pTransfers } = schema;

export interface ActivityItem {
  id: string;
  type:
    | "usdc_won"
    | "gift_won"
    | "gift_redeemed"
    | "usdc_sent"
    | "usdc_received"
    | "gift_sent"
    | "gift_received";
  label: string;
  amountUsdc?: string;
  txHash?: string;
  at: string;
}

/** One combined timeline: rewards won, gifts redeemed, USDC/gifts sent or received by link. */
export async function activityRoutes(app: FastifyInstance) {
  app.get("/activity", async (req) => {
    const { address } = z.object({ address: z.string() }).parse(req.query);
    const items: ActivityItem[] = [];

    const [wallet] = await db.select().from(wallets).where(eq(wallets.address, address));

    if (wallet) {
      const paidClaims = await db
        .select({ claim: claims, campaign: campaigns })
        .from(claims)
        .innerJoin(campaigns, eq(claims.campaignId, campaigns.id))
        .where(and(eq(claims.userId, wallet.ownerId), eq(claims.status, "paid")))
        .orderBy(desc(claims.decidedAt));

      for (const { claim, campaign } of paidClaims) {
        const at = (claim.decidedAt ?? claim.createdAt).toISOString();
        if (campaign.rewardMode === "gift") {
          items.push({ id: claim.id, type: "gift_won", label: `Won: ${campaign.name}`, at });
        } else {
          items.push({
            id: claim.id,
            type: "usdc_won",
            label: `Earned ${Number(claim.cashAmountUsdc)} USDC — ${campaign.name}`,
            amountUsdc: claim.cashAmountUsdc ?? undefined,
            at,
          });
        }
      }

      const redeemedRows = await db
        .select({ redemption: redemptions, issuance: giftTokenIssuances })
        .from(redemptions)
        .innerJoin(giftTokenIssuances, eq(redemptions.issuanceId, giftTokenIssuances.id))
        .where(and(eq(giftTokenIssuances.toAddress, address), eq(redemptions.status, "success")));

      for (const { redemption, issuance } of redeemedRows) {
        items.push({
          id: redemption.id,
          type: "gift_redeemed",
          label: `Redeemed gift #${issuance.tokenId}`,
          at: redemption.createdAt.toISOString(),
        });
      }
    }

    const sent = await db
      .select()
      .from(p2pTransfers)
      .where(and(eq(p2pTransfers.fromAddress, address), eq(p2pTransfers.status, "claimed")));
    for (const t of sent) {
      items.push({
        id: t.id,
        type: t.kind === "gift" ? "gift_sent" : "usdc_sent",
        label:
          t.kind === "gift" ? "Sent a gift to a friend" : `Sent ${Number(t.amountUsdc)} USDC to a friend`,
        amountUsdc: t.amountUsdc ?? undefined,
        txHash: t.fromTxHash,
        at: (t.claimedAt ?? t.createdAt).toISOString(),
      });
    }

    const received = await db
      .select()
      .from(p2pTransfers)
      .where(and(eq(p2pTransfers.toAddress, address), eq(p2pTransfers.status, "claimed")));
    for (const t of received) {
      items.push({
        id: t.id,
        type: t.kind === "gift" ? "gift_received" : "usdc_received",
        label:
          t.kind === "gift"
            ? "Received a gift from a friend"
            : `Received ${Number(t.amountUsdc)} USDC from a friend`,
        amountUsdc: t.amountUsdc ?? undefined,
        txHash: t.toTxHash ?? undefined,
        at: (t.claimedAt ?? t.createdAt).toISOString(),
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return items.slice(0, 30);
  });
}
