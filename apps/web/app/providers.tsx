"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { defineChain } from "viem";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  // Public identifier; env var overrides for other environments.
  const appId =
    process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "cmtru42ak00bs0cjmrspktdoy";

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "sms", "google"],
        appearance: { theme: "dark", accentColor: "#D18CFF" },
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
