CREATE TABLE "pageViews" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" varchar(512) NOT NULL,
	"referrer" varchar(1024),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pageViews_createdAt_idx" ON "pageViews" ("createdAt");
--> statement-breakpoint
CREATE INDEX "pageViews_path_idx" ON "pageViews" ("path");
