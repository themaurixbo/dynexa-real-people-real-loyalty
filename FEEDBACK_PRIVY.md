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
- **Server wallets are limited to a preset chain list.** This was the real
  blocker. Embedded wallets work on Arc via `defineChain`, but a **server
  wallet** created via `walletApi.createWallet` cannot transact on Arc: every
  `walletApi.ethereum.sendTransaction({ caip2: "eip155:5042002", ... })` returns
  `App is not authorized to transact on chain eip155:5042002`. The dashboard
  Assets page lists the supported chains (Ethereum, Base, Arbitrum, Polygon,
  Solana, Tron, Tempo) and there is no way to add a custom EVM chain for server
  wallets — App settings has nothing, Wallet infrastructure → Advanced (both the
  Smart wallets and More tabs) has nothing, and "Add custom asset" only affects
  which tokens show in the dashboard, not which chains the API will sign for. So
  we can attach a spending policy to the server wallet, but the actual on-Arc
  treasury funding has to go through the embedded wallet or a direct key. A
  dashboard toggle to authorize an app for a custom EVM chain (or docs stating
  server wallets are preset-chains-only) would have saved a lot of time.
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
