import { PrivyClient } from "@privy-io/server-auth";
import { encodeFunctionData } from "viem";
import { arc, erc20Abi, usdc } from "./chain.js";
import { env } from "./env.js";

/**
 * The business side runs on a Privy server wallet with a spending policy
 * attached (allowlist: USDC, the factory, the GiftToken contract). Privy blocks
 * anything outside the policy before it reaches the chain.
 */

const CAIP2 = `eip155:${arc.id}` as const;

let client: PrivyClient | null = null;
function privy() {
  if (!client) {
    client = new PrivyClient(env.privyAppId, env.privyAppSecret, {
      walletApi: env.privyAuthKey ? { authorizationPrivateKey: env.privyAuthKey } : undefined,
    });
  }
  return client;
}

export function privyConfigured() {
  return Boolean(env.privyAppId && env.privyAppSecret && env.privyAuthKey && env.privyPolicyId);
}

export async function createBusinessWallet(): Promise<{ id: string; address: string }> {
  const w = await privy().walletApi.createWallet({
    chainType: "ethereum",
    policyIds: [env.privyPolicyId],
  });
  return { id: w.id, address: w.address };
}

/** Send USDC from the business wallet to `to`. Policy allows only the USDC contract as recipient. */
export async function businessSendUsdc(
  walletId: string,
  to: `0x${string}`,
  amount: string,
): Promise<{ hash: string }> {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, usdc(amount)],
  });
  const res = await privy().walletApi.ethereum.sendTransaction({
    walletId,
    caip2: CAIP2,
    transaction: { to: env.arcUsdc, data, value: "0x0" },
  });
  return { hash: (res as { hash?: string; transactionHash?: string }).hash ?? "" };
}

/** Raw send from the business wallet — used to show the policy blocking a bad recipient. */
export async function businessSendRaw(
  walletId: string,
  to: `0x${string}`,
  valueWei: bigint,
): Promise<{ hash: string }> {
  const res = await privy().walletApi.ethereum.sendTransaction({
    walletId,
    caip2: CAIP2,
    transaction: { to, value: `0x${valueWei.toString(16)}` },
  });
  return { hash: (res as { hash?: string }).hash ?? "" };
}
