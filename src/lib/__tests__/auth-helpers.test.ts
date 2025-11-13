/**

 * Tests for Authorization Helper Functions

 */

 

import { describe, it, expect, vi, beforeEach } from "vitest";

import {

  getAuthUser,

  requireAuth,

  requireAdmin,

  requireMember,

  requireMemberOwnership,

  requireMemberAccess,

  isAdmin,

  isMember,

  parseAuthError,

  isAuthError,

  createAuthErrorResponse,

  getCurrentMemberId,

  getCurrentUserId,

  type AuthenticatedUser,

} from "../auth-helpers";

 

// Mock Clerk auth

vi.mock("@clerk/nextjs/server", () => ({

  auth: vi.fn(),

}));

 

// Mock database

vi.mock("~/server/db", () => ({

  db: {

    query: {

      members: {

        findFirst: vi.fn(),

      },

    },

  },

}));

 

import { auth } from "@clerk/nextjs/server";

import { db } from "~/server/db";

 

describe("Authorization Helpers", () => {

  beforeEach(() => {

    vi.clearAllMocks();

  });

 

  describe("getAuthUser", () => {

    it("should return authenticated user with admin role", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: {

            isAdmin: true,

            isMember: false,

            memberId: null,

          },

        },

      } as any);

 

      const user = await getAuthUser();

 

      expect(user.userId).toBe("user123");

      expect(user.isAdmin).toBe(true);

      expect(user.isMember).toBe(false);

      expect(user.memberId).toBeNull();

    });

 

    it("should return authenticated user with member role", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user456",

        sessionClaims: {

          publicMetadata: {

            isAdmin: false,

            isMember: true,

            memberId: "123",

          },

        },

      } as any);

 

      const user = await getAuthUser();

 

      expect(user.userId).toBe("user456");

      expect(user.isAdmin).toBe(false);

      expect(user.isMember).toBe(true);

      expect(user.memberId).toBe("123");

    });

 

    it("should throw error if user is not authenticated", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: null,

        sessionClaims: null,

      } as any);

 

      await expect(getAuthUser()).rejects.toThrow();

    });

  });

 

  describe("requireAuth", () => {

    it("should return user if authenticated", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { isAdmin: false, isMember: true },

        },

      } as any);

 

      const user = await requireAuth();

 

      expect(user.userId).toBe("user123");

    });

 

    it("should throw error if not authenticated", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: null,

        sessionClaims: null,

      } as any);

 

      await expect(requireAuth()).rejects.toThrow();

    });

  });

 

  describe("requireAdmin", () => {

    it("should return user if admin", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "admin123",

        sessionClaims: {

          publicMetadata: { isAdmin: true },

        },

      } as any);

 

      const user = await requireAdmin();

 

      expect(user.isAdmin).toBe(true);

    });

 

    it("should throw FORBIDDEN error if not admin", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { isAdmin: false, isMember: true },

        },

      } as any);

 

      try {

        await requireAdmin();

        expect.fail("Should have thrown error");

      } catch (error) {

        const parsed = JSON.parse((error as Error).message);

        expect(parsed.code).toBe("FORBIDDEN");

        expect(parsed.status).toBe(403);

      }

    });

  });

 

  describe("requireMember", () => {

    it("should return user if member", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { isAdmin: false, isMember: true },

        },

      } as any);

 

      const user = await requireMember();

 

      expect(user.isMember).toBe(true);

    });

 

    it("should allow admin to pass member check", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "admin123",

        sessionClaims: {

          publicMetadata: { isAdmin: true, isMember: false },

        },

      } as any);

 

      const user = await requireMember();

 

      expect(user.isAdmin).toBe(true);

    });

 

    it("should throw FORBIDDEN if not member or admin", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { isAdmin: false, isMember: false },

        },

      } as any);

 

      try {

        await requireMember();

        expect.fail("Should have thrown error");

      } catch (error) {

        const parsed = JSON.parse((error as Error).message);

        expect(parsed.code).toBe("FORBIDDEN");

      }

    });

  });

 

  describe("requireMemberOwnership", () => {

    it("should allow admin to access any member", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "admin123",

        sessionClaims: {

          publicMetadata: { isAdmin: true, memberId: null },

        },

      } as any);

 

      const user = await requireMemberOwnership(456);

 

      expect(user.isAdmin).toBe(true);

    });

 

    it("should allow member to access their own record", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { isAdmin: false, isMember: true, memberId: "123" },

        },

      } as any);

 

      const user = await requireMemberOwnership(123);

 

      expect(user.memberId).toBe("123");

    });

 

    it("should deny member accessing another member's record", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { isAdmin: false, isMember: true, memberId: "123" },

        },

      } as any);

 

      try {

        await requireMemberOwnership(456);

        expect.fail("Should have thrown error");

      } catch (error) {

        const parsed = JSON.parse((error as Error).message);

        expect(parsed.code).toBe("FORBIDDEN");

      }

    });

  });

 

  describe("requireMemberAccess", () => {

    it("should allow admin to access any member", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "admin123",

        sessionClaims: {

          publicMetadata: { isAdmin: true },

        },

      } as any);

 

      const user = await requireMemberAccess(456);

 

      expect(user.isAdmin).toBe(true);

    });

 

    it("should allow member to access their own record via userId", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { isAdmin: false, isMember: true },

        },

      } as any);

 

      vi.mocked(db.query.members.findFirst).mockResolvedValue({

        id: 123,

        userId: "user123",

      } as any);

 

      const user = await requireMemberAccess(123);

 

      expect(user.userId).toBe("user123");

    });

 

    it("should deny member accessing another member's record", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { isAdmin: false, isMember: true },

        },

      } as any);

 

      vi.mocked(db.query.members.findFirst).mockResolvedValue({

        id: 456,

        userId: "user456",

      } as any);

 

      try {

        await requireMemberAccess(456);

        expect.fail("Should have thrown error");

      } catch (error) {

        const parsed = JSON.parse((error as Error).message);

        expect(parsed.code).toBe("FORBIDDEN");

      }

    });

 

    it("should throw NOT_FOUND if member doesn't exist", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { isAdmin: false, isMember: true },

        },

      } as any);

 

      vi.mocked(db.query.members.findFirst).mockResolvedValue(null);

 

      try {

        await requireMemberAccess(999);

        expect.fail("Should have thrown error");

      } catch (error) {

        const parsed = JSON.parse((error as Error).message);

        expect(parsed.code).toBe("NOT_FOUND");

        expect(parsed.status).toBe(404);

      }

    });

  });

 

  describe("isAdmin", () => {

    it("should return true for admin", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "admin123",

        sessionClaims: {

          publicMetadata: { isAdmin: true },

        },

      } as any);

 

      const result = await isAdmin();

 

      expect(result).toBe(true);

    });

 

    it("should return false for non-admin", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { isAdmin: false, isMember: true },

        },

      } as any);

 

      const result = await isAdmin();

 

      expect(result).toBe(false);

    });

 

    it("should return false if not authenticated", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: null,

        sessionClaims: null,

      } as any);

 

      const result = await isAdmin();

 

      expect(result).toBe(false);

    });

  });

 

  describe("isMember", () => {

    it("should return true for member", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { isAdmin: false, isMember: true },

        },

      } as any);

 

      const result = await isMember();

 

      expect(result).toBe(true);

    });

 

    it("should return true for admin", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "admin123",

        sessionClaims: {

          publicMetadata: { isAdmin: true, isMember: false },

        },

      } as any);

 

      const result = await isMember();

 

      expect(result).toBe(true);

    });

 

    it("should return false if not member or admin", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { isAdmin: false, isMember: false },

        },

      } as any);

 

      const result = await isMember();

 

      expect(result).toBe(false);

    });

  });

 

  describe("Error Helpers", () => {

    it("should parse authorization error", () => {

      const error = new Error(

        JSON.stringify({

          code: "FORBIDDEN",

          message: "Access denied",

          status: 403,

        })

      );

 

      const parsed = parseAuthError(error);

 

      expect(parsed.code).toBe("FORBIDDEN");

      expect(parsed.message).toBe("Access denied");

      expect(parsed.status).toBe(403);

    });

 

    it("should return default error for non-auth error", () => {

      const error = new Error("Regular error");

 

      const parsed = parseAuthError(error);

 

      expect(parsed.code).toBe("UNAUTHORIZED");

      expect(parsed.message).toBe("Authentication failed");

    });

 

    it("should identify authorization errors", () => {

      const authError = new Error(

        JSON.stringify({

          code: "FORBIDDEN",

          message: "Access denied",

          status: 403,

        })

      );

 

      expect(isAuthError(authError)).toBe(true);

 

      const regularError = new Error("Regular error");

      expect(isAuthError(regularError)).toBe(false);

    });

 

    it("should create error response from auth error", () => {

      const error = new Error(

        JSON.stringify({

          code: "FORBIDDEN",

          message: "Admin access required",

          status: 403,

        })

      );

 

      const response = createAuthErrorResponse(error);

 

      expect(response.success).toBe(false);

      expect(response.error).toBe("Admin access required");

      expect(response.code).toBe("FORBIDDEN");

      expect(response.status).toBe(403);

    });

 

    it("should create generic error response for non-auth error", () => {

      const error = new Error("Regular error");

 

      const response = createAuthErrorResponse(error);

 

      expect(response.success).toBe(false);

      expect(response.code).toBe("INTERNAL_ERROR");

      expect(response.status).toBe(500);

    });

  });

 

  describe("Utility Functions", () => {

    it("should get current member ID", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { memberId: "456" },

        },

      } as any);

 

      const memberId = await getCurrentMemberId();

 

      expect(memberId).toBe(456);

    });

 

    it("should return null if no member ID", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {

          publicMetadata: { memberId: null },

        },

      } as any);

 

      const memberId = await getCurrentMemberId();

 

      expect(memberId).toBeNull();

    });

 

    it("should get current user ID", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: "user123",

        sessionClaims: {},

      } as any);

 

      const userId = await getCurrentUserId();

 

      expect(userId).toBe("user123");

    });

 

    it("should return null if not authenticated", async () => {

      vi.mocked(auth).mockResolvedValue({

        userId: null,

        sessionClaims: null,

      } as any);

 

      const userId = await getCurrentUserId();

 

      expect(userId).toBeNull();

    });

  });

});