import { eq, desc, and, inArray } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import { InsertUser, users, courses, Course, InsertCourse, orders, Order, InsertOrder, enrollments, Enrollment, InsertEnrollment, paymentLogs, InsertPaymentLog } from "../drizzle/schema";
import { ENV } from './_core/env';

type Db = ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzleNodePg>;

let _db: Db | null = null;

/** Neon uses its HTTP driver; any other Postgres URL uses node-postgres. */
function isNeonUrl(url: string): boolean {
  return url.includes("neon.tech");
}

export async function getDb(): Promise<Db | null> {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (isNeonUrl(process.env.DATABASE_URL)) {
        const sql = neon(process.env.DATABASE_URL);
        _db = drizzleNeon(sql);
      } else {
        // Standard PostgreSQL (local dev, Railway, Render, self-hosted, ...).
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        _db = drizzleNodePg(pool);
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Partial<InsertUser> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // Postgres has no ON UPDATE NOW(); emulate it explicitly.
    updateSet.updatedAt = new Date();

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==================== Course Helpers ====================

export async function getAllCourses(): Promise<Course[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(courses).where(eq(courses.isActive, true)).orderBy(desc(courses.createdAt));
}

export async function getCourseById(courseId: number): Promise<Course | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCourse(course: InsertCourse): Promise<Course> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [newCourse] = await db.insert(courses).values(course).returning();
  if (!newCourse) throw new Error("Failed to retrieve created course");

  return newCourse;
}

/**
 * Delete a course and all records tied to it (payment logs, enrollments,
 * orders). Admin-only; used to remove test or retired courses.
 */
export async function deleteCourse(courseId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (existing.length === 0) throw new Error("Course not found");

  const courseOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.courseId, courseId));
  const orderIds = courseOrders.map(o => o.id);

  // Delete in dependency order: payment logs -> enrollments -> orders -> course
  if (orderIds.length > 0) {
    await db.delete(paymentLogs).where(inArray(paymentLogs.orderId, orderIds));
  }
  await db.delete(enrollments).where(eq(enrollments.courseId, courseId));
  await db.delete(orders).where(eq(orders.courseId, courseId));
  await db.delete(courses).where(eq(courses.id, courseId));
}

// ==================== Order Helpers ====================

export async function createOrder(order: InsertOrder): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [newOrder] = await db.insert(orders).values(order).returning();
  if (!newOrder) throw new Error("Failed to retrieve created order");

  return newOrder;
}

export async function getOrderById(orderId: number): Promise<Order | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrderByStripePaymentIntentId(paymentIntentId: string): Promise<Order | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(orders).where(eq(orders.stripePaymentIntentId, paymentIntentId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrderByCryptoPaymentId(cryptoPaymentId: string): Promise<Order | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(orders).where(eq(orders.cryptoPaymentId, cryptoPaymentId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateOrderStatus(orderId: number, status: "pending" | "completed" | "failed" | "refunded", completedAt?: Date): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(orders).set({
    paymentStatus: status,
    completedAt: completedAt || (status === "completed" ? new Date() : undefined),
    updatedAt: new Date()
  }).where(eq(orders.id, orderId));
}

export async function getAllOrders(): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function getUserOrders(userId: number): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

// ==================== Enrollment Helpers ====================

export async function createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [newEnrollment] = await db.insert(enrollments).values(enrollment).returning();
  if (!newEnrollment) throw new Error("Failed to retrieve created enrollment");

  return newEnrollment;
}

export async function getEnrollmentById(enrollmentId: number): Promise<Enrollment | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserEnrollments(userId: number): Promise<Enrollment[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(enrollments).where(
    and(eq(enrollments.userId, userId), eq(enrollments.isActive, true))
  ).orderBy(desc(enrollments.enrolledAt));
}

export async function checkEnrollment(userId: number, courseId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.select().from(enrollments).where(
    and(
      eq(enrollments.userId, userId),
      eq(enrollments.isActive, true),
      eq(enrollments.courseId, courseId)
    )
  ).limit(1);

  return result.length > 0;
}

export async function getAllEnrollments(): Promise<Enrollment[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(enrollments).orderBy(desc(enrollments.enrolledAt));
}

// ==================== Payment Log Helpers ====================

export async function createPaymentLog(log: InsertPaymentLog): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(paymentLogs).values(log);
}

export async function getPaymentLogsByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(paymentLogs).where(eq(paymentLogs.orderId, orderId)).orderBy(desc(paymentLogs.createdAt));
}
