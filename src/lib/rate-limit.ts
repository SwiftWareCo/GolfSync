/**

 * Rate Limiting Implementation

 *

 * Provides rate limiting for API endpoints and server actions to prevent abuse.

 * Uses in-memory storage for development, can be upgraded to Redis/Vercel KV for production.

 */

 

// ============================================================================

// TYPES

// ============================================================================

 

export type RateLimitConfig = {

    /**
  
     * Maximum number of requests allowed in the time window
  
     */
  
    maxRequests: number;
  
   
  
    /**
  
     * Time window in milliseconds
  
     */
  
    windowMs: number;
  
   
  
    /**
  
     * Optional message to return when rate limit is exceeded
  
     */
  
    message?: string;
  
  };
  
   
  
  export type RateLimitResult = {
  
    success: boolean;
  
    limit: number;
  
    remaining: number;
  
    reset: number; // Unix timestamp when the limit resets
  
    retryAfter?: number; // Seconds until next request allowed
  
  };
  
   
  
  type RateLimitEntry = {
  
    count: number;
  
    resetTime: number;
  
  };
  
   
  
  // ============================================================================
  
  // IN-MEMORY STORE
  
  // ============================================================================
  
   
  
  /**
  
   * Simple in-memory rate limit store
  
   * Note: This will reset when the server restarts
  
   * For production, consider using Redis or Vercel KV
  
   */
  
  class RateLimitStore {
  
    private store = new Map<string, RateLimitEntry>();
  
    private cleanupInterval: NodeJS.Timeout | null = null;
  
   
  
    constructor() {
  
      // Clean up expired entries every minute
  
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  
    }
  
   
  
    get(key: string): RateLimitEntry | undefined {
  
      return this.store.get(key);
  
    }
  
   
  
    set(key: string, entry: RateLimitEntry): void {
  
      this.store.set(key, entry);
  
    }
  
   
  
    delete(key: string): void {
  
      this.store.delete(key);
  
    }
  
   
  
    cleanup(): void {
  
      const now = Date.now();
  
      for (const [key, entry] of this.store.entries()) {
  
        if (entry.resetTime <= now) {
  
          this.store.delete(key);
  
        }
  
      }
  
    }
  
   
  
    destroy(): void {
  
      if (this.cleanupInterval) {
  
        clearInterval(this.cleanupInterval);
  
        this.cleanupInterval = null;
  
      }
  
      this.store.clear();
  
    }
  
   
  
    size(): number {
  
      return this.store.size;
  
    }
  
  }
  
   
  
  // Global store instance
  
  const store = new RateLimitStore();
  
   
  
  // ============================================================================
  
  // RATE LIMITING FUNCTIONS
  
  // ============================================================================
  
   
  
  /**
  
   * Check and update rate limit for a given identifier
  
   *
  
   * @param identifier - Unique identifier (userId, IP address, etc.)
  
   * @param config - Rate limit configuration
  
   * @returns Rate limit result
  
   */
  
  export function checkRateLimit(
  
    identifier: string,
  
    config: RateLimitConfig
  
  ): RateLimitResult {
  
    const now = Date.now();
  
    const entry = store.get(identifier);
  
   
  
    // If no entry exists or entry has expired, create a new one
  
    if (!entry || entry.resetTime <= now) {
      // Special case: if maxRequests is 0, always fail

    if (config.maxRequests === 0) {

      const newEntry: RateLimitEntry = {

        count: 1,

        resetTime: now + config.windowMs,

      };

      store.set(identifier, newEntry);

 

      return {

        success: false,

        limit: config.maxRequests,

        remaining: 0,

        reset: newEntry.resetTime,

        retryAfter: Math.ceil(config.windowMs / 1000),

      };

    }

 
  
      const newEntry: RateLimitEntry = {
  
        count: 1,
  
        resetTime: now + config.windowMs,
  
      };
  
      store.set(identifier, newEntry);
  
   
  
      return {
  
        success: true,
  
        limit: config.maxRequests,
  
        remaining: config.maxRequests - 1,
  
        reset: newEntry.resetTime,
  
      };
  
    }
  
   
  
    // Entry exists and is still valid
  
    if (entry.count < config.maxRequests) {
  
      entry.count++;
  
      store.set(identifier, entry);
  
   
  
      return {
  
        success: true,
  
        limit: config.maxRequests,
  
        remaining: config.maxRequests - entry.count,
  
        reset: entry.resetTime,
  
      };
  
    }
  
   
  
    // Rate limit exceeded
  
    return {
  
      success: false,
  
      limit: config.maxRequests,
  
      remaining: 0,
  
      reset: entry.resetTime,
  
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
  
    };
  
  }
  
   
  
  /**
  
   * Reset rate limit for a given identifier
  
   * Useful for testing or manual reset
  
   */
  
  export function resetRateLimit(identifier: string): void {
  
    store.delete(identifier);
  
  }
  
   
  
  /**
  
   * Clear all rate limits
  
   * Useful for testing
  
   */
  
  export function clearAllRateLimits(): void {
  
    store.destroy();
  
  }
  
   
  
  // ============================================================================
  
  // PRE-CONFIGURED RATE LIMITERS
  
  // ============================================================================
  
   
  
  /**
  
   * Strict rate limit (10 requests per minute)
  
   * Use for sensitive operations like authentication, password reset
  
   */
  
  export function strictRateLimit(identifier: string): RateLimitResult {
  
    return checkRateLimit(identifier, {
  
      maxRequests: 10,
  
      windowMs: 60 * 1000, // 1 minute
  
      message: "Too many requests. Please try again in a minute.",
  
    });
  
  }
  
   
  
  /**
  
   * Standard rate limit (60 requests per minute)
  
   * Use for normal API endpoints and server actions
  
   */
  
  export function standardRateLimit(identifier: string): RateLimitResult {
  
    return checkRateLimit(identifier, {
  
      maxRequests: 60,
  
      windowMs: 60 * 1000, // 1 minute
  
      message: "Too many requests. Please slow down.",
  
    });
  
  }
  
   
  
  /**
  
   * Relaxed rate limit (300 requests per minute)
  
   * Use for read-only operations
  
   */
  
  export function relaxedRateLimit(identifier: string): RateLimitResult {
  
    return checkRateLimit(identifier, {
  
      maxRequests: 300,
  
      windowMs: 60 * 1000, // 1 minute
  
      message: "Too many requests.",
  
    });
  
  }
  
   
  
  /**
  
   * Cron rate limit (1 request per 10 seconds)
  
   * Use for scheduled jobs that should run at specific intervals
  
   */
  
  export function cronRateLimit(identifier: string): RateLimitResult {
  
    return checkRateLimit(identifier, {
  
      maxRequests: 1,
  
      windowMs: 10 * 1000, // 10 seconds
  
      message: "Cron job rate limit exceeded.",
  
    });
  
  }
  
   
  
  // ============================================================================
  
  // RATE LIMIT MIDDLEWARE
  
  // ============================================================================
  
   
  
  /**
  
   * Create a rate limit error response
  
   */
  
  export function createRateLimitError(result: RateLimitResult) {
  
    return {
  
      success: false,
  
      error: "Rate limit exceeded",
  
      limit: result.limit,
  
      remaining: result.remaining,
  
      reset: result.reset,
  
      retryAfter: result.retryAfter,
  
    };
  
  }
  
   
  
  /**
  
   * Check rate limit and throw error if exceeded
  
   * Useful for server actions
  
   *
  
   * @param identifier - Unique identifier for rate limiting
  
   * @param config - Rate limit configuration
  
   * @throws {Error} If rate limit is exceeded
  
   */
  
  export function enforceRateLimit(
  
    identifier: string,
  
    config: RateLimitConfig
  
  ): void {
  
    const result = checkRateLimit(identifier, config);
  
   
  
    if (!result.success) {
  
      const error = {
  
        code: "RATE_LIMIT_EXCEEDED",
  
        message:
  
          config.message ||
  
          `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
  
        status: 429,
  
        ...result,
  
      };
  
      throw new Error(JSON.stringify(error));
  
    }
  
  }
  
   
  
  /**
  
   * Enforce strict rate limit (throws on exceed)
  
   */
  
  export function enforceStrictRateLimit(identifier: string): void {
  
    enforceRateLimit(identifier, {
  
      maxRequests: 10,
  
      windowMs: 60 * 1000,
  
      message: "Too many requests. Please try again in a minute.",
  
    });
  
  }
  
   
  
  /**
  
   * Enforce standard rate limit (throws on exceed)
  
   */
  
  export function enforceStandardRateLimit(identifier: string): void {
  
    enforceRateLimit(identifier, {
  
      maxRequests: 60,
  
      windowMs: 60 * 1000,
  
      message: "Too many requests. Please slow down.",
  
    });
  
  }
  
   
  
  // ============================================================================
  
  // HELPERS
  
  // ============================================================================
  
   
  
  /**
  
   * Get rate limit headers for HTTP responses
  
   * Useful for API routes
  
   */
  
  export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  
    return {
  
      "X-RateLimit-Limit": String(result.limit),
  
      "X-RateLimit-Remaining": String(result.remaining),
  
      "X-RateLimit-Reset": String(result.reset),
  
      ...(result.retryAfter
  
        ? { "Retry-After": String(result.retryAfter) }
  
        : {}),
  
    };
  
  }
  
   
  
  /**
  
   * Get rate limit status for an identifier
  
   * Useful for checking current status without incrementing count
  
   */
  
  export function getRateLimitStatus(identifier: string, config: RateLimitConfig): {
  
    remaining: number;
  
    reset: number;
  
  } {
  
    const entry = store.get(identifier);
  
    const now = Date.now();
  
   
  
    if (!entry || entry.resetTime <= now) {
  
      return {
  
        remaining: config.maxRequests,
  
        reset: now + config.windowMs,
  
      };
  
    }
  
   
  
    return {
  
      remaining: Math.max(0, config.maxRequests - entry.count),
  
      reset: entry.resetTime,
  
    };
  
  }
  
   
  
  // ============================================================================
  
  // UTILITY FUNCTIONS
  
  // ============================================================================
  
   
  
  /**
  
   * Get identifier from user ID
  
   * Prefix with "user:" to namespace rate limits
  
   */
  
  export function getUserRateLimitKey(userId: string): string {
  
    return `user:${userId}`;
  
  }
  
   
  
  /**
  
   * Get identifier from IP address
  
   * Prefix with "ip:" to namespace rate limits
  
   */
  
  export function getIPRateLimitKey(ip: string): string {
  
    return `ip:${ip}`;
  
  }
  
   
  
  /**
  
   * Get identifier for action
  
   * Prefix with action name and user ID
  
   */
  
  export function getActionRateLimitKey(action: string, userId: string): string {
  
    return `action:${action}:${userId}`;
  
  }
  
   
  
  /**
  
   * Get identifier for endpoint
  
   * Prefix with endpoint path and identifier
  
   */
  
  export function getEndpointRateLimitKey(
  
    endpoint: string,
  
    identifier: string
  
  ): string {
  
    return `endpoint:${endpoint}:${identifier}`;
  
  }
  
   
  
  // ============================================================================
  
  // TESTING UTILITIES
  
  // ============================================================================
  
   
  
  /**
  
   * Get store size (for testing)
  
   */
  
  export function getStoreSize(): number {
  
    return store.size();
  
  }
  
   
  
  /**
  
   * Manual cleanup (for testing)
  
   */
  
  export function cleanupStore(): void {
  
    store.cleanup();
  
  }