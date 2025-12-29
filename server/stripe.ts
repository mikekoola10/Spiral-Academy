import Stripe from 'stripe';

// Initialize Stripe with secret key from environment
const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-12-15.clover',
  });
};

/**
 * Create a Stripe PaymentIntent for a course purchase
 */
export async function createStripePaymentIntent(params: {
  amount: number; // in dollars
  currency: string;
  courseId: number;
  userId: number;
  customerEmail?: string;
}) {
  const stripe = getStripe();
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(params.amount * 100), // Convert to cents
    currency: params.currency.toLowerCase(),
    metadata: {
      courseId: params.courseId.toString(),
      userId: params.userId.toString(),
    },
    receipt_email: params.customerEmail,
  });
  
  return paymentIntent;
}

/**
 * Verify Stripe webhook signature
 */
export function verifyStripeWebhook(payload: string | Buffer, signature: string): Stripe.Event {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  
  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Retrieve a PaymentIntent by ID
 */
export async function getStripePaymentIntent(paymentIntentId: string) {
  const stripe = getStripe();
  return await stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
