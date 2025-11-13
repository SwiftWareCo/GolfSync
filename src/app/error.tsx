"use client";

/**
 * Route Error Handler
 *
 * This component is used by Next.js to handle errors that occur
 * within route segments (pages and layouts).
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
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
        type: "route_error",
      },
      extra: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-8">
        <div className="mb-4 text-center text-6xl">⚠️</div>
        <h2 className="mb-2 text-center text-2xl font-bold text-red-900">
          Something went wrong
        </h2>
        <p className="mb-6 text-center text-red-700">
          We apologize for the inconvenience. The error has been reported to
          our team.
        </p>

        {process.env.NODE_ENV === "development" && (
          <details className="mb-6">
            <summary className="cursor-pointer font-semibold text-red-900">
              Error Details (Development Only)
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-red-100 p-4 text-sm text-red-900">
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
            className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-700"
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
  );
}