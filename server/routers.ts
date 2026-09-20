import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  SESSION_TTL_MS,
  createLocalUser,
  createSession,
  destroySession,
  getUserByEmail,
  isRateLimited,
  normalizeEmail,
  syncAdminRole,
  touchLastSignedIn,
  verifyPassword,
} from "./_core/localAuth";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { parse as parseCookieHeader } from "cookie";
import * as db from "./db";
import { orders } from "../drizzle/schema";
import type { User } from "../drizzle/schema";
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

// Public user shape returned to clients. The password hash must never
// leave the server.
function toPublicUser(user: User) {
  return {
    id: user.id,
    openId: user.openId,
    name: user.name,
    email: user.email,
    loginMethod: user.loginMethod,
    role: user.role,
    createdAt: user.createdAt,
    lastSignedIn: user.lastSignedIn,
  };
}

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    // Never expose the password hash to clients.
    me: publicProcedure.query(opts => (opts.ctx.user ? toPublicUser(opts.ctx.user) : null)),

    register: publicProcedure
      .input(
        z.object({
          email: z.string().trim().min(3).max(320).email("Enter a valid email address"),
          password: z.string().min(8, "Password must be at least 8 characters").max(128),
          name: z.string().trim().min(1).max(100).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const ip = ctx.req.ip ?? "unknown";
        if (isRateLimited(`register:${ip}`, 10, 60 * 60 * 1000)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-up attempts. Try again later." });
        }

        const email = normalizeEmail(input.email);
        const existing = await getUserByEmail(email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
        }

        const user = await createLocalUser({ email, password: input.password, name: input.name ?? null });
        const token = await createSession(user.id);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: SESSION_TTL_MS,
        });
        return { user: toPublicUser(user) } as const;
      }),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().trim().min(3).max(320).email("Enter a valid email address"),
          password: z.string().min(1).max(128),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const email = normalizeEmail(input.email);
        const ip = ctx.req.ip ?? "unknown";
        if (isRateLimited(`login:${ip}:${email}`, 10, 10 * 60 * 1000)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many login attempts. Try again later." });
        }

        const user = await getUserByEmail(email);
        const hash = user?.passwordHash ?? null;
        const ok = hash ? await verifyPassword(input.password, hash) : false;
        // Generic message so attackers can't probe which emails are registered.
        if (!user || !ok) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }

        const synced = await syncAdminRole(user);
        await touchLastSignedIn(synced.id);
        const token = await createSession(synced.id);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: SESSION_TTL_MS,
        });
        return { user: toPublicUser(synced) } as const;
      }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      const header = ctx.req.headers?.cookie;
      const token =
        typeof header === "string" ? parseCookieHeader(header)[COOKIE_NAME] : undefined;
      await destroySession(typeof token === "string" ? token : null);
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

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await db.deleteCourse(input.id);
        } catch (err) {
          if (err instanceof Error && err.message === "Course not found") {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
          }
          throw err;
        }
        return { success: true };
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
