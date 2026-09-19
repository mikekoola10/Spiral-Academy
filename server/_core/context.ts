import { COOKIE_NAME } from "@shared/const";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import { getSessionUser } from "./localAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function getSessionToken(req: CreateExpressContextOptions["req"]): string | null {
  const header = req.headers?.cookie;
  if (typeof header !== "string" || header.length === 0) return null;
  const parsed = parseCookieHeader(header);
  const value = parsed[COOKIE_NAME];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await getSessionUser(getSessionToken(opts.req));
  } catch (error) {
    // Authentication is optional for public procedures.
    console.warn("[Auth] Session lookup failed", String(error));
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
