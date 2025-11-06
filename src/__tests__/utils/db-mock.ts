import { vi } from 'vitest';

/**
 * Database Mock Utilities
 *
 * Provides utilities for mocking Drizzle ORM database operations in tests.
 */

/**
 * Creates a mock database instance with common query methods
 */
export function createMockDb() {
  return {
    query: {
      members: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      teesheets: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      timeBlocks: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      lotteryEntries: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      lotteryGroups: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      events: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      memberClasses: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      paceOfPlay: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      auditLogs: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  };
}

/**
 * Mock database transaction
 */
export function createMockTransaction() {
  const mockDb = createMockDb();

  return {
    ...mockDb,
    transaction: vi.fn(async (callback) => {
      return await callback(mockDb);
    }),
  };
}

/**
 * Helper to create mock member data
 */
export function createMockMember(overrides = {}) {
  return {
    id: 1,
    memberNumber: '123',
    firstName: 'Test',
    lastName: 'Member',
    email: 'test@example.com',
    phone: '555-1234',
    memberClassId: 1,
    handicap: 10.5,
    bagNumber: '42',
    clerkUserId: 'user_123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock teesheet data
 */
export function createMockTeesheet(overrides = {}) {
  return {
    id: 1,
    date: '2025-11-04',
    configId: 1,
    published: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock time block data
 */
export function createMockTimeBlock(overrides = {}) {
  return {
    id: 1,
    teesheetId: 1,
    startTime: '08:00',
    maxMembers: 4,
    currentMembers: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock lottery entry data
 */
export function createMockLotteryEntry(overrides = {}) {
  return {
    id: 1,
    teesheetId: 1,
    memberId: 1,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Mock Clerk auth
 */
export function createMockAuth(overrides = {}) {
  return {
    userId: 'user_123',
    sessionId: 'sess_123',
    orgId: null,
    ...overrides,
  };
}

/**
 * Mock current user context
 */
export function createMockUser(overrides = {}) {
  return {
    id: 'user_123',
    firstName: 'Test',
    lastName: 'User',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
    publicMetadata: {
      isAdmin: false,
      isMember: true,
    },
    ...overrides,
  };
}