# AI usage disclosure

DYNEXA was designed and developed by our team using AI-assisted tools. We defined
the product, architecture, security rules, UX and integration strategy;
researched the partner documentation; and provided the initial code and
integration patterns. Claude Code helped us accelerate implementation across the
contracts, backend and frontend, while our team reviewed, tested and validated
every result on Arc testnet.

At runtime, GPT-4o-mini analyzes proof-of-purchase evidence, while deterministic
policies and smart contracts control reward eligibility, amounts and settlement.

## AI tools used

| Tool | Where |
|---|---|
| Claude Code | Implementation help across `packages/contracts`, `apps/api`, `apps/web` |
| Claude Design | Visual system and screen mockups (`design-canvas-source/` reference) |
| GPT-4o-mini (OpenAI) | Runtime vision model that checks the proof image on each claim (`apps/api/src/agent/verifier.ts`). It never sets the reward amount. |

## What the team decided and owns

- The product and the mandatory demo use cases.
- The two-stage control model: the AI only judges evidence; a deterministic
  policy engine and the on-chain contract enforce the per-transaction cap, the
  campaign budget, the per-verified-human limit and replay protection.
- Choice of partners (Privy, Arc, World) and how each is used.
- All third-party accounts, API keys and wallets.
- The switch to a direct agent-execute contract model so a Circle Agent Wallet
  can be the agent.

## What the team reviewed and validated

- Read and adjusted the generated Solidity, TypeScript and SQL.
- Ran the Foundry test suite (19 tests) and the API against a live database.
- Verified every on-chain step with real transactions on Arc testnet — factory
  deploy, campaign create, fund, agent payout, over-limit revert, GiftToken mint,
  POS redeem, second-redeem rejection, and the agent-to-agent payment. Tx hashes
  are in `docs/DEPLOYMENTS.md`.

## To complete before final submission

- [ ] Team members confirm the split of work above is accurate for their contributions.
- [ ] Add any additional AI tools used by individual team members.
