# Deployments

## Arc testnet (chain 5042002)

Explorer: https://testnet.arcscan.app

| Contract | Address |
|---|---|
| CampaignTreasuryFactory | `0xD6854881284ffa154f92a9b9325Ee09774370e91` |

The agent is a **Circle Agent Wallet** (`0x7b1727da37af0a0aadf55baa973f758c04764164`).
It calls `CampaignTreasury.payout(...)` through Circle CLI. The treasury checks
`msg.sender == agent` and enforces the per-transaction and total-budget limits on
its own; Circle refuses to submit a call that would revert.

### Verified end to end on 2026-09-08

Demo campaign treasury `0x223675DD3599f5a933a67f9D7a4f1d78DC85F96b`
(reward 1 USDC, per-tx 2 USDC, budget 5 USDC).

| Step | Tx |
|---|---|
| Deploy factory | run via `script/DeployFactory.s.sol` |
| Create campaign (backend, business key) | `0xfeba4f0f3bdca7fb62891712e42d795c63a95a8eb5e3038ec177b9297c2e0386` |
| Fund 3 USDC | `0x1ce4561aa37892e5e1b16cc5ccb25f93154296413febc47aa0b008606e179c8b` |
| Payout 1 USDC — **Circle Agent Wallet executed** | `0xf47408889354b52b44b201ab86f59efc4643c65a52a25f3eaf4d04cc30813c2d` |

An over-limit payout (3 USDC vs 2 per-tx) from the agent fails — the contract
reverts with `OverPerTxLimit` and Circle does not broadcast it.

USDC on Arc (`0x3600000000000000000000000000000000000000`) works as a standard
ERC-20. `forge` can't simulate its precompile locally, so the Foundry tests use a
MockUSDC and all live steps go through Circle CLI / viem against the RPC.

## Prior factory (replaced 2026-09-08)

`0x2FED0F2055c3EF6fAf20aF1b433f2a4Df11Cd6DC` — used the EIP-712 signed-authorization
model. Replaced by the direct-execute model so a Circle Agent Wallet (a smart
account) can be the agent.
