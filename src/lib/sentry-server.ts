/**
 * Sentry Server-Side Utilities
 *
 * Helper functions for integrating Sentry with Clerk authentication
 * and server-side operations.
 */

import * as Sentry from "@sentry/nextjs";
import { currentUser } from "@clerk/nextjs/server";

/**
 * Initialize Sentry user context from Clerk in server components/actions
 *
 * Call this at the beginning of server actions or API routes to
 * automatically set user context in Sentry.
 */
export async function initSentryUser() {
  try {
    const user = await currentUser();

    if (!user) {
      Sentry.setUser(null);
      return null;
    }

    Sentry.setUser({
      id: user.id,
      username: user.username ?? undefined,
      email: user.emailAddresses[0]?.emailAddress ?? undefined,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      role: (user.publicMetadata?.role as string) ?? undefined,
      isAdmin: (user.publicMetadata?.isAdmin as boolean) ?? undefined,
      isMember: (user.publicMetadata?.isMember as boolean) ?? undefined,
    });

    return user;
  } catch (error) {
    // Silently fail - don't break the app if Sentry fails
    console.error("Failed to initialize Sentry user context:", error);
    return null;
  }
}

/**
 * Wrapper for server actions that automatically:
 * - Initializes Sentry user context
 * - Tracks performance
 * - Captures errors
 *
 * @example
 * export const createMember = withSentry("createMember", async (data) => {
 *   // Your server action logic here
 * });
 */
export function withSentry<TArgs extends any[], TReturn>(
  actionName: string,
  action: (...args: TArgs) => Promise<TReturn>
) {
  return async (...args: TArgs): Promise<TReturn> => {
    return Sentry.startSpan(
      {
        name: `server_action.${actionName}`,
        op: "function.server_action",
      },
      async () => {
        try {
          // Initialize user context
          await initSentryUser();

          // Add breadcrumb
          Sentry.addBreadcrumb({
            message: `Server action: ${actionName}`,
            category: "server_action",
            data: {
              actionName,
              argsLength: args.length,
            },
          });

          // Execute the action
          const result = await action(...args);
          return result;
        } catch (error) {
          // Capture the error
          Sentry.captureException(error, {
            tags: {
              type: "server_action",
              action: actionName,
            },
            extra: {
              actionName,
              argsLength: args.length,
            },
          });

          // Re-throw the error so the caller can handle it
          throw error;
        }
      }
    );
  };
}

/**
 * Wrapper for API route handlers that automatically:
 * - Initializes Sentry user context
 * - Tracks performance
 * - Captures errors
 *
 * @example
 * export const GET = withSentryAPI("GET /api/members", async (request) => {
 *   // Your API route logic here
 * });
 */
export function withSentryAPI<TArgs extends any[], TReturn>(
  routeName: string,
  handler: (...args: TArgs) => Promise<TReturn>
) {
  return async (...args: TArgs): Promise<TReturn> => {
    return Sentry.startSpan(
      {
        name: `api.${routeName}`,
        op: "http.server",
      },
      async () => {
        try {
          // Initialize user context
          await initSentryUser();

          // Add breadcrumb
          Sentry.addBreadcrumb({
            message: `API route: ${routeName}`,
            category: "api",
            data: {
              routeName,
            },
          });

          // Execute the handler
          const result = await handler(...args);
          return result;
        } catch (error) {
          // Capture the error
          Sentry.captureException(error, {
            tags: {
              type: "api_route",
              route: routeName,
            },
            extra: {
              routeName,
            },
          });

          // Re-throw the error so the caller can handle it
          throw error;
        }
      }
    );
  };
}

/**
 * Wrapper for database operations that automatically:
 * - Tracks performance
 * - Captures errors
 * - Adds breadcrumbs
 *
 * @example
 * const members = await withSentryDB("select", "members", async () => {
 *   return db.select().from(members);
 * });
 */
export async function withSentryDB<T>(
  operation: string,
  table: string,
  query: () => Promise<T>
): Promise<T> {
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
        // Add breadcrumb
        Sentry.addBreadcrumb({
          message: `Database ${operation} on ${table}`,
          category: "db",
          data: {
            operation,
            table,
          },
        });

        // Execute the query
        const result = await query();
        return result;
      } catch (error) {
        // Capture the error
        Sentry.captureException(error, {
          tags: {
            type: "database_error",
            operation,
            table,
          },
          extra: {
            operation,
            table,
          },
        });

        // Re-throw the error
        throw error;
      }
    }
  );
}
