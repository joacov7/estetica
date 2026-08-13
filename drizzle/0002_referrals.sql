ALTER TABLE "clients" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "referred_by_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_referred_by_id_clients_id_fk" FOREIGN KEY ("referred_by_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_org_refcode_idx" ON "clients" USING btree ("organization_id","referral_code");--> statement-breakpoint
-- Backfill a referral code for existing clients.
UPDATE "clients" SET "referral_code" = upper(substr(md5(random()::text || "id"::text), 1, 6)) WHERE "referral_code" IS NULL;