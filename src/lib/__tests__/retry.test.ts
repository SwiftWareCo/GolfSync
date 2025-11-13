import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  retry,
  shouldRetryOperation,
} from "../retry";
import { createError, ERROR_CODES } from "../errors";

describe("Retry Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // BASIC RETRY FUNCTIONALITY
  // ============================================================================

  describe("retry", () => {
    it("should return result on first success", async () => {
      const operation = vi.fn(async () => "success");

      const result = await retry(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable error", async () => {
      const error = createError(ERROR_CODES.NETWORK_TIMEOUT);
      let attempts = 0;

      const operation = vi.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw error;
        }
        return "success";
      });

      const result = await retry(operation, { maxRetries: 3, initialDelay: 10, jitter: false });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should not retry non-retryable errors", async () => {
      const error = createError(ERROR_CODES.VALIDATION_FAILED);
      const operation = vi.fn(async () => {
        throw error;
      });

      await expect(
        retry(operation, { maxRetries: 3 })
      ).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should throw after max retries", async () => {
      const error = createError(ERROR_CODES.NETWORK_TIMEOUT);
      const operation = vi.fn(async () => {
        throw error;
      });

      await expect(
        retry(operation, { maxRetries: 2, initialDelay: 10, jitter: false })
      ).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should call onRetry callback", async () => {
      const error = createError(ERROR_CODES.NETWORK_TIMEOUT);
      let attempts = 0;

      const operation = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          throw error;
        }
        return "success";
      });

      const onRetry = vi.fn();

      await retry(operation, {
        maxRetries: 2,
        initialDelay: 10,
        onRetry,
        jitter: false,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, error, expect.any(Number));
    });
  });

  // ============================================================================
  // SHOULD RETRY OPERATION
  // ============================================================================

  describe("shouldRetryOperation", () => {
    it("should return true for retryable ActionError", () => {
      const error = createError(ERROR_CODES.NETWORK_TIMEOUT);
      expect(shouldRetryOperation(error)).toBe(true);
    });

    it("should return false for non-retryable ActionError", () => {
      const error = createError(ERROR_CODES.VALIDATION_FAILED);
      expect(shouldRetryOperation(error)).toBe(false);
    });

    it("should detect retryable patterns in Error messages", () => {
      expect(shouldRetryOperation(new Error("timeout exceeded"))).toBe(true);
      expect(shouldRetryOperation(new Error("ECONNREFUSED"))).toBe(true);
      expect(shouldRetryOperation(new Error("network error"))).toBe(true);
      expect(shouldRetryOperation(new Error("fetch failed"))).toBe(true);
    });

    it("should return false for non-retryable Error messages", () => {
      expect(shouldRetryOperation(new Error("validation error"))).toBe(false);
      expect(shouldRetryOperation(new Error("invalid input"))).toBe(false);
    });

    it("should return false for null", () => {
      expect(shouldRetryOperation(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(shouldRetryOperation(undefined)).toBe(false);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("Edge Cases", () => {
    it("should handle zero retries", async () => {
      const operation = vi.fn(async () => {
        throw createError(ERROR_CODES.NETWORK_TIMEOUT);
      });

      await expect(retry(operation, { maxRetries: 0 })).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should handle custom shouldRetry function", async () => {
      const error = createError(ERROR_CODES.VALIDATION_FAILED);
      let attempts = 0;

      const operation = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          throw error;
        }
        return "success";
      });

      // Custom retry logic that retries even validation errors
      const shouldRetry = () => true;

      const result = await retry(operation, {
        maxRetries: 2,
        initialDelay: 10,
        shouldRetry,
        jitter: false,
      });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});