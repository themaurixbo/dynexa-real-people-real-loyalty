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
6. Arc: add it as a custom chain in **Configuration → Chains** (id `5042002`,
   RPC `https://rpc.testnet.arc.network`, symbol `USDC`, explorer
   `https://testnet.arcscan.app`) so Privy allows wallet actions on it. The app
   side also defines it in `packages/config/src/arc.ts`.

## Arc

Nothing to sign up for — Arc is a testnet chain. The only manual step is funding
the deployer wallet with testnet USDC from https://faucet.circle.com (USDC is the
gas token). The chain config already lives in `packages/config/src/arc.ts`.

## 2. World

Only the **World ID verification** flow is needed — not a published Mini App.
The "Availability / Localised content / Showcase images / Review" wizard is the
Mini App store listing; skip it.

1. Sign in at https://developer.world.org.
2. Create an app — `DYNEXA`. Copy the **App ID** → `WORLD_APP_ID`.
3. **World ID Configuration**: note the **RP ID** (`WORLD_RP_ID`) and the
   **RP signing key private key** (`WORLD_RP_SIGNING_KEY`) — shown once, backend
   secret, never sent to the client. If World asked for a signer *address*
   instead, that address' key is what signs RP requests (`WORLD_SIGNER_ADDRESS`).
4. Create an **Incognito Action**: id `verify-human-welcome`, environment
   **staging** (works with the World ID Simulator; production needs real
   devices). → `WORLD_ACTION_ID`, `WORLD_ENVIRONMENT=staging`.
5. The Developer Portal **API key** (`WORLD_API_KEY`) is for the portal's
   management API, separate from the RP signing key. Still a secret.
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
