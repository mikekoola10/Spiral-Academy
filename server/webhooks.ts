import type { Express, Request, Response } from 'express';
import { verifyStripeWebhook } from './stripe';
import * as db from './db';
import type Stripe from 'stripe';

/**
 * Grant course access after successful payment.
 * Handles both single-course orders (courseId) and bundle orders
 * (bundleCourseIds JSON array) - enrolls the user in every course
 * they don't already have.
 */
async function grantCourseAccess(orderId: number) {
  const order = await db.getOrderById(orderId);
  if (!order) {
    console.error(`[Webhook] Order ${orderId} not found`);
    return;
  }

  let courseIds: number[] = [];
  if (order.bundleCourseIds) {
    try {
      const parsed: unknown = JSON.parse(order.bundleCourseIds);
      if (Array.isArray(parsed)) {
        courseIds = parsed.filter((n): n is number => typeof n === "number");
      }
    } catch {
      console.error(`[Webhook] Order ${orderId} has invalid bundleCourseIds`);
    }
  } else if (order.courseId) {
    courseIds = [order.courseId];
  }

  for (const courseId of courseIds) {
    const isEnrolled = await db.checkEnrollment(order.userId, courseId);
    if (isEnrolled) {
      console.log(`[Webhook] User ${order.userId} already enrolled in course ${courseId}`);
      continue;
    }

    await db.createEnrollment({
      userId: order.userId,
      courseId,
      orderId: order.id,
      isActive: true,
    });
    console.log(`[Webhook] Granted course access: User ${order.userId} enrolled in course ${courseId}`);
  }

  // Update order status
  await db.updateOrderStatus(orderId, 'completed', new Date());
}

/**
 * Stripe webhook handler
 */
async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers['stripe-signature'];
  
  if (!signature || typeof signature !== 'string') {
    console.error('[Stripe Webhook] Missing signature');
    return res.status(400).send('Missing signature');
  }

  try {
    // Verify webhook signature
    const event = verifyStripeWebhook(req.body, signature);
    
    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    // Handle payment_intent.succeeded event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      // Find order by payment intent ID
      const order = await db.getOrderByStripePaymentIntentId(paymentIntent.id);
      
      if (!order) {
        console.error(`[Stripe Webhook] Order not found for PaymentIntent ${paymentIntent.id}`);
        return res.status(404).json({ error: 'Order not found' });
      }

      // Log the payment event
      await db.createPaymentLog({
        orderId: order.id,
        eventType: event.type,
        payload: JSON.stringify(event.data.object),
        source: 'stripe',
      });

      // Grant course access
      await grantCourseAccess(order.id);
    }

    // Handle payment_intent.payment_failed event
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      const order = await db.getOrderByStripePaymentIntentId(paymentIntent.id);
      
      if (order) {
        await db.updateOrderStatus(order.id, 'failed');
        
        await db.createPaymentLog({
          orderId: order.id,
          eventType: event.type,
          payload: JSON.stringify(event.data.object),
          source: 'stripe',
        });
        
        console.log(`[Stripe Webhook] Payment failed for order ${order.id}`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Stripe Webhook] Error:', err);
    return res.status(400).send('Webhook Error: unable to process webhook');
  }
}

/**
 * Crypto webhook handler (placeholder for NOWPayments/Coinbase Commerce)
 */
async function handleCryptoWebhook(req: Request, res: Response) {
  try {
    // TODO: Implement crypto gateway webhook verification
    // This will be implemented once crypto gateway is chosen and configured
    
    console.log('[Crypto Webhook] Received webhook (not yet implemented)');
    
    // Placeholder response
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Crypto Webhook] Error:', err);
    return res.status(400).send('Webhook Error: unable to process webhook');
  }
}

/**
 * Register webhook routes with Express app
 */
export function registerWebhookRoutes(app: Express) {
  app.post('/api/webhooks/stripe', handleStripeWebhook);
  app.post('/api/webhooks/crypto', handleCryptoWebhook);
  
  console.log('[Webhooks] Registered webhook routes');
}
