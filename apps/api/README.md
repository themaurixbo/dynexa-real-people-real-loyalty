# @dynexa/api

Node API, AI orchestration, and the server-side Privy / World calls.

## Database

Schema is in `src/db/schema.ts` (spec §10). Migrations in `src/db/migrations/`.

```
docker compose up -d db          # from repo root
cp ../../.env.example ../../.env  # set DATABASE_URL
pnpm db:migrate
```

`pnpm db:generate` after changing the schema. `pnpm db:studio` to browse.

The claim pipeline maps to tables like this: `receipts` / `world_verifications`
→ `claims` → `ai_decisions` → `policy_results` → `payouts` + `gift_token_issuances`
→ `redemptions`, with `blockchain_transactions` holding the on-chain side and
`audit_events` the trail.
