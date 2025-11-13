/**
 * Server Action Helper Utilities
 *
 * Provides helper functions for wrapping server actions with:
 * - Standardized error handling
 * - Automatic error code detection
 * - Sentry integration
 * - Retry logic for transient errors
 */

import {
  type ActionResult,
  type ErrorCode,
  ERROR_CODES,
  createSuccess,
  createFailure,
  createErrorFromUnknown,
  createError,
} from "./errors";
import { retry, retryDatabase } from "./retry";
import * as Sentry from "@sentry/nextjs";

// ============================================================================
// SERVER ACTION WRAPPER
// ============================================================================

/**
 * Wrap a server action with automatic error handling
 *
 * @example
 * export const createMember = wrapServerAction(
 *   async (data: MemberData) => {
 *     const [member] = await db.insert(members).values(data).returning();
 *     return member;
 *   },
 *   "createMember"
 * );
 */
export function wrapServerAction<TArgs extends any[], TReturn>(
  action: (...args: TArgs) => Promise<TReturn>,
  actionName: string,
  options: {
    /** Whether to enable retry for transient errors */
    enableRetry?: boolean;
    /** Custom error code for specific failures */
    errorCode?: ErrorCode;
    /** Whether to log errors to Sentry */
    logToSentry?: boolean;
  } = {}
): (...args: TArgs) => Promise<ActionResult<TReturn>> {
  const { enableRetry = false, errorCode, logToSentry = true } = options;

  return async (...args: TArgs): Promise<ActionResult<TReturn>> => {
    try {
      // Execute the action (with optional retry)
      const result = enableRetry
        ? await retry(() => action(...args))
        : await action(...args);

      return createSuccess(result);
    } catch (error) {
      // Log to console in development
      if (process.env.NODE_ENV === "development") {
        console.error(`[${actionName}] Error:`, error);
      }

      // Log to Sentry
      if (logToSentry) {
        Sentry.captureException(error, {
          tags: {
            type: "server_action",
            action: actionName,
          },
        });
      }

      // Create standardized error
      const actionError = createErrorFromUnknown(error, errorCode);

      return createFailure(actionError);
    }
  };
}

// ============================================================================
// DATABASE OPERATION WRAPPER
// ============================================================================

/**
 * Wrap a database operation with retry logic and error handling
 *
 * @example
 * const members = await wrapDatabaseOperation(
 *   () => db.select().from(members),
 *   "getMembers"
 * );
 */
export async function wrapDatabaseOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<ActionResult<T>> {
  try {
    const result = await retryDatabase(operation);
    return createSuccess(result);
  } catch (error) {
    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error(`[DB:${operationName}] Error:`, error);
    }

    // Log to Sentry
    Sentry.captureException(error, {
      tags: {
        type: "database_operation",
        operation: operationName,
      },
    });

    // Detect database error type
    const errorCode = detectDatabaseErrorCode(error);
    const actionError = createErrorFromUnknown(error, errorCode);

    return createFailure(actionError);
  }
}

// ============================================================================
// VALIDATION WRAPPER
// ============================================================================

/**
 * Wrap a function with validation
 *
 * @example
 * return withValidation(
 *   data,
 *   memberSchema,
 *   async (validatedData) => {
 *     // Use validatedData safely
 *   }
 * );
 */
export async function withValidation<TData, TReturn>(
  data: unknown,
  validate: (data: unknown) => TData,
  action: (validatedData: TData) => Promise<TReturn>
): Promise<ActionResult<TReturn>> {
  try {
    // Validate the data
    const validatedData = validate(data);

    // Execute the action
    const result = await action(validatedData);

    return createSuccess(result);
  } catch (error) {
    // Handle validation errors
    if (error instanceof Error && error.name === "ZodError") {
      const actionError = createError(
        ERROR_CODES.VALIDATION_FAILED,
        "Invalid data provided",
        error.message
      );
      return createFailure(actionError);
    }

    // Handle other errors
    const actionError = createErrorFromUnknown(error);
    return createFailure(actionError);
  }
}

// ============================================================================
// ERROR DETECTION HELPERS
// ============================================================================

/**
 * Detect specific database error code from error object
 */
function detectDatabaseErrorCode(error: unknown): ErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("connection") || message.includes("econnrefused")) {
      return ERROR_CODES.DB_CONNECTION_FAILED;
    }

    if (message.includes("timeout")) {
      return ERROR_CODES.NETWORK_TIMEOUT;
    }

    if (
      message.includes("unique constraint") ||
      message.includes("duplicate key")
    ) {
      return ERROR_CODES.DB_DUPLICATE_ENTRY;
    }

    if (
      message.includes("foreign key") ||
      message.includes("constraint") ||
      message.includes("violates")
    ) {
      return ERROR_CODES.DB_CONSTRAINT_VIOLATION;
    }

    if (message.includes("not found") || message.includes("no rows")) {
      return ERROR_CODES.DB_RECORD_NOT_FOUND;
    }
  }

  return ERROR_CODES.DB_QUERY_FAILED;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a booking conflict error
 */
export function createBookingConflictError(message?: string) {
  return createFailure(
    createError(
      ERROR_CODES.BUSINESS_BOOKING_CONFLICT,
      message || "You already have a booking for this time",
      undefined,
      "Choose a different time slot"
    )
  );
}

/**
 * Create a capacity exceeded error
 */
export function createCapacityExceededError(message?: string) {
  return createFailure(
    createError(
      ERROR_CODES.BUSINESS_CAPACITY_EXCEEDED,
      message || "This time slot is fully booked",
      undefined,
      "Choose a different time slot"
    )
  );
}

/**
 * Create a restriction violated error
 */
export function createRestrictionError(message?: string) {
  return createFailure(
    createError(
      ERROR_CODES.BUSINESS_RESTRICTION_VIOLATED,
      message || "Your membership restrictions prevent this booking",
      undefined,
      "Contact an administrator for assistance"
    )
  );
}

/**
 * Create an unauthorized error
 */
export function createUnauthorizedError(message?: string) {
  return createFailure(
    createError(
      ERROR_CODES.AUTH_UNAUTHORIZED,
      message || "You must be logged in to perform this action",
      undefined,
      "Please log in and try again"
    )
  );
}

/**
 * Create a forbidden error
 */
export function createForbiddenError(message?: string) {
  return createFailure(
    createError(
      ERROR_CODES.AUTH_FORBIDDEN,
      message || "You don't have permission to perform this action",
      undefined,
      "Contact an administrator if you need access"
    )
  );
}

/**
 * Create a validation error
 */
export function createValidationError(message: string, details?: string) {
  return createFailure(
    createError(
      ERROR_CODES.VALIDATION_FAILED,
      message,
      details,
      "Please check your input and try again"
    )
  );
}

/**
 * Create a not found error
 */
export function createNotFoundError(resource: string) {
  return createFailure(
    createError(
      ERROR_CODES.DB_RECORD_NOT_FOUND,
      `${resource} not found`,
      undefined,
      "Refresh the page and try again"
    )
  );
}

/**
 * Create a duplicate entry error
 */
export function createDuplicateError(resource: string) {
  return createFailure(
    createError(
      ERROR_CODES.DB_DUPLICATE_ENTRY,
      `${resource} already exists`,
      undefined,
      "Check if the record already exists"
    )
  );
}