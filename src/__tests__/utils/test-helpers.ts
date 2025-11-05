import { vi } from 'vitest';

/**
 * Test Helper Utilities
 */

/**
 * Waits for all pending promises to resolve
 */
export async function waitForAllPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Creates a mock server action result
 */
export function createSuccessResult<T>(data: T) {
  return { success: true as const, data };
}

/**
 * Creates a mock server action error result
 */
export function createErrorResult(error: string) {
  return { success: false as const, error };
}

/**
 * Mock next/headers
 */
export function mockNextHeaders(headers: Record<string, string> = {}) {
  vi.mock('next/headers', () => ({
    headers: vi.fn(() => ({
      get: (key: string) => headers[key] ?? null,
    })),
  }));
}

/**
 * Mock Clerk auth
 */
export function mockClerkAuth(userId: string | null = 'user_123', isAdmin = false) {
  vi.mock('@clerk/nextjs/server', () => ({
    auth: vi.fn(() => ({
      userId,
      sessionId: userId ? 'sess_123' : null,
    })),
    currentUser: vi.fn(async () =>
      userId
        ? {
            id: userId,
            firstName: 'Test',
            lastName: 'User',
            emailAddresses: [{ emailAddress: 'test@example.com' }],
            publicMetadata: {
              isAdmin,
              isMember: true,
            },
          }
        : null
    ),
  }));
}

/**
 * Creates a date string in YYYY-MM-DD format
 */
export function createDateString(daysFromToday = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().split('T')[0]!;
}

/**
 * Creates a mock React Query client for testing
 */
export function createMockQueryClient() {
  const { QueryClient } = require('@tanstack/react-query');
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}