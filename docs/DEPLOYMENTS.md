# Deployments

## Arc testnet (chain 5042002)

Explorer: https://testnet.arcscan.app

| Contract | Address |
|---|---|
| CampaignTreasuryFactory | `0x2FED0F2055c3EF6fAf20aF1b433f2a4Df11Cd6DC` |

### Verified end to end on 2026-09-07

Demo campaign treasury `0xF827C0EdED9C2Bb6Ff3b21019428B15AaD1fa83F`
(per-tx 5 USDC, total 20 USDC).

| Step | Tx |
|---|---|
| Deploy factory | `0x5167d8cfe90bcd440498f9c9fb42cfd62b20e1410ef52cb3c3af78c9c9ce2417` |
| Create campaign | `0xb1822a469c47696c32424b0a5f00c967e72f3ab55692c0072fa8b38faedb78db` |
| Fund 5 USDC | `0xdbb03768499bb4d0cde96bfa7e51e6698f7aa32f9f862b1077e7f9510adb04f9` |
| Payout 1 USDC (signed) | `0xc80025e8a9bce01e51b70756b7cb93044bf6d874f1f041d10d3772a774ee45d9` |

Over-limit payout (6 USDC vs 5 per-tx) reverts with `OverPerTxLimit`.

USDC on Arc (`0x3600000000000000000000000000000000000000`) works through the
standard ERC-20 interface — `approve` + `transferFrom` in the treasury behave as
expected. `forge script` can't simulate the native USDC precompile locally, so
live scripts use `cast send` / viem against the RPC.
