/**

 * Tests for Rate Limiting

 */

 

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {

  checkRateLimit,

  resetRateLimit,

  clearAllRateLimits,

  strictRateLimit,

  standardRateLimit,

  relaxedRateLimit,

  cronRateLimit,

  enforceRateLimit,

  enforceStrictRateLimit,

  enforceStandardRateLimit,

  getRateLimitHeaders,

  getRateLimitStatus,

  getUserRateLimitKey,

  getIPRateLimitKey,

  getActionRateLimitKey,

  getEndpointRateLimitKey,

  getStoreSize,

  cleanupStore,

  type RateLimitConfig,

} from "../rate-limit";

 

describe("Rate Limiting", () => {

  beforeEach(() => {

    clearAllRateLimits();

  });

 

  afterEach(() => {

    clearAllRateLimits();

  });

 

  describe("checkRateLimit", () => {

    it("should allow first request", () => {

      const config: RateLimitConfig = {

        maxRequests: 5,

        windowMs: 60000,

      };

 

      const result = checkRateLimit("user123", config);

 

      expect(result.success).toBe(true);

      expect(result.remaining).toBe(4);

      expect(result.limit).toBe(5);

    });

 

    it("should allow requests up to limit", () => {

      const config: RateLimitConfig = {

        maxRequests: 3,

        windowMs: 60000,

      };

 

      // Request 1

      let result = checkRateLimit("user123", config);

      expect(result.success).toBe(true);

      expect(result.remaining).toBe(2);

 

      // Request 2

      result = checkRateLimit("user123", config);

      expect(result.success).toBe(true);

      expect(result.remaining).toBe(1);

 

      // Request 3

      result = checkRateLimit("user123", config);

      expect(result.success).toBe(true);

      expect(result.remaining).toBe(0);

    });

 

    it("should block requests over limit", () => {

      const config: RateLimitConfig = {

        maxRequests: 2,

        windowMs: 60000,

      };

 

      // Requests 1 and 2 succeed

      checkRateLimit("user123", config);

      checkRateLimit("user123", config);

 

      // Request 3 fails

      const result = checkRateLimit("user123", config);

 

      expect(result.success).toBe(false);

      expect(result.remaining).toBe(0);

      expect(result.retryAfter).toBeGreaterThan(0);

    });

 

    it("should reset after time window expires", async () => {

      const config: RateLimitConfig = {

        maxRequests: 2,

        windowMs: 100, // 100ms window for testing

      };

 

      // Use up the limit

      checkRateLimit("user123", config);

      checkRateLimit("user123", config);

 

      // Should be blocked

      let result = checkRateLimit("user123", config);

      expect(result.success).toBe(false);

 

      // Wait for window to expire

      await new Promise((resolve) => setTimeout(resolve, 150));

 

      // Should succeed again

      result = checkRateLimit("user123", config);

      expect(result.success).toBe(true);

      expect(result.remaining).toBe(1);

    });

 

    it("should track different identifiers separately", () => {

      const config: RateLimitConfig = {

        maxRequests: 1,

        windowMs: 60000,

      };

 

      // User1 uses their limit

      let result = checkRateLimit("user1", config);

      expect(result.success).toBe(true);

 

      result = checkRateLimit("user1", config);

      expect(result.success).toBe(false);

 

      // User2 should still have full quota

      result = checkRateLimit("user2", config);

      expect(result.success).toBe(true);

    });

  });

 

  describe("resetRateLimit", () => {

    it("should reset limit for specific identifier", () => {

      const config: RateLimitConfig = {

        maxRequests: 1,

        windowMs: 60000,

      };

 

      // Use up the limit

      checkRateLimit("user123", config);

      let result = checkRateLimit("user123", config);

      expect(result.success).toBe(false);

 

      // Reset

      resetRateLimit("user123");

 

      // Should succeed again

      result = checkRateLimit("user123", config);

      expect(result.success).toBe(true);

    });

 

    it("should only reset specific identifier", () => {

      const config: RateLimitConfig = {

        maxRequests: 1,

        windowMs: 60000,

      };

 

      // Use up limits for two users

      checkRateLimit("user1", config);

      checkRateLimit("user2", config);

 

      // Reset only user1

      resetRateLimit("user1");

 

      // User1 should have quota

      let result = checkRateLimit("user1", config);

      expect(result.success).toBe(true);

 

      // User2 should still be blocked

      result = checkRateLimit("user2", config);

      expect(result.success).toBe(false);

    });

  });

 

  describe("Pre-configured Rate Limiters", () => {

    it("strictRateLimit should allow 10 requests", () => {

      for (let i = 0; i < 10; i++) {

        const result = strictRateLimit("user123");

        expect(result.success).toBe(true);

      }

 

      // 11th request should fail

      const result = strictRateLimit("user123");

      expect(result.success).toBe(false);

    });

 

    it("standardRateLimit should allow 60 requests", () => {

      for (let i = 0; i < 60; i++) {

        const result = standardRateLimit("user456");

        expect(result.success).toBe(true);

      }

 

      // 61st request should fail

      const result = standardRateLimit("user456");

      expect(result.success).toBe(false);

    });

 

    it("relaxedRateLimit should allow 300 requests", () => {

      for (let i = 0; i < 300; i++) {

        const result = relaxedRateLimit("user789");

        expect(result.success).toBe(true);

      }

 

      // 301st request should fail

      const result = relaxedRateLimit("user789");

      expect(result.success).toBe(false);

    });

 

    it("cronRateLimit should allow 1 request per window", () => {

      const result1 = cronRateLimit("weather-cron");

      expect(result1.success).toBe(true);

 

      // Second request should fail

      const result2 = cronRateLimit("weather-cron");

      expect(result2.success).toBe(false);

    });

  });

 

  describe("enforceRateLimit", () => {

    it("should not throw if under limit", () => {

      const config: RateLimitConfig = {

        maxRequests: 5,

        windowMs: 60000,

      };

 

      expect(() => enforceRateLimit("user123", config)).not.toThrow();

    });

 

    it("should throw error if over limit", () => {

      const config: RateLimitConfig = {

        maxRequests: 1,

        windowMs: 60000,

        message: "Custom rate limit message",

      };

 

      // Use up the limit

      enforceRateLimit("user123", config);

 

      // Should throw

      try {

        enforceRateLimit("user123", config);

        expect.fail("Should have thrown error");

      } catch (error) {

        const parsed = JSON.parse((error as Error).message);

        expect(parsed.code).toBe("RATE_LIMIT_EXCEEDED");

        expect(parsed.message).toContain("Custom rate limit message");

      }

    });

 

    it("enforceStrictRateLimit should throw after 10 requests", () => {

      for (let i = 0; i < 10; i++) {

        expect(() => enforceStrictRateLimit("user123")).not.toThrow();

      }

 

      expect(() => enforceStrictRateLimit("user123")).toThrow();

    });

 

    it("enforceStandardRateLimit should throw after 60 requests", () => {

      for (let i = 0; i < 60; i++) {

        expect(() => enforceStandardRateLimit("user456")).not.toThrow();

      }

 

      expect(() => enforceStandardRateLimit("user456")).toThrow();

    });

  });

 

  describe("getRateLimitHeaders", () => {

    it("should return correct headers for successful request", () => {

      const result = checkRateLimit("user123", {

        maxRequests: 10,

        windowMs: 60000,

      });

 

      const headers = getRateLimitHeaders(result);

 

      expect(headers["X-RateLimit-Limit"]).toBe("10");

      expect(headers["X-RateLimit-Remaining"]).toBe("9");

      expect(headers["X-RateLimit-Reset"]).toBeTruthy();

      expect(headers["Retry-After"]).toBeUndefined();

    });

 

    it("should include Retry-After for failed request", () => {

      const config: RateLimitConfig = {

        maxRequests: 1,

        windowMs: 60000,

      };

 

      // Use up limit

      checkRateLimit("user123", config);

 

      // Get blocked result

      const result = checkRateLimit("user123", config);

 

      const headers = getRateLimitHeaders(result);

 

      expect(headers["X-RateLimit-Remaining"]).toBe("0");

      expect(headers["Retry-After"]).toBeTruthy();

    });

  });

 

  describe("getRateLimitStatus", () => {

    it("should return status without incrementing count", () => {

      const config: RateLimitConfig = {

        maxRequests: 5,

        windowMs: 60000,

      };

 

      // Make one request

      checkRateLimit("user123", config);

 

      // Check status multiple times

      const status1 = getRateLimitStatus("user123", config);

      expect(status1.remaining).toBe(4);

 

      const status2 = getRateLimitStatus("user123", config);

      expect(status2.remaining).toBe(4); // Should still be 4

 

      // Make another request

      checkRateLimit("user123", config);

 

      // Status should now show 3 remaining

      const status3 = getRateLimitStatus("user123", config);

      expect(status3.remaining).toBe(3);

    });

  });

 

  describe("Key Generators", () => {

    it("getUserRateLimitKey should prefix with user:", () => {

      const key = getUserRateLimitKey("123");

      expect(key).toBe("user:123");

    });

 

    it("getIPRateLimitKey should prefix with ip:", () => {

      const key = getIPRateLimitKey("192.168.1.1");

      expect(key).toBe("ip:192.168.1.1");

    });

 

    it("getActionRateLimitKey should include action and user", () => {

      const key = getActionRateLimitKey("create-booking", "user123");

      expect(key).toBe("action:create-booking:user123");

    });

 

    it("getEndpointRateLimitKey should include endpoint and identifier", () => {

      const key = getEndpointRateLimitKey("/api/users", "user123");

      expect(key).toBe("endpoint:/api/users:user123");

    });

  });

 

  describe("Store Management", () => {

    it("should track store size", () => {

      expect(getStoreSize()).toBe(0);

 

      checkRateLimit("user1", { maxRequests: 5, windowMs: 60000 });

      expect(getStoreSize()).toBe(1);

 

      checkRateLimit("user2", { maxRequests: 5, windowMs: 60000 });

      expect(getStoreSize()).toBe(2);

 

      clearAllRateLimits();

      expect(getStoreSize()).toBe(0);

    });

 

    it("should cleanup expired entries", async () => {

      const config: RateLimitConfig = {

        maxRequests: 5,

        windowMs: 50, // 50ms window

      };

 

      checkRateLimit("user1", config);

      checkRateLimit("user2", config);

      expect(getStoreSize()).toBe(2);

 

      // Wait for entries to expire

      await new Promise((resolve) => setTimeout(resolve, 100));

 

      // Manually trigger cleanup

      cleanupStore();

 

      expect(getStoreSize()).toBe(0);

    });

  });

 

  describe("Edge Cases", () => {

    it("should handle zero maxRequests", () => {

      const config: RateLimitConfig = {

        maxRequests: 0,

        windowMs: 60000,

      };

 

      const result = checkRateLimit("user123", config);

 

      expect(result.success).toBe(false);

      expect(result.remaining).toBe(0);

    });

 

    it("should handle very large maxRequests", () => {

      const config: RateLimitConfig = {

        maxRequests: 1000000,

        windowMs: 60000,

      };

 

      const result = checkRateLimit("user123", config);

 

      expect(result.success).toBe(true);

      expect(result.remaining).toBe(999999);

    });

 

    it("should handle concurrent requests", () => {

      const config: RateLimitConfig = {

        maxRequests: 10,

        windowMs: 60000,

      };

 

      const results = Array.from({ length: 15 }, () =>

        checkRateLimit("user123", config)

      );

 

      const successCount = results.filter((r) => r.success).length;

      const failCount = results.filter((r) => !r.success).length;

 

      expect(successCount).toBe(10);

      expect(failCount).toBe(5);

    });

  });

});