/**

 * Retry Logic Utility

 *

 * Provides automatic retry functionality for operations that may fail

 * due to transient errors (network issues, temporary database issues, etc.)

 */

 

import { type ActionError, isRetryable } from "./errors";

 

// ============================================================================

// TYPES

// ============================================================================

 

export type RetryOptions = {

  /** Maximum number of retry attempts (default: 3) */

  maxRetries?: number;

  /** Initial delay in milliseconds (default: 1000ms) */

  initialDelay?: number;

  /** Maximum delay in milliseconds (default: 10000ms) */

  maxDelay?: number;

  /** Backoff multiplier (default: 2 for exponential backoff) */

  backoffMultiplier?: number;

  /** Whether to add random jitter to delays (default: true) */

  jitter?: boolean;

  /** Custom function to determine if error is retryable */

  shouldRetry?: (error: ActionError) => boolean;

  /** Callback called before each retry */

  onRetry?: (attempt: number, error: ActionError, delay: number) => void;

};

 

type RetryState = {

  attempt: number;

  lastError?: ActionError;

  totalDelay: number;

};

 

// ============================================================================

// RETRY LOGIC

// ============================================================================

 

/**

 * Calculate delay for next retry attempt using exponential backoff

 */

function calculateDelay(

  attempt: number,

  options: Required<Omit<RetryOptions, "shouldRetry" | "onRetry">>

): number {

  const { initialDelay, maxDelay, backoffMultiplier, jitter } = options;

 

  // Calculate exponential backoff

  let delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);

 

  // Cap at maximum delay

  delay = Math.min(delay, maxDelay);

 

  // Add jitter (randomness) to prevent thundering herd

  if (jitter) {

    const jitterAmount = delay * 0.2; // 20% jitter

    delay = delay + (Math.random() * jitterAmount - jitterAmount / 2);

  }

 

  return Math.floor(delay);

}

 

/**

 * Sleep for a specified duration

 */

function sleep(ms: number): Promise<void> {

  return new Promise((resolve) => setTimeout(resolve, ms));

}

 

/**

 * Retry an async operation with exponential backoff

 *

 * @param operation - The async operation to retry

 * @param options - Retry configuration options

 * @returns Result of the operation

 *

 * @example

 * const result = await retry(

 *   async () => await fetchData(),

 *   { maxRetries: 3, initialDelay: 1000 }

 * );

 */

export async function retry<T>(

  operation: () => Promise<T>,

  options: RetryOptions = {}

): Promise<T> {

  const {

    maxRetries = 3,

    initialDelay = 1000,

    maxDelay = 10000,

    backoffMultiplier = 2,

    jitter = true,

    shouldRetry = isRetryable,

    onRetry,

  } = options;

 

  const state: RetryState = {

    attempt: 0,

    totalDelay: 0,

  };

 

  while (state.attempt <= maxRetries) {

    try {

      state.attempt++;

 

      // Try the operation

      return await operation();

    } catch (error) {

      // If this was the last attempt, throw the error

      if (state.attempt > maxRetries) {

        throw error;

      }

 

      // Check if error is retryable

      const actionError = error as ActionError;

      if (!shouldRetry(actionError)) {

        throw error;

      }

 

      // Calculate delay for next attempt

      const delay = calculateDelay(state.attempt, {

        initialDelay,

        maxDelay,

        backoffMultiplier,

        jitter,

      });

 

      state.lastError = actionError;

      state.totalDelay += delay;

 

      // Call retry callback if provided

      if (onRetry) {

        onRetry(state.attempt, actionError, delay);

      }

 

      // Log retry attempt (in development)

      if (process.env.NODE_ENV === "development") {

        console.warn(

          `[Retry] Attempt ${state.attempt}/${maxRetries} failed. Retrying in ${delay}ms...`,

          actionError

        );

      }

 

      // Wait before retrying

      await sleep(delay);

    }

  }

 

  // This should never be reached, but TypeScript needs it

  throw state.lastError || new Error("Retry failed");

}

 

/**

 * Retry a Promise-returning function with exponential backoff

 *

 * This is a simpler version that works with any Promise-returning function

 *

 * @example

 * const data = await retryPromise(() => fetch('/api/data'), { maxRetries: 3 });

 */

export async function retryPromise<T>(

  promiseFn: () => Promise<T>,

  options: Omit<RetryOptions, "shouldRetry"> = {}

): Promise<T> {

  const {

    maxRetries = 3,

    initialDelay = 1000,

    maxDelay = 10000,

    backoffMultiplier = 2,

    jitter = true,

    onRetry,

  } = options;

 

  let lastError: Error | undefined;

 

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {

    try {

      return await promiseFn();

    } catch (error) {

      lastError = error as Error;

 

      // If this was the last attempt, throw the error

      if (attempt > maxRetries) {

        throw error;

      }

 

      // Calculate delay

      const delay = calculateDelay(attempt, {

        initialDelay,

        maxDelay,

        backoffMultiplier,

        jitter,

      });

 

      // Call retry callback if provided

      if (onRetry) {

        onRetry(attempt, error as ActionError, delay);

      }

 

      // Log retry attempt

      if (process.env.NODE_ENV === "development") {

        console.warn(

          `[Retry] Attempt ${attempt}/${maxRetries} failed. Retrying in ${delay}ms...`,

          error

        );

      }

 

      // Wait before retrying

      await sleep(delay);

    }

  }

 

  throw lastError;

}

 

/**

 * Create a retryable version of a function

 *

 * @example

 * const retryableFetch = withRetry(fetch, { maxRetries: 3 });

 * const data = await retryableFetch('/api/data');

 */

export function withRetry<TArgs extends any[], TReturn>(

  fn: (...args: TArgs) => Promise<TReturn>,

  options: RetryOptions = {}

): (...args: TArgs) => Promise<TReturn> {

  return async (...args: TArgs): Promise<TReturn> => {

    return retry(() => fn(...args), options);

  };

}

 

// ============================================================================

// SPECIALIZED RETRY FUNCTIONS

// ============================================================================

 

/**

 * Retry a database operation

 *

 * Uses conservative settings suitable for database operations

 */

export async function retryDatabase<T>(

  operation: () => Promise<T>,

  options: Partial<RetryOptions> = {}

): Promise<T> {

  return retry(operation, {

    maxRetries: 2, // Fewer retries for database

    initialDelay: 500, // Shorter initial delay

    maxDelay: 2000, // Cap at 2 seconds

    backoffMultiplier: 2,

    jitter: true,

    ...options,

  });

}

 

/**

 * Retry a network request

 *

 * Uses more aggressive settings suitable for network requests

 */

export async function retryNetwork<T>(

  operation: () => Promise<T>,

  options: Partial<RetryOptions> = {}

): Promise<T> {

  return retry(operation, {

    maxRetries: 3,

    initialDelay: 1000,

    maxDelay: 10000,

    backoffMultiplier: 2,

    jitter: true,

    ...options,

  });

}

 

/**

 * Retry an external API call

 *

 * Uses patient settings suitable for external APIs

 */

export async function retryExternalAPI<T>(

  operation: () => Promise<T>,

  options: Partial<RetryOptions> = {}

): Promise<T> {

  return retry(operation, {

    maxRetries: 4,

    initialDelay: 2000,

    maxDelay: 30000,

    backoffMultiplier: 2,

    jitter: true,

    ...options,

  });

}

 

// ============================================================================

// UTILITY FUNCTIONS

// ============================================================================

 

/**

 * Check if an operation should be retried based on error

 */

export function shouldRetryOperation(error: unknown): boolean {

  if (!error) return false;

 

  // Check if it's an ActionError with retryable flag

  if (typeof error === "object" && error !== null && "retryable" in error) {

    return (error as ActionError).retryable;

  }

 

  // Check Error message for retryable patterns

  if (error instanceof Error) {

    const message = error.message.toLowerCase();

    const retryablePatterns = [

      "timeout",

      "econnrefused",

      "enotfound",

      "connection",

      "network",

      "fetch failed",

      "temporarily unavailable",

    ];

 

    return retryablePatterns.some((pattern) => message.includes(pattern));

  }

 

  return false;

}