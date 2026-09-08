# Deployment

## Frontend — https://realloyalty.dynexa.us

Static export (`apps/web`, `output: "export"`) served by nginx on a VPS.

```
cd apps/web
pnpm build
rsync -az --delete ./out/ realloyalty@<vps>:/var/www/realloyalty/releases/rel-<date>/
ssh realloyalty@<vps> 'ln -sfn /var/www/realloyalty/releases/rel-<date> /var/www/realloyalty/current'
```

The API base URL is auto-selected in `apps/web/lib/api.ts`: on
`realloyalty.dynexa.us` it uses `https://apirealloyalty.dynexa.us`, otherwise
`http://localhost:4000` (override with `NEXT_PUBLIC_API_URL`).

## Backend — https://apirealloyalty.dynexa.us

Node (Fastify) via `tsx`, managed by `pm2` as `dynexa-api` on `127.0.0.1:9001`.
nginx proxies `apirealloyalty.dynexa.us` → `9001`. Its own PostgreSQL 18 cluster
on port `5433` (separate from anything else on the box), database `dynexa`.

`~/app/.env` on the server carries the config. Current live settings:
`AGENT_SIGNER=local` (the deployer key acts as the agent — Circle CLI is not
installed on the server yet), `OPENAI_API_KEY` empty (verifier uses the rule
fallback), World verification stubbed.

Redeploy after a push:

```
ssh realloyalty@<vps> 'cd ~/app && git pull \
  && corepack pnpm@10.4.1 install \
  && corepack pnpm@10.4.1 --filter @dynexa/api exec drizzle-kit migrate \
  && pm2 restart dynexa-api'
```

## What still differs from the full local flow

- The live agent is the deployer key, not the Circle Agent Wallet. The Circle
  Agent Stack flow is proven locally and on-chain (see `docs/DEPLOYMENTS.md`).
- No AI vision (needs `OPENAI_API_KEY` on the server).
- World Selfie Check is a stub.
