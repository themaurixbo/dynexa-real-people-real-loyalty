# Integration spikes

Day 0 research before writing integration code. Checked against official docs on
2026-09-06. Anything marked "needs hands-on" is not confirmed until we run it.

## Arc testnet

Source: Circle's `circlefin/skills` repo (`plugins/circle/skills/use-arc`).

| Item | Value |
|---|---|
| Chain ID | 5042002 (0x4CEF52) |
| RPC | https://rpc.testnet.arc.network |
| Explorer | https://testnet.arcscan.app |
| USDC | `0x3600000000000000000000000000000000000000` |
| Faucet | https://faucet.circle.com |

Important: on Arc, USDC is the native gas token at a system address. It behaves as
an ERC-20 (6 decimals) and as native value (18 decimals) at the same time.

Implications for our contracts:
- `CampaignTreasury` holds and pays USDC. Decide whether it takes USDC through
  the ERC-20 interface at `0x3600…` or as native value. **Needs hands-on** on
  testnet before finalizing the contract.
- Every wallet that sends a tx (business, agent signer) needs USDC for gas, not a
  separate token. The faucet covers this.
- MockUSDC stays for local Foundry tests only.

Circle Agent Stack / Paymaster / App Kit: not covered in the Arc skill docs.
Treat as unavailable for now. These are P2 anyway.

## Privy on Arc

Source: Privy docs (configuring EVM networks, server wallets).

- Arc is not in `viem/chains`. Configure it with viem `defineChain` (chain ID,
  name, native currency, RPC, explorer) and pass it to `defaultChain` /
  `supportedChains`. Standard path for custom EVM chains.
- Embedded wallets: documented to support any EVM chain. Used for consumer login.
- Server wallets + policy engine: supports allowlisted contracts/recipients, max
  transfer amounts, and m-of-n approvals. This is our Use Case 6 control (cap the
  agent signer at 5 USDC per tx).

Open questions, **need hands-on**:
- Does the policy engine enforce correctly on a custom (non-preset) chain like Arc?
- Server-wallet signing + broadcast against the Arc RPC.
- Gas: the Privy wallet needs USDC on Arc to sign/send. Confirm funding flow.

Fallback if a Privy control does not work on Arc: use the closest generally
available control and document the limit. Do not mock the only Privy integration.

## World Selfie Check

Source: World developer docs (`docs.world.org/world-id`).

- Selfie Check is **Beta and gated by a per-app feature flag**. It must be
  enabled for our Developer Portal app; if it is not, we request access through a
  World contact. **This is the main blocker.** If it is not granted in time, fall
  back to Incognito Actions / Proof of Human against staging so the "verified
  human, no biometrics stored" flow still works.
- Flow: backend signs the request with the RP signing key → pass signature to the
  IDKit widget → widget uses the `selfieCheckLegacy` preset → POST the unmodified
  proof to `https://developer.world.org/api/v4/verify/{rp_id}`.
- Dev: staging action + World ID Simulator. Keep the client env and the action
  env matched.
- Replay: store `nullifier` with a `UNIQUE (action, nullifier)` constraint. Also
  block a second welcome claim from the same nullifier at the app layer.

## Blockers and actions

1. **World Selfie Check feature flag** — confirm it is on for our app, or request
   it. Have the Incognito Actions fallback ready.
2. **Arc USDC as native gas** — decide the treasury's USDC interface with a small
   test deploy before building the full contract.
3. Account setup still pending: Privy app, World Developer Portal app + staging
   action, LLM API key.
