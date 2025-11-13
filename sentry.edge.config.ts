import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Edge Runtime Configuration
 *
 * This configuration is used for Edge Runtime (middleware, edge functions).
 * Edge runtime has different constraints than Node.js or browser environments.
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

  // Before sending events, you can modify or filter them
  beforeSend(event, hint) {
    // Filter sensitive data from edge runtime errors
    if (event.request?.headers) {
      // Remove sensitive headers
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["x-api-key"];
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Expected middleware errors
    "401",
    "403",
  ],
});