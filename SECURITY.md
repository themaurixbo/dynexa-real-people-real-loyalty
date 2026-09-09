# Security

## Threat model

The core risk is an autonomous agent that can move a business's USDC. DYNEXA is
built so no single failure — a bug in our backend, a compromised agent, a bad AI
output — can over-pay or drain a campaign budget.

## Defense in depth

| Layer | Enforces |
|---|---|
| AI (verifier) | Only returns `{valid, reason}` on the evidence. Never sees or returns an amount. On an AI error it does **not** auto-approve. |
| Deterministic policy engine | Campaign active + in dates, evidence valid, receipt not reused, per-verified-human limit, per-tx limit, treasury funded. Plain code, no AI. |
| Circle Agent Wallet | Spending limit + treasury allowlist (mainnet). On testnet, Circle refuses to broadcast a call that would revert. |
| `CampaignTreasury` contract | `msg.sender == agent`, per-transaction cap, total campaign budget, `claimId` replay guard, `pause`, `close`. Independent of everything above. |

## Contract controls

- `CampaignTreasury`: per-tx limit, total-budget limit, `claimUsed` replay guard,
  `pausable`, `close()` returns the remainder only to the business, `ReentrancyGuard`,
  `SafeERC20`. No upgradeable proxy.
- `GiftToken`: mint only by the set `minter`, one gift per `claimId`, redeem only
  by the campaign's `redeemer`, `redeemed[tokenId]` blocks a second redemption,
  non-transferable by default, optional expiry.

## Identity and anti-abuse

- World Selfie Check before the first campaign reward. Only the nullifier and the
  minimal proof result are stored — no biometric images, no receipt contents, no
  personal data on-chain.
- `world_verifications` has `UNIQUE(action, nullifier)`; the per-person reward
  limit is counted against the verified human, not the account, so extra email
  accounts don't get extra rewards.
- Receipts are stored as a hash (`receipts.receipt_hash` unique) to block reuse.

## Data handling

- On-chain: only hashes / references (`nullifierHash`, `receiptHash`).
- Off-chain: the claim pipeline and audit trail in PostgreSQL. Receipt text /
  image references are kept for the demo; a production build would set a
  retention policy.

## Known gaps (see MAINNET_READINESS.md)

- Single deployer/business key in env — production needs a KMS or a Privy quorum.
- No API rate limiting / auth yet.
- No reorg handling.
- Prompt-injection hardening on receipt text is not done.
- Referral auto-referral (A creating the link and claiming it) is not blocked.

## Reporting

Open an issue on the repo. This is a hackathon build; do not use it with real
funds.
