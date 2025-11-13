import { describe, it, expect } from "vitest";
import {
  ERROR_CODES,
  createError,
  createSuccess,
  createFailure,
  createErrorFromUnknown,
  detectErrorCode,
  isRetryable,
  getUserMessage,
  getErrorCode,
} from "../errors";

describe("Error Handling System", () => {
  // ============================================================================
  // ERROR CODE CONSTANTS
  // ============================================================================

  describe("ERROR_CODES", () => {
    it("should have database error codes", () => {
      expect(ERROR_CODES.DB_CONNECTION_FAILED).toBe("DB_1001");
      expect(ERROR_CODES.DB_QUERY_FAILED).toBe("DB_1002");
      expect(ERROR_CODES.DB_DUPLICATE_ENTRY).toBe("DB_1005");
    });

    it("should have authentication error codes", () => {
      expect(ERROR_CODES.AUTH_UNAUTHORIZED).toBe("AUTH_2001");
      expect(ERROR_CODES.AUTH_FORBIDDEN).toBe("AUTH_2002");
    });

    it("should have validation error codes", () => {
      expect(ERROR_CODES.VALIDATION_FAILED).toBe("VAL_3001");
      expect(ERROR_CODES.VALIDATION_REQUIRED_FIELD).toBe("VAL_3002");
    });

    it("should have business logic error codes", () => {
      expect(ERROR_CODES.BUSINESS_BOOKING_CONFLICT).toBe("BIZ_4001");
      expect(ERROR_CODES.BUSINESS_CAPACITY_EXCEEDED).toBe("BIZ_4002");
    });

    it("should have network error codes", () => {
      expect(ERROR_CODES.NETWORK_REQUEST_FAILED).toBe("NET_5001");
      expect(ERROR_CODES.NETWORK_TIMEOUT).toBe("NET_5002");
    });
  });

  // ============================================================================
  // ERROR CREATION
  // ============================================================================

  describe("createError", () => {
    it("should create error with default message", () => {
      const error = createError(ERROR_CODES.DB_CONNECTION_FAILED);

      expect(error.code).toBe(ERROR_CODES.DB_CONNECTION_FAILED);
      expect(error.message).toBe("Unable to connect to the database. Please try again.");
      expect(error.retryable).toBe(true);
      expect(error.userAction).toBe("Refresh the page or try again in a moment.");
      expect(error.timestamp).toBeDefined();
    });

    it("should create error with custom message", () => {
      const error = createError(
        ERROR_CODES.VALIDATION_FAILED,
        "Custom validation error"
      );

      expect(error.code).toBe(ERROR_CODES.VALIDATION_FAILED);
      expect(error.message).toBe("Custom validation error");
      expect(error.retryable).toBe(false);
    });

    it("should include details when provided", () => {
      const error = createError(
        ERROR_CODES.DB_QUERY_FAILED,
        "Query failed",
        "SELECT * FROM table_that_doesnt_exist"
      );

      expect(error.details).toBe("SELECT * FROM table_that_doesnt_exist");
    });

    it("should include custom user action when provided", () => {
      const error = createError(
        ERROR_CODES.BUSINESS_BOOKING_CONFLICT,
        "Booking conflict",
        undefined,
        "Contact support"
      );

      expect(error.userAction).toBe("Contact support");
    });
  });

  describe("createSuccess", () => {
    it("should create success response without data", () => {
      const result = createSuccess();

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it("should create success response with data", () => {
      const data = { id: 1, name: "Test" };
      const result = createSuccess(data);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.error).toBeUndefined();
    });
  });

  describe("createFailure", () => {
    it("should create failure response", () => {
      const error = createError(ERROR_CODES.DB_CONNECTION_FAILED);
      const result = createFailure(error);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toEqual(error);
    });
  });

  // ============================================================================
  // ERROR DETECTION
  // ============================================================================

  describe("detectErrorCode", () => {
    it("should detect connection error", () => {
      const error = new Error("ECONNREFUSED: connection refused");
      const code = detectErrorCode(error);

      expect(code).toBe(ERROR_CODES.DB_CONNECTION_FAILED);
    });

    it("should detect timeout error", () => {
      const error = new Error("Request timeout after 5000ms");
      const code = detectErrorCode(error);

      expect(code).toBe(ERROR_CODES.NETWORK_TIMEOUT);
    });

    it("should detect duplicate entry error", () => {
      const error = new Error("unique constraint violation: duplicate key");
      const code = detectErrorCode(error);

      expect(ERROR_CODES.DB_DUPLICATE_ENTRY);
    });

    it("should detect not found error", () => {
      const error = new Error("Record not found in database");
      const code = detectErrorCode(error);

      expect(code).toBe(ERROR_CODES.DB_RECORD_NOT_FOUND);
    });

    it("should detect unauthorized error", () => {
      const error = new Error("Unauthorized: authentication required");
      const code = detectErrorCode(error);

      expect(code).toBe(ERROR_CODES.AUTH_UNAUTHORIZED);
    });

    it("should detect network error", () => {
      const error = new Error("Network request failed");
      const code = detectErrorCode(error);

      expect(code).toBe(ERROR_CODES.NETWORK_REQUEST_FAILED);
    });

    it("should return UNKNOWN_ERROR for unrecognized errors", () => {
      const error = new Error("Some random error");
      const code = detectErrorCode(error);

      expect(code).toBe(ERROR_CODES.UNKNOWN_ERROR);
    });

    it("should handle non-Error objects", () => {
      const code = detectErrorCode("string error");

      expect(code).toBe(ERROR_CODES.UNKNOWN_ERROR);
    });
  });

  describe("createErrorFromUnknown", () => {
    it("should create error from Error object", () => {
      const original = new Error("Connection failed");
      const error = createErrorFromUnknown(original);

      expect(error.code).toBe(ERROR_CODES.DB_CONNECTION_FAILED);
      expect(error.details).toBe("Connection failed");
      expect(error.retryable).toBe(true);
    });

    it("should create error with fallback code", () => {
      const original = new Error("Some error");
      const error = createErrorFromUnknown(
        original,
        ERROR_CODES.VALIDATION_FAILED
      );

      expect(error.code).toBe(ERROR_CODES.VALIDATION_FAILED);
    });

    it("should create error with custom message", () => {
      const original = new Error("Original error");
      const error = createErrorFromUnknown(
        original,
        ERROR_CODES.DB_QUERY_FAILED,
        "Custom message"
      );

      expect(error.message).toBe("Custom message");
      expect(error.details).toBe("Original error");
    });

    it("should handle string errors", () => {
      const error = createErrorFromUnknown("String error");

      expect(error.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      expect(error.details).toBe("String error");
    });
  });

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  describe("isRetryable", () => {
    it("should return true for retryable errors", () => {
      const error = createError(ERROR_CODES.DB_CONNECTION_FAILED);
      expect(isRetryable(error)).toBe(true);
    });

    it("should return false for non-retryable errors", () => {
      const error = createError(ERROR_CODES.VALIDATION_FAILED);
      expect(isRetryable(error)).toBe(false);
    });
  });

  describe("getUserMessage", () => {
    it("should return user-friendly message", () => {
      const error = createError(ERROR_CODES.DB_CONNECTION_FAILED);
      const message = getUserMessage(error);

      expect(message).toBe("Unable to connect to the database. Please try again.");
    });
  });

  describe("getErrorCode", () => {
    it("should return error code", () => {
      const error = createError(ERROR_CODES.BUSINESS_BOOKING_CONFLICT);
      const code = getErrorCode(error);

      expect(code).toBe("BIZ_4001");
    });
  });

  // ============================================================================
  // ERROR METADATA VERIFICATION
  // ============================================================================

  describe("Error Metadata", () => {
    it("should mark database connection errors as retryable", () => {
      const error = createError(ERROR_CODES.DB_CONNECTION_FAILED);
      expect(error.retryable).toBe(true);
    });

    it("should mark validation errors as non-retryable", () => {
      const error = createError(ERROR_CODES.VALIDATION_FAILED);
      expect(error.retryable).toBe(false);
    });

    it("should mark network timeout as retryable", () => {
      const error = createError(ERROR_CODES.NETWORK_TIMEOUT);
      expect(error.retryable).toBe(true);
    });

    it("should mark booking conflicts as non-retryable", () => {
      const error = createError(ERROR_CODES.BUSINESS_BOOKING_CONFLICT);
      expect(error.retryable).toBe(false);
    });

    it("should mark capacity exceeded as non-retryable", () => {
      const error = createError(ERROR_CODES.BUSINESS_CAPACITY_EXCEEDED);
      expect(error.retryable).toBe(false);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("Edge Cases", () => {
    it("should handle null error", () => {
      const code = detectErrorCode(null);
      expect(code).toBe(ERROR_CODES.UNKNOWN_ERROR);
    });

    it("should handle undefined error", () => {
      const code = detectErrorCode(undefined);
      expect(code).toBe(ERROR_CODES.UNKNOWN_ERROR);
    });

    it("should handle empty error message", () => {
      const error = new Error("");
      const code = detectErrorCode(error);
      expect(code).toBe(ERROR_CODES.UNKNOWN_ERROR);
    });

    it("should create error with very long details", () => {
      const longDetails = "A".repeat(10000);
      const error = createError(
        ERROR_CODES.DB_QUERY_FAILED,
        "Query failed",
        longDetails
      );

      expect(error.details).toBe(longDetails);
    });
  });
});