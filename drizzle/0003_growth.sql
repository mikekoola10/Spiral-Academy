CREATE TABLE "emailSubscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"source" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "emailSubscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "promoCodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"percentOff" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promoCodes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "courseId" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "promoCode" varchar(64);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "bundleCourseIds" text;
--> statement-breakpoint
INSERT INTO "promoCodes" ("code", "percentOff", "isActive") VALUES ('LAUNCH30', 30, true) ON CONFLICT ("code") DO NOTHING;
