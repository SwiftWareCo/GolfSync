/**
 * Error Codes and Standard Error Handling
 *
 * Provides consistent error codes, types, and handling across all server actions.
 * This improves debugging, user feedback, and support troubleshooting.
 */

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Error code categories for consistent error identification
 */
export const ERROR_CODES = {
  // Database Errors (1000-1999)
  DB_CONNECTION_FAILED: "DB_1001",
  DB_QUERY_FAILED: "DB_1002",
  DB_CONSTRAINT_VIOLATION: "DB_1003",
  DB_RECORD_NOT_FOUND: "DB_1004",
  DB_DUPLICATE_ENTRY: "DB_1005",
  DB_TRANSACTION_FAILED: "DB_1006",

  // Authentication & Authorization Errors (2000-2999)
  AUTH_UNAUTHORIZED: "AUTH_2001",
  AUTH_FORBIDDEN: "AUTH_2002",
  AUTH_SESSION_EXPIRED: "AUTH_2003",
  AUTH_INVALID_CREDENTIALS: "AUTH_2004",
  AUTH_USER_NOT_FOUND: "AUTH_2005",

  // Validation Errors (3000-3999)
  VALIDATION_FAILED: "VAL_3001",
  VALIDATION_REQUIRED_FIELD: "VAL_3002",
  VALIDATION_INVALID_FORMAT: "VAL_3003",
  VALIDATION_OUT_OF_RANGE: "VAL_3004",
  VALIDATION_INVALID_DATE: "VAL_3005",

  // Business Logic Errors (4000-4999)
  BUSINESS_BOOKING_CONFLICT: "BIZ_4001",
  BUSINESS_CAPACITY_EXCEEDED: "BIZ_4002",
  BUSINESS_RESTRICTION_VIOLATED: "BIZ_4003",
  BUSINESS_INVALID_STATE: "BIZ_4004",
  BUSINESS_DUPLICATE_BOOKING: "BIZ_4005",
  BUSINESS_PAST_DATE: "BIZ_4006",
  BUSINESS_LOTTERY_CLOSED: "BIZ_4007",
  BUSINESS_ALREADY_ENTERED: "BIZ_4008",

  // Network & External Service Errors (5000-5999)
  NETWORK_REQUEST_FAILED: "NET_5001",
  NETWORK_TIMEOUT: "NET_5002",
  NETWORK_CONNECTION_LOST: "NET_5003",
  EXTERNAL_API_FAILED: "EXT_5004",
  EXTERNAL_WEATHER_API_FAILED: "EXT_5005",

  // System Errors (6000-6999)
  SYSTEM_INTERNAL_ERROR: "SYS_6001",
  SYSTEM_NOT_IMPLEMENTED: "SYS_6002",
  SYSTEM_MAINTENANCE: "SYS_6003",
  SYSTEM_RATE_LIMITED: "SYS_6004",

  // Unknown/Generic Errors (9000-9999)
  UNKNOWN_ERROR: "ERR_9999",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Standard action result type with enhanced error information
 */
export type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: ActionError;
};

/**
 * Detailed error information
 */
export type ActionError = {
  /** Error code for identification */
  code: ErrorCode;
  /** User-friendly error message */
  message: string;
  /** Technical details for debugging (not shown to users) */
  details?: string;
  /** Whether the error is likely transient and retryable */
  retryable: boolean;
  /** Suggested action for the user */
  userAction?: string;
  /** Timestamp of the error */
  timestamp: string;
};

/**
 * Error category metadata
 */
type ErrorCategory = {
  code: ErrorCode;
  retryable: boolean;
  defaultMessage: string;
  defaultUserAction?: string;
};

// ============================================================================
// ERROR METADATA
// ============================================================================

/**
 * Metadata for each error code
 */
const ERROR_METADATA: Record<ErrorCode, Omit<ErrorCategory, "code">> = {
  // Database Errors
  [ERROR_CODES.DB_CONNECTION_FAILED]: {
    retryable: true,
    defaultMessage: "Unable to connect to the database. Please try again.",
    defaultUserAction: "Refresh the page or try again in a moment.",
  },
  [ERROR_CODES.DB_QUERY_FAILED]: {
    retryable: true,
    defaultMessage: "A database operation failed. Please try again.",
    defaultUserAction: "Try again or contact support if the problem persists.",
  },
  [ERROR_CODES.DB_CONSTRAINT_VIOLATION]: {
    retryable: false,
    defaultMessage: "This action violates a data constraint.",
    defaultUserAction: "Check your input and try again.",
  },
  [ERROR_CODES.DB_RECORD_NOT_FOUND]: {
    retryable: false,
    defaultMessage: "The requested record was not found.",
    defaultUserAction: "Refresh the page and try again.",
  },
  [ERROR_CODES.DB_DUPLICATE_ENTRY]: {
    retryable: false,
    defaultMessage: "This record already exists.",
    defaultUserAction: "Check if the record already exists.",
  },
  [ERROR_CODES.DB_TRANSACTION_FAILED]: {
    retryable: true,
    defaultMessage: "The operation could not be completed.",
    defaultUserAction: "Try again or contact support if the problem persists.",
  },

  // Authentication & Authorization
  [ERROR_CODES.AUTH_UNAUTHORIZED]: {
    retryable: false,
    defaultMessage: "You must be logged in to perform this action.",
    defaultUserAction: "Please log in and try again.",
  },
  [ERROR_CODES.AUTH_FORBIDDEN]: {
    retryable: false,
    defaultMessage: "You don't have permission to perform this action.",
    defaultUserAction: "Contact an administrator if you need access.",
  },
  [ERROR_CODES.AUTH_SESSION_EXPIRED]: {
    retryable: false,
    defaultMessage: "Your session has expired.",
    defaultUserAction: "Please log in again.",
  },
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: {
    retryable: false,
    defaultMessage: "Invalid credentials provided.",
    defaultUserAction: "Check your credentials and try again.",
  },
  [ERROR_CODES.AUTH_USER_NOT_FOUND]: {
    retryable: false,
    defaultMessage: "User account not found.",
    defaultUserAction: "Contact support for assistance.",
  },

  // Validation Errors
  [ERROR_CODES.VALIDATION_FAILED]: {
    retryable: false,
    defaultMessage: "The data you entered is invalid.",
    defaultUserAction: "Please check your input and try again.",
  },
  [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: {
    retryable: false,
    defaultMessage: "Required fields are missing.",
    defaultUserAction: "Fill in all required fields.",
  },
  [ERROR_CODES.VALIDATION_INVALID_FORMAT]: {
    retryable: false,
    defaultMessage: "The format of the data is invalid.",
    defaultUserAction: "Check the format and try again.",
  },
  [ERROR_CODES.VALIDATION_OUT_OF_RANGE]: {
    retryable: false,
    defaultMessage: "The value is outside the allowed range.",
    defaultUserAction: "Enter a value within the allowed range.",
  },
  [ERROR_CODES.VALIDATION_INVALID_DATE]: {
    retryable: false,
    defaultMessage: "The date provided is invalid.",
    defaultUserAction: "Enter a valid date.",
  },

  // Business Logic Errors
  [ERROR_CODES.BUSINESS_BOOKING_CONFLICT]: {
    retryable: false,
    defaultMessage: "You already have a booking for this time.",
    defaultUserAction: "Choose a different time slot.",
  },
  [ERROR_CODES.BUSINESS_CAPACITY_EXCEEDED]: {
    retryable: false,
    defaultMessage: "This time slot is fully booked.",
    defaultUserAction: "Choose a different time slot.",
  },
  [ERROR_CODES.BUSINESS_RESTRICTION_VIOLATED]: {
    retryable: false,
    defaultMessage: "Your membership restrictions prevent this booking.",
    defaultUserAction: "Contact an administrator for assistance.",
  },
  [ERROR_CODES.BUSINESS_INVALID_STATE]: {
    retryable: false,
    defaultMessage: "This action cannot be performed in the current state.",
    defaultUserAction: "Refresh the page and try again.",
  },
  [ERROR_CODES.BUSINESS_DUPLICATE_BOOKING]: {
    retryable: false,
    defaultMessage: "You are already booked in this teesheet.",
    defaultUserAction: "You can only have one booking per teesheet.",
  },
  [ERROR_CODES.BUSINESS_PAST_DATE]: {
    retryable: false,
    defaultMessage: "Cannot book for dates in the past.",
    defaultUserAction: "Select a future date.",
  },
  [ERROR_CODES.BUSINESS_LOTTERY_CLOSED]: {
    retryable: false,
    defaultMessage: "The lottery entry period has ended.",
    defaultUserAction: "Wait for the next lottery opening.",
  },
  [ERROR_CODES.BUSINESS_ALREADY_ENTERED]: {
    retryable: false,
    defaultMessage: "You have already entered this lottery.",
    defaultUserAction: "You can only enter once per lottery.",
  },

  // Network & External Service Errors
  [ERROR_CODES.NETWORK_REQUEST_FAILED]: {
    retryable: true,
    defaultMessage: "Network request failed.",
    defaultUserAction: "Check your internet connection and try again.",
  },
  [ERROR_CODES.NETWORK_TIMEOUT]: {
    retryable: true,
    defaultMessage: "The request timed out.",
    defaultUserAction: "Try again in a moment.",
  },
  [ERROR_CODES.NETWORK_CONNECTION_LOST]: {
    retryable: true,
    defaultMessage: "Network connection was lost.",
    defaultUserAction: "Check your internet connection and try again.",
  },
  [ERROR_CODES.EXTERNAL_API_FAILED]: {
    retryable: true,
    defaultMessage: "An external service is unavailable.",
    defaultUserAction: "Try again later.",
  },
  [ERROR_CODES.EXTERNAL_WEATHER_API_FAILED]: {
    retryable: true,
    defaultMessage: "Weather data is temporarily unavailable.",
    defaultUserAction: "Weather will update shortly.",
  },

  // System Errors
  [ERROR_CODES.SYSTEM_INTERNAL_ERROR]: {
    retryable: true,
    defaultMessage: "An unexpected error occurred.",
    defaultUserAction: "Please try again or contact support.",
  },
  [ERROR_CODES.SYSTEM_NOT_IMPLEMENTED]: {
    retryable: false,
    defaultMessage: "This feature is not yet available.",
    defaultUserAction: "Contact support for more information.",
  },
  [ERROR_CODES.SYSTEM_MAINTENANCE]: {
    retryable: false,
    defaultMessage: "The system is undergoing maintenance.",
    defaultUserAction: "Please try again later.",
  },
  [ERROR_CODES.SYSTEM_RATE_LIMITED]: {
    retryable: true,
    defaultMessage: "Too many requests. Please slow down.",
    defaultUserAction: "Wait a moment before trying again.",
  },

  // Unknown Errors
  [ERROR_CODES.UNKNOWN_ERROR]: {
    retryable: true,
    defaultMessage: "An unknown error occurred.",
    defaultUserAction: "Please try again or contact support.",
  },
};

// ============================================================================
// ERROR CREATION HELPERS
// ============================================================================

/**
 * Create a standardized error response
 */
export function createError(
  code: ErrorCode,
  customMessage?: string,
  details?: string,
  customUserAction?: string
): ActionError {
  const metadata = ERROR_METADATA[code];

  return {
    code,
    message: customMessage || metadata.defaultMessage,
    details,
    retryable: metadata.retryable,
    userAction: customUserAction || metadata.defaultUserAction,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a success response
 */
export function createSuccess<T>(data?: T): ActionResult<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Create a failure response
 */
export function createFailure(error: ActionError): ActionResult {
  return {
    success: false,
    error,
  };
}

// ============================================================================
// ERROR DETECTION HELPERS
// ============================================================================

/**
 * Detect error code from error object
 */
export function detectErrorCode(error: unknown): ErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Database errors
    if (message.includes("connection") || message.includes("econnrefused")) {
      return ERROR_CODES.DB_CONNECTION_FAILED;
    }
    if (message.includes("timeout")) {
      return ERROR_CODES.NETWORK_TIMEOUT;
    }
    if (message.includes("unique constraint") || message.includes("duplicate")) {
      return ERROR_CODES.DB_DUPLICATE_ENTRY;
    }
    if (message.includes("foreign key") || message.includes("constraint")) {
      return ERROR_CODES.DB_CONSTRAINT_VIOLATION;
    }
    if (message.includes("not found")) {
      return ERROR_CODES.DB_RECORD_NOT_FOUND;
    }

    // Authentication errors
    if (message.includes("unauthorized") || message.includes("authentication")) {
      return ERROR_CODES.AUTH_UNAUTHORIZED;
    }
    if (message.includes("forbidden") || message.includes("permission")) {
      return ERROR_CODES.AUTH_FORBIDDEN;
    }

    // Network errors
    if (message.includes("network") || message.includes("fetch failed")) {
      return ERROR_CODES.NETWORK_REQUEST_FAILED;
    }
  }

  return ERROR_CODES.UNKNOWN_ERROR;
}

/**
 * Create an error from an unknown error object
 */
export function createErrorFromUnknown(
  error: unknown,
  fallbackCode?: ErrorCode,
  customMessage?: string
): ActionError {
  const code = fallbackCode || detectErrorCode(error);
  const details = error instanceof Error ? error.message : String(error);

  return createError(code, customMessage, details);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Check if an error is retryable
 */
export function isRetryable(error: ActionError): boolean {
  return error.retryable;
}

/**
 * Get user-friendly error message
 */
export function getUserMessage(error: ActionError): string {
  return error.message;
}

/**
 * Get error code for logging/support
 */
export function getErrorCode(error: ActionError): string {
  return error.code;
}
