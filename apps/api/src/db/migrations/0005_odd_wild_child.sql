CREATE TYPE "public"."p2p_transfer_kind" AS ENUM('usdc', 'gift');--> statement-breakpoint
ALTER TABLE "p2p_transfers" ALTER COLUMN "amount_usdc" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "p2p_transfers" ADD COLUMN "kind" "p2p_transfer_kind" DEFAULT 'usdc' NOT NULL;--> statement-breakpoint
ALTER TABLE "p2p_transfers" ADD COLUMN "to_contact" text;--> statement-breakpoint
ALTER TABLE "p2p_transfers" ADD COLUMN "gift_token_id" bigint;--> statement-breakpoint
ALTER TABLE "p2p_transfers" ADD COLUMN "gift_issuance_id" uuid;