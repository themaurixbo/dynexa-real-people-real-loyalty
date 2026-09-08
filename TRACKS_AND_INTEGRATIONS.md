# Tracks and integrations

Submitting for: **Arc**, **Privy**, **World**.

## Prize statements (as submitted on ETHGlobal)

### Arc — Best Agentic Economy Application

> We at DYNEXA use a Circle Agent Wallet to manage rewards and settle them in
> USDC on Arc testnet, calling our CampaignTreasury and GiftToken contracts
> through Circle CLI. It also pays a verifier agent 0.001 USDC per evidence
> check, while the smart contracts enforce transaction and campaign budget
> limits.

Code: `apps/api/src/agent/signer.ts` (Circle CLI `wallet execute`),
`apps/api/src/agent/verifier.ts` (agent-to-agent payment),
`packages/contracts/src/CampaignTreasury.sol`.

Ease of use: 7/10.

> Circle Agent Wallets were easy to integrate through CLI, but we found a few
> limitations on Arc testnet. It seems Foundry could not simulate USDC transfers,
> only one Arc agent wallet was available, spending limits worked only on
> mainnet, reverted transactions returned generic errors, and tuple parameters
> were unclear, so we used cast/viem for live transactions and simplified our
> contract functions.

### Privy — Best Financial Flow / Best B2B Financial Product

> We use Privy to create an embedded wallet when users sign in with email or
> phone, letting them receive and view USDC rewards on Arc without seed phrases
> or MetaMask. For businesses, we are adding a Privy organization wallet with
> spending policies to fund campaigns securely without blockchain complexity.

Code: `apps/web/app/providers.tsx` (PrivyProvider, Arc custom chain,
`createOnLogin`), `apps/web/app/customer.tsx` (`usePrivy` / `useWallets`).

Ease of use: 8/10.

> Privy's defineChain, defaultChain and supportedChains made the Arc integration
> simple and worked without problems. The main challenge was finding the correct
> createOnLogin configuration and understanding which wallet actions and server
> controls are available for these custom chains. I think a better quickstart
> guide is missing.

### World — Selfie Check

> Before a user receives their first reward, DYNEXA uses World Selfie Check to
> confirm they are a unique real person and prevent multiple accounts from
> bypassing campaign limits. It is used only for fairness and fraud prevention —
> not as KYC — and we are currently connecting the live proof flow using World's
> staging environment and simulator.

Code: `apps/api/src/agent/reward-agent.ts` (verification gate, nullifier),
`apps/api/src/db/schema.ts` (`world_verifications`, `UNIQUE(action, nullifier)`).

Ease of use: 7/10.

> A self-service staging option in the Developer Portal would help hackathon
> teams start faster. Clearer documentation covering setup, test users, proof
> formats, and staging versus production would also reduce trial and error.

## Requirement → evidence

| Requirement | Where | Evidence |
|---|---|---|
| Arc testnet transaction | `packages/contracts` deployed | `docs/DEPLOYMENTS.md` — factory `0xD6854881284ffa154f92a9b9325Ee09774370e91` |
| Campaign treasury with limits | `CampaignTreasury.sol` | `test/CampaignTreasury.t.sol` (11 tests) + live payout tx `0xf47408889354b52b44b201ab86f59efc4643c65a52a25f3eaf4d04cc30813c2d` |
| Autonomous agent spends USDC | `apps/api/src/agent` | Circle Agent Wallet executes payout via CLI |
| Agent controlled — over-limit rejected | `CampaignTreasury.payout` | `OverPerTxLimit` revert; Circle refuses to broadcast |
| Agent-to-agent USDC payment | `verifier.ts` | tx `0xc8c4eeb627b367c81ef50ebd177709bf1169dc70517bea11e1cee0d312b22d83` |
| GiftToken mint + redeem, double-redeem blocked | `GiftToken.sol` | `test/GiftToken.t.sol` (8 tests); mint `0x1007fc5e…`, redeem `0x15cdb5bf…` |
| Privy embedded consumer wallet on Arc | `apps/web/app/providers.tsx` | login → wallet, no seed phrase |
| World proof-of-person before first reward | `reward-agent.ts` + schema | nullifier stored `UNIQUE(action, nullifier)`, replay blocked |
| Deterministic policy engine | `apps/api/src/agent/policy.ts` | 8 checks, gates the payout |
| AI never sets the amount | `apps/api/src/agent/verifier.ts` | returns `{valid, reason}` only |

## Status

Contracts, the autonomous agent, GiftToken, the Privy consumer wallet and the
web app are done and verified on Arc testnet. Still connecting: the live World
Selfie Check proof exchange, and the Privy business organization wallet + policy.
