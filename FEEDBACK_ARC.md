# Feedback — Arc / Circle Agent Stack

Based on building DYNEXA on Arc testnet with Circle Agent Stack during ETHOnline 2026.

## What worked well

- **Circle Agent Wallets via the CLI** are great: no integration code, the agent
  operates the wallet with `circle wallet execute` / `transfer` from any
  framework. `circle wallet sign` / `execute` cover contract calls.
- Arc testnet config was easy to confirm from Circle's `circlefin/skills` repo
  (chain id, RPC, explorer, faucet).
- USDC as the native gas token is a genuinely nice UX property — the reward
  recipient never needs a second asset.
- The Circle faucet (`circle wallet fund --chain ARC-TESTNET`) is simple.

## What was hard / limitations found

1. **Foundry can't simulate Arc's native-USDC precompile.** Any `forge script`
   that touches USDC reverts (`StackUnderflow` inside the blocklist precompile at
   `0x1800…0001`). We kept the Foundry tests on a MockUSDC and moved every live
   step to `cast` / viem against the RPC. Worth a docs note with the workaround.
2. **Only one agent wallet on ARC-TESTNET.** Repeated `circle wallet create`
   silently created wallets on other chains (Base, Arbitrum, …) but never a
   second one on Arc, with no error. We wanted two agents (a reward agent and a
   verifier agent).
3. **`circle wallet limit` (spending policy) is mainnet-only.** On testnet you
   can't demo the Circle-enforced spend cap / allowlist, which is the strongest
   part of the "controlled agent" story. On testnet we rely on our policy engine
   + the contract's on-chain limits instead.
4. **Reverting calls return a generic error.** `circle wallet execute` on a call
   that would revert returns `ESTIMATION_ERROR` / `INTERNAL` with no revert
   reason. Surfacing the decoded revert (e.g. `OverPerTxLimit`) would help a lot.
5. **Struct / tuple parameters for `circle wallet execute` aren't documented.**
   We flattened our contract function to scalar params to be safe.
6. Arc mainnet was not available during the hackathon window, so "push to
   mainnet" could only be a readiness story, not a real deploy.

## Concrete suggestions

1. Document the Foundry / native-USDC-precompile limitation and the `cast`/viem
   workaround prominently in the Arc dev docs.
2. Make `circle wallet create` either create on Arc too, or return a clear error
   / prompt when it can't.
3. Bring `wallet limit` to testnet (even as a preview) so agent spending policies
   are demoable.
4. Decode and return the revert reason on `execute` estimation failures.
5. Document tuple/struct encoding for `circle wallet execute`.
