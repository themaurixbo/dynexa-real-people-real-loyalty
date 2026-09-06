# ADR 0001 — Stack and repository structure

Status: accepted
Date: 2026-09-06

## Context

Greenfield MVP for ETHOnline 2026, ~8 days, three required integrations (Privy,
Arc, World). Spec §5 recommends a TypeScript monorepo and lists a structure.

## Decision

- **Monorepo** with pnpm workspaces.
- **Web**: Next.js + Tailwind, dark mode.
- **API**: Node with a typed framework, PostgreSQL.
- **DB access / migrations**: Drizzle. Chosen over Prisma for a lighter footprint
  and faster schema iteration under time pressure.
- **Contracts**: Foundry. EVM calls from the app via viem.
- **Validation**: Zod for all runtime boundaries (AI output, API input).
- **E2E**: Playwright for the 5 minimum flows.

## Structure

```
apps/
  web/      Next.js consumer + business UI
  api/      Node API, AI orchestration, Privy/World server calls
packages/
  contracts/            Foundry project
  domain/               shared types, policy engine
  ai-agent/             provider abstraction, prompts, schema
  privy-integration/
  world-integration/
  arc-integration/      chain config, USDC address, viem clients
  ui/                   shared components
  config/               env loading, constants
docs/
```

## Notes

- No hard-coded RPC URLs or contract addresses; all via `packages/config`.
- Contract addresses come only from official Arc docs or our own deploys. A
  MockUSDC exists for local contract tests only.
- Nothing from the Aleph/WDK prototype is reused (see `PREEXISTING_WORK.md`).
