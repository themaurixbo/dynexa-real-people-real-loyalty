CREATE TYPE "public"."dynexa_ledger_reason" AS ENUM('claim_reward', 'pos_redeem');--> statement-breakpoint
CREATE TYPE "public"."pos_charge_status" AS ENUM('pending', 'paid', 'canceled');--> statement-breakpoint
ALTER TYPE "public"."reward_mode" ADD VALUE 'dynexa';--> statement-breakpoint
CREATE TABLE "dynexa_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"delta" numeric(20, 2) NOT NULL,
	"reason" "dynexa_ledger_reason" NOT NULL,
	"claim_id" uuid,
	"charge_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"code" text NOT NULL,
	"amount_dynexa" numeric(20, 2) NOT NULL,
	"status" "pos_charge_status" DEFAULT 'pending' NOT NULL,
	"payer_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "pos_charges_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "reward_percentage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "invoice_amount_bs" numeric(20, 2);--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "dynexa_amount" numeric(20, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dynexa_balance" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "dynexa_ledger" ADD CONSTRAINT "dynexa_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_charges" ADD CONSTRAINT "pos_charges_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_charges" ADD CONSTRAINT "pos_charges_payer_user_id_users_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;