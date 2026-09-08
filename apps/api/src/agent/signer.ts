import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  businessAccount,
  GIFT_MINT_SIG,
  giftTokenAbi,
  PAYOUT_SIG,
  publicClient,
  treasuryAbi,
  walletClient,
} from "../lib/chain.js";
import { env } from "../lib/env.js";

const run = promisify(execFile);

export interface RewardAuthorization {
  claimId: `0x${string}`;
  customer: `0x${string}`;
  nullifierHash: `0x${string}`;
  receiptHash: `0x${string}`;
  amount: bigint;
}

/**
 * The agent that pays rewards. Two implementations, same interface:
 *  - CircleAgentSigner: the agent's Circle Agent Wallet executes the on-chain
 *    payout through Circle CLI. This is the real one.
 *  - LocalKeySigner: the business key does it. Fallback for tests without Circle.
 */
export interface AgentSigner {
  address: `0x${string}`;
  payout(treasury: `0x${string}`, auth: RewardAuthorization): Promise<{ txHash: string }>;
  mintGift(
    giftToken: `0x${string}`,
    to: `0x${string}`,
    giftCampaignId: bigint,
    claimId: `0x${string}`,
  ): Promise<{ txHash: string }>;
}

class CircleAgentSigner implements AgentSigner {
  address = env.agentWallet;

  async payout(treasury: `0x${string}`, a: RewardAuthorization) {
    // circle wallet execute "payout(bytes32,address,bytes32,bytes32,uint256)" <args> ...
    const { stdout } = await run("circle", [
      "wallet",
      "execute",
      PAYOUT_SIG,
      a.claimId,
      a.customer,
      a.nullifierHash,
      a.receiptHash,
      a.amount.toString(),
      "--contract",
      treasury,
      "--address",
      this.address,
      "--chain",
      env.circleChain,
      "--output",
      "json",
    ]);
    return { txHash: parseTxHash(stdout) };
  }

  async mintGift(
    giftToken: `0x${string}`,
    to: `0x${string}`,
    giftCampaignId: bigint,
    claimId: `0x${string}`,
  ) {
    const { stdout } = await run("circle", [
      "wallet",
      "execute",
      GIFT_MINT_SIG,
      to,
      giftCampaignId.toString(),
      claimId,
      "--contract",
      giftToken,
      "--address",
      this.address,
      "--chain",
      env.circleChain,
      "--output",
      "json",
    ]);
    return { txHash: parseTxHash(stdout) };
  }
}

function parseTxHash(stdout: string): string {
  const res = JSON.parse(stdout);
  return (
    res?.data?.txHash ?? res?.data?.transactionHash ?? res?.data?.transactionId ?? "pending"
  );
}

class LocalKeySigner implements AgentSigner {
  address = businessAccount.address;

  async payout(treasury: `0x${string}`, a: RewardAuthorization) {
    const txHash = await walletClient.writeContract({
      address: treasury,
      abi: treasuryAbi,
      functionName: "payout",
      args: [a.claimId, a.customer, a.nullifierHash, a.receiptHash, a.amount],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return { txHash };
  }

  async mintGift(
    giftToken: `0x${string}`,
    to: `0x${string}`,
    giftCampaignId: bigint,
    claimId: `0x${string}`,
  ) {
    const txHash = await walletClient.writeContract({
      address: giftToken,
      abi: giftTokenAbi,
      functionName: "mint",
      args: [to, giftCampaignId, claimId],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return { txHash };
  }
}

export const agentSigner: AgentSigner =
  env.agentSigner === "circle" ? new CircleAgentSigner() : new LocalKeySigner();
