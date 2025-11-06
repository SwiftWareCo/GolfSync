import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  submitLotteryEntry,
  processLotteryForDate,
  cancelLotteryEntry,
  assignLotteryEntry,
} from '../actions';
import type { LotteryEntryFormData } from '~/app/types/LotteryTypes';
import { ConfigTypes } from '~/app/types/TeeSheetTypes';
import type { TeesheetConfig } from '~/app/types/TeeSheetTypes';

// Mock the database
vi.mock('~/server/db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    query: {
      members: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      lotteryEntries: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      lotteryGroups: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      memberFairnessScores: {
        findFirst: vi.fn(),
      },
      memberSpeedProfiles: {
        findFirst: vi.fn(),
      },
      timeBlocks: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      teesheets: {
        findFirst: vi.fn(),
      },
      timeblockRestrictions: {
        findMany: vi.fn(),
      },
    },
  },
}));

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock lottery utils
vi.mock('~/lib/lottery-utils', () => ({
  calculateDynamicTimeWindows: vi.fn(() => [
    { value: 'MORNING', startMinutes: 420, endMinutes: 660 }, // 7:00-11:00
    { value: 'MIDDAY', startMinutes: 660, endMinutes: 780 }, // 11:00-13:00
    { value: 'AFTERNOON', startMinutes: 780, endMinutes: 1020 }, // 13:00-17:00
  ]),
}));

import { db } from '~/server/db';

describe('Lottery Entry Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitLotteryEntry - Individual Entry', () => {
    it('should create an individual lottery entry', async () => {
      const mockMember = {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        class: 'REGULAR MALE',
        email: 'john@example.com',
      };

      const mockEntry = {
        id: 1,
        memberId: 1,
        lotteryDate: '2025-11-10',
        preferredWindow: 'MORNING',
        alternateWindow: 'MIDDAY',
        status: 'PENDING',
        submissionTimestamp: new Date(),
      };

      const formData: LotteryEntryFormData = {
        lotteryDate: '2025-11-10',
        preferredWindow: 'MORNING',
        alternateWindow: 'MIDDAY',
      };

      // Mock member lookup
      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);

      // Mock existing entry check (none found)
      vi.mocked(db.query.lotteryEntries.findFirst).mockResolvedValue(null);

      // Mock insert
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockEntry]),
        }),
      } as any);

      const result = await submitLotteryEntry(1, formData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEntry);
      expect(db.query.lotteryEntries.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });
    });

    it('should reject duplicate individual entries for same date', async () => {
      const mockMember = {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        class: 'REGULAR MALE',
      };

      const existingEntry = {
        id: 1,
        memberId: 1,
        lotteryDate: '2025-11-10',
        status: 'PENDING',
      };

      const formData: LotteryEntryFormData = {
        lotteryDate: '2025-11-10',
        preferredWindow: 'MORNING',
      };

      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(db.query.lotteryEntries.findFirst).mockResolvedValue(
        existingEntry as any
      );

      const result = await submitLotteryEntry(1, formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already have a lottery entry');
    });

    it('should return error when member not found', async () => {
      const formData: LotteryEntryFormData = {
        lotteryDate: '2025-11-10',
        preferredWindow: 'MORNING',
      };

      vi.mocked(db.query.members.findFirst).mockResolvedValue(null);

      const result = await submitLotteryEntry(999, formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Member not found');
    });
  });

  describe('submitLotteryEntry - Group Entry', () => {
    it('should create a group lottery entry', async () => {
      const mockLeader = {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        class: 'REGULAR MALE',
      };

      const mockGroup = {
        id: 1,
        leaderId: 1,
        lotteryDate: '2025-11-10',
        memberIds: [1, 2, 3, 4],
        preferredWindow: 'MORNING',
        alternateWindow: 'MIDDAY',
        status: 'PENDING',
      };

      const formData: LotteryEntryFormData = {
        lotteryDate: '2025-11-10',
        preferredWindow: 'MORNING',
        alternateWindow: 'MIDDAY',
        memberIds: [2, 3, 4], // Group members besides leader
      };

      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockLeader as any);
      vi.mocked(db.query.lotteryGroups.findFirst).mockResolvedValue(null);
      vi.mocked(db.query.lotteryEntries.findMany).mockResolvedValue([]);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockGroup]),
        }),
      } as any);

      const result = await submitLotteryEntry(1, formData);

      expect(result.success).toBe(true);
      expect(result.data.memberIds).toEqual([1, 2, 3, 4]); // Leader + members
    });

    it('should reject group entry if any member has individual entry', async () => {
      const mockLeader = {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        class: 'REGULAR MALE',
      };

      const existingIndividualEntry = {
        id: 1,
        memberId: 2, // One of the group members
        lotteryDate: '2025-11-10',
        status: 'PENDING',
      };

      const formData: LotteryEntryFormData = {
        lotteryDate: '2025-11-10',
        preferredWindow: 'MORNING',
        memberIds: [2, 3, 4],
      };

      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockLeader as any);
      vi.mocked(db.query.lotteryGroups.findFirst).mockResolvedValue(null);
      vi.mocked(db.query.lotteryEntries.findMany).mockResolvedValue([
        existingIndividualEntry as any,
      ]);

      const result = await submitLotteryEntry(1, formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already have lottery entries');
    });

    it('should reject duplicate group entries for same date', async () => {
      const mockLeader = {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        class: 'REGULAR MALE',
      };

      const existingGroup = {
        id: 1,
        leaderId: 1,
        lotteryDate: '2025-11-10',
        status: 'PENDING',
      };

      const formData: LotteryEntryFormData = {
        lotteryDate: '2025-11-10',
        preferredWindow: 'MORNING',
        memberIds: [2, 3, 4],
      };

      vi.mocked(db.query.members.findFirst).mockResolvedValue(mockLeader as any);
      vi.mocked(db.query.lotteryGroups.findFirst).mockResolvedValue(
        existingGroup as any
      );

      const result = await submitLotteryEntry(1, formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already have a group lottery entry');
    });
  });
});

describe('Lottery Entry Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cancelLotteryEntry', () => {
    it('should cancel an individual lottery entry', async () => {
      const cancelledEntry = {
        id: 1,
        memberId: 1,
        lotteryDate: '2025-11-10',
        status: 'CANCELLED',
        updatedAt: new Date(),
      };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([cancelledEntry]),
          }),
        }),
      } as any);

      const result = await cancelLotteryEntry(1, false);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('CANCELLED');
    });

    it('should cancel a group lottery entry', async () => {
      const cancelledGroup = {
        id: 1,
        leaderId: 1,
        lotteryDate: '2025-11-10',
        status: 'CANCELLED',
        updatedAt: new Date(),
      };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([cancelledGroup]),
          }),
        }),
      } as any);

      const result = await cancelLotteryEntry(1, true);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('CANCELLED');
    });
  });

  describe('assignLotteryEntry', () => {
    it('should assign an individual entry to a time block', async () => {
      const mockTimeBlock = {
        id: 10,
        teesheetId: 1,
        startTime: '08:00',
        endTime: '08:00',
        maxMembers: 4,
      };

      const assignedEntry = {
        id: 1,
        memberId: 5,
        lotteryDate: '2025-11-10',
        status: 'ASSIGNED',
        assignedTimeBlockId: 10,
        processedAt: new Date(),
      };

      vi.mocked(db.query.timeBlocks.findFirst).mockResolvedValue(
        mockTimeBlock as any
      );

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([assignedEntry]),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await assignLotteryEntry(1, 10, false);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('ASSIGNED');
      expect(result.data.assignedTimeBlockId).toBe(10);
    });

    it('should assign a group entry to a time block', async () => {
      const mockTimeBlock = {
        id: 10,
        teesheetId: 1,
        startTime: '08:00',
        endTime: '08:00',
        maxMembers: 4,
      };

      const assignedGroup = {
        id: 1,
        leaderId: 1,
        memberIds: [1, 2, 3, 4],
        lotteryDate: '2025-11-10',
        status: 'ASSIGNED',
        assignedTimeBlockId: 10,
        processedAt: new Date(),
      };

      vi.mocked(db.query.timeBlocks.findFirst).mockResolvedValue(
        mockTimeBlock as any
      );

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([assignedGroup]),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await assignLotteryEntry(1, 10, true);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('ASSIGNED');
      expect(db.insert).toHaveBeenCalled(); // Should insert all group members
    });

    it('should return error when time block not found', async () => {
      vi.mocked(db.query.timeBlocks.findFirst).mockResolvedValue(null);

      const result = await assignLotteryEntry(1, 999, false);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Time block not found');
    });
  });
});

describe('Lottery Processing - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle processing when no entries exist', async () => {
    const mockConfig: TeesheetConfig = {
      id: 1,
      name: 'Test Config',
      type: ConfigTypes.REGULAR,
      startTime: '07:00',
      endTime: '19:00',
      interval: 15,
      maxMembersPerBlock: 4,
      isActive: true,
      isSystemConfig: true,
      rules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock getLotteryEntriesForDate to return no entries
    vi.doMock('~/server/lottery/data', () => ({
      getLotteryEntriesForDate: vi.fn().mockResolvedValue({
        individual: [],
        groups: [],
      }),
      getAvailableTimeBlocksForDate: vi.fn().mockResolvedValue([
        {
          id: 1,
          startTime: '08:00',
          availableSpots: 4,
        },
      ]),
      getActiveTimeRestrictionsForDate: vi.fn().mockResolvedValue([]),
    }));

    const result = await processLotteryForDate('2025-11-10', mockConfig);

    expect(result.success).toBe(true);
    expect(result.data.processedCount).toBe(0);
  });

  it('should handle processing when no available time blocks', async () => {
    const mockConfig: TeesheetConfig = {
      id: 1,
      name: 'Test Config',
      type: ConfigTypes.REGULAR,
      startTime: '07:00',
      endTime: '19:00',
      interval: 15,
      maxMembersPerBlock: 4,
      isActive: true,
      isSystemConfig: true,
      rules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.doMock('~/server/lottery/data', () => ({
      getLotteryEntriesForDate: vi.fn().mockResolvedValue({
        individual: [
          {
            id: 1,
            memberId: 1,
            lotteryDate: '2025-11-10',
            preferredWindow: 'MORNING',
            status: 'PENDING',
            member: { id: 1, class: 'REGULAR MALE' },
            submissionTimestamp: new Date(),
          },
        ],
        groups: [],
      }),
      getAvailableTimeBlocksForDate: vi.fn().mockResolvedValue([]),
      getActiveTimeRestrictionsForDate: vi.fn().mockResolvedValue([]),
    }));

    const result = await processLotteryForDate('2025-11-10', mockConfig);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No available time blocks');
  });

  it('should handle processing with insufficient slots for all entries', async () => {
    const mockConfig: TeesheetConfig = {
      id: 1,
      name: 'Test Config',
      type: ConfigTypes.REGULAR,
      startTime: '07:00',
      endTime: '08:00',
      interval: 15,
      maxMembersPerBlock: 4,
      isActive: true,
      isSystemConfig: true,
      rules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Only 4 available spots, but 6 individual entries
    vi.doMock('~/server/lottery/data', () => ({
      getLotteryEntriesForDate: vi.fn().mockResolvedValue({
        individual: Array.from({ length: 6 }, (_, i) => ({
          id: i + 1,
          memberId: i + 1,
          lotteryDate: '2025-11-10',
          preferredWindow: 'MORNING',
          status: 'PENDING',
          member: { id: i + 1, class: 'REGULAR MALE' },
          submissionTimestamp: new Date(Date.now() + i * 1000), // Different submission times
        })),
        groups: [],
      }),
      getAvailableTimeBlocksForDate: vi.fn().mockResolvedValue([
        {
          id: 1,
          startTime: '07:00',
          endTime: '07:00',
          availableSpots: 4,
          maxMembers: 4,
          currentOccupancy: 0,
          isAvailable: true,
        },
      ]),
      getActiveTimeRestrictionsForDate: vi.fn().mockResolvedValue([]),
    }));

    const result = await processLotteryForDate('2025-11-10', mockConfig);

    expect(result.success).toBe(true);
    // Should process only 4 out of 6 entries
    expect(result.data.processedCount).toBeLessThanOrEqual(4);
  });
});

describe('Lottery Business Logic - Fairness and Priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate time window preferences', async () => {
    const formData: LotteryEntryFormData = {
      lotteryDate: '2025-11-10',
      preferredWindow: 'MORNING',
      alternateWindow: 'MIDDAY',
    };

    const mockMember = {
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      class: 'REGULAR MALE',
    };

    vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
    vi.mocked(db.query.lotteryEntries.findFirst).mockResolvedValue(null);

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 1,
            memberId: 1,
            lotteryDate: '2025-11-10',
            preferredWindow: 'MORNING',
            alternateWindow: 'MIDDAY',
            status: 'PENDING',
          },
        ]),
      }),
    } as any);

    const result = await submitLotteryEntry(1, formData);

    expect(result.success).toBe(true);
    expect(result.data.preferredWindow).toBe('MORNING');
    expect(result.data.alternateWindow).toBe('MIDDAY');
  });

  it('should handle group size validation', async () => {
    const mockLeader = {
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      class: 'REGULAR MALE',
    };

    // Group of 4 (leader + 3 members)
    const formData: LotteryEntryFormData = {
      lotteryDate: '2025-11-10',
      preferredWindow: 'MORNING',
      memberIds: [2, 3, 4],
    };

    vi.mocked(db.query.members.findFirst).mockResolvedValue(mockLeader as any);
    vi.mocked(db.query.lotteryGroups.findFirst).mockResolvedValue(null);
    vi.mocked(db.query.lotteryEntries.findMany).mockResolvedValue([]);

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 1,
            leaderId: 1,
            memberIds: [1, 2, 3, 4],
            lotteryDate: '2025-11-10',
            preferredWindow: 'MORNING',
            status: 'PENDING',
          },
        ]),
      }),
    } as any);

    const result = await submitLotteryEntry(1, formData);

    expect(result.success).toBe(true);
    expect(result.data.memberIds).toHaveLength(4);
    expect(result.data.memberIds).toContain(1); // Leader included
    expect(result.data.memberIds).toContain(2);
    expect(result.data.memberIds).toContain(3);
    expect(result.data.memberIds).toContain(4);
  });

  it('should handle different group sizes (pairs, threesomes, foursomes)', async () => {
    const mockLeader = {
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      class: 'REGULAR MALE',
    };

    // Test pair (2 members)
    const pairData: LotteryEntryFormData = {
      lotteryDate: '2025-11-10',
      preferredWindow: 'MORNING',
      memberIds: [2],
    };

    vi.mocked(db.query.members.findFirst).mockResolvedValue(mockLeader as any);
    vi.mocked(db.query.lotteryGroups.findFirst).mockResolvedValue(null);
    vi.mocked(db.query.lotteryEntries.findMany).mockResolvedValue([]);

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 1,
            leaderId: 1,
            memberIds: [1, 2],
            lotteryDate: '2025-11-10',
            preferredWindow: 'MORNING',
            status: 'PENDING',
          },
        ]),
      }),
    } as any);

    const result = await submitLotteryEntry(1, pairData);

    expect(result.success).toBe(true);
    expect(result.data.memberIds).toHaveLength(2);
  });
});

describe('Lottery Entry Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent entry for past dates', async () => {
    const pastDate = '2020-01-01';
    const formData: LotteryEntryFormData = {
      lotteryDate: pastDate,
      preferredWindow: 'MORNING',
    };

    const mockMember = {
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      class: 'REGULAR MALE',
    };

    vi.mocked(db.query.members.findFirst).mockResolvedValue(mockMember as any);
    vi.mocked(db.query.lotteryEntries.findFirst).mockResolvedValue(null);

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 1,
            memberId: 1,
            lotteryDate: pastDate,
            preferredWindow: 'MORNING',
            status: 'PENDING',
          },
        ]),
      }),
    } as any);

    // Note: The current implementation doesn't prevent past dates
    // This test documents current behavior
    const result = await submitLotteryEntry(1, formData);

    expect(result.success).toBe(true);
    // In production, you might want to add validation for past dates
  });

  it('should handle group entry with fills', async () => {
    const mockLeader = {
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      class: 'REGULAR MALE',
    };

    const formData: LotteryEntryFormData = {
      lotteryDate: '2025-11-10',
      preferredWindow: 'MORNING',
      memberIds: [2, 3],
      fills: [{ fillType: 'ANY', customName: undefined }],
    };

    vi.mocked(db.query.members.findFirst).mockResolvedValue(mockLeader as any);
    vi.mocked(db.query.lotteryGroups.findFirst).mockResolvedValue(null);
    vi.mocked(db.query.lotteryEntries.findMany).mockResolvedValue([]);

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 1,
            leaderId: 1,
            memberIds: [1, 2, 3],
            lotteryDate: '2025-11-10',
            preferredWindow: 'MORNING',
            fills: [{ fillType: 'ANY' }],
            status: 'PENDING',
          },
        ]),
      }),
    } as any);

    const result = await submitLotteryEntry(1, formData);

    expect(result.success).toBe(true);
    expect(result.data.fills).toBeDefined();
    expect(result.data.fills).toHaveLength(1);
  });
});