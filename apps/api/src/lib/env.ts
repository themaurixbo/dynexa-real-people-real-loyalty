import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

// The one .env lives at the repo root.
const root = resolve(import.meta.dirname, "../../../..");
const envPath = resolve(root, ".env");
if (existsSync(envPath)) config({ path: envPath });

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: req("DATABASE_URL"),
  arcRpcUrl: process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network",
  arcChainId: Number(process.env.ARC_CHAIN_ID ?? 5042002),
  arcUsdc: (process.env.ARC_USDC_ADDRESS ??
    "0x3600000000000000000000000000000000000000") as `0x${string}`,
  factoryAddress: process.env.FACTORY_ADDRESS as `0x${string}` | undefined,
  giftTokenAddress: process.env.GIFT_TOKEN_ADDRESS as `0x${string}` | undefined,
  verifierWallet: (process.env.VERIFIER_WALLET_ADDRESS ?? "") as `0x${string}`,
  // The business key: creates campaigns, funds treasuries. Day 3 -> Privy wallet.
  businessKey: req("DEPLOYER_PRIVATE_KEY") as `0x${string}`,
  // The agent that signs payouts. "circle" = Circle Agent Wallet via CLI,
  // "local" = fall back to the business key (for tests without Circle).
  agentSigner: (process.env.AGENT_SIGNER ?? "circle") as "circle" | "local",
  agentWallet: (process.env.AGENT_WALLET_ADDRESS ?? "") as `0x${string}`,
  circleChain: process.env.CIRCLE_CHAIN ?? "ARC-TESTNET",
  aiProvider: process.env.AI_PROVIDER ?? "openai",
  openaiKey: process.env.OPENAI_API_KEY ?? "",
};
