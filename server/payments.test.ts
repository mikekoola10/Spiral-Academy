import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1, role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `user${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Courses API", () => {
  it("should list all active courses", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const courses = await caller.courses.list();

    expect(Array.isArray(courses)).toBe(true);
    expect(courses.length).toBeGreaterThan(0);
    expect(courses[0]).toHaveProperty("id");
    expect(courses[0]).toHaveProperty("title");
    expect(courses[0]).toHaveProperty("price");
  });

  it("should get a course by ID", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const courses = await caller.courses.list();
    const firstCourse = courses[0];

    if (firstCourse) {
      const course = await caller.courses.getById({ id: firstCourse.id });
      expect(course.id).toBe(firstCourse.id);
      expect(course.title).toBe(firstCourse.title);
    }
  });

  it("should allow admin to create a course", async () => {
    const ctx = createAuthContext(1, "admin");
    const caller = appRouter.createCaller(ctx);

    const newCourse = await caller.courses.create({
      title: "Test Course",
      description: "A test course for unit testing",
      price: "49.99",
      currency: "USD",
      level: "beginner",
    });

    expect(newCourse).toHaveProperty("id");
    expect(newCourse.title).toBe("Test Course");
    expect(newCourse.price).toBe("49.99");
  });

  it("should prevent non-admin from creating a course", async () => {
    const ctx = createAuthContext(1, "user");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.courses.create({
        title: "Unauthorized Course",
        description: "Should fail",
        price: "99.99",
        currency: "USD",
        level: "beginner",
      })
    ).rejects.toThrow("Admin access required");
  });
});

describe("Orders API", () => {
  it("should allow user to view their own orders", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const orders = await caller.orders.myOrders();

    expect(Array.isArray(orders)).toBe(true);
  });

  it("should allow admin to view all orders", async () => {
    const ctx = createAuthContext(1, "admin");
    const caller = appRouter.createCaller(ctx);

    const orders = await caller.orders.allOrders();

    expect(Array.isArray(orders)).toBe(true);
  });

  it("should prevent non-admin from viewing all orders", async () => {
    const ctx = createAuthContext(1, "user");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.orders.allOrders()).rejects.toThrow("Admin access required");
  });
});

describe("Enrollments API", () => {
  it("should allow user to view their enrollments", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const enrollments = await caller.enrollments.myEnrollments();

    expect(Array.isArray(enrollments)).toBe(true);
  });

  it("should check if user is enrolled in a course", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const courses = await caller.courses.list();
    if (courses.length > 0) {
      const isEnrolled = await caller.enrollments.checkEnrollment({
        courseId: courses[0]!.id,
      });

      expect(typeof isEnrolled).toBe("boolean");
    }
  });

  it("should allow admin to view all enrollments", async () => {
    const ctx = createAuthContext(1, "admin");
    const caller = appRouter.createCaller(ctx);

    const enrollments = await caller.enrollments.allEnrollments();

    expect(Array.isArray(enrollments)).toBe(true);
  });
});

describe("Payment Intent Creation", () => {
  it("should fail to create payment intent without Stripe configuration", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const courses = await caller.courses.list();
    if (courses.length > 0) {
      await expect(
        caller.payments.createStripeIntent({
          courseId: courses[0]!.id,
        })
      ).rejects.toThrow();
    }
  });
});

describe("Database Helper Functions", () => {
  it("should create and retrieve a course", async () => {
    const course = await db.createCourse({
      title: "Test DB Course",
      description: "Testing database operations",
      price: "29.99",
      currency: "USD",
      level: "beginner",
      isActive: true,
    });

    expect(course).toHaveProperty("id");
    expect(course.title).toBe("Test DB Course");

    const retrieved = await db.getCourseById(course.id);
    expect(retrieved?.id).toBe(course.id);
  });

  it("should create and retrieve an order", async () => {
    const courses = await db.getAllCourses();
    if (courses.length > 0) {
      const order = await db.createOrder({
        userId: 1,
        courseId: courses[0]!.id,
        amount: "99.99",
        currency: "USD",
        paymentMethod: "stripe",
        paymentStatus: "pending",
      });

      expect(order).toHaveProperty("id");
      expect(order.paymentStatus).toBe("pending");

      const retrieved = await db.getOrderById(order.id);
      expect(retrieved?.id).toBe(order.id);
    }
  });

  it("should update order status", async () => {
    const courses = await db.getAllCourses();
    if (courses.length > 0) {
      const order = await db.createOrder({
        userId: 1,
        courseId: courses[0]!.id,
        amount: "99.99",
        currency: "USD",
        paymentMethod: "stripe",
        paymentStatus: "pending",
      });

      await db.updateOrderStatus(order.id, "completed", new Date());

      const updated = await db.getOrderById(order.id);
      expect(updated?.paymentStatus).toBe("completed");
      expect(updated?.completedAt).toBeTruthy();
    }
  });

  it("should create and check enrollment", async () => {
    const courses = await db.getAllCourses();
    if (courses.length > 0) {
      const order = await db.createOrder({
        userId: 999,
        courseId: courses[0]!.id,
        amount: "99.99",
        currency: "USD",
        paymentMethod: "stripe",
        paymentStatus: "completed",
      });

      const enrollment = await db.createEnrollment({
        userId: 999,
        courseId: courses[0]!.id,
        orderId: order.id,
        isActive: true,
      });

      expect(enrollment).toHaveProperty("id");

      const isEnrolled = await db.checkEnrollment(999, courses[0]!.id);
      expect(isEnrolled).toBe(true);

      const notEnrolled = await db.checkEnrollment(999, 99999);
      expect(notEnrolled).toBe(false);
    }
  });

  it("should create payment log", async () => {
    const courses = await db.getAllCourses();
    if (courses.length > 0) {
      const order = await db.createOrder({
        userId: 1,
        courseId: courses[0]!.id,
        amount: "99.99",
        currency: "USD",
        paymentMethod: "stripe",
        paymentStatus: "pending",
      });

      await db.createPaymentLog({
        orderId: order.id,
        eventType: "payment_intent.succeeded",
        payload: JSON.stringify({ test: "data" }),
        source: "stripe",
      });

      const logs = await db.getPaymentLogsByOrderId(order.id);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]?.eventType).toBe("payment_intent.succeeded");
    }
  });
});
