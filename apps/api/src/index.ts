import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./lib/env.js";
import { agentSigner } from "./agent/signer.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { claimRoutes } from "./routes/claims.js";
import { redeemRoutes } from "./routes/redeem.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({
  ok: true,
  agent: agentSigner.address,
  agentMode: env.agentSigner,
  factory: env.factoryAddress ?? null,
}));

await app.register(campaignRoutes);
await app.register(claimRoutes);
await app.register(redeemRoutes);

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .then((addr) => app.log.info(`DYNEXA API on ${addr}`))
  .catch((e) => {
    app.log.error(e);
    process.exit(1);
  });
