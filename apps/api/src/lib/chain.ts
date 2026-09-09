import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "./env.js";

export const arc = defineChain({
  id: env.arcChainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [env.arcRpcUrl] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});

export const publicClient = createPublicClient({ chain: arc, transport: http(env.arcRpcUrl) });

/** The business: creates campaigns, funds treasuries, pause/close. */
export const businessAccount = privateKeyToAccount(env.businessKey);
export const walletClient = createWalletClient({
  account: businessAccount,
  chain: arc,
  transport: http(env.arcRpcUrl),
});

export const usdc = (n: string) => parseUnits(n, 6);
export const fromUsdc = (n: bigint) => formatUnits(n, 6);

export const factoryAbi = [
  {
    type: "function",
    name: "createCampaign",
    stateMutability: "nonpayable",
    inputs: [
      { name: "usdc", type: "address" },
      { name: "agentSigner", type: "address" },
      { name: "perTxLimit", type: "uint256" },
      { name: "campaignTotalLimit", type: "uint256" },
    ],
    outputs: [{ name: "treasury", type: "address" }],
  },
] as const;

export const PAYOUT_SIG = "payout(bytes32,address,bytes32,bytes32,uint256)" as const;

export const treasuryAbi = [
  {
    type: "function",
    name: "payout",
    stateMutability: "nonpayable",
    inputs: [
      { name: "claimId", type: "bytes32" },
      { name: "customer", type: "address" },
      { name: "nullifierHash", type: "bytes32" },
      { name: "receiptHash", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  { type: "function", name: "fund", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "close", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "setPaused", stateMutability: "nonpayable", inputs: [{ name: "value", type: "bool" }], outputs: [] },
  { type: "function", name: "balance", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalPaidOut", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "agent", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "claimUsed", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "bool" }] },
] as const;

export const GIFT_MINT_SIG = "mint(address,uint256,bytes32)" as const;
export const GIFT_REDEEM_SIG = "redeem(uint256,address)" as const;

export const giftTokenAbi = [
  {
    type: "function",
    name: "registerGiftCampaign",
    stateMutability: "nonpayable",
    inputs: [
      { name: "metadataUri", type: "string" },
      { name: "expiry", type: "uint64" },
      { name: "transferable", type: "bool" },
      { name: "redeemer", type: "address" },
    ],
    outputs: [{ name: "campaignId", type: "uint256" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "campaignId", type: "uint256" },
      { name: "claimId", type: "bytes32" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "holder", type: "address" },
    ],
    outputs: [],
  },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }, { name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "redeemed", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "bool" }] },
  {
    type: "event",
    name: "GiftMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "campaignId", type: "uint256", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "claimId", type: "bytes32", indexed: false },
    ],
  },
] as const;

/** Business action: register a gift campaign on the GiftToken contract. */
export async function registerGiftCampaign(p: {
  giftToken: `0x${string}`;
  metadataUri: string;
  expiry: bigint;
  transferable: boolean;
  redeemer: `0x${string}`;
}) {
  const { request, result } = await publicClient.simulateContract({
    address: p.giftToken,
    abi: giftTokenAbi,
    functionName: "registerGiftCampaign",
    args: [p.metadataUri, p.expiry, p.transferable, p.redeemer],
    account: businessAccount,
  });
  const txHash = await send(walletClient.writeContract(request));
  return { giftCampaignId: result as bigint, txHash };
}

/** Business (redeemer) action: redeem a gift at the point of sale. */
export async function redeemGift(giftToken: `0x${string}`, tokenId: bigint, holder: `0x${string}`) {
  return send(
    walletClient.writeContract({
      address: giftToken,
      abi: giftTokenAbi,
      functionName: "redeem",
      args: [tokenId, holder],
    }),
  );
}

export const erc20Abi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export async function treasuryBalance(treasury: `0x${string}`) {
  return publicClient.readContract({ address: treasury, abi: treasuryAbi, functionName: "balance" });
}

async function send(hash: Promise<`0x${string}`>) {
  const h = await hash;
  await publicClient.waitForTransactionReceipt({ hash: h });
  return h;
}

/** Business action: deploy a campaign treasury via the factory. */
export async function createCampaignOnChain(p: {
  factory: `0x${string}`;
  agent: `0x${string}`;
  perTxLimit: bigint;
  campaignTotalLimit: bigint;
}) {
  const { request, result } = await publicClient.simulateContract({
    address: p.factory,
    abi: factoryAbi,
    functionName: "createCampaign",
    args: [env.arcUsdc, p.agent, p.perTxLimit, p.campaignTotalLimit],
    account: businessAccount,
  });
  const txHash = await send(walletClient.writeContract(request));
  return { treasury: result as `0x${string}`, txHash };
}

/** Business action: pull USDC into the campaign treasury. */
export async function fundTreasury(treasury: `0x${string}`, amount: bigint) {
  await send(
    walletClient.writeContract({
      address: env.arcUsdc,
      abi: erc20Abi,
      functionName: "approve",
      args: [treasury, amount],
    }),
  );
  return send(
    walletClient.writeContract({ address: treasury, abi: treasuryAbi, functionName: "fund", args: [amount] }),
  );
}

export async function setTreasuryPaused(treasury: `0x${string}`, value: boolean) {
  return send(
    walletClient.writeContract({ address: treasury, abi: treasuryAbi, functionName: "setPaused", args: [value] }),
  );
}

export async function closeTreasury(treasury: `0x${string}`) {
  return send(
    walletClient.writeContract({ address: treasury, abi: treasuryAbi, functionName: "close", args: [] }),
  );
}
