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
`AGENT_SIGNER=circle` (the Circle Agent Wallet `0x7b1727…4164` executes payouts
and gift mints; Circle CLI is installed and holds an ARC-TESTNET agent session),
`OPENAI_API_KEY` set (verifier uses AI vision), World Selfie Check live with a
real RP signing key.

The process is managed with `interpreter none` so pm2 runs the `tsx` shim
directly:

```
cd ~/app/apps/api
pm2 start node_modules/.bin/tsx --name dynexa-api --interpreter none -- src/index.ts
```

`env.ts` loads `~/app/.env` via dotenv, which does not override vars already in
the process env — so a changed `.env` value needs `pm2 delete dynexa-api` and a
fresh `pm2 start` (with the new value exported), not just `pm2 restart`.

Redeploy after a push:

```
ssh realloyalty@<vps> 'cd ~/app && git pull \
  && corepack pnpm@10.4.1 install \
  && corepack pnpm@10.4.1 --filter @dynexa/api exec drizzle-kit migrate \
  && pm2 restart dynexa-api'
```

## What still differs from the full local flow

- The Privy business server wallet routes are deployed but Privy has not
  authorized the app for Arc (`eip155:5042002`), so business-side funding still
  uses the deployer key. See `FEEDBACK_PRIVY.md`.
- `drizzle-kit migrate` exits without applying on this box; migration 0002 was
  applied by hand (`ALTER TABLE businesses ADD COLUMN privy_wallet_id text`) and
  recorded in `drizzle.__drizzle_migrations`.
