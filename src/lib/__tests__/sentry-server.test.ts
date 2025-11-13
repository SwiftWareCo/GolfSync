import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";

// Mock Sentry and Clerk modules
vi.mock("@sentry/nextjs", () => ({
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  startSpan: vi.fn((config, callback) => callback({ finish: vi.fn() })),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn(),
}));

// Import functions after mocking
import { initSentryUser, withSentry, withSentryAPI, withSentryDB } from "../sentry-server";
import { currentUser } from "@clerk/nextjs/server";

describe("Sentry Server Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // USER CONTEXT INITIALIZATION
  // ============================================================================

  describe("initSentryUser", () => {
    it("should set user context when user is authenticated", async () => {
      const mockUser = {
        id: "user_123",
        username: "johndoe",
        emailAddresses: [{ emailAddress: "john@example.com" }],
        firstName: "John",
        lastName: "Doe",
        publicMetadata: {
          role: "admin",
          isAdmin: true,
          isMember: false,
        },
      };

      vi.mocked(currentUser).mockResolvedValue(mockUser as any);

      const result = await initSentryUser();

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: "user_123",
        username: "johndoe",
        email: "john@example.com",
        firstName: "John",
        lastName: "Doe",
        role: "admin",
        isAdmin: true,
        isMember: false,
      });
      expect(result).toEqual(mockUser);
    });

    it("should clear user context when no user is authenticated", async () => {
      vi.mocked(currentUser).mockResolvedValue(null);

      const result = await initSentryUser();

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
      expect(result).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(currentUser).mockRejectedValue(new Error("Auth error"));

      const result = await initSentryUser();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result).toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it("should handle user without email addresses", async () => {
      const mockUser = {
        id: "user_123",
        emailAddresses: [],
        firstName: "John",
        publicMetadata: {},
      };

      vi.mocked(currentUser).mockResolvedValue(mockUser as any);

      await initSentryUser();

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: "user_123",
        username: undefined,
        email: undefined,
        firstName: "John",
        lastName: undefined,
        role: undefined,
        isAdmin: undefined,
        isMember: undefined,
      });
    });
  });

  // ============================================================================
  // SERVER ACTION WRAPPER
  // ============================================================================

  describe("withSentry", () => {
    it("should wrap server action with Sentry tracking", async () => {
      const mockUser = {
        id: "user_123",
        emailAddresses: [{ emailAddress: "test@example.com" }],
        publicMetadata: {},
      };
      vi.mocked(currentUser).mockResolvedValue(mockUser as any);

      const action = vi.fn(async (data: string) => `Result: ${data}`);
      const wrappedAction = withSentry("testAction", action);

      const result = await wrappedAction("test-data");

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        {
          name: "server_action.testAction",
          op: "function.server_action",
        },
        expect.any(Function)
      );
      expect(action).toHaveBeenCalledWith("test-data");
      expect(result).toBe("Result: test-data");
    });

    it("should add breadcrumb for server action", async () => {
      vi.mocked(currentUser).mockResolvedValue(null);

      const action = vi.fn(async () => "success");
      const wrappedAction = withSentry("testAction", action);

      await wrappedAction("arg1", "arg2");

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: "Server action: testAction",
        category: "server_action",
        data: {
          actionName: "testAction",
          argsLength: 2,
        },
      });
    });

    it("should capture exceptions from server action", async () => {
      vi.mocked(currentUser).mockResolvedValue(null);

      const error = new Error("Action failed");
      const action = vi.fn(async () => {
        throw error;
      });
      const wrappedAction = withSentry("failingAction", action);

      await expect(wrappedAction()).rejects.toThrow("Action failed");

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: {
          type: "server_action",
          action: "failingAction",
        },
        extra: {
          actionName: "failingAction",
          argsLength: 0,
        },
      });
    });

    it("should handle multiple arguments", async () => {
      vi.mocked(currentUser).mockResolvedValue(null);

      const action = vi.fn(async (a: number, b: number, c: string) => a + b + c.length);
      const wrappedAction = withSentry("multiArgAction", action);

      const result = await wrappedAction(1, 2, "test");

      expect(action).toHaveBeenCalledWith(1, 2, "test");
      expect(result).toBe(7);
    });
  });

  // ============================================================================
  // API ROUTE WRAPPER
  // ============================================================================

  describe("withSentryAPI", () => {
    it("should wrap API handler with Sentry tracking", async () => {
      const mockUser = {
        id: "user_456",
        emailAddresses: [{ emailAddress: "api@example.com" }],
        publicMetadata: {},
      };
      vi.mocked(currentUser).mockResolvedValue(mockUser as any);

      const handler = vi.fn(async (req: any) => ({ status: 200, data: req.body }));
      const wrappedHandler = withSentryAPI("GET /api/test", handler);

      const mockRequest = { body: { test: "data" } };
      const result = await wrappedHandler(mockRequest);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        {
          name: "api.GET /api/test",
          op: "http.server",
        },
        expect.any(Function)
      );
      expect(handler).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual({ status: 200, data: { test: "data" } });
    });

    it("should add breadcrumb for API route", async () => {
      vi.mocked(currentUser).mockResolvedValue(null);

      const handler = vi.fn(async () => "success");
      const wrappedHandler = withSentryAPI("POST /api/members", handler);

      await wrappedHandler();

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: "API route: POST /api/members",
        category: "api",
        data: {
          routeName: "POST /api/members",
        },
      });
    });

    it("should capture exceptions from API handler", async () => {
      vi.mocked(currentUser).mockResolvedValue(null);

      const error = new Error("API error");
      const handler = vi.fn(async () => {
        throw error;
      });
      const wrappedHandler = withSentryAPI("GET /api/fail", handler);

      await expect(wrappedHandler()).rejects.toThrow("API error");

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: {
          type: "api_route",
          route: "GET /api/fail",
        },
        extra: {
          routeName: "GET /api/fail",
        },
      });
    });
  });

  // ============================================================================
  // DATABASE WRAPPER
  // ============================================================================

  describe("withSentryDB", () => {
    it("should wrap database query with Sentry tracking", async () => {
      const query = vi.fn(async () => [{ id: 1, name: "Test" }]);

      const result = await withSentryDB("select", "members", query);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        {
          name: "select members",
          op: "db.query",
          attributes: {
            "db.system": "postgresql",
            "db.operation": "select",
            "db.table": "members",
          },
        },
        expect.any(Function)
      );
      expect(query).toHaveBeenCalled();
      expect(result).toEqual([{ id: 1, name: "Test" }]);
    });

    it("should add breadcrumb for database operation", async () => {
      const query = vi.fn(async () => []);

      await withSentryDB("insert", "bookings", query);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: "Database insert on bookings",
        category: "db",
        data: {
          operation: "insert",
          table: "bookings",
        },
      });
    });

    it("should capture exceptions from database query", async () => {
      const error = new Error("Database error");
      const query = vi.fn(async () => {
        throw error;
      });

      await expect(withSentryDB("update", "members", query)).rejects.toThrow("Database error");

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: {
          type: "database_error",
          operation: "update",
          table: "members",
        },
        extra: {
          operation: "update",
          table: "members",
        },
      });
    });

    it("should handle different database operations", async () => {
      const deleteQuery = vi.fn(async () => ({ rowsDeleted: 1 }));

      const result = await withSentryDB("delete", "lottery_entries", deleteQuery);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "delete lottery_entries",
          op: "db.query",
        }),
        expect.any(Function)
      );
      expect(result).toEqual({ rowsDeleted: 1 });
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe("Integration scenarios", () => {
    it("should handle nested Sentry operations", async () => {
      vi.mocked(currentUser).mockResolvedValue(null);

      const dbQuery = vi.fn(async () => [{ id: 1 }]);
      const action = vi.fn(async () => {
        return await withSentryDB("select", "members", dbQuery);
      });
      const wrappedAction = withSentry("nestedAction", action);

      const result = await wrappedAction();

      expect(Sentry.startSpan).toHaveBeenCalledTimes(2); // One for action, one for DB
      expect(result).toEqual([{ id: 1 }]);
    });

    it("should maintain error context through nested operations", async () => {
      vi.mocked(currentUser).mockResolvedValue(null);

      const dbError = new Error("DB connection failed");
      const dbQuery = vi.fn(async () => {
        throw dbError;
      });
      const action = vi.fn(async () => {
        return await withSentryDB("select", "members", dbQuery);
      });
      const wrappedAction = withSentry("errorAction", action);

      await expect(wrappedAction()).rejects.toThrow("DB connection failed");

      // Both the DB wrapper and action wrapper should capture the error
      expect(Sentry.captureException).toHaveBeenCalledTimes(2);
    });
  });
});
