import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash, type BinaryLike, type ScryptOptions } from "crypto";
import { promisify } from "util";
import { and, eq, gt, lt } from "drizzle-orm";
import { sessions, users, type User } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "./env";

// @types/node's scrypt overloads don't cover the options form cleanly,
// so type the promisified version explicitly.
const scryptAsync = promisify(scryptCb) as (
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

// ---- password hashing (scrypt, stdlib only) ----

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

/** Stored format: scrypt$N$r$p$salthex$hashhex */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = await scryptAsync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  let derived: Buffer;
  try {
    derived = await scryptAsync(password, salt, expected.length, {
      N: parseInt(nStr, 10),
      r: parseInt(rStr, 10),
      p: parseInt(pStr, 10),
      maxmem: 64 * 1024 * 1024,
    });
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

// ---- sessions (server-side, only token hashes stored) ----

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function requireDb() {
  return getDb().then(db => {
    if (!db) throw new Error("Database not available");
    return db;
  });
}

/** Create a session, returning the raw token to set as the cookie value. */
export async function createSession(userId: number): Promise<string> {
  const db = await requireDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
  });
  return token;
}

/** Resolve a raw session token to its user, or null if invalid/expired. */
export async function getSessionUser(token: string | undefined | null): Promise<User | null> {
  if (!token || typeof token !== "string" || token.length < 32) return null;
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0].user;
}

/** Delete a session by raw token. No-op when the token is missing/unknown. */
export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token || typeof token !== "string") return;
  const db = await getDb();
  if (!db) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Remove all expired sessions. Safe to call periodically. */
export async function purgeExpiredSessions(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

// ---- user helpers ----

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

function adminEmails(): Set<string> {
  return new Set(
    ENV.adminEmails
      .split(",")
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** Returns "admin" when the email is listed in ADMIN_EMAILS, else undefined. */
export function roleForEmail(email: string): "admin" | undefined {
  return adminEmails().has(normalizeEmail(email)) ? "admin" : undefined;
}

export async function createLocalUser(input: {
  email: string;
  password: string;
  name?: string | null;
}): Promise<User> {
  const db = await requireDb();
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const rows = await db
    .insert(users)
    .values({
      openId: `local:${randomBytes(16).toString("hex")}`,
      name: input.name?.trim() || null,
      email,
      passwordHash,
      loginMethod: "password",
      role: roleForEmail(email) ?? "user",
    })
    .returning();
  if (rows.length === 0) throw new Error("Failed to create user");
  return rows[0];
}

export async function touchLastSignedIn(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ lastSignedIn: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/** Promote to admin when the email is listed in ADMIN_EMAILS. Never demotes. */
export async function syncAdminRole(user: User): Promise<User> {
  if (user.role === "admin") return user;
  if (roleForEmail(user.email ?? "") !== "admin") return user;
  const db = await getDb();
  if (!db) return user;
  const rows = await db
    .update(users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();
  return rows.length > 0 ? rows[0] : user;
}

// ---- lightweight in-memory rate limiter (per process) ----

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Returns true when the caller is over the limit.
 * Note: in-memory only, so limits are per process. Put the app behind a
 * real rate limiter / WAF when running multiple instances in production.
 */
export function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // opportunistically clean up stale buckets
    if (buckets.size > 10000) {
      buckets.forEach((b, k) => {
        if (b.resetAt <= now) buckets.delete(k);
      });
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > maxAttempts;
}
