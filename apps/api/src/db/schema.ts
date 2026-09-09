import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * DYNEXA schema. Covers spec §10. USDC amounts are stored as numeric(20, 6)
 * strings — the on-chain source of truth is the contract; these rows are the
 * audit trail.
 */

const id = () => uuid("id").defaultRandom().primaryKey();
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const usdc = (name: string) => numeric(name, { precision: 20, scale: 6 });

export const memberRole = pgEnum("member_role", ["owner", "admin", "operator"]);
export const walletOwner = pgEnum("wallet_owner", ["user", "business", "campaign_agent"]);
export const campaignStatus = pgEnum("campaign_status", [
  "draft",
  "active",
  "paused",
  "closed",
]);
export const rewardType = pgEnum("reward_type", ["receipt", "selfie", "referral"]);
export const rewardMode = pgEnum("reward_mode", ["usdc", "gift"]);
export const claimStatus = pgEnum("claim_status", [
  "pending",
  "approved",
  "rejected",
  "paid",
  "failed",
]);
export const txStatus = pgEnum("tx_status", ["pending", "confirmed", "failed"]);
export const txKind = pgEnum("tx_kind", ["fund", "payout", "mint", "redeem", "close"]);
export const giftStatus = pgEnum("gift_status", ["minted", "redeemed", "expired"]);
export const redemptionStatus = pgEnum("redemption_status", ["success", "rejected"]);

// --- identity ---

export const businesses = pgTable("businesses", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  walletAddress: text("wallet_address"),
  privyWalletId: text("privy_wallet_id"),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  privyUserId: text("privy_user_id").notNull().unique(),
  email: text("email"),
  createdAt: createdAt(),
});

export const businessMembers = pgTable(
  "business_members",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: memberRole("role").notNull().default("operator"),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.businessId, t.userId)],
);

export const wallets = pgTable(
  "wallets",
  {
    id: id(),
    ownerType: walletOwner("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    address: text("address").notNull(),
    chainId: bigint("chain_id", { mode: "number" }).notNull(),
    provider: text("provider").notNull().default("privy"),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.address, t.chainId), index("wallets_owner_idx").on(t.ownerType, t.ownerId)],
);

// --- campaigns ---

export const campaigns = pgTable("campaigns", {
  id: id(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  name: text("name").notNull(),
  description: text("description"),
  status: campaignStatus("status").notNull().default("draft"),
  rewardType: rewardType("reward_type").notNull().default("receipt"),
  rewardMode: rewardMode("reward_mode").notNull().default("usdc"),
  treasuryAddress: text("treasury_address"),
  agentSignerAddress: text("agent_signer_address"),
  totalBudgetUsdc: usdc("total_budget_usdc").notNull(),
  rewardPerUserUsdc: usdc("reward_per_user_usdc").notNull(),
  maxPerTxUsdc: usdc("max_per_tx_usdc").notNull(),
  requiresApprovalAboveUsdc: usdc("requires_approval_above_usdc"),
  maxUsesPerHuman: bigint("max_uses_per_human", { mode: "number" }).notNull().default(1),
  maxParticipants: bigint("max_participants", { mode: "number" }),
  giftTokenId: bigint("gift_token_id", { mode: "number" }),
  qualifyCondition: text("qualify_condition"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// --- verification & proof of purchase ---

export const worldVerifications = pgTable(
  "world_verifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    nullifierHash: text("nullifier_hash").notNull(),
    credentialType: text("credential_type"),
    verifiedAt: createdAt(),
  },
  (t) => [unique("world_action_nullifier_uq").on(t.action, t.nullifierHash)],
);

export const receipts = pgTable(
  "receipts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    merchant: text("merchant"),
    amount: numeric("amount", { precision: 20, scale: 2 }),
    currency: text("currency"),
    category: text("category"),
    externalRef: text("external_ref"),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    receiptHash: text("receipt_hash").notNull().unique(),
    extracted: jsonb("extracted"),
    createdAt: createdAt(),
  },
  (t) => [index("receipts_user_campaign_idx").on(t.userId, t.campaignId)],
);

// --- claim pipeline ---

export const claims = pgTable(
  "claims",
  {
    id: id(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    receiptId: uuid("receipt_id").references(() => receipts.id),
    worldVerificationId: uuid("world_verification_id").references(() => worldVerifications.id),
    status: claimStatus("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    cashAmountUsdc: usdc("cash_amount_usdc"),
    giftTokenId: bigint("gift_token_id", { mode: "number" }),
    onchainClaimId: text("onchain_claim_id"),
    createdAt: createdAt(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [index("claims_campaign_user_idx").on(t.campaignId, t.userId)],
);

export const aiDecisions = pgTable("ai_decisions", {
  id: id(),
  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  provider: text("provider").notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output").notNull(),
  eligible: boolean("eligible").notNull(),
  proposedAmountUsdc: usdc("proposed_amount_usdc"),
  riskScore: numeric("risk_score", { precision: 5, scale: 4 }),
  reasonCodes: text("reason_codes").array(),
  humanExplanation: text("human_explanation"),
  fallbackUsed: boolean("fallback_used").notNull().default(false),
  createdAt: createdAt(),
});

export const policyResults = pgTable("policy_results", {
  id: id(),
  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  passed: boolean("passed").notNull(),
  checks: jsonb("checks").notNull(),
  failureReason: text("failure_reason"),
  createdAt: createdAt(),
});

// --- money & tokens ---

export const blockchainTransactions = pgTable("blockchain_transactions", {
  id: id(),
  chainId: bigint("chain_id", { mode: "number" }).notNull(),
  hash: text("hash").notNull().unique(),
  kind: txKind("kind").notNull(),
  status: txStatus("status").notNull().default("pending"),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  blockNumber: bigint("block_number", { mode: "number" }),
  raw: jsonb("raw"),
  createdAt: createdAt(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});

export const payouts = pgTable("payouts", {
  id: id(),
  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  toAddress: text("to_address").notNull(),
  amountUsdc: usdc("amount_usdc").notNull(),
  txId: uuid("tx_id").references(() => blockchainTransactions.id),
  status: txStatus("status").notNull().default("pending"),
  createdAt: createdAt(),
});

export const giftTokenIssuances = pgTable("gift_token_issuances", {
  id: id(),
  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  tokenId: bigint("token_id", { mode: "number" }).notNull(),
  toAddress: text("to_address").notNull(),
  metadataUri: text("metadata_uri"),
  redemptionCode: text("redemption_code").unique(),
  txId: uuid("tx_id").references(() => blockchainTransactions.id),
  status: giftStatus("status").notNull().default("minted"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const redemptions = pgTable("redemptions", {
  id: id(),
  issuanceId: uuid("issuance_id")
    .notNull()
    .references(() => giftTokenIssuances.id),
  operatorUserId: uuid("operator_user_id").references(() => users.id),
  code: text("code").notNull(),
  status: redemptionStatus("status").notNull(),
  reason: text("reason"),
  txId: uuid("tx_id").references(() => blockchainTransactions.id),
  createdAt: createdAt(),
});

// --- audit & idempotency ---

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    subjectType: text("subject_type"),
    subjectId: text("subject_id"),
    data: jsonb("data"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_subject_idx").on(t.subjectType, t.subjectId)],
);

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  scope: text("scope").notNull(),
  response: jsonb("response"),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).default(
    sql`now() + interval '24 hours'`,
  ),
});

// --- relations (query convenience only) ---

export const businessRelations = relations(businesses, ({ many }) => ({
  members: many(businessMembers),
  campaigns: many(campaigns),
}));

export const campaignRelations = relations(campaigns, ({ one, many }) => ({
  business: one(businesses, {
    fields: [campaigns.businessId],
    references: [businesses.id],
  }),
  claims: many(claims),
}));

export const claimRelations = relations(claims, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [claims.campaignId], references: [campaigns.id] }),
  user: one(users, { fields: [claims.userId], references: [users.id] }),
  receipt: one(receipts, { fields: [claims.receiptId], references: [receipts.id] }),
  aiDecisions: many(aiDecisions),
  policyResults: many(policyResults),
  payouts: many(payouts),
}));
