# Mainnet readiness

DYNEXA is testnet-functional on Arc and mainnet-oriented. This document is
honest about what is production-ready and what is not.

## Production-ready

- **Contracts.** `CampaignTreasuryFactory`, `CampaignTreasury`, `GiftToken` are
  small and auditable. Limits (per-transaction, total budget), replay protection
  (`claimId`), `pause`, `close` with refund, and role checks (`business`,
  `agent`, `redeemer`) are enforced on-chain. `SafeERC20`, `ReentrancyGuard`, no
  upgradeable proxies.
- **No hard-coded RPC or contract addresses.** All network config comes from env
  (`packages/config`, `apps/api/src/lib/env.ts`). Switching to mainnet is a
  config change plus a deploy.
- **Deterministic policy engine** (`apps/api/src/agent/policy.ts`) — the money
  rules are plain code, independent of the AI and re-checked by the contract.
- **Idempotency + audit.** `idempotency_keys`, `audit_events`, and
  `blockchain_transactions` with pending/confirmed/failed states in the schema.

## Experimental / not production-ready

- **AI verifier.** Uses `gpt-4o-mini` on a demo prompt. For production it needs a
  real OCR/vision pipeline, prompt-injection hardening on receipt text, model and
  prompt versioning, and a proper deterministic fallback.
- **World Selfie Check.** Runs against staging + the simulator. Production needs
  the production action, real devices, and the Selfie Check feature flag.
- **Circle Agent Wallet spending policy.** Configured conceptually; the CLI
  `wallet limit` is mainnet-only, so on testnet the cap is enforced by the
  contract + policy engine only.
- **Key management.** The deployer/business key is a single env var. Production
  needs a KMS / HSM or a Privy key quorum for the business, and the agent should
  keep its Circle Agent Wallet policy tight.
- **The live server** runs with `AGENT_SIGNER=local` for the demo; production is
  the Circle Agent Wallet.

## Required before mainnet

- Contract audit.
- Circle: confirm Agent Wallet availability + spending policy on Arc mainnet;
  set the reward-agent wallet's transfer limit and treasury allowlist.
- Privy: production app configuration, business wallet + policy, remove the
  fallback app id.
- World: production action, feature flag, device testing.
- Arc: mainnet chain id / RPC / USDC address; contract verification on the
  mainnet explorer; a funded deployer.
- Monitoring: transaction confirmation + reorg handling, error alerting, DB
  backups.
- Rate limiting and auth on the API.

## Arc mainnet deployment steps

1. Set `ARC_RPC_URL`, `ARC_CHAIN_ID`, `ARC_USDC_ADDRESS` to mainnet values.
2. `forge script script/DeployFactory.s.sol --rpc-url $ARC_RPC_URL --broadcast`
   then `DeployGiftToken`.
3. Verify both on the mainnet explorer.
4. Point `FACTORY_ADDRESS` / `GIFT_TOKEN_ADDRESS` at the new deploys.
5. Create the reward agent's Circle Agent Wallet on mainnet, fund it, set its
   spending limit + treasury allowlist.
6. Run migrations against the production database.
7. Smoke test: create a small campaign, fund it, one payout, one over-limit
   rejection, one GiftToken mint + redeem.

## Estimated remaining work

~1–2 weeks of engineering after the audit for production hardening (key
management, monitoring, the real vision pipeline, rate limiting), plus audit
turnaround and partner production approvals.
