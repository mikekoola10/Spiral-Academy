import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { orders } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { createStripePaymentIntent, verifyStripeWebhook, isStripeConfigured } from "./stripe";
import { TRPCError } from "@trpc/server";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  courses: router({
    list: publicProcedure.query(async () => {
      return await db.getAllCourses();
    }),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const course = await db.getCourseById(input.id);
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }
        return course;
      }),
    
    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        price: z.string(),
        currency: z.string().default('USD'),
        imageUrl: z.string().optional(),
        duration: z.string().optional(),
        level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
      }))
      .mutation(async ({ input }) => {
        return await db.createCourse(input);
      }),
  }),

  payments: router({
    createStripeIntent: protectedProcedure
      .input(z.object({
        courseId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isStripeConfigured()) {
          throw new TRPCError({ 
            code: 'PRECONDITION_FAILED', 
            message: 'Stripe is not configured. Please add your Stripe API keys.' 
          });
        }

        // Get course details
        const course = await db.getCourseById(input.courseId);
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }

        // Check if already enrolled
        const isEnrolled = await db.checkEnrollment(ctx.user.id, input.courseId);
        if (isEnrolled) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already enrolled in this course' });
        }

        // Create order record
        const order = await db.createOrder({
          userId: ctx.user.id,
          courseId: input.courseId,
          amount: course.price,
          currency: course.currency,
          paymentMethod: 'stripe',
          paymentStatus: 'pending',
          customerEmail: ctx.user.email || undefined,
        });

        // Create Stripe PaymentIntent
        const paymentIntent = await createStripePaymentIntent({
          amount: parseFloat(course.price),
          currency: course.currency,
          courseId: input.courseId,
          userId: ctx.user.id,
          customerEmail: ctx.user.email || undefined,
        });

        // Update order with Stripe PaymentIntent ID
        const database = await db.getDb();
        if (database) {
          await database.update(orders).set({
            stripePaymentIntentId: paymentIntent.id,
            updatedAt: new Date(),
          }).where(eq(orders.id, order.id));
        }

        return {
          clientSecret: paymentIntent.client_secret,
          orderId: order.id,
        };
      }),

    // Webhook handler will be implemented as Express route, not tRPC
    // This is because webhooks need raw body for signature verification
  }),

  orders: router({
    myOrders: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserOrders(ctx.user.id);
    }),

    allOrders: adminProcedure.query(async () => {
      return await db.getAllOrders();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
        }
        
        // Non-admin users can only view their own orders
        if (ctx.user.role !== 'admin' && order.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        }
        
        return order;
      }),
  }),

  enrollments: router({
    myEnrollments: protectedProcedure.query(async ({ ctx }) => {
      const enrollments = await db.getUserEnrollments(ctx.user.id);
      
      // Fetch course details for each enrollment
      const enrollmentsWithCourses = await Promise.all(
        enrollments.map(async (enrollment) => {
          const course = await db.getCourseById(enrollment.courseId);
          return {
            ...enrollment,
            course,
          };
        })
      );
      
      return enrollmentsWithCourses;
    }),

    checkEnrollment: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.checkEnrollment(ctx.user.id, input.courseId);
      }),

    allEnrollments: adminProcedure.query(async () => {
      return await db.getAllEnrollments();
    }),
  }),
});

export type AppRouter = typeof appRouter;
