CREATE TYPE "public"."reward_mode" AS ENUM('usdc', 'gift');--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "reward_mode" "reward_mode" DEFAULT 'usdc' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "max_uses_per_human" bigint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "gift_token_id" bigint;