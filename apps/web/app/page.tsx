"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, formatUnits, http } from "viem";

const USDC = "0x3600000000000000000000000000000000000000" as const;
const ERC20_BALANCE_OF = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const client = createPublicClient({
  transport: http("https://rpc.testnet.arc.network"),
});

export default function Home() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const wallet = useMemo(
    () => wallets.find((w) => w.walletClientType === "privy") ?? wallets[0],
    [wallets],
  );

  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet?.address) return;
    let live = true;
    client
      .readContract({
        address: USDC,
        abi: ERC20_BALANCE_OF,
        functionName: "balanceOf",
        args: [wallet.address as `0x${string}`],
      })
      .then((v) => live && setBalance(formatUnits(v as bigint, 6)))
      .catch(() => live && setBalance(null));
    return () => {
      live = false;
    };
  }, [wallet?.address]);

  if (!ready) {
    return <Centered>Loading…</Centered>;
  }

  if (!authenticated) {
    return (
      <Centered>
        <div className="w-full max-w-sm text-center">
          <h1 className="text-3xl font-bold tracking-tight">DYNEXA</h1>
          <p className="mt-3 text-sm text-white/60">
            Real rewards for real, human-verified people. No wallet setup, no seed
            phrase.
          </p>
          <button
            onClick={login}
            className="mt-8 w-full rounded-xl bg-gradient-to-br from-[#D18CFF] to-[#FF2FE0] px-4 py-3 font-semibold text-[#0B0A10]"
          >
            Continue with email or phone
          </button>
          <p className="mt-4 text-xs text-white/40">
            Your wallet is created automatically and secured by Privy.
          </p>
        </div>
      </Centered>
    );
  }

  const account =
    user?.email?.address ?? user?.phone?.number ?? user?.id ?? "account";

  return (
    <Centered>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/50">Signed in as</p>
            <p className="text-sm font-medium">{account}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-white/50 underline underline-offset-2"
          >
            Sign out
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-white/60">
              Wallet active · Arc Testnet
            </span>
          </div>
          <p className="mt-4 text-xs text-white/50">Available balance</p>
          <p className="mt-1 text-3xl font-semibold">
            {balance ?? "—"}{" "}
            <span className="text-base font-normal text-white/50">USDC</span>
          </p>
          <p className="mt-4 break-all font-mono text-[11px] text-white/40">
            {wallet?.address ?? "creating wallet…"}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-white/50">Available reward</p>
          <p className="mt-1 font-semibold">Verified Human Welcome</p>
          <p className="mt-1 text-sm text-white/60">
            Verify you are a real person and scan a receipt to receive 5 USDC and
            a free gift from Vacafría.
          </p>
          <button
            disabled
            className="mt-4 w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white/40"
          >
            Verify with World — coming next
          </button>
        </div>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      {children}
    </main>
  );
}
