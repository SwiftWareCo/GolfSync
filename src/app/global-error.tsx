"use client";

/**
 * Global Error Handler
 *
 * This component is used by Next.js to handle errors that occur
 * at the root of the application. It replaces the root layout when
 * an error occurs.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-errors-in-root-layouts
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error, {
      tags: {
        type: "global_error",
      },
      extra: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
            <div className="mb-4 text-center text-6xl">⚠️</div>
            <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
              Application Error
            </h1>
            <p className="mb-6 text-center text-gray-700">
              Something went wrong with the application. The error has been
              reported to our team.
            </p>

            {process.env.NODE_ENV === "development" && (
              <details className="mb-6">
                <summary className="cursor-pointer font-semibold text-gray-900">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-gray-100 p-4 text-sm text-gray-900">
                  {error.toString()}
                  {"\n\n"}
                  {error.stack}
                  {error.digest && `\n\nDigest: ${error.digest}`}
                </pre>
              </details>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={reset}
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Go to Homepage
              </button>
            </div>

            {error.digest && (
              <p className="mt-6 text-center text-sm text-gray-500">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}