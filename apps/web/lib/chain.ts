import { createPublicClient, defineChain, formatUnits, http } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});

const USDC = "0x3600000000000000000000000000000000000000" as const;
const client = createPublicClient({ chain: arcTestnet, transport: http() });

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
