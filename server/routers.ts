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
import seed04 from "./seed/04-ai-fundamentals.json";
import seed05 from "./seed/05-prompt-engineering.json";
import seed06 from "./seed/06-ai-tools-productivity.json";
import seed07 from "./seed/07-python-for-ai.json";
import seed08 from "./seed/08-build-ai-apps.json";
import seed09 from "./seed/09-ai-agents.json";
import seed10 from "./seed/10-ml-engineering.json";
import seed11 from "./seed/11-fine-tuning-llms.json";

interface SeedLesson {
  title: string;
  contentMarkdown: string;
  durationMinutes: number;
  isFreePreview: boolean;
}

interface SeedCourse {
  courseId: number;
  modules: { title: string; lessons: SeedLesson[] }[];
}

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

/** Flat price (USD) for the "Complete Bundle" of every active course. */
export const BUNDLE_PRICE_USD = 499;

async function getBundleDetails() {
  const courses = await db.getAllCourses();
  const totalValue = courses.reduce((sum, c) => sum + parseFloat(c.price), 0);
  return {
    courses,
    count: courses.length,
    totalValue: Math.round(totalValue * 100) / 100,
    price: BUNDLE_PRICE_USD,
  };
}

/** Apply a percentage promo to an amount; returns final amount + discount. */
function applyPromo(amount: number, promo?: { percentOff: number }) {
  if (!promo) return { finalAmount: amount, discount: 0 };
  const discount = Math.round(amount * (promo.percentOff / 100) * 100) / 100;
  return { finalAmount: Math.round((amount - discount) * 100) / 100, discount };
}

async function resolvePromo(promoCode?: string) {
  if (!promoCode) return undefined;
  const promo = await db.getPromoCode(promoCode);
  if (!promo) {
    throw new TRPCError({ code: 'NOT_FOUND', message: "That promo code isn't valid." });
  }
  return promo;
}

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

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        price: z.string().optional(),
        currency: z.string().optional(),
        imageUrl: z.string().nullable().optional(),
        duration: z.string().nullable().optional(),
        level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        try {
          return await db.updateCourse(id, updates);
        } catch (err) {
          if (err instanceof Error && err.message === "Course not found") {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
          }
          throw err;
        }
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

  curriculum: router({
    /**
     * Full curriculum for a course. Lesson content is only included when the
     * caller is enrolled, is an admin, or the lesson is a free preview.
     * Everyone else sees the outline (titles, durations) with content: null.
     */
    getByCourse: publicProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const user = (ctx as { user?: { id: number; role: string } }).user;
        const isAdmin = user?.role === 'admin';
        const enrolled = user ? await db.checkEnrollment(user.id, input.courseId) : false;
        const fullAccess = Boolean(isAdmin || enrolled);

        const curriculum = await db.getCourseCurriculum(input.courseId);
        return curriculum.map((m) => ({
          ...m,
          lessons: m.lessons.map((l) => ({
            ...l,
            content: fullAccess || l.isFreePreview ? l.content : null,
          })),
        }));
      }),

    /** Single lesson with content, gated the same way as getByCourse. */
    getLesson: publicProcedure
      .input(z.object({ lessonId: z.number() }))
      .query(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesson not found' });
        }
        const module = await db.getModuleById(lesson.moduleId);
        if (!module) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesson not found' });
        }

        const user = (ctx as { user?: { id: number; role: string } }).user;
        const isAdmin = user?.role === 'admin';
        const enrolled = user ? await db.checkEnrollment(user.id, module.courseId) : false;
        const canView = Boolean(isAdmin || enrolled || lesson.isFreePreview);
        if (!canView) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Enroll to view this lesson' });
        }
        return { ...lesson, courseId: module.courseId };
      }),

    /** Completed lesson IDs + totals for the signed-in user in a course. */
    myProgress: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const completedIds = await db.getCompletedLessonIds(ctx.user.id, input.courseId);
        const curriculum = await db.getCourseCurriculum(input.courseId);
        const totalLessons = curriculum.reduce((n, m) => n + m.lessons.length, 0);
        return { completedIds, totalLessons };
      }),

    markComplete: protectedProcedure
      .input(z.object({ lessonId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lesson = await db.getLessonById(input.lessonId);
        if (!lesson) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesson not found' });
        const module = await db.getModuleById(lesson.moduleId);
        if (!module) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesson not found' });
        const isAdmin = ctx.user.role === 'admin';
        const enrolled = await db.checkEnrollment(ctx.user.id, module.courseId);
        if (!isAdmin && !enrolled) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Enroll to track progress' });
        }
        await db.markLessonComplete(ctx.user.id, input.lessonId);
        return { success: true };
      }),

    markIncomplete: protectedProcedure
      .input(z.object({ lessonId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markLessonIncomplete(ctx.user.id, input.lessonId);
        return { success: true };
      }),

    // ---- Admin management ----
    createModule: adminProcedure
      .input(z.object({
        courseId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        position: z.number().int().default(0),
      }))
      .mutation(async ({ input }) => db.createModule(input)),

    updateModule: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        position: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        return db.updateModule(id, updates);
      }),

    deleteModule: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteModule(input.id);
        return { success: true };
      }),

    createLesson: adminProcedure
      .input(z.object({
        moduleId: z.number(),
        title: z.string().min(1),
        content: z.string().optional(),
        videoUrl: z.string().optional(),
        durationMinutes: z.number().int().positive().optional(),
        position: z.number().int().default(0),
        isFreePreview: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => db.createLesson(input)),

    updateLesson: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        content: z.string().nullable().optional(),
        videoUrl: z.string().nullable().optional(),
        durationMinutes: z.number().int().positive().nullable().optional(),
        position: z.number().int().optional(),
        isFreePreview: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        return db.updateLesson(id, updates);
      }),

    deleteLesson: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLesson(input.id);
        return { success: true };
      }),

    /**
     * Seed the bundled lesson content into the database. Idempotent: courses
     * that already have modules are skipped. The content lives in
     * server/seed/*.json and is bundled with the server at build time.
     */
    seedAll: adminProcedure.mutation(async () => {
      const seedFiles = [
        seed04, seed05, seed06, seed07, seed08, seed09, seed10, seed11,
      ] as SeedCourse[];
      const results: { courseId: number; modules: number; lessons: number; skipped: boolean }[] = [];
      for (const seed of seedFiles) {
        const existing = await db.getCourseCurriculum(seed.courseId);
        if (existing.length > 0) {
          results.push({ courseId: seed.courseId, modules: 0, lessons: 0, skipped: true });
          continue;
        }
        let lessonCount = 0;
        for (let mi = 0; mi < seed.modules.length; mi++) {
          const mod = seed.modules[mi];
          const created = await db.createModule({
            courseId: seed.courseId,
            title: mod.title,
            position: mi,
          });
          for (let li = 0; li < mod.lessons.length; li++) {
            const lesson = mod.lessons[li];
            await db.createLesson({
              moduleId: created.id,
              title: lesson.title,
              content: lesson.contentMarkdown,
              durationMinutes: lesson.durationMinutes,
              isFreePreview: lesson.isFreePreview,
              position: li,
            });
            lessonCount++;
          }
        }
        results.push({ courseId: seed.courseId, modules: seed.modules.length, lessons: lessonCount, skipped: false });
      }
      return { results };
    }),
  }),

  payments: router({
    /** Public bundle details: every active course for one flat price. */
    getBundle: publicProcedure.query(async () => getBundleDetails()),

    createStripeIntent: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        promoCode: z.string().trim().max(64).optional(),
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

        const promo = await resolvePromo(input.promoCode);
        const { finalAmount, discount } = applyPromo(parseFloat(course.price), promo);

        // Create order record
        const order = await db.createOrder({
          userId: ctx.user.id,
          courseId: input.courseId,
          amount: finalAmount.toFixed(2),
          currency: course.currency,
          paymentMethod: 'stripe',
          paymentStatus: 'pending',
          promoCode: promo?.code ?? null,
          customerEmail: ctx.user.email || undefined,
        });

        // Create Stripe PaymentIntent
        const paymentIntent = await createStripePaymentIntent({
          amount: finalAmount,
          currency: course.currency,
          courseId: input.courseId,
          userId: ctx.user.id,
          customerEmail: ctx.user.email || undefined,
          promoCode: promo?.code,
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
          discount,
          finalAmount,
        };
      }),

    /**
     * Create a PaymentIntent for the Complete Bundle (all active courses,
     * one flat price). Enrolls the buyer in every course they don't own yet.
     */
    createBundleIntent: protectedProcedure
      .input(z.object({
        promoCode: z.string().trim().max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isStripeConfigured()) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Stripe is not configured. Please add your Stripe API keys.'
          });
        }

        const { courses } = await getBundleDetails();
        if (courses.length === 0) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No courses available for the bundle.' });
        }

        const missing: number[] = [];
        for (const c of courses) {
          if (!(await db.checkEnrollment(ctx.user.id, c.id))) missing.push(c.id);
        }
        if (missing.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'You already own every course in the bundle.' });
        }

        const promo = await resolvePromo(input.promoCode);
        const { finalAmount, discount } = applyPromo(BUNDLE_PRICE_USD, promo);

        const order = await db.createOrder({
          userId: ctx.user.id,
          courseId: null,
          bundleCourseIds: JSON.stringify(missing),
          amount: finalAmount.toFixed(2),
          currency: 'USD',
          paymentMethod: 'stripe',
          paymentStatus: 'pending',
          promoCode: promo?.code ?? null,
          customerEmail: ctx.user.email || undefined,
        });

        const paymentIntent = await createStripePaymentIntent({
          amount: finalAmount,
          currency: 'USD',
          userId: ctx.user.id,
          customerEmail: ctx.user.email || undefined,
          isBundle: true,
          bundleCourseIds: missing,
          promoCode: promo?.code,
        });

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
          discount,
          finalAmount,
          courseCount: missing.length,
        };
      }),

    // Webhook handler will be implemented as Express route, not tRPC
    // This is because webhooks need raw body for signature verification
  }),

  /** Email lead capture (free previews, site forms). */
  newsletter: router({
    subscribe: publicProcedure
      .input(z.object({
        email: z.string().trim().min(3).max(320).email("Enter a valid email address"),
        source: z.string().trim().max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const ip = ctx.req.ip ?? "unknown";
        if (isRateLimited(`newsletter:${ip}`, 5, 60 * 60 * 1000)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again later." });
        }
        const { created } = await db.subscribeEmail(input.email.toLowerCase(), input.source);
        return { subscribed: true, isNew: created } as const;
      }),

    list: adminProcedure.query(async () => db.getAllSubscribers()),
  }),

  /** Promo codes: public validation + admin management. */
  promos: router({
    validate: publicProcedure
      .input(z.object({ code: z.string().trim().min(1).max(64) }))
      .query(async ({ input }) => {
        const promo = await db.getPromoCode(input.code);
        if (!promo) {
          throw new TRPCError({ code: 'NOT_FOUND', message: "That promo code isn't valid." });
        }
        return { code: promo.code, percentOff: promo.percentOff };
      }),

    list: adminProcedure.query(async () => db.getAllPromoCodes()),

    create: adminProcedure
      .input(z.object({
        code: z.string().trim().min(2).max(64),
        percentOff: z.number().int().min(1).max(90),
        expiresAt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await db.createPromoCode({
            code: input.code,
            percentOff: input.percentOff,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          });
        } catch {
          throw new TRPCError({ code: 'CONFLICT', message: 'That code already exists.' });
        }
      }),

    setActive: adminProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.setPromoCodeActive(input.id, input.isActive);
        return { success: true } as const;
      }),
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
