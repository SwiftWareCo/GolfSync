/**
 * Sentry Utility Functions
 *
 * Helper functions for error tracking, performance monitoring,
 * and user context management with Sentry.
 */

import * as Sentry from "@sentry/nextjs";
import type { User } from "@clerk/nextjs/server";

// ============================================================================
// USER CONTEXT
// ============================================================================

/**
 * Set user context in Sentry from Clerk user object
 * This enriches error reports with user information
 */
export function setSentryUser(user: User | null) {
  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id,
    username: user.username ?? undefined,
    email: user.emailAddresses[0]?.emailAddress ?? undefined,
    // Add custom data from Clerk
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    role: (user.publicMetadata?.role as string) ?? undefined,
  });
}

/**
 * Clear user context in Sentry (e.g., on logout)
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Set additional user context data
 */
export function setSentryUserContext(data: Record<string, any>) {
  Sentry.setContext("user_data", data);
}

// ============================================================================
// ERROR TRACKING
// ============================================================================

/**
 * Capture an exception with optional context
 *
 * @param error - The error to capture
 * @param context - Additional context data
 * @param level - Severity level (error, warning, info, etc.)
 */
export function captureException(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: Sentry.SeverityLevel;
    fingerprint?: string[];
  }
) {
  const { tags, extra, level, fingerprint } = context || {};

  Sentry.captureException(error, {
    level: level || "error",
    tags,
    extra,
    fingerprint,
  });
}

/**
 * Capture a message with optional context
 *
 * @param message - The message to capture
 * @param context - Additional context data
 */
export function captureMessage(
  message: string,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: Sentry.SeverityLevel;
  }
) {
  const { tags, extra, level } = context || {};

  Sentry.captureMessage(message, {
    level: level || "info",
    tags,
    extra,
  });
}

/**
 * Capture an error from a server action with request context
 */
export function captureServerActionError(
  error: Error | unknown,
  actionName: string,
  params?: Record<string, any>
) {
  captureException(error, {
    tags: {
      type: "server_action",
      action: actionName,
    },
    extra: {
      actionName,
      params,
    },
    level: "error",
  });
}

/**
 * Capture an API route error with request details
 */
export function captureAPIError(
  error: Error | unknown,
  endpoint: string,
  method: string,
  statusCode?: number
) {
  captureException(error, {
    tags: {
      type: "api_error",
      endpoint,
      method,
      status_code: statusCode?.toString() || "unknown",
    },
    extra: {
      endpoint,
      method,
      statusCode,
    },
    level: "error",
  });
}

/**
 * Capture a database error with query context
 */
export function captureDatabaseError(
  error: Error | unknown,
  operation: string,
  table?: string,
  query?: string
) {
  captureException(error, {
    tags: {
      type: "database_error",
      operation,
      table: table || "unknown",
    },
    extra: {
      operation,
      table,
      query: query?.substring(0, 500), // Limit query length
    },
    level: "error",
  });
}

// ============================================================================
// BREADCRUMBS
// ============================================================================

/**
 * Add a breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>,
  level: Sentry.SeverityLevel = "info"
) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Add a navigation breadcrumb
 */
export function addNavigationBreadcrumb(from: string, to: string) {
  addBreadcrumb(`Navigated from ${from} to ${to}`, "navigation", {
    from,
    to,
  });
}

/**
 * Add a user action breadcrumb
 */
export function addUserActionBreadcrumb(
  action: string,
  data?: Record<string, any>
) {
  addBreadcrumb(action, "user_action", data);
}

/**
 * Add a data operation breadcrumb (CRUD operations)
 */
export function addDataOperationBreadcrumb(
  operation: "create" | "read" | "update" | "delete",
  table: string,
  recordId?: number | string
) {
  addBreadcrumb(
    `${operation.toUpperCase()} operation on ${table}`,
    "data_operation",
    {
      operation,
      table,
      recordId,
    }
  );
}

// ============================================================================
// CONTEXT & TAGS
// ============================================================================

/**
 * Set custom context data
 */
export function setContext(name: string, data: Record<string, any>) {
  Sentry.setContext(name, data);
}

/**
 * Set a custom tag
 */
export function setTag(key: string, value: string) {
  Sentry.setTag(key, value);
}

/**
 * Set multiple tags at once
 */
export function setTags(tags: Record<string, string>) {
  Sentry.setTags(tags);
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Start a performance transaction
 *
 * @param name - Transaction name
 * @param op - Operation type (e.g., "http.server", "db.query")
 * @returns Transaction object
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Start a span within the current transaction
 *
 * @param name - Span name
 * @param op - Operation type
 */
export function startSpan<T>(
  name: string,
  op: string,
  callback: (span: Sentry.Span) => T
): T {
  return Sentry.startSpan(
    {
      name,
      op,
    },
    callback
  );
}

/**
 * Measure the duration of an async operation
 *
 * @param name - Operation name
 * @param operation - The async function to measure
 */
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op: "function",
    },
    async () => {
      return await operation();
    }
  );
}

/**
 * Measure the duration of a synchronous operation
 *
 * @param name - Operation name
 * @param operation - The function to measure
 */
export function measureSync<T>(name: string, operation: () => T): T {
  return Sentry.startSpan(
    {
      name,
      op: "function",
    },
    () => {
      return operation();
    }
  );
}

/**
 * Measure a database query
 */
export async function measureDatabaseQuery<T>(
  query: string,
  operation: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name: query.substring(0, 100), // Limit query length in span name
      op: "db.query",
      attributes: {
        "db.system": "postgresql",
      },
    },
    async () => {
      return await operation();
    }
  );
}

// ============================================================================
// CUSTOM INSTRUMENTORS
// ============================================================================

/**
 * Instrument a server action with automatic error tracking
 * and performance monitoring
 *
 * @param name - Action name for identification
 * @param action - The server action to instrument
 */
export function instrumentServerAction<TArgs extends any[], TReturn>(
  name: string,
  action: (...args: TArgs) => Promise<TReturn>
) {
  return async (...args: TArgs): Promise<TReturn> => {
    return Sentry.startSpan(
      {
        name: `server_action.${name}`,
        op: "server_action",
      },
      async () => {
        try {
          addBreadcrumb(`Server action: ${name}`, "server_action", {
            args: JSON.stringify(args).substring(0, 500),
          });

          const result = await action(...args);
          return result;
        } catch (error) {
          captureServerActionError(error, name, {
            args: JSON.stringify(args).substring(0, 500),
          });
          throw error;
        }
      }
    );
  };
}

/**
 * Instrument a database operation with automatic error tracking
 * and performance monitoring
 *
 * @param operation - Operation name (e.g., "insert", "select", "update")
 * @param table - Table name
 * @param query - The database query function
 */
export function instrumentDatabaseQuery<T>(
  operation: string,
  table: string,
  query: () => Promise<T>
) {
  return Sentry.startSpan(
    {
      name: `${operation} ${table}`,
      op: "db.query",
      attributes: {
        "db.system": "postgresql",
        "db.operation": operation,
        "db.table": table,
      },
    },
    async () => {
      try {
        addDataOperationBreadcrumb(operation as any, table);
        const result = await query();
        return result;
      } catch (error) {
        captureDatabaseError(error, operation, table);
        throw error;
      }
    }
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if Sentry is enabled (DSN is configured)
 */
export function isSentryEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_SENTRY_DSN || !!process.env.SENTRY_DSN;
}

/**
 * Get the current Sentry Hub (for advanced usage)
 */
export function getCurrentHub() {
  return Sentry.getCurrentHub();
}

/**
 * Flush pending events to Sentry (useful before process exit)
 *
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function flush(timeout = 2000): Promise<boolean> {
  return Sentry.flush(timeout);
}

/**
 * Close the Sentry client (cleanup)
 *
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function close(timeout = 2000): Promise<boolean> {
  return Sentry.close(timeout);
}
