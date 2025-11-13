/**
 * Next.js Instrumentation
 *
 * This file is used by Next.js to register instrumentation hooks.
 * It's called once when the Next.js server starts up.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only initialize Sentry in server/edge runtime, not in client
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}