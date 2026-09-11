CREATE TYPE "public"."campaign_category" AS ENUM('shopping', 'food', 'events');--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"referrer_user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_links_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "category" "campaign_category" DEFAULT 'shopping' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "reference_images" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "referred_by_link_id" uuid;--> statement-breakpoint
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;