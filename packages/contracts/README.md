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

## Deploy to Arc testnet

Needs `DEPLOYER_PRIVATE_KEY` and `ARC_RPC_URL` in the environment. The deployer
wallet needs USDC on Arc for gas (faucet: https://faucet.circle.com).

```
forge script script/DeployFactory.s.sol --rpc-url "$ARC_RPC_URL" --broadcast
```

On Arc, USDC is the native gas token at `0x3600000000000000000000000000000000000000`
and is passed as the `usdc` address when creating a campaign. See `SPIKES.md` for
the open question about the native-vs-ERC20 interface.
