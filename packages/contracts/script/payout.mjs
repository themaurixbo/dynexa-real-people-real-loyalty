// One-off: sign a RewardAuthorization and call payout on a live treasury.
// Usage: node script/payout.mjs <treasury> <customer> <amount6> [--dry]
import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  keccak256,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const [treasury, customer, amount] = process.argv.slice(2);
const dry = process.argv.includes("--dry");
const rpc = process.env.ARC_RPC_URL;
const pk = process.env.DEPLOYER_PRIVATE_KEY;
if (!treasury || !customer || !amount) throw new Error("args: <treasury> <customer> <amount6>");

const account = privateKeyToAccount(pk);
const chain = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
};
const pub = createPublicClient({ chain, transport: http(rpc) });
const wallet = createWalletClient({ account, chain, transport: http(rpc) });

const auth = {
  claimId: keccak256(toHex(`${Date.now()}-${customer}`)),
  customer,
  nullifierHash: keccak256(toHex("demo-nullifier")),
  receiptHash: keccak256(toHex("demo-receipt")),
  amount: BigInt(amount),
  giftTokenId: 1n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
};

const signature = await account.signTypedData({
  domain: {
    name: "DYNEXA CampaignTreasury",
    version: "1",
    chainId: 5042002,
    verifyingContract: treasury,
  },
  types: {
    RewardAuthorization: [
      { name: "claimId", type: "bytes32" },
      { name: "customer", type: "address" },
      { name: "nullifierHash", type: "bytes32" },
      { name: "receiptHash", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "giftTokenId", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "RewardAuthorization",
  message: auth,
});

const abi = [
  {
    type: "function",
    name: "payout",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "auth",
        type: "tuple",
        components: [
          { name: "claimId", type: "bytes32" },
          { name: "customer", type: "address" },
          { name: "nullifierHash", type: "bytes32" },
          { name: "receiptHash", type: "bytes32" },
          { name: "amount", type: "uint256" },
          { name: "giftTokenId", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
];

if (dry) {
  await pub.simulateContract({ address: treasury, abi, functionName: "payout", args: [auth, signature], account });
  console.log("dry run ok");
} else {
  const hash = await wallet.writeContract({ address: treasury, abi, functionName: "payout", args: [auth, signature] });
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  console.log("status", rcpt.status, "tx", hash);
}
