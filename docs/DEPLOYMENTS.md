# Deployments

## Arc testnet (chain 5042002)

Explorer: https://testnet.arcscan.app

| Contract | Address |
|---|---|
| CampaignTreasuryFactory | `0xD6854881284ffa154f92a9b9325Ee09774370e91` |
| GiftToken (ERC-1155) | `0xc9F3ABBd3D1f29391FA08158eD6AcfDA2990E192` |

| Agent | Circle Agent Wallet |
|---|---|
| Reward agent (pays USDC, mints gifts) | `0x7b1727da37af0a0aadf55baa973f758c04764164` |
| Verifier agent (paid per evidence check) | `0x7fa477d41e3620ac09298623b9fcc1823ee049f4` |

The reward agent calls `CampaignTreasury.payout(...)` and `GiftToken.mint(...)`
through Circle CLI. The treasury checks `msg.sender == agent` and enforces the
per-transaction and total-budget limits on its own; Circle refuses to submit a
call that would revert. The reward agent pays the verifier agent 0.001 USDC per
check (agent-to-agent, on Arc).

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

### GiftToken flow (2026-09-08)

Gift campaign registered on-chain as gift campaign id 1
(tx `0xec3c4abc7b7345f3acf6f7c6fbe362b1a8e9bc7d641adb958bffb6243fadf9a0`).

| Step | Tx |
|---|---|
| Agent mints GiftToken #1 to the customer | `0x1007fc5ea6d6a4bd9d6528d2634e8291d6b353a7d099379b3359f29397631778` |
| POS redeems it (burned on-chain) | `0x15cdb5bf06388c41663c7597b9b137a7146d0ca8d90b0f87d429924a984debb1` |
| Verifier agent paid 0.001 USDC | `0xc8c4eeb627b367c81ef50ebd177709bf1169dc70517bea11e1cee0d312b22d83` |

A second redemption of the same gift is rejected (`AlreadyRedeemed`).

USDC on Arc (`0x3600000000000000000000000000000000000000`) works as a standard
ERC-20. `forge` can't simulate its precompile locally, so the Foundry tests use a
MockUSDC and all live steps go through Circle CLI / viem against the RPC.

## Prior factory (replaced 2026-09-08)

`0x2FED0F2055c3EF6fAf20aF1b433f2a4Df11Cd6DC` — used the EIP-712 signed-authorization
model. Replaced by the direct-execute model so a Circle Agent Wallet (a smart
account) can be the agent.
