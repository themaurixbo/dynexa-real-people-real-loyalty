CREATE TYPE "public"."p2p_transfer_status" AS ENUM('pending', 'claimed', 'canceled');--> statement-breakpoint
CREATE TABLE "p2p_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"from_user_id" uuid,
	"from_address" text NOT NULL,
	"to_user_id" uuid,
	"to_address" text,
	"amount_usdc" numeric(20, 6) NOT NULL,
	"note" text,
	"status" "p2p_transfer_status" DEFAULT 'pending' NOT NULL,
	"from_tx_hash" text NOT NULL,
	"to_tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "p2p_transfers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "p2p_transfers" ADD CONSTRAINT "p2p_transfers_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p2p_transfers" ADD CONSTRAINT "p2p_transfers_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;