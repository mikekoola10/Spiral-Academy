import { ENV } from "./env";

// Minimal Resend client (stdlib fetch only). Sends the password-reset email.
// Returns true when Resend accepted the message, false otherwise — callers
// must never leak send failures to the client (prevents email enumeration).

interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<SendResult> {
  if (!ENV.resendApiKey) {
    console.error("[email] RESEND_API_KEY is not configured; skipping password-reset email.");
    return { ok: false, error: "email not configured" };
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #6d28d9;">Reset your Spiral Academy password</h2>
      <p>Someone requested a password reset for this email address. If that was you, click the button below. The link expires in 1 hour and can only be used once.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background: #6d28d9; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Reset my password</a>
      </p>
      <p style="color: #666; font-size: 13px;">Or copy this link into your browser:<br/>${resetUrl}</p>
      <p style="color: #666; font-size: 13px;">Didn't request this? You can safely ignore this email — your password won't change.</p>
    </div>
  `.trim();

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Spiral Academy <${ENV.resendFromEmail}>`,
        to: [to],
        subject: "Reset your Spiral Academy password",
        html,
      }),
    });
    const data = (await resp.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!resp.ok) {
      console.error("[email] Resend rejected the message:", data.message ?? resp.status);
      return { ok: false, error: data.message ?? `HTTP ${resp.status}` };
    }
    return { ok: true, messageId: data.id };
  } catch (err) {
    console.error("[email] Resend request failed:", err instanceof Error ? err.message : err);
    return { ok: false, error: "send failed" };
  }
}
