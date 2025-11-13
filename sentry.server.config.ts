import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Server-Side Configuration
 *
 * This configuration is used for the server-side of the application.
 * It captures errors and performance data from Node.js/server actions.
 */

Sentry.init({
  // Your Sentry DSN (Data Source Name)
  dsn: process.env.SENTRY_DSN,

  // Environment name
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",

  // Tracing - Adjust the sample rate in production (0.1 = 10% of transactions)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Debug mode - Enable detailed logging in development
  debug: process.env.NODE_ENV === "development",

  // Integrations
  integrations: [
    // HTTP integration for tracing HTTP requests
    Sentry.httpIntegration({
      tracing: true,
    }),

    // Node.js profiling
    Sentry.nodeProfilingIntegration(),
  ],

  // Before sending events, you can modify or filter them
  beforeSend(event, hint) {
    // Filter sensitive data from server errors
    if (event.request?.headers) {
      // Remove sensitive headers
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["x-api-key"];
    }

    // Filter query parameters that might contain sensitive data
    if (event.request?.query_string) {
      // Remove tokens, passwords, etc. from query strings
      const sensitiveParams = ["token", "password", "api_key", "secret"];
      const queryString = event.request.query_string;

      for (const param of sensitiveParams) {
        if (queryString.includes(param)) {
          event.request.query_string = queryString.replace(
            new RegExp(`${param}=[^&]*`, "gi"),
            `${param}=[REDACTED]`
          );
        }
      }
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Database connection errors that are expected
    "ECONNREFUSED",
    "ENOTFOUND",
    // Expected API errors
    "401",
    "403",
  ],
});