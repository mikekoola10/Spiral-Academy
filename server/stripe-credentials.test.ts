import { describe, expect, it } from "vitest";
import Stripe from "stripe";

describe("Stripe Credentials Verification", () => {
  it("should successfully connect to Stripe with provided credentials", async () => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    const stripe = new Stripe(secretKey, { apiVersion: '2025-12-15.clover' });
    
    // Verify we can make a basic API call
    const balance = await stripe.balance.retrieve();
    
    expect(balance).toBeDefined();
    expect(balance.object).toBe("balance");
    expect(Array.isArray(balance.available)).toBe(true);
    expect(Array.isArray(balance.pending)).toBe(true);
  });

  it("should be able to list payment methods", async () => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    const stripe = new Stripe(secretKey, { apiVersion: '2025-12-15.clover' });
    
    // Verify we can list payment methods (empty list is fine)
    const paymentMethods = await stripe.paymentMethods.list({
      limit: 1,
    });
    
    expect(paymentMethods).toBeDefined();
    expect(paymentMethods.object).toBe("list");
    expect(Array.isArray(paymentMethods.data)).toBe(true);
  });

  it("should verify webhook secret is configured", () => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    expect(webhookSecret).toBeDefined();
    expect(webhookSecret).toMatch(/^whsec_/);
  });
});
