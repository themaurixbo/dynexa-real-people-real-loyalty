# Feedback — Privy

Based on integrating Privy into DYNEXA during ETHOnline 2026.

## What worked well

- `defineChain` + `defaultChain` / `supportedChains` for a custom EVM network
  (Arc) is clean and worked on the first try.
- Email / phone login → embedded wallet created on first sign-in is smooth and is
  exactly the "no seed phrase" onboarding we needed.
- `usePrivy()` / `useWallets()` are straightforward once you know the shape.

## What was hard

- **Finding the v3 embedded-wallet config shape.** It's
  `config.embeddedWallets.ethereum.createOnLogin`, nested one level deeper than
  most examples show. The setup page shows the object but not that exact key, so
  we lost time guessing.
- **Which controls need a paid tier.** The docs list policies, signers, key
  quorums and intents, but not clearly which are available on a free/hackathon
  account without commercial onboarding. We planned around a server wallet +
  authorization key and then weren't sure it was the right path for a custom
  chain.
- **Custom chain + server controls.** It's unclear which wallet actions and which
  server-side controls (policy enforcement, quorum) actually apply on a
  non-preset chain like Arc. A short compatibility note would help.
- The dashboard split (App settings → Basics → API keys for the secret; Wallet
  infrastructure → Keys and quorums for the authorization key; Wallet
  infrastructure → Policies for policies) is not obvious — everything wallet-ish
  reads like it should be in one place.

## Concrete suggestions

1. A single "custom EVM chain" quickstart: `defineChain` example, the exact
   `embeddedWallets.ethereum.createOnLogin` config, and a table of which wallet
   actions / server controls are supported on a custom chain.
2. In the dashboard, a one-line note on each control (policy, quorum, intent)
   saying whether it needs commercial onboarding.
3. Group the wallet-infrastructure settings (keys, quorums, policies, API keys)
   under one section, or cross-link them.
