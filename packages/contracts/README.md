# @dynexa/contracts

Foundry project. Two contracts for P0:

- `CampaignTreasuryFactory` — deploys one treasury per campaign, indexed by business.
- `CampaignTreasury` — holds the campaign's USDC, pays out rewards authorized by
  the campaign's agent signer (EIP-712). Enforces per-tx and campaign-total
  limits on-chain, blocks replayed claims, pausable, closeable.

`GiftToken` (ERC-1155) comes in P1.

## Dev

```
forge build
forge test
```

`lib/` (forge-std, openzeppelin-contracts v5.1.0) is vendored in the repo.

## Arc testnet

Needs `DEPLOYER_PRIVATE_KEY` and `ARC_RPC_URL`. The deployer wallet needs USDC on
Arc for gas (faucet: https://faucet.circle.com). Deployed addresses are in
`docs/DEPLOYMENTS.md`.

Deploy the factory:

```
forge script script/DeployFactory.s.sol --rpc-url "$ARC_RPC_URL" --broadcast
```

`forge` can't simulate Arc's native USDC precompile locally, so anything that
touches USDC on a live network goes through `cast send` or the viem script:

```
pnpm payout <treasury> <customer> <amount6>       # signed RewardAuthorization
```

USDC (`0x3600…`) is passed as the `usdc` address when creating a campaign and
works through the standard ERC-20 interface.
