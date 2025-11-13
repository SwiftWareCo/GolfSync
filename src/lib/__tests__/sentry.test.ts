import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";

// Mock Sentry module
vi.mock("@sentry/nextjs", () => ({
  setUser: vi.fn(),
  setContext: vi.fn(),
  setTag: vi.fn(),
  setTags: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  startTransaction: vi.fn(),
  startSpan: vi.fn((config, callback) => callback({ finish: vi.fn() })),
  getCurrentHub: vi.fn(),
  flush: vi.fn(),
  close: vi.fn(),
}));

// Import functions after mocking
import {
  setSentryUser,
  clearSentryUser,
  setSentryUserContext,
  captureException,
  captureMessage,
  captureServerActionError,
  captureAPIError,
  captureDatabaseError,
  addBreadcrumb,
  addNavigationBreadcrumb,
  addUserActionBreadcrumb,
  addDataOperationBreadcrumb,
  setContext,
  setTag,
  setTags,
  startTransaction,
  measureSync,
  isSentryEnabled,
} from "../sentry";

describe("Sentry Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // USER CONTEXT
  // ============================================================================

  describe("setSentryUser", () => {
    it("should set user context with Clerk user data", () => {
      const mockUser = {
        id: "user_123",
        username: "johndoe",
        emailAddresses: [{ emailAddress: "john@example.com" }],
        firstName: "John",
        lastName: "Doe",
        publicMetadata: { role: "admin" },
      } as any;

      setSentryUser(mockUser);

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: "user_123",
        username: "johndoe",
        email: "john@example.com",
        firstName: "John",
        lastName: "Doe",
        role: "admin",
      });
    });

    it("should handle user with no email", () => {
      const mockUser = {
        id: "user_123",
        emailAddresses: [],
        firstName: "John",
        publicMetadata: {},
      } as any;

      setSentryUser(mockUser);

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: "user_123",
        username: undefined,
        email: undefined,
        firstName: "John",
        lastName: undefined,
        role: undefined,
      });
    });

    it("should clear user context when user is null", () => {
      setSentryUser(null);

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  describe("clearSentryUser", () => {
    it("should clear user context", () => {
      clearSentryUser();

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  describe("setSentryUserContext", () => {
    it("should set additional user context data", () => {
      const data = { membershipType: "premium", joinedDate: "2024-01-01" };

      setSentryUserContext(data);

      expect(Sentry.setContext).toHaveBeenCalledWith("user_data", data);
    });
  });

  // ============================================================================
  // ERROR TRACKING
  // ============================================================================

  describe("captureException", () => {
    it("should capture exception with default level", () => {
      const error = new Error("Test error");

      captureException(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        level: "error",
        tags: undefined,
        extra: undefined,
        fingerprint: undefined,
      });
    });

    it("should capture exception with custom context", () => {
      const error = new Error("Test error");
      const context = {
        tags: { component: "BookingForm" },
        extra: { bookingId: 123 },
        level: "warning" as const,
        fingerprint: ["booking-error"],
      };

      captureException(error, context);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        level: "warning",
        tags: { component: "BookingForm" },
        extra: { bookingId: 123 },
        fingerprint: ["booking-error"],
      });
    });

    it("should handle non-Error objects", () => {
      const error = "String error";

      captureException(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        level: "error",
        tags: undefined,
        extra: undefined,
        fingerprint: undefined,
      });
    });
  });

  describe("captureMessage", () => {
    it("should capture message with default level", () => {
      const message = "Test message";

      captureMessage(message);

      expect(Sentry.captureMessage).toHaveBeenCalledWith(message, {
        level: "info",
        tags: undefined,
        extra: undefined,
      });
    });

    it("should capture message with custom context", () => {
      const message = "Lottery processing completed";
      const context = {
        tags: { operation: "lottery" },
        extra: { lotteryId: 456 },
        level: "info" as const,
      };

      captureMessage(message, context);

      expect(Sentry.captureMessage).toHaveBeenCalledWith(message, {
        level: "info",
        tags: { operation: "lottery" },
        extra: { lotteryId: 456 },
      });
    });
  });

  describe("captureServerActionError", () => {
    it("should capture server action error with context", () => {
      const error = new Error("Action failed");
      const actionName = "createMember";
      const params = { firstName: "John", lastName: "Doe" };

      captureServerActionError(error, actionName, params);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: {
          type: "server_action",
          action: "createMember",
        },
        extra: {
          actionName: "createMember",
          params: { firstName: "John", lastName: "Doe" },
        },
        level: "error",
      });
    });
  });

  describe("captureAPIError", () => {
    it("should capture API error with endpoint and method", () => {
      const error = new Error("API failed");
      const endpoint = "/api/members";
      const method = "POST";
      const statusCode = 500;

      captureAPIError(error, endpoint, method, statusCode);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: {
          type: "api_error",
          endpoint: "/api/members",
          method: "POST",
          status_code: "500",
        },
        extra: {
          endpoint: "/api/members",
          method: "POST",
          statusCode: 500,
        },
        level: "error",
      });
    });

    it("should handle missing status code", () => {
      const error = new Error("API failed");

      captureAPIError(error, "/api/bookings", "GET");

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: expect.objectContaining({
            status_code: "unknown",
          }),
        })
      );
    });
  });

  describe("captureDatabaseError", () => {
    it("should capture database error with operation and table", () => {
      const error = new Error("Database query failed");
      const operation = "insert";
      const table = "members";
      const query = "INSERT INTO members VALUES (...)";

      captureDatabaseError(error, operation, table, query);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: {
          type: "database_error",
          operation: "insert",
          table: "members",
        },
        extra: {
          operation: "insert",
          table: "members",
          query: "INSERT INTO members VALUES (...)",
        },
        level: "error",
      });
    });

    it("should handle missing table and query", () => {
      const error = new Error("Database error");

      captureDatabaseError(error, "select");

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: expect.objectContaining({
            table: "unknown",
          }),
        })
      );
    });

    it("should truncate long queries", () => {
      const error = new Error("Query failed");
      const longQuery = "SELECT * FROM table WHERE ".repeat(100); // Very long query

      captureDatabaseError(error, "select", "table", longQuery);

      const call = vi.mocked(Sentry.captureException).mock.calls[0];
      const extra = (call?.[1] as any)?.extra;

      expect(extra.query.length).toBeLessThanOrEqual(500);
    });
  });

  // ============================================================================
  // BREADCRUMBS
  // ============================================================================

  describe("addBreadcrumb", () => {
    it("should add a breadcrumb with default level", () => {
      addBreadcrumb("User clicked button", "ui");

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: "User clicked button",
        category: "ui",
        data: undefined,
        level: "info",
        timestamp: expect.any(Number),
      });
    });

    it("should add a breadcrumb with custom data and level", () => {
      addBreadcrumb("Error occurred", "error", { code: 500 }, "error");

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: "Error occurred",
        category: "error",
        data: { code: 500 },
        level: "error",
        timestamp: expect.any(Number),
      });
    });
  });

  describe("addNavigationBreadcrumb", () => {
    it("should add navigation breadcrumb", () => {
      addNavigationBreadcrumb("/members", "/bookings");

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: "Navigated from /members to /bookings",
        category: "navigation",
        data: {
          from: "/members",
          to: "/bookings",
        },
        level: "info",
        timestamp: expect.any(Number),
      });
    });
  });

  describe("addUserActionBreadcrumb", () => {
    it("should add user action breadcrumb", () => {
      addUserActionBreadcrumb("Clicked create button", { page: "members" });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: "Clicked create button",
        category: "user_action",
        data: { page: "members" },
        level: "info",
        timestamp: expect.any(Number),
      });
    });
  });

  describe("addDataOperationBreadcrumb", () => {
    it("should add data operation breadcrumb", () => {
      addDataOperationBreadcrumb("create", "members", 123);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: "CREATE operation on members",
        category: "data_operation",
        data: {
          operation: "create",
          table: "members",
          recordId: 123,
        },
        level: "info",
        timestamp: expect.any(Number),
      });
    });

    it("should handle missing recordId", () => {
      addDataOperationBreadcrumb("delete", "bookings");

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recordId: undefined,
          }),
        })
      );
    });
  });

  // ============================================================================
  // CONTEXT & TAGS
  // ============================================================================

  describe("setContext", () => {
    it("should set custom context", () => {
      const data = { feature: "lottery", version: "2.0" };

      setContext("app_info", data);

      expect(Sentry.setContext).toHaveBeenCalledWith("app_info", data);
    });
  });

  describe("setTag", () => {
    it("should set a single tag", () => {
      setTag("environment", "production");

      expect(Sentry.setTag).toHaveBeenCalledWith("environment", "production");
    });
  });

  describe("setTags", () => {
    it("should set multiple tags", () => {
      const tags = { version: "1.0", region: "us-west" };

      setTags(tags);

      expect(Sentry.setTags).toHaveBeenCalledWith(tags);
    });
  });

  // ============================================================================
  // PERFORMANCE MONITORING
  // ============================================================================

  describe("startTransaction", () => {
    it("should start a transaction", () => {
      const mockTransaction = { finish: vi.fn() };
      vi.mocked(Sentry.startTransaction).mockReturnValue(mockTransaction as any);

      const transaction = startTransaction("test-operation", "http.server");

      expect(Sentry.startTransaction).toHaveBeenCalledWith({
        name: "test-operation",
        op: "http.server",
      });
      expect(transaction).toBe(mockTransaction);
    });
  });

  describe("measureSync", () => {
    it("should measure synchronous operation", () => {
      const operation = vi.fn(() => "result");

      const result = measureSync("test-sync", operation);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        {
          name: "test-sync",
          op: "function",
        },
        expect.any(Function)
      );
      expect(operation).toHaveBeenCalled();
      expect(result).toBe("result");
    });

    it("should propagate errors from sync operation", () => {
      const operation = vi.fn(() => {
        throw new Error("Sync error");
      });

      expect(() => measureSync("test-sync-error", operation)).toThrow("Sync error");
    });
  });

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  describe("isSentryEnabled", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return true when NEXT_PUBLIC_SENTRY_DSN is set", () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/123";

      expect(isSentryEnabled()).toBe(true);
    });

    it("should return true when SENTRY_DSN is set", () => {
      process.env.SENTRY_DSN = "https://test@sentry.io/123";

      expect(isSentryEnabled()).toBe(true);
    });

    it("should return false when no DSN is set", () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      delete process.env.SENTRY_DSN;

      expect(isSentryEnabled()).toBe(false);
    });
  });
});
