import { defineChain } from "viem";

/**
 * Arc testnet. Values confirmed from Circle's `circlefin/skills` repo
 * (2026-09-06) — see SPIKES.md. USDC is the native gas token, exposed at a
 * system address that also behaves as an ERC-20 (6 decimals).
 */
export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});
