-- AI receptionist: lead capture + booking requests (additive; safe to run before deploy)
CREATE TABLE IF NOT EXISTS "receptionistLeads" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "email" varchar(320) NOT NULL,
  "interest" text,
  "message" text,
  "sourcePage" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "receptionistLeads_createdAt_idx" ON "receptionistLeads" ("createdAt");

CREATE TABLE IF NOT EXISTS "receptionistBookingRequests" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "email" varchar(320) NOT NULL,
  "preferredDay" text NOT NULL,
  "preferredTime" text NOT NULL,
  "topic" text,
  "status" text DEFAULT 'new' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "receptionistBookingRequests_createdAt_idx" ON "receptionistBookingRequests" ("createdAt");
CREATE INDEX IF NOT EXISTS "receptionistBookingRequests_status_idx" ON "receptionistBookingRequests" ("status");
