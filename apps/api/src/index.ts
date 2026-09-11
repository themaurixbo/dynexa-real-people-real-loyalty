import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./lib/env.js";
import { transferEscrow } from "./lib/chain.js";
import { agentSigner } from "./agent/signer.js";
import { adminRoutes } from "./routes/admin.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { claimRoutes } from "./routes/claims.js";
import { businessRoutes } from "./routes/business.js";
import { giftRoutes } from "./routes/gifts.js";
import { redeemRoutes } from "./routes/redeem.js";
import { transferRoutes } from "./routes/transfers.js";
import { worldRoutes } from "./routes/world.js";

// Receipt photos travel as base64 data URLs in the claim body — raise the
// default 1MB limit to fit a compressed photo.
const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });

await app.register(cors, { origin: true });

app.get("/health", async () => ({
  ok: true,
  agent: agentSigner.address,
  agentMode: env.agentSigner,
  factory: env.factoryAddress ?? null,
  escrow: transferEscrow,
  giftToken: env.giftTokenAddress ?? null,
}));

await app.register(campaignRoutes);
await app.register(claimRoutes);
await app.register(giftRoutes);
await app.register(redeemRoutes);
await app.register(worldRoutes);
await app.register(businessRoutes);
await app.register(transferRoutes);
await app.register(adminRoutes);

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .then((addr) => app.log.info(`DYNEXA API on ${addr}`))
  .catch((e) => {
    app.log.error(e);
    process.exit(1);
  });
