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
 * Orders table - tracks all payment attempts
 */
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  courseId: integer("courseId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  paymentMethod: paymentMethodEnum("paymentMethod").notNull(),
  paymentStatus: paymentStatusEnum("paymentStatus").default("pending").notNull(),
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
