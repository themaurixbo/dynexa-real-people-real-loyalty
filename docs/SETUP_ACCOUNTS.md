# Account setup

What to create by hand before the integrations can run. Put every value in the
local `.env` (never commit it).

## 1. Privy

1. Sign up at https://dashboard.privy.io.
2. Create an app — one per environment. Start with `DYNEXA dev`.
3. **Configuration → App settings → Basics**: copy the **App ID** (public) and
   generate the **App Secret** (backend only — Privy does not store it, a lost
   secret has to be regenerated).
   - `App ID` → `PRIVY_APP_ID` and `NEXT_PUBLIC_PRIVY_APP_ID`
   - `App Secret` → `PRIVY_APP_SECRET`
4. **Wallets / Embedded wallets**: turn on embedded wallets, creation "on login".
   This is the consumer wallet.
5. **Server wallets**: create an **authorization key pair** for backend wallet
   actions. Privy keeps the public key; the private key goes to
   `PRIVY_AUTHORIZATION_KEY`. This key is what signs the agent payout and what
   the spending **policy** is attached to (per-tx cap = 5 USDC → our Use Case 6).
6. Arc is added in code (`packages/config/src/arc.ts`), not the dashboard. If the
   dashboard asks to allowlist an RPC, use chain id `5042002` /
   `https://rpc.testnet.arc.network`.

## 2. World

1. Sign in at https://developer.world.org.
2. Create an app — `DYNEXA`. Copy the **app_id** → `WORLD_APP_ID`.
3. Create an **action**: id `verify-human-welcome`. Keep it in **staging** for
   now (staging works with the World ID Simulator; production needs real
   devices). → `WORLD_ACTION_ID`, `WORLD_ENVIRONMENT=staging`.
4. In the app's sign-in / API section, note the **rp_id** (`WORLD_RP_ID`) and
   generate the **RP signing key** (`WORLD_RP_SIGNING_KEY`) — backend secret,
   never sent to the client.
5. **Selfie Check** is Beta and gated by a per-app feature flag. Check whether
   the Selfie Check credential is available for the app. If not, request access
   through the hackathon's World contact / sponsor channel.
   - Fallback until then: a plain Incognito Action (Proof of Human / device
     uniqueness) against staging. Same backend flow, same nullifier handling —
     only the credential preset changes.

## 3. LLM provider

OpenAI API key → `OPENAI_API_KEY`, `AI_PROVIDER=openai`. A key used in a chat or
shared anywhere should be rotated at https://platform.openai.com/api-keys.

## 4. Contract deployer

A funded wallet to deploy to Arc testnet: private key → `DEPLOYER_PRIVATE_KEY`,
then fund it with testnet USDC from https://faucet.circle.com (USDC is the gas
token on Arc). Use a throwaway key, not a personal wallet.
