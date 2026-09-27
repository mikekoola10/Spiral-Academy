export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  // Comma-separated emails that are granted the admin role on sign-up/sign-in.
  adminEmails: process.env.ADMIN_EMAILS ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Resend (transactional email, e.g. password resets).
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  // Must be a verified sender in Resend. Until a domain is verified, use
  // "onboarding@resend.dev" (delivers only to the Resend account owner).
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
  // Public base URL used to build links in emails. Falls back to the request origin.
  appUrl: process.env.APP_URL ?? "",
};
