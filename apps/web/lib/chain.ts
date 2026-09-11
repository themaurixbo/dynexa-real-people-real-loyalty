import { createPublicClient, defineChain, encodeFunctionData, formatUnits, http, parseUnits } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});

export const USDC = "0x3600000000000000000000000000000000000000" as const;
const client = createPublicClient({ chain: arcTestnet, transport: http() });

/** Calldata for a plain `transfer(to, amount)` call, used to send USDC ourselves. */
export function usdcTransferData(to: string, amountUsdc: string): `0x${string}` {
  return encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "transfer",
        stateMutability: "nonpayable",
        inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
        outputs: [{ type: "bool" }],
      },
    ],
    functionName: "transfer",
    args: [to as `0x${string}`, parseUnits(amountUsdc, 6)],
  });
}

/** Calldata for `safeTransferFrom`, used to send one of our own GiftTokens to the escrow. */
export function giftTransferData(from: string, to: string, tokenId: number): `0x${string}` {
  return encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "safeTransferFrom",
        stateMutability: "nonpayable",
        inputs: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "id", type: "uint256" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
        outputs: [],
      },
    ],
    functionName: "safeTransferFrom",
    args: [from as `0x${string}`, to as `0x${string}`, BigInt(tokenId), 1n, "0x"],
  });
}

export async function usdcBalance(address: string): Promise<string> {
  try {
    const v = await client.readContract({
      address: USDC,
      abi: [
        {
          type: "function",
          name: "balanceOf",
          stateMutability: "view",
          inputs: [{ name: "a", type: "address" }],
          outputs: [{ type: "uint256" }],
        },
      ],
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    return formatUnits(v as bigint, 6);
  } catch {
    return "0";
  }
}
