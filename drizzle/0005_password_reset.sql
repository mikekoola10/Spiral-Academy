-- Password reset tokens (additive; safe to run before deploy)
CREATE TABLE IF NOT EXISTS "passwordResets" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tokenHash" varchar(64) NOT NULL UNIQUE,
  "expiresAt" timestamp NOT NULL,
  "usedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "passwordResets_tokenHash_idx" ON "passwordResets" ("tokenHash");
CREATE INDEX IF NOT EXISTS "passwordResets_userId_idx" ON "passwordResets" ("userId");
