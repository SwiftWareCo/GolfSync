import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Client-Side Configuration
 *
 * This configuration is used for the browser/client-side of the application.
 * It captures errors, performance data, and user feedback from the client.
 */

Sentry.init({
  // Your Sentry DSN (Data Source Name)
  // This should be set in your .env file as NEXT_PUBLIC_SENTRY_DSN
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment name
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",

  // Tracing - Adjust the sample rate in production (0.1 = 10% of transactions)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session Replay - Captures user sessions for debugging
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Capture replays for 100% of sessions with errors
  replaysOnErrorSampleRate: 1.0,

  // Debug mode - Enable detailed logging in development
  debug: process.env.NODE_ENV === "development",

  // Integrations
  integrations: [
    // Replay integration for session recording
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),

    // Browser tracing for performance monitoring
    Sentry.browserTracingIntegration({
      // Trace HTTP requests
      traceFetch: true,
      traceXHR: true,
    }),

    // User feedback integration
    Sentry.feedbackIntegration({
      colorScheme: "system",
      isNameRequired: true,
      isEmailRequired: true,
    }),
  ],

  // Before sending events, you can modify or filter them
  beforeSend(event, hint) {
    // Filter out specific errors or add custom logic
    if (event.exception) {
      const error = hint.originalException;

      // Don't send errors from browser extensions
      if (error && typeof error === "object" && "stack" in error) {
        const stack = error.stack as string;
        if (stack?.includes("chrome-extension://") || stack?.includes("moz-extension://")) {
          return null;
        }
      }
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Browser extensions
    "top.GLOBALS",
    "chrome-extension",
    "moz-extension",
    // Network errors that are expected
    "NetworkError",
    "Failed to fetch",
    "Load failed",
    // ResizeObserver loop errors (harmless)
    "ResizeObserver loop",
  ],

  // Allow URLs - only capture errors from your domain
  allowUrls: process.env.NODE_ENV === "production"
    ? [
        /https?:\/\/(.*)\.yourdomain\.com/,
      ]
    : undefined,
});