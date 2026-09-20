import { pgTable, pgEnum, serial, integer, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/pg-core";

/**
 * Postgres enums. Named distinctly from column names so the generated
 * CREATE TYPE statements are unambiguous.
 */
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const courseLevelEnum = pgEnum("course_level", ["beginner", "intermediate", "advanced"]);
export const paymentMethodEnum = pgEnum("payment_method", ["stripe", "crypto"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "completed", "failed", "refunded"]);
export const paymentSourceEnum = pgEnum("payment_source", ["stripe", "crypto"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  // scrypt password hash for local (email+password) auth. Null for users
  // created through other login methods.
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  // NOTE: MySQL's onUpdateNow() has no Postgres equivalent; callers set
  // updatedAt explicitly (see upsertUser in server/db.ts).
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Sessions table - server-side session tokens for local auth.
 * Only the SHA-256 hash of the token is stored; the raw token lives
 * in the httpOnly session cookie.
 */
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Courses table - stores all available courses
 */
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  imageUrl: text("imageUrl"),
  duration: varchar("duration", { length: 100 }), // e.g., "8 weeks", "Self-paced"
  level: courseLevelEnum("level").default("beginner").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

/**
 * Orders table - tracks all payment attempts.
 * Single-course orders set courseId; bundle orders leave courseId null
 * and store the purchased course IDs as JSON in bundleCourseIds.
 */
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  courseId: integer("courseId"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  paymentMethod: paymentMethodEnum("paymentMethod").notNull(),
  paymentStatus: paymentStatusEnum("paymentStatus").default("pending").notNull(),
  // Promo code applied at checkout (e.g. LAUNCH30), if any.
  promoCode: varchar("promoCode", { length: 64 }),
  // JSON array of course IDs for bundle orders; null for single-course orders.
  bundleCourseIds: text("bundleCourseIds"),
  // Payment gateway specific IDs
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  cryptoPaymentId: varchar("cryptoPaymentId", { length: 255 }),
  // Additional metadata
  customerEmail: varchar("customerEmail", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Email subscribers - lead capture from free preview lessons and site forms.
 */
export const emailSubscribers = pgTable("emailSubscribers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  source: varchar("source", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailSubscriber = typeof emailSubscribers.$inferSelect;
export type InsertEmailSubscriber = typeof emailSubscribers.$inferInsert;

/**
 * Promo codes - percentage discounts applied at checkout (e.g. LAUNCH30).
 */
export const promoCodes = pgTable("promoCodes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  percentOff: integer("percentOff").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = typeof promoCodes.$inferInsert;

/**
 * Enrollments table - manages course access
 */
export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  courseId: integer("courseId").notNull(),
  orderId: integer("orderId").notNull(),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // null = lifetime access
  isActive: boolean("isActive").default(true).notNull(),
});

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = typeof enrollments.$inferInsert;

/**
 * Payment logs table - audit trail for all payment events
 */
export const paymentLogs = pgTable("paymentLogs", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(), // e.g., "payment_intent.succeeded", "crypto.confirmed"
  payload: text("payload").notNull(), // JSON string of webhook payload
  source: paymentSourceEnum("source").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentLog = typeof paymentLogs.$inferSelect;
export type InsertPaymentLog = typeof paymentLogs.$inferInsert;

/**
 * Modules - group lessons within a course (the curriculum outline)
 */
export const modules = pgTable("modules", {
  id: serial("id").primaryKey(),
  courseId: integer("courseId")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  position: integer("position").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Module = typeof modules.$inferSelect;
export type InsertModule = typeof modules.$inferInsert;

/**
 * Lessons - individual content units inside a module.
 * Content is markdown rendered on the lesson page.
 */
export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  moduleId: integer("moduleId")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  videoUrl: text("videoUrl"),
  durationMinutes: integer("durationMinutes"),
  position: integer("position").default(0).notNull(),
  isFreePreview: boolean("isFreePreview").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;

/**
 * Lesson progress - which lessons a user has completed
 */
export const lessonProgress = pgTable("lessonProgress", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lessonId: integer("lessonId")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
});

export type LessonProgress = typeof lessonProgress.$inferSelect;
export type InsertLessonProgress = typeof lessonProgress.$inferInsert;
