# Architecture

DYNEXA pays USDC (or a branded GiftToken) to verified people who prove a real
purchase, under limits the business controls. An autonomous agent runs the
decision; it never chooses the amount and never holds an unbounded wallet.

## Actors and wallets

| Actor | Wallet | Why |
|---|---|---|
| Consumer | Privy embedded wallet (email/phone login, no seed phrase) | receives the reward |
| Business | Privy wallet with a spending policy | funds the campaign treasury, approves large payouts |
| Reward agent | Circle Agent Wallet `0x7b17…4164` | sends the USDC payout / mints the gift, autonomously |
| Verifier agent | Circle Agent Wallet `0x7fa4…49f4` | checks the evidence; paid 0.001 USDC per check by the reward agent |

## Reward flow

```mermaid
flowchart TD
    C[Consumer: submit evidence + campaign] --> API[DYNEXA backend]
    API --> S{Gather real signals}
    S --> S1[World: person verified? nullifier on file]
    S --> S2[Campaign: active, in dates, budget left]
    S --> S3[This human's prior claims < maxUsesPerUser]
    S --> S4[Receipt hash not used before]
    API --> V[Reward agent asks Verifier agent: is the evidence valid?]
    V -- Nanopayment: agent to agent USDC --> V
    V --> D{Deterministic policy gate}
    D -- any hard rule fails --> R[Reject: logged, reason shown]
    D -- amount > business threshold --> H[Needs business approval]
    D -- all pass --> SIGN[Reward agent's Circle Agent Wallet executes payout]
    SIGN --> PAY[CampaignTreasury.payout on Arc]
    PAY --> USDC[USDC to consumer wallet]
    PAY --> LOG[Audit: authorized by agent 0x...]
    H --> BIZ[Business approves in Business tab] --> SIGN
```

## Partner touchpoints

Where each partner is used and what we do at that point.

```mermaid
flowchart TD
    U[Consumer] --> P1
    B[Business] --> P3

    subgraph PRIVY [Privy - wallets]
      P1[Email/phone login -> embedded wallet, no seed phrase]
      P2[Wallet pointed at Arc as a custom EVM chain]
      P3[Business org wallet + spending policy - in progress]
    end
    subgraph WORLD [World - proof of person]
      W1[Selfie Check before the first reward; backend verifies the proof]
      W2[nullifier stored UNIQUE action,nullifier -> per-human reward limit]
    end
    subgraph CIRCLE [Circle Agent Stack - the agent]
      C1[Reward agent = Circle Agent Wallet, driven by Circle CLI]
      C2[Executes CampaignTreasury.payout on Arc]
      C3[Executes GiftToken.mint on Arc]
      C4[Pays the verifier agent 0.001 USDC per check]
      C5[Refuses to broadcast a call that would revert]
    end
    subgraph ARC [Arc - settlement]
      A1[USDC is the native gas token]
      A2[CampaignTreasury: per-tx + total-budget limits + replay guard, on-chain]
      A3[GiftToken ERC-1155: mint / redeem once / burn]
      A4[Business funds the treasury with USDC]
      A5[POS calls GiftToken.redeem -> burns the token]
    end

    P1 --> P2
    P2 -->|first reward| W1 --> W2
    U -->|submits evidence| V[Verifier agent - AI vision]
    C4 -.pays.-> V
    W2 --> POL[Deterministic policy gate - 8 checks]
    V --> POL
    POL -->|pass, USDC| C1 --> C2 --> A2 --> P2
    POL -->|pass, gift| C1 --> C3 --> A3
    POL -->|over the limit| C5 --> A2
    P3 --> A4 --> A2
    B --> A5 --> A3
```

| Point in the flow | Partner | What we do |
|---|---|---|
| Consumer sign-up / login | Privy | Email or phone login; Privy creates the embedded wallet, no seed phrase |
| Wallet on Arc | Privy + Arc | The embedded wallet is configured for Arc as a custom EVM chain (`defineChain`, `createOnLogin`) |
| Welcome gift | Circle + Arc | The reward agent (Circle Agent Wallet) mints a GiftToken on Arc on first login |
| First reward -> human check | World | Selfie Check; the backend verifies the proof and stores the nullifier |
| Anti-sybil | World | `UNIQUE(action, nullifier)` -> the "N per person" limit is counted against the verified human, not the account |
| Consumer submits evidence | our AI (gpt-4o-mini) | The verifier agent checks the photo and returns `{valid, reason}` — never an amount |
| Verifier agent paid | Circle + Arc | The reward agent pays 0.001 USDC per check (agent-to-agent, on Arc) |
| Rule validation | our policy engine | 8 checks against live campaign state before anything is signed |
| USDC payout | Circle + Arc | The Circle Agent Wallet executes `CampaignTreasury.payout()` on Arc -> USDC to the consumer's Privy wallet |
| Gift mint (gift campaigns) | Circle + Arc | The Circle Agent Wallet executes `GiftToken.mint()` on Arc |
| Business funds the campaign | Privy + Arc | The business wallet (Privy, with a policy) transfers USDC to the treasury on Arc |
| Over-limit attempt | Circle + Arc | Circle does not broadcast the tx and the contract reverts with `OverPerTxLimit` |
| POS redemption | Arc | The business calls `GiftToken.redeem()` on Arc; burns the token; a second attempt reverts |
| Settlement token | Arc | All value movement is in USDC, which on Arc is the native gas token |

## Why the agent is safe

Three independent limits, any one of them stops an over-payment:

1. **The AI never sees the amount.** It returns `{valid, reason}` on the evidence
   only. The amount is the campaign's fixed `rewardPerUser`.
2. **The deterministic policy engine.** Plain code, no AI. Checks the campaign
   state (budget, per-human count, duplicate receipt, dates) before anything is
   sent. A compromised or hallucinating verifier can't get past it.
3. **Circle Agent Wallet limits.** The agent's wallet has spending limits and an
   allowlist (mainnet); on testnet Circle still refuses to broadcast a call that
   would revert.
4. **The contract limits.** `CampaignTreasury` checks `msg.sender == agent`,
   enforces the per-transaction cap and the total campaign budget on-chain, and
   rejects a replayed claim id. Even a direct call from the agent can't overpay.

## Agent decision logic

Inputs, all real signals:

| Signal | Source |
|---|---|
| Person verified, unique | World Selfie Check nullifier |
| Evidence valid | Verifier agent (AI vision on the receipt / product photo) |
| Receipt not reused | `receipts.receipt_hash` unique |
| Campaign active, in dates, funded | campaign row + on-chain treasury balance |
| Prior claims by this human | count of `claims` for this nullifier |
| Amount within limits | campaign `max_per_tx`, `total_budget` |

Output: `pay` · `reject(reason)` · `needs_human_approval` (amount over the
business threshold).

## Circle products used

- **Arc** — settlement chain (testnet chain 5042002).
- **USDC** — the reward token; also the gas token on Arc.
- **Agent Stack / Agent Wallets** — the reward agent and verifier agent wallets,
  operated through Circle CLI, constrained by spending limits and allowlists.
- **Nanopayments** — the reward agent pays the verifier agent per evidence check
  (agent-to-agent USDC, sub-cent, gasless).
- **Paymaster** — (stretch) sponsors the consumer's gas on GiftToken redemption
  so the reward is not spent on fees.

## Stack

TypeScript monorepo. Next.js web app (Customer and Business tabs). Node backend
with the agents. PostgreSQL for the claim pipeline and audit trail. Foundry
contracts, viem for EVM calls.
